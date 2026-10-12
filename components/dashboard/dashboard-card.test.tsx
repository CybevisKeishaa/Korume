import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { DashboardCard } from "./dashboard-card";

describe("DashboardCard", () => {
  it("labels a reserved dashboard area with its eyebrow", () => {
    render(<DashboardCard id="quick-access" area="quick" eyebrow="Quick access"><p>Tiles</p></DashboardCard>);

    expect(screen.getByRole("region", { name: "Quick access" })).toHaveAttribute("data-area", "quick");
    expect(screen.getByText("Tiles")).toBeInTheDocument();
  });
});
