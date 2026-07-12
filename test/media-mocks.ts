/**
 * Browser media mocks for jsdom/vitest.
 *
 * jsdom implements neither `navigator.mediaDevices.getUserMedia` nor
 * `MediaRecorder`, so any shadowing-recorder test needs fakes installed on
 * the global before the component/hook under test runs. Both mocks are
 * install/restore pairs so tests can clean up in `afterEach` and never leak
 * state between cases (CLAUDE.md §7 — no flaky/nondeterministic tests).
 *
 * Typical usage:
 *
 *   let mr: MediaRecorderMockHandle;
 *   let gum: GetUserMediaMockHandle;
 *   beforeEach(() => {
 *     mr = mockMediaRecorder();
 *     gum = mockGetUserMedia();
 *   });
 *   afterEach(() => {
 *     mr.restore();
 *     gum.restore();
 *   });
 *
 *   // ... trigger recording in the component, then:
 *   mr.instances[0]?.stop(); // synchronously emits `dataavailable` + `stop`
 */

/** Minimal fake `MediaStreamTrack` — enough surface for shadowing-recorder code. */
function createFakeAudioTrack(id: string): MediaStreamTrack {
  const track = {
    id,
    kind: "audio",
    label: "fake-microphone",
    enabled: true,
    muted: false,
    readyState: "live" as MediaStreamTrackState,
    stop(): void {
      track.readyState = "ended";
    },
    clone(): MediaStreamTrack {
      return createFakeAudioTrack(id);
    },
    getSettings: () => ({}) as MediaTrackSettings,
    getCapabilities: () => ({}) as MediaTrackCapabilities,
    getConstraints: () => ({}) as MediaTrackConstraints,
    applyConstraints: async () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    onended: null,
    onmute: null,
    onunmute: null,
  };
  // jsdom ships no MediaStreamTrack implementation to extend; this object
  // satisfies the surface the app is expected to call.
  return track as unknown as MediaStreamTrack;
}

export interface FakeMediaStreamOptions {
  /** Reported stream id. Defaults to "fake-stream". */
  id?: string;
  /** Number of fake audio tracks to include. Defaults to 1. */
  audioTrackCount?: number;
}

/** Builds a fake `MediaStream` with the given number of fake audio tracks. */
export function createFakeMediaStream(
  options: FakeMediaStreamOptions = {},
): MediaStream {
  const { id = "fake-stream", audioTrackCount = 1 } = options;
  const tracks: MediaStreamTrack[] = Array.from(
    { length: audioTrackCount },
    (_, i) => createFakeAudioTrack(`${id}-track-${i}`),
  );
  const stream = {
    id,
    active: true,
    getTracks: () => [...tracks],
    getAudioTracks: () => [...tracks],
    getVideoTracks: () => [] as MediaStreamTrack[],
    addTrack: () => undefined,
    removeTrack: () => undefined,
    clone: () => createFakeMediaStream(options),
    getTrackById: (trackId: string) =>
      tracks.find((t) => t.id === trackId) ?? null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    onaddtrack: null,
    onremovetrack: null,
  };
  // Same rationale as createFakeAudioTrack: no real MediaStream in jsdom.
  return stream as unknown as MediaStream;
}

export interface GetUserMediaMockOptions {
  /** Stream resolved on success. Defaults to a fresh 1-audio-track fake mic stream. */
  stream?: MediaStream;
  /** If set, `getUserMedia` rejects with this instead of resolving (e.g. permission denied). */
  rejectWith?: Error;
}

export interface GetUserMediaMockHandle {
  /** The stream `getUserMedia` resolves with (unless `rejectWith` was set). */
  stream: MediaStream;
  /** Every constraints object passed to `getUserMedia`, in call order. */
  calls: (MediaStreamConstraints | undefined)[];
  /** Restores whatever `navigator.mediaDevices` was before this mock was installed. */
  restore(): void;
}

/** Installs a fake `navigator.mediaDevices.getUserMedia`. */
export function mockGetUserMedia(
  options: GetUserMediaMockOptions = {},
): GetUserMediaMockHandle {
  const stream = options.stream ?? createFakeMediaStream();
  const calls: (MediaStreamConstraints | undefined)[] = [];

  const originalDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "mediaDevices",
  );

  const fakeMediaDevices = {
    getUserMedia: async (
      constraints?: MediaStreamConstraints,
    ): Promise<MediaStream> => {
      calls.push(constraints);
      if (options.rejectWith) throw options.rejectWith;
      return stream;
    },
    enumerateDevices: async () => [] as MediaDeviceInfo[],
    getDisplayMedia: async () => stream,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    ondevicechange: null,
  } as unknown as MediaDevices;

  Object.defineProperty(navigator, "mediaDevices", {
    value: fakeMediaDevices,
    configurable: true,
    writable: true,
  });

  return {
    stream,
    calls,
    restore(): void {
      if (originalDescriptor) {
        Object.defineProperty(navigator, "mediaDevices", originalDescriptor);
      } else {
        // @ts-expect-error -- jsdom's Navigator typing has no delete escape
        // hatch; this only runs when there was no descriptor to restore.
        delete navigator.mediaDevices;
      }
    },
  };
}

export type FakeMediaRecorderState = "inactive" | "recording" | "paused";

/**
 * Fake `MediaRecorder`. Extends the real global `EventTarget` (jsdom
 * provides it) so `addEventListener` works, and also mirrors dispatch to the
 * `on*` handler properties the way the real API does.
 */
export class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(_mimeType: string): boolean {
    return true;
  }

  readonly stream: MediaStream;
  mimeType: string;
  state: FakeMediaRecorderState = "inactive";
  videoBitsPerSecond = 0;
  audioBitsPerSecond = 0;

  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;
  onresume: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private readonly blobParts: BlobPart[];

  constructor(
    stream: MediaStream,
    options: MediaRecorderOptions = {},
    blobParts: BlobPart[] = [new Uint8Array([0, 0, 0, 0])],
  ) {
    super();
    this.stream = stream;
    this.mimeType = options.mimeType ?? "audio/webm";
    this.blobParts = blobParts;
  }

  start(_timesliceMs?: number): void {
    this.state = "recording";
    this.emit("start", new Event("start"));
  }

  /** Emits a `dataavailable` Blob event, then a `stop` event, synchronously. */
  stop(): void {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.emitData();
    this.emit("stop", new Event("stop"));
  }

  pause(): void {
    this.state = "paused";
    this.emit("pause", new Event("pause"));
  }

  resume(): void {
    this.state = "recording";
    this.emit("resume", new Event("resume"));
  }

  /** Emits a `dataavailable` Blob event without stopping the recording. */
  requestData(): void {
    this.emitData();
  }

  private emitData(): void {
    const blob = new Blob(this.blobParts, { type: this.mimeType });
    const event = new Event("dataavailable") as BlobEvent;
    // jsdom has no BlobEvent constructor; attach `data` manually so the
    // event otherwise behaves like a normal Event.
    Object.defineProperty(event, "data", { value: blob, enumerable: true });
    this.emit("dataavailable", event);
  }

  private emit<E extends Event>(type: string, event: E): void {
    this.dispatchEvent(event);
    const handler = (this as unknown as Record<string, unknown>)[`on${type}`];
    if (typeof handler === "function") {
      (handler as (e: E) => void).call(this, event);
    }
  }
}

export interface MediaRecorderMockHandle {
  /** Every `FakeMediaRecorder` constructed since install, in construction order. */
  instances: FakeMediaRecorder[];
  /** Restores the previous global `MediaRecorder` (or removes it if there was none). */
  restore(): void;
}

/**
 * Installs `FakeMediaRecorder` as the global `MediaRecorder`.
 * @param defaultBlobParts bytes emitted in the `dataavailable` Blob on `stop()`/`requestData()`.
 */
export function mockMediaRecorder(
  defaultBlobParts: BlobPart[] = [new Uint8Array([0, 0, 0, 0])],
): MediaRecorderMockHandle {
  const instances: FakeMediaRecorder[] = [];
  const globalWithMr = globalThis as typeof globalThis & {
    MediaRecorder?: typeof MediaRecorder;
  };
  const originalMediaRecorder = globalWithMr.MediaRecorder;

  class TrackedFakeMediaRecorder extends FakeMediaRecorder {
    constructor(stream: MediaStream, options?: MediaRecorderOptions) {
      super(stream, options, defaultBlobParts);
      instances.push(this);
    }
  }

  // The fake only implements the subset of MediaRecorder the app uses.
  globalWithMr.MediaRecorder =
    TrackedFakeMediaRecorder as unknown as typeof MediaRecorder;

  return {
    instances,
    restore(): void {
      globalWithMr.MediaRecorder = originalMediaRecorder;
    },
  };
}
