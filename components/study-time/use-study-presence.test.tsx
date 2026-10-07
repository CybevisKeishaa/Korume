import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudyPresence } from "./use-study-presence";

const beatBodies = () => vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const advance = async (ms: number) => {
  for (let remaining = ms; remaining > 0;) {
    const step = Math.min(remaining, 30_000);
    await act(async () => { vi.advanceTimersByTime(step); await Promise.resolve(); await Promise.resolve(); });
    remaining -= step;
  }
};
const mount = (options: { contextId?: string | null; mediaPlaying?: boolean; enabled?: boolean } = {}) =>
  renderHook(({ contextId, mediaPlaying, enabled }) => useStudyPresence({ surface: "shadowing", contextId, mediaPlaying, enabled }), {
    initialProps: { contextId: options.contextId ?? "video-1", mediaPlaying: options.mediaPlaying ?? false, enabled: options.enabled ?? true },
  });

describe("useStudyPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    let accepted = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      accepted = body.seq;
      return { ok: true, json: async () => ({ data: { sessionId: "s1", acceptedSeq: accepted, segmented: false } }) } as Response;
    }));
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("p1").mockReturnValueOnce("p2").mockReturnValue("p3") });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("starts on visible mount and beats every 30 seconds with increasing sequence", async () => {
    mount(); await flush(); await advance(60_000);
    expect(beatBodies().map(({ kind, seq }) => [kind, seq])).toEqual([["start", 0], ["beat", 1], ["beat", 2]]);
  });

  it("does not beat while hidden", async () => {
    mount(); await flush();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await advance(90_000);
    expect(beatBodies()).toHaveLength(1);
  });

  it("stops beats at the 120 second inactivity boundary", async () => {
    mount(); await flush(); await advance(180_000);
    expect(beatBodies().map(({ seq }) => seq)).toEqual([0, 1, 2, 3]);
  });

  it("keeps beating during ten minutes of media playback without input", async () => {
    mount({ mediaPlaying: true }); await flush(); await advance(600_000);
    expect(beatBodies()).toHaveLength(21);
  });

  it("scroll and selection extend the interaction window", async () => {
    mount(); await flush(); await advance(100_000);
    act(() => window.dispatchEvent(new Event("scroll")));
    await advance(100_000);
    act(() => document.dispatchEvent(new Event("selectionchange")));
    await advance(119_000);
    expect(beatBodies().at(-1)?.seq).toBe(10);
    await advance(31_000);
    expect(beatBodies().at(-1)?.seq).toBe(10);
  });

  it("uses a segmented session id on the next beat", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const { seq } = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({ data: { sessionId: seq === 1 ? "s2" : "s1", acceptedSeq: seq, segmented: seq === 1 } }) } as Response;
    });
    mount(); await flush(); await advance(60_000);
    expect(beatBodies()[2].sessionId).toBe("s2");
  });

  it("sends one beacon stop on pagehide", async () => {
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    mount(); await flush();
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(beacon).toHaveBeenCalledOnce();
    const call = beacon.mock.calls.at(0);
    expect(call?.[0]).toBe("/api/study/heartbeat");
    expect(call?.[1]).toMatchObject({ type: "application/json" });
    expect(call?.[1].size).toBeGreaterThan(0);
  });

  it("falls back to keepalive fetch when beacon is absent", async () => {
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });
    mount(); await flush();
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({ keepalive: true });
    expect(beatBodies()[1].kind).toBe("stop");
  });

  it("waits until enabled", async () => {
    const hook = mount({ enabled: false }); await flush();
    expect(fetch).not.toHaveBeenCalled();
    hook.rerender({ contextId: "video-1", mediaPlaying: false, enabled: true }); await flush();
    expect(beatBodies()[0].kind).toBe("start");
  });

  it("stops the old context and starts a new presence on context change", async () => {
    Object.defineProperty(navigator, "sendBeacon", { value: vi.fn(() => true), configurable: true });
    const hook = mount(); await flush();
    hook.rerender({ contextId: "video-2", mediaPlaying: false, enabled: true }); await flush();
    expect(beatBodies().map(({ clientPresenceId, contextId, kind }) => [clientPresenceId, contextId, kind])).toEqual([
      ["p1", "video-1", "start"], ["p2", "video-2", "start"],
    ]);
    expect(navigator.sendBeacon).toHaveBeenCalledOnce();
  });

  it("sends stop on cleanup", async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    const hook = mount(); await flush(); hook.unmount();
    expect(beacon).toHaveBeenCalledOnce();
  });

  it("restarts when a closed session rejects a beat", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const { kind, seq } = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({ data: { sessionId: "s1", acceptedSeq: kind === "beat" ? 0 : seq, segmented: false } }) } as Response;
    });
    mount(); await flush(); await advance(30_000);
    expect(beatBodies().map(({ kind, clientPresenceId, seq }) => [kind, clientPresenceId, seq])).toEqual([
      ["start", "p1", 0], ["beat", "p1", 1], ["start", "p2", 0],
    ]);
  });

  it("starts a fresh presence when restored from bfcache", async () => {
    mount(); await flush();
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await flush();
    expect(beatBodies().map(({ kind, clientPresenceId, seq }) => [kind, clientPresenceId, seq])).toEqual([
      ["start", "p1", 0], ["start", "p2", 0],
    ]);
  });

  it("ignores an old in-flight answer after bfcache restoration", async () => {
    let resolveOld: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.kind === "beat") return new Promise<Response>((resolve) => { resolveOld = resolve; });
      return { ok: true, json: async () => ({ data: { sessionId: body.clientPresenceId, acceptedSeq: 0, segmented: false } }) } as Response;
    });
    mount(); await flush(); await advance(30_000);
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await flush();
    expect(beatBodies().at(-1)).toMatchObject({ kind: "start", clientPresenceId: "p2" });
    await act(async () => resolveOld?.({ ok: true, json: async () => ({ data: { sessionId: "p1", acceptedSeq: 1, segmented: false } }) } as Response));
    await advance(30_000);
    expect(beatBodies().at(-1)).toMatchObject({ kind: "beat", clientPresenceId: "p2", sessionId: "p2" });
  });

  it("an old answer never unlocks a second request while the new start is in flight", async () => {
    let resolveOld: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.kind === "beat") return new Promise<Response>((resolve) => { resolveOld = resolve; });
      if (body.clientPresenceId === "p2") return new Promise<Response>(() => undefined);
      return { ok: true, json: async () => ({ data: { sessionId: "s1", acceptedSeq: 0, segmented: false } }) } as Response;
    });
    mount(); await flush(); await advance(30_000);
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await flush();
    await act(async () => resolveOld?.({ ok: true, json: async () => ({ data: { sessionId: "s1", acceptedSeq: 1, segmented: false } }) } as Response));
    await advance(30_000);
    expect(beatBodies().filter(({ clientPresenceId }) => clientPresenceId === "p2")).toHaveLength(1);
  });
});
