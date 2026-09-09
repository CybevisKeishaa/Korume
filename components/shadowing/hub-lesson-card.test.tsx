import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubLessonCard } from "./hub-lesson-card";
import { HubSectionHeading } from "./hub-section-heading";

const lesson = {
  id: "lesson-1",
  youtubeVideoId: "yt-lesson-1",
  title: "First evening in Tokyo",
  durationSeconds: 420,
  thumbnailUrl: "https://img.example/lesson.jpg",
  jlptLevelEstimate: "N4",
};

describe("Hub lesson primitives", () => {
  it("uses a level-two section heading and keeps an optional section action adjacent to it", () => {
    render(
      <HubSectionHeading eyebrow="YOUR LESSONS" title="Continue learning" action={<a href="/en/shadowing">Explore</a>} />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Continue learning" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/en/shadowing");
  });

  it("renders a keyboard-visible lesson action, stored thumbnail, and real progress label", () => {
    render(
      <ul>
        <HubLessonCard
          lesson={lesson}
          href="/shadowing/lesson-1"
          actionLabel="Continue"
          noThumbnailLabel="No thumbnail"
          progress={{ percent: 50, label: "3 minutes watched" }}
        />
      </ul>,
    );

    const link = screen.getByRole("link", { name: "Continue: First evening in Tokyo" });
    expect(link).toHaveAttribute("href", "/en/shadowing/lesson-1");
    expect(link).toHaveClass("focus-visible:ring-2");
    expect(screen.getByText("N4")).toBeInTheDocument();
    expect(screen.getByText("3 minutes watched")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "3 minutes watched" })).toHaveAttribute("aria-valuenow", "50");
    expect(document.querySelector("img")).toHaveAttribute("src", expect.stringContaining("lesson.jpg"));
  });

  it("uses the supplied thumbnail fallback when no stored thumbnail exists", () => {
    render(
      <ul>
        <HubLessonCard
          lesson={{ ...lesson, thumbnailUrl: null }}
          href="/shadowing/lesson-1"
          actionLabel="Start"
          noThumbnailLabel="No thumbnail"
        />
      </ul>,
    );

    expect(screen.getByText("No thumbnail")).toBeInTheDocument();
  });
});
