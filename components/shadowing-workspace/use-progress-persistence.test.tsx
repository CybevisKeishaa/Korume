import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybackPositionStore } from "./playback-position-store";
import { useProgressPersistence } from "./use-progress-persistence";

const KEY = "shadowing-resume:user:video";
const record = () => JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
const respond = (stamp: string) => new Response(JSON.stringify({ data: { last_watched_at: stamp } }), { status: 200 });
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function mount(store = createPlaybackPositionStore(0), initialSyncedServerAt?: string | null) {
  const hook = renderHook(() => useProgressPersistence({ userId: "user", videoId: "video", positionStore: store, initialSyncedServerAt }));
  return { ...hook, store };
}

describe("useProgressPersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond("2026-10-01T00:00:00.000Z")));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("writes a throttled session record and remembers the server timestamp", async () => {
    const { store } = mount();
    act(() => vi.advanceTimersByTime(12_000));
    act(() => store.set(10));
    await settle();
    expect(record()).toMatchObject({ userId: "user", videoId: "video", position: 10, syncedServerAt: "2026-10-01T00:00:00.000Z" });
    act(() => store.set(10.5));
    expect(record()).toMatchObject({ position: 10 });
    act(() => vi.advanceTimersByTime(1_000));
    expect(record()).toMatchObject({ position: 10.5 });
  });

  it("does not PATCH a tick within 12 s of the last write", () => {
    const { store } = mount();
    act(() => { vi.advanceTimersByTime(5_000); store.set(30); });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("writes completion when ended follows a pause at the same position", () => {
    const { result, store } = mount();
    act(() => store.set(30));
    act(() => {
      result.current.flush("pause");
      result.current.flush("ended");
    });
    expect(vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { position: 30 },
      { position: 30, completed: true },
    ]);
  });

  it("coalesces paused seeks but writes when playback actually pauses", () => {
    const { result, store } = mount();
    act(() => {
      for (let position = 1; position <= 50; position += 1) store.set(position);
    });
    expect(fetch).not.toHaveBeenCalled();
    act(() => result.current.flush("pause"));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("never writes the opening position when nothing moved (restart or ?line= must not overwrite progress)", () => {
    const { unmount } = mount(createPlaybackPositionStore(42));
    unmount();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("treats the store settling on the start position after mount as the opening, not progress", () => {
    const store = createPlaybackPositionStore(12);
    const hook = renderHook(() => useProgressPersistence({ userId: "user", videoId: "video", positionStore: store, startPosition: 16 }));
    act(() => store.set(16));
    expect(fetch).not.toHaveBeenCalled();
    act(() => store.set(30));
    act(() => hook.result.current.flush("pause"));
    expect(fetch).toHaveBeenCalledOnce();
    hook.unmount();
  });

  it("does not lock in an unparsable server clock", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond("not-a-date")).mockResolvedValueOnce(respond("2026-10-01T11:00:00.000Z"));
    const { result, store } = mount(createPlaybackPositionStore(0), "garbage");
    act(() => store.set(10));
    act(() => result.current.flush("pause"));
    await settle();
    act(() => store.set(20));
    act(() => result.current.flush("pause"));
    await settle();
    expect(record().syncedServerAt).toBe("2026-10-01T11:00:00.000Z");
  });

  it("re-rendering neither flushes nor re-binds listeners", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = mount();
    const bound = add.mock.calls.filter(([type]) => type === "pagehide").length;
    rerender();
    rerender();
    expect(fetch).not.toHaveBeenCalled();
    expect(add.mock.calls.filter(([type]) => type === "pagehide").length).toBe(bound);
  });

  it("flushes a keepalive PATCH on hidden, pagehide and unmount whenever the position moved", () => {
    const { store, unmount } = mount();
    act(() => store.set(10));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => store.set(11));
    act(() => window.dispatchEvent(new Event("pagehide")));
    act(() => store.set(12));
    unmount();
    const bodies = vi.mocked(fetch).mock.calls.map(([, init]) => [JSON.parse(String(init?.body)).position, init?.keepalive]);
    expect(bodies).toEqual([[10, true], [11, true], [12, true]]);
  });

  it("sends completed once per mount: a loop through ENDED does not re-stamp it on every pass (re-review M1)", () => {
    const { result, store } = mount();
    for (const position of [30, 29, 30, 29, 30]) {
      act(() => store.set(position));
      if (position === 30) act(() => result.current.flush("ended"));
    }
    const bodies = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.filter((body) => body.completed)).toEqual([{ position: 30, completed: true }]);
  });

  it("removes its listeners on unmount", () => {
    const { store, unmount } = mount();
    act(() => store.set(10));
    unmount();
    vi.mocked(fetch).mockClear();
    act(() => store.set(20));
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the newest server clock when responses arrive out of order, seeded from what the tab knew", async () => {
    let resolveFirst!: (response: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(respond("2026-10-01T10:05:00.000Z"));
    const { result, store } = mount(createPlaybackPositionStore(0), "2026-10-01T09:00:00.000Z");
    act(() => store.set(10));
    act(() => result.current.flush("pause"));
    act(() => store.set(20));
    act(() => result.current.flush("pause"));
    await settle();
    resolveFirst(respond("2026-10-01T10:00:00.000Z"));
    await settle();
    expect(record().syncedServerAt).toBe("2026-10-01T10:05:00.000Z");
  });

  it("survives a throwing sessionStorage and a rejected fetch", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("private mode"); });
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const { store } = mount();
    expect(() => act(() => store.set(10))).not.toThrow();
    await settle();
  });
});
