import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { LEARNING_MODES, type LearningMode } from "@/lib/shadowing-workspace/learning-modes";
import { ModeNav } from "./mode-nav";

const pathname = vi.hoisted(() => ({ current: "/shadowing/v" }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => pathname.current,
}));

const twoModes: LearningMode[] = LEARNING_MODES.map((mode) => ({ ...mode, complete: mode.id === "shadowing" || mode.id === "pronunciation" }));

describe("ModeNav", () => {
  it("renders Shadowing · Summary with the real registry (Summary is complete since 2026-10-04)", () => {
    pathname.current = "/shadowing/v/summary";
    render(<ModeNav videoId="v" />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/shadowing/v", "/shadowing/v/summary"]);
    expect(screen.getByRole("link", { current: "page" })).toHaveAttribute("href", "/shadowing/v/summary");
  });

  it("renders nothing for an injected one-mode registry: no disabled tab, no coming soon", () => {
    const { container } = render(<ModeNav videoId="v" modes={LEARNING_MODES.map((mode) => ({ ...mode, complete: mode.id === "listening" }))} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one link per completed mode and marks the active one", () => {
    pathname.current = "/shadowing/v/pronunciation";
    render(<ModeNav videoId="v" modes={twoModes} />);
    const nav = screen.getByRole("navigation", { name: "Learning modes" });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Shadowing" })).toHaveAttribute("href", "/shadowing/v");
    expect(screen.getByRole("link", { name: "Shadowing" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Pronunciation" })).toHaveAttribute("href", "/shadowing/v/pronunciation");
    expect(screen.getByRole("link", { name: "Pronunciation" })).toHaveAttribute("aria-current", "page");
  });
});
