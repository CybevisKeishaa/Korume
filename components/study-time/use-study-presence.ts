"use client";

import { useEffect, useRef } from "react";
import { HEARTBEAT_MS, INACTIVITY_MS } from "@/lib/study-time/constants";
import type { StudySurface } from "@/lib/study-time/surfaces";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll", "touchstart", "focusin"] as const;

function newPresenceId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface Options {
  surface: StudySurface;
  contextId: string | null;
  mediaPlaying?: boolean;
  enabled?: boolean;
}

/** Reports active visible study intervals; the server owns all duration calculations. */
export function useStudyPresence({ surface, contextId, mediaPlaying = false, enabled = true }: Options): void {
  const playing = useRef(mediaPlaying);
  playing.current = mediaPlaying;

  useEffect(() => {
    if (!enabled) return;
    let presenceId = newPresenceId();
    let sessionId: string | null = null;
    let seq = 0;
    let lastInteraction = Date.now();
    let inFlight = false;
    let requestId = 0;
    let disposed = false;
    let stopped = false;

    const active = () => document.visibilityState === "visible" &&
      (playing.current || Date.now() - lastInteraction < INACTIVITY_MS);

    const reset = () => {
      requestId += 1;
      inFlight = false;
      presenceId = newPresenceId();
      sessionId = null;
      seq = 0;
      stopped = false;
    };

    const send = async () => {
      if (inFlight || disposed || !active()) return;
      inFlight = true;
      const currentRequest = ++requestId;
      const kind = sessionId ? "beat" : "start";
      const sentSeq = seq;
      try {
        const response = await fetch("/api/study/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientPresenceId: presenceId, sessionId, surface, contextId, seq: sentSeq, kind }),
        });
        if (disposed || currentRequest !== requestId) return;
        if (kind === "beat" && response.status === 404) {
          // The session is gone (e.g. erased): beating it again would never count.
          reset();
          void send();
          return;
        }
        if (!response.ok) return;
        const { data } = (await response.json()) as { data: { sessionId: string; acceptedSeq: number; segmented: boolean } };
        if (disposed || currentRequest !== requestId) return;
        if (kind === "beat" && data.acceptedSeq < sentSeq && !data.segmented) {
          reset();
          void send();
          return;
        }
        sessionId = data.sessionId;
        seq = Math.max(sentSeq, data.acceptedSeq) + 1;
      } catch {
        // The server's gap rule closes intervals during network failures.
      } finally {
        if (currentRequest === requestId) inFlight = false;
      }
    };

    const tick = () => { void send(); };
    // Only the inactive → active edge sends at once: a return from idle opens its segment immediately, and a failing
    // start is retried by the interval rather than at the rate of input events.
    const onActivity = () => {
      const wasActive = active();
      lastInteraction = Date.now();
      if (!wasActive) tick();
    };
    const onPageHide = () => {
      if (!sessionId || stopped) return;
      stopped = true;
      const body = JSON.stringify({ clientPresenceId: presenceId, sessionId, surface, contextId, seq, kind: "stop" });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/study/heartbeat", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/study/heartbeat", {
          method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true,
        }).catch(() => undefined);
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      reset();
      lastInteraction = Date.now();
      tick();
    };

    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true, capture: true });
    document.addEventListener("selectionchange", onActivity);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    const timer = window.setInterval(tick, HEARTBEAT_MS);
    tick();

    return () => {
      onPageHide();
      disposed = true;
      window.clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true });
      document.removeEventListener("selectionchange", onActivity);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [surface, contextId, enabled]);
}
