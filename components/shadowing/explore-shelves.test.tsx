import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ExploreShelves } from "./explore-shelves";

const labels = {
  start: "Start lesson",
  preview: "Preview lesson",
  noThumbnail: "No thumbnail",
  empty: "No lessons are available for this selection yet.",
  moreAvailable: "This collection contains more lessons than are shown here.",
  drawer: {
    close: "Close preview",
    start: "Start lesson",
    add: "Add to My Lessons",
    added: "Added to My Lessons",
    adding: "Adding lesson",
    addFailed: "Could not add lesson",
    transcript: "Transcript preview",
    transcriptUnavailable: "Transcript preview unavailable",
    durationTemplate: "{count} min",
    metadata: { jlpt: "JLPT", duration: "Duration", vocabulary: "Vocabulary", sentences: "Sentences" },
  },
};

const shelf = {
  collection: { id: "c1", slug: "beginner-foundation", title: "Beginner foundation", description: null, coverImageUrl: null, displayOrder: 1 },
  hasMore: false,
  lessons: [{
    id: "a0000000-0000-0000-0000-000000000001",
    youtubeVideoId: "yt1",
    title: "Ordering ramen",
    durationSeconds: 300,
    thumbnailUrl: "https://img.example/ramen.jpg",
    jlptLevelEstimate: "N5",
    transcriptPreview: ["いらっしゃいませ。"],
    lineCount: 12,
    wordCount: 9,
  }],
};
const shelves = [shelf];

describe("ExploreShelves", () => {
  it("keeps an authored shelf as a landmark and exposes separate start and preview actions", () => {
    render(<ExploreShelves shelves={shelves} labels={labels} />);

    expect(screen.getByRole("region", { name: "Beginner foundation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start lesson: Ordering ramen" })).toHaveAttribute(
      "href",
      "/en/shadowing/a0000000-0000-0000-0000-000000000001",
    );
    expect(screen.getByRole("button", { name: "Preview lesson: Ordering ramen" })).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", expect.stringContaining("ramen.jpg"));
  });

  it("passes stored preview metadata to the drawer instead of substituting placeholder counts", async () => {
    const user = userEvent.setup();
    render(<ExploreShelves shelves={shelves} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Preview lesson: Ordering ramen" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("9");
    expect(screen.getByRole("dialog")).toHaveTextContent("12");
    expect(screen.getByRole("dialog")).toHaveTextContent("いらっしゃいませ。");
  });

  it("discloses when the bounded editorial grid has additional lessons", () => {
    render(<ExploreShelves shelves={[{ ...shelf, hasMore: true }]} labels={labels} />);

    expect(screen.getByText("This collection contains more lessons than are shown here.")).toBeInTheDocument();
  });

  it("returns focus to the preview action when Escape closes the drawer", async () => {
    const user = userEvent.setup();
    render(<ExploreShelves shelves={shelves} labels={labels} />);

    const preview = screen.getByRole("button", { name: "Preview lesson: Ordering ramen" });
    preview.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(preview).toHaveFocus();
  });
});
