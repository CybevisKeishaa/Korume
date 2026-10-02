"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n";
import type { DrawerTarget } from "@/lib/shadowing-workspace/drawer-state";

/** One section's state for one target (spec §6.4 states). */
export type SectionResult =
  | { status: "loading" }
  | { status: "pending" }
  | { status: "ready"; content: unknown; access: "full" | "preview" }
  | { status: "quota"; resetsAt: string }
  | { status: "resting" }
  | { status: "error" };

export type KnowledgeUsage =
  | { plan: "free"; used: number; limit: number; resetsAt: string }
  | { plan: "plus"; remainingPercent: number; resetsAt: string };

interface AiKnowledgeValue {
  result(target: DrawerTarget, section: string): SectionResult | undefined;
  /**
   * Starts a generation. Only explicit learner actions call this (R11): the ✨ entry points, an accordion item
   * being expanded, a Generate or Retry button. `force` re-requests a failed, resting or exhausted section.
   */
  request(target: DrawerTarget, section: string, options?: { force?: boolean }): void;
  usage: KnowledgeUsage | null;
  loadUsage(): void;
  /** The section a poll just completed, for the live region. */
  completed: { section: string; at: number } | null;
}

const AiKnowledgeContext = createContext<AiKnowledgeValue | null>(null);

const keyOf = (target: DrawerTarget, section: string) =>
  `${target.lineId}|${target.span ? `${target.span.start}-${target.span.end}` : ""}|${section}`;
const settled = (result: SectionResult | undefined) =>
  result !== undefined && result.status !== "loading" && result.status !== "pending";

/**
 * The AI tab's results for this workspace session. It lives beside the drawer state, above the drawer, so
 * switching tabs or Focus Mode keeps every loaded section. Nothing here runs on playback.
 */
export function AiKnowledgeProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [results, setResults] = useState<Record<string, SectionResult>>({});
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const [usage, setUsage] = useState<KnowledgeUsage | null>(null);
  const [completed, setCompleted] = useState<AiKnowledgeValue["completed"]>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => { alive.current = false; pending.forEach(clearTimeout); pending.clear(); };
  }, []);

  const loadUsage = useCallback(() => {
    void fetch("/api/knowledge/usage")
      .then(async (response) => (response.ok ? ((await response.json()) as { data: KnowledgeUsage }).data : null))
      .then((next) => { if (alive.current && next) setUsage(next); })
      .catch(() => undefined);
  }, []);

  const send = useCallback((target: DrawerTarget, section: string, key: string, polled: boolean) => {
    const set = (result: SectionResult) => {
      if (!alive.current) return;
      resultsRef.current = { ...resultsRef.current, [key]: result };
      setResults(resultsRef.current);
    };
    void (async () => {
      try {
        const response = await fetch("/api/knowledge/sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcriptLineId: target.lineId, section, locale, ...(target.span ? { span: target.span } : {}) }),
        });
        const body = (await response.json().catch(() => null)) as
          | { data?: { status: string; content?: unknown; access?: "full" | "preview"; retryAfterMs?: number }; resetsAt?: string }
          | null;
        if (response.status === 202) {
          set({ status: "pending" });
          const timer = setTimeout(() => { timers.current.delete(timer); if (alive.current) send(target, section, key, true); }, body?.data?.retryAfterMs ?? 2000);
          timers.current.add(timer);
          return;
        }
        if (response.ok && body?.data?.status === "ready") {
          set({ status: "ready", content: body.data.content, access: body.data.access === "preview" ? "preview" : "full" });
          if (polled && alive.current) setCompleted({ section, at: Date.now() });
          loadUsage();
          return;
        }
        if (response.status === 402) { set({ status: "quota", resetsAt: body?.resetsAt ?? "" }); loadUsage(); return; }
        // 503: the AI is resting (kill-switch, budget, outage or backoff). Never retried automatically.
        set(response.status === 503 ? { status: "resting" } : { status: "error" });
      } catch {
        set({ status: "error" });
      }
    })();
  }, [loadUsage, locale]);

  const request = useCallback((target: DrawerTarget, section: string, options?: { force?: boolean }) => {
    const key = keyOf(target, section);
    const current = resultsRef.current[key];
    if (current && !(options?.force && settled(current) && current.status !== "ready")) return;
    resultsRef.current = { ...resultsRef.current, [key]: { status: "loading" } };
    setResults(resultsRef.current);
    send(target, section, key, false);
  }, [send]);

  const value = useMemo<AiKnowledgeValue>(() => ({
    result: (target, section) => results[keyOf(target, section)],
    request, usage, loadUsage, completed,
  }), [completed, loadUsage, request, results, usage]);
  return <AiKnowledgeContext.Provider value={value}>{children}</AiKnowledgeContext.Provider>;
}

export function useAiKnowledge(): AiKnowledgeValue {
  const value = useContext(AiKnowledgeContext);
  if (value === null) throw new Error("useAiKnowledge must be used within AiKnowledgeProvider");
  return value;
}
