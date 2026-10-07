import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { KorumeshipCard } from "./korumeship-card";

afterEach(() => vi.useRealTimers());

describe("KorumeshipCard", () => {
  it("counts whole months since the first meeting", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    render(<KorumeshipCard since="2026-04-08T00:00:00.000Z" />);
    expect(screen.getByText("We've been walking together for 5 months.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.korume.open })).toHaveAttribute("href", expect.stringContaining("/korume/chat"));
  });
  it("never says less than a month", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-10T00:00:00Z"));
    render(<KorumeshipCard since="2026-04-08T00:00:00.000Z" />);
    expect(screen.getByText("We've been walking together for a month.")).toBeInTheDocument();
  });
  it("uses the fresh copy without a duration when there is no first meeting", () => {
    render(<KorumeshipCard since={null} />);
    expect(screen.getByText(en.korume.fresh)).toBeInTheDocument();
    expect(screen.queryByText(/walking together/)).toBeNull();
  });

  it("opens with the decorative mascot art", () => {
    const { container } = render(<KorumeshipCard since={null} />);
    const art = container.querySelector("img[data-mascot-pose=\"korumeship\"]");
    expect(art).toHaveAttribute("alt", "");
  });
});
