import "server-only";
import { cache } from "react";
import { exposedReviewSurfaces, reviewDestination, type DeckSummary, type ReviewDeck } from "@/lib/dashboard/review-surfaces";
import { createClient } from "@/lib/supabase/server";

interface DeckSummaryRow { deck: ReviewDeck; due: number; last_reviewed_at: string | null }

/** The Review tile: one aggregate over the exposed decks, then the smart destination (D10/D12). */
export const getReviewSummary = cache(async (): Promise<{ href: string; due: number }> => {
  const surfaces = exposedReviewSurfaces();
  const { data, error } = await createClient().rpc("review_deck_summary", { p_decks: surfaces.map((surface) => surface.deck) });
  if (error) throw error;
  const summaries: DeckSummary[] = ((data as DeckSummaryRow[] | null) ?? [])
    .map((row) => ({ deck: row.deck, due: row.due, lastReviewedAt: row.last_reviewed_at }));
  return reviewDestination(summaries, surfaces);
});
