import { Link } from "@/lib/i18n/navigation";
import type { HubRailProjection } from "@/lib/data/shadowing-hub";

export interface HubCompanionRailLabels {
  preparation: string;
  noPreparation: string;
  todayGoal: string;
  noGoal: string;
  weeklyProgress: string;
  noWeeklyActivity: string;
  streak: string;
  reviewsDue: (count: number) => string;
  suggestion: string;
  noSuggestion: string;
  openLesson: string;
  knownWordFit: (percent: number) => string;
}

export interface HubCompanionRailProps {
  rail: HubRailProjection | null;
  labels: HubCompanionRailLabels;
}

/**
 * Desktop-only supplementary continuity rail. The page shell supplies the
 * complementary landmark; each card here is a labelled region so its factual
 * state remains comprehensible to assistive technology.
 *
 * This is intentionally not a Companion anchor: the non-empty Shadowing Hub
 * has no approved Companion presence yet. It is a truthful study summary.
 */
export function HubCompanionRail({ rail, labels }: HubCompanionRailProps) {
  const suggestion = rail?.suggestion ?? null;
  const suggestionDetail =
    suggestion?.reason.kind === "known-word-fit"
      ? labels.knownWordFit(Math.round(suggestion.reason.knownRatio * 100))
      : null;

  return (
    <div className="space-y-md-lg">
      <section aria-label={labels.preparation} className="rounded-xl border border-border bg-card p-md-lg">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.preparation}</h2>
        <p className="mt-sm text-sm text-muted-foreground">{labels.noPreparation}</p>
      </section>

      <section aria-label={labels.todayGoal} className="rounded-xl border border-border bg-card p-md-lg">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.todayGoal}</h2>
        <p className="mt-sm text-sm text-muted-foreground">{labels.noGoal}</p>
      </section>

      <section aria-label={labels.weeklyProgress} className="rounded-xl border border-border bg-card p-md-lg">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.weeklyProgress}</h2>
        <p className="mt-sm text-sm text-muted-foreground">{labels.noWeeklyActivity}</p>
        {rail ? (
          <dl className="mt-md grid grid-cols-2 gap-md border-t border-border pt-md">
            <div>
              <dt className="text-caption text-muted-foreground">{labels.streak}</dt>
              <dd className="mt-2xs text-body font-semibold text-foreground">{rail.stats.streakCurrent}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">{labels.reviewsDue(rail.stats.srsDueCount)}</dt>
              <dd className="mt-2xs text-body font-semibold text-foreground">{rail.stats.srsDueCount}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section aria-label={labels.suggestion} className="rounded-xl border border-border bg-card p-md-lg">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.suggestion}</h2>
        {suggestion && suggestionDetail ? (
          <div className="mt-sm">
            <p className="text-sm text-muted-foreground">{suggestionDetail}</p>
            <p className="mt-xs text-body font-semibold text-foreground">{suggestion.lesson.title}</p>
            <Link
              href={`/shadowing/${suggestion.lesson.id}`}
              aria-label={`${labels.openLesson}: ${suggestion.lesson.title}`}
              className="mt-md inline-flex text-sm font-semibold text-primary-strong hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {labels.openLesson}
            </Link>
          </div>
        ) : (
          <p className="mt-sm text-sm text-muted-foreground">{labels.noSuggestion}</p>
        )}
      </section>
    </div>
  );
}
