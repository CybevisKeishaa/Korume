import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import nav from "@/messages/en/nav.json";
import { QuickAccess } from "./quick-access";

describe("QuickAccess", () => {
  it("uses the canonical four navigation labels and destinations", () => {
    render(<QuickAccess review={{ href: "/mining/review", due: 3 }} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.querySelector("span")?.textContent)).toEqual([nav.review, nav.mining, nav.speaking, nav.lessons]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/en/mining/review", "/en/mining", "/en/conversation", "/en/shadowing"]);
    expect(screen.getByText("3 due")).toBeInTheDocument();
  });

  it("shows the caught-up state when no cards are due", () => {
    render(<QuickAccess review={{ href: "/kanji/review", due: 0 }} />);

    expect(screen.getByText("All caught up")).toBeInTheDocument();
  });

  it("receives only RSC-cloneable facts", () => {
    expect(structuredClone({ review: { href: "/kanji/review", due: 0 } }))
      .toEqual({ review: { href: "/kanji/review", due: 0 } });
  });
});
