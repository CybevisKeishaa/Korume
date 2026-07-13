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
 * Motion hook: the bar fill has `data-celebrate="level-progress"` for the
 * motion-engineer to attach a fill transition/celebration pulse to; this
 * component itself only ships a plain CSS `transition-[width]` (kill-switched
 * globally via `[data-reduce-motion]` / `prefers-reduced-motion` in globals.css).
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
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${percent}%` }}
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
