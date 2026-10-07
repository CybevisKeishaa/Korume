import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { TodaysMemoryCard } from "./todays-memory-card";

describe("TodaysMemoryCard", () => {
  it("shows the date, the Japanese line in a ja element, and links to the journal", () => {
    render(<TodaysMemoryCard memory={{ id: "m", lineTextJp: "頑張って。", title: null, occurredAt: "2026-08-12T05:00:00.000Z" }} />);
    expect(screen.getByText("頑張って。")).toHaveAttribute("lang", "ja");
    expect(screen.getByText("August 12, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.memory.open })).toHaveAttribute("href", expect.stringContaining("/journal"));
  });
  it("falls back to the title when there is no line", () => {
    render(<TodaysMemoryCard memory={{ id: "m", lineTextJp: null, title: "A quiet day", occurredAt: "2026-08-12T05:00:00.000Z" }} />);
    expect(screen.getByText("A quiet day")).toBeInTheDocument();
  });
});
