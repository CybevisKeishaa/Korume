"use client";

import { useMemo } from "react";
import { Link } from "@/lib/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import {
  reviewHrefForSection,
  type JlptLevel,
  type JlptQuestionPublic,
  type JlptSubmitResult,
  type PillarScore,
} from "@/lib/jlpt-ui";

export interface JlptResultsPanelProps {
  submitResult: JlptSubmitResult;
  questions: JlptQuestionPublic[];
  answers: Record<string, string>;
  level: JlptLevel;
}

/** Scaled-score progress bar with a sectional-minimum marker. The pass/fail
 * signal is never color-only: the numeric score, "/ scaleMax", and a
 * "meets/below minimum" text label are always shown alongside the bar. */
function PillarBar({ pillar, t }: { pillar: PillarScore; t: ReturnType<typeof useTranslations<"jlpt">> }) {
  const pct = pillar.scaleMax === 0 ? 0 : Math.round((pillar.scaledScore / pillar.scaleMax) * 100);
  const minPct = pillar.scaleMax === 0 ? 0 : Math.round((pillar.sectionalMinimum / pillar.scaleMax) * 100);
  const pillarLabel = t(`pillars.${pillar.pillar}`);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{pillarLabel}</span>
        <span className="text-muted-foreground">
          {pillar.scaledScore} / {pillar.scaleMax}{" "}
          {pillar.meetsMinimum ? (
            <span className="text-success-strong">{t("resultsPanel.meetsMinimum")}</span>
          ) : (
            <span className="text-danger-strong">{t("resultsPanel.belowMinimum")}</span>
          )}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pillar.scaledScore}
        aria-valuemin={0}
        aria-valuemax={pillar.scaleMax}
        aria-label={t("resultsPanel.pillarScaledScoreAria", { pillar: pillarLabel })}
        className="relative mt-1 h-3 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <div
          aria-hidden="true"
          title={t("resultsPanel.sectionalMinimum", { value: pillar.sectionalMinimum })}
          className="absolute top-0 h-full w-0.5 bg-foreground/60"
          style={{ left: `${minPct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Post-submit results (spec §5.7-§5.8): scaled total + clearly-labeled
 * pass/fail estimate, pillar breakdown, per-section correct/total, weakness
 * breakdown with "Suggested review" links, and a full per-question review.
 */
export function JlptResultsPanel({ submitResult, questions, answers, level }: JlptResultsPanelProps) {
  const t = useTranslations("jlpt");
  const { result, weakness, perQuestion } = submitResult;
  const questionsById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("resultsPanel.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("resultsPanel.scoreLine", {
            correct: result.totalCorrect,
            total: result.totalQuestions,
            percent: result.totalPercent,
          })}
        </p>
      </div>

      <section aria-label={t("resultsPanel.passEstimateAria")} className="rounded-lg border border-border p-5">
        {result.scaledTotal != null && result.pillars ? (
          <>
            <p className="text-sm text-muted-foreground">{t("resultsPanel.estimatedScaledScore")}</p>
            <p className="text-3xl font-bold">
              {result.scaledTotal}{" "}
              <span className="text-base font-normal text-muted-foreground">/ {result.scaledTotalMax}</span>
            </p>
            <p className="mt-1 text-sm">
              {result.passed ? (
                <span className="font-medium text-success-strong">{t("resultsPanel.resultPass")}</span>
              ) : (
                <span className="font-medium text-danger-strong">{t("resultsPanel.resultNotPassed")}</span>
              )}
              <span className="ml-2 text-xs text-muted-foreground">
                {t("resultsPanel.unofficialEstimate")}
              </span>
            </p>
            <div className="mt-4 space-y-4">
              {result.pillars.map((p) => (
                <PillarBar key={p.pillar} pillar={p} t={t} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("resultsPanel.passUnavailable")}
            {/* `result.passUnavailableReason` is controlled business copy authored in
                `lib/jlpt/score.ts` (one of 3 fixed variants, one with an interpolated
                pillar-name list) — not a caught exception's raw `.message` — so it is
                rendered as server data here, same as `error.message` in the submit-failure
                branch below; it is not (yet) i18n'd on the backend (see report). */}
            {result.passUnavailableReason ? `: ${result.passUnavailableReason}` : "."}
          </p>
        )}
      </section>

      <section aria-label={t("resultsPanel.sectionScores")}>
        <h2 className="mb-3 text-lg font-semibold">{t("resultsPanel.sectionScores")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.sections.map((s) => (
            <li key={s.section} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{t(`sections.${s.section}`)}</p>
              <p className="text-muted-foreground">
                {t("resultsPanel.sectionScoreLine", { correct: s.correct, total: s.total, percent: s.percent })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {weakness.length > 0 && (
        <section aria-label={t("resultsPanel.weaknessBreakdownAria")}>
          <h2 className="mb-3 text-lg font-semibold">{t("resultsPanel.whereToFocus")}</h2>
          <ul className="space-y-2">
            {weakness.map((w) => (
              <li
                key={`${w.section}-${w.questionType}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{w.questionType}</p>
                  <p className="text-muted-foreground">
                    {t("resultsPanel.weaknessLine", {
                      section: t(`sections.${w.section}`),
                      correct: w.correct,
                      total: w.total,
                      percent: w.percent,
                    })}
                  </p>
                </div>
                <Link
                  href={reviewHrefForSection(w.section, level)}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  {t("resultsPanel.suggestedReview")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label={t("resultsPanel.questionReview")}>
        <h2 className="mb-3 text-lg font-semibold">{t("resultsPanel.questionReview")}</h2>
        <ol className="space-y-4">
          {perQuestion.map((pq, i) => {
            const q = questionsById.get(pq.id);
            const yourAnswerValue = answers[pq.id];
            const yourAnswerText =
              q && yourAnswerValue !== undefined ? q.question_data.choices[Number(yourAnswerValue)] : undefined;
            const correctAnswerText = q ? q.question_data.choices[Number(pq.correctAnswer)] : undefined;
            return (
              <li key={pq.id} className="rounded-md border border-border p-4">
                <p className="text-xs text-muted-foreground">{t("resultsPanel.questionNumber", { index: i + 1 })}</p>
                {q && <p className="font-jp mt-1 text-sm">{q.question_data.stem}</p>}
                <p className="mt-2 text-sm">
                  <span aria-hidden="true">{pq.correct ? "✓" : "✕"}</span>
                  <span className="sr-only">
                    {pq.correct ? t("resultsPanel.correct") : t("resultsPanel.incorrect")}
                  </span>{" "}
                  {t("resultsPanel.yourAnswer", { answer: yourAnswerText ?? t("resultsPanel.notAnswered") })}
                </p>
                {!pq.correct && (
                  <p className="text-sm text-muted-foreground">
                    {t("resultsPanel.correctAnswer", { answer: correctAnswerText ?? "—" })}
                  </p>
                )}
                {pq.explanation && <p className="mt-2 text-sm text-muted-foreground">{pq.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <Link href="/certification" className={buttonStyles({ variant: "outline" })}>
        {t("resultsPanel.backToTests")}
      </Link>
    </div>
  );
}
