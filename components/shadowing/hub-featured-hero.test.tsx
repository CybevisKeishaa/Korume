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
        labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail", jlptLabel: "Japanese level", durationLabel: "Lesson length", duration: (minutes) => `${minutes} minutes`, emptyTitle: "Featured lessons are selected editorially", emptyBody: "A featured lesson will appear here when one is available." }}
      />,
    );

    expect(screen.getByRole("region", { name: "Featured lesson" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: lesson.title })).toBeInTheDocument();
    expect(screen.getByText("8 minutes")).toBeInTheDocument();
    expect(screen.getByText("Japanese level")).toHaveClass("sr-only");
    expect(screen.getByText("Lesson length")).toHaveClass("sr-only");
    expect(screen.getByRole("link", { name: "Start lesson: Ordering coffee at a cozy café" })).toHaveAttribute("href", "/en/shadowing/featured-1");
  });

  it("keeps the featured region with a truthful empty interior when no lesson is supplied", () => {
    render(<HubFeaturedHero lesson={null} labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail", jlptLabel: "Japanese level", durationLabel: "Lesson length", duration: (minutes) => `${minutes} minutes`, emptyTitle: "Featured lessons are selected editorially", emptyBody: "A featured lesson will appear here when one is available." }} />);

    expect(screen.getByRole("region", { name: "Featured lesson" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured lessons are selected editorially" })).toBeInTheDocument();
    expect(screen.getByText("A featured lesson will appear here when one is available.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lesson/i })).not.toBeInTheDocument();
  });

  it("uses the continuation action only when the read model says this featured lesson is in progress", () => {
    render(
      <HubFeaturedHero
        lesson={lesson}
        isInProgress
        labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail", jlptLabel: "Japanese level", durationLabel: "Lesson length", duration: (minutes) => `${minutes} minutes`, emptyTitle: "Featured lessons are selected editorially", emptyBody: "A featured lesson will appear here when one is available." }}
      />,
    );

    expect(screen.getByRole("link", { name: "Continue lesson: Ordering coffee at a cozy café" })).toBeInTheDocument();
  });
});
