import { SCREEN_REGISTRY } from "@/lib/product/screen-registry";
import type { ScreenEntry } from "@/lib/product/screen-registry-types";

/** The SRS decks a learner can review, keyed like `review_due_keys` (port-dashboard D12). */
export type ReviewDeck = "mining" | "kanji" | "vocab";
export interface ReviewSurface { deck: ReviewDeck; reviewHref: "/mining/review" | "/kanji/review" | "/vocab/review" }
export interface DeckSummary { deck: ReviewDeck; due: number; lastReviewedAt: string | null }

// Registry order: the tie-break after recency is mining before kanji (D12).
const REVIEW_SURFACES: readonly ReviewSurface[] = [
  { deck: "mining", reviewHref: "/mining/review" },
  { deck: "kanji", reviewHref: "/kanji/review" },
  { deck: "vocab", reviewHref: "/vocab/review" },
];
const NEW_LEARNER_HREF = "/kanji/review";

/** The one review-surface registry (D12): a deck is exposed while its screen is in the nav (vocab is hidden by A10).
 * Quick Access, the due aggregate and the mission candidates all read this. */
export function exposedReviewSurfaces(registry: readonly ScreenEntry[] = SCREEN_REGISTRY): ReviewSurface[] {
  const inNav = new Set(registry.filter((entry) => entry.navGroup !== null).map((entry) => entry.screenId));
  return REVIEW_SURFACES.filter((surface) => inNav.has(surface.deck));
}

/** Where the Review tile goes (D10/D12): most due → most recently reviewed → registry order; nothing ever reviewed
 * → kanji review (a real empty state, never a fake session). `due` sums the exposed decks only. */
export function reviewDestination(summaries: readonly DeckSummary[], surfaces: readonly ReviewSurface[]): { href: string; due: number } {
  const ranked = surfaces
    .map((surface, order) => ({ surface, order, summary: summaries.find((row) => row.deck === surface.deck) }))
    .map(({ surface, order, summary }) => ({ surface, order, due: summary?.due ?? 0, at: summary?.lastReviewedAt ?? null }));
  const due = ranked.reduce((sum, row) => sum + row.due, 0);
  if (due === 0 && ranked.every((row) => row.at === null)) return { href: NEW_LEARNER_HREF, due };
  ranked.sort((a, b) =>
    b.due - a.due
    || (b.at === null ? 0 : Date.parse(b.at)) - (a.at === null ? 0 : Date.parse(a.at))
    || a.order - b.order);
  return { href: ranked[0]?.surface.reviewHref ?? NEW_LEARNER_HREF, due };
}
