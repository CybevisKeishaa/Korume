import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Hero } from "./hero";

describe("Hero", () => {
  it("renders the page's only h1", async () => {
    render(await Hero());

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it("offers both hero CTAs, pointing at register and the explore surface", async () => {
    render(await Hero());

    expect(screen.getByRole("link", { name: "Start Learning" })).toHaveAttribute("href", "/en/register");
    expect(screen.getByRole("link", { name: "Explore Korume" })).toHaveAttribute(
      "href",
      "/en/shadowing/explore",
    );
  });

  it("holds the hero still as a pending asset slot, not as invented art", async () => {
    const { container } = render(await Hero());

    const pending = container.querySelectorAll('[data-asset-pending="true"]');
    expect(pending).toHaveLength(1);
  });

  it("shows the video card's metadata", async () => {
    render(await Hero());

    expect(screen.getByText("Travel to Japan: Kyoto in Autumn")).toBeInTheDocument();
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText("13 min")).toBeInTheDocument();
    expect(screen.getByText("1 / 29")).toBeInTheDocument();
  });
});
