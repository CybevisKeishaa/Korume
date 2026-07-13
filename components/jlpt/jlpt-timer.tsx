"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface JlptTimerProps {
  /** Absolute epoch ms when the timer expires. Stable for the lifetime of one attempt. */
  deadline: number;
  /** Called exactly once, the first tick the deadline has passed. */
  onExpire: () => void;
  className?: string;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const URGENT_MS = 60_000;
const WARN_MS = 5 * 60_000;

/**
 * Visible + screen-reader-announced countdown for a JLPT attempt (spec §5.7).
 * Time is always shown as text (never color-only) and warns via a polite
 * `aria-live` region at 5 minutes and 1 minute remaining, then calls
 * `onExpire` once when it hits zero — the caller auto-submits from there.
 */
export function JlptTimer({ deadline, onExpire, className }: JlptTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => deadline - Date.now());
  const [announcement, setAnnouncement] = useState("");
  const announcedRef = useRef<Set<"5min" | "1min" | "expired">>(new Set());

  useEffect(() => {
    announcedRef.current = new Set();

    function tick() {
      const remaining = deadline - Date.now();
      setRemainingMs(remaining);

      if (remaining <= WARN_MS && remaining > URGENT_MS && !announcedRef.current.has("5min")) {
        announcedRef.current.add("5min");
        setAnnouncement("5 minutes remaining.");
      }
      if (remaining <= URGENT_MS && remaining > 0 && !announcedRef.current.has("1min")) {
        announcedRef.current.add("1min");
        setAnnouncement("1 minute remaining.");
      }
      if (remaining <= 0 && !announcedRef.current.has("expired")) {
        announcedRef.current.add("expired");
        setAnnouncement("Time is up — submitting your answers now.");
        onExpire();
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const urgent = remainingMs <= URGENT_MS;

  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)} role="timer" aria-label="Time remaining">
      <span className={cn("text-lg font-semibold tabular-nums", urgent ? "text-danger" : "text-foreground")}>
        {formatRemaining(remainingMs)}
      </span>
      {urgent && <span className="text-xs font-medium text-danger">Under 1 minute left</span>}
      <span className="sr-only" aria-live="polite" role="status">
        {announcement}
      </span>
    </div>
  );
}
