import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppNav } from "./app-nav";
// NAV_GROUPS/NAV_ITEMS moved out of app-nav.tsx (final whole-branch review
// FIX 3): app-nav.tsx is "use client", so deriving them there shipped the
// whole screen registry to the browser. The values are unchanged — only the
// module they live in moved.
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/product/nav-groups";
import type { NavSummary } from "@/lib/nav/nav-state";
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
// Three label changes carry a product decision rather than a copy edit:
//   mining  -> "Collection"    (A7)
//   roadmap -> "Journey"       (A8 — the label moves off the Diary and onto
//                               the Roadmap, which is what Figma's `journey`
//                               names)
//   jlpt    -> "Certification" (A17 — the module label; the page heading
//                               underneath still reads "JLPT mock tests",
//                               deliberately not forced to match, same as A8)
const EXPECTED_LABELS: Record<(typeof NAV_ITEMS)[number]["key"], string> = {
  dashboard: "Dashboard",
  lessons: "Lessons",
  kanji: "Kanji",
  grammar: "Grammar",
  speaking: "Speaking",
  "pronunciation-library": "Pronunciation",
  jlpt: "Certification",
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

// Catalog keys that are nav chrome, not destinations. the rest are the chrome namespaces
// (toggle, help, reviewDue, plan, account, brand), so the parity check below
// stays destination-only.
const CHROME_KEYS = new Set(["ariaLabel", "groups", "toggle", "help", "reviewDue", "plan", "account", "brand"]);

let mockPath = "/dashboard";
vi.mock("@/lib/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/i18n/navigation")>(
    "@/lib/i18n/navigation",
  );
  return { ...actual, usePathname: () => mockPath };
});

let mockSummary: NavSummary | null = null;
vi.mock("@/components/layout/use-nav-summary", () => ({ useNavSummary: () => mockSummary }));

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));

const SUMMARY: NavSummary = { name: "Yuki Tanaka", avatarUrl: null, plan: "free", reviewDue: 32, reviewHref: "/mining/review" };

function renderNav(opts: { mode?: "app" | "focus"; collapsed?: boolean; summary?: NavSummary | null } = {}) {
  mockSummary = opts.summary === undefined ? SUMMARY : opts.summary;
  return render(
    <ThemeProvider>
      <AppNav groups={NAV_GROUPS} userEmail="learner@example.com" initialSummary={mockSummary}
        mode={opts.mode ?? "app"} initialCollapsed={opts.collapsed ?? false} />
    </ThemeProvider>,
  );
}

afterEach(() => {
  mockPath = "/dashboard";
  document.cookie = "korume_nav=; max-age=0; path=/";
});

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
    // Zero due: Review then carries no ", N due" suffix, so every row is found by its bare label.
    renderNav({ summary: { ...SUMMARY, reviewDue: 0 } });
    // Profile and Settings live in the account menu now (Task 7), not the list.
    for (const item of NAV_ITEMS.filter((n) => n.key !== "profile" && n.key !== "settings")) {
      const expectedLabel = EXPECTED_LABELS[item.key];
      expect(
        screen.getByRole("link", { name: expectedLabel }),
      ).toBeInTheDocument();
    }
  });

  it("ships exactly the LOCKED IA's destinations", () => {
    // 14 = the row count of ia-proposal.md §2's five tables, pinned by hand.
    // Deliberately not derived from NAV_GROUPS: that would be the registry
    // agreeing with itself.
    expect(NAV_ITEMS).toHaveLength(14);
  });

  it("has a pinned label for every nav destination", () => {
    // Restores the exhaustiveness that `NAV_GROUPS`-as-a-literal used to give
    // at compile time. Once NAV_GROUPS is derived from the registry, the key
    // type widens to `string`, so a missing EXPECTED_LABELS entry would no
    // longer be a tsc error — this makes it a test failure instead.
    const missing = NAV_ITEMS.filter((item) => !(item.key in EXPECTED_LABELS));
    expect(missing).toEqual([]);
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

  it("does not offer a theme toggle — Korume ships dark-only", () => {
    renderNav();
    expect(screen.queryByRole("button", { name: /theme|giao diện/i })).toBeNull();
  });

  it("drops every hidden and absorbed row from the sidebar", () => {
    // The substance of Phase 1b. HIDDEN by A10: vocab, reading, community,
    // leaderboard. ABSORBED: challenges -> Roadmap (A5); journal,
    // weekly-report -> Companion (A2); statistics, achievements -> Dashboard
    // / Profile (A4). (sensei was here too; Ask Korume deleted that route and
    // redirects it to /korume/chat, so it is no longer a hidden route.)
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
    // 12 destination rows (profile and settings moved to the account menu) + the brand link + Help.
    expect(hrefs.length).toBe(14);
  });

  it("lists four groups — the account group moved to the account menu", () => {
    renderNav();
    const expectedCounts = { learn: 4, practice: 3, remember: 3, journey: 2 } as const;
    for (const [key, count] of Object.entries(expectedCounts)) {
      const list = screen.getByRole("list", { name: EXPECTED_GROUP_LABELS[key as keyof typeof EXPECTED_GROUP_LABELS] });
      expect(within(list).getAllByRole("link")).toHaveLength(count);
    }
    expect(screen.queryByRole("list", { name: "Account" })).toBeNull();
    expect(screen.getAllByRole("list")).toHaveLength(4);
  });
  it("is one Main landmark sized by the sidebar token", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL });
    expect(nav).toHaveAttribute("data-collapsed", "false");
    expect(nav.className).toContain("app-nav");
  });
  it("points Review at the summary's destination and shows the due badge", () => {
    renderNav();
    const review = screen.getByRole("link", { name: /Review/ });
    expect(review).toHaveAttribute("href", expect.stringMatching(/\/mining\/review$/));
    expect(review).toHaveAccessibleName("Review, 32 due");
    expect(within(review).getByText("32")).toBeInTheDocument();
  });
  it("caps the badge at 99+ and hides it at 0 or when unknown", () => {
    const { unmount } = renderNav({ summary: { ...SUMMARY, reviewDue: 140 } });
    expect(screen.getByText("99+")).toBeInTheDocument();
    unmount();
    renderNav({ summary: { ...SUMMARY, reviewDue: 0 } });
    expect(screen.getByRole("link", { name: "Review" })).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });
  it("falls back to the kanji library when the summary is unknown", () => {
    renderNav({ summary: null });
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute("href", expect.stringMatching(/\/kanji$/));
  });
  it("links Help to /help", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", expect.stringMatching(/\/help$/));
  });
  it("marks the active destination", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });
  it("marks Review, not Collection, active on the review route", () => {
    mockPath = "/mining/review";
    renderNav();
    expect(screen.getByRole("link", { name: /Review/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Collection" })).not.toHaveAttribute("aria-current");
  });
  it("collapses to the rail and writes the cookie in (app)", async () => {
    const user = userEvent.setup();
    document.cookie = "korume_nav=; max-age=0; path=/";
    renderNav();
    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL })).toHaveAttribute("data-collapsed", "true");
    expect(document.cookie).toContain("korume_nav=collapsed");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute("aria-expanded", "false");
  });
  it("never writes the cookie in (focus) and starts as the rail", async () => {
    const user = userEvent.setup();
    document.cookie = "korume_nav=expanded; path=/";
    renderNav({ mode: "focus", collapsed: true });
    const nav = screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL });
    expect(nav).toHaveAttribute("data-collapsed", "true");
    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(nav).toHaveAttribute("data-collapsed", "false");
    // Collapse again: a leaked write would now say "collapsed" (expanding alone would write the value already there).
    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(nav).toHaveAttribute("data-collapsed", "true");
    expect(document.cookie).toContain("korume_nav=expanded");
    expect(document.cookie).not.toContain("korume_nav=collapsed");
  });
  it("adopts a newer cookie on mount in (app) (router-cache replay, spec 3.2)", () => {
    document.cookie = "korume_nav=collapsed; path=/";
    renderNav({ collapsed: false });
    expect(screen.getByRole("navigation", { name: EXPECTED_ARIA_LABEL })).toHaveAttribute("data-collapsed", "true");
    document.cookie = "korume_nav=; max-age=0; path=/";
  });
  it("in rail mode keeps every destination reachable by name", () => {
    renderNav({ collapsed: true });
    for (const label of ["Dashboard", "Lessons", "Kanji", "Grammar", "Speaking", "Certification", "Pronunciation", "Collection", "Playlists", "Journey", "Companion"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Review, 32 due" })).toBeInTheDocument();
  });
  it("in rail mode, focusing a link shows its tooltip; expanded shows none", () => {
    const { unmount } = renderNav({ collapsed: true });
    fireEvent.focus(screen.getByRole("link", { name: "Kanji" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Kanji");
    unmount();
    renderNav({ collapsed: false });
    fireEvent.focus(screen.getByRole("link", { name: "Kanji" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("truncates a long name with the full name in title", () => {
    const name = "Bartholomew Maximilian Fitzgerald-Montgomery the Third";
    renderNav({ summary: { ...SUMMARY, name } });
    const el = screen.getByText(name, { selector: ".app-nav__account-name" });
    expect(el).toHaveAttribute("title", name);
  });
  it("hides the plan chip when the plan is unknown, and shows PLUS for plus", () => {
    const { unmount } = renderNav({ summary: { ...SUMMARY, plan: null } });
    expect(screen.queryByText("FREE")).toBeNull();
    expect(screen.queryByText("PLUS")).toBeNull();
    unmount();
    renderNav({ summary: { ...SUMMARY, plan: "plus" } });
    expect(screen.getByText("PLUS")).toBeInTheDocument();
  });
  it("shows no personal data when the summary is cleared", () => {
    renderNav({ summary: null });
    expect(screen.queryByText("Yuki Tanaka")).toBeNull();
    expect(screen.queryByText("FREE")).toBeNull();
  });
  it("fades the scroll edges only while there is more to scroll", () => {
    renderNav();
    const scroll = document.querySelector("[data-nav-scroll]") as HTMLElement;
    const dims = (scrollTop: number) => {
      Object.defineProperty(scroll, "scrollTop", { configurable: true, value: scrollTop });
      Object.defineProperty(scroll, "clientHeight", { configurable: true, value: 400 });
      Object.defineProperty(scroll, "scrollHeight", { configurable: true, value: 700 });
      act(() => { fireEvent.scroll(scroll); });
    };
    expect(scroll).toHaveAttribute("data-fade-top", "false");
    dims(0);
    expect(scroll).toHaveAttribute("data-fade-top", "false");
    expect(scroll).toHaveAttribute("data-fade-bottom", "true");
    dims(120);
    expect(scroll).toHaveAttribute("data-fade-top", "true");
    expect(scroll).toHaveAttribute("data-fade-bottom", "true");
    dims(300);
    expect(scroll).toHaveAttribute("data-fade-top", "true");
    expect(scroll).toHaveAttribute("data-fade-bottom", "false");
  });
  it("re-measures the fade when collapsing changes the content height", async () => {
    const user = userEvent.setup();
    renderNav();
    const scroll = document.querySelector("[data-nav-scroll]") as HTMLElement;
    let scrollHeight = 700;
    Object.defineProperty(scroll, "scrollTop", { configurable: true, value: 0 });
    Object.defineProperty(scroll, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(scroll, "scrollHeight", { configurable: true, get: () => scrollHeight });
    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(scroll).toHaveAttribute("data-fade-bottom", "true");
    scrollHeight = 380; // the rail's content fits: no scroll, no scroll event, no box resize
    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(scroll).toHaveAttribute("data-fade-bottom", "false");
  });
  it("keeps every interactive row on the hit-target floor", () => {
    const { container } = renderNav();
    const rows = container.querySelectorAll(".app-nav__item, .app-nav__icon-button, .app-nav__help");
    // 12 destinations + Help + toggle = 14 (the bell is mocked out here).
    expect(rows.length).toBeGreaterThanOrEqual(14);
  });
});
