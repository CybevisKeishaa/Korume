import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";

const translate = (namespace: string) => (key: string) => `${namespace}.${key}`;

vi.mock("@/lib/data/shadowing-hub", () => ({
  getShadowingHub: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      featured: null,
      library: [],
      continueLearning: [],
      recentlyAdded: [],
      popular: [],
      recommendations: [],
      quota: { used: 0, limit: 5, tier: "free" },
      rail: null,
      filters: [],
      discovery: null,
    },
  }),
}));

vi.mock("@/lib/i18n/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockImplementation(async (namespace: string) => translate(namespace)),
}));

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  getPathname: vi.fn().mockReturnValue("/en/shadowing"),
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

import ShadowingHubPage from "./page";

describe("ShadowingHubPage", () => {
  it("keeps all authored no-data regions and four rail cards in page order", async () => {
    render(await ShadowingHubPage({}));

    expect(screen.getAllByRole("region")).toEqual([
      screen.getByRole("region", { name: "shadowing.hub.sections.featured" }),
      screen.getByRole("region", { name: "shadowing.hub.import.title" }),
      screen.getByRole("region", { name: "shadowing.hub.sections.library" }),
      screen.getByRole("region", { name: "shadowing.hub.sections.search" }),
      screen.getByRole("region", { name: "shadowing.hub.sections.popular" }),
      screen.getByRole("region", { name: "shadowing.hub.sections.continueLearning" }),
      screen.getByRole("region", { name: "shadowing.hub.sections.recentlyAdded" }),
      screen.getByRole("region", { name: "shadowing.hub.sections.recommended" }),
      screen.getByRole("region", { name: "shadowing.hub.rail.preparation" }),
      screen.getByRole("region", { name: "shadowing.hub.rail.todayGoal" }),
      screen.getByRole("region", { name: "shadowing.hub.rail.weeklyProgress" }),
      screen.getByRole("region", { name: "shadowing.hub.rail.suggestion" }),
    ]);
  });
});
