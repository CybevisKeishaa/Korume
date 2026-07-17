import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SrsDueCard } from "./srs-due-card";

describe("SrsDueCard", () => {
  it("shows the due count and links to both review queues", () => {
    render(<SrsDueCard srsDueCount={7} />);
    expect(screen.getByText(/7 cards? due/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review vocab/i })).toHaveAttribute("href", "/en/vocab/review");
    expect(screen.getByRole("link", { name: /review kanji/i })).toHaveAttribute("href", "/en/kanji/review");
  });

  it("shows a calm empty state instead of a nag when nothing is due", () => {
    render(<SrsDueCard srsDueCount={0} />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });
});
