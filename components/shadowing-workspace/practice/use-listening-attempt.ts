"use client";

import { useEffect, useRef, useState } from "react";
import { listeningFeedback, typingErrorCount, type FeedbackMessage } from "@/lib/dictation/listening-feedback";
import { grapheme4Units, type ListeningRevealData, type ListeningSubmitData } from "@/lib/dictation/listening-score";
import { normalizeJa } from "@/lib/dictation/normalize";
import type { LineChunks } from "@/lib/dictation/types";
import type { ListeningFormat } from "@/lib/shadowing-workspace/learning-modes";
import { useLesson } from "../workspace-context";
import { useListeningReveal } from "./listening-reveal-context";
import { usePracticeStats } from "./practice-stats-context";

export type ListeningAttemptError = "network" | "line_changed" | "rate_limited";
/** A submitted result as later attempts compare with it; `version` + `textHash` say which cut of the line it scored. */
export interface PreviousResult { score: number; ownCorrect?: number; wrongPieces?: number[]; errorCount?: number; version: number; textHash: string }
type SubmitPayload = { chunkOrder: number[] } | { input: string };
/** What a new attempt inherits from the one it replaces: a Try again, or a restart after `line_changed`. */
type Carry = { lineKey: string; retry: boolean; error: ListeningAttemptError | null };
interface AttemptState {
  key: string;
  hinted: number[];
  touched: boolean;
  submitting: boolean;
  result: ListeningSubmitData | null;
  /** The submitted result `result` is compared with (P14 "fixed" / "fewer"), read before `result` replaced it. */
  comparedTo: PreviousResult | null;
  answer: string | null;
  revealed: boolean;
  error: ListeningAttemptError | null;
  retry: boolean;
  carry: Carry | null;
}
type ChunksState = { lineId: string; load: number; data: LineChunks | null; status: "loading" | "ready" | "error" };

const fresh = (key: string, carry: Carry | null): AttemptState => ({
  key, hinted: [], touched: false, submitting: false, result: null, comparedTo: null, answer: null, revealed: false,
  error: carry?.error ?? null, retry: carry?.retry ?? false, carry: null,
});

function summarize(data: ListeningSubmitData, { version, textHash }: LineChunks): PreviousResult {
  return {
    score: data.score,
    ownCorrect: data.metrics.slots?.correct,
    wrongPieces: data.slots?.flatMap((slot) => slot.correct || slot.hinted ? [] : [slot.chunkIndex]),
    errorCount: data.diff ? typingErrorCount(data.diff) : undefined,
    version,
    textHash,
  };
}

/**
 * One Listening attempt on the current line and URL format (P10, P11). Its state is keyed by line + format +
 * the reveal provider's attempt and resets during render when that key moves, so a line change, a format
 * change or Try again starts empty in the same commit. A request captures the attempt it belongs to; a
 * response for an attempt that is no longer current is dropped, and the reveal provider ignores it too.
 * Reveal state is written only from click handlers and request callbacks, never from an effect.
 */
export function useListeningAttempt(lineId: string | null, format: ListeningFormat) {
  const { video, lines } = useLesson();
  const { attempt, newAttempt, markChecked, markRevealed } = useListeningReveal();
  const { refresh } = usePracticeStats();
  const lineKey = `${lineId}|${format}`;
  const key = `${lineKey}|${attempt}`;
  const [stored, setState] = useState<AttemptState>(() => fresh(key, null));
  let state = stored;
  if (stored.key !== key) {
    state = fresh(key, stored.carry?.lineKey === lineKey ? stored.carry : null);
    setState(state);
  }
  const currentKey = useRef(key);
  currentKey.current = key;
  /** The one request in flight per attempt (Review Focus 1): state alone cannot stop two clicks in one tick. */
  const inFlight = useRef<string | null>(null);
  /** The last submitted result per line + format in this visit; never persisted. */
  const previousResults = useRef(new Map<string, PreviousResult>());

  const [load, setLoad] = useState(0);
  const [chunksState, setChunksState] = useState<ChunksState | null>(null);
  useEffect(() => {
    if (!lineId) return;
    const request = new AbortController();
    setChunksState({ lineId, load, data: null, status: "loading" });
    void (async () => {
      try {
        const response = await fetch(`/api/lines/${lineId}/chunks`, { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error(`chunks ${response.status}`);
        const { data } = await response.json() as { data: LineChunks };
        if (!request.signal.aborted) setChunksState({ lineId, load, data, status: "ready" });
      } catch {
        if (!request.signal.aborted) setChunksState({ lineId, load, data: null, status: "error" });
      }
    })();
    return () => request.abort();
  }, [lineId, load]);
  const currentChunks = chunksState !== null && chunksState.lineId === lineId && chunksState.load === load ? chunksState : null;
  const chunks = currentChunks?.data ?? null;
  const chunksStatus = currentChunks?.status ?? "loading";

  const unit = format === "word_bank" ? "chunk" : chunks?.typingHintUnit ?? "chunk";
  const lineText = lines.find((line) => line.id === lineId)?.textJp ?? "";
  const unitCount = !chunks ? 0 : unit === "chunk" ? chunks.chunks.length : grapheme4Units(normalizeJa(lineText)).length;
  const answered = state.result !== null || state.revealed;
  const previous = previousResults.current.get(lineKey) ?? null;

  async function post(body: Record<string, unknown>, done: (data: ListeningSubmitData | ListeningRevealData) => void) {
    const requestKey = key;
    if (inFlight.current === requestKey) return;
    inFlight.current = requestKey;
    setState((prev) => prev.key === requestKey ? { ...prev, submitting: true, error: null } : prev);
    let outcome: { data: ListeningSubmitData | ListeningRevealData } | ListeningAttemptError;
    try {
      const response = await fetch("/api/dictation/attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      outcome = response.ok ? await response.json() as { data: ListeningSubmitData | ListeningRevealData }
        : response.status === 409 ? "line_changed" : response.status === 429 ? "rate_limited" : "network";
    } catch {
      outcome = "network";
    }
    if (inFlight.current === requestKey) inFlight.current = null;
    // A saved row changes the line's stats whether or not its attempt is still on screen.
    if (typeof outcome !== "string") refresh();
    if (currentKey.current !== requestKey) return;
    if (outcome === "line_changed") {
      // 409 line_changed / chunker_version: the line's chunks moved; restart on fresh ones.
      setState((prev) => ({ ...prev, submitting: false, carry: { lineKey, retry: false, error: "line_changed" } }));
      setLoad((n) => n + 1);
      newAttempt();
    } else if (typeof outcome === "string") {
      const error = outcome;
      setState((prev) => prev.key === requestKey ? { ...prev, submitting: false, error } : prev);
    } else done(outcome.data);
  }

  function submit(payload: SubmitPayload): Promise<void> {
    if (!lineId || !chunks || answered) return Promise.resolve();
    const requestAttempt = attempt;
    const requestKey = key;
    const body = {
      kind: "submit", videoId: video.id, lineId, version: chunks.version, textHash: chunks.textHash, hintedUnits: state.hinted,
      ...("chunkOrder" in payload ? { format: "word_bank", chunkOrder: payload.chunkOrder } : { format: "typing", input: payload.input, hintUnit: chunks.typingHintUnit }),
    };
    return post(body, (data) => {
      const result = data as ListeningSubmitData;
      const last = previousResults.current.get(lineKey);
      // "fixed" / "fewer" only against the same cut of the line: never v1 against v2, never an edited line.
      const comparedTo = last?.version === chunks.version && last.textHash === chunks.textHash ? last : null;
      previousResults.current.set(lineKey, summarize(result, chunks));
      setState((prev) => prev.key === requestKey ? { ...prev, submitting: false, result, answer: result.answer, comparedTo } : prev);
      markChecked(requestAttempt);
    });
  }

  function reveal(): Promise<void> {
    if (!lineId || !chunks || answered) return Promise.resolve();
    const requestAttempt = attempt;
    const requestKey = key;
    const body = {
      kind: "reveal", videoId: video.id, lineId, format, version: chunks.version, textHash: chunks.textHash, hintedUnits: state.hinted,
      ...(format === "typing" ? { hintUnit: chunks.typingHintUnit } : {}),
    };
    return post(body, (data) => {
      setState((prev) => prev.key === requestKey ? { ...prev, submitting: false, answer: (data as ListeningRevealData).answer, revealed: true } : prev);
      markRevealed(requestAttempt);
    });
  }

  function hint() {
    if (!chunks || answered || state.submitting) return;
    setState((prev) => {
      if (prev.key !== key) return prev;
      const next = Array.from({ length: unitCount }, (_, i) => i).find((i) => !prev.hinted.includes(i));
      return next === undefined ? prev : { ...prev, hinted: [...prev.hinted, next] };
    });
  }

  function tryAgain() {
    setState((prev) => ({ ...prev, carry: { lineKey, retry: true, error: null } }));
    newAttempt();
  }

  const feedback: FeedbackMessage[] = state.result
    ? listeningFeedback(state.result.slots
      ? { kind: "checked_word_bank", slots: state.result.slots, display: chunks?.display ?? [], previous: state.comparedTo?.wrongPieces ? { wrongPieces: state.comparedTo.wrongPieces } : null }
      : { kind: "checked_typing", diff: state.result.diff ?? [], metrics: state.result.metrics, previous: state.comparedTo?.errorCount !== undefined ? { errorCount: state.comparedTo.errorCount } : null })
    : state.revealed ? listeningFeedback({ kind: "revealed" })
    : [
      ...(state.retry ? listeningFeedback({ kind: "retry", previousScore: previous?.score ?? null }) : []),
      ...(state.hinted.length > 0 ? listeningFeedback({ kind: "hint", unit, hinted: state.hinted.length, total: unitCount }) : []),
    ];

  return {
    chunks,
    chunksStatus,
    submitting: state.submitting,
    hinted: state.hinted,
    allHinted: unitCount > 0 && state.hinted.length >= unitCount,
    result: state.result,
    answer: state.answer,
    revealed: state.revealed,
    error: state.error,
    inProgress: !answered && (state.touched || state.hinted.length > 0),
    previous,
    feedback,
    hint,
    submit,
    reveal,
    tryAgain,
    /** A panel reports whether the learner has placed or typed anything (consumed by Task 7's format switch). */
    setInProgress: (touched: boolean) => setState((prev) => prev.key === key ? { ...prev, touched } : prev),
    reloadChunks: () => setLoad((n) => n + 1),
  };
}
