import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubShelves } from "./hub-shelves";

const lesson = { id: "l1", youtubeVideoId: "yt1", title: "Tokyo at night", durationSeconds: 300, thumbnailUrl: null, jlptLevelEstimate: "N5" };

describe("HubShelves", () => {
  it("renders supplied shelves and omits empty ones instead of inventing sample lessons", () => {
    render(<HubShelves featured={lesson} recentlyAdded={[lesson]} popular={[]} continueLearning={[]} recommendations={[]} labels={{ featured: "Featured", recentlyAdded: "Recently added", popular: "Popular", continueLearning: "Continue learning", recommended: "Recommended for you", start: "Start", continue: "Continue", noThumbnail: "No thumbnail" }} />);
    expect(screen.getByRole("heading", { name: "Featured" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recently added" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Popular" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Tokyo at night/ })).toHaveLength(2);
  });
});
