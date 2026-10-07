"use client";

import { useEffect, useRef } from "react";
import { HEARTBEAT_MS, INACTIVITY_MS } from "@/lib/study-time/constants";
import type { StudySurface } from "@/lib/study-time/surfaces";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll", "touchstart", "focusin"] as const;

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
    let presenceId = crypto.randomUUID();
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
      presenceId = crypto.randomUUID();
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
        if (!response.ok || disposed || currentRequest !== requestId) return;
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
    const onActivity = () => {
      lastInteraction = Date.now();
      if (!sessionId) tick();
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
