"use client";

import { useId, useState } from "react";

export interface LeaderboardOptInToggleProps {
  initialOptIn: boolean;
  /** Called after a successful PATCH with the new opt-in state, so the parent can refresh the ranked list. */
  onChanged: (optIn: boolean) => void;
  className?: string;
}

/**
 * G2 (docs/product/business-model.md §1.1): the leaderboard is opt-in only —
 * this toggle is the explicit, revocable consent to appear in it, with the
 * consequence stated plainly rather than buried.
 */
export function LeaderboardOptInToggle({ initialOptIn, onChanged, className }: LeaderboardOptInToggleProps) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function toggle(): Promise<void> {
    const next = !optIn;
    setOptIn(next);
    setError(null);
    try {
      const res = await fetch("/api/user/leaderboard-opt-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: next }),
      });
      if (res.ok) {
        onChanged(next);
        return;
      }
      setOptIn(!next);
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setError(retryAfter ? `Too many requests — try again in ${retryAfter}s.` : "Too many requests — please wait a moment.");
        return;
      }
      setError("Couldn't update that — please try again.");
    } catch {
      setOptIn(!next);
      setError("Network error — check your connection and try again.");
    }
  }

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <input
          id={inputId}
          type="checkbox"
          checked={optIn}
          onChange={() => void toggle()}
          aria-label="Appear on the leaderboard"
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <label htmlFor={inputId} className="text-sm">
          <span className="font-medium">Appear on the leaderboard?</span>
          <span className="block text-xs text-muted-foreground">
            Your name and weekly XP will be visible to other users.
          </span>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
