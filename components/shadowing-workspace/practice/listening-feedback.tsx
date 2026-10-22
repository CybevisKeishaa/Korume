"use client";

import { useTranslations } from "@/lib/i18n";
import type { FeedbackMessage, FeedbackMood } from "@/lib/dictation/listening-feedback";
import type { ListeningSubmitData } from "@/lib/dictation/listening-score";
import { REVIEW_DICTATION_BELOW, STRONG_DICTATION_AT } from "@/lib/summary/thresholds";
import { ListeningFeedbackKorume } from "./listening-feedback-korume";
import type { ListeningAttemptError } from "./use-listening-attempt";

const CARD = "rounded-lg border border-border bg-card p-sm";

/**
 * Listening's Live Feedback (spec §5.6, P14). The P14 sentences sit in a polite live region; while answering
 * they carry only counts, never the text of a unit. The score, its label, the metrics that exist for this
 * result and the answer appear only once the attempt is checked or revealed.
 */
export function ListeningFeedback({ messages, mood, error, submitting, result, answer }: {
  messages: FeedbackMessage[];
  /** P15: null unless the current attempt's answer is visible. */
  mood: FeedbackMood | null;
  error: ListeningAttemptError | null;
  submitting: boolean;
  result: ListeningSubmitData | null;
  answer: string | null;
}) {
  const t = useTranslations("shadowing.workspace.practice");
  const score = result?.score;
  const label = score === undefined ? null : score >= STRONG_DICTATION_AT ? "excellent" : score < REVIEW_DICTATION_BELOW ? "keepPractising" : "good";
  const m = result?.metrics;
  // §5.6: only the metrics this result carries (Word Bank has no Kanji or Grammar).
  const metrics: ["recall" | "slots" | "kanji" | "grammar", string][] = !m ? [] : [
    ["recall", `${Math.round(m.recall)}%`],
    ...(m.slots ? [["slots", `${m.slots.correct}/${m.slots.total}`] as ["slots", string]] : []),
    ...(m.kanji === undefined ? [] : [["kanji", `${Math.round(m.kanji)}%`] as ["kanji", string]]),
    ...(m.grammar === undefined ? [] : [["grammar", `${Math.round(m.grammar)}%`] as ["grammar", string]]),
  ];

  return <div className="flex flex-col gap-sm">
    {error && <p role="alert" className="text-caption text-danger-strong">{t(`listening.error.${error}`)}</p>}
    <div className="flex items-start gap-sm">
      <div role="status" aria-live="polite" data-testid="listening-feedback" className="flex min-w-0 flex-1 flex-col gap-2xs text-body text-foreground">
        {submitting && <p className="text-muted-foreground">{t("listening.checking")}</p>}
        {messages.map((message) => <p key={message.id}>{t(`listening.feedback.${message.id}`, message.values)}</p>)}
      </div>
      <ListeningFeedbackKorume mood={mood} />
    </div>
    {score !== undefined && label && <div className={`${CARD} flex items-center justify-between gap-md`}>
      <p className="text-caption text-muted-foreground">{t("listening.score")}</p>
      <p className="flex items-center gap-sm"><span className="font-semibold">{t(`pronunciation.label.${label}`)}</span>
        <span data-testid="listening-score" className="rounded-full bg-primary px-sm py-2xs text-caption font-bold tabular-nums text-primary-foreground">{Math.round(score)}</span></p>
    </div>}
    {metrics.length > 0 && <dl className="grid grid-cols-2 gap-sm">
      {metrics.map(([name, value]) => <div key={name} className={CARD}>
        <dt className="text-caption text-muted-foreground">{t(`listening.metrics.${name}`)}</dt>
        <dd className="text-body-lg font-semibold tabular-nums text-foreground">{value}</dd>
      </div>)}
    </dl>}
    {answer !== null && <div className={CARD}>
      <p className="text-caption text-muted-foreground">{t("listening.answer")}</p>
      <p lang="ja" data-testid="listening-answer" className="font-jp text-body-lg text-foreground">{answer}</p>
    </div>}
  </div>;
}
