import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { FuriganaSegment } from "@/lib/video-types";
import { FuriganaText } from "./furigana-text";

const SEGMENTS: FuriganaSegment[] = [
  { text: "私", reading: "わたし" },
  { text: "は" },
  { text: "学生", reading: "がくせい" },
  { text: "です" },
];

describe("FuriganaText", () => {
  it("renders a <ruby>/<rt> reading for every segment that has one, in mode='all' (the default)", () => {
    const { container } = render(<FuriganaText segments={SEGMENTS} />);

    const rubies = container.querySelectorAll("ruby");
    expect(rubies).toHaveLength(2);

    const readings = Array.from(container.querySelectorAll("rt")).map((el) => el.textContent);
    expect(readings).toEqual(["わたし", "がくせい"]);

    // The surface text is unaffected by furigana — never dangerouslySetInnerHTML.
    expect(container.textContent).toBe("私わたしは学生がくせいです");
  });

  it("hides every reading in mode='none', keeping the surface text intact", () => {
    const { container } = render(<FuriganaText segments={SEGMENTS} mode="none" />);

    expect(container.querySelectorAll("ruby")).toHaveLength(0);
    expect(container.querySelectorAll("rt")).toHaveLength(0);
    expect(container.textContent).toBe("私は学生です");
  });

  it("never adds a reading for a segment that has none, even in mode='all'", () => {
    const { container } = render(
      <FuriganaText segments={[{ text: "は" }, { text: "です" }]} mode="all" />,
    );
    expect(container.querySelectorAll("rt")).toHaveLength(0);
    expect(container.textContent).toBe("はです");
  });

  it("lets shouldShowReading drive per-segment visibility, overriding mode — the adaptive-furigana seam", () => {
    const { container } = render(
      <FuriganaText
        segments={SEGMENTS}
        mode="none"
        shouldShowReading={(_segment, index) => index === 2}
      />,
    );

    const rts = container.querySelectorAll("rt");
    expect(rts).toHaveLength(1);
    expect(rts[0]).toHaveTextContent("がくせい");
    // The other kanji segment (index 0, 私) stays plain even though it has a reading.
    expect(container.querySelectorAll("ruby")).toHaveLength(1);
  });
});
