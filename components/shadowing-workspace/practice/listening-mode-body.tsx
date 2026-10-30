"use client";

import { useEffect, useRef } from "react";
import { Eye, Lightbulb } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { feedbackMood } from "@/lib/dictation/listening-feedback";
import { dictationFormat, listeningExercise, type ListeningExercise } from "@/lib/shadowing-workspace/learning-modes";
import { NextGlyph } from "../player-glyphs";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { ClozePanel } from "./cloze-panel";
import { ListeningFeedback } from "./listening-feedback";
import { ListeningPicker } from "./listening-picker";
import { useListeningReveal } from "./listening-reveal-context";
import { ListeningToolbar } from "./listening-toolbar";
import { PracticeEmptyTranscript, PracticePanel, useFirstPracticeSentence } from "./practice-panel";
import { ReplayRow } from "./replay-row";
import { SentenceNavigator } from "./sentence-navigator";
import { DictationMask } from "./star-mask";
import { TypingPanel } from "./typing-panel";
import { useListeningAttempt } from "./use-listening-attempt";
import { WordBankPanel } from "./word-bank-panel";

const ACTION = "inline-flex min-h-control-sm items-center justify-center gap-xs rounded-full border border-border px-sm py-xs text-caption text-muted-foreground hover:bg-muted disabled:opacity-50";
const PILL = "inline-flex min-h-control-sm items-center justify-center rounded-full border border-primary bg-primary/10 px-sm py-2xs text-caption font-semibold text-primary-strong disabled:opacity-50";

/**
 * Listening Practice (spec §3.0). The URL's `?format=` is the only exercise (P10): none or an unknown value shows the
 * picker; a legacy `typing` / `word_bank` link becomes `format=dictation` by a URL replace (`word_bank` also turns
 * Chế độ dễ on), and no practice control renders until the URL agrees. Chép chính tả writes typing, or word_bank in
 * Chế độ dễ (§3.1); Điền từ writes cloze (§3.4). The navigator stays live: changing line discards
 * an in-progress attempt (D12).
 */
export function ListeningModeBody() {
  const t = useTranslations("shadowing");
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const { exercise, easyFromLegacy, legacy } = listeningExercise(new URLSearchParams(query).get("format"));
  const { transcriptId, lines } = useLesson();
  const { index } = useCurrentSentence();
  const controller = usePlaybackController();
  const { attempt: attemptNumber, answerVisible, easy, setEasy, listenOnly } = useListeningReveal();
  const line = index === null ? undefined : lines[index];
  const dictation = exercise === "dictation" && !legacy;
  const cloze = exercise === "cloze";
  const lineId = dictation || cloze ? line?.id ?? null : null;
  const attempt = useListeningAttempt(lineId, cloze ? "cloze" : dictationFormat(easy));
  const { chunks, chunksStatus, format } = attempt;
  const status = cloze ? attempt.clozeStatus : chunksStatus;
  const unreliable = chunksStatus === "ready" && chunks !== null && !chunks.reliable;
  const ready = status === "ready" && (cloze ? attempt.cloze : chunks) !== null && lineId !== null;
  const answered = attempt.result !== null || attempt.revealed;
  const noBlank = cloze && attempt.cloze?.blanks.length === 0;
  useFirstPracticeSentence();
  // Alt+H = 💡 (spec §3.3, §3.4), from anywhere in the page, the input boxes included: the whole sentence in Chép
  // chính tả, one kana in Điền từ. Never during an IME composition (the key is the IME's then); the workspace
  // shortcuts ignore every Alt combo, so nothing else moves. The listener reads the latest handler from a ref, so it
  // subscribes once per live period, not on every render.
  const bulb = useRef<() => void>(() => undefined);
  bulb.current = cloze ? attempt.hintCloze : () => void attempt.reveal();
  const bulbLive = ready && !answered && !attempt.submitting && !noBlank;
  useEffect(() => {
    if (!bulbLive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== "KeyH" || event.repeat || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      bulb.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bulbLive]);
  const choose = (next: ListeningExercise | null) => {
    const params = new URLSearchParams(query);
    if (next === null) params.delete("format");
    else params.set("format", next);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };
  useEffect(() => {
    if (!legacy) return;
    if (easyFromLegacy) setEasy(true);
    const params = new URLSearchParams(query);
    params.set("format", "dictation");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [easyFromLegacy, legacy, pathname, query, router, setEasy]);

  if (transcriptId === null) return <PracticeEmptyTranscript />;
  if (exercise === null) return <ListeningPicker onChoose={choose} />;
  // 💡 is Show answer in Chép chính tả (spec §3.3); word pieces keep WP's piece Hint beside it, Typing has the stars.
  // In Điền từ 💡 gives one kana and 👁 is Show answer (§3.4).
  const bulbLabel = tl(cloze ? "cloze.hint" : "dictation.showAll");
  const hint = answered || noBlank ? null : <div className="flex items-center gap-xs">
    {format === "word_bank" && !cloze && <button type="button" disabled={attempt.submitting || attempt.allHinted} onClick={attempt.hint} className={PILL}>{tl("hint")}</button>}
    <Tooltip content={bulbLabel}>
      <button type="button" aria-label={bulbLabel} aria-keyshortcuts="Alt+H" disabled={attempt.submitting || (cloze && attempt.allHinted)} onClick={() => bulb.current()} className={PILL}>
        <Lightbulb aria-hidden className="size-icon-sm" />
      </button>
    </Tooltip>
    {cloze && <button type="button" disabled={attempt.submitting} onClick={() => void attempt.reveal()} className={ACTION}>
      <Eye aria-hidden className="size-icon-xs" />{tl("cloze.showAnswer")}
    </button>}
  </div>;
  // §3.1: no counter here — the workspace header carries "Câu n / total" in every state.
  const header = <div className="flex flex-wrap items-center justify-between gap-sm">
    <div className="flex items-center gap-sm">
      <h2 className="text-body-lg font-semibold text-foreground">{tl(`format.${exercise}`)}</h2>
      <button type="button" className={ACTION} onClick={() => choose(null)}>{tl("changeExercise")}</button>
    </div>
    <ListeningToolbar easyDisabled={dictation && unreliable} />
  </div>;
  return <PracticePanel label={tl("region")} header={header} navigator={<SentenceNavigator />}
    feedback={<ListeningFeedback messages={attempt.feedback} mood={answerVisible ? feedbackMood(attempt.feedback) : null} error={attempt.error} submitting={attempt.submitting}
      result={answerVisible ? attempt.result : null} answer={answerVisible ? attempt.answer : null} />}>
    {/* In listen-only the dock holds these controls (Ruling T1). */}
    {!listenOnly && <ReplayRow />}
    {lineId !== null && status === "loading" && <p className="text-caption text-muted-foreground">{tl("loading")}</p>}
    {lineId !== null && status === "error" && <div role="alert" className="flex items-center gap-sm text-caption text-danger-strong">
      <p>{tl("chunksError")}</p>
      <button type="button" className={ACTION} onClick={cloze ? attempt.reloadCloze : attempt.reloadChunks}>{tl("retryLoad")}</button>
    </div>}
    {ready && cloze && attempt.cloze && <ClozePanel key={`${lineId}|cloze|${attemptNumber}`} cloze={attempt.cloze} easy={easy} answers={attempt.answers}
      hinted={attempt.hinted} results={answerVisible ? attempt.result?.blanks ?? null : null} revealed={answerVisible && attempt.revealed}
      submitting={attempt.submitting} hint={hint} onChange={attempt.setAnswers} onUseChip={attempt.markChipUsed}
      onCheck={() => void attempt.submit({ answers: attempt.answers })} />}
    {ready && unreliable && <p data-testid="listening-unreliable" className="rounded-md border border-border bg-muted px-sm py-xs text-caption text-muted-foreground">{tl("unreliable")}</p>}
    {/* Chế độ dễ: the mask is a length cue only, never tappable, so one attempt never mixes two hint units (§3.3). It
        rides in the puzzle header's row, so the longest line still fits above the listen-only dock (Ruling T1). */}
    {ready && format === "word_bank" && chunks && <WordBankPanel key={`${lineId}|${format}|${attemptNumber}`} lineId={lineId} display={chunks.display}
      hinted={attempt.hinted} results={answerVisible ? attempt.result?.slots ?? null : null} revealed={answerVisible && attempt.revealed}
      submitting={attempt.submitting} onCheck={(chunkOrder) => void attempt.submit({ chunkOrder })}
      hint={<div className="flex flex-1 flex-wrap items-center justify-end gap-xs">
        <DictationMask text={line?.textJp ?? ""} hinted={[]} revealed={answerVisible && attempt.revealed} />{hint}
      </div>} />}
    {ready && format === "typing" && <TypingPanel key={`${lineId}|${format}|${attemptNumber}`} text={line?.textJp ?? ""}
      hinted={attempt.hinted} diff={answerVisible ? attempt.result?.diff ?? null : null} revealed={answerVisible && attempt.revealed}
      submitting={attempt.submitting} hint={hint} onReveal={attempt.revealUnit} onCheck={(input) => void attempt.submit({ input })} />}
    {ready && <div className="flex flex-wrap justify-center gap-xs">
      {answered && <button type="button" className={ACTION} onClick={attempt.tryAgain}>{tl("tryAgain")}</button>}
      <button type="button" className={ACTION} disabled={index === null || index >= lines.length - 1} onClick={() => controller.nextSentence()}>
        {t("workspace.player.next")}<NextGlyph className="size-icon-xs" />
      </button>
    </div>}
  </PracticePanel>;
}
