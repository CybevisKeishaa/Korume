import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";

const translate = (namespace: string) => (key: string, values?: Record<string, unknown>) =>
  values?.percent === undefined ? `${namespace}.${key}` : `${namespace}.${key}:${values.percent}`;

vi.mock("@/lib/data/shadowing-explore", () => ({
  getShadowingExplore: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      activeSituation: "restaurant",
      situations: [{ id: "restaurant", slug: "restaurant", displayOrder: 1 }],
      library: [],
      recentlyAdded: [{ id: "r1", youtubeVideoId: "yt-r1", title: "New restaurant lesson", durationSeconds: 120, thumbnailUrl: null, jlptLevelEstimate: "N5" }],
      recommendations: [{ videoId: "rec1", youtubeVideoId: "yt-rec1", title: "Recommended lesson", thumbnailUrl: null, jlptLevelEstimate: "N4", knownRatio: 0.8, totalWords: 10, knownWords: 8, band: "ideal", reason: { kind: "known-word-fit", knownRatio: 0.8, totalWords: 10, knownWords: 8 } }],
      quietSuggestion: { videoId: "rec1", youtubeVideoId: "yt-rec1", title: "Recommended lesson", thumbnailUrl: null, jlptLevelEstimate: "N4", knownRatio: 0.8, totalWords: 10, knownWords: 8, band: "ideal", reason: { kind: "known-word-fit", knownRatio: 0.8, totalWords: 10, knownWords: 8 } },
      shelves: [],
    },
  }),
}));

vi.mock("@/lib/i18n/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockImplementation(async (namespace: string) => translate(namespace)),
}));

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  getPathname: vi.fn().mockReturnValue("/en/shadowing/explore"),
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

import ExplorePage from "./page";

describe("ExplorePage", () => {
  it("caps the search field at its frame width without constraining its row", async () => {
    // Frame 200:7705's 440px field is 28.65% of its 1536px canvas.
    render(await ExplorePage({ searchParams: {} }));
    const input = screen.getByRole("textbox", { name: "shadowing.hub.sections.search" });
    const row = input.parentElement as HTMLElement;

    expect(row.className).not.toContain("max-w-");
    expect(input.className).toContain("max-w-[clamp(18rem,28.65vw,27.5rem)]");
    // The rung, not the Tailwind numeric. `h-control-md` IS the 40px this
    // pinned before, now expressed as the token that scales with the desktop
    // density rule; `h-control-lg` would be the taller rung this row rejected.
    expect(input.className).toContain("h-control-md");
    expect(input.className).not.toContain("h-control-lg");
  });

  it("keeps C3's authored desktop sequence without a Companion rail", async () => {
    render(await ExplorePage({ searchParams: { q: "ramen", situation: "restaurant" } }));

    expect(screen.getByRole("heading", { level: 1, name: "shadowing.explore.title" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "shadowing.hub.sections.search" })).toHaveFormValues({ q: "ramen", situation: "restaurant" });
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "shadowing.explore.imported",
      "shadowing.explore.recent",
      "shadowing.explore.recommended",
      "shadowing.explore.situations",
      "common.recommendations.heading",
    ]);
    expect(screen.getByRole("link", { name: "shadowing.hub.actions.start: New restaurant lesson" })).toHaveAttribute("href", "/en/shadowing/r1");
    expect(screen.getAllByText("common.recommendations.knownWords:80")).toHaveLength(2);
  });
});
