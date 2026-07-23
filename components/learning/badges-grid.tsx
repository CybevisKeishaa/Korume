import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { BadgeSummary } from "@/lib/user-stats-types";

export interface BadgesGridProps {
  /** Full badge catalog, earned first then alphabetical (`getUserStats()`'s order). */
  badges: BadgeSummary[];
}

/**
 * Dashboard badges grid (Layer 6). Earned vs unearned is never color-only:
 * unearned badges get a lock icon + a visible "Locked" label plus reduced
 * opacity. Each badge tile is a single `aria-label`-ed unit describing name +
 * state + description, so a screen reader user gets the same information a
 * sighted user gets from the icon/label/date at a glance.
 *
 * Motion (Layer 6, motion-engineer): every earned tile carries
 * `data-celebrate="badge-earned"` and a `.badge-settle` class (see
 * `app/globals.css`) — a one-shot CSS keyframe opacity/scale "pop" on mount,
 * staggered a few ms per tile (capped, so a full grid still settles well
 * under 1s) via an inline `animationDelay`. It never loops (default
 * `animation-iteration-count: 1`) and is a plain CSS keyframe, so it needs no
 * client component and is kill-switched globally by `[data-reduce-motion]` /
 * `prefers-reduced-motion` (collapses `animation-duration`, so earned tiles
 * just appear instantly). Unearned tiles are untouched beyond the existing
 * opacity transition.
 */
export function BadgesGrid({ badges }: BadgesGridProps) {
  const t = useTranslations("dashboard");

  if (badges.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("badges.empty")}</p>;
  }

  // Stagger only counts earned tiles (the ones that animate), and is capped
  // so a large grid still finishes settling in well under 1s.
  const STAGGER_MS = 40;
  const MAX_DELAY_MS = 320;
  let earnedIndex = 0;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {badges.map((badge) => {
        const earned = !!badge.earnedAt;
        const earnedDate = badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : null;
        const label = [
          badge.name,
          earned ? `${t("a11y.badgeEarned")}${earnedDate ? ` ${earnedDate}` : ""}` : t("a11y.badgeLocked"),
          badge.description ?? undefined,
        ]
          .filter(Boolean)
          .join(". ");
        const delayMs = earned ? Math.min(earnedIndex * STAGGER_MS, MAX_DELAY_MS) : 0;
        if (earned) earnedIndex += 1;

        return (
          <li key={badge.id}>
            <div
              role="group"
              aria-label={label}
              data-celebrate={earned ? "badge-earned" : undefined}
              className={cn(
                "flex h-full flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-center transition-opacity",
                earned && "badge-settle",
                !earned && "opacity-50",
              )}
              style={earned ? { animationDelay: `${delayMs}ms` } : undefined}
            >
              <div
                aria-hidden="true"
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold",
                  earned ? "bg-primary/10 text-primary-strong" : "bg-muted text-muted-foreground",
                )}
              >
                {badge.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary badge-icon storage URLs, not a next/image remotePattern domain.
                  <img src={badge.iconUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : earned ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                    <path d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6-4.4-4.1 6-.7L10 1.5z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path
                      fillRule="evenodd"
                      d="M5 8V6a5 5 0 0110 0v2h.5A1.5 1.5 0 0117 9.5v7A1.5 1.5 0 0115.5 18h-11A1.5 1.5 0 013 16.5v-7A1.5 1.5 0 014.5 8H5zm2 0h6V6a3 3 0 10-6 0v2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <p className="text-xs font-medium">{badge.name}</p>
              {earned ? (
                earnedDate && <p className="text-[11px] text-muted-foreground">{earnedDate}</p>
              ) : (
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("badges.locked")}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
