import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { RecommendationRail } from "./recommendation-rail";
import type { VideoRecommendation } from "@/lib/recommendation-types";

const base: VideoRecommendation = {
  videoId: "v1",
  youtubeVideoId: "yt1",
  title: "はじめての日本語",
  thumbnailUrl: "https://i.ytimg.com/vi/yt1/hqdefault.jpg",
  jlptLevelEstimate: "N5",
  knownRatio: 0.82,
  band: "ideal",
  totalWords: 100,
  knownWords: 82,
};

describe("RecommendationRail", () => {
  it("renders a card per recommendation with title, JLPT chip, band label and known-word percentage", () => {
    render(<RecommendationRail recommendations={[base]} />);

    expect(screen.getByText("はじめての日本語")).toBeInTheDocument();
    expect(screen.getByText("N5")).toBeInTheDocument();
    expect(screen.getByText("Just right")).toBeInTheDocument();
    expect(screen.getByText("82% words you know")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /はじめての日本語/ });
    expect(link).toHaveAttribute("href", "/en/shadowing/v1");
  });

  it("labels the too-easy and too-hard bands distinctly", () => {
    render(
      <RecommendationRail
        recommendations={[
          { ...base, videoId: "v2", band: "too-easy" },
          { ...base, videoId: "v3", band: "too-hard" },
        ]}
      />,
    );
    expect(screen.getByText("Easy review")).toBeInTheDocument();
    expect(screen.getByText("Challenge")).toBeInTheDocument();
  });

  it("renders alt text for the thumbnail and a fallback when there is none", () => {
    render(<RecommendationRail recommendations={[{ ...base, thumbnailUrl: null }]} />);
    expect(screen.getByText("No thumbnail")).toBeInTheDocument();
  });

  it("shows a friendly pointer to import videos when there are no recommendations yet, byte-identical to the pre-extraction text", () => {
    render(<RecommendationRail recommendations={[]} />);

    const link = screen.getByRole("link", { name: "import a video" });
    expect(link).toHaveAttribute("href", "/en/shadowing");

    // The link's English text was threaded through next-intl's rich-text
    // t.rich() (binding pattern: EN copy is frozen, so the sentence can't be
    // restructured to avoid the tag) — assert the WHOLE paragraph's raw
    // textContent, not a normalized/regex match, so a stray or missing space
    // around the link (the pre-extraction JSX used `{" "}` expressions on
    // both sides of the <Link>) would be caught here.
    const paragraph = link.closest("p");
    expect(paragraph?.textContent).toBe(
      "No recommendations yet — import a video to get started.",
    );
  });

  it("omits the JLPT chip when the estimate is unknown", () => {
    render(<RecommendationRail recommendations={[{ ...base, jlptLevelEstimate: null }]} />);
    expect(screen.queryByText("N5")).not.toBeInTheDocument();
  });
});
