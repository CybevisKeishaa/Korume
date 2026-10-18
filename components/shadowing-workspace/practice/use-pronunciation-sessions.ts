"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionListItem } from "@/lib/data/shadowing";
import type { Attempt } from "@/lib/pronunciation/attempts";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";
import { usePracticeStats } from "./practice-stats-context";

type Failure = { kind: "unavailable" | "throttled" | "error"; retryAt: number | null };
type History = { lineId: string; items: SessionListItem[]; status: "loading" | "ready" | "error" };

/** History is line-scoped; score completions remain session-scoped even after unmount. */
export function usePronunciationSessions(lineId: string | null) {
  const { attempts, dispatch } = usePronunciationAttempts();
  const { refresh } = usePracticeStats();
  const [history, setHistory] = useState<History | null>(null);
  const [failures, setFailures] = useState<Record<string, Failure>>({});
  const [clock, setClock] = useState(Date.now());
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const currentLine = useRef(lineId);
  currentLine.current = lineId;
  const latest = useRef(attempts);
  latest.current = attempts;
  const inFlight = useRef(new Set<string>());

  const reload = useCallback(async (owner: string) => {
    if (!mounted.current || currentLine.current !== owner) return;
    request.current?.abort();
    const pending = new AbortController();
    request.current = pending;
    try {
      const response = await fetch(`/api/shadowing/session?lineId=${encodeURIComponent(owner)}`, { cache: "no-store", signal: pending.signal });
      if (!response.ok) throw new Error("history failed");
      const { data } = await response.json() as { data: SessionListItem[] };
      if (pending.signal.aborted || !mounted.current || currentLine.current !== owner) return;
      setHistory({ lineId: owner, items: data, status: "ready" });
      const attempt = latest.current[owner];
      const item = data.find((candidate) => candidate.id === attempt?.sessionId);
      if (item && !inFlight.current.has(item.id)) {
        if (item.state === "scored" && item.pronunciationScore !== null && item.rhythmScore !== null && item.assessment) {
          dispatch({ type: "scored", sessionId: item.id, result: { pronunciationScore: item.pronunciationScore, rhythmScore: item.rhythmScore, assessment: item.assessment } });
        } else if (item.state === "scoring") dispatch({ type: "scoring", sessionId: item.id });
        else if (item.state !== "scored" && attempt?.phase === "scoring") dispatch({ type: "score-failed", sessionId: item.id, kind: "error", retryAfter: null });
      }
    } catch {
      if (!pending.signal.aborted && mounted.current && currentLine.current === owner)
        setHistory((previous) => ({ lineId: owner, items: previous?.lineId === owner ? previous.items : [], status: "error" }));
    }
  }, [dispatch]);

  useEffect(() => {
    setHistory(lineId ? { lineId, items: [], status: "loading" } : null);
    if (lineId) void reload(lineId);
    return () => request.current?.abort();
  }, [lineId, reload]);
  const items = history?.lineId === lineId ? history.items : [];
  const attempt = lineId ? attempts[lineId] : undefined;
  const authoritative = items.find((item) => item.id === attempt?.sessionId);
  const scoring = items.some((item) => item.state === "scoring") || (!authoritative && attempt?.phase === "scoring");
  useEffect(() => {
    if (!scoring || !lineId) return;
    // The server owns the 90-second lease; keep refetching until it reports a terminal/retryable state.
    const timer = setTimeout(() => { void reload(lineId); }, 5000);
    return () => clearTimeout(timer);
  }, [history, lineId, reload, scoring]);
  useEffect(() => {
    if (!Object.values(failures).some((failure) => failure.retryAt !== null && failure.retryAt > Date.now())) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (!Object.values(failures).some((failure) => failure.retryAt !== null && failure.retryAt > now)) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [failures]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);

  const score = useCallback(async (sessionId: string, owner: string) => {
    if (inFlight.current.has(sessionId) || (failures[sessionId]?.retryAt ?? 0) > Date.now()) return;
    inFlight.current.add(sessionId);
    dispatch({ type: "scoring", sessionId });
    if (mounted.current) {
      setFailures((previous) => { const next = { ...previous }; delete next[sessionId]; return next; });
      setHistory((previous) => previous?.lineId === owner ? { ...previous, items: previous.items.map((item) => item.id === sessionId ? { ...item, state: "scoring" } : item) } : previous);
    }
    try {
      const response = await fetch("/api/pronunciation/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      if (response.ok) {
        const { data } = await response.json() as { data: NonNullable<Attempt["result"]> };
        dispatch({ type: "scored", sessionId, result: data });
        refresh();
        if (mounted.current) setHistory((previous) => previous?.lineId === owner ? { ...previous, items: previous.items.map((item) => item.id === sessionId ? { ...item, ...data, state: "scored" } : item) } : previous);
      } else if (response.status !== 409) {
        const kind = response.status === 503 ? "unavailable" : response.status === 429 ? "throttled" : "error";
        const header = response.headers.get("Retry-After");
        const seconds = header?.trim() ? Number(header) : NaN;
        const retryAfter = response.status === 429 && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
        dispatch({ type: "score-failed", sessionId, kind, retryAfter });
        if (mounted.current) {
          const now = Date.now();
          setClock(now);
          setFailures((previous) => ({ ...previous, [sessionId]: { kind, retryAt: retryAfter === null ? null : now + retryAfter * 1000 } }));
          setHistory((previous) => previous?.lineId === owner ? { ...previous, items: previous.items.map((item) => item.id === sessionId ? { ...item, state: "unscored" } : item) } : previous);
        }
      }
    } catch {
      dispatch({ type: "score-failed", sessionId, kind: "error", retryAfter: null });
      if (mounted.current) {
        setFailures((previous) => ({ ...previous, [sessionId]: { kind: "error", retryAt: null } }));
        setHistory((previous) => previous?.lineId === owner ? { ...previous, items: previous.items.map((item) => item.id === sessionId ? { ...item, state: "unscored" } : item) } : previous);
      }
    } finally { inFlight.current.delete(sessionId); }
    await reload(owner);
  }, [dispatch, failures, refresh, reload]);
  const selected = attempt ? items.find((item) => item.id === attempt.sessionId) : items[0];
  const sessionId = attempt?.sessionId ?? selected?.id ?? null;
  const failure = sessionId ? failures[sessionId] : undefined;
  const retrySeconds = failure?.retryAt ? Math.max(0, Math.ceil((failure.retryAt - clock) / 1000)) : null;
  return { items, attempt, selected, sessionId, failure, retrySeconds, score, reload,
    saved: (id: string, owner: string) => { refresh(); void score(id, owner); },
    retryDisabled: (id: string) => (failures[id]?.retryAt ?? 0) > clock,
    historyStatus: history?.lineId === lineId ? history.status : "loading" as const };
}
