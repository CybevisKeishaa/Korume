import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubShelves } from "./hub-shelves";

const lesson = { id: "l1", youtubeVideoId: "yt1", title: "Tokyo at night", durationSeconds: 300, thumbnailUrl: null, jlptLevelEstimate: "N5" };
const recommendation = {
  videoId: "r1",
  youtubeVideoId: "yt-r1",
  title: "Restaurant conversation",
  thumbnailUrl: null,
  jlptLevelEstimate: "N4",
  knownRatio: 0.82,
  totalWords: 100,
  knownWords: 82,
  band: "ideal" as const,
  reason: { kind: "known-word-fit" as const, knownRatio: 0.82, totalWords: 100, knownWords: 82 },
};

const labels = {
  featured: "Featured",
  recentlyAdded: "Recently added",
  popular: "Popular",
  continueLearning: "Continue learning",
  recommended: "Recommended for you",
  start: "Start",
  continue: "Continue",
  noThumbnail: "No thumbnail",
  recommendationReason: (percent: number) => `${percent}% words you know`,
};

describe("HubShelves", () => {
  it("keeps supplied section landmarks in the authored Figma order and omits empty ones", () => {
    render(<HubShelves featured={lesson} recentlyAdded={[lesson]} popular={[lesson]} continueLearning={[{ lesson, lastWatchedPosition: 90 }]} recommendations={[recommendation]} labels={labels} />);

    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Featured",
      "Continue learning",
      "Recently added",
      "Popular",
      "Recommended for you",
    ]);
  });

  it("renders supplied shelves and omits empty ones instead of inventing sample lessons", () => {
    render(<HubShelves featured={lesson} recentlyAdded={[lesson]} popular={[]} continueLearning={[]} recommendations={[]} labels={labels} />);
    expect(screen.getByRole("heading", { name: "Featured" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recently added" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Popular" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Tokyo at night/ })).toHaveLength(2);
  });

  it("only renders a recommendation explanation when the recommendation carries a measured reason", () => {
    const { rerender } = render(
      <HubShelves featured={null} recentlyAdded={[]} popular={[]} continueLearning={[]} recommendations={[recommendation]} labels={labels} />,
    );
    expect(screen.getByText("82% words you know")).toBeInTheDocument();

    rerender(
      <HubShelves
        featured={null}
        recentlyAdded={[]}
        popular={[]}
        continueLearning={[]}
        recommendations={[{ ...recommendation, reason: null }]}
        labels={labels}
      />,
    );
    expect(screen.queryByText(/words you know/)).not.toBeInTheDocument();
  });
});
