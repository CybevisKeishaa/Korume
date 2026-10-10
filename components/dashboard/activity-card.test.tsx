import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { ActivityCard } from "./activity-card";

describe("ActivityCard", () => {
  it("renders one focusable 4 by 14 activity region without grid role", () => {
    render(<ActivityCard cells={Array.from({ length: 56 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, state: "empty" as const, level: 0 as const, count: 0 }))} streak={0} />);
    const region = screen.getByRole("region", { name: "Learning activity" });
    expect(region).toHaveAttribute("id", "learning-activity");
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByText("No active streak")).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-describedby", "learning-activity-summary");
    expect(screen.getAllByLabelText(/no activity/)[0]).toHaveAttribute("data-state", "empty");
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(screen.getAllByLabelText(/no activity/)[1]).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2026-10-02: no activity");
  });

  it("renders a local error instead of an activity grid", () => {
    render(<ActivityCard error cells={[]} streak={0} />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
  });
});
