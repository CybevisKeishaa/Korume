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
    expect(await screen.findByRole("dialog", { name: pronunciationCopy.hub.filterToggleLabel })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: labels.all })).toHaveAttribute("href", "/en/pronunciation");
    expect(screen.getByRole("link", { name: shadowingCopy.situations.restaurant })).toHaveAttribute("href", "/en/pronunciation?filter=situation%3Arestaurant");
  });

  it("keeps the studio's filter and display URL state in searches and chips", async () => {
    render(
      <HubDiscoveryControls
        filters={[{ kind: "level", slug: "n5", label: "N5" }]}
        query="meeting"
        activeFilter="level:n5"
        results={null}
        action="/en/pronunciation"
        basePath="/pronunciation"
        heading={<h1>Studio</h1>}
        filterToggleLabel="Filter"
        preservedParams={{ sort: "shortest", duration: "under_10", hideCompleted: "true" }}
        labels={labels}
      />,
    );
    const form = screen.getByRole("search", { name: labels.searchLabel });
    expect(form).toHaveFormValues({ filter: "level:n5", sort: "shortest", duration: "under_10", hideCompleted: "true" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filter: N5" }));
    expect(await screen.findByRole("link", { name: "N5" })).toHaveAttribute("href", "/en/pronunciation?q=meeting&sort=shortest&duration=under_10&hideCompleted=true&filter=level%3An5");
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

  it("places optional content between the header row and discovery results", () => {
    render(<HubDiscoveryControls filters={[]} query="" activeFilter={null} results={[lesson]} action="/en/pronunciation" basePath="/pronunciation" heading={<h1>Pronunciation</h1>} beforeResults={<p>Continue here</p>} labels={labels} />);
    expect(screen.getByText("Continue here").compareDocumentPosition(screen.getByRole("heading", { name: labels.results })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The gap from the header row is owned by the controls, not left to each page.
    expect(screen.getByText("Continue here").parentElement).toHaveClass("mt-xl");
  });

  it("keeps the between-content in the heading-less layout too", () => {
    render(<HubDiscoveryControls filters={[]} query="" activeFilter={null} results={[lesson]} action="/en/shadowing" basePath="/shadowing" beforeResults={<p>Continue here</p>} labels={labels} />);
    expect(screen.getByText("Continue here").compareDocumentPosition(screen.getByRole("heading", { name: labels.results })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("places a supplied toolbar after the filter trigger, and renders nothing extra without one", () => {
    const { rerender } = render(<HubDiscoveryControls filters={[]} query="" activeFilter={null} results={null} action="/en/pronunciation" basePath="/pronunciation" heading={<h1>Studio</h1>} filterToggleLabel="Filter" labels={labels} toolbar={<button type="button">Sort & display</button>} />);
    const buttons = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent);
    // Both must exist, or a missing one (-1) would pass the order check.
    expect(buttons.indexOf("Filter")).toBeGreaterThanOrEqual(0);
    expect(buttons.indexOf("Sort & display")).toBeGreaterThan(buttons.indexOf("Filter"));
    // /shadowing renders without a heading or toolbar, and gets exactly the controls it had.
    rerender(<HubDiscoveryControls filters={[]} query="" activeFilter={null} results={null} action="/en/shadowing" basePath="/shadowing" labels={labels} />);
    expect(screen.queryByRole("button", { name: "Sort & display" })).toBeNull();
  });

  it("names its landmarks apart where the page heading sits inside, and keeps /shadowing's names", () => {
    const filters = [{ kind: "situation" as const, slug: "restaurant", label: "Restaurant" }];
    const { rerender } = render(<HubDiscoveryControls filters={filters} query="" activeFilter={null} results={null} action="/en/pronunciation" basePath="/pronunciation" heading={<h1>Studio</h1>} filterToggleLabel="Filter" labels={labels} />);
    // The section wraps the page's h1, so it is not a region named after search.
    expect(screen.queryByRole("region", { name: labels.searchLabel })).toBeNull();
    expect(screen.getByRole("search", { name: labels.searchLabel })).toBeInTheDocument();

    rerender(<HubDiscoveryControls filters={filters} query="" activeFilter={null} results={null} action="/en/shadowing" basePath="/shadowing" labels={labels} />);
    expect(screen.getByRole("region", { name: labels.searchLabel })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: labels.searchLabel })).toBeInTheDocument();
  });
});
