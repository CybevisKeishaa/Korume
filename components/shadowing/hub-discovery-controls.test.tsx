import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubDiscoveryControls } from "./hub-discovery-controls";

const lesson = { id: "lesson-1", youtubeVideoId: "yt-1", title: "Restaurant conversation", durationSeconds: 600, thumbnailUrl: null, jlptLevelEstimate: "N4" };

const labels = {
  searchLabel: "Search lessons",
  searchPlaceholder: "Search lessons, grammar, situations, or topics",
  all: "All",
  results: "Search results",
  noResults: "No lessons matched your search.",
  start: "Start lesson",
  noThumbnail: "No thumbnail",
};

describe("HubDiscoveryControls", () => {
  it("renders taxonomy-backed filter links and a GET search control", () => {
    render(
      <HubDiscoveryControls
        filters={[
          { kind: "situation", slug: "restaurant", label: "Restaurant" },
          { kind: "source", slug: "anime", label: "Anime" },
        ]}
        query=""
        activeFilter={null}
        results={null}
        labels={labels}
      />,
    );

    expect(screen.getByRole("search", { name: "Search lessons" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search lessons" })).toHaveAttribute("name", "q");
    expect(screen.getByRole("link", { name: "Restaurant" })).toHaveAttribute("href", "/en/shadowing?filter=situation%3Arestaurant");
    expect(screen.getByRole("link", { name: "Anime" })).toHaveAttribute("href", "/en/shadowing?filter=source%3Aanime");
  });

  it("renders search results only from the supplied result projection", () => {
    const { rerender } = render(
      <HubDiscoveryControls filters={[]} query="restaurant" activeFilter={null} results={[lesson]} labels={labels} />,
    );
    expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start lesson: Restaurant conversation" })).toBeInTheDocument();

    rerender(<HubDiscoveryControls filters={[]} query="restaurant" activeFilter={null} results={[]} labels={labels} />);
    expect(screen.getByText("No lessons matched your search.")).toBeInTheDocument();
  });
});
