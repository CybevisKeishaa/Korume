import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { MiningCardListItem } from "@/lib/mining-types";
import { MiningDeckList } from "./mining-deck-list";

const CARD: MiningCardListItem = {
  id: "card-1",
  sentenceJp: "私は学校に行きます",
  targetWord: "学校",
  reading: "がっこう",
  translation: "I go to school",
  videoId: "abc123",
  startTime: 10,
  endTime: 15,
  createdAt: "2026-01-01T00:00:00.000Z",
  srsStage: 0,
  intervalDays: 0,
  easeFactor: 2.5,
  nextReviewAt: null,
  lastReviewedAt: null,
};

describe("MiningDeckList", () => {
  it("shows an empty state when there are no cards", () => {
    render(<MiningDeckList cards={[]} />);
    expect(screen.getByText(/no mined sentences yet/i)).toBeInTheDocument();
  });

  it("renders a card's sentence with the target word emphasized, reading, and translation", () => {
    render(<MiningDeckList cards={[CARD]} />);

    const sentence = screen.getByText((_, node) => node?.textContent === "私は学校に行きます");
    expect(sentence).toBeInTheDocument();
    expect(screen.getByText("学校", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("がっこう")).toBeInTheDocument();
    expect(screen.getByText("I go to school")).toBeInTheDocument();
  });

  it("offers a Play clip control for a card with timestamps", () => {
    render(<MiningDeckList cards={[CARD]} />);
    expect(screen.getByRole("button", { name: /play clip/i })).toBeInTheDocument();
  });

  it("renders one card per item in a list", () => {
    render(<MiningDeckList cards={[CARD, { ...CARD, id: "card-2" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
