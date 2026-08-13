import { describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppNav } from "./app-nav";
// NAV_GROUPS/NAV_ITEMS moved out of app-nav.tsx (final whole-branch review
// FIX 3): app-nav.tsx is "use client", so deriving them there shipped the
// whole screen registry to the browser. The values are unchanged — only the
// module they live in moved.
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/product/nav-groups";
// Plain JSON import (resolveJsonModule), not next-intl. Used ONLY for a
// structural check (key-set parity below) — never as a source of expected
// *values*. Comparing rendered text to this same file would be circular:
// @/test/render feeds NextIntlClientProvider from this exact file, so the
// component and the assertion would both read from — and agree with — a
// single typo. See EXPECTED_LABELS below for the real content pins.
import navMessages from "@/messages/en/nav.json";

// Pinned literals, not sourced from messages/en/nav.json: this is the whole
// point of a pinning test (see comment above).
//
// Phase 1b rewrote this set against the LOCKED IA (ia-proposal.md §2). Ten
// destinations lost their nav row — vocab, reading, community, leaderboard
// (HIDDEN, A10) plus challenges, sensei, weeklyReport, journey, statistics
// and achievements (ABSORBED into Roadmap / Companion / Dashboard) — so their
// pins are gone from here. Their routes, schema and components are untouched;
// only the sidebar row went. Two destinations arrived, and their keys are
// screenIds rather than tidy words because `deriveNavGroups` maps
// `key: entry.screenId` (R9): `pronunciation-library` and `companion-home`.
//
// Two label changes carry a product decision rather than a copy edit:
//   mining  -> "Collection" (A7)
//   roadmap -> "Journey"    (A8 — the label moves off the Diary and onto the
//                            Roadmap, which is what Figma's `journey` names)
const EXPECTED_LABELS: Record<(typeof NAV_ITEMS)[number]["key"], string> = {
  dashboard: "Dashboard",
  lessons: "Lessons",
  kanji: "Kanji",
  grammar: "Grammar",
  speaking: "Speaking",
  "pronunciation-library": "Pronunciation",
  jlpt: "JLPT",
  review: "Review",
  mining: "Collection",
  playlists: "Playlists",
  roadmap: "Journey",
  "companion-home": "Companion",
  profile: "Profile",
  settings: "Settings",
};
// Group headings, same pinning rule. Phase 1b replaced LEARN/STUDY/INSIGHTS/
// PROGRESS/ACCOUNT with the LOCKED IA's five groups (A1).
//
// ⚠️ `journey` DISPLAYS as "Growth". A1 fixes the group *id* and A8 puts the
// "Journey" label on the /roadmap row inside that group, so rendering the id
// verbatim would print a heading "Journey" directly above an item "Journey".
// The IA locks ids and row labels but never specified group headings; user
// ruling 2026-08-13 keeps the id and displays "Growth".
//
// Re-affirmed 2026-08-13 after Vietnamese moved to "Tiến trình" (≈ Progress):
// the user was offered "Progress" for EN — which would also have dissolved the
// known collision with the Companion's own `Growth Areas` surface inside this
// very group — and chose to keep "Growth". EN and VI are therefore deliberately
// not literal equivalents, and the collision stands knowingly. Do not "fix"
// either one by discovering them again; see A14 in the decision register.
const EXPECTED_GROUP_LABELS: Record<(typeof NAV_GROUPS)[number]["key"], string> = {
  learn: "Learn",
  practice: "Practice",
  remember: "Remember",
  journey: "Growth",
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
      <AppNav userEmail={userEmail} groups={NAV_GROUPS} />
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

  it("renders the five canonical group headings and groups items under them", () => {
    renderNav();
    // Counts per the LOCKED IA's tables (ia-proposal.md §2), not per any
    // structure in app-nav.tsx — that file has held no nav data since 1a.
    const expectedCounts: Record<(typeof NAV_GROUPS)[number]["key"], number> = {
      learn: 4,
      practice: 3,
      remember: 3,
      journey: 2,
      account: 2,
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

  it("renders all five canonical groups in order", () => {
    // ia-proposal.md §2 orders them learn -> practice -> remember -> journey
    // -> account. `journey` renders as "Growth" (see EXPECTED_GROUP_LABELS).
    renderNav();
    const headings = screen.getAllByText(
      /^(Learn|Practice|Remember|Growth|Account)$/,
    ).map((el) => el.textContent);
    expect(headings).toEqual([
      "Learn",
      "Practice",
      "Remember",
      "Growth",
      "Account",
    ]);
  });

  it("ships exactly the LOCKED IA's destinations", () => {
    // 14 = the row count of ia-proposal.md §2's five tables, pinned by hand.
    // Deliberately not derived from NAV_GROUPS: that would be the registry
    // agreeing with itself.
    expect(NAV_ITEMS).toHaveLength(14);
  });

  // The href-resolves guard moved to lib/product/screen-registry.routes.test.ts
  // (T1), which checks EVERY page.tsx against the registry rather than only
  // nav hrefs under (app)/(immersive). Spec §4.1: folded in, not duplicated.

  it("has a pinned label for every nav destination", () => {
    // Restores the exhaustiveness that `NAV_GROUPS`-as-a-literal used to give
    // at compile time. Once NAV_GROUPS is derived from the registry, the key
    // type widens to `string`, so a missing EXPECTED_LABELS entry would no
    // longer be a tsc error — this makes it a test failure instead.
    const missing = NAV_ITEMS.filter((item) => !(item.key in EXPECTED_LABELS));
    expect(missing).toEqual([]);
  });

  it("lets the nav list scroll when it is taller than the viewport", () => {
    // The list can outgrow the sidebar (22 rows did before Phase 1b cut it to
    // 14, and Phase 2 adds more). Every Figma frame shows the list clipped
    // at 585-682px with no scroll region — an export artifact, not a design
    // decision (spec §7.2, D9).
    renderNav();
    const list = document.querySelector("[data-nav-scroll]");
    expect(list).not.toBeNull();
    expect(list?.className).toContain("overflow-y-auto");
  });

  it("routes the Journey entry at /roadmap, not at the Diary (A8)", () => {
    // The defect Phase 1a recorded verbatim rather than fixed: the "Journey"
    // label sat on /journal (the Companion Diary), while Figma's `journey`
    // names the Roadmap. A8 moves the label onto /roadmap; the Diary keeps
    // its route and is reached from Companion instead of the sidebar.
    renderNav();
    expect(screen.getByRole("link", { name: EXPECTED_LABELS.roadmap })).toHaveAttribute(
      "href",
      "/en/roadmap",
    );
  });

  it("drops every hidden and absorbed row from the sidebar", () => {
    // The substance of Phase 1b. HIDDEN by A10: vocab, reading, community,
    // leaderboard. ABSORBED: challenges -> Roadmap (A5); sensei, journal,
    // weekly-report -> Companion (A2); statistics, achievements -> Dashboard
    // / Profile (A4).
    //
    // This asserts ONLY that the sidebar stopped linking them. Every one of
    // these routes still exists and still renders — `screen-registry.routes`
    // T1 would fail loudly if any had been deleted, which is the guarantee
    // that "hide" did not quietly become "remove".
    renderNav();
    const hrefs = screen
      .getAllByRole("link")
      .map((el) => el.getAttribute("href"));
    for (const gone of [
      "/en/vocab",
      "/en/reading",
      "/en/community",
      "/en/leaderboard",
      "/en/challenges",
      "/en/sensei",
      "/en/weekly-report",
      "/en/journal",
      "/en/statistics",
      "/en/achievements",
    ]) {
      expect(hrefs, gone).not.toContain(gone);
    }
    // Guard the guard: an empty or broken query would satisfy every
    // not-contains above while asserting nothing (docs/lessons.md L-004).
    expect(hrefs).toContain("/en/roadmap");
    // +1 is the wordmark link to /dashboard in the nav header, which is not a
    // destination row. EXPECTED_LABELS is hand-pinned, so this compares the
    // render against the pins rather than against the registry.
    expect(hrefs.length).toBe(Object.keys(EXPECTED_LABELS).length + 1);
  });

  it("routes Lessons at /shadowing", () => {
    // The deferral pin this replaced recorded that `lessons` pointed at the
    // shipped `/videos` route while navigation-system.md's canonical table said
    // `/shadowing`. Plan C1 executes the rename, so the deferral is over.
    renderNav();
    expect(screen.getByRole("link", { name: EXPECTED_LABELS.lessons })).toHaveAttribute(
      "href",
      "/en/shadowing",
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
        <AppNav
          userEmail="learner@example.com"
          groups={NAV_GROUPS}
          defaultVisible={false}
        />
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
        <AppNav userEmail="learner@example.com" groups={NAV_GROUPS} />
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
        <AppNav
          userEmail="learner@example.com"
          groups={NAV_GROUPS}
          defaultVisible={false}
        />
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
