"use client";

import { useSyncExternalStore } from "react";

export interface PlaybackPositionStore {
  get(): number;
  set(time: number): void;
  subscribe(listener: () => void): () => void;
}

export function createPlaybackPositionStore(initial: number): PlaybackPositionStore {
  let position = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => position,
    set: (time) => {
      if (Object.is(position, time)) return;
      position = time;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function usePlaybackTime(store: PlaybackPositionStore): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
