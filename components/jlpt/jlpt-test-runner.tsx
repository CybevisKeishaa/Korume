"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import {
  isAnswerValue,
  parseSectionConfig,
  totalMinutes,
  type JlptSection,
  type JlptSubmitResult,
  type JlptTestDetail,
} from "@/lib/jlpt-ui";
import { JlptPreStartPanel } from "./jlpt-pre-start-panel";
import { JlptTimer } from "./jlpt-timer";
import { JlptQuestionNavigator } from "./jlpt-question-navigator";
import { JlptQuestionCard } from "./jlpt-question-card";
import { JlptResultsPanel } from "./jlpt-results-panel";

export interface JlptTestRunnerProps {
  test: JlptTestDetail;
  /** From `?section=` — present means a section-practice attempt; absent means the full mock. */
  initialSection?: JlptSection;
}

type Phase = "pre-start" | "in-progress" | "submitting" | "results";
type Answers = Record<string, string>;

/**
 * No time limit is configured for this attempt (malformed/missing
 * `section_config` data) — fall back to a generous cap rather than an
 * instantly-expiring 0-minute timer.
 */
const FALLBACK_MINUTES = 999;

/**
 * Orchestrates one JLPT attempt end to end (spec §5.7): pre-start info →
 * timed question-by-question run → submit → results, all in component
 * state (no localStorage persistence, per task scope).
 *
 * Timer convention: full mode counts down the SUM of every section's
 * `time_limit_minutes` in one continuous countdown (no per-section phase
 * transitions); section mode counts down just that section's limit.
 */
export function JlptTestRunner({ test, initialSection }: JlptTestRunnerProps) {
  const t = useTranslations("jlpt");
  const tCommon = useTranslations("common");
  const mode: "full" | "section" = initialSection ? "section" : "full";
  const sectionEntries = useMemo(() => parseSectionConfig(test.section_config), [test.section_config]);
  const questions = useMemo(
    () => (mode === "section" ? test.questions.filter((q) => q.section === initialSection) : test.questions),
    [test.questions, mode, initialSection],
  );
  const durationMinutes = useMemo(() => {
    const minutes =
      mode === "full"
        ? totalMinutes(sectionEntries)
        : (sectionEntries.find((s) => s.section === initialSection)?.time_limit_minutes ?? 0);
    return minutes > 0 ? minutes : FALLBACK_MINUTES;
  }, [mode, sectionEntries, initialSection]);

  const [phase, setPhase] = useState<Phase>("pre-start");
  const [answers, setAnswers] = useState<Answers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<JlptSubmitResult | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const submittingRef = useRef(false);

  const current = questions[currentIndex];
  const answeredIndexes = useMemo(
    () => new Set(questions.map((q, i) => (answers[q.id] !== undefined ? i : -1)).filter((i) => i >= 0)),
    [questions, answers],
  );

  function handleStart() {
    const now = new Date();
    setStartedAt(now.toISOString());
    setDeadline(now.getTime() + durationMinutes * 60_000);
    setCurrentIndex(0);
    setAnswers({});
    setSubmitError(null);
    setConfirmingSubmit(false);
    setPhase("in-progress");
  }

  function handleSelect(value: string) {
    if (!current || !isAnswerValue(value)) return;
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  }

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("submitting");
    setSubmitError(null);
    try {
      const res = await fetch(`/api/jlpt/tests/${test.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          mode,
          ...(mode === "section" ? { section: initialSection } : {}),
          ...(startedAt ? { started_at: startedAt } : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as { data?: JlptSubmitResult; error?: string } | null;
      if (!res.ok || !json?.data) {
        setSubmitError(json?.error ?? t("testRunner.submitFailedGeneric"));
        setPhase("in-progress");
        return;
      }
      setSubmitResult(json.data);
      setPhase("results");
    } catch {
      // Byte-identical to the pre-extraction source — reused from `common`
      // rather than duplicated (CLAUDE.md §6 P4); see `common.errors.network`.
      setSubmitError(tCommon("errors.network"));
      setPhase("in-progress");
    } finally {
      submittingRef.current = false;
    }
    // `t`/`tCommon` intentionally omitted below (stable for the component's lifetime; see the same
    // note in jlpt-timer.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, mode, initialSection, startedAt, test.id]);

  const handleExpire = useCallback(() => {
    void submit();
  }, [submit]);

  function handleSubmitClick() {
    const unanswered = questions.length - answeredIndexes.size;
    if (unanswered > 0 && !confirmingSubmit) {
      setConfirmingSubmit(true);
      return;
    }
    setConfirmingSubmit(false);
    void submit();
  }

  if (questions.length === 0) {
    return <p className="text-muted-foreground">{t("testRunner.noQuestions")}</p>;
  }

  if (phase === "pre-start") {
    return (
      <JlptPreStartPanel
        title={test.title}
        level={test.level}
        mode={mode}
        section={initialSection}
        questionCount={questions.length}
        durationMinutes={durationMinutes}
        onStart={handleStart}
      />
    );
  }

  if (phase === "results" && submitResult) {
    return (
      <JlptResultsPanel submitResult={submitResult} questions={questions} answers={answers} level={test.level} />
    );
  }

  const unansweredCount = questions.length - answeredIndexes.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-jp text-xl font-bold">{test.title}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "full"
              ? t("testRunner.fullMockTest")
              : t("testRunner.sectionPractice", { section: initialSection ? t(`sections.${initialSection}`) : "" })}
          </p>
        </div>
        {deadline !== null && <JlptTimer deadline={deadline} onExpire={handleExpire} />}
      </div>

      <JlptQuestionNavigator
        count={questions.length}
        currentIndex={currentIndex}
        answeredIndexes={answeredIndexes}
        onSelect={setCurrentIndex}
      />

      {current && (
        <JlptQuestionCard
          key={current.id}
          question={current}
          index={currentIndex}
          total={questions.length}
          selected={answers[current.id]}
          onSelect={handleSelect}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            {t("testRunner.previous")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIndex === questions.length - 1}
          >
            {tCommon("actions.next")}
          </Button>
        </div>
        <Button type="button" onClick={handleSubmitClick} disabled={phase === "submitting"}>
          {phase === "submitting" ? t("testRunner.submitting") : t("testRunner.submitTest")}
        </Button>
      </div>

      {confirmingSubmit && (
        <p role="alert" className="text-sm text-danger-strong">
          {t("testRunner.confirmSubmit", { count: unansweredCount })}
        </p>
      )}
      {submitError && (
        <p role="alert" className="text-sm text-danger-strong">
          {submitError}
        </p>
      )}
    </div>
  );
}
