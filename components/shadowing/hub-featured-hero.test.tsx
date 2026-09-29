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

const course = {
  title: "Everyday Conversation",
  description: null,
  total: 2,
  completed: 0,
  lessonCount: 2,
  durationMinutes: 30,
  jlptRange: null,
  levelBand: null,
  coverUrl: null,
  previewHref: "/pronunciation/collections/everyday-conversation",
  next: lesson,
  selectedByRecentActivity: false,
};

const courseLabels = {
  eyebrow: "FEATURED COURSE",
  start: "Start Course",
  continue: "Continue Learning",
  preview: "Preview Course",
  lessonsLabel: "Lessons",
  lessons: (count: number) => `${count} lessons`,
  levelLabel: "Level",
  durationLabel: "Course length",
  duration: (minutes: number) => `${minutes} minutes`,
  jlptLabel: "JLPT",
  complete: (percent: number) => `${percent}% complete`,
  progressLessons: (completed: number, total: number) => `${completed} / ${total} lessons`,
  emptyTitle: "No course yet",
  emptyBody: "A course will appear here once one has lessons.",
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

  it("reports the measured desktop slot to the image optimizer", () => {
    render(
      <HubFeaturedHero
        lesson={{ ...lesson, thumbnailUrl: "https://example.com/featured.jpg" }}
        labels={{ eyebrow: "Featured lesson", start: "Start lesson", continue: "Continue lesson", noThumbnail: "No thumbnail", jlptLabel: "Japanese level", durationLabel: "Lesson length", duration: (minutes) => `${minutes} minutes`, emptyTitle: "Featured lessons are selected editorially", emptyBody: "A featured lesson will appear here when one is available." }}
      />,
    );

    expect(document.querySelector("img")).toHaveAttribute(
      "sizes",
      "(min-width: 1549px) calc(100vw - 42.25rem), (min-width: 1024px) calc(72.5vw - 15.625rem), 100vw",
    );
  });

  it("renders the course variant with progress and separate preview action", () => {
    render(<HubFeaturedHero course={{ ...course, description: "Natural phrases.", total: 120, completed: 80, lessonCount: 120, durationMinutes: 480, jlptRange: "N3–N2", levelBand: "Intermediate–Advanced" }} labels={courseLabels} />);
    expect(screen.getByRole("heading", { name: "Everyday Conversation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue Learning: Everyday Conversation" })).toHaveAttribute("href", "/en/shadowing/featured-1");
    expect(screen.getByRole("link", { name: "Preview Course: Everyday Conversation" })).toHaveAttribute("href", "/en/pronunciation/collections/everyday-conversation");
    expect(screen.getByRole("progressbar", { name: "67% complete" })).toBeInTheDocument();
    // Each meta value is named by its own term, never by a copy of itself.
    expect(screen.getByText("Lessons")).toHaveClass("sr-only");
    expect(screen.getByText("Course length")).toHaveClass("sr-only");
    expect(screen.getByText("120 lessons").tagName).toBe("DD");
  });

  it("starts a course that is neither begun nor chosen by recent activity", () => {
    render(<HubFeaturedHero course={course} labels={courseLabels} />);

    expect(screen.getByRole("link", { name: "Start Course: Everyday Conversation" })).toHaveAttribute("href", "/en/shadowing/featured-1");
    expect(screen.queryByRole("link", { name: /^Continue Learning:/ })).not.toBeInTheDocument();
  });

  it("continues a course selected by recent activity even before any lesson is complete", () => {
    render(<HubFeaturedHero course={{ ...course, selectedByRecentActivity: true }} labels={courseLabels} />);

    expect(screen.getByRole("link", { name: "Continue Learning: Everyday Conversation" })).toBeInTheDocument();
  });

  it("uses the course cover, not the next lesson's thumbnail", () => {
    render(<HubFeaturedHero course={{ ...course, coverUrl: "https://example.com/cover.jpg", next: { ...lesson, thumbnailUrl: "https://example.com/next.jpg" } }} labels={courseLabels} />);

    expect(document.querySelector("img")?.getAttribute("src")).toContain("cover.jpg");
  });

  it("omits a level band when the course has no JLPT range", () => {
    render(<HubFeaturedHero course={{ ...course, levelBand: "Advanced" }} labels={courseLabels} />);

    expect(screen.queryByText("Advanced")).not.toBeInTheDocument();
  });

  it("keeps the course region with its own empty copy when no course exists", () => {
    render(<HubFeaturedHero course={null} labels={courseLabels} />);

    expect(screen.getByRole("region", { name: "FEATURED COURSE" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No course yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
