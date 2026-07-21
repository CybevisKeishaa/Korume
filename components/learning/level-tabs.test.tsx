import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { LevelTabs } from "./level-tabs";

/**
 * Characterization test pinning `LevelTabs`'s two translatable strings (the
 * nav `aria-label` and the "All" tab) before they're promoted to `common.*`
 * (binding pattern 1). This component is rendered by kanji, vocab (Task 8),
 * grammar (Task 9) and jlpt (Task 13) — the N5–N1 level labels are data, not
 * translated.
 */
describe("LevelTabs", () => {
  it("renders an accessible nav with an All tab active by default", () => {
    render(<LevelTabs basePath="/kanji" />);

    const nav = screen.getByRole("navigation", { name: "JLPT level" });
    expect(nav).toBeInTheDocument();

    const all = screen.getByRole("link", { name: "All" });
    expect(all).toHaveAttribute("href", "/en/kanji");
    expect(all).toHaveAttribute("aria-current", "true");
  });

  it("marks the active level tab and links to the filtered URL", () => {
    render(<LevelTabs basePath="/kanji" active="N5" />);

    const all = screen.getByRole("link", { name: "All" });
    expect(all).not.toHaveAttribute("aria-current");

    const n5 = screen.getByRole("link", { name: "N5" });
    expect(n5).toHaveAttribute("href", "/en/kanji?level=N5");
    expect(n5).toHaveAttribute("aria-current", "true");
  });
});
