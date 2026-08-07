import { describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppNav, NAV_GROUPS, NAV_ITEMS } from "./app-nav";
// Plain JSON import (resolveJsonModule), not next-intl. Used ONLY for a
// structural check (key-set parity below) — never as a source of expected
// *values*. Comparing rendered text to this same file would be circular:
// @/test/render feeds NextIntlClientProvider from this exact file, so the
// component and the assertion would both read from — and agree with — a
// single typo. See EXPECTED_LABELS below for the real content pins.
import navMessages from "@/messages/en/nav.json";

// Pinned literals, not sourced from messages/en/nav.json: this is the whole
// point of a pinning test (see comment above). Labels unchanged since the
// string-extraction pass are byte-identical to what app-nav.tsx rendered
// before it (git show 09513db^:components/layout/app-nav.tsx). Three keys
// were renamed with fresh EN copy by the 2026-08-05 Korume reconciliation
// (spec §2): lessons (was videos), speaking (was conversation), journey
// (was journal) — those literals are authored in Plan B (Code) Task 3.
const EXPECTED_LABELS: Record<(typeof NAV_ITEMS)[number]["key"], string> = {
  dashboard: "Dashboard",
  lessons: "Lessons",
  kanji: "Kanji",
  vocab: "Vocab",
  grammar: "Grammar",
  reading: "Reading",
  speaking: "Speaking",
  jlpt: "JLPT",
  mining: "Mining",
  playlists: "Playlists",
  community: "Community",
  leaderboard: "Leaderboard",
  journey: "Journey",
  profile: "Profile",
};
// Group headings, same pinning rule. EN copy authored in Plan B Task 3
// (navigation-system.md § Navigation Inventory names the groups LEARN /
// STUDY / PROGRESS / ACCOUNT; the catalog stores title case, the uppercase
// treatment is CSS).
const EXPECTED_GROUP_LABELS: Record<(typeof NAV_GROUPS)[number]["key"], string> = {
  learn: "Learn",
  study: "Study",
  progress: "Progress",
  account: "Account",
};
const EXPECTED_ARIA_LABEL = "Main";

// Catalog keys that are nav chrome, not destinations. "toggle" is the
// visibility-toggle namespace Plan B Task 4 added, so the parity check below
// stays destination-only.
const CHROME_KEYS = new Set(["ariaLabel", "groups", "toggle"]);

vi.mock("@/lib/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/i18n/navigation")>(
    "@/lib/i18n/navigation",
  );
  return { ...actual, usePathname: () => "/dashboard" };
});

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));

// AppNav renders ReduceMotionToggle, which calls useTheme() and throws
// outside a <ThemeProvider> (see components/ui/reduce-motion-toggle.test.tsx
// for the same pattern). @/test/render only supplies the i18n provider, so
// this test supplies ThemeProvider itself.
function renderNav(userEmail = "learner@example.com") {
  return render(
    <ThemeProvider>
      <AppNav userEmail={userEmail} />
    </ThemeProvider>,
  );
}

describe("AppNav", () => {
  it("the catalog's destination key set matches NAV_ITEMS (structural, not content)", () => {
    // Catches an orphaned or missing key in messages/en/nav.json. This does
    // NOT assert on any string value, so it can't become the same
    // catalog-checks-itself problem EXPECTED_LABELS exists to avoid.
    const catalogKeys = Object.keys(navMessages).filter(
      (key) => !CHROME_KEYS.has(key),
    );
    const navItemKeys = NAV_ITEMS.map((item) => item.key);
    expect(new Set(catalogKeys)).toEqual(new Set(navItemKeys));
  });

  it("the catalog's group key set matches NAV_GROUPS, in order (structural)", () => {
    expect(Object.keys(navMessages.groups)).toEqual(
      NAV_GROUPS.map((group) => group.key),
    );
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

  it("renders the four shipped group headings and groups items under them", () => {
    renderNav();
    // Shipped counts per navigation-system.md § Navigation Inventory: only
    // the 14 shipped rows are wired; the 8 canonical-but-unbuilt rows (and
    // with them the whole INSIGHTS group) have no entry yet.
    const expectedCounts: Record<(typeof NAV_GROUPS)[number]["key"], number> = {
      learn: 8,
      study: 4,
      progress: 1,
      account: 1,
    };
    for (const group of NAV_GROUPS) {
      const list = screen.getByRole("list", {
        name: EXPECTED_GROUP_LABELS[group.key],
      });
      expect(within(list).getAllByRole("link")).toHaveLength(
        expectedCounts[group.key],
      );
    }
  });

  it("routes the Journey entry at /journal (was `journal`; renamed by spec §2)", () => {
    // The label is renamed but the destination is unchanged — the Journal
    // surface has no other entry point in the chrome.
    renderNav();
    expect(screen.getByRole("link", { name: EXPECTED_LABELS.journey })).toHaveAttribute(
      "href",
      "/en/journal",
    );
  });

  it("routes Lessons at the shipped Hub route /videos (route rename deferred)", () => {
    // navigation-system.md's canonical table says `/shadowing`, but the
    // shipped Hub route is `/videos` — renaming the route directory is a
    // Hub-UI-plan-sized change Plan B is not authorized to make. This pin
    // records the deferral so the eventual rename is a conscious test edit.
    renderNav();
    expect(screen.getByRole("link", { name: EXPECTED_LABELS.lessons })).toHaveAttribute(
      "href",
      "/en/videos",
    );
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

  it("does not offer a theme toggle — Korume ships dark-only", () => {
    renderNav();
    expect(screen.queryByRole("button", { name: /theme|giao diện/i })).toBeNull();
  });
});

describe("AppNav visibility toggle", () => {
  // Pinned literals (same rule as EXPECTED_LABELS): EN copy authored in
  // Plan B Task 4 alongside nav.toggle.* in messages/en/nav.json.
  const HIDE_LABEL = "Hide navigation";
  const SHOW_LABEL = "Show navigation";

  it("is visible by default, with an expanded hide affordance", () => {
    renderNav();
    expect(
      screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: HIDE_LABEL })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("hides the whole nav on toggle and restores it on a second toggle", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: HIDE_LABEL }));
    expect(
      screen.queryByRole("navigation", { name: EXPECTED_ARIA_LABEL }),
    ).not.toBeInTheDocument();
    const show = screen.getByRole("button", { name: SHOW_LABEL });
    expect(show).toHaveAttribute("aria-expanded", "false");
    await user.click(show);
    expect(
      screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: HIDE_LABEL })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  // ThemeProvider mirrors the file's existing render helper (line ~71) — AppNav
  // is rendered inside it everywhere else in this suite.
  it("starts hidden when the chrome contract asks for it", () => {
    render(
      <ThemeProvider>
        <AppNav userEmail="learner@example.com" defaultVisible={false} />
      </ThemeProvider>,
    );

    // The destinations are gone…
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    // …but the column is only hidden, not absent: the learner can bring it back.
    // The toggle's accessible name is its text content, messages/en/nav.json
    // nav.toggle.show = "Show navigation".
    expect(screen.getByRole("button", { name: /show navigation/i })).toBeInTheDocument();
  });

  it("still starts visible by default", () => {
    render(
      <ThemeProvider>
        <AppNav userEmail="learner@example.com" />
      </ThemeProvider>,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  // Final whole-branch review F1 (2026-08-07): the reduce-motion control used
  // to live only inside the `visible` nav footer, so `(focus)` routes
  // (`defaultVisible={false}`) mounted it nowhere at all until the learner
  // found the edge strip and expanded the column — a CLAUDE.md §2 rule 4
  // regression on Shadowing/Dictation, the heaviest repeated study loops.
  it("keeps the reduce-motion control reachable even while the nav is hidden", () => {
    render(
      <ThemeProvider>
        <AppNav userEmail="learner@example.com" defaultVisible={false} />
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("checkbox", { name: /reduce motion/i }),
    ).toBeInTheDocument();
    // And it must not smuggle in a second nav landmark to do it.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("does not duplicate the reduce-motion control while the nav is visible", () => {
    renderNav();
    expect(
      screen.getAllByRole("checkbox", { name: /reduce motion/i }),
    ).toHaveLength(1);
  });
});
