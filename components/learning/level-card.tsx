import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LevelInfo } from "@/lib/gamification";

export interface LevelCardProps {
  xp: number;
  level: LevelInfo;
}

/**
 * Dashboard level/XP widget (Layer 6). The progress bar is a real
 * `role="progressbar"` with numeric `aria-value*` attributes AND a visible
 * percentage/xp-remaining text — progress is never conveyed by bar width or
 * color alone (CLAUDE.md §5/§9).
 *
 * Motion (Layer 6, motion-engineer): the fill's `.level-fill` class (see
 * `app/globals.css`) plays a one-shot CSS keyframe from 0% to `--level-target`
 * on mount (≤600ms, ease-out) — a plain CSS `@keyframes`, so it needs no
 * client component here and is kill-switched globally by
 * `[data-reduce-motion]` / `prefers-reduced-motion` (collapses
 * `animation-duration`, so the bar renders at final width effectively
 * instantly). `transition-[width]` still smooths any later width change
 * (e.g. a re-render with new XP) after the mount animation settles.
 */
export function LevelCard({ xp, level }: LevelCardProps) {
  const percent = Math.round(level.progressRatio * 100);
  const xpToNext = Math.max(0, level.nextLevelXp - xp);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Level {level.level}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{xp.toLocaleString()} XP</p>

        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to level ${level.level + 1}`}
          data-celebrate="level-progress"
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="level-fill h-full rounded-full bg-primary transition-[width] duration-300"
            style={
              {
                width: `${percent}%`,
                "--level-target": `${percent}%`,
              } as React.CSSProperties
            }
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {percent}%
          {level.nextLevelXp > level.levelFloorXp
            ? ` · ${xpToNext} XP to level ${level.level + 1}`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}
