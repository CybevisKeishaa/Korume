"use client";

import { useMemo } from "react";
import { Link } from "@/lib/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import {
  PILLAR_LABELS,
  SECTION_LABELS,
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
function PillarBar({ pillar }: { pillar: PillarScore }) {
  const pct = pillar.scaleMax === 0 ? 0 : Math.round((pillar.scaledScore / pillar.scaleMax) * 100);
  const minPct = pillar.scaleMax === 0 ? 0 : Math.round((pillar.sectionalMinimum / pillar.scaleMax) * 100);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{PILLAR_LABELS[pillar.pillar]}</span>
        <span className="text-muted-foreground">
          {pillar.scaledScore} / {pillar.scaleMax}{" "}
          {pillar.meetsMinimum ? (
            <span className="text-success">✓ meets minimum</span>
          ) : (
            <span className="text-danger">below minimum</span>
          )}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pillar.scaledScore}
        aria-valuemin={0}
        aria-valuemax={pillar.scaleMax}
        aria-label={`${PILLAR_LABELS[pillar.pillar]} scaled score`}
        className="relative mt-1 h-3 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <div
          aria-hidden="true"
          title={`Sectional minimum: ${pillar.sectionalMinimum}`}
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
  const { result, weakness, perQuestion } = submitResult;
  const questionsById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.totalCorrect} / {result.totalQuestions} correct ({result.totalPercent}%)
        </p>
      </div>

      <section aria-label="Pass estimate" className="rounded-lg border border-border p-5">
        {result.scaledTotal != null && result.pillars ? (
          <>
            <p className="text-sm text-muted-foreground">Estimated scaled score</p>
            <p className="text-3xl font-bold">
              {result.scaledTotal}{" "}
              <span className="text-base font-normal text-muted-foreground">/ {result.scaledTotalMax}</span>
            </p>
            <p className="mt-1 text-sm">
              {result.passed ? (
                <span className="font-medium text-success">Estimated result: Pass</span>
              ) : (
                <span className="font-medium text-danger">Estimated result: Not yet passing</span>
              )}
              <span className="ml-2 text-xs text-muted-foreground">
                (unofficial estimate — not an official JLPT score)
              </span>
            </p>
            <div className="mt-4 space-y-4">
              {result.pillars.map((p) => (
                <PillarBar key={p.pillar} pillar={p} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pass/fail estimate unavailable
            {result.passUnavailableReason ? `: ${result.passUnavailableReason}` : "."}
          </p>
        )}
      </section>

      <section aria-label="Section scores">
        <h2 className="mb-3 text-lg font-semibold">Section scores</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.sections.map((s) => (
            <li key={s.section} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{SECTION_LABELS[s.section]}</p>
              <p className="text-muted-foreground">
                {s.correct} / {s.total} ({s.percent}%)
              </p>
            </li>
          ))}
        </ul>
      </section>

      {weakness.length > 0 && (
        <section aria-label="Weakness breakdown">
          <h2 className="mb-3 text-lg font-semibold">Where to focus</h2>
          <ul className="space-y-2">
            {weakness.map((w) => (
              <li
                key={`${w.section}-${w.questionType}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{w.questionType}</p>
                  <p className="text-muted-foreground">
                    {SECTION_LABELS[w.section]} · {w.correct} / {w.total} correct ({w.percent}%)
                  </p>
                </div>
                <Link
                  href={reviewHrefForSection(w.section, level)}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Suggested review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Question review">
        <h2 className="mb-3 text-lg font-semibold">Question review</h2>
        <ol className="space-y-4">
          {perQuestion.map((pq, i) => {
            const q = questionsById.get(pq.id);
            const yourAnswerValue = answers[pq.id];
            const yourAnswerText =
              q && yourAnswerValue !== undefined ? q.question_data.choices[Number(yourAnswerValue)] : undefined;
            const correctAnswerText = q ? q.question_data.choices[Number(pq.correctAnswer)] : undefined;
            return (
              <li key={pq.id} className="rounded-md border border-border p-4">
                <p className="text-xs text-muted-foreground">Question {i + 1}</p>
                {q && <p className="font-jp mt-1 text-sm">{q.question_data.stem}</p>}
                <p className="mt-2 text-sm">
                  <span aria-hidden="true">{pq.correct ? "✓" : "✕"}</span>
                  <span className="sr-only">{pq.correct ? "Correct." : "Incorrect."}</span>{" "}
                  Your answer: {yourAnswerText ?? "Not answered"}
                </p>
                {!pq.correct && (
                  <p className="text-sm text-muted-foreground">
                    Correct answer: {correctAnswerText ?? "—"}
                  </p>
                )}
                {pq.explanation && <p className="mt-2 text-sm text-muted-foreground">{pq.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <Link href="/jlpt" className={buttonStyles({ variant: "outline" })}>
        Back to JLPT tests
      </Link>
    </div>
  );
}
