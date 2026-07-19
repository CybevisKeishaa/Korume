"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LeaderboardOptInToggle } from "./leaderboard-opt-in-toggle";
import type { LeaderboardPage } from "@/lib/leaderboard-types";

export interface LeaderboardBoardProps {
  initialPage: LeaderboardPage;
  initialOptIn: boolean;
  className?: string;
}

/**
 * Weekly XP leaderboard (G2, docs/product/business-model.md §1.1): leads
 * with "Your week" — the caller's own progress, always shown regardless of
 * opt-in status — before the opt-in-only community top-20. Order matters per
 * product decision: this is a progress screen first, a ranking second.
 */
export function LeaderboardBoard({ initialPage, initialOptIn, className }: LeaderboardBoardProps) {
  const [page, setPage] = useState(initialPage);
  const [optIn, setOptIn] = useState(initialOptIn);

  async function handleOptInChanged(nextOptIn: boolean): Promise<void> {
    setOptIn(nextOptIn);
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) return;
      const json = (await res.json()) as { data: LeaderboardPage };
      setPage(json.data);
    } catch {
      // Keep the current page — the opt-in state itself already updated locally.
    }
  }

  return (
    <div className={className}>
      <section aria-labelledby="your-week-heading" className="rounded-lg border border-border bg-card p-4">
        <h2 id="your-week-heading" className="text-lg font-semibold">
          Your week
        </h2>
        <p className="mt-2 text-3xl font-bold">
          {page.callerWeeklyXp} <span className="text-base font-normal text-muted-foreground">XP this week</span>
        </p>
        {page.callerWeeklyXp === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Study something this week to start earning XP.
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {page.callerRank !== null ? `Rank ${page.callerRank}` : "Opt in to see your rank among other learners."}
        </p>

        <div className="mt-4 border-t border-border pt-4">
          <LeaderboardOptInToggle initialOptIn={optIn} onChanged={handleOptInChanged} />
        </div>
      </section>

      <section aria-labelledby="community-heading" className="mt-6">
        <h2 id="community-heading" className="mb-3 text-lg font-semibold">
          This week&apos;s top learners
        </h2>
        {page.leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has opted in yet — opt in above to be the first to appear.
          </p>
        ) : (
          <ol className="space-y-2">
            {page.leaderboard.map((entry) => (
              <li
                key={entry.rank}
                aria-current={entry.isMe ? "true" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3 text-sm",
                  entry.isMe ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-semibold text-muted-foreground">{entry.rank}</span>
                  <span className="font-medium">
                    {entry.name ?? "Deleted user"}
                    {entry.isMe && <span className="ml-1 text-xs text-primary-strong">(you)</span>}
                  </span>
                </span>
                <span className="font-semibold">{entry.weeklyXp} XP</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
