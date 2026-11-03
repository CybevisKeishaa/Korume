"use client";

import { useEffect, useRef, useState } from "react";
import { feedbackOutcome, listeningFeedback, typingErrorCount, type FeedbackHelp, type FeedbackMessage } from "@/lib/dictation/listening-feedback";
import { grapheme1Units, type ListeningRevealData, type ListeningSubmitData } from "@/lib/dictation/listening-score";
import { korumeMood, type MoodEntry, type MoodResult } from "@/lib/practice/korume-mood";
import { REVIEW_DICTATION_BELOW } from "@/lib/summary/thresholds";
import { normalizeJa } from "@/lib/dictation/normalize";
import type { LineChunks, LineCloze } from "@/lib/dictation/types";
import type { ListeningFormat } from "@/lib/shadowing-workspace/learning-modes";
import { useLesson } from "../workspace-context";
import { clozeHints } from "./cloze-panel";
import { draftKey, useListeningDrafts, type ListeningDraft } from "./listening-drafts";
import { useListeningReveal } from "./listening-reveal-context";
import { usePracticeStats } from "./practice-stats-context";
import { useLineAnswer } from "./use-line-answer";
import { useResultChime } from "./use-result-chime";

/**
 * Why a Check or Show answer did not land. Only `network` (offline, 5xx) says to try again: a 401 is the session
 * (sign in again, ultra review 3), any other 4xx is a request the server will refuse again (reload).
 */
export type ListeningAttemptError = "network" | "line_changed" | "rate_limited" | "signed_out" | "rejected";

function attemptError(status: number): ListeningAttemptError {
  if (status === 409) return "line_changed";
  if (status === 429) return "rate_limited";
  if (status === 401) return "signed_out";
  return status >= 400 && status < 500 ? "rejected" : "network";
}
/** A submitted result as later attempts compare with it; `version` + `textHash` say which cut of the line it scored. */
export interface PreviousResult { score: number; ownCorrect?: number; wrongPieces?: number[]; errorCount?: number; version: number; textHash: string }
type SubmitPayload = { chunkOrder: number[] } | { input: string } | { answers: string[] };
/** What a new attempt inherits from the one it replaces: a Try again, or a restart after `line_changed`. */
type Carry = { lineKey: string; retry: boolean; error: ListeningAttemptError | null };
interface AttemptState {
  key: string;
  hinted: number[];
  submitting: boolean;
  result: ListeningSubmitData | null;
  /** The submitted result `result` is compared with (P14 "fixed" / "fewer"), read before `result` replaced it. */
  comparedTo: PreviousResult | null;
  answer: string | null;
  revealed: boolean;
  error: ListeningAttemptError | null;
  retry: boolean;
  carry: Carry | null;
  /** Điền từ: one per blank, hinted prefix included; `easyUsed` latches on the first chip (spec §3.4, §3.6). */
  answers: string[];
  easyUsed: boolean;
  /** Chép chính tả's typed text and the placed pieces, kept here so they can be saved as a draft (plan Task 14). */
  input: string;
  order: number[];
  /** The draft key this attempt already restored from (or chose not to); a draft is applied once, before any edit. */
  restored: string | null;
  /** Korume's reaction to this attempt's Check or Show answer, judged once when it lands. */
  reaction: MoodResult | null;
}

const fresh = (key: string, carry: Carry | null): AttemptState => ({
  key, hinted: [], submitting: false, result: null, comparedTo: null, answer: null, revealed: false,
  error: carry?.error ?? null, retry: carry?.retry ?? false, carry: null, answers: [], easyUsed: false, input: "", order: [], restored: null, reaction: null,
});

const sameBlanks = (a: readonly number[] | undefined, b: readonly number[]) => a !== undefined && a.length === b.length && a.every((x, i) => x === b[i]);

function summarize(data: ListeningSubmitData, { version, textHash }: { version: number; textHash: string }): PreviousResult {
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
 * One Listening attempt on the current line and requested format (P10, P11). Its state is keyed by line + format +
 * the reveal provider's attempt and resets during render when that key moves, so a line change, a format
 * change or Try again starts empty in the same commit. A request captures the attempt it belongs to; a
 * response for an attempt that is no longer current is dropped, and the reveal provider ignores it too.
 * Reveal state is written only from click handlers and request callbacks, never from an effect. Word pieces on a
 * line the chunker cannot cut reliably are typed instead (D9): the returned `format` is the one that line uses.
 */
export function useListeningAttempt(lineId: string | null, requested: ListeningFormat) {
  const { video, lines } = useLesson();
  const { attempt, newAttempt, markChecked, markRevealed } = useListeningReveal();
  const { refresh } = usePracticeStats();
  const chime = useResultChime();
  const isCloze = requested === "cloze";
  const { data: cloze, status: clozeStatus, reload: reloadCloze } = useLineAnswer<LineCloze>(isCloze ? lineId : null, "cloze");
  const { data: chunks, status: chunksStatus, reload: reloadChunks } = useLineAnswer<LineChunks>(isCloze ? null : lineId, "chunks");
  const format: ListeningFormat = requested === "word_bank" && chunks !== null && !chunks.reliable ? "typing" : requested;

  const lineKey = `${lineId}|${format}`;
  const key = `${lineKey}|${attempt}`;
  const [stored, setState] = useState<AttemptState>(() => fresh(key, null));
  let state = stored;
  if (stored.key !== key) {
    state = fresh(key, stored.carry?.lineKey === lineKey ? stored.carry : null);
    setState(state);
  }
  // Drafts (plan Task 14): an unfinished attempt is restored when its line + format comes back, once its cut is
  // known (word pieces key by cut version; a cloze draft must have the current blanks, Review Focus 2). Try again
  // starts empty; sending a Check or Show answer drops the draft.
  const drafts = useListeningDrafts();
  const draftId = !lineId ? null : isCloze ? cloze ? draftKey(lineId, "cloze") : null
    : format === "word_bank" ? chunks ? draftKey(lineId, "word_bank", chunks.version) : null : draftKey(lineId, "typing");
  if (draftId !== null && state.restored !== draftId) {
    const draft = state.retry ? undefined : drafts.get(draftId);
    const usable = draft && (!isCloze || (cloze !== null && sameBlanks(draft.blanks, cloze.blanks)));
    state = { ...state, restored: draftId, ...(usable ? {
      hinted: draft.hinted, input: draft.input ?? "", order: draft.answer ?? [], answers: draft.answers ?? [], easyUsed: draft.easyUsed ?? false,
    } : {}) };
    setState(state);
  }
  const currentKey = useRef(key);
  currentKey.current = key;
  /** The one request in flight per attempt (Review Focus 1): state alone cannot stop two clicks in one tick. */
  const inFlight = useRef<string | null>(null);
  /** The last submitted result per line + format in this visit; never persisted. */
  const previousResults = useRef(new Map<string, PreviousResult>());
  /** Every Check and Show answer of this visit, oldest first, for Korume's reaction; never persisted. */
  const moodLog = useRef<MoodEntry[]>([]);
  function react(entry: MoodEntry, opts?: Parameters<typeof korumeMood>[2]): MoodResult {
    const reaction = korumeMood(moodLog.current, entry, opts);
    moodLog.current.push(entry);
    return reaction;
  }

  // Word pieces hint a piece; Typing in Chép chính tả reveals one star = one grapheme (spec §3.3); Điền từ one kana
  // of a blank's reading (§3.4).
  const unit = format === "word_bank" ? "chunk" : "grapheme1";
  const lineText = lines.find((line) => line.id === lineId)?.textJp ?? "";
  /** The cut the attempt is scored against: its `version` and `textHash` go back with every request. */
  const cut = isCloze ? cloze : chunks;
  const unitCount = isCloze ? cloze ? clozeHints(cloze.readings, []).total : 0
    : !chunks ? 0 : unit === "chunk" ? chunks.chunks.length : grapheme1Units(normalizeJa(lineText)).length;
  const answered = state.result !== null || state.revealed;
  const { save: saveDraft, clear: clearDraft } = drafts;
  const draftReady = draftId !== null && state.restored === draftId && !answered && !state.submitting;
  const blanks = cloze?.blanks;
  useEffect(() => {
    if (!draftReady || draftId === null) return;
    const draft: ListeningDraft = { hinted: state.hinted, input: state.input, answer: state.order, answers: state.answers, easyUsed: state.easyUsed, ...(isCloze ? { blanks } : {}) };
    saveDraft(draftId, draft);
  }, [blanks, draftId, draftReady, isCloze, saveDraft, state.answers, state.easyUsed, state.hinted, state.input, state.order]);
  const previous = previousResults.current.get(lineKey) ?? null;
  /** A blank 💡 may still hint: the learner has not typed into it or filled it with a chip (its box holds only its
   *  hint, if any), so 💡 never overwrites their answer. */
  const unfinished = (answers: string[]) => (b: number, prefix: string) => (answers[b] ?? "") === prefix;

  async function post(body: Record<string, unknown>, done: (data: ListeningSubmitData | ListeningRevealData) => void) {
    const requestKey = key;
    const requestDraft = draftId;
    if (inFlight.current === requestKey) return;
    inFlight.current = requestKey;
    // A sent answer is no longer a draft: leaving the line while it is checked brings back an empty attempt. If the
    // request fails, the attempt is still open on screen and saves itself again (the effect above).
    if (requestDraft !== null) clearDraft(requestDraft);
    setState((prev) => prev.key === requestKey ? { ...prev, submitting: true, error: null } : prev);
    let outcome: { data: ListeningSubmitData | ListeningRevealData } | ListeningAttemptError;
    try {
      const response = await fetch("/api/dictation/attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      outcome = response.ok ? await response.json() as { data: ListeningSubmitData | ListeningRevealData }
        : attemptError(response.status);
    } catch {
      outcome = "network";
    }
    if (inFlight.current === requestKey) inFlight.current = null;
    // A saved row changes the line's stats whether or not its attempt is still on screen.
    if (typeof outcome !== "string") refresh();
    if (currentKey.current !== requestKey) return;
    if (outcome === "line_changed") {
      // 409 line_changed / chunker_version: the line's chunks moved; restart on fresh ones, without the stale draft.
      setState((prev) => ({ ...prev, submitting: false, carry: { lineKey, retry: false, error: "line_changed" } }));
      reloadChunks();
      reloadCloze();
      newAttempt();
    } else if (typeof outcome === "string") {
      const error = outcome;
      setState((prev) => prev.key === requestKey ? { ...prev, submitting: false, error } : prev);
    } else {
      // Only a scored Check chimes; Show answer is not a result (owner 2026-10-31).
      if (outcome.data.kind === "submit") chime(isCloze ? "listeningCloze" : "listeningDictation", outcome.data.score);
      done(outcome.data);
    }
  }

  function submit(payload: SubmitPayload): Promise<void> {
    if (!lineId || !cut || answered) return Promise.resolve();
    const requestAttempt = attempt;
    const requestKey = key;
    const body = {
      kind: "submit", videoId: video.id, lineId, version: cut.version, textHash: cut.textHash, hintedUnits: state.hinted,
      ...("answers" in payload ? { format: "cloze", blanks: cloze?.blanks, answers: payload.answers, easy: state.easyUsed }
        : "chunkOrder" in payload ? { format: "word_bank", chunkOrder: payload.chunkOrder } : { format: "typing", input: payload.input, hintUnit: unit }),
    };
    return post(body, (data) => {
      const result = data as ListeningSubmitData;
      const last = previousResults.current.get(lineKey);
      // "fixed" / "fewer" only against the same cut of the line: never v1 against v2, never an edited line.
      const comparedTo = last?.version === cut.version && last.textHash === cut.textHash ? last : null;
      previousResults.current.set(lineKey, summarize(result, cut));
      // Korume reads the same outcome the learner reads: *_perfect only without help, *_helped_all right with help.
      const messages = checkedFeedback(result, comparedTo);
      // A landed Check always carries a checked id, so the fallback never fires; it only keeps the type total.
      const outcome = feedbackOutcome(messages) ?? "partial";
      const reaction = react({ line: lineId, outcome, score: result.score }, { close: result.score >= REVIEW_DICTATION_BELOW, extraOnly: messages.some((message) => message.id === "ty_extra") });
      setState((prev) => prev.key === requestKey ? { ...prev, submitting: false, result, answer: result.answer, comparedTo, reaction } : prev);
      markChecked(requestAttempt);
    });
  }

  function reveal(): Promise<void> {
    if (!lineId || !cut || answered) return Promise.resolve();
    const requestAttempt = attempt;
    const requestKey = key;
    const body = {
      kind: "reveal", videoId: video.id, lineId, format, version: cut.version, textHash: cut.textHash, hintedUnits: state.hinted,
      ...(format === "typing" ? { hintUnit: unit } : isCloze ? { blanks: cloze?.blanks, easy: state.easyUsed } : {}),
    };
    return post(body, (data) => {
      const reaction = react({ line: lineId, outcome: "revealed", score: null });
      setState((prev) => prev.key === requestKey ? { ...prev, submitting: false, answer: (data as ListeningRevealData).answer, revealed: true, reaction } : prev);
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

  /** A tapped star (Typing only): its grapheme becomes a hint of this attempt; nothing is sent until Check or 💡. */
  function revealUnit(unit: number) {
    if (format !== "typing" || !chunks || answered || state.submitting) return;
    setState((prev) => prev.key !== key || prev.hinted.includes(unit) ? prev : { ...prev, hinted: [...prev.hinted, unit] });
  }

  /**
   * Điền từ 💡 (spec §3.4): the next kana of the lowest unfinished blank's reading; nothing is sent until Check or
   * Show answer. The blank keeps what was typed only where it continues the new prefix: a hinted blank is kana.
   */
  function hintCloze() {
    if (!cloze || answered || state.submitting) return;
    setState((prev) => {
      const { next } = clozeHints(cloze.readings, prev.hinted, unfinished(prev.answers));
      if (prev.key !== key || next === null) return prev;
      const hinted = [...prev.hinted, next];
      const { prefixes } = clozeHints(cloze.readings, hinted);
      return { ...prev, hinted, answers: prefixes.map((p, b) => (prev.answers[b] ?? "").startsWith(p) ? prev.answers[b] ?? "" : p) };
    });
  }

  function setAnswers(answers: string[]) {
    if (answered || state.submitting) return;
    setState((prev) => prev.key === key ? { ...prev, answers } : prev);
  }

  function setInput(input: string) {
    setState((prev) => prev.key === key ? { ...prev, input } : prev);
  }

  function setOrder(order: number[]) {
    setState((prev) => prev.key === key ? { ...prev, order } : prev);
  }

  /** A Chế độ dễ chip was used: this attempt is helped (spec §3.6), whatever happens to the chip afterwards. */
  function markChipUsed() {
    setState((prev) => prev.key === key ? { ...prev, easyUsed: true } : prev);
  }

  function tryAgain() {
    setState((prev) => ({ ...prev, carry: { lineKey, retry: true, error: null } }));
    newAttempt();
  }

  /** P14 for a checked result. Also called when the result lands, so Korume judges exactly what the learner reads. */
  function checkedFeedback(result: ListeningSubmitData, comparedTo: PreviousResult | null): FeedbackMessage[] {
    // The server says whether the attempt was helped (spec §3.6); the client names the help it used.
    const help: FeedbackHelp | null = result.helped
      ? { stars: format === "typing" ? state.hinted.length : 0, hints: format === "typing" ? 0 : state.hinted.length, easy: format === "word_bank" || state.easyUsed }
      : null;
    return listeningFeedback(result.blanks
      ? { kind: "checked_cloze", blanks: result.blanks, words: cloze?.segments.flatMap((s) => s.blank === null ? [] : [s.text]) ?? [], help }
      : result.slots
      ? { kind: "checked_word_bank", slots: result.slots, display: chunks?.display ?? [], previous: comparedTo?.wrongPieces ? { wrongPieces: comparedTo.wrongPieces } : null, help }
      : { kind: "checked_typing", diff: result.diff ?? [], metrics: result.metrics, previous: comparedTo?.errorCount !== undefined ? { errorCount: comparedTo.errorCount } : null, help });
  }
  const feedback: FeedbackMessage[] = state.result
    ? checkedFeedback(state.result, state.comparedTo)
    : state.revealed ? listeningFeedback({ kind: "revealed" })
    : [
      ...(state.retry ? listeningFeedback({ kind: "retry", previousScore: previous?.score ?? null }) : []),
      ...(state.hinted.length > 0 ? listeningFeedback({ kind: "hint", unit, hinted: state.hinted.length, total: unitCount }) : []),
    ];

  return {
    format,
    chunks,
    chunksStatus,
    cloze,
    clozeStatus,
    reloadCloze,
    answers: cloze ? cloze.blanks.map((_, b) => state.answers[b] ?? "") : [],
    hintCloze,
    setAnswers,
    markChipUsed,
    input: state.input,
    setInput,
    order: state.order,
    setOrder,
    submitting: state.submitting,
    hinted: state.hinted,
    allHinted: isCloze && cloze ? clozeHints(cloze.readings, state.hinted, unfinished(state.answers)).next === null
      : unitCount > 0 && state.hinted.length >= unitCount,
    result: state.result,
    answer: state.answer,
    revealed: state.revealed,
    error: state.error,
    previous,
    feedback,
    reaction: state.reaction,
    hint,
    revealUnit,
    submit,
    reveal,
    tryAgain,
    reloadChunks,
  };
}
