import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StreakCardProps {
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string | null;
  /** VN-local 'yyyy-MM-dd' for "today", injected by the caller (`vnDateString(new Date())`
   * server-side) so this component stays pure/deterministic and testable. */
  today: string;
}

/**
 * Dashboard streak widget (Layer 6). Per product principle G3
 * (docs/product/business-model.md §1.1), notifications/UI never use
 * FOMO/guilt framing — a streak that hasn't been extended today is shown
 * neutrally ("Keep it going today"), never as a warning that it's about to
 * be lost.
 */
export function StreakCard({ streakCurrent, streakLongest, lastActiveDate, today }: StreakCardProps) {
  const activeToday = lastActiveDate === today;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Streak</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-bold">
          {streakCurrent} <span className="text-base font-normal text-muted-foreground">day streak</span>
        </p>
        <p className="text-sm text-muted-foreground">Longest: {streakLongest} days</p>
        {!activeToday && (
          <p className="text-sm text-muted-foreground">Keep it going today — study one item to extend it.</p>
        )}
      </CardContent>
    </Card>
  );
}
