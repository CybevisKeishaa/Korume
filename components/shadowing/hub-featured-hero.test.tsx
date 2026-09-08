import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubFeaturedHero } from "./hub-featured-hero";

const lesson = {
  id: "featured-1",
  youtubeVideoId: "yt-featured-1",
  title: "Ordering coffee at a cozy café",
  durationSeconds: 480,
  thumbnailUrl: null,
  jlptLevelEstimate: "N5",
};

describe("HubFeaturedHero", () => {
  it("presents the supplied featured lesson as the Hub's prominent entry action", () => {
    render(
      <HubFeaturedHero
        lesson={lesson}
        labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail" }}
      />,
    );

    expect(screen.getByRole("region", { name: "Featured lesson" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: lesson.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start lesson: Ordering coffee at a cozy café" })).toHaveAttribute("href", "/en/shadowing/featured-1");
  });

  it("does not replace absent featured data with a sample lesson", () => {
    render(<HubFeaturedHero lesson={null} labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail" }} />);

    expect(screen.queryByRole("region", { name: "Featured lesson" })).not.toBeInTheDocument();
  });

  it("uses the continuation action only when the read model says this featured lesson is in progress", () => {
    render(
      <HubFeaturedHero
        lesson={lesson}
        isInProgress
        labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Continue lesson: Ordering coffee at a cozy café" })).toBeInTheDocument();
  });
});
