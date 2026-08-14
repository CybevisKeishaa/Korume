import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import type { JlptAttemptRow, JlptLevel } from "@/lib/jlpt-ui";

export interface JlptAttemptListProps {
  attempts: JlptAttemptRow[];
  testsById: Record<string, { title: string; level: JlptLevel }>;
}

/**
 * Score history for the current user (spec §5.7): title, mode/section, date,
 * score. A non-async Server Component — `useTranslations` from `@/lib/i18n`
 * works here without `"use client"` (same precedent as
 * `components/learning/recommendation-rail.tsx`, confirmed by a real build
 * in Task 5), which also keeps this RTL-renderable.
 */
export function JlptAttemptList({ attempts, testsById }: JlptAttemptListProps) {
  const t = useTranslations("jlpt");

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("attemptList.empty")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {attempts.map((attempt) => {
        const test = testsById[attempt.test_id];
        return (
          <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <Link href={`/certification/${attempt.test_id}`} className="hover:underline">
              <p className="font-jp font-medium">
                {test?.title ?? t("attemptList.unknownTest")}
                {test && <span className="ml-2 text-xs text-muted-foreground">{test.level}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {attempt.mode === "full"
                  ? t("attemptList.fullMock")
                  : t("attemptList.sectionLabel", {
                      section: attempt.section ? t(`sections.${attempt.section}`) : "—",
                    })}{" "}
                · {new Date(attempt.completed_at ?? attempt.started_at).toLocaleDateString()}
              </p>
            </Link>
            <span className="shrink-0 font-semibold">
              {attempt.score == null
                ? "—"
                : attempt.mode === "full"
                  ? `${attempt.score} / 180`
                  : `${attempt.score}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
