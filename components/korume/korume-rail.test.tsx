import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { KorumeRail } from "./korume-rail";

describe("KorumeRail", () => {
  it("shows the anchor, persisted entities, and a relevant memory without a strategy sentence", () => {
    render(<KorumeRail
      anchor={{ videoId: "video", videoTitle: "Particles", lineId: "line", lineText: "私は学生です", translation: "I am a student.", startTime: 12, span: null }}
      entities={[{ id: "particle:wa", label: "は", kind: "particle", seenCount: 31, lessonLink: { videoId: "video", lineId: "line" } }, { id: "word:nihongo", label: "日本語", kind: "vocabulary", seenCount: 3000, seenCapped: true }]}
      memory={{ title: "A line you kept.", lineTextJp: "失礼します", occurredAt: "2026-10-01T00:00:00.000Z" }}
    />);
    expect(screen.getByText("Learning context")).toBeInTheDocument();
    expect(screen.getByText("私は学生です")).toBeInTheDocument();
    expect(screen.getByText("Seen 31 times")).toBeInTheDocument();
    expect(screen.getByText("Seen 3000+ times")).toBeInTheDocument();
    expect(screen.getByText("A small memory")).toBeInTheDocument();
    expect(screen.queryByText(/strongest when examples/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Particles" })).toHaveAttribute("href", "/en/shadowing/video?line=line");
    expect(screen.getByRole("link", { name: "Open lesson" })).toHaveAttribute("href", "/en/shadowing/video?line=line");
    expect(screen.getByRole("link", { name: "Open Korume Memory" })).toHaveAttribute("href", "/en/companion");
  });

  it("omits the memory block when none is relevant, and says 'time' for one", () => {
    render(<KorumeRail anchor={null} entities={[{ id: "ent:1", label: "は", kind: "particle", seenCount: 1 }]} memory={null} />);
    expect(screen.queryByText("A small memory")).toBeNull();
    expect(screen.getByText("Seen 1 time")).toBeInTheDocument();
  });

  it("renders nothing at all when it has nothing to say", () => {
    const { container } = render(<KorumeRail anchor={null} entities={[]} memory={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
