"use client";
import { useEffect } from "react";

/** Proposes the browser's zone once for accounts with no stored zone. */
export function StudyTimezoneDetector({ needsDetection }: { needsDetection: boolean }) {
  useEffect(() => {
    if (!needsDetection) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;
    void fetch("/api/user/study-timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone }),
      keepalive: true,
    }).catch(() => undefined);
  }, [needsDetection]);
  return null;
}
