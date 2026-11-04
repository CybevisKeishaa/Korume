import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { resetGlossRequestsForTests } from "@/components/shadowing-workspace/drawer/word-card";
import { KorumeRail } from "./korume-rail";

afterEach(() => { vi.unstubAllGlobals(); resetGlossRequestsForTests(); });

describe("KorumeRail", () => {
  it("shows a row as a decorative glyph tile, the full label before its meaning, level and seen count, linked to its lesson", () => {
    render(<KorumeRail anchor={null} memory={null} entities={[
      { id: "ent:1", label: "ピン留め", kind: "vocabulary", gloss: "pinning", jlpt: "N3", seenCount: 3, lessonLink: { videoId: "v", lineId: "l" } },
      { id: "ent:2", label: "保存", kind: "vocabulary", gloss: "saving", seenCount: 0 },
      { id: "ent:3", label: "そう", kind: "vocabulary", gloss: "so", jlpt: "N5" },
    ]} />);
    expect(screen.getByText("ピン留")).toHaveAttribute("aria-hidden", "true");
    // The tile cuts a long label; the row shows it whole, visibly, before the meaning.
    expect(screen.getByText("ピン留め")).not.toHaveClass("sr-only");
    expect(screen.getByText("ピン留め").parentElement).toHaveTextContent("ピン留め — pinning");
    expect(screen.getByText("JLPT N3 · Seen 3 times")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open lesson: ピン留め" })).toHaveAttribute("href", "/en/shadowing/v?line=l");
    expect(screen.getByText("Not seen yet")).toBeInTheDocument();
    expect(screen.getByText("JLPT N5")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows the Vietnamese meaning of a single entry under the vi locale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { entSeq: 1, status: "ready", glossesVi: ["ghim"], note: null, source: "ai" } }))));
    render(<KorumeRail anchor={null} memory={null} entities={[{ id: "ent:1", label: "ピン", kind: "vocabulary", gloss: "pin" }]} />, { locale: "vi" });
    expect(await screen.findByText(/ghim/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/dictionary/gloss?entryId=1");
  });

  it("keeps the English meaning of a collapsed homograph row", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<KorumeRail anchor={null} memory={null} entities={[{ id: "ent:1", label: "そう", kind: "vocabulary", gloss: "so · that way" }]} />, { locale: "vi" });
    expect(screen.getByText(/so · that way/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the anchor's time and lesson title", () => {
    render(<KorumeRail anchor={{ videoId: "video", videoTitle: "Particles", lineId: "line", lineText: "私は", translation: null, startTime: 74, span: null }} entities={[]} memory={null} />);
    expect(screen.getByText("01:14")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Particles" })).toBeInTheDocument();
  });

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
    expect(screen.getByRole("link", { name: "Open lesson: は" })).toHaveAttribute("href", "/en/shadowing/video?line=line");
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
