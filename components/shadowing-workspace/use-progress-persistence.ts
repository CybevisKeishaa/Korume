"use client";

import { useCallback, useEffect, useRef } from "react";
import { shouldWriteServer, type ProgressFlushReason, type ProgressSent } from "@/lib/shadowing-workspace/progress-coalescer";
import { sessionResumeKey } from "@/lib/shadowing-workspace/session-resume-record";
import type { PlaybackPositionStore } from "./playback-position-store";

export function useProgressPersistence(args: {
  userId: string;
  videoId: string;
  positionStore: PlaybackPositionStore;
  isPlaying: () => boolean;
  /** The server timestamp this tab already knows (session record or bootstrap), so a failed first PATCH does not reset it. */
  initialSyncedServerAt?: string | null;
  /** The settled start position: the store moving TO it after mount is the opening, not progress. */
  startPosition?: number;
}): { flush(reason: ProgressFlushReason): void } {
  const { positionStore } = args;
  const argsRef = useRef(args);
  argsRef.current = args;
  const lastSessionWriteAt = useRef(0);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedServerAt = useRef<string | null>(args.initialSyncedServerAt ?? null);
  const incomingServerAt = args.initialSyncedServerAt === null || args.initialSyncedServerAt === undefined ? Number.NEGATIVE_INFINITY : Date.parse(args.initialSyncedServerAt);
  const knownServerAt = syncedServerAt.current === null ? Number.NEGATIVE_INFINITY : Date.parse(syncedServerAt.current);
  if (Number.isFinite(incomingServerAt) && (!Number.isFinite(knownServerAt) || incomingServerAt > knownServerAt)) syncedServerAt.current = args.initialSyncedServerAt ?? null;
  // Seeded with the opening position, so opening the page (restart, ?line=) never overwrites saved progress.
  const lastSent = useRef<ProgressSent | null>(null);
  if (lastSent.current === null) lastSent.current = { position: positionStore.get(), at: Date.now() };
  const moved = useRef(false);

  const writeSession = useCallback((force = false) => {
    const { userId, videoId, positionStore } = argsRef.current;
    const now = Date.now();
    if (!force && now - lastSessionWriteAt.current < 1_000) {
      if (sessionTimer.current === null) sessionTimer.current = setTimeout(() => { sessionTimer.current = null; writeSession(); }, 1_000 - (now - lastSessionWriteAt.current));
      return;
    }
    lastSessionWriteAt.current = now;
    try {
      sessionStorage.setItem(sessionResumeKey(userId, videoId), JSON.stringify({ userId, videoId, position: positionStore.get(), savedAt: now, syncedServerAt: syncedServerAt.current }));
    } catch {
      // Private browsing may reject sessionStorage; server progress remains best-effort.
    }
  }, []);

  const flush = useCallback((reason: ProgressFlushReason) => {
    const { videoId, positionStore } = argsRef.current;
    const position = positionStore.get();
    writeSession(reason !== "tick");
    const now = Date.now();
    if (!shouldWriteServer(lastSent.current, position, now, reason)) return;
    lastSent.current = { position, at: now };
    void fetch(`/api/videos/${videoId}/progress`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position, ...(reason === "ended" ? { completed: true } : {}) }), keepalive: reason !== "tick",
    }).then(async (response) => {
      if (!response.ok) return;
      const payload: unknown = await response.json();
      const value = payload as { data?: { last_watched_at?: unknown } };
      const stamp = value.data?.last_watched_at;
      const next = typeof stamp === "string" ? Date.parse(stamp) : Number.NaN;
      const known = syncedServerAt.current === null ? Number.NEGATIVE_INFINITY : Date.parse(syncedServerAt.current);
      // Responses can arrive out of order: keep the newest server clock; an unparsable one counts as older.
      if (typeof stamp === "string" && Number.isFinite(next) && !(known >= next)) {
        syncedServerAt.current = stamp;
        writeSession(true);
      }
    }).catch(() => undefined);
  }, [writeSession]);

  useEffect(() => {
    const unsubscribe = positionStore.subscribe(() => {
      const { startPosition } = argsRef.current;
      // The shell settles the start (session record) after mount; that move re-seeds instead of writing.
      if (!moved.current && startPosition !== undefined && positionStore.get() === startPosition) {
        lastSent.current = { position: startPosition, at: Date.now() };
        return;
      }
      moved.current = true;
      writeSession();
      flush("tick");
    });
    const hidden = () => { if (document.visibilityState === "hidden") flush("hidden"); };
    document.addEventListener("visibilitychange", hidden);
    const pagehide = () => flush("pagehide");
    window.addEventListener("pagehide", pagehide);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pagehide);
      if (sessionTimer.current !== null) clearTimeout(sessionTimer.current);
      flush("leave");
    };
    // Callbacks are read through argsRef: a fresh isPlaying() each render must not tear this down (and "leave"-flush).
  }, [flush, positionStore, writeSession]);

  return { flush };
}
