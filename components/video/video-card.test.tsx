import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { VideoCard } from "./video-card";
import type { VideoRow } from "@/lib/video-types";

const base: VideoRow = {
  id: "v1",
  youtube_video_id: "yt1",
  title: "はじめての日本語",
  duration_seconds: 300,
  thumbnail_url: "https://i.ytimg.com/vi/yt1/hqdefault.jpg",
  jlpt_level_estimate: "N5",
  added_by_user_id: null,
  library_access: "FREE",
  promotion_starred: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("VideoCard", () => {
  it("renders the title, JLPT chip and a link to the shadowing page", () => {
    render(<VideoCard video={base} />);

    expect(screen.getByText("はじめての日本語")).toBeInTheDocument();
    expect(screen.getByText("N5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /はじめての日本語/ })).toHaveAttribute(
      "href",
      "/en/videos/v1/shadowing",
    );
  });

  it("renders a fallback when there is no thumbnail", () => {
    render(<VideoCard video={{ ...base, thumbnail_url: null }} />);
    expect(screen.getByText("No thumbnail")).toBeInTheDocument();
  });

  it("shows a Private badge for a self-created (not-yet-published) video", () => {
    // Copy fixed in the final whole-branch review (2026-08-01): PRIVATE is
    // now the state of every self-created lesson, not just ones awaiting
    // moderation, so the badge text was changed from the misleading
    // "Pending review" to "Private" (messages/en(vi)/videos.json's
    // pendingReview key — key name kept, only the copy changed).
    render(<VideoCard video={{ ...base, library_access: "PRIVATE" }} />);
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("does not show the Private badge for a published video", () => {
    render(<VideoCard video={{ ...base, library_access: "FREE" }} />);
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
  });

  it("omits the JLPT chip when the estimate is unknown", () => {
    render(<VideoCard video={{ ...base, jlpt_level_estimate: null }} />);
    expect(screen.queryByText("N5")).not.toBeInTheDocument();
  });
});
