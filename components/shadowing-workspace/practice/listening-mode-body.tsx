"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { listeningFormat } from "@/lib/shadowing-workspace/learning-modes";
import { NextGlyph } from "../player-glyphs";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { ListeningFeedback } from "./listening-feedback";
import { useListeningReveal } from "./listening-reveal-context";
import { PracticeEmptyTranscript, PracticePanel, useFirstPracticeSentence } from "./practice-panel";
import { SentenceNavigator } from "./sentence-navigator";
import { useListeningAttempt } from "./use-listening-attempt";
import { WordBankPanel } from "./word-bank-panel";

const ACTION = "inline-flex min-h-control-sm items-center justify-center gap-xs rounded-full border border-border px-sm py-xs text-caption text-muted-foreground hover:bg-muted disabled:opacity-50";

/**
 * Listening Practice (spec §5). The URL's `?format=` is the only format (P10): an unreliable line opened as Word
 * Bank is moved to `format=typing` by a URL replace, and no practice control renders until the URL agrees. The
 * navigator stays live: changing line discards an in-progress attempt (D12).
 */
export function ListeningModeBody() {
  const t = useTranslations("shadowing");
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const format = listeningFormat(searchParams.get("format"));
  const { transcriptId, lines } = useLesson();
  const { index } = useCurrentSentence();
  const controller = usePlaybackController();
  const { attempt: attemptNumber, answerVisible } = useListeningReveal();
  const lineId = index === null ? null : lines[index]?.id ?? null;
  const attempt = useListeningAttempt(lineId, format);
  const { chunks, chunksStatus } = attempt;
  const unreliable = chunksStatus === "ready" && chunks !== null && !chunks.reliable;
  const fallback = unreliable && format === "word_bank";
  useFirstPracticeSentence();
  useEffect(() => {
    if (!fallback) return;
    const params = new URLSearchParams(query);
    params.set("format", "typing");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [fallback, pathname, query, router]);

  if (transcriptId === null) return <PracticeEmptyTranscript />;
  const answered = attempt.result !== null || attempt.revealed;
  const ready = chunksStatus === "ready" && chunks !== null && lineId !== null && !fallback;
  return <PracticePanel label={tl("region")} navigator={<SentenceNavigator />}
    feedback={<ListeningFeedback messages={attempt.feedback} error={attempt.error} submitting={attempt.submitting}
      result={answerVisible ? attempt.result : null} answer={answerVisible ? attempt.answer : null} />}>
    {lineId !== null && chunksStatus === "loading" && <p className="text-caption text-muted-foreground">{tl("loading")}</p>}
    {lineId !== null && chunksStatus === "error" && <div role="alert" className="flex items-center gap-sm text-caption text-danger-strong">
      <p>{tl("chunksError")}</p>
      <button type="button" className={ACTION} onClick={attempt.reloadChunks}>{tl("retryLoad")}</button>
    </div>}
    {ready && unreliable && <p data-testid="listening-unreliable" className="rounded-md border border-border bg-muted px-sm py-xs text-caption text-muted-foreground">{tl("unreliable")}</p>}
    {ready && format === "word_bank" && <WordBankPanel key={`${lineId}|${format}|${attemptNumber}`} lineId={lineId} display={chunks.display}
      hinted={attempt.hinted} results={answerVisible ? attempt.result?.slots ?? null : null} revealed={answerVisible && attempt.revealed}
      submitting={attempt.submitting} onCheck={(chunkOrder) => void attempt.submit({ chunkOrder })} onProgress={attempt.setInProgress} />}
    {ready && <div className="flex flex-wrap gap-xs">
      {!answered && <>
        <button type="button" className={ACTION} disabled={attempt.submitting || attempt.allHinted} onClick={attempt.hint}>{tl("hint")}</button>
        <button type="button" className={ACTION} disabled={attempt.submitting} onClick={() => void attempt.reveal()}>{tl("showAnswer")}</button>
      </>}
      {answered && <button type="button" className={ACTION} onClick={attempt.tryAgain}>{tl("tryAgain")}</button>}
      <button type="button" className={ACTION} disabled={index === null || index >= lines.length - 1} onClick={() => controller.nextSentence()}>
        {t("workspace.player.next")}<NextGlyph className="size-icon-xs" />
      </button>
    </div>}
  </PracticePanel>;
}
