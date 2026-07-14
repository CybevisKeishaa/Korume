/**
 * Client-safe mirror of `lib/data/peer-review.ts`'s shapes (that module is
 * `server-only`) — same JSON returned by `GET /api/peer-review/queue` and
 * `GET /api/peer-review/mine`.
 */
export interface PeerReviewAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface PeerReviewShareListItem {
  id: string;
  sessionId: string;
  lineText: string;
  note: string | null;
  createdAt: string;
  sharedBy: PeerReviewAuthor | null;
  reviewCount: number;
  alreadyReviewed: boolean;
}

export interface PeerReviewQueuePage {
  shares: PeerReviewShareListItem[];
  nextCursor: string | null;
}

export interface PeerReviewReceived {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: PeerReviewAuthor | null;
}

export interface MyShareWithReviews {
  id: string;
  sessionId: string;
  lineText: string;
  note: string | null;
  createdAt: string;
  reviews: PeerReviewReceived[];
}
