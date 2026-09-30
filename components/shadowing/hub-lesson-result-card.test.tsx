import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubLessonResultCard } from "./hub-lesson-result-card";

const lesson = {
  id: "l1",
  youtubeVideoId: "yt-l1",
  title: "First evening in Tokyo",
  durationSeconds: 420,
  thumbnailUrl: "https://img.example/lesson.jpg",
  jlptLevelEstimate: "N4",
};

describe("HubLessonResultCard", () => {
  it("links the complete card by its lesson title and shows compact lesson metadata", () => {
    render(
      <ul>
        <HubLessonResultCard lesson={lesson} noThumbnailLabel="No thumbnail" durationLabel="7 minutes · N4" />
      </ul>,
    );

    const link = screen.getByRole("link", { name: lesson.title });
    expect(link).toHaveAttribute("href", "/en/shadowing/l1");
    expect(link).toHaveAccessibleDescription("7 minutes · N4");
    expect(link).toHaveClass("focus-visible:ring-2");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("N4")).toBeInTheDocument();
    expect(screen.getByText("7 minutes · N4")).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", expect.stringContaining("lesson.jpg"));
  });

  it("uses its supplied thumbnail fallback and never presents a Start action", () => {
    render(
      <ul>
        <HubLessonResultCard
          lesson={{ ...lesson, thumbnailUrl: null }}
          noThumbnailLabel="No thumbnail"
          durationLabel={null}
        />
      </ul>,
    );

    expect(screen.getByText("No thumbnail")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });
});
