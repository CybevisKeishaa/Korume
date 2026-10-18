"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PracticeStats } from "@/lib/data/practice-stats";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";

interface PracticeStatsValue { stats: PracticeStats | null; refresh(): void }
const PracticeStatsContext = createContext<PracticeStatsValue | null>(null);

export function PracticeStatsProvider({ videoId, mode, children }: { videoId: string; mode: PracticeModeId; children: ReactNode }) {
  const [result, setResult] = useState<{ videoId: string; mode: PracticeModeId; stats: PracticeStats | null } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    pending.current?.abort();
    if (mode !== "pronunciation") return;
    const request = new AbortController();
    pending.current = request;
    void (async () => {
      try {
        const response = await fetch(`/api/shadowing/${videoId}/practice-stats?mode=${mode}`, { signal: request.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`practice stats ${response.status}`);
        const { data } = await response.json() as { data: PracticeStats };
        if (!request.signal.aborted) setResult({ videoId, mode, stats: data });
      } catch {
        if (!request.signal.aborted) setResult({ videoId, mode, stats: null });
      }
    })();
  }, [mode, videoId]);

  useEffect(() => {
    setResult(null);
    refresh();
    return () => pending.current?.abort();
  }, [refresh]);

  const stats = mode === "pronunciation" && result?.videoId === videoId && result.mode === mode ? result.stats : null;
  return <PracticeStatsContext.Provider value={{ stats, refresh }}>{children}</PracticeStatsContext.Provider>;
}

export function usePracticeStats(): PracticeStatsValue {
  const value = useContext(PracticeStatsContext);
  if (value === null) throw new Error("usePracticeStats must be used within PracticeStatsProvider");
  return value;
}
