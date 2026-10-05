/** The reflection route's body (spec §5.4), shared with the client island. Pure types. */
export interface ReflectionView {
  text: string;
  highlight: { lineId: string; span: string } | null;
  generatedAt: string;
}

export type ReflectionFallbackReason = "no_evidence" | "analysis_unusable" | "unavailable" | "backoff";

export type ReflectionResponse =
  | { state: "ready"; reflection: ReflectionView }
  | { state: "stale"; stale: true; reflection: ReflectionView }
  | { state: "pending"; retryAfterMs: number; reflection: ReflectionView | null }
  | { state: "fallback"; reason: ReflectionFallbackReason; retryAfter?: string }
  | { state: "not_found" };
