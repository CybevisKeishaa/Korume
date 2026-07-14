"use client";

import { useState } from "react";
import { ConfirmButton } from "./confirm-button";
import { RelativeTime } from "./relative-time";
import type { MyShareWithReviews } from "@/lib/peer-review-types";

export interface PeerReviewMineProps {
  shares: MyShareWithReviews[];
  className?: string;
}

/**
 * The caller's own shared recordings plus reviews received on each, with a
 * "Revoke" control (CLAUDE.md §2: recordings are private by default; a share
 * is explicit, revocable consent). Revoking deletes the reviews too — the
 * confirm copy says so up front.
 */
export function PeerReviewMine({ shares: initialShares, className }: PeerReviewMineProps) {
  const [shares, setShares] = useState(initialShares);
  const [error, setError] = useState<string | null>(null);

  async function revoke(shareId: string): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`/api/peer-review/shares/${shareId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
        return;
      }
      setError("Couldn't revoke that share — please try again.");
    } catch {
      setError("Network error — check your connection and try again.");
    }
  }

  if (shares.length === 0) {
    return (
      <p className={className ?? "text-sm text-muted-foreground"}>
        You haven&apos;t shared any recordings for peer feedback yet.
      </p>
    );
  }

  return (
    <div className={className}>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <ul className="space-y-4">
        {shares.map((share) => (
          <li key={share.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-jp text-lg" lang="ja">
                {share.lineText}
              </p>
              <ConfirmButton
                label="Revoke"
                confirmLabel="Revoke this share? This deletes the reviews too, and can't be undone."
                onConfirm={() => void revoke(share.id)}
              />
            </div>
            {share.note && <p className="mt-1 text-sm text-muted-foreground">{share.note}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              Shared <RelativeTime dateTime={share.createdAt} />
            </p>

            <div className="mt-3 border-t border-border pt-3">
              {share.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <ul className="space-y-2">
                  {share.reviews.map((review) => (
                    <li key={review.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                        <span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                        <span>{review.reviewer?.name ?? "Deleted user"}</span>
                        <span aria-hidden="true">·</span>
                        <RelativeTime dateTime={review.createdAt} />
                      </div>
                      <p className="mt-0.5 text-foreground">{review.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
