import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/dashboard.json";
import { DashboardHeader } from "./dashboard-header";

describe("DashboardHeader", () => {
  it("renders the localized study-timezone greeting and streak link", () => {
    render(<DashboardHeader weekday="Tuesday" daypart="evening" name="Mika" avatarUrl={null} streak={4} />);

    expect(screen.getByText("Tuesday · Evening")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back, Mika" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "4-day streak" })).toHaveAttribute("href", "#learning-activity");
  });

  it("uses the no-name fallback and hides a zero streak", () => {
    render(<DashboardHeader weekday="Tuesday" daypart="morning" name={null} avatarUrl={null} streak={0} />);

    expect(screen.getByRole("heading", { name: en.header.titleNoName })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /streak/i })).not.toBeInTheDocument();
  });

  it("receives only RSC-cloneable facts", () => {
    expect(structuredClone({ weekday: "Tuesday", daypart: "morning", name: null, avatarUrl: null, streak: 0 }))
      .toEqual({ weekday: "Tuesday", daypart: "morning", name: null, avatarUrl: null, streak: 0 });
  });
});
