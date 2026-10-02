"use client";

import { useEffect, useState } from "react";
import type { LexicalLineAnalysisDto } from "@/lib/analysis/types";

type LineAnalysisState = { status: "loading" } | { status: "ready"; analysis: LexicalLineAnalysisDto } | { status: "error" };

// ponytail: a tab-lifetime cache of one GET per line; mastery inside can go stale after an SRS review in another
// tab, which only changes a badge. A line's analysis is otherwise fixed for a dictionary snapshot.
const cache = new Map<string, Promise<LexicalLineAnalysisDto>>();

export function fetchLineAnalysis(lineId: string): Promise<LexicalLineAnalysisDto> {
  let pending = cache.get(lineId);
  if (!pending) {
    pending = fetch(`/api/lines/${lineId}/analysis?scope=lexical`).then(async (response) => {
      if (!response.ok) throw new Error(`analysis ${response.status}`);
      return ((await response.json()) as { data: LexicalLineAnalysisDto }).data;
    });
    // A failure is not cached: the next open retries.
    pending.catch(() => cache.delete(lineId));
    cache.set(lineId, pending);
  }
  return pending;
}

export function resetLineAnalysisCacheForTests(): void {
  cache.clear();
}

/**
 * The deterministic analysis of one line. Callers pass a line id only when the learner opened something that
 * shows it (a word card, the Vocabulary or Grammar tab) — never on a sentence change by itself.
 */
export function useLineAnalysis(lineId: string | null): LineAnalysisState | null {
  const [state, setState] = useState<{ lineId: string; value: LineAnalysisState } | null>(null);
  useEffect(() => {
    if (!lineId) return;
    let live = true;
    setState({ lineId, value: { status: "loading" } });
    fetchLineAnalysis(lineId).then(
      (analysis) => { if (live) setState({ lineId, value: { status: "ready", analysis } }); },
      () => { if (live) setState({ lineId, value: { status: "error" } }); },
    );
    return () => { live = false; };
  }, [lineId]);
  if (!lineId) return null;
  return state?.lineId === lineId ? state.value : { status: "loading" };
}
