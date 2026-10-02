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
  it("renders nothing with the real registry (one complete mode)", () => {
    const { container } = render(<ModeNav videoId="v" />);
    expect(container).toBeEmptyDOMElement();
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
