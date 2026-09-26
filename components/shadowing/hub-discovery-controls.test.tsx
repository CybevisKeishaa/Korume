import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import pronunciationCopy from "@/messages/en/pronunciation.json";
import shadowingCopy from "@/messages/en/shadowing.json";
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
        action="/en/shadowing"
        basePath="/shadowing"
        labels={labels}
      />,
    );

    expect(screen.getByRole("search", { name: "Search lessons" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search lessons" })).toHaveAttribute("action", "/en/shadowing");
    expect(screen.getByRole("searchbox", { name: "Search lessons" })).toHaveAttribute("name", "q");
    expect(screen.getByRole("link", { name: "Restaurant" })).toHaveAttribute("href", "/en/shadowing?filter=situation%3Arestaurant");
    expect(screen.getByRole("link", { name: "Anime" })).toHaveAttribute("href", "/en/shadowing?filter=source%3Aanime");
  });

  it("renders search results only from the supplied result projection", () => {
    const { rerender } = render(
      <HubDiscoveryControls filters={[]} query="restaurant" activeFilter={null} results={[lesson]} action="/vi/shadowing" basePath="/shadowing" labels={labels} />,
    );
    expect(screen.getByRole("search", { name: "Search lessons" })).toHaveAttribute("action", "/vi/shadowing");
    expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start lesson: Restaurant conversation" })).toBeInTheDocument();

    rerender(<HubDiscoveryControls filters={[]} query="restaurant" activeFilter={null} results={[]} action="/vi/shadowing" basePath="/shadowing" labels={labels} />);
    expect(screen.getByText("No lessons matched your search.")).toBeInTheDocument();
  });

  it("uses the supplied base path in a popover opened by the heading filter button", async () => {
    const user = userEvent.setup();
    render(
      <HubDiscoveryControls
        filters={[{ kind: "situation", slug: "restaurant", label: shadowingCopy.situations.restaurant }]}
        query=""
        activeFilter={null}
        results={null}
        action="/en/pronunciation"
        basePath="/pronunciation"
        heading={<header><h1>{pronunciationCopy.hub.title}</h1></header>}
        filterToggleLabel={pronunciationCopy.hub.filterToggleLabel}
        labels={labels}
      />,
    );

    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.title })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: pronunciationCopy.hub.filterToggleLabel });
    expect(trigger.querySelector("path")).toHaveAttribute("d", "M3 4h18l-7 8v5l-4 3v-8z");
    expect(document.querySelector("details")).toBeNull();

    await user.click(trigger);
    expect(await screen.findByRole("link", { name: labels.all })).toHaveAttribute("href", "/en/pronunciation");
    expect(screen.getByRole("link", { name: shadowingCopy.situations.restaurant })).toHaveAttribute("href", "/en/pronunciation?filter=situation%3Arestaurant");
  });

  it("marks the heading filter trigger with its active filter", () => {
    render(
      <HubDiscoveryControls
        filters={[{ kind: "situation", slug: "restaurant", label: shadowingCopy.situations.restaurant }]}
        query=""
        activeFilter="situation:restaurant"
        results={[]}
        action="/en/pronunciation"
        basePath="/pronunciation"
        heading={<header><h1>{pronunciationCopy.hub.title}</h1></header>}
        filterToggleLabel={pronunciationCopy.hub.filterToggleLabel}
        labels={labels}
      />,
    );

    expect(screen.getByRole("button", { name: `${pronunciationCopy.hub.filterToggleLabel}: ${shadowingCopy.situations.restaurant}` })).toHaveClass(
      "border-primary",
      "bg-primary",
      "text-primary-foreground",
    );
  });
});
