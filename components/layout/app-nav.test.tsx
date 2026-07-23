import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppNav, NAV_ITEMS } from "./app-nav";
// Plain JSON import (resolveJsonModule), not next-intl. Used ONLY for a
// structural check (key-set parity below) — never as a source of expected
// *values*. Comparing rendered text to this same file would be circular:
// @/test/render feeds NextIntlClientProvider from this exact file, so the
// component and the assertion would both read from — and agree with — a
// single typo. See EXPECTED_LABELS below for the real content pins.
import navMessages from "@/messages/en/nav.json";

// Pinned literals, not sourced from messages/en/nav.json: this is the whole
// point of a pinning test. If the catalog values came from the catalog
// itself, a typo introduced in the catalog would render AND be expected,
// passing silently (see comment above). Every value here must be
// byte-identical to what components/layout/app-nav.tsx rendered before the
// string-extraction pass (git show 09513db^:components/layout/app-nav.tsx).
// Copying this file as a template for another module? Keep these literal.
const EXPECTED_LABELS: Record<(typeof NAV_ITEMS)[number]["key"], string> = {
  dashboard: "Dashboard",
  kanji: "Kanji",
  vocab: "Vocab",
  grammar: "Grammar",
  videos: "Videos",
  mining: "Mining",
  reading: "Reading",
  conversation: "Conversation",
  jlpt: "JLPT",
  community: "Community",
  playlists: "Playlists",
  leaderboard: "Leaderboard",
  profile: "Profile",
};
const EXPECTED_ARIA_LABEL = "Main";

vi.mock("@/lib/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/i18n/navigation")>(
    "@/lib/i18n/navigation",
  );
  return { ...actual, usePathname: () => "/dashboard" };
});

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));

// AppNav renders ThemeToggle + ReduceMotionToggle, both of which call
// useTheme() and throw outside a <ThemeProvider> (see
// components/ui/reduce-motion-toggle.test.tsx for the same pattern). @/test/render
// only supplies the i18n provider, so this test supplies ThemeProvider itself.
function renderNav(userEmail = "learner@example.com") {
  return render(
    <ThemeProvider>
      <AppNav userEmail={userEmail} />
    </ThemeProvider>,
  );
}

describe("AppNav", () => {
  it("the catalog's key set matches NAV_ITEMS (structural, not content)", () => {
    // Catches an orphaned or missing key in messages/en/nav.json. This does
    // NOT assert on any string value, so it can't become the same
    // catalog-checks-itself problem EXPECTED_LABELS exists to avoid.
    const catalogKeys = Object.keys(navMessages).filter(
      (key) => key !== "ariaLabel",
    );
    const navItemKeys = NAV_ITEMS.map((item) => item.key);
    expect(new Set(catalogKeys)).toEqual(new Set(navItemKeys));
  });

  it("renders every nav destination from the catalog, not a sample", () => {
    renderNav();
    for (const item of NAV_ITEMS) {
      const expectedLabel = EXPECTED_LABELS[item.key];
      expect(
        screen.getByRole("link", { name: expectedLabel }),
      ).toBeInTheDocument();
    }
  });

  it("names the nav landmark via the catalog's aria-label", () => {
    renderNav();
    expect(
      screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL }),
    ).toBeInTheDocument();
  });

  it("marks the active destination", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the sign-out control from the shared namespace", () => {
    renderNav();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
