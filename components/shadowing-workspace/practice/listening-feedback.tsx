"use client";

import { useTranslations } from "@/lib/i18n";
import type { FeedbackMessage } from "@/lib/dictation/listening-feedback";
import type { ListeningSubmitData } from "@/lib/dictation/listening-score";
import { scoreBand } from "@/lib/summary/thresholds";
import { EYEBROW } from "./listening-puzzle";
import type { MoodResult } from "@/lib/practice/korume-mood";
import { KorumeQuip, PracticeKorume } from "./practice-korume";
import { PracticeGlyph } from "./practice-glyph";
import type { ListeningAttemptError } from "./use-listening-attempt";

/**
 * Listening's Live Feedback (spec 5.6, P14). The first P14 sentence is the heading and any further ones are tips,
 * all in one polite live region; while answering they carry only counts, never the text of a unit. The score,
 * the metrics that exist for this result, the answer and the saved footnote appear only once the attempt is
 * checked or revealed (`answer` is non-null exactly then, and both are stored server side).
 */
export function ListeningFeedback({ messages, reaction, error, submitting, result, answer }: {
  messages: FeedbackMessage[];
  /** Korume's reaction: null unless the current attempt's answer is visible. */
  reaction: MoodResult | null;
  error: ListeningAttemptError | null;
  submitting: boolean;
  result: ListeningSubmitData | null;
  answer: string | null;
}) {
  const t = useTranslations("shadowing.workspace.practice");
  const score = result?.score;
  const m = result?.metrics;
  // 5.6: only the metrics this result carries (Word Bank has no Kanji or Grammar), in the frame's order.
  const metrics: ["slots" | "grammar" | "kanji" | "recall", string][] = !m ? [] : [
    ...(m.slots ? [["slots", `${m.slots.correct}/${m.slots.total}`] as ["slots", string]] : []),
    ...(m.grammar === undefined ? [] : [["grammar", `${Math.round(m.grammar)}%`] as ["grammar", string]]),
    ...(m.kanji === undefined ? [] : [["kanji", `${Math.round(m.kanji)}%`] as ["kanji", string]]),
    ["recall", `${Math.round(m.recall)}%`],
  ];
  const [heading, ...tips] = [
    ...(submitting ? [t("listening.checking")] : []),
    ...messages.map((message) => t(`listening.feedback.${message.id}`, message.values)),
  ];

  // The divider and eyebrow belong to content; the live region stays mounted so a first message is announced.
  const content = error !== null || reaction !== null || heading !== undefined || result !== null || answer !== null;
  // `data-empty` lets the panel drop the gap a 0-height feedback would still take (case 22, listen-only fit).
  return <section data-empty={content ? undefined : ""} className={`flex flex-col gap-sm ${content ? "border-t border-border pt-md" : ""}`}>
    {error && <p role="alert" className="text-caption text-danger-strong">{t(`listening.error.${error}`)}</p>}
    <div className="flex items-start justify-between gap-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-2xs">
        {content && <p className={`${EYEBROW} text-primary-strong`}>{t("listening.liveFeedback")}</p>}
        {/* Korume's quip is flavour beside the P14 facts, readable but not announced on every Check. */}
        <KorumeQuip reaction={reaction} />
        <div role="status" aria-live="polite" data-testid="listening-feedback" className="flex flex-col gap-xs">
          {heading !== undefined && <p data-feedback-heading className="text-body font-semibold text-foreground">{heading}</p>}
          {tips.map((tip, i) => <p key={i} data-feedback-tip className="flex items-center gap-xs rounded-lg bg-primary/5 px-sm py-xs text-caption text-foreground">
            <span className="text-primary-strong"><PracticeGlyph name="listening-feedback-tip" /></span>{tip}
          </p>)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-sm">
        <PracticeKorume reaction={reaction} />
        {/* Pops in with the result chime; a strong score (Summary's cut, both Listening formats) also glows. */}
        {score !== undefined && <span data-testid="listening-score" data-band={scoreBand("listeningDictation", score)} className="result-pop rounded-full bg-primary px-sm py-2xs text-caption font-bold tabular-nums text-primary-foreground">{Math.round(score)}%</span>}
      </div>
    </div>
    {metrics.length > 0 && <dl className="grid grid-cols-4 gap-xs">
      {metrics.map(([name, value]) => <div key={name} className="rounded-lg bg-muted p-xs">
        <dt className="text-caption text-muted-foreground">{t(`listening.metrics.${name}`)}</dt>
        <dd className={`text-caption font-bold tabular-nums ${name === "recall" ? "text-primary-strong" : "text-foreground"}`}>{value}</dd>
      </div>)}
    </dl>}
    {answer !== null && <div className="rounded-lg bg-muted p-sm">
      <p className="text-caption text-muted-foreground">{t("listening.answer")}</p>
      <p lang="ja" data-testid="listening-answer" className="font-jp text-body-lg text-foreground">{answer}</p>
    </div>}
    {answer !== null && <p className="text-caption text-muted-foreground">{t("listening.saved")}</p>}
  </section>;
}
