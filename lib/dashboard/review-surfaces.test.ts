import { describe, expect, it } from "vitest";
import { SCREEN_REGISTRY } from "@/lib/product/screen-registry";
import { exposedReviewSurfaces, reviewDestination, type DeckSummary } from "./review-surfaces";

const MINING_KANJI = [
  { deck: "mining", reviewHref: "/mining/review" },
  { deck: "kanji", reviewHref: "/kanji/review" },
] as const;

const summary = (deck: DeckSummary["deck"], due: number, lastReviewedAt: string | null = null): DeckSummary => ({ deck, due, lastReviewedAt });

describe("exposedReviewSurfaces (D12)", () => {
  it("is Mining + Kanji today: vocab is hidden by A10", () => {
    expect(exposedReviewSurfaces()).toEqual(MINING_KANJI);
  });

  it("is derived from the registry, not hardcoded", () => {
    const registry = SCREEN_REGISTRY.map((entry) => (entry.screenId === "vocab" ? { ...entry, navGroup: "learn" as const } : entry));
    expect(exposedReviewSurfaces(registry).map((surface) => surface.deck)).toEqual(["mining", "kanji", "vocab"]);
  });
});

describe("reviewDestination (D10/D12)", () => {
  const surfaces = exposedReviewSurfaces();

  it("goes to the deck with the most due cards and sums due over exposed decks only", () => {
    expect(reviewDestination([summary("mining", 3), summary("kanji", 7), summary("vocab", 50)], surfaces))
      .toEqual({ href: "/kanji/review", due: 10 });
  });

  it("breaks a due tie by the most recent review, then mining before kanji", () => {
    expect(reviewDestination([summary("mining", 4, "2026-10-01T00:00:00Z"), summary("kanji", 4, "2026-10-05T00:00:00Z")], surfaces).href)
      .toBe("/kanji/review");
    expect(reviewDestination([summary("mining", 4), summary("kanji", 4)], surfaces).href).toBe("/mining/review");
  });

  it("with nothing due, opens the most recently reviewed deck", () => {
    expect(reviewDestination([summary("mining", 0, "2026-10-07T00:00:00Z"), summary("kanji", 0, "2026-10-01T00:00:00Z")], surfaces))
      .toEqual({ href: "/mining/review", due: 0 });
  });

  it("a brand-new learner lands on kanji review", () => {
    expect(reviewDestination([summary("mining", 0), summary("kanji", 0)], surfaces)).toEqual({ href: "/kanji/review", due: 0 });
    expect(reviewDestination([], surfaces)).toEqual({ href: "/kanji/review", due: 0 });
  });
});
