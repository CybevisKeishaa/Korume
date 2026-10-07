import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { ProfilePage } from "./profile-page";
import { makeView } from "./view-fixture";

const order = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("h1, h2")).map((n) => n.textContent);

describe("ProfilePage", () => {
  it("has one h1 and DOM order identity, stats, journey, Korumeship, memory, favorite, goal, achievements", () => {
    const { container } = render(<ProfilePage view={makeView()} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(order(container)).toEqual([
      en.page.title, "Keishaa", en.stats.title, en.journey.title, en.korume.title, en.memory.eyebrow,
      en.favorite.title, en.goal.eyebrow, en.achievements.title,
    ]);
    expect(screen.getByRole("link", { name: en.identity.edit })).toHaveAttribute("href", expect.stringContaining("/profile/edit"));
    expect(screen.getByText("Korume · since March 2026")).toBeInTheDocument();
  });

  it("renders neither Korume card when korumeship is null", () => {
    render(<ProfilePage view={makeView({ korumeship: null })} />);
    expect(screen.queryByText(en.korume.title)).toBeNull();
    expect(screen.queryByText(en.memory.eyebrow)).toBeNull();
  });

  it("renders Korumeship without a memory card when there is no memory today", () => {
    render(<ProfilePage view={makeView({ todaysMemory: null })} />);
    expect(screen.getByText(en.korume.title)).toBeInTheDocument();
    expect(screen.queryByText(en.memory.eyebrow)).toBeNull();
  });
});
