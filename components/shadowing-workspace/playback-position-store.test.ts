import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createPlaybackPositionStore, usePlaybackTime } from "./playback-position-store";

describe("playback position store", () => {
  it("notifies subscribers when its position changes", () => {
    const store = createPlaybackPositionStore(0);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(4.5);

    expect(store.get()).toBe(4.5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify for the existing position", () => {
    const store = createPlaybackPositionStore(4.5);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(4.5);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createPlaybackPositionStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.set(1);

    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribes React consumers through useSyncExternalStore", () => {
    const store = createPlaybackPositionStore(0);
    const { result } = renderHook(() => usePlaybackTime(store));

    act(() => store.set(3));

    expect(result.current).toBe(3);
  });
});
