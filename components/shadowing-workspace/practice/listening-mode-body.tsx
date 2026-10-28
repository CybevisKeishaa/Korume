"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { feedbackMood } from "@/lib/dictation/listening-feedback";
import { dictationFormat, listeningExercise, type ListeningExercise } from "@/lib/shadowing-workspace/learning-modes";
import { NextGlyph } from "../player-glyphs";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { ListeningFeedback } from "./listening-feedback";
import { ListeningPicker } from "./listening-picker";
import { useListeningReveal } from "./listening-reveal-context";
import { ListeningToolbar } from "./listening-toolbar";
import { PracticeEmptyTranscript, PracticePanel, useFirstPracticeSentence } from "./practice-panel";
import { ReplayRow } from "./replay-row";
import { SentenceNavigator } from "./sentence-navigator";
import { TypingPanel } from "./typing-panel";
import { useListeningAttempt } from "./use-listening-attempt";
import { WordBankPanel } from "./word-bank-panel";

const ACTION = "inline-flex min-h-control-sm items-center justify-center gap-xs rounded-full border border-border px-sm py-xs text-caption text-muted-foreground hover:bg-muted disabled:opacity-50";

/**
 * Listening Practice (spec §3.0). The URL's `?format=` is the only exercise (P10): none or an unknown value shows the
 * picker; a legacy `typing` / `word_bank` link becomes `format=dictation` by a URL replace (`word_bank` also turns
 * Chế độ dễ on), and no practice control renders until the URL agrees. Chép chính tả writes typing, or word_bank in
 * Chế độ dễ (§3.1); Điền từ is a placeholder until its panel lands. The navigator stays live: changing line discards
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
  const lineId = dictation ? line?.id ?? null : null;
  const attempt = useListeningAttempt(lineId, dictationFormat(easy));
  const { chunks, chunksStatus, format } = attempt;
  const unreliable = chunksStatus === "ready" && chunks !== null && !chunks.reliable;
  useFirstPracticeSentence();
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
  const answered = attempt.result !== null || attempt.revealed;
  const hint = answered ? null : <button type="button" disabled={attempt.submitting || attempt.allHinted} onClick={attempt.hint}
    className="rounded-full border border-primary bg-primary/10 px-sm py-2xs text-caption font-semibold text-primary-strong disabled:opacity-50">{tl("hint")}</button>;
  const ready = chunksStatus === "ready" && chunks !== null && lineId !== null;
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
    {exercise === "cloze" && <p data-testid="listening-cloze-pending" className="rounded-md border border-border bg-muted px-sm py-xs text-caption text-muted-foreground">{tl("clozePending")}</p>}
    {lineId !== null && chunksStatus === "loading" && <p className="text-caption text-muted-foreground">{tl("loading")}</p>}
    {lineId !== null && chunksStatus === "error" && <div role="alert" className="flex items-center gap-sm text-caption text-danger-strong">
      <p>{tl("chunksError")}</p>
      <button type="button" className={ACTION} onClick={attempt.reloadChunks}>{tl("retryLoad")}</button>
    </div>}
    {ready && unreliable && <p data-testid="listening-unreliable" className="rounded-md border border-border bg-muted px-sm py-xs text-caption text-muted-foreground">{tl("unreliable")}</p>}
    {ready && format === "word_bank" && <WordBankPanel key={`${lineId}|${format}|${attemptNumber}`} lineId={lineId} display={chunks.display}
      hinted={attempt.hinted} results={answerVisible ? attempt.result?.slots ?? null : null} revealed={answerVisible && attempt.revealed}
      submitting={attempt.submitting} hint={hint} onCheck={(chunkOrder) => void attempt.submit({ chunkOrder })} />}
    {ready && format === "typing" && <TypingPanel key={`${lineId}|${format}|${attemptNumber}`} text={line?.textJp ?? ""} display={chunks.display}
      hintUnit={chunks.typingHintUnit} hinted={attempt.hinted} diff={answerVisible ? attempt.result?.diff ?? null : null}
      revealed={answerVisible && attempt.revealed} submitting={attempt.submitting} hint={hint} onCheck={(input) => void attempt.submit({ input })} />}
    {ready && <div className="flex flex-wrap justify-center gap-xs">
      {!answered && <button type="button" className={ACTION} disabled={attempt.submitting} onClick={() => void attempt.reveal()}>{tl("showAnswer")}</button>}
      {answered && <button type="button" className={ACTION} onClick={attempt.tryAgain}>{tl("tryAgain")}</button>}
      <button type="button" className={ACTION} disabled={index === null || index >= lines.length - 1} onClick={() => controller.nextSentence()}>
        {t("workspace.player.next")}<NextGlyph className="size-icon-xs" />
      </button>
    </div>}
  </PracticePanel>;
}
