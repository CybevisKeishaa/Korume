import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { BadgeSummary } from "@/lib/user-stats-types";

export interface BadgesGridProps {
  /** Full badge catalog, earned first then alphabetical (`getUserStats()`'s order). */
  badges: BadgeSummary[];
}

/**
 * `icon_url` values are only ever written by the `badge_icons` migration
 * (`/badges/<snake_case_name>.svg`), but the value still crosses a DB read
 * and lands in a CSS `url(...)` below — so it is guarded against anything
 * that isn't that exact shape rather than trusted. A non-matching value
 * (including anything injection-shaped) falls back to the default icons
 * instead of reaching the mask.
 */
const ICON_URL_PATTERN = /^\/badges\/[a-z0-9_]+\.svg$/;

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
                {badge.iconUrl && ICON_URL_PATTERN.test(badge.iconUrl) ? (
                  // A CSS mask, not an <img src>: an SVG loaded via <img> is
                  // an isolated document, so currentColor inside it can
                  // never resolve against this page — it would render as a
                  // flat black icon regardless of earned/locked state. A
                  // mask paints with this element's own background-color
                  // (currentColor), so the existing earned/locked colour
                  // distinction (bg-primary/10 text-primary-strong vs
                  // bg-muted text-muted-foreground on the wrapper above)
                  // carries through to the icon exactly as it does for the
                  // two inline fallback SVGs below.
                  <span
                    data-testid="badge-icon-mask"
                    className="h-6 w-6 bg-current"
                    style={{
                      maskImage: `url(${badge.iconUrl})`,
                      WebkitMaskImage: `url(${badge.iconUrl})`,
                      maskSize: "contain",
                      WebkitMaskSize: "contain",
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskPosition: "center",
                    }}
                  />
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
              <p className="text-caption font-medium">{badge.name}</p>
              {earned ? (
                earnedDate && <p className="text-caption text-muted-foreground">{earnedDate}</p>
              ) : (
                <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
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
