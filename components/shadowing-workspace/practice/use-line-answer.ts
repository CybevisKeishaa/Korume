"use client";

import { useEffect, useState } from "react";

type AnswerState<T> = { lineId: string; load: number; data: T | null; status: "loading" | "ready" | "error" };

/**
 * A line's answer data from `GET /api/lines/{lineId}/{kind}`: the word-piece cut (`chunks`, spec §3.3) or Điền từ's
 * blanks (`cloze`, §3.4). One set of rules for both (ultra review 3): a line change or `reload()` aborts the request
 * in flight, and a response for another line or load is never shown. `null` reads nothing.
 */
export function useLineAnswer<T>(lineId: string | null, kind: "chunks" | "cloze"): { data: T | null; status: "loading" | "ready" | "error"; reload(): void } {
  const [load, setLoad] = useState(0);
  const [state, setState] = useState<AnswerState<T> | null>(null);
  const current = state !== null && state.lineId === lineId && state.load === load ? state : null;

  useEffect(() => {
    if (!lineId) return;
    const request = new AbortController();
    setState({ lineId, load, data: null, status: "loading" });
    void (async () => {
      try {
        const response = await fetch(`/api/lines/${lineId}/${kind}`, { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error(`${kind} ${response.status}`);
        const { data } = await response.json() as { data: T };
        if (!request.signal.aborted) setState({ lineId, load, data, status: "ready" });
      } catch {
        if (!request.signal.aborted) setState({ lineId, load, data: null, status: "error" });
      }
    })();
    return () => request.abort();
  }, [lineId, load, kind]);

  return { data: current?.data ?? null, status: current?.status ?? "loading", reload: () => setLoad((n) => n + 1) };
}
