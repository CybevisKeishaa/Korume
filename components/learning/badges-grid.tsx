import { cn } from "@/lib/utils";
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
 * Motion hook: a freshly-earned badge (or one within the celebration window)
 * can be flagged by the caller via `className` on the tile — the tile itself
 * exposes `data-celebrate="badge-earned"` on every earned tile for the
 * motion-engineer to key a one-shot celebration animation off of (e.g. only
 * animate the most-recently-earned one). No animation ships here beyond a
 * plain CSS opacity transition, kill-switched by `[data-reduce-motion]`.
 */
export function BadgesGrid({ badges }: BadgesGridProps) {
  if (badges.length === 0) {
    return <p className="text-sm text-muted-foreground">No badges in the catalog yet.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {badges.map((badge) => {
        const earned = !!badge.earnedAt;
        const earnedDate = badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : null;
        const label = [
          badge.name,
          earned ? `earned${earnedDate ? ` ${earnedDate}` : ""}` : "locked",
          badge.description ?? undefined,
        ]
          .filter(Boolean)
          .join(". ");

        return (
          <li key={badge.id}>
            <div
              role="group"
              aria-label={label}
              data-celebrate={earned ? "badge-earned" : undefined}
              className={cn(
                "flex h-full flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-center transition-opacity",
                !earned && "opacity-50",
              )}
            >
              <div
                aria-hidden="true"
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold",
                  earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
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
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Locked</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
