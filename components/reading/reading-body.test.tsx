import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { FuriganaSegment } from "@/lib/reading-types";
import { ReadingBody } from "./reading-body";

const SEGMENTS: FuriganaSegment[] = [
  { text: "私", reading: "わたし" },
  { text: "は" },
  { text: "学生", reading: "がくせい" },
  { text: "です" },
  { text: "。" },
];

describe("ReadingBody", () => {
  it("shows furigana by default when furiganaJson is present, and the toggle hides/shows it", async () => {
    const { container } = render(<ReadingBody bodyJp="私は学生です。" furiganaJson={SEGMENTS} />);

    expect(container.querySelectorAll("ruby")).toHaveLength(2);
    const toggle = screen.getByRole("button", { name: /hide furigana/i });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle);

    expect(container.querySelectorAll("ruby")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /show furigana/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Surface text is unaffected by hiding furigana.
    expect(container.textContent).toContain("私は学生です");
  });

  it("disables the toggle and falls back to sentence-level lookup when furiganaJson is null", () => {
    render(<ReadingBody bodyJp="今日は晴れです。明日は雨です。" furiganaJson={null} />);

    const toggle = screen.getByRole("button", { name: /unavailable/i });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/look up by sentence/i)).toBeInTheDocument();

    // Each sentence is its own tappable lookup target.
    expect(screen.getByRole("button", { name: "今日は晴れです。" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "明日は雨です。" })).toBeInTheDocument();
  });

  it("opens a lookup popover for a tapped word segment showing its reading", async () => {
    render(<ReadingBody bodyJp="私は学生です。" furiganaJson={SEGMENTS} />);

    // Accessible name includes the <rt> reading text, same as furigana-text.tsx's ruby/rt markup.
    await userEvent.click(screen.getByRole("button", { name: "学生 がくせい" }));

    const popover = screen.getByRole("group");
    expect(popover).toHaveTextContent("学生");
    expect(popover).toHaveTextContent("がくせい");
  });

  it("does not render a lookup trigger for a punctuation-only segment", () => {
    render(<ReadingBody bodyJp="私は学生です。" furiganaJson={SEGMENTS} />);
    // Only 3 lookupable segments (私, 学生 as words with kanji; は/です have no kanji
    // but still contain letters so they ARE lookupable) — the punctuation "。" must not be.
    expect(screen.queryByRole("button", { name: "。" })).not.toBeInTheDocument();
  });
});
