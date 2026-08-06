"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ReadingAnswerValue,
  ReadingPerQuestionResult,
  ReadingQuestionPublic,
  ReadingQuizResult,
} from "@/lib/reading-types";

export interface ReadingQuizProps {
  passageId: string;
  questions: ReadingQuestionPublic[];
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "done"; result: ReadingQuizResult; perQuestion: ReadingPerQuestionResult[] };

const ANSWER_VALUES: ReadingAnswerValue[] = ["0", "1", "2", "3"];

/**
 * `res`'s body may carry a server-authored `error` string (e.g. `submit/route.ts`'s
 * "Invalid submission" / "Unauthorized" / "Not found") — an untranslated
 * developer diagnostic, never meant for the learner-facing DOM (CLAUDE.md §5,
 * standing convention #4, mirroring `vocab-examples-panel.tsx`'s
 * `classifyError`). It is logged for support/debugging; the caller always
 * gets back the translated `fallback` instead.
 */
async function friendlyErrorFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) console.error(`reading quiz submit failed (${res.status})`, body.error);
  } catch {
    console.error(`reading quiz submit failed (${res.status})`);
  }
  return fallback;
}

/**
 * Comprehension quiz below a reading passage: one native radiogroup per
 * question (native `<fieldset>`/radio inputs give arrow-key navigation and
 * screen-reader semantics for free — CLAUDE.md §5), "Submit answers" posts to
 * `POST /api/reading/[id]/submit`, and results render per-question with the
 * correct answer + an explanation (arrives from the API — may be in the
 * passage's content language). Never relies on color alone: each result is
 * also labeled "Correct"/"Incorrect" in text.
 */
export function ReadingQuiz({ passageId, questions }: ReadingQuizProps) {
  const t = useTranslations("reading");
  // errors.network is consumed from `common` (promoted in Task 11b) — the
  // identical string is needed by multiple modules (P4), so it lives in
  // `common.errors.network`, not duplicated here.
  const tCommon = useTranslations("common");
  const [answers, setAnswers] = useState<Record<string, ReadingAnswerValue>>({});
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const answeredCount = Object.keys(answers).length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "submitting") return;
    setState({ status: "submitting" });
    try {
      const res = await fetch(`/api/reading/${passageId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          setState({
            status: "error",
            message: retryAfter
              ? t("quiz.errorRateLimitWithSeconds", { seconds: retryAfter })
              : t("quiz.errorRateLimit"),
          });
          return;
        }
        setState({
          status: "error",
          message: await friendlyErrorFrom(res, t("quiz.errorSubmitFallback")),
        });
        return;
      }
      const json = (await res.json()) as {
        data: { result: ReadingQuizResult; perQuestion: ReadingPerQuestionResult[] };
      };
      setState({ status: "done", result: json.data.result, perQuestion: json.data.perQuestion });
    } catch {
      setState({
        status: "error",
        message: tCommon("errors.network"),
      });
    }
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("quiz.noQuestions")}</p>;
  }

  const resultById =
    state.status === "done" ? new Map(state.perQuestion.map((p) => [p.id, p])) : null;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question, qIndex) => {
          const result = resultById?.get(question.id) ?? null;
          return (
            <fieldset key={question.id} className="space-y-2 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                {t("quiz.questionLabel", { index: qIndex + 1 })} {question.question}
              </legend>
              <div
                role="radiogroup"
                aria-label={t("quiz.questionAriaLabel", { index: qIndex + 1 })}
                className="space-y-1.5"
              >
                {question.options.map((option, optionIndex) => {
                  // `options` is always exactly 4 entries per the API contract
                  // (`ReadingQuestionPublic.options: string[4]`); the `?? "0"`
                  // only satisfies `noUncheckedIndexedAccess`, never actually hit.
                  const value = ANSWER_VALUES[optionIndex] ?? "0";
                  const inputId = `${question.id}-${value}`;
                  const isCorrectChoice = result && result.correctAnswer === value;
                  return (
                    <label
                      key={value}
                      htmlFor={inputId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:bg-secondary",
                        result && isCorrectChoice && "border-success bg-success/10",
                      )}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={question.id}
                        value={value}
                        checked={answers[question.id] === value}
                        onChange={() =>
                          setAnswers((prev) => {
                            const next: Record<string, ReadingAnswerValue> = { ...prev };
                            next[question.id] = value;
                            return next;
                          })
                        }
                        disabled={state.status === "submitting" || state.status === "done"}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="font-jp">{option}</span>
                      {result && isCorrectChoice && (
                        <span className="text-xs font-medium text-success-strong">
                          {t("quiz.correctAnswerBadge")}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {result && (
                <p
                  className={cn(
                    "text-sm font-medium",
                    result.correct ? "text-success-strong" : "text-danger-strong",
                  )}
                >
                  {result.correct ? t("quiz.correct") : t("quiz.incorrect")}
                  {result.explanation && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      — {result.explanation}
                    </span>
                  )}
                </p>
              )}
            </fieldset>
          );
        })}

        {state.status !== "done" && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={state.status === "submitting"}>
              {state.status === "submitting" ? t("quiz.submitting") : t("quiz.submit")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("quiz.answeredCount", { answered: answeredCount, total: questions.length })}
            </p>
          </div>
        )}
      </form>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger-strong">
          {state.message}
        </p>
      )}

      <div aria-live="polite">
        {state.status === "done" && (
          <p className="text-lg font-semibold">
            {t("quiz.resultSummary", {
              correct: state.result.correct,
              total: state.result.total,
              percent: state.result.percent,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
