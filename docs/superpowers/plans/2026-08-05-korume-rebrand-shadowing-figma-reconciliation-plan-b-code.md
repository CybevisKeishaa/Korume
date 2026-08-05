# Korume Rebrand & Shadowing Hub/Practice Reconciliation — Plan B (Code) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Korume rebrand and the 5-group Nav Column real and user-visible — everything the
already-merged Plan A (Docs) explicitly excluded: runtime brand strings (i18n catalogs, root-layout
title template), the `NAV_ITEMS` 5-group restructure with the three destination renames, a Nav
Column show/hide toggle, and the `CompanionAnchor` boundary-test narrowing to Shadowing mode only.

**Architecture:** Five tasks in dependency order. Tasks 1–2 are the mechanical rebrand of runtime
strings (catalogs + their pin tests + e2e assertions first, then the two non-catalog literals).
Task 3 restructures `components/layout/app-nav.tsx` into exported `NAV_GROUPS` (grouped) with
`NAV_ITEMS` re-derived as its flat view, renaming three label keys in `messages/{en,vi}/nav.json`.
Task 4 adds the visibility toggle on top of Task 3's structure. Task 5 is test-only: it widens the
`anchor-boundary.test.ts` allowlist so the Companion boundary matches spec §4.2 (Shadowing mode
forbidden; Pronunciation / Listening Practice / Summary pre-declared as Planned).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, next-intl catalogs (`messages/{en,vi}/*.json`),
Vitest + React Testing Library (`npx vitest run`), Playwright (`npm run test:e2e`), Tailwind.

## Global Constraints

- **Source-of-truth spec, locked for execution:**
  `docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md`. Do not
  re-open any decision it records — this plan only executes it.
- **Every i18n catalog change ships its EN value, VI value, and any pin-test update in the SAME
  task/commit.** A pin test asserts an exact literal string; changing the catalog string without
  updating the pin in the same commit is a defect this repo's reviewers have repeatedly flagged
  (`mem:l9a_localization_run_state`). `lib/i18n/catalog.test.ts` also enforces EN/VI key parity, so
  EN and VI edits must always land together.
- **TDD.** The test runner is Vitest (`"test": "vitest run"` in `package.json`) + RTL for
  components, Playwright for e2e. Every task flips its test expectations first, sees them fail,
  then makes them pass.
- **Do not touch anything Plan A already handled** — docs under `docs/design/**`,
  `docs/superpowers/**`, root identity docs (`CLAUDE.md`, `README.md`,
  `japanese-learning-app-spec.md`, `MASCOT.md`, `docs/product/**`), and `.claude/**` are done. This
  plan is code / i18n / tests only.
- **Do not build any out-of-scope item** (spec §7): no new screens or routes for Review, Challenges,
  Korume/Companion surface, Roadmap, Weekly Report, Statistics, Achievements, or Settings; no
  Companion anchor UI on Pronunciation / Listening Practice / Summary (Task 5 only removes an
  over-restriction — "Planned" means allowed, not mandatory-to-build); no Figma redraws; no
  `git mv` of `docs/design/nihongo_page_playbook.md`; no classification of
  `docs/reference/GRAND_PLAYBOOK.md`; no route rename of `/videos` → `/shadowing` (see Findings).
- **One commit per task**, following the repo's existing `type(scope): summary` convention (recent
  history: `feat(db): …`, `fix(review): …`, `docs(design): …`). Prefixes used here:
  `feat(rebrand):` (Tasks 1–2), `feat(nav):` (Tasks 3–4), `test(companion):` (Task 5).
- **Every edited file keeps its existing content except the exact text being changed** — do not
  reformat or reflow unrelated sections.

## Reality-check findings (locked into this plan after reading the actual code)

These are places where the real codebase differs from what the spec/prompt paraphrased. Each was
resolved conservatively; none silently enlarges scope.

1. **The shipped Hub route is `/videos`, not `/shadowing`** — `NAV_ITEMS` today has
   `{ href: "/videos", key: "videos" }` and the route tree has `app/[locale]/(app)/videos/**`
   (no `/shadowing` route exists). The doc-canonical table (`navigation-system.md`) maps `lessons`
   → `/shadowing`, but renaming the route directory (with redirects, dozens of internal links, the
   middleware, and the anchor allowlist) is a Hub-UI-plan-sized change this plan is not authorized
   to make. **Task 3 renames the key/label (`videos` → `lessons`) and keeps `href: "/videos"`**,
   with a code comment and a pinned test recording the deferral.
2. **Nav labels live in `messages/{en,vi}/nav.json`** (their own `nav` namespace), not in
   `common.json` — and their EN pin is `EXPECTED_LABELS` inside
   `components/layout/app-nav.test.tsx`, not a `nav.pin.test.ts`. Task 3 updates both.
3. **The Lesson Workspace's "hidden-by-default nav" is a doc mandate only**
   (`screen-shadowing-practice.md` § Sidebar) — no code implements it. `(app)/layout.tsx` renders
   `AppNav` unconditionally on every `(app)` route, including `/videos/[id]/shadowing`. There is no
   existing mechanism to generalize, so **Task 4 builds the toggle fresh** (client state inside
   `AppNav`, visible by default — the user-resolved default). Making the future Lesson Workspace
   hidden-by-default stays with Plan D, which builds that route group.
4. **The Japanese-script brand `appNameJp: "日本語シネマ"`** ("Nihongo Cinema" in katakana — the string
   rendered as the brand in the app nav, auth layout, marketing hero and header) has no
   spec-defined Korume equivalent. **User-resolved (2026-08-05): use the romaji `"Korume"`** in
   this slot rather than a katakana rendering — same Latin string as `appName`. The `font-jp` class
   on the app-nav brand link (Task 3) is left as-is: it is a font-family utility, not a script
   validator, so it renders Latin text in the same typeface without error; revisiting whether that
   class still makes sense for a Latin string is a cosmetic follow-up outside this plan's scope.
5. **`tailwind.config.ts` is confirmed comment-only** ("Nihongo Cinema design tokens." in the
   header docstring) — no config value depends on the brand. Folded into Task 2 as a one-line edit.
6. **`anchor-boundary.test.ts` is an allowlist scan** over all of `app/` + `components/`, not a
   route-group scan. "Narrowing to `/shadowing/[id]` only" therefore means *pre-declaring* the
   three Planned mode routes in the allowlist (the file's own documented pattern — `journal` and
   the mining deck were pre-declared the same way before they existed), while the Shadowing-mode
   page stays off the list. Task 5 does exactly that.
7. **`navigation-system.md` describes a nav footer with a streak indicator and Rain Sound toggle as
   "shipped"** — the real `app-nav.tsx` footer has neither (only ThemeToggle, ReduceMotionToggle,
   email, sign-out). Not part of this plan's confirmed scope; noted for the user as a doc/code
   discrepancy to reconcile elsewhere.

---

## File Structure

| File | Task | Change |
|---|---|---|
| `messages/en/common.json` | 1 | `appName`, `appNameJp`, `meta.defaultTitle` → Korume forms |
| `messages/vi/common.json` | 1 | Same three keys, VI values |
| `messages/en/marketing.json` | 1 | `footer.copyright` → `© {year} Korume` |
| `messages/vi/marketing.json` | 1 | Same key, VI catalog |
| `messages/en/common.pin.test.ts` | 1, 2 | `meta.defaultTitle` pin literal (1); Task-18 comment's template reference (2) |
| `test/messages.test.ts` | 1 | `appName` `toMatchObject` literal |
| `tests/e2e/home.spec.ts` | 1 | 日本語シネマ ×2 and footer copyright assertions |
| `app/[locale]/layout.tsx` | 2 | `"%s · Nihongo Cinema"` title template + its comment |
| `tailwind.config.ts` | 2 | Header comment only |
| `messages/en/nav.json` | 3, 4 | Key renames + `groups.*` (3); `toggle.*` (4) |
| `messages/vi/nav.json` | 3, 4 | Same, VI values |
| `components/layout/app-nav.tsx` | 3, 4 | `NAV_GROUPS` restructure (3); visibility toggle (4) |
| `components/layout/app-nav.test.tsx` | 3, 4 | Rewritten pins/structure tests (3); toggle tests (4) |
| `components/companion/anchor-boundary.test.ts` | 5 | Allowlist + boundary docstring + new assertions |

No new files. No files deleted or renamed.

---

## Task 1: Runtime brand strings — catalogs, pins, e2e

**Files:**
- Modify: `messages/en/common.json` (lines 2–7)
- Modify: `messages/vi/common.json` (lines 2–7)
- Modify: `messages/en/marketing.json` (line 13)
- Modify: `messages/vi/marketing.json` (line 13)
- Modify: `messages/en/common.pin.test.ts` (line 121)
- Modify: `test/messages.test.ts` (line 13)
- Modify: `tests/e2e/home.spec.ts` (lines 13, 41, 65)

**Interfaces:**
- Consumes: spec §1.1–1.2 category 4; Finding 4 (`appNameJp` → romaji `"Korume"`, user-resolved).
- Produces: `common.appName = "Korume"`, `common.appNameJp = "Korume"`,
  `common.meta.defaultTitle = "Korume — Learn Japanese through video"` (EN) — the strings Task 2's
  layout template and any future consumer sit alongside. No signature changes.

- [ ] **Step 1: Flip the pin/assertion literals (failing first)**

In `messages/en/common.pin.test.ts`, find:

```ts
    expect(en.meta.defaultTitle).toBe("Nihongo Cinema — Learn Japanese through video");
```

Replace:

```ts
    expect(en.meta.defaultTitle).toBe("Korume — Learn Japanese through video");
```

(The `meta.description` pin two lines below has no brand reference — leave it.)

In `test/messages.test.ts`, find:

```ts
    expect(messages.common).toMatchObject({ appName: "Nihongo Cinema" });
```

Replace:

```ts
    expect(messages.common).toMatchObject({ appName: "Korume" });
```

- [ ] **Step 2: Run the two suites to verify they fail**

Run: `npx vitest run messages/en/common.pin.test.ts test/messages.test.ts`
Expected: 2 FAILED assertions — the pin expects `"Korume — Learn Japanese through video"` but the
catalog still says `"Nihongo Cinema — …"`, and `appName` mismatch in `test/messages.test.ts`.

- [ ] **Step 3: Edit the four catalogs**

`messages/en/common.json` — find:

```json
  "appName": "Nihongo Cinema",
  "appNameJp": "日本語シネマ",
```

Replace:

```json
  "appName": "Korume",
  "appNameJp": "Korume",
```

Find:

```json
    "defaultTitle": "Nihongo Cinema — Learn Japanese through video",
```

Replace:

```json
    "defaultTitle": "Korume — Learn Japanese through video",
```

`messages/vi/common.json` — find:

```json
  "appName": "Nihongo Cinema",
  "appNameJp": "日本語シネマ",
```

Replace:

```json
  "appName": "Korume",
  "appNameJp": "Korume",
```

Find:

```json
    "defaultTitle": "Nihongo Cinema — Học tiếng Nhật qua video",
```

Replace:

```json
    "defaultTitle": "Korume — Học tiếng Nhật qua video",
```

`messages/en/marketing.json` AND `messages/vi/marketing.json` (identical edit in both) — find:

```json
    "copyright": "© {year} Nihongo Cinema",
```

Replace:

```json
    "copyright": "© {year} Korume",
```

- [ ] **Step 4: Run unit suites to verify they pass**

Run: `npx vitest run messages/en/common.pin.test.ts test/messages.test.ts lib/i18n/catalog.test.ts`
Expected: PASS (catalog.test.ts confirms EN/VI parity and ICU validity are intact).

- [ ] **Step 5: Update the e2e brand assertions (same commit — they pin the rendered strings)**

In `tests/e2e/home.spec.ts`, find:

```ts
  await expect(hero.getByText("日本語シネマ")).toBeVisible();
```

Replace:

```ts
  await expect(hero.getByText("Korume")).toBeVisible();
```

Find:

```ts
  await expect(header.getByRole("link", { name: "日本語シネマ" })).toHaveAttribute(
```

Replace:

```ts
  await expect(header.getByRole("link", { name: "Korume" })).toHaveAttribute(
```

Find:

```ts
  await expect(footer.getByText(`© ${year} Nihongo Cinema`)).toBeVisible();
```

Replace:

```ts
  await expect(footer.getByText(`© ${year} Korume`)).toBeVisible();
```

- [ ] **Step 6: Run the e2e spec**

Run: `npx playwright test home.spec.ts`
Expected: 3 passed. (Playwright's `webServer` builds and starts the app itself. If the local
environment cannot build — e.g. missing Supabase env — run the sweep below as the minimum gate and
let CI run the spec; do not claim the e2e passed without seeing it pass.)

Sweep either way:

```bash
grep -rln "Nihongo Cinema\|日本語シネマ" --include="*.ts" --include="*.tsx" --include="*.json" app components lib messages test tests tailwind.config.ts
```

Expected: exactly two files remain — `app/[locale]/layout.tsx` and `tailwind.config.ts` (Task 2's).

- [ ] **Step 7: Commit**

```bash
git add messages/en/common.json messages/vi/common.json messages/en/marketing.json messages/vi/marketing.json messages/en/common.pin.test.ts test/messages.test.ts tests/e2e/home.spec.ts
git commit -m "feat(rebrand): rename runtime brand strings to Korume across i18n catalogs, pins, and e2e"
```

---

## Task 2: Non-catalog brand literals — layout title template + tailwind comment

**Files:**
- Modify: `app/[locale]/layout.tsx` (lines 24, 35)
- Modify: `tailwind.config.ts` (line 4)
- Modify: `messages/en/common.pin.test.ts` (line 116 — comment only)

**Interfaces:**
- Consumes: Task 1 (catalog `meta.defaultTitle` already renamed — this task makes the title
  *template* agree with it).
- Produces: document titles render as `"<page> · Korume"`; no exported symbol changes.

- [ ] **Step 1: Edit the title template and its comment in `app/[locale]/layout.tsx`**

Find (comment above `generateMetadata`):

```ts
// (spec §7 risk 2). The `"%s · Nihongo Cinema"` template stays a literal: the
```

Replace:

```ts
// (spec §7 risk 2). The `"%s · Korume"` template stays a literal: the
```

Find:

```ts
      template: "%s · Nihongo Cinema",
```

Replace:

```ts
      template: "%s · Korume",
```

- [ ] **Step 2: Edit the `tailwind.config.ts` header comment**

Find:

```ts
 * Nihongo Cinema design tokens.
```

Replace:

```ts
 * Korume design tokens.
```

- [ ] **Step 3: Update the stale template reference in the pin test's comment**

In `messages/en/common.pin.test.ts`, find:

```ts
 * `"%s · Nihongo Cinema"` title template stays a literal in the layout — the
```

Replace:

```ts
 * `"%s · Korume"` title template stays a literal in the layout — the
```

- [ ] **Step 4: Verify — zero old-brand strings left in code, and types still check**

```bash
grep -rn "Nihongo Cinema\|日本語シネマ" --include="*.ts" --include="*.tsx" --include="*.json" app components lib messages test tests tailwind.config.ts
```

Expected: no output.

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/layout.tsx" tailwind.config.ts messages/en/common.pin.test.ts
git commit -m "feat(rebrand): rename brand literal in root layout title template and tailwind comment"
```

---

## Task 3: `NAV_ITEMS` → 5-group `NAV_GROUPS` restructure (14 shipped destinations)

Only the 14 currently-shipped destinations are wired into their new groups. The 8
canonical-but-unbuilt rows in `navigation-system.md` (`review`, `challenges`, `korume`, `roadmap`,
`weeklyReport`, `statistics`, `achievements`, `settings`) get **no** entry — no route exists to
point to, and placeholder/disabled entries are out of scope. Consequently the INSIGHTS group (whose
three rows are all unbuilt) does not render at all yet; the shipped structure has four groups:
LEARN (8), STUDY (4), PROGRESS (1), ACCOUNT (1). Three key renames: `videos` → `lessons`
(href stays `/videos`, Finding 1), `conversation` → `speaking`, `journal` → `journey`.

**Files:**
- Modify: `messages/en/nav.json` (full rewrite, shown below)
- Modify: `messages/vi/nav.json` (full rewrite, shown below)
- Modify: `components/layout/app-nav.tsx` (full rewrite, shown below)
- Test: `components/layout/app-nav.test.tsx` (full rewrite, shown below)

**Interfaces:**
- Consumes: `nav` catalog namespace (exists; no `lib/i18n/namespaces.ts` change needed);
  `@/test/render` (RTL render with real EN catalog); Task 1's `common.appNameJp` (`"Korume"`) rendered
  as the nav brand.
- Produces: `export const NAV_GROUPS: readonly { key: "learn" | "study" | "progress" | "account"; items: readonly { href: string; key: string }[] }[]`
  (as `as const` literal) and `export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)`
  — the flat view existing consumers (`app-nav.test.tsx`) keep using. Task 4 builds on this file's
  component body. Group heading catalog keys: `nav.groups.{learn,study,progress,account}`.

- [ ] **Step 1: Rewrite the test file (failing first)**

Replace the entire content of `components/layout/app-nav.test.tsx` with:

```tsx
import { describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";
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
// visibility-toggle namespace Plan B Task 4 adds — listed here up front so
// the parity check below stays destination-only.
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: FAIL — `app-nav.tsx` has no `NAV_GROUPS` export (module resolution/type error), and the
catalog has no `groups`/`lessons`/`speaking`/`journey` keys.

- [ ] **Step 3: Rewrite the EN and VI nav catalogs**

Replace the entire content of `messages/en/nav.json` with:

```json
{
  "ariaLabel": "Main",
  "groups": {
    "learn": "Learn",
    "study": "Study",
    "progress": "Progress",
    "account": "Account"
  },
  "dashboard": "Dashboard",
  "lessons": "Lessons",
  "kanji": "Kanji",
  "vocab": "Vocab",
  "grammar": "Grammar",
  "reading": "Reading",
  "speaking": "Speaking",
  "jlpt": "JLPT",
  "mining": "Mining",
  "playlists": "Playlists",
  "community": "Community",
  "leaderboard": "Leaderboard",
  "journey": "Journey",
  "profile": "Profile"
}
```

Replace the entire content of `messages/vi/nav.json` with:

```json
{
  "ariaLabel": "Điều hướng chính",
  "groups": {
    "learn": "Học",
    "study": "Ôn luyện",
    "progress": "Tiến trình",
    "account": "Tài khoản"
  },
  "dashboard": "Bảng điều khiển",
  "lessons": "Bài học",
  "kanji": "Kanji",
  "vocab": "Từ vựng",
  "grammar": "Ngữ pháp",
  "reading": "Đọc hiểu",
  "speaking": "Luyện nói",
  "jlpt": "JLPT",
  "mining": "Thu thập câu",
  "playlists": "Danh sách phát",
  "community": "Cộng đồng",
  "leaderboard": "Bảng xếp hạng",
  "journey": "Hành trình",
  "profile": "Hồ sơ"
}
```

- [ ] **Step 4: Rewrite `components/layout/app-nav.tsx`**

Replace the entire file content with:

```tsx
"use client";

import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

/**
 * href → nav catalog key, in the 5-group structure from
 * `docs/design/screens/navigation-system.md` § Navigation Inventory. Keys,
 * not labels: the words live in messages/. Group `key` doubles as the
 * heading catalog key (`nav.groups.*`).
 *
 * Only the 14 SHIPPED destinations are wired. The 8 canonical-but-unbuilt
 * rows (review, challenges, korume, roadmap, weeklyReport, statistics,
 * achievements, settings) have no route yet and get no entry — a group
 * gains its rows (and INSIGHTS appears at all) only when a destination
 * ships. NOTE: `lessons` points at `/videos`, the shipped Shadowing Hub
 * route; the doc-canonical `/shadowing` path is a route rename deferred to
 * the Hub UI plan (see app-nav.test.tsx's "route rename deferred" pin).
 */
export const NAV_GROUPS = [
  {
    key: "learn",
    items: [
      { href: "/dashboard", key: "dashboard" },
      { href: "/videos", key: "lessons" },
      { href: "/kanji", key: "kanji" },
      { href: "/vocab", key: "vocab" },
      { href: "/grammar", key: "grammar" },
      { href: "/reading", key: "reading" },
      { href: "/conversation", key: "speaking" },
      { href: "/jlpt", key: "jlpt" },
    ],
  },
  {
    key: "study",
    items: [
      { href: "/mining", key: "mining" },
      { href: "/playlists", key: "playlists" },
      { href: "/community", key: "community" },
      { href: "/leaderboard", key: "leaderboard" },
    ],
  },
  {
    key: "progress",
    items: [{ href: "/journal", key: "journey" }],
  },
  {
    key: "account",
    items: [{ href: "/profile", key: "profile" }],
  },
] as const;

/** Flat view of every shipped destination, for consumers that don't care
 * about grouping (and the catalog parity test). */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-card p-4 md:h-screen md:w-60 md:border-b-0 md:border-r"
    >
      <div className="mb-4 flex items-center justify-between gap-2 px-2">
        <Link href="/dashboard" className="font-jp text-lg font-bold">
          {tCommon("appNameJp")}
        </Link>
        <NotificationBell />
      </div>

      <div className="flex-1 md:overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mb-2">
            <p
              id={`app-nav-group-${group.key}`}
              className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t(`groups.${group.key}`)}
            </p>
            <ul
              aria-labelledby={`app-nav-group-${group.key}`}
              className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap"
            >
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary-strong"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <ReduceMotionToggle />
        </div>
        <p className="truncate px-1 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tCommon("auth.signOut")}
          </button>
        </form>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Run the component and catalog tests to verify they pass**

Run: `npx vitest run components/layout/app-nav.test.tsx lib/i18n/catalog.test.ts`
Expected: PASS (EN/VI parity holds because both catalogs changed together).

- [ ] **Step 6: Full unit suite, typecheck, lint**

Run: `npm test`
Expected: PASS (in particular, no other file imports `NAV_ITEMS`, verified while writing this plan
— only `app-nav.tsx` and its test).

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add messages/en/nav.json messages/vi/nav.json components/layout/app-nav.tsx components/layout/app-nav.test.tsx
git commit -m "feat(nav): restructure NAV_ITEMS into 5-group NAV_GROUPS with Lessons/Speaking/Journey renames"
```

---

## Task 4: Nav Column visibility toggle (edge affordance, visible by default)

The user-resolved default: **visible everywhere the `(app)` shell renders** — the toggle is a new
optional affordance, not a UX change to default visibility. There is no existing hide mechanism to
generalize (Finding 3), so this is built fresh as client state inside `AppNav`: when hidden, the
`<nav>` unmounts and only a slim edge strip with the show button remains. State is deliberately
not persisted (the spec decides no persistence rule; session-scoped `useState` is the smallest
correct behavior — it survives client-side navigation because `AppNav` lives in the `(app)` layout).

**Files:**
- Modify: `messages/en/nav.json` (add `toggle` object)
- Modify: `messages/vi/nav.json` (add `toggle` object)
- Modify: `components/layout/app-nav.tsx` (component body only — `NAV_GROUPS`/`NAV_ITEMS` untouched)
- Test: `components/layout/app-nav.test.tsx` (append a describe block + one import)

**Interfaces:**
- Consumes: Task 3's `NAV_GROUPS`/`NAV_ITEMS` and component body; `CHROME_KEYS` in the test already
  excludes `"toggle"` from the parity check.
- Produces: catalog keys `nav.toggle.show` / `nav.toggle.hide`; a toggle `<button>` with
  `aria-expanded` reflecting visibility. No new exports.

- [ ] **Step 1: Append the failing toggle tests**

In `components/layout/app-nav.test.tsx`, find:

```tsx
import { describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";
```

Replace:

```tsx
import { describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
```

Then append at the end of the file (after the closing `});` of `describe("AppNav", …)`):

```tsx
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: the two new tests FAIL — no button named "Hide navigation" exists yet. The Task 3 tests
still pass.

- [ ] **Step 3: Add the toggle strings to both catalogs**

`messages/en/nav.json` — find:

```json
  "journey": "Journey",
  "profile": "Profile"
}
```

Replace:

```json
  "journey": "Journey",
  "profile": "Profile",
  "toggle": {
    "show": "Show navigation",
    "hide": "Hide navigation"
  }
}
```

`messages/vi/nav.json` — find:

```json
  "journey": "Hành trình",
  "profile": "Hồ sơ"
}
```

Replace:

```json
  "journey": "Hành trình",
  "profile": "Hồ sơ",
  "toggle": {
    "show": "Hiện điều hướng",
    "hide": "Ẩn điều hướng"
  }
}
```

- [ ] **Step 4: Add the toggle to `AppNav`**

In `components/layout/app-nav.tsx`, find:

```tsx
"use client";

import { Link, usePathname } from "@/lib/i18n/navigation";
```

Replace:

```tsx
"use client";

import { useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
```

Find:

```tsx
export function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-card p-4 md:h-screen md:w-60 md:border-b-0 md:border-r"
    >
```

Replace:

```tsx
export function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  // Visible by default everywhere the (app) shell renders — the toggle is a
  // new optional affordance, not a change to default visibility
  // (navigation-system.md § Navigation Inventory; 2026-08-05 spec §2.2).
  // The Lesson Workspace's hidden-by-default mandate
  // (screen-shadowing-practice.md § Sidebar) applies to the /shadowing/[id]
  // route group, which does not exist yet — wiring that default is the job
  // of the plan that builds it, not this component's. Deliberately not
  // persisted: session-scoped state, survives client-side navigation
  // because AppNav lives in the (app) layout.
  const [visible, setVisible] = useState(true);

  return (
    <div className="flex w-full shrink-0 flex-col md:w-auto md:flex-row">
      {visible ? (
        <nav
          aria-label={t("ariaLabel")}
          className="flex w-full flex-col gap-1 border-b border-border bg-card p-4 md:h-screen md:w-60 md:border-b-0 md:border-r"
        >
```

Find (the end of the component):

```tsx
        </form>
      </div>
    </nav>
  );
}
```

Replace:

```tsx
        </form>
      </div>
        </nav>
      ) : null}
      <button
        type="button"
        aria-expanded={visible}
        onClick={() => setVisible((current) => !current)}
        className="flex items-center justify-center border-b border-border bg-card py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-screen md:w-5 md:border-b-0 md:border-r md:py-0"
      >
        <span aria-hidden="true">{visible ? "‹" : "›"}</span>
        <span className="sr-only">
          {visible ? t("toggle.hide") : t("toggle.show")}
        </span>
      </button>
    </div>
  );
}
```

Then fix the indentation of the JSX between the two edits (everything that was inside `<nav>…</nav>`
gains one level, since it is now nested inside the wrapper `<div>` and the conditional). Run
`npm run lint` — this repo's ESLint/Prettier setup will flag inconsistent JSX indentation if any
line is missed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/layout/app-nav.test.tsx lib/i18n/catalog.test.ts`
Expected: PASS — including all Task 3 tests (default state is visible, so every existing
render-and-assert test sees the same tree as before, one wrapper div deeper).

- [ ] **Step 6: Full unit suite, typecheck, lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass / exit 0.

- [ ] **Step 7: Commit**

```bash
git add messages/en/nav.json messages/vi/nav.json components/layout/app-nav.tsx components/layout/app-nav.test.tsx
git commit -m "feat(nav): add Nav Column visibility toggle (edge affordance, visible by default)"
```

---

## Task 5: Narrow the `CompanionAnchor` boundary to Shadowing mode only

The scan is an allowlist (Finding 6). Narrowing per spec §4.2 = pre-declaring the Planned mode
routes (Pronunciation, Listening Practice incl. its two sub-mode pages, Summary) so the plan that
eventually builds them can mount an anchor without widening the boundary itself — exactly the
file's documented pattern (journal and the mining deck were pre-declared the same way). The
Shadowing-mode page (`shadowing/[id]/page.tsx`) is deliberately NOT added: spec §4.2 keeps it Not
Supported. Paths use the doc-canonical `/shadowing/[id]` route shape
(`screen-shadowing-practice.md` § Learning Modes: `/shadowing/[id]/pronunciation`,
`/shadowing/[id]/listening`, `/shadowing/[id]/listening/fill-blank`,
`/shadowing/[id]/listening/translation`, `/shadowing/[id]/summary`); none of these routes exist
yet, and an allowlist entry for a nonexistent file forbids nothing today. No anchor UI is built —
"Planned" means allowed, not mandatory.

**Files:**
- Test: `components/companion/anchor-boundary.test.ts` (allowlist, docstring, one new test)

**Interfaces:**
- Consumes: the file's existing `ALLOWLIST` set and `isOffender(rel, source)` predicate (unchanged
  signature).
- Produces: nothing downstream in this plan; the plan that builds the Lesson Workspace consumes the
  pre-declared entries.

- [ ] **Step 1: Add the failing boundary assertions**

In `components/companion/anchor-boundary.test.ts`, find:

```ts
  it("flags a learning-loop surface that imports the anchor", () => {
```

Insert BEFORE it (inside the same `describe` block):

```ts
  it("keeps Shadowing mode forbidden while the other Lesson modes are Planned (2026-08-05 spec §4.2)", () => {
    const importLine =
      'import { CompanionAnchor } from "@/components/companion/companion-anchor";';
    // Shadowing mode itself: continuous playback, still Not Supported.
    expect(
      isOffender("app/[locale]/(app)/shadowing/[id]/page.tsx", importLine),
    ).toBe(true);
    // Pronunciation / Listening Practice (incl. sub-modes) / Summary:
    // Planned — architecture allows an anchor, none is built yet.
    expect(
      isOffender(
        "app/[locale]/(app)/shadowing/[id]/pronunciation/page.tsx",
        importLine,
      ),
    ).toBe(false);
    expect(
      isOffender(
        "app/[locale]/(app)/shadowing/[id]/listening/page.tsx",
        importLine,
      ),
    ).toBe(false);
    expect(
      isOffender(
        "app/[locale]/(app)/shadowing/[id]/listening/fill-blank/page.tsx",
        importLine,
      ),
    ).toBe(false);
    expect(
      isOffender(
        "app/[locale]/(app)/shadowing/[id]/listening/translation/page.tsx",
        importLine,
      ),
    ).toBe(false);
    expect(
      isOffender(
        "app/[locale]/(app)/shadowing/[id]/summary/page.tsx",
        importLine,
      ),
    ).toBe(false);
  });

```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/companion/anchor-boundary.test.ts`
Expected: the new test FAILS — the five Planned-mode paths are not on the allowlist, so
`isOffender` returns `true` for them. (The `shadowing/[id]/page.tsx` assertion already passes.)

- [ ] **Step 3: Extend the allowlist and its docstring**

Find:

```ts
 * Several entries name files LATER tasks create (journal, mining deck). That
 * is intentional: the boundary is declared once, up front, so the task that
 * adds the surface does not get to quietly widen it.
 */
const ALLOWLIST = new Set([
```

Replace:

```ts
 * Several entries name files LATER tasks create (journal, mining deck, the
 * Planned Lesson modes below). That is intentional: the boundary is declared
 * once, up front, so the task that adds the surface does not get to quietly
 * widen it.
 *
 * Narrowed 2026-08-05 (Korume reconciliation spec §4.2): inside a Lesson,
 * only Shadowing mode (`shadowing/[id]/page.tsx` — continuous playback) is
 * still forbidden. Pronunciation, Listening Practice (incl. its sub-mode
 * routes), and Summary are Planned — pre-declared here, no anchor built yet.
 * Paths use the doc-canonical `/shadowing/[id]` route shape
 * (screen-shadowing-practice.md § Learning Modes); if the Lesson Workspace
 * ships those modes under a different path, update these entries in the
 * same commit that creates the routes.
 */
const ALLOWLIST = new Set([
```

Find:

```ts
  "components/video-player/mining-deck-list.tsx",
]);
```

Replace:

```ts
  "components/video-player/mining-deck-list.tsx",
  "app/[locale]/(app)/shadowing/[id]/pronunciation/page.tsx",
  "app/[locale]/(app)/shadowing/[id]/listening/page.tsx",
  "app/[locale]/(app)/shadowing/[id]/listening/fill-blank/page.tsx",
  "app/[locale]/(app)/shadowing/[id]/listening/translation/page.tsx",
  "app/[locale]/(app)/shadowing/[id]/summary/page.tsx",
]);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/companion/anchor-boundary.test.ts`
Expected: PASS, all four tests (including the real-tree scan — the new entries reference files that
don't exist, which the scan never visits, so `offenders` stays empty).

- [ ] **Step 5: Full unit suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass / exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/companion/anchor-boundary.test.ts
git commit -m "test(companion): narrow CompanionAnchor boundary to Shadowing mode only (spec §4.2)"
```

---

## Self-review notes (completed while writing this plan)

- **Spec coverage (Plan B's slice):** §1.2 category 4 → Tasks 1–2 (all nine files the pre-plan
  `grep` sweep found still carrying the old brand in code/i18n/tests are covered; after Task 2 the
  sweep returns zero). §2.1 → Task 3 (14 shipped destinations, 3 renames, group structure). §2.2 →
  Task 4 (toggle, user-resolved visible-by-default). §4.2 → Task 5. §3, §5, §6 → docs-only /
  no-code-change sections, correctly absent. §7 exclusions → enforced via Global Constraints; no
  task builds any deferred item.
- **Placeholder scan:** no TBD/TODO/"similar to Task N". Every code step shows the exact final
  content or exact find/replace pairs verified against the real files read during planning. The
  one prose instruction without a diff (Task 4 Step 4's "fix the indentation") is a mechanical
  re-indent of code fully shown in Task 3 Step 4, gated by the lint run in the same step.
- **Type/name consistency:** `NAV_GROUPS`/`NAV_ITEMS` exports match between Task 3's component,
  Task 3's test (`(typeof NAV_ITEMS)[number]["key"]`, `(typeof NAV_GROUPS)[number]["key"]`), and
  Task 4's edits. Catalog keys `groups.{learn,study,progress,account}` and
  `toggle.{show,hide}` match between JSON, `t()` calls, and `CHROME_KEYS`. Task 5's allowlist paths
  are byte-identical between the new test assertions and the `ALLOWLIST` entries.
- **Fixed during self-review:** initially the toggle used the native `hidden` attribute on a
  mounted `<nav>`; that fails two ways in this stack (Tailwind's `.flex` utility out-specifies the
  preflight `[hidden]` rule in the cascade, and jsdom doesn't apply the stylesheet so RTL role
  queries wouldn't see it as hidden either) — switched to conditional rendering (unmount), dropping
  `aria-controls` so it never dangles while collapsed. Also moved the pin-test comment fix for
  `"%s · Korume"` from Task 1 to Task 2 so the comment never describes a template string before the
  commit that actually changes it.
