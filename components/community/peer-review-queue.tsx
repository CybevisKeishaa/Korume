"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "./relative-time";
import type { PeerReviewQueuePage, PeerReviewShareListItem } from "@/lib/peer-review-types";

export interface PeerReviewQueueProps {
  initialPage: PeerReviewQueuePage;
  className?: string;
}

type AudioState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

type ReviewState = { status: "idle" | "submitting" } | { status: "error"; message: string };

const RATINGS = [1, 2, 3, 4, 5];

function friendlyRateLimit(retryAfter: string | null): string {
  return retryAfter
    ? `Too many requests — try again in ${retryAfter}s.`
    : "Too many requests — please wait a moment and try again.";
}

function ShareRow({ share, onReviewed }: { share: PeerReviewShareListItem; onReviewed: (shareId: string) => void }) {
  const [audio, setAudio] = useState<AudioState>({ status: "idle" });
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>({ status: "idle" });
  const commentId = useId();
  const groupId = useId();

  async function loadAudio(): Promise<void> {
    setAudio({ status: "loading" });
    try {
      const res = await fetch(`/api/peer-review/shares/${share.id}/audio`);
      if (res.status === 429) {
        setAudio({ status: "error", message: friendlyRateLimit(res.headers.get("Retry-After")) });
        return;
      }
      if (!res.ok) {
        setAudio({ status: "error", message: "Couldn't load this recording — please try again." });
        return;
      }
      const json = (await res.json()) as { data: { signedUrl: string; expiresInSeconds: number } };
      setAudio({ status: "ready", url: json.data.signedUrl });
    } catch {
      setAudio({ status: "error", message: "Network error — check your connection and try again." });
    }
  }

  async function submitReview(): Promise<void> {
    if (!rating || !comment.trim() || reviewState.status === "submitting") return;
    setReviewState({ status: "submitting" });
    try {
      const res = await fetch(`/api/peer-review/shares/${share.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (res.status === 201) {
        setReviewState({ status: "idle" });
        onReviewed(share.id);
        return;
      }
      if (res.status === 429) {
        setReviewState({ status: "error", message: friendlyRateLimit(res.headers.get("Retry-After")) });
        return;
      }
      if (res.status === 409) {
        setReviewState({ status: "idle" });
        onReviewed(share.id);
        return;
      }
      if (res.status === 403) {
        setReviewState({ status: "error", message: "You cannot review your own share." });
        return;
      }
      setReviewState({ status: "error", message: "Couldn't submit your review — please try again." });
    } catch {
      setReviewState({ status: "error", message: "Network error — check your connection and try again." });
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <p className="font-jp text-lg" lang="ja">
        {share.lineText}
      </p>
      {share.note && <p className="mt-1 text-sm text-muted-foreground">{share.note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <span>{share.sharedBy?.name ?? "Deleted user"}</span>
        <span aria-hidden="true">·</span>
        <RelativeTime dateTime={share.createdAt} />
        <span aria-hidden="true">·</span>
        <span>
          {share.reviewCount} {share.reviewCount === 1 ? "review" : "reviews"}
        </span>
      </div>

      <div className="mt-3">
        {audio.status === "ready" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- another user's short shadowing clip, no captions to add
          <audio
            controls
            src={audio.url}
            aria-label={`${share.sharedBy?.name ?? "This user"}'s recording`}
            onError={() => setAudio({ status: "error", message: "That link expired — try listening again." })}
            className="w-full"
          />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAudio()} disabled={audio.status === "loading"}>
            {audio.status === "loading" ? "Loading…" : "Listen"}
          </Button>
        )}
        <div aria-live="polite">
          {audio.status === "error" && (
            <p role="alert" className="mt-1 text-xs text-danger-strong">
              {audio.message}
            </p>
          )}
        </div>
      </div>

      {share.alreadyReviewed ? (
        <p className="mt-3 text-sm text-success-strong">You&apos;ve already reviewed this recording.</p>
      ) : (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <fieldset>
            <legend className="text-sm font-medium">Rating</legend>
            <div role="radiogroup" aria-label="Rating" id={groupId} className="mt-1 flex gap-2">
              {RATINGS.map((value) => (
                <label
                  key={value}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-input text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
                >
                  <input
                    type="radio"
                    name={`rating-${share.id}`}
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    className="sr-only"
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={commentId} className="text-sm font-medium">
              Comment
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => void submitReview()}
            disabled={!rating || !comment.trim() || reviewState.status === "submitting"}
          >
            {reviewState.status === "submitting" ? "Submitting…" : "Submit review"}
          </Button>
          {reviewState.status === "error" && (
            <p role="alert" className="text-sm text-danger-strong">
              {reviewState.message}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Shadowing peer-review queue: other users' shared recordings, each with a
 * "Listen" control that mints a fresh 5-minute signed URL on demand (never
 * cached — CLAUDE.md §2 recordings are private-by-default, the share row is
 * the only consent), and a 1-5 star rating + comment form.
 */
export function PeerReviewQueue({ initialPage, className }: PeerReviewQueueProps) {
  const [shares, setShares] = useState<PeerReviewShareListItem[]>(initialPage.shares);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function markReviewed(shareId: string): void {
    setShares((prev) =>
      prev.map((s) => (s.id === shareId ? { ...s, alreadyReviewed: true, reviewCount: s.reviewCount + 1 } : s)),
    );
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      const res = await fetch(`/api/peer-review/queue?${params.toString()}`);
      if (!res.ok) {
        setError("Couldn't load more — please try again.");
        return;
      }
      const json = (await res.json()) as { data: PeerReviewQueuePage };
      setShares((prev) => [...prev, ...json.data.shares]);
      setNextCursor(json.data.nextCursor);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      {shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to review right now — check back later.</p>
      ) : (
        <ul className="space-y-4">
          {shares.map((share) => (
            <ShareRow key={share.id} share={share} onReviewed={markReviewed} />
          ))}
        </ul>
      )}

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger-strong">
            {error}
          </p>
        )}
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
