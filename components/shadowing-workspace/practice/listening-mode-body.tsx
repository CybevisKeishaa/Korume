"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { feedbackMood } from "@/lib/dictation/listening-feedback";
import { listeningFormat } from "@/lib/shadowing-workspace/learning-modes";
import { NextGlyph } from "../player-glyphs";
import { usePlayerWiring } from "../playback-root";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { ListeningFeedback } from "./listening-feedback";
import { ListeningFormatSwitch } from "./listening-format-switch";
import { useListeningReveal } from "./listening-reveal-context";
import { PracticeGlyph } from "./practice-glyph";
import { PracticeEmptyTranscript, PracticePanel, useFirstPracticeSentence } from "./practice-panel";
import { SentenceNavigator } from "./sentence-navigator";
import { TypingPanel } from "./typing-panel";
import { useListeningAttempt } from "./use-listening-attempt";
import { WordBankPanel } from "./word-bank-panel";

const RATE = "rounded-full px-xs py-2xs text-caption font-semibold aria-pressed:bg-foreground/10 aria-pressed:text-foreground text-muted-foreground";
const ACTION = "inline-flex min-h-control-sm items-center justify-center gap-xs rounded-full border border-border px-sm py-xs text-caption text-muted-foreground hover:bg-muted disabled:opacity-50";

/** Replay audio, Loop and the two rates: the player bar's own state, so both stay in sync (Figma 123:2835). */
function ReplayRow({ index }: { index: number | null }) {
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const controller = usePlaybackController();
  const { loop, toggleLoop, rate, setRate } = usePlayerWiring();
  return <div className="flex items-center justify-between gap-sm rounded-full bg-muted px-md py-sm">
    <button type="button" disabled={index === null} onClick={() => { if (index !== null) controller.seekToSentence(index, { play: true }); }}
      className="inline-flex items-center gap-xs text-body font-semibold text-primary-strong disabled:opacity-50">
      <PracticeGlyph name="listening-replay-audio" />{tl("replay.audio")}
    </button>
    <div className="flex items-center gap-xs">
      <button type="button" aria-pressed={loop.enabled} onClick={toggleLoop}
        className="flex flex-col items-center rounded-full px-sm py-2xs text-caption font-semibold text-muted-foreground aria-pressed:bg-primary/15 aria-pressed:text-primary-strong">
        <PracticeGlyph name="listening-loop" />{tl("replay.loop")}
      </button>
      {[0.75, 1].map((value) => <button key={value} type="button" aria-label={tl("replay.rate", { rate: value })} aria-pressed={rate === value} onClick={() => setRate(value)} className={RATE}>{value}×</button>)}
    </div>
  </div>;
}

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
  const line = index === null ? undefined : lines[index];
  const lineId = line?.id ?? null;
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
  const hint = answered ? null : <button type="button" disabled={attempt.submitting || attempt.allHinted} onClick={attempt.hint}
    className="rounded-full border border-primary bg-primary/10 px-sm py-2xs text-caption font-semibold text-primary-strong disabled:opacity-50">{tl("hint")}</button>;
  const ready = chunksStatus === "ready" && chunks !== null && lineId !== null && !fallback;
  return <PracticePanel label={tl("region")} navigator={<SentenceNavigator />}
    feedback={<ListeningFeedback messages={attempt.feedback} mood={answerVisible ? feedbackMood(attempt.feedback) : null} error={attempt.error} submitting={attempt.submitting}
      result={answerVisible ? attempt.result : null} answer={answerVisible ? attempt.answer : null} />}>
    <ReplayRow index={index} />
    {!fallback && <ListeningFormatSwitch format={format} inProgress={attempt.inProgress} wordBankAvailable={!unreliable} />}
    {lineId !== null && chunksStatus === "loading" && <p className="text-caption text-muted-foreground">{tl("loading")}</p>}
    {lineId !== null && chunksStatus === "error" && <div role="alert" className="flex items-center gap-sm text-caption text-danger-strong">
      <p>{tl("chunksError")}</p>
      <button type="button" className={ACTION} onClick={attempt.reloadChunks}>{tl("retryLoad")}</button>
    </div>}
    {ready && unreliable && <p data-testid="listening-unreliable" className="rounded-md border border-border bg-muted px-sm py-xs text-caption text-muted-foreground">{tl("unreliable")}</p>}
    {ready && format === "word_bank" && <WordBankPanel key={`${lineId}|${format}|${attemptNumber}`} lineId={lineId} display={chunks.display}
      hinted={attempt.hinted} results={answerVisible ? attempt.result?.slots ?? null : null} revealed={answerVisible && attempt.revealed}
      submitting={attempt.submitting} hint={hint} onCheck={(chunkOrder) => void attempt.submit({ chunkOrder })} onProgress={attempt.setInProgress} />}
    {ready && format === "typing" && <TypingPanel key={`${lineId}|${format}|${attemptNumber}`} text={line?.textJp ?? ""} display={chunks.display}
      hintUnit={chunks.typingHintUnit} hinted={attempt.hinted} diff={answerVisible ? attempt.result?.diff ?? null : null}
      revealed={answerVisible && attempt.revealed} submitting={attempt.submitting} hint={hint} onCheck={(input) => void attempt.submit({ input })} onProgress={attempt.setInProgress} />}
    {ready && <div className="flex flex-wrap justify-center gap-xs">
      {!answered && <button type="button" className={ACTION} disabled={attempt.submitting} onClick={() => void attempt.reveal()}>{tl("showAnswer")}</button>}
      {answered && <button type="button" className={ACTION} onClick={attempt.tryAgain}>{tl("tryAgain")}</button>}
      <button type="button" className={ACTION} disabled={index === null || index >= lines.length - 1} onClick={() => controller.nextSentence()}>
        {t("workspace.player.next")}<NextGlyph className="size-icon-xs" />
      </button>
    </div>}
  </PracticePanel>;
}
