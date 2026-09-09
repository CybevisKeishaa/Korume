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
  empty: {
    popular: { title: "Popular lessons are taking shape", body: "Popular lessons will appear once learners have recorded activity." },
    continueLearning: { title: "Continue when you are ready", body: "Lessons you begin will wait here for you." },
    recentlyAdded: { title: "New lessons will arrive here", body: "Recently added lessons will appear once the library grows." },
    recommended: { title: "Recommendations need learning signals", body: "Recommendations will appear when there is enough learning data." },
  },
};

describe("HubShelves", () => {
  it("keeps the four supplied shelf landmarks in the authored Figma order", () => {
    render(<HubShelves recentlyAdded={[lesson]} popular={[lesson]} continueLearning={[{ lesson, lastWatchedPosition: 90 }]} recommendations={[recommendation]} labels={labels} />);

    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Popular",
      "Continue learning",
      "Recently added",
      "Recommended for you",
    ]);
  });

  it("keeps every shelf in authored order with a truthful empty interior instead of sample lessons", () => {
    render(<HubShelves recentlyAdded={[lesson]} popular={[]} continueLearning={[]} recommendations={[]} labels={labels} />);
    expect(screen.getByRole("heading", { name: "Popular lessons are taking shape" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Continue when you are ready" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recently added" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommendations need learning signals" })).toBeInTheDocument();
    expect(screen.getByText("Lessons you begin will wait here for you.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Popular lessons|Continue when|Recommendations need/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Tokyo at night/ })).toHaveLength(1);
  });

  it("only renders a recommendation explanation when the recommendation carries a measured reason", () => {
    const { rerender } = render(
      <HubShelves recentlyAdded={[]} popular={[]} continueLearning={[]} recommendations={[recommendation]} labels={labels} />,
    );
    expect(screen.getByText("82% words you know")).toBeInTheDocument();

    rerender(
      <HubShelves
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
