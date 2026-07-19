# L9a Plan 3 — String Extraction + Vietnamese Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every hardcoded UI string from the application shell, move it into per-module ICU catalogs, and ship Vietnamese as a fully translated first-class locale — so the app finally renders VN-first, which is what it launches as.

**Architecture:** The localization foundation already exists and is complete (Plan 1: `lib/i18n/**`, `app/[locale]/`, locale-aware navigation, ESLint boundary). This plan consumes it. Each feature module gets a namespace (`messages/<locale>/<ns>.json`), its components swap literal strings for `t()` from `@/lib/i18n`, and its tests move to `@/test/render`. Server components/metadata use `getTranslations` from `@/lib/i18n/server`. No schema change, no new library, no design change.

**Tech Stack:** next-intl 4.13.2 · Next.js 14.2.35 App Router · TypeScript strict · Vitest + RTL · Playwright.

---

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec and from verified repo state.

- **Namespaces (spec D4), exact list:** `common, nav, auth, marketing, kanji, vocab, grammar, videos, shadowing, dictation, mining, jlpt, reading, conversation, community, playlists, leaderboard, dashboard, profile, admin, companion`. (`marketing` is an addition to spec D4's list — the landing page is real, has copy, and belongs to no other namespace. Recorded as a deliberate deviation.)
- **P4 — each feature owns its namespace.** A module must not read another module's namespace. A string needed by two or more modules is promoted to `common`.
- **English is extracted VERBATIM (spec D3/D6).** Do not improve, shorten, or re-word English copy while extracting. The 592 English assertions in the regression suite are the safety net for this refactor; changing EN copy destroys the net. The **only** authorized EN copy change in this plan is Task 5's "Start free trial" (spec §9.1).
- **VN is written in the SAME task as EN, not a later phase.** `lib/i18n/catalog.test.ts` already asserts identical key sets and identical ICU argument sets across all locales, so an EN-only commit is a red test. This supersedes the spec's Phase 2 → Phase 3 split (§5); the spec describes two passes, the repo's existing gate permits only one. Reality outranks the plan.
- **`en` is the type source (spec D4).** `types/messages.d.ts` imports the `en` JSON. Adding a namespace touches exactly **three** places: `lib/i18n/namespaces.ts`, `types/messages.d.ts`, and both catalog directories.
- **Feature code imports only `@/lib/i18n`, `@/lib/i18n/navigation`, `@/lib/i18n/server`.** Never `next-intl` (ESLint enforces; the rule is fire-tested in `lib/eslint-rules.test.ts`).
- **CSS logical properties only** in anything under `components/ui/**` (`ps-/pe-/ms-/me-/text-start/text-end`) — auto-enforced by `components/ui/logical-properties.test.ts`.
- **`cn()` gotcha:** `lib/utils.ts` uses `extendTailwindMerge` configured with every custom token scale. Do not add Tailwind scales in this plan; if you somehow must, add them there too or `cn()` silently strips them (`lib/utils.test.ts` guards).
- **Verify commands:** `npx tsc --noEmit` · `npx vitest run` · `npm run lint` · `npm run build` · `npx playwright test` (kill any stale node on :3000 first — `reuseExistingServer` will pick it up).
- **Baseline to compare against (master @ `fcd35af`):** tsc 0 · unit **1293 tests / 174 files** · lint exit 0 with **80 pre-existing warnings across 23 files** ("clean" means zero NEW warnings) · build ~52s · playwright 2/2 ~37s.
- **Known CPU-contention flakes, standalone-green:** `components/video-player/pitch-contour.test.tsx`, `components/video-player/waveform.test.tsx`. Re-run before believing a failure.
- **Commit after every task.** Standing permission to commit without asking; never push.

### Binding Vietnamese terminology glossary

Twenty catalogs written across twenty independently-executed tasks will drift unless the vocabulary is fixed up front. **This table is binding.** Where a term appears in UI copy, use this translation.

| English | Vietnamese | Note |
|---|---|---|
| Dashboard | Bảng điều khiển | already in `messages/vi/nav.json` |
| Sign in / Sign out / Create account | Đăng nhập / Đăng xuất / Tạo tài khoản | |
| Kanji / Vocab / Grammar | Kanji / Từ vựng / Ngữ pháp | "Kanji" stays — it is the domain term |
| Videos | Video | no plural marker in VN |
| Shadowing | Shadowing | keep English — it is the technique's name, no accepted VN term |
| Dictation | Nghe chép chính tả | |
| Mining / mined sentence | Thu thập câu / câu đã thu thập | |
| Reading | Đọc hiểu | |
| Conversation | Hội thoại | |
| Community | Cộng đồng | |
| Playlist | Danh sách phát | |
| Leaderboard | Bảng xếp hạng | |
| Profile | Hồ sơ | |
| Review (SRS) | Ôn tập | verb and noun |
| Due (for review) | Đến hạn | |
| Card / Deck | Thẻ / Bộ thẻ | |
| Streak | Chuỗi ngày học | never "streak" |
| XP | XP | keep |
| Level | Cấp độ | |
| Badge | Huy hiệu | |
| Furigana / Pitch accent | Furigana / Trọng âm cao thấp | |
| Transcript | Phụ đề | |
| Peer review | Đánh giá chéo | |
| Recording | Bản ghi âm | |
| Show answer / Again / Hard / Good / Easy | Xem đáp án / Lại / Khó / Tốt / Dễ | SRS grade buttons |
| Save / Cancel / Delete / Close / Back / Next | Lưu / Hủy / Xóa / Đóng / Quay lại / Tiếp theo | promote to `common` |
| Loading… / Something went wrong | Đang tải… / Đã có lỗi xảy ra | promote to `common` |

**Register:** address the learner as **"bạn"**, never "quý khách" or "các bạn". Imperative buttons are bare verbs ("Lưu", not "Hãy lưu"). No exclamation marks in VN copy — CLAUDE.md §2.4 and the Companion spec's P12 both reject hype. **Never translate `giai đoạn <number>` style raw stage indices into user copy** (P12); see Task 17.

**Tone-mark placement (binding, decided 2026-07-20):** use the **modern convention — the mark sits on the main vowel**: `Hủy`, `Xóa`, `Thủy`, `Hòa`, `khóa`, `tùy`. Not `Huỷ`, `Xoá`, `Thuỷ`, `Hoà`, `khoá`, `tuỳ`. Both spellings are correct Vietnamese, but the modern placement is what Facebook, Google and Zalo ship in Vietnamese, so it is what this product's users read every day. Apply it to every catalog without exception.

### Key-naming convention (binding)

Flat-ish, two levels maximum, `camelCase` leaves:

```json
{
  "title": "Kanji",
  "empty": "No kanji yet.",
  "filters": { "level": "Level", "all": "All levels" },
  "card": { "readings": "Readings", "meaning": "Meaning" }
}
```

- Page/section heading → `title`. Sub-heading → `subtitle`. Empty state → `empty`. Error → `error`.
- Accessibility strings (`aria-label`, `alt`) → nested under `a11y`.
- Pluralization uses real ICU, never string concatenation: `"{count, plural, =0 {No cards} one {# card} other {# cards}}"`. **VN has no plural inflection** — the VN form is the same text for every branch, but the branches must still exist so ICU argument parity passes: `"{count, plural, =0 {Chưa có thẻ nào} other {# thẻ}}"`.

---

## File Structure

**Created (per module, by its own task):**
- `messages/en/<ns>.json` — EN catalog, extracted verbatim
- `messages/vi/<ns>.json` — VN catalog, same keys, same ICU args

**Created once (Task 1):**
- `test/messages.ts` — loads all EN catalogs for the test provider via `import.meta.glob`

**Modified once (Task 1):**
- `test/render.tsx` — supply real EN messages instead of `messages={{}}`

**Modified by every module task (three-place namespace registration):**
- `lib/i18n/namespaces.ts` — add the namespace to `NAMESPACES`
- `types/messages.d.ts` — add the `import type` + the `Messages` entry
- the module's own `.tsx` files + their `.test.tsx` files

**Modified by specific tasks:**
- `app/auth/callback/route.ts` (Task 4) · `app/[locale]/(marketing)/page.tsx` + `tests/e2e/home.spec.ts` (Task 5) · `components/ui/dialog.tsx` + `components/ui/toast.tsx` call sites (Task 3) · `lib/companion/dedupe.ts` + `lib/data/companion.ts` (Task 17) · every page's metadata (Task 18)

---

## Task ordering rationale

Task 1 is the linchpin and must land first: it makes the 49 bare-RTL test files able to survive translation at all. Task 2 is the pilot — the smallest real module, executed fully, establishing the pattern every later task repeats. Tasks 3–16 are module extractions ordered small → large so the pattern is well-worn before the 2 800-LOC video-player module. Tasks 17–19 are the cross-cutting fixes and the final gate.

---

### Task 1: Test provider serves the real English catalogs

**Why this is first:** `test/render.tsx` currently passes `messages={{}}`. The moment any component calls `t("title")`, next-intl renders the *key* (`kanji.title`) instead of the English text, and every `getByText(/Kanji/)` assertion in that module dies. D6's whole safety-net argument depends on the test provider serving the real EN catalog. Without this task, every later task fights its own tests.

**Files:**
- Create: `test/messages.ts`
- Modify: `test/render.tsx:23-32`
- Test: `test/messages.test.ts`

**Interfaces:**
- Produces: `loadEnMessages(): Record<string, unknown>` from `@/test/messages` — the merged EN catalog keyed by namespace, shape-identical to what `getMessages()` returns at runtime. Every later task relies on `@/test/render` already wiring this in; no later task touches these two files.

- [ ] **Step 1: Write the failing test**

Create `test/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NAMESPACES } from "@/lib/i18n/namespaces";
import { loadEnMessages } from "./messages";

describe("loadEnMessages", () => {
  it("returns one entry per declared namespace", () => {
    const messages = loadEnMessages();
    expect(Object.keys(messages).sort()).toEqual([...NAMESPACES].sort());
  });

  it("returns real message content, not empty objects", () => {
    const messages = loadEnMessages();
    expect(messages.common).toMatchObject({ appName: "Nihongo Cinema" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/messages.test.ts`
Expected: FAIL — `Failed to resolve import "./messages"`.

- [ ] **Step 3: Implement the loader**

Create `test/messages.ts`:

```ts
import { NAMESPACES } from "@/lib/i18n/namespaces";

/**
 * The EN catalogs, merged exactly as `getMessages()` merges them at runtime.
 *
 * `import.meta.glob` is a Vite feature (Vitest runs on Vite), so a namespace
 * added under `messages/en/` is picked up with zero churn here — which is what
 * keeps "adding a feature requires no foundation change" true (spec 5.1 #4)
 * on the test side too.
 *
 * Why real messages rather than `{}`: the regression suite asserts on English
 * user-visible text (spec D6). Serving the real EN catalog is what makes an
 * extracted component render byte-identically to the hardcoded one it
 * replaced, so those assertions keep passing through the refactor.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../messages/en/*.json",
  { eager: true },
);

export function loadEnMessages(): Record<string, unknown> {
  const byNamespace = Object.fromEntries(
    Object.entries(modules).map(([path, mod]) => [
      path.replace(/^.*\/(.+)\.json$/, "$1"),
      mod.default,
    ]),
  );
  // Return only DECLARED namespaces so an orphaned JSON file on disk cannot
  // silently start serving messages (catalog.test.ts owns that invariant).
  return Object.fromEntries(
    NAMESPACES.map((namespace) => [namespace, byNamespace[namespace]]),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/messages.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire the loader into the test provider**

In `test/render.tsx`, replace the `customRender` function and update the docblock's stale claim that no messages are supplied:

```tsx
import { loadEnMessages } from "./messages";

const messages = loadEnMessages();

function customRender(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
```

Also replace this stale paragraph in the docblock:

```
 * Locale is pinned to `en` (matches the e2e suite's D6 pin — Task 5). No
 * messages are supplied: Plan 3 (string extraction) hasn't landed yet, so
 * nothing under test calls `useTranslations()`.
```

with:

```
 * Locale is pinned to `en` (spec D6): the regression suite asserts on English
 * user-visible text, and the EN catalog is extracted verbatim, so those
 * assertions survive extraction unchanged. The real EN catalogs are supplied
 * (see ./messages) — a component under test that calls t() must render the
 * same text it rendered when the string was hardcoded.
```

- [ ] **Step 6: Verify the whole suite is still green**

Run: `npx vitest run`
Expected: 1295 passed (1293 baseline + 2 new), 175 files. No failures.

- [ ] **Step 7: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc exits 0. Lint exits 0 with 80 warnings (no new ones).

- [ ] **Step 8: Commit**

```bash
git add test/messages.ts test/messages.test.ts test/render.tsx
git commit -m "test(i18n): serve real EN catalogs from the test provider

The regression suite asserts on English user-visible text (spec D6). Extraction
replaces a hardcoded string with t(), so the provider must resolve that key to
the same English text or every assertion in the module dies. import.meta.glob
keeps new namespaces zero-churn."
```

---

### Task 2: Pilot module — `common` + `nav`

**Why these two together:** `nav` is the smallest real module with genuine UI, and it needs `common` (Sign out lives in the nav but is shared shell copy). Doing them together makes the pilot prove both the single-namespace path and the promotion-to-`common` path (P4). Every later module task is this task with different files.

**Files:**
- Modify: `messages/en/common.json`, `messages/vi/common.json`, `messages/en/nav.json`, `messages/vi/nav.json`
- Modify: `lib/i18n/namespaces.ts` (no change — both already declared)
- Modify: `types/messages.d.ts` (no change — both already declared)
- Modify: `components/layout/app-nav.tsx`
- Test: `components/layout/notification-bell.test.tsx` (switch to `@/test/render`)

**Interfaces:**
- Consumes: `@/test/render` from Task 1.
- Produces: the `common` namespace, which every later task may read for shared strings (`common.actions.save`, `common.actions.cancel`, `common.actions.close`, `common.states.loading`, `common.states.error`). Later tasks **add** to `common` when promoting a shared string; they never restructure it.

- [ ] **Step 1: Write the failing test**

Create `components/layout/app-nav.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AppNav } from "./app-nav";

vi.mock("@/lib/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/i18n/navigation")>(
    "@/lib/i18n/navigation",
  );
  return { ...actual, usePathname: () => "/dashboard" };
});

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));

describe("AppNav", () => {
  it("renders every nav destination from the catalog", () => {
    render(<AppNav userEmail="learner@example.com" />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kanji" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leaderboard" })).toBeInTheDocument();
  });

  it("marks the active destination", () => {
    render(<AppNav userEmail="learner@example.com" />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the sign-out control from the shared namespace", () => {
    render(<AppNav userEmail="learner@example.com" />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it passes for the wrong reason**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: PASS — the strings are still hardcoded, so this test currently passes. **That is the point:** it pins the exact English output *before* extraction, so if extraction changes any rendered text the test goes red. Record this in the commit message. Do not skip this step.

- [ ] **Step 3: Fill the catalogs**

Replace `messages/en/nav.json`:

```json
{
  "ariaLabel": "Main",
  "dashboard": "Dashboard",
  "kanji": "Kanji",
  "vocab": "Vocab",
  "grammar": "Grammar",
  "videos": "Videos",
  "mining": "Mining",
  "reading": "Reading",
  "conversation": "Conversation",
  "jlpt": "JLPT",
  "community": "Community",
  "playlists": "Playlists",
  "leaderboard": "Leaderboard",
  "profile": "Profile"
}
```

Replace `messages/vi/nav.json`:

```json
{
  "ariaLabel": "Chính",
  "dashboard": "Bảng điều khiển",
  "kanji": "Kanji",
  "vocab": "Từ vựng",
  "grammar": "Ngữ pháp",
  "videos": "Video",
  "mining": "Thu thập câu",
  "reading": "Đọc hiểu",
  "conversation": "Hội thoại",
  "jlpt": "JLPT",
  "community": "Cộng đồng",
  "playlists": "Danh sách phát",
  "leaderboard": "Bảng xếp hạng",
  "profile": "Hồ sơ"
}
```

Replace `messages/en/common.json`:

```json
{
  "appName": "Nihongo Cinema",
  "appNameJp": "日本語シネマ",
  "auth": { "signIn": "Sign in", "signOut": "Sign out", "signUp": "Create account" },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "close": "Close",
    "back": "Back",
    "next": "Next",
    "retry": "Try again"
  },
  "states": {
    "loading": "Loading…",
    "error": "Something went wrong.",
    "empty": "Nothing here yet."
  },
  "a11y": { "closeDialog": "Close dialog", "dismissNotification": "Dismiss notification" }
}
```

Replace `messages/vi/common.json`:

```json
{
  "appName": "Nihongo Cinema",
  "appNameJp": "日本語シネマ",
  "auth": { "signIn": "Đăng nhập", "signOut": "Đăng xuất", "signUp": "Tạo tài khoản" },
  "actions": {
    "save": "Lưu",
    "cancel": "Huỷ",
    "delete": "Xoá",
    "close": "Đóng",
    "back": "Quay lại",
    "next": "Tiếp theo",
    "retry": "Thử lại"
  },
  "states": {
    "loading": "Đang tải…",
    "error": "Đã có lỗi xảy ra.",
    "empty": "Chưa có gì ở đây."
  },
  "a11y": { "closeDialog": "Đóng hộp thoại", "dismissNotification": "Bỏ qua thông báo" }
}
```

Note `appNameJp` is the same in both locales — the Japanese wordmark is a brand asset, not copy. It lives in the catalog anyway so no component hardcodes it.

- [ ] **Step 4: Run the catalog parity gate**

Run: `npx vitest run lib/i18n/catalog.test.ts`
Expected: PASS, 3 tests — identical key sets and identical ICU arguments across `vi` and `en`.

- [ ] **Step 5: Extract the component**

In `components/layout/app-nav.tsx`: replace the `NAV_ITEMS` label literals with message keys, and read them through `t`.

```tsx
"use client";

import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

/** href → nav catalog key. Keys, not labels: the words live in messages/. */
const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/kanji", key: "kanji" },
  { href: "/vocab", key: "vocab" },
  { href: "/grammar", key: "grammar" },
  { href: "/videos", key: "videos" },
  { href: "/mining", key: "mining" },
  { href: "/reading", key: "reading" },
  { href: "/conversation", key: "conversation" },
  { href: "/jlpt", key: "jlpt" },
  { href: "/community", key: "community" },
  { href: "/playlists", key: "playlists" },
  { href: "/leaderboard", key: "leaderboard" },
  { href: "/profile", key: "profile" },
] as const;

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

      <ul className="flex flex-1 flex-wrap gap-1 md:flex-col md:flex-nowrap">
        {NAV_ITEMS.map((item) => {
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
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>

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

- [ ] **Step 6: Run the pinning test to verify the output is unchanged**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: PASS, 3 tests — same English text, now sourced from the catalog. A failure here means extraction changed user-visible copy; fix the catalog, not the test.

- [ ] **Step 7: Move the module's remaining tests onto the provider**

In `components/layout/notification-bell.test.tsx`, change the import:

```ts
import { render, screen, waitFor } from "@/test/render";
```

(remove the `@testing-library/react` import line — `@/test/render` re-exports everything from it). `fireEvent`, `act`, `within` etc. all come from the same place.

Run: `npx vitest run components/layout/`
Expected: PASS — all layout tests.

- [ ] **Step 8: Verify the full suite, types, and lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: 1298 passed / 176 files. tsc 0. Lint 0 errors, 80 warnings.

- [ ] **Step 9: Commit**

```bash
git add messages components/layout
git commit -m "feat(i18n): extract nav + common namespaces

Pilot for the per-module extraction pattern: pin the English output with a test
BEFORE extracting, fill both catalogs in one commit (catalog.test.ts requires
key parity, so an EN-only commit is red), then swap the module's tests onto the
provider-wrapped render."
```

---

### Tasks 3–16: per-module extraction

**Every one of these tasks follows Task 2's nine steps exactly.** They are not repeated per task; re-read Task 2 if you are executing any of them cold. What differs per task is only: the namespace, the source files, the test files to move onto `@/test/render`, and the module-specific notes below.

The per-task procedure, restated compactly:

1. Write/extend a test that **pins the current English output** of the module's main component(s), using `@/test/render`. Run it — it must pass while strings are still hardcoded.

   **Pin every string you are about to extract, not a sample.** A test that spot-checks 3 of 13 labels goes green for a typo in the other 10, which defeats the entire point: this test is the only thing standing between a careless extraction and silently changed user-visible copy. Where the strings come from a list the component already iterates (nav items, variants, tabs), iterate the same list in the test rather than hand-picking entries — that way the test cannot fall behind the component. Include accessibility strings (`aria-label`, `alt`) in the pin; they are user-visible to anyone using a screen reader.

   **The expected values MUST be literal strings written in the test. Never import the catalog you are pinning and assert against its values.** `@/test/render` feeds the component that very same JSON file, so an assertion sourced from it compares the file to itself: introduce a typo in `messages/en/nav.json` and both the rendered output and the expected value change together, and the test stays green. This mistake is easy to make and looks *more* rigorous than the thing it replaces — the pilot task made it, the review caught it, and it would otherwise have been copied 14 times. Iterating the component's list for *coverage* is right; deriving the *expected text* from the catalog is not. Importing the catalog solely to assert its key set matches the component's list is fine — that is a structural check, not a content check.

   Where a component's strings are not enumerable that way, assert each extracted string explicitly. If the module is large enough that this feels tedious, that is the correct amount of work — 592 existing assertions are riding on English staying byte-identical.
2. Register the namespace in **all three** places: `lib/i18n/namespaces.ts` (`NAMESPACES` array), `types/messages.d.ts` (`import type <ns> from "../messages/en/<ns>.json"` plus the `Messages` entry), and create both `messages/en/<ns>.json` and `messages/vi/<ns>.json`.
3. Fill the EN catalog by copying strings **verbatim** out of the source files; fill VN using the glossary.
4. Run `npx vitest run lib/i18n/catalog.test.ts` — parity must pass before you touch a component.
5. Replace literals with `t()` — `useTranslations("<ns>")` from `@/lib/i18n` in client components, `await getTranslations("<ns>")` from `@/lib/i18n/server` in async server components.
6. Re-run the pinning test — English output must be byte-identical.
7. Switch that module's `.test.tsx` files from `@testing-library/react` to `@/test/render`.
8. `npx vitest run && npx tsc --noEmit && npm run lint` — full suite green, no new warnings.
9. Commit with `feat(i18n): extract <ns> namespace`.

**Server-component note (applies to most `page.tsx` files):** a page that is `async` uses `await getTranslations("<ns>")`. A page that is not async must be made async, or the translation read must move into a client child. Prefer making the page async — it is already a server component and `getTranslations` is the sanctioned server API. **Do not** remove any existing `setRequestLocale` call; removing it silently drops the page out of static rendering (spec §7 risk 2).

---

### Task 3: `common` extensions — UI primitive default labels

**Files:**
- Modify: `components/ui/dialog.tsx:49` (`closeLabel` default), `components/ui/toast.tsx:47` (`dismissLabel` default)
- Modify: `app/[locale]/layout.tsx` (pass the translated `dismissLabel` into `ToastProvider`)
- Test: `components/ui/dialog.test.tsx`, `components/ui/toast.test.tsx`

**Interfaces:**
- Consumes: `common.a11y.closeDialog`, `common.a11y.dismissNotification` (created in Task 2).

**Module notes — this one deviates from the standard procedure and is worth reading carefully.**

`components/ui/**` is the design-system foundation, not feature code. A primitive must **not** call `useTranslations` itself: that would make every primitive depend on the localization capability, coupling the two foundations that §4.5 says are independent. Instead the primitive keeps its `closeLabel?: string` / `dismissLabel?: string` props, and **the caller passes translated text**. The English default stays as a last-resort fallback for callers that pass nothing.

Concretely:
- `components/ui/dialog.tsx` and `components/ui/toast.tsx` keep their current signatures and defaults **unchanged**. No edit is needed there. Verify this and record it — the review follow-up said "pass translated labels into Dialog/ToastProvider", which is a call-site change, not a primitive change.
- `app/[locale]/layout.tsx` already renders `<ToastProvider>`. It is an async server component with `getMessages()` in scope. Add:

```tsx
import { getMessages, setRequestLocale, getTranslations } from "next-intl/server";
```

(this file is on the ESLint escape-hatch list, so importing `next-intl/server` directly here is allowed — it is foundation wiring, not feature code)

and inside the component, after `setRequestLocale(locale)`:

```tsx
  const t = await getTranslations("common");
```

then:

```tsx
          <ThemeProvider>
            <ToastProvider dismissLabel={t("a11y.dismissNotification")}>
              {children}
            </ToastProvider>
          </ThemeProvider>
```

- Every **feature** call site of `<Dialog>` passes `closeLabel={tCommon("a11y.closeDialog")}`. Find them with:

```bash
grep -rn "<Dialog" --include=*.tsx components app | grep -v node_modules
```

Handle each hit found; `components/admin/confirm-dialog.tsx` is known to be one (it is the thin wrapper over the ui dialog).

- [ ] **Step 1:** Write a failing test in `components/ui/toast.test.tsx` asserting `ToastProvider` renders a dismiss control whose accessible name is the passed `dismissLabel`, and that it falls back to `"Dismiss notification"` when the prop is omitted.
- [ ] **Step 2:** Run `npx vitest run components/ui/toast.test.tsx` — the fallback case passes, the passed-label case tells you whether the prop is honoured. Fix only if red.
- [ ] **Step 3:** Make the layout + call-site changes above.
- [ ] **Step 4:** Run `npx vitest run components/ui components/admin && npx tsc --noEmit`. Expected: green.
- [ ] **Step 5:** Commit — `git commit -m "feat(i18n): pass localized a11y labels into dialog and toast"`.

---

### Task 4: `auth` namespace + the callback re-prefix defect

**Files:**
- Create: `messages/{en,vi}/auth.json`
- Modify: `app/[locale]/(auth)/login/page.tsx`, `app/[locale]/(auth)/register/page.tsx`, `app/[locale]/(auth)/layout.tsx`, `app/[locale]/(auth)/actions.ts`, `components/auth/auth-form.tsx`
- Modify: `app/auth/callback/route.ts` — **the defect fix**
- Test: `components/auth/` (no test file exists — create `components/auth/auth-form.test.tsx`)

**Module notes:**

**The defect (carried from Plan 1's final review).** `app/auth/callback/route.ts` ends with:

```ts
  return NextResponse.redirect(`${origin}/login?error=auth`);
```

`/login` has no locale prefix. This route is deliberately excluded from the intl middleware matcher (Plan 1 load-bearing item #3 — including it breaks every Google sign-in), so nothing will add the prefix for it. A user whose code exchange fails lands on an unprefixed URL. Fix it the same way the success branch already learns the locale — from the `next` parameter that `actions.ts` forwards:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { routing } from "@/lib/i18n/routing";
import { stripLocale } from "@/lib/i18n/locale-path";

/** OAuth / email-confirmation callback: exchange the code for a session. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  // This route is excluded from the intl middleware (including it would 307
  // /auth/callback to /vi/auth/callback and break every Google sign-in), so
  // nothing adds a locale prefix on our behalf. `next` is built by
  // app/[locale]/(auth)/actions.ts and carries the locale the user was on;
  // recover it there, and fall back to the default locale.
  const locale = next ? stripLocale(next).locale ?? routing.defaultLocale
                      : routing.defaultLocale;
  const redirectTo = next ?? `/${locale}/dashboard`;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=auth`);
}
```

`stripLocale`'s signature was verified against `lib/i18n/locale-path.ts` while writing this plan: it returns `{ locale: Locale | null; pathname: string }`, matching case-insensitively and returning the canonical lowercase locale. `?? routing.defaultLocale` therefore handles the unprefixed case correctly. If you find otherwise, the repo is right and this plan is wrong — say so and adapt.

**Server-action error strings.** `actions.ts` returns `{ error: "Invalid email or password." }` to the client. Translate it at the point of return with `await getTranslations("auth")` — the action is server-side and already awaits `getLocale()`, so the request locale is available. **Do not** return a message key for the client to translate: that would leak catalog structure across the boundary and make the error shape a contract.

One error string must NOT be translated: `return { error: error.message }` in `register()` is Supabase's own message. Leave it — translating third-party error text is out of scope and would require mapping their error codes. Record it as a known gap.

- [ ] Follow Task 2's nine steps, with the callback fix folded into the same task.
- [ ] Extra step before committing: **write the e2e round-trip test** (carried follow-up). Add to `tests/e2e/` a spec that registers a user, lands on `/en/dashboard`, signs out, signs back in via the form, and asserts the URL is `/en/dashboard` — proving the locale survives the full login round trip and `actions.ts`'s strip/re-add logic does not double-prefix. Run `npx playwright test` and paste the output.
- [ ] Commit: `feat(i18n): extract auth namespace; fix unprefixed callback error redirect`.

---

### Task 5: `marketing` namespace + the "Start free trial" copy defect

**Files:**
- Create: `messages/{en,vi}/marketing.json`
- Modify: `app/[locale]/(marketing)/page.tsx`, `app/[locale]/(marketing)/layout.tsx`, `components/layout/site-header.tsx`
- Modify: `tests/e2e/home.spec.ts`

**Module notes:**

**The copy defect (spec §9.1).** **The business model has no trial** (`docs/product/business-model.md`; conversion is Contextual Discovery, single tier 49k/490k, Founding 39k). Translating that into Vietnamese would ship a falsehood in two languages. This is the **only** authorized EN copy change in this plan.

There are **three** instances, not the one the spec mentions. The third was found during the 2026-07-19 style-guide browser pass and is the worst of them — a grep for `"free trial"` does not catch it:

| File | Current copy | New copy | VN |
|---|---|---|---|
| `app/[locale]/(marketing)/page.tsx:21` | "Start free trial" | "Get started free" | "Bắt đầu miễn phí" |
| `components/layout/site-header.tsx:22` | "Start free" | "Get started" | "Bắt đầu" |
| `app/[locale]/(auth)/register/page.tsx:9` | **"Start your 7-day trial"** | "Create your account" | "Tạo tài khoản của bạn" |

The register page also carries the subtitle "No card required." — that one is **true** and stays (translate it normally; it belongs to the `auth` namespace, Task 4, not here).

The replacements are all true: the product genuinely has a free tier (value-based Free/Premium — computed-from-your-data is free), and none implies a time-limited trial. Search `grep -rn "trial\|7-day" --include=*.tsx app components` and confirm zero non-test hits before closing this task.

`tests/e2e/home.spec.ts` asserts `name: /start free trial/i` and **will go red** — that is correct and expected. Update it to `/get started free/i` in the same commit. This is the one place a red test is not a bug.

- [ ] Follow Task 2's nine steps.
- [ ] Extra step: update `tests/e2e/home.spec.ts`, run `npx playwright test`, expect 2/2 (3/3 once Task 4's spec exists), paste output.
- [ ] Commit: `feat(i18n): extract marketing namespace; drop the false "free trial" claim`.

---

### Task 6: `dashboard` namespace

**Files:** `app/[locale]/(app)/dashboard/page.tsx`, `app/[locale]/(app)/layout.tsx`, `components/learning/{level-card,streak-card,badges-grid}.tsx` and their siblings that the dashboard renders.
**Tests to move onto `@/test/render`:** `components/learning/badges-grid.test.tsx`, `level-card.test.tsx`, `streak-card.test.tsx`.
**Notes:** Streak and level copy is where pluralization is real — use ICU `plural`, and remember VN has no plural inflection (see the key-naming convention). Glossary: streak = "Chuỗi ngày học", level = "Cấp độ", badge = "Huy hiệu", XP stays "XP".

### Task 7: `kanji` namespace

**Files:** `app/[locale]/(app)/kanji/{page,[id]/page,review/page}.tsx` (162 LOC) and the kanji-specific parts of `components/learning/`.
**Notes:** SRS grade buttons (Again/Hard/Good/Easy) and "Show answer" are shared with vocab and mining review — **promote them to `common.srs.*`** rather than duplicating into three namespaces (P4). Do this promotion here, in the first module that needs them; Tasks 8 and 12 then consume `common.srs.*`. The e2e spec asserts `/show answer/i` and `/good/i` in English — keep the EN text byte-identical.

### Task 8: `vocab` namespace

**Files:** `app/[locale]/(app)/vocab/{page,[id]/page,review/page}.tsx` (134 LOC), `components/learning/vocab-examples-panel.tsx`.
**Tests to move:** `components/learning/vocab-examples-panel.test.tsx`.
**Notes:** consumes `common.srs.*` from Task 7. The AI-generated example panel has a visible "AI generated" label — that label is a **compliance surface** (CLAUDE.md AI content labeling), so translate it but never remove it.

### Task 9: `grammar` namespace

**Files:** `app/[locale]/(app)/grammar/page.tsx` (69 LOC).
**Notes:** smallest content module. Learning content itself (the grammar points) is **not** localized (spec D8) — only the chrome around it.

### Task 10: `videos` namespace

**Files:** `app/[locale]/(app)/videos/page.tsx` (148 LOC), `components/video/*` (169 LOC), the recommendation rail.
**Tests to move:** `components/video/` tests.
**Notes:** includes the import form and its validation messages, and the i+1 difficulty labels ("ideal / too easy / too hard").

### Task 11: `shadowing` + `dictation` namespaces

**Files:** `app/[locale]/(app)/videos/[id]/{shadowing,dictation}/page.tsx`, and the shadowing/dictation halves of `components/video-player/` — `shadowing-view.tsx`, `shadowing-recorder-panel.tsx`, `recorder.tsx`, `waveform.tsx`, `dictation-view.tsx`, `transcript-pane.tsx`, `pitch-contour-overlay.tsx`, `video-summary-panel.tsx`, `youtube-player.tsx`.
**Tests to move:** the matching `.test.tsx` files in `components/video-player/` (9 of them).
**Notes:** the largest module in the app (2 839 LOC across `components/video-player/`, split across this task and Task 12). Two namespaces because shadowing and dictation are distinct features with distinct owners (P4) even though they share the player shell; anything genuinely shared by both (player controls, speed, A–B loop) goes to `common.player.*`. Glossary: shadowing stays "Shadowing", dictation = "Nghe chép chính tả", transcript = "Phụ đề", pitch accent = "Trọng âm cao thấp". **Watch the two known flakes here** (`pitch-contour.test.tsx`, `waveform.test.tsx`) — re-run standalone before believing a failure.

### Task 12: `mining` namespace

**Files:** `app/[locale]/(app)/mining/{page,review/page}.tsx`, `components/video-player/{mine-line-control,mining-deck-list,mining-clip-player}.tsx`.
**Tests to move:** the three matching test files.
**Notes:** consumes `common.srs.*` from Task 7. Glossary: mining = "Thu thập câu".

### Task 13: `jlpt` namespace

**Files:** `app/[locale]/(app)/jlpt/{page,[id]/page}.tsx` (85 LOC), `app/[locale]/(app)/jlpt-test/page.tsx`, `components/jlpt/*` (965 LOC, 10 components).
**Tests to move:** `components/jlpt/{jlpt-listening-play-button,jlpt-question-card,jlpt-timer}.test.tsx`.
**Notes:** the timer's `aria-live` warning strings are accessibility copy — nest under `a11y` and keep the ICU time arguments identical across locales (parity test enforces this). Pillar names and pass/fail result copy live here. **JLPT level labels (N5–N1) are not translated.**

### Task 14: `reading` namespace

**Files:** `app/[locale]/(app)/reading/{page,[id]/page}.tsx`, `components/reading/*` (709 LOC, 7 components).
**Tests to move:** all 7 `components/reading/*.test.tsx`.
**Notes:** reading passages themselves are content, not chrome — not localized (D8). The furigana toggle, translation disclosure, and word-lookup popover chrome are.

### Task 15: `conversation` namespace

**Files:** `app/[locale]/(app)/conversation/page.tsx`, `components/conversation/*` (918 LOC, 6 components).
**Tests to move:** all 6 `components/conversation/*.test.tsx`.
**Notes:** includes the scenario picker's scenario names and the AI-not-configured 503 degrade copy. The degrade path must stay visible and honest in both locales — it is the launch-state behaviour (`AI_PROVIDER=none`).

### Task 16: `community` + `playlists` + `leaderboard` + `profile` namespaces

**Files:** `app/[locale]/(app)/{community,playlists,leaderboard,profile}/**`, `components/community/*` (2 294 LOC, 18 components).
**Tests to move:** all 10 bare-RTL `components/community/*.test.tsx`.
**Notes:** four namespaces in one task because they share `components/community/` and splitting the directory across tasks would mean touching the same files repeatedly. If this task feels too large during execution, split it at the file boundary (community+peer-review | playlists+leaderboard+profile) and commit twice — that is a legitimate call for the executing agent to make. Peer-review consent copy is a **privacy surface**: translate precisely, never soften what the learner is agreeing to.

### Task 17: `admin` + `companion` namespaces

**Files:** `app/[locale]/(admin)/admin/**` (120 LOC), `components/admin/*` (1 234 LOC), `components/style-guide/*` (385 LOC); `lib/companion/dedupe.ts`, `lib/data/companion.ts`, `app/api/companion/journal/route.ts`.
**Tests to move:** `components/admin/{confirm-dialog,content-manager,stats-dashboard,video-queue}.test.tsx`.

**Module notes — the Companion half is the subtle one.**

`lib/companion/dedupe.ts`'s `titleFor()` returns rendered Vietnamese copy, and `lib/data/companion.ts:69` **persists that string into `companion_memories.title`** at capture time, from a service-role write path with no request locale in scope. So "move the titles into i18n" cannot mean "call `t()` inside `titleFor`" — there is no locale there, and the result is already in the database by the time any locale is known.

The fix is to stop persisting rendered copy and persist the **facts** instead, rendering at read time:

1. `title` is already nullable (`migration 20260716000015`, `title text`). For **discovered** memories, write `title: null`. Gifted pins keep supplying the learner's own title — that is the learner's words, never translated.
2. Replace `titleFor` with a descriptor function in `lib/companion/dedupe.ts`:

```ts
export interface MemoryTitleDescriptor {
  /** Key within the `companion` namespace. */
  key: string;
  /** ICU values for that message. */
  values: Record<string, string | number>;
}

/** The message descriptor for a discovered memory's title (spec §4.4) — NEVER
 * AI-generated. Returns null for gifted pins: the learner supplies their own
 * title, and their words are never translated.
 *
 * Returns a descriptor rather than a string because titles are rendered at
 * READ time, in the reader's locale. Rendering at capture time would freeze
 * one locale's copy into the database (the capture gate is a service-role
 * write path with no request locale in scope). */
export function memoryTitleFor(
  type: MemoryType,
  ref: MemoryRef = {},
): MemoryTitleDescriptor | null {
  switch (type) {
    case "first_shadow":
      return { key: "memoryTitle.firstShadow", values: {} };
    case "line_mastered":
      return { key: "memoryTitle.lineMastered", values: {} };
    case "mining_saved":
      return { key: "memoryTitle.miningSaved", values: {} };
    case "first_video_completed":
      return { key: "memoryTitle.firstVideoCompleted", values: {} };
    case "jlpt_passed":
      return { key: "memoryTitle.jlptPassed", values: { level: ref.jlptLevel ?? "" } };
    case "companion_grew":
      return { key: `memoryTitle.companionGrew.${ref.phase ?? 1}`, values: {} };
    case "pinned_line":
      return null;
  }
}
```

3. **The P12 violation.** The old copy read `Ngày người bạn đồng hành của bạn bước sang giai đoạn ${ref.phase}` — a raw phase index surfaced to the learner. The Companion spec's P12 forbids exposing stage numbers, and `lib/companion/types.ts` says outright: *"Never called 'stage' — that imports a game/levelling mindset P12 rejects."* Phase thresholds are hidden tuning constants. So the catalog carries **four distinct phrasings keyed by phase, none containing a number**:

`messages/vi/companion.json`:

```json
{
  "memoryTitle": {
    "firstShadow": "Câu thoại đầu tiên bạn shadowing thành công.",
    "lineMastered": "Câu bạn luyện mãi rồi cuối cùng cũng nói được.",
    "miningSaved": "Câu bạn quyết định lưu lại.",
    "firstVideoCompleted": "Video đầu tiên bạn hoàn thành.",
    "jlptPassed": "Cột mốc JLPT {level}",
    "companionGrew": {
      "1": "Ngày hai đứa mình gặp nhau.",
      "2": "Ngày người bạn đồng hành của bạn thấy gần gũi hơn.",
      "3": "Ngày người bạn đồng hành của bạn thật sự hiểu bạn.",
      "4": "Ngày người bạn đồng hành của bạn đi cùng bạn đủ lâu để nhớ hết chặng đường."
    }
  }
}
```

`messages/en/companion.json` — same keys, English equivalents, `"jlptPassed": "JLPT {level} milestone"`, and four `companionGrew` phrasings carrying no numbers.

4. `lib/data/companion.ts:69` — replace `title: titleFor(input.memoryType, input.ref)` with `title: null`, and add a comment pointing at the read-time rendering. Update `lib/companion/dedupe.test.ts`'s `titleFor` describe block to test `memoryTitleFor` instead: assert `first_shadow` returns a descriptor, `pinned_line` returns null, and `companion_grew` with `phase: 2` returns key `memoryTitle.companionGrew.2` **and that no returned value contains a bare digit-as-stage** — the P12 regression guard.
5. Existing local rows keep their old persisted titles. There are no production users; this is dev data only. Do **not** write a backfill migration — L9a ships no schema change (D8), and `companion_memories` has no UPDATE grant for `authenticated` by design.
6. There is **no Journal UI yet** (it is L9b, Companion Plan 2). This task therefore ships the descriptor + catalogs + parity, and L9b's Journal renders `t(descriptor.key, descriptor.values)`. `GET /api/companion/journal` continues to return the row as-is (with `title: null` for discovered memories) — do not invent a rendering endpoint for a UI that does not exist yet (YAGNI).

- [ ] Follow Task 2's nine steps for `admin`; fold the Companion changes above into the same task with their own test-first cycle.
- [ ] Commit: `feat(i18n): extract admin + companion namespaces; render memory titles at read time`.

---

### Task 18: Page metadata

**Files:** all 25 `page.tsx` files carrying `export const metadata`, plus `app/[locale]/layout.tsx`'s root metadata.

**Module notes:**

`export const metadata = { title: "Kanji" }` is a static export — it cannot call `getTranslations`. Each becomes `generateMetadata`.

**It must take `params` and pass the locale explicitly.** `generateMetadata` runs in its own scope; a bare `await getTranslations("kanji")` there relies on ambient request state and will either throw or silently drop the page out of static rendering — spec §7 risk 2, the trap that produces no error, just a slower site. Pass the locale through:

```tsx
import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "kanji" });
  return { title: t("title") };
}
```

After converting each route group, confirm in `npm run build`'s route table that pages which were `●` (SSG) are still `●`. A page that silently became `ƒ` means the locale was not threaded correctly.

Reuse the namespace's existing `title` key — do not add a parallel `metaTitle` unless the page heading and the browser-tab title genuinely differ (the admin pages do: `"Admin — Content"` vs the page's own heading).

The root layout's `metadata` (title template + description) moves into `generateMetadata` reading `common`. **Keep the `"%s · Nihongo Cinema"` template** — the separator and brand are not translated.

`app/[locale]/(admin)/admin/content/[type]/page.tsx` already has a `generateMetadata` taking `params` — extend it rather than replacing it.

- [ ] **Step 1:** Add `meta` keys to the affected namespaces where the tab title differs from the heading; run `npx vitest run lib/i18n/catalog.test.ts` for parity.
- [ ] **Step 2:** Convert each `export const metadata` to `generateMetadata`, one route group per commit (marketing/auth, then (app), then (admin)) so a build failure localizes.
- [ ] **Step 3:** Run `npm run build`. Expected: succeeds in ~52s. **Check the route table**: every page without a dynamic segment must still be SSG per locale (a `ƒ` on a previously-static route means a `setRequestLocale` was dropped — spec §7 risk 2). The 9 pre-existing `ƒ` routes are the `[id]`/`[type]` ones.
- [ ] **Step 4:** Commit per route group.

---

### Task 19: Final gate

**Files:** none created. This task verifies and records.

- [ ] **Step 1: Prove no hardcoded UI strings remain**

Run a sweep for JSX text nodes that are still literal English:

```bash
grep -rnE '>[A-Z][a-z]+( [a-z]+)* *<' --include=*.tsx app components | grep -v '\.test\.' | grep -v node_modules
```

Every hit is either a genuine miss (fix it) or a justified exception (brand wordmark, JLPT level label, Japanese text). **List the exceptions explicitly in the commit message** — an unexplained hit is a miss.

Also sweep string attributes:

```bash
grep -rnE '(aria-label|placeholder|alt)="[A-Za-z]' --include=*.tsx app components | grep -v '\.test\.' | grep -v node_modules
```

- [ ] **Step 2: Catalog parity across all 21 namespaces**

Run: `npx vitest run lib/i18n/catalog.test.ts`
Expected: PASS, 3 tests, covering all namespaces × both locales.

- [ ] **Step 3: Full regression suite**

Run: `npx vitest run`
Expected: ≥1293 passing, 0 failures. Any failure in `pitch-contour.test.tsx` or `waveform.test.tsx` — re-run standalone before believing it.

- [ ] **Step 4: Types, lint, build, e2e**

```bash
npx tsc --noEmit
npm run lint
npm run build
npx playwright test
```

Expected: tsc 0 · lint exit 0 with **no more than 80 warnings** (the pre-existing debt; zero new) · build succeeds · playwright green (3 specs once Task 4's round-trip lands).

- [ ] **Step 5: Manual Vietnamese pass in the browser**

`npm run dev`, then walk `/vi` through: landing → register → dashboard → kanji → vocab review → videos → shadowing → jlpt → reading → conversation → community → profile → `/vi/admin`. Check for: untranslated English leaking through, layout breakage from longer Vietnamese strings (VN runs ~20–30% longer than EN — buttons and nav are where it shows), and diacritics clipping against tight line-heights. Then spot-check `/en` on three surfaces to confirm English is unchanged.

**Record what you find rather than fixing silently** — a layout break is L9c's polish work unless it makes a surface unusable, in which case fix it here and say so.

- [ ] **Step 6: Update the Serena memories**

Update `mem:project_status` (L9a complete, all three plans merged; new baseline counts) and `mem:l9a_localization_run_state` (Plan 3 outcome, any deferred items). Mark `mem:feature_backlog_deferred` **item #10 DONE** with the merge commit — it has been open since Layer 5 and this plan is what closes it.

- [ ] **Step 7: Request code review**

Use `superpowers:requesting-code-review` for a whole-branch review before merge, per CLAUDE.md §9.

---

## Deferred, recorded not forgotten

Carried into L9b/L9c rather than done here:

- **Client message payload** — `NextIntlClientProvider` ships all 21 namespaces in the RSC payload. Deliberate (spec §7 risk 3); now materially larger than at Plan 1. **Filed as a specific L9c perf-audit item.**
- **Supabase's own error text** (`register()`'s `error.message`) stays English — mapping their error codes is out of scope (Task 4).
- **Learning content stays Vietnamese for every locale** (spec D8) — an EN user sees an EN shell over VN content. Content localization is an independent future layer.
- **Locale synced to the DB profile** — needs a schema change (D5); backlog.
- **Deferred from Plan 2's review triage**: scrim-dark-check scope, popover `vi.fn`, tabs arrow-key coverage, select disabled/ref tests. If not picked up here, they carry to L9b.
- **Existing `companion_memories.title` rows** keep their persisted Vietnamese copy (Task 17, step 5) — dev data only, no backfill.
