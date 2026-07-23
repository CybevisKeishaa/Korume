import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SrsDueCard } from "./srs-due-card";

describe("SrsDueCard", () => {
  it("shows the due count (plural) and links to both review queues", () => {
    render(<SrsDueCard srsDueCount={7} />);
    expect(screen.getByText("7 cards due for review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review vocab/i })).toHaveAttribute("href", "/en/vocab/review");
    expect(screen.getByRole("link", { name: /review kanji/i })).toHaveAttribute("href", "/en/kanji/review");
  });

  it("uses the singular ICU branch when exactly one card is due", () => {
    render(<SrsDueCard srsDueCount={1} />);
    expect(screen.getByText("1 card due for review")).toBeInTheDocument();
  });

  it("does not thousands-format the count (byte-identical to the pre-extraction template literal)", () => {
    render(<SrsDueCard srsDueCount={1234} />);
    expect(screen.getByText("1234 cards due for review")).toBeInTheDocument();
  });

  it("shows a calm empty state instead of a nag when nothing is due", () => {
    render(<SrsDueCard srsDueCount={0} />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });
});
