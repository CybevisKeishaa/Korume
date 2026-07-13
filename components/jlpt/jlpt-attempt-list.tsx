import Link from "next/link";
import { SECTION_LABELS, type JlptAttemptRow, type JlptLevel } from "@/lib/jlpt-ui";

export interface JlptAttemptListProps {
  attempts: JlptAttemptRow[];
  testsById: Record<string, { title: string; level: JlptLevel }>;
}

/** Score history for the current user (spec §5.7): title, mode/section, date, score. */
export function JlptAttemptList({ attempts, testsById }: JlptAttemptListProps) {
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No attempts yet — take a test above to see your score history here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {attempts.map((attempt) => {
        const test = testsById[attempt.test_id];
        return (
          <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <Link href={`/jlpt/${attempt.test_id}`} className="hover:underline">
              <p className="font-jp font-medium">
                {test?.title ?? "Unknown test"}
                {test && <span className="ml-2 text-xs text-muted-foreground">{test.level}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {attempt.mode === "full"
                  ? "Full mock"
                  : `Section: ${attempt.section ? SECTION_LABELS[attempt.section] : "—"}`}{" "}
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
