"use client";

import { useEffect, useState } from "react";
import type { LineCloze } from "@/lib/dictation/types";

type ClozeState = { lineId: string; load: number; data: LineCloze | null; status: "loading" | "ready" | "error" };

/**
 * Điền từ's blanks for a line (spec §3.4), with the chunks fetch's rules: a line change or `reload()` aborts the
 * request in flight, and a response for another line or load is never shown. `null` reads nothing.
 */
export function useLineCloze(lineId: string | null): { cloze: LineCloze | null; status: "loading" | "ready" | "error"; reload(): void } {
  const [load, setLoad] = useState(0);
  const [state, setState] = useState<ClozeState | null>(null);
  const current = state !== null && state.lineId === lineId && state.load === load ? state : null;

  useEffect(() => {
    if (!lineId) return;
    const request = new AbortController();
    setState({ lineId, load, data: null, status: "loading" });
    void (async () => {
      try {
        const response = await fetch(`/api/lines/${lineId}/cloze`, { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error(`cloze ${response.status}`);
        const { data } = await response.json() as { data: LineCloze };
        if (!request.signal.aborted) setState({ lineId, load, data, status: "ready" });
      } catch {
        if (!request.signal.aborted) setState({ lineId, load, data: null, status: "error" });
      }
    })();
    return () => request.abort();
  }, [lineId, load]);

  return { cloze: current?.data ?? null, status: current?.status ?? "loading", reload: () => setLoad((n) => n + 1) };
}
