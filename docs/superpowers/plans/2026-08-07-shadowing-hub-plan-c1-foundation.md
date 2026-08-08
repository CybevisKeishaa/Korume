# Shadowing Hub — Plan C1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the route, token, layout, navigation and data foundations that the Shadowing Hub (C2) and Explore Lessons (C3) both sit on, without porting either screen.

**Architecture:** Five independent foundations, sequenced so each is testable alone: (1) a `--layout-*` token namespace kept separate from `--space-*`, plus one new spacing step; (2) a `TwoColumnShell` primitive; (3) the `/videos` → `/shadowing` route family move with temporary redirects; (4) `NAV_GROUPS` completed to its canonical 22 rows, with the nine destinations that do not exist yet created as honest empty-state routes; (5) a data layer for collections, the situation/source taxonomy, and lesson ranking behind an interface.

**Tech Stack:** Next.js 14.2.35 App Router · TypeScript strict · Tailwind v3 with CSS-variable token scales · next-intl 4.13.2 (vi/en, prefix "always") · Supabase Postgres · Vitest + RTL · Playwright.

**Spec:** `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` (LOCKED, `22c9d18`). Section references below (§3.1, D7, …) point into it.

## Global Constraints

- **Rule #0 — semantic tokens are the public design API.** Never port a pixel value from Figma into a component. Every value maps to a token. `components/ui/token-scale.test.ts` and `token-scale-adoption.test.ts` enforce this inside `components/ui/**`.
- **No new spacing steps beyond the one this plan adds.** 28px and 36px round to `--space-lg` / `--space-xl` (D7). Do not add `--space-28` or `--space-36`.
- **Do not rename any existing spacing step.** `lg` stays 24, `xl` stays 32 (D6).
- **`--layout-*` and `--space-*` are separate namespaces.** Shell structure is not spacing. Layout tokens that hold a distance reference a spacing step rather than carrying a raw number.
- **User-visible routes change; the data layer does not.** `/api/videos/**`, the `videos` table, `videos.youtube_video_id`, and every `@/lib/data/videos` import path stay exactly as they are (spec §3.1).
- **TypeScript strict, no `any`** without a justifying comment. Files `kebab-case`, components `PascalCase`, DB `snake_case`.
- **TDD.** Failing test first, run it, then implement. Never claim a command passed without running it.
- **Adding an i18n namespace is a 5-step wiring list:** `messages/en/<ns>.json`, `messages/vi/<ns>.json`, `NAMESPACES` in `lib/i18n/namespaces.ts`, `AppConfig.Messages` in `types/messages.d.ts`, and a `messages/en/<ns>.pin.test.ts`. Missing step 4 fails `tsc`, not the tests.
- **Use `useTranslations` for all synchronous components** (even without `"use client"` — if a client component imports it, `getTranslations` hard-fails). `await getTranslations` only in genuinely async server components.
- **New tables need RLS enabled**, or Supabase default privileges leave them open. Reference/content tables: `select` to `authenticated`, writes service-role only.
- **Verify commands:** `npx tsc --noEmit` · `npx vitest run` · `npm run lint` (not `npx eslint` — it scans paths `next lint` excludes and reports phantom errors) · `npx playwright test` · `npx supabase db reset`.
- **Lint baseline is 0 errors + 77 warnings** (`54 no-non-null-assertion + 23 no-unused-vars`). "Clean" means 0 new; compare the rule mix, not the count.
- **Test baseline before this plan: 2007 unit tests across 221 files, tsc 0, Playwright 8/8.**

## Review Checkpoints

Execution is subagent-driven: one fresh subagent per task. Review gates cluster where a reviewer can judge a coherent whole, rather than after every task.

| Checkpoint | Tasks | Why these belong together |
|---|---|---|
| **A — Foundation** | 1, 2 | Tokens and the shell that consumes them. Nothing user-visible changes; the question a reviewer answers is whether the two namespaces are genuinely separate and whether the shell owns its measure. |
| **B — Routing** | 3, 4, 5, 6 | The route move, its redirects, and the nine destinations that must exist before the nav can point at them. Judged as one story: no dead links, no missed call site, no page left behind. |
| **C — Navigation** | 7 | Alone, because it is the only change that touches every authenticated screen. A reviewer should look at it without four other tasks in the same diff. |
| **D — Data** | 8, 9, 10, 11 | Schema, repositories and the ranking strategy are consistent or they are not — reviewing them together is the only way to see that. The verification gate closes the branch. |

Between checkpoints, run `npx tsc --noEmit && npx vitest run && npm run lint` before handing to review. **No worktree for C1** — this repo has never been pushed, so `EnterWorktree`'s default `baseRef` branches from a stale `origin`, and a worktree has no `.env.local`, which makes every auth-dependent Playwright spec fail in a way that looks exactly like a code regression. Twelve sequential tasks on one branch do not need the isolation.

---

## File Structure

**Deliberately NOT modified**
- `components/ui/container.tsx` — keeps `max-w-6xl`. `--layout-content-max` is the Shadowing shell's measure, not a claim that every page in the app is 1240px wide; Pricing, Settings and Auth will each want their own. Screens adopt `TwoColumnShell` when a spec says they share that shell. Widening `Container` here would turn an infrastructure plan into an app-wide visual redesign.

**Created**
- `components/layout/two-column-shell.tsx` — main column + sticky companion rail; the only place shell measure, gutters and rail geometry live.
- `components/layout/two-column-shell.test.tsx`
- `components/layout/upcoming-screen.tsx` — the shared honest empty state for routes whose feature is not built.
- `components/layout/upcoming-screen.test.tsx`
- `app/[locale]/(protected)/(app)/shadowing/page.tsx` — moved from `videos/`
- `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx` — shell for C3
- `app/[locale]/(protected)/(focus)/shadowing/[id]/page.tsx` — moved
- `app/[locale]/(protected)/(focus)/shadowing/[id]/dictation/page.tsx` — moved
- `app/[locale]/(protected)/(app)/{review,challenges,sensei,roadmap,weekly-report,statistics,achievements,settings}/page.tsx` — eight empty-state routes
- `messages/{en,vi}/upcoming.json`, `messages/en/upcoming.pin.test.ts`
- `lib/data/collections.ts` + `.test.ts` — collection read path
- `lib/data/lesson-taxonomy.ts` + `.test.ts` — situation/source read path, **array-returning** (D11)
- `lib/data/lesson-ranking.ts` + `.test.ts` — `LessonRankingStrategy` + `PopularStrategyV1`
- `supabase/migrations/20260807000025_lesson_taxonomy.sql`
- `supabase/migrations/20260807000026_collections_seed.sql`
- `tests/e2e/route-rename-redirects.spec.ts`

**Modified**
- `app/globals.css` — `--layout-*` block, `--space-md-lg`
- `tailwind.config.ts` — spacing `md-lg`; `width`/`maxWidth` entries for layout tokens
- `lib/design-tokens.test.ts` — token pins + namespace-separation assertion
- `components/layout/app-nav.tsx` — `NAV_GROUPS` to 22 rows, scrollable list region
- `components/layout/app-nav.test.tsx` — retire the "route rename deferred" pin, add the href-resolves test
- `messages/{en,vi}/nav.json` — `insights` group heading + 8 row labels
- `messages/en/nav.pin.test.ts` — new literals
- `lib/i18n/namespaces.ts`, `types/messages.d.ts` — register `upcoming`
- `next.config.mjs` — three 307 redirects
- `components/companion/anchor-boundary.test.ts` — correct the pre-declared paths
- `tests/e2e/route-group-provider-identity.spec.ts` — `/videos` → `/shadowing`

---

## Task 1: Layout token namespace and the 20px spacing step

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts:81-90`
- Test: `lib/design-tokens.test.ts:23-27`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS vars `--layout-sidebar-width`, `--layout-sidebar-collapsed`, `--layout-content-max`, `--layout-companion-width`, `--layout-gutter`, `--layout-column-gap`, `--space-md-lg`. Tailwind keys: `spacing["md-lg"]`, `width["sidebar"]`, `width["sidebar-collapsed"]`, `width["companion"]`, `maxWidth["content"]`.

- [ ] **Step 1: Write the failing test**

In `lib/design-tokens.test.ts`, extend `REQUIRED_TOKENS` (line 23) with the seven new names and add a namespace-separation test. Append this test inside the existing `describe("design tokens", …)` block:

```ts
  it("keeps layout structure tokens out of the spacing namespace", () => {
    // --space-* is distance between elements; --layout-* is shell structure.
    // A structural dimension declared as a spacing step would let a later
    // contributor use `p-sidebar`, which is meaningless. Plan C1, spec D5.
    const layoutNames = css.match(/--layout-[a-z-]+(?=:)/g) ?? [];
    expect(layoutNames.length).toBeGreaterThanOrEqual(6);
    expect(layoutNames.filter((name) => name.startsWith("--layout-space"))).toEqual([]);

    const spacingNames = css.match(/--space-[a-z0-9-]+(?=:)/g) ?? [];
    expect(spacingNames).toContain("--space-md-lg");
    expect(spacingNames.some((name) => /sidebar|companion|content|gutter/.test(name))).toBe(false);
  });

  it("declares layout distances by reference to the spacing scale, never as raw px", () => {
    // D7: no new value may enter the system. --layout-gutter and
    // --layout-column-gap hold measured 36/28 rounded to existing steps, and
    // they must say so by referencing the step, not by restating a number.
    expect(css).toMatch(/--layout-gutter:\s*var\(--space-xl\)/);
    expect(css).toMatch(/--layout-column-gap:\s*var\(--space-lg\)/);
  });
```

The existing tests read the stylesheet into a `css` const at the top of the file — reuse it; do not re-read the file.

Update `REQUIRED_TOKENS` (line 23) to include:

```ts
  "--space-md-lg",
  "--layout-sidebar-width", "--layout-sidebar-collapsed",
  "--layout-content-max", "--layout-companion-width",
  "--layout-gutter", "--layout-column-gap",
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: FAIL — missing tokens listed, and both new tests fail.

- [ ] **Step 3: Add the tokens**

In `app/globals.css`, immediately after the `--space-3xl: 4rem;` line (currently line 127), insert the new spacing step:

```css
  /* Measured across the live Figma design file (59 frames): 20px is 12.0% of
     all spacing and had no step. 28px (2.5%) and 36px (0.7%) are noise and
     round to --space-lg / --space-xl. Inserted WITHOUT renaming any existing
     step — renaming the scale is its own spec ("Spacing System v2"), not this
     plan. Spec D6/D7. */
  --space-md-lg: 1.25rem;
```

Then add a new block after the spacing scale:

```css
  /* Shell structure. Deliberately NOT --space-*: spacing is distance between
     elements, these are the dimensions of the application shell. Measured from
     Figma frame 149:2 (Shadowing hub after changes, 1536 canvas). The two
     distances reference spacing steps rather than carrying raw numbers, so the
     namespace is complete without a new value entering the system. Spec D5/D8. */
  --layout-sidebar-width: 224px;
  --layout-sidebar-collapsed: 68px;
  --layout-content-max: 1240px;
  --layout-companion-width: 340px;
  --layout-gutter: var(--space-xl);
  --layout-column-gap: var(--space-lg);
```

In `tailwind.config.ts`, extend `theme.extend.spacing` (line 81) and add two new groups:

```ts
      spacing: {
        "2xs": "var(--space-2xs)",
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        "md-lg": "var(--space-md-lg)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
      },
      width: {
        sidebar: "var(--layout-sidebar-width)",
        "sidebar-collapsed": "var(--layout-sidebar-collapsed)",
        companion: "var(--layout-companion-width)",
      },
      maxWidth: {
        content: "var(--layout-content-max)",
      },
```

- [ ] **Step 4: Run the token tests**

Run: `npx vitest run lib/design-tokens.test.ts lib/utils.test.ts`
Expected: PASS. `lib/utils.test.ts` is included because `lib/utils.ts` configures `extendTailwindMerge` with every custom scale, and a scale it does not know about is silently stripped by `cn()`. If it fails, add the new groups there before proceeding.

- [ ] **Step 5: Prove `cn()` handles the new classes**

Add to `lib/utils.test.ts`:

```ts
it("does not strip the new layout and spacing scales", () => {
  expect(cn("gap-md", "gap-md-lg")).toBe("gap-md-lg");
  expect(cn("max-w-6xl", "max-w-content")).toBe("max-w-content");
  expect(cn("w-60", "w-sidebar")).toBe("w-sidebar");
});
```

Run: `npx vitest run lib/utils.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/design-tokens.test.ts lib/utils.test.ts
git commit -m "feat(tokens): add the --layout-* namespace and the 20px spacing step"
```

---

## Task 2: `TwoColumnShell`

**Files:**
- Create: `components/layout/two-column-shell.tsx`
- Test: `components/layout/two-column-shell.test.tsx`

**Interfaces:**
- Consumes: `width.companion`, `maxWidth.content`, `--layout-column-gap`, `--layout-gutter` from Task 1.
- Produces:
  ```ts
  export function TwoColumnShell(props: {
    children: React.ReactNode;
    rail?: React.ReactNode;
    railLabel: string;
    className?: string;
  }): JSX.Element;
  ```
  C2 renders the Hub inside it with a rail; C3 renders Explore inside it with `rail` omitted (D14).

**This component is where `--layout-content-max` and `--layout-gutter` are consumed — and the only place.** `components/ui/container.tsx` is deliberately **not** changed: `--layout-content-max` is the Shadowing shell's width, not a claim that every page in the app should be 1240px wide. Pricing, Settings and Auth will each want their own measure, and widening all of them here would turn an infrastructure plan into an app-wide visual redesign. Screens migrate to this shell when a spec says they share it; until then `Container`'s `max-w-6xl` stands.

- [ ] **Step 1: Write the failing test**

Create `components/layout/two-column-shell.test.tsx`:

```tsx
import { render, screen } from "@/test/render";
import { TwoColumnShell } from "@/components/layout/two-column-shell";

describe("TwoColumnShell", () => {
  it("renders the rail as a complementary landmark with an accessible name", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.getByRole("complementary", { name: "Companion" })).toBeInTheDocument();
  });

  it("omits the rail element entirely when no rail is passed", () => {
    // Explore is single-column (spec D14). An empty <aside> would still be a
    // landmark screen readers announce, so it must not be rendered at all.
    render(
      <TwoColumnShell railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("sticks the rail and sizes it from the layout token", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    const rail = screen.getByRole("complementary", { name: "Companion" });
    expect(rail.className).toContain("sticky");
    expect(rail.className).toContain("xl:w-companion");
  });

  it("hides the rail below xl so main content keeps the full width", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.getByRole("complementary", { name: "Companion" }).className).toContain("hidden");
    expect(screen.getByRole("complementary", { name: "Companion" }).className).toContain("xl:block");
  });

  it("owns the shell measure, so pages inside it need no Container", () => {
    // --layout-content-max is the SHADOWING SHELL's width, consumed here and
    // nowhere else. components/ui/container.tsx keeps max-w-6xl on purpose:
    // Pricing, Settings and Auth will each want their own measure, and this
    // token is not a claim that every page should be 1240px.
    render(
      <TwoColumnShell railLabel="Companion" data-testid="shell">
        <p>main</p>
      </TwoColumnShell>,
    );
    const shell = screen.getByTestId("shell");
    expect(shell.className).toContain("max-w-content");
    expect(shell.className).toContain("mx-auto");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/layout/two-column-shell.test.tsx`
Expected: FAIL — cannot resolve `@/components/layout/two-column-shell`.

- [ ] **Step 3: Implement**

Create `components/layout/two-column-shell.tsx`:

```tsx
import { cn } from "@/lib/utils";

/**
 * The Hub/Explore content shell: a flexible main column beside an optional
 * sticky companion rail. Geometry lives here and nowhere else — measured from
 * Figma frame 149:2, where the rail is 340px beside a flexible main column
 * (spec §7.1). Below `xl` the rail is not rendered as a sized column at all,
 * which is why the rail must never be the only place information appears.
 */
export function TwoColumnShell({
  children,
  rail,
  railLabel,
  className,
  ...props
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  railLabel: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // The shell owns its own measure and gutters — pages inside it do not
        // wrap themselves in <Container>. `--layout-content-max` is consumed
        // HERE and nowhere else; container.tsx keeps max-w-6xl on purpose.
        "mx-auto w-full max-w-content px-[--layout-gutter]",
        "flex flex-col gap-[--layout-column-gap] xl:flex-row",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {rail ? (
        // `hidden xl:block`, not `xl:w-0`: an empty-but-present complementary
        // landmark is still announced by screen readers on small viewports.
        <aside
          aria-label={railLabel}
          className="hidden shrink-0 self-start xl:sticky xl:top-md-lg xl:block xl:w-companion"
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run components/layout/two-column-shell.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/layout/two-column-shell.tsx components/layout/two-column-shell.test.tsx
git commit -m "feat(layout): add TwoColumnShell with an optional sticky companion rail"
```

---

## Task 3: Move the route family to `/shadowing`

**Files:**
- Move: `app/[locale]/(protected)/(app)/videos/page.tsx` → `app/[locale]/(protected)/(app)/shadowing/page.tsx`
- Move: `app/[locale]/(protected)/(focus)/videos/[id]/shadowing/page.tsx` → `app/[locale]/(protected)/(focus)/shadowing/[id]/page.tsx`
- Move: `app/[locale]/(protected)/(focus)/videos/[id]/dictation/page.tsx` → `app/[locale]/(protected)/(focus)/shadowing/[id]/dictation/page.tsx`
- Modify: `components/layout/app-nav.tsx:29`
- Modify: `components/layout/app-nav.test.tsx:137-147`
- Modify: `components/companion/anchor-boundary.test.ts`
- Modify: `tests/e2e/route-group-provider-identity.spec.ts`
- Modify: every file linking to the three old paths

**Interfaces:**
- Consumes: nothing.
- Produces: routes `/shadowing`, `/shadowing/[id]`, `/shadowing/[id]/dictation`.

**The screens' UI is not touched.** This is a move plus link updates. Plan D restyles them.

- [ ] **Step 1: Find every link that must change**

Run (use `grep`, **not** `npx rg` — `rg` is not on npm and `npx rg` installs an unrelated stub package):

```bash
grep -rnE '"/videos|`/videos|href="/videos|/videos/\$\{' \
  --include='*.ts' --include='*.tsx' . \
  | grep -v node_modules | grep -v '/api/'
```

Then narrow to **user-visible route strings only**. Do **not** touch:
- `/api/videos/...` — API routes are unchanged (spec §3.1)
- `@/lib/data/videos`, `lib/video-types`, `lib/validation/video` — import paths and modules
- `supabase/migrations/**`, `supabase/seed.sql`
- `messages/**` — copy, unless a string literally contains a URL

Record the list before editing; you will verify against it in Step 6.

- [ ] **Step 2: Write the failing tests**

Replace the deferral pin in `components/layout/app-nav.test.tsx` (lines 137-147) with:

```tsx
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
```

In `tests/e2e/route-group-provider-identity.spec.ts`, change all three `/videos` occurrences to their new paths. The lesson URL loses a segment: `/videos/${id}/shadowing` becomes `/shadowing/${id}`.

In `components/companion/anchor-boundary.test.ts`, correct the pre-declared paths: the file currently lists `(app)/shadowing/[id]/…`, but these routes live under **`(focus)`**. Fix the group, not just the path — otherwise the test starts passing for the wrong reason.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run components/layout/app-nav.test.tsx components/companion/anchor-boundary.test.ts`
Expected: FAIL — nav still emits `/en/videos`; boundary paths do not resolve.

- [ ] **Step 4: Move the directories**

```bash
git mv "app/[locale]/(protected)/(app)/videos" "app/[locale]/(protected)/(app)/shadowing"
mkdir -p "app/[locale]/(protected)/(focus)/shadowing/[id]/dictation"
git mv "app/[locale]/(protected)/(focus)/videos/[id]/shadowing/page.tsx" "app/[locale]/(protected)/(focus)/shadowing/[id]/page.tsx"
git mv "app/[locale]/(protected)/(focus)/videos/[id]/dictation/page.tsx" "app/[locale]/(protected)/(focus)/shadowing/[id]/dictation/page.tsx"
git rm -r "app/[locale]/(protected)/(focus)/videos"
```

`git mv` rather than delete-and-create so the diff reads as a move and review can see the files are untouched.

- [ ] **Step 5: Update the links**

`components/layout/app-nav.tsx` line 29:

```ts
      { href: "/shadowing", key: "lessons" },
```

Also rewrite the JSDoc above `NAV_GROUPS` (lines 16-22): the note claiming `lessons` points at `/videos` with the rename deferred is now false. Replace with a one-line statement that the canonical route is live.

Update the remaining call sites from Step 1. The common shapes are:

```ts
// before → after
`/videos/${video.id}/shadowing`   →  `/shadowing/${video.id}`
`/videos/${video.id}/dictation`   →  `/shadowing/${video.id}/dictation`
"/videos"                          →  "/shadowing"
```

- [ ] **Step 6: Verify nothing was missed and nothing extra was touched**

Run:

```bash
npx rg -n --glob '!**/*.md' -g '!supabase/**' '"/videos|`/videos|href="/videos'
```

Expected: only `/api/videos` matches remain. Confirm `git diff --stat` touches no file under `app/api/`, `lib/data/`, or `supabase/`.

- [ ] **Step 7: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: tsc 0; unit tests pass; lint 0 errors and the warning mix unchanged (`54 no-non-null-assertion + 23 no-unused-vars`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(routes): move the lesson route family from /videos to /shadowing"
```

---

## Task 4: Temporary redirects for the old routes

**Files:**
- Modify: `next.config.mjs`
- Create: `tests/e2e/route-rename-redirects.spec.ts`

**Interfaces:**
- Consumes: the routes from Task 3.
- Produces: three 307 redirects.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/route-rename-redirects.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Spec §3.1.1. Three explicit rules, not one wildcard: the lesson rule
// COLLAPSES a segment (`/videos/:id/shadowing` → `/shadowing/:id`) rather than
// renaming a prefix. Getting that one wrong sends a learner silently into the
// wrong lesson mode instead of to an error, which is why it is asserted here.
//
// Asserted at the HTTP level with `maxRedirects: 0`, NOT by navigating:
// `/shadowing` is in PROTECTED_PREFIXES, so following the redirect chains into
// `/login?redirectTo=…` and the assertion would be testing auth rather than the
// rename. Checking the response directly also lets us assert the 307 itself —
// and 307-vs-308 is the central decision of this task, so it must be pinned.
const ID = "00000000-0000-0000-0000-000000000000";

const CASES: ReadonlyArray<readonly [from: string, to: string]> = [
  ["/en/videos", "/en/shadowing"],
  [`/en/videos/${ID}/shadowing`, `/en/shadowing/${ID}`], // segment dropped
  [`/en/videos/${ID}/dictation`, `/en/shadowing/${ID}/dictation`],
];

for (const [from, to] of CASES) {
  test(`${from} redirects to ${to} with a temporary 307`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    // Full path, never `toContain` — a substring assertion would stop testing
    // the segment collapse.
    expect(new URL(res.headers()["location"], "http://localhost:3000").pathname).toBe(to);
  });
}

test("the rules do not swallow a longer prefix", async ({ request }) => {
  // Mirrors the guard in lib/supabase/route-protection.test.ts: `/videosomething`
  // must not be caught by the `/videos` rule.
  const res = await request.get("/en/videosomething", { maxRedirects: 0 });
  expect(res.status()).not.toBe(307);
});
```

Four specs, not three: the fourth proves the rules are not over-broad.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/route-rename-redirects.spec.ts`
Expected: FAIL — `/en/videos` 404s, so the status is 404 rather than 307.

- [ ] **Step 3: Implement**

In `next.config.mjs`, add to `nextConfig`:

```js
  // Spec §3.1.1. TEMPORARY (307), not permanent: these routes still move —
  // Plan D restructures the lesson workspace into four Learning Modes — and a
  // 308 is cached hard by browsers, turning a later change into a debugging
  // trap that presents as an app routing bug. No SEO argument on the other
  // side: every one of these routes is auth-gated, and the app has never been
  // published, so no external inbound link exists to preserve. Revisit at
  // launch. A wildcard is wrong here because the second rule COLLAPSES a
  // segment rather than renaming a prefix.
  async redirects() {
    return [
      { source: "/:locale/videos", destination: "/:locale/shadowing", permanent: false },
      {
        source: "/:locale/videos/:id/shadowing",
        destination: "/:locale/shadowing/:id",
        permanent: false,
      },
      {
        source: "/:locale/videos/:id/dictation",
        destination: "/:locale/shadowing/:id/dictation",
        permanent: false,
      },
    ];
  },
```

- [ ] **Step 4: Run the e2e suite**

Run: `npx supabase db reset && npx playwright test`
Expected: PASS, 12 tests (8 existing + 4 new). Kill any stale node on :3000 first — `reuseExistingServer` will otherwise silently test a stale build. `db reset` is required because `route-group-provider-identity.spec.ts` needs the seeded free-tier video.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs tests/e2e/route-rename-redirects.spec.ts
git commit -m "feat(routes): add temporary redirects from the old /videos paths"
```

---

## Task 5: The `upcoming` namespace and `UpcomingScreen`

**Files:**
- Create: `messages/en/upcoming.json`, `messages/vi/upcoming.json`, `messages/en/upcoming.pin.test.ts`
- Create: `components/layout/upcoming-screen.tsx`, `components/layout/upcoming-screen.test.tsx`
- Modify: `lib/i18n/namespaces.ts:8`, `types/messages.d.ts`

**Interfaces:**
- Consumes: `Container` (unchanged by this plan).
- Produces:
  ```ts
  export function UpcomingScreen(props: {
    title: string;
    body: string;
    unlocks: string;
    unlocksLabel: string;
  }): JSX.Element;
  ```
  Task 6 renders one per route.

**Synchronous, and all four strings arrive as props.** An earlier draft had this component `async` so it could read `unlocksLabel` itself — which would have made it untestable: this repo runs React 18.3.1, `@/test/render` is plain RTL, and **no test in the codebase renders an async server component**, because React 18 cannot. The page is already async and already holds a translator, so it resolves all four strings and this component stays a pure function of its props.

An empty state states **what is missing and what would fill it**. It never promises a date and never renders a fake chart.

- [ ] **Step 1: Write the catalogs**

`messages/en/upcoming.json`:

```json
{
  "unlocksLabel": "What fills this",
  "review": {
    "title": "Review",
    "body": "Your due cards from every module gather here — kanji, vocabulary and mined sentences in one queue.",
    "unlocks": "Study anything with a card, and the queue starts filling itself."
  },
  "challenges": {
    "title": "Challenges",
    "body": "Short, timed sets that push one skill harder than a normal session does.",
    "unlocks": "Nothing yet. This screen arrives with the challenge engine."
  },
  "sensei": {
    "title": "Sensei",
    "body": "A place to ask about anything you have studied, in your own words.",
    "unlocks": "Nothing yet. Conversation practice already lives under Speaking."
  },
  "roadmap": {
    "title": "Roadmap",
    "body": "The path your Companion is drawing from what you actually study, not from a fixed syllabus.",
    "unlocks": "Keep studying. A roadmap needs a few weeks of real sessions before it says anything true."
  },
  "weeklyReport": {
    "title": "Weekly Report",
    "body": "One honest summary a week: what moved, what did not, and what your Companion adjusted.",
    "unlocks": "Finish a week of sessions and the first report writes itself."
  },
  "statistics": {
    "title": "Statistics",
    "body": "The numbers behind your sessions — time, accuracy and coverage over time.",
    "unlocks": "Nothing yet. This screen arrives once session history is being aggregated."
  },
  "achievements": {
    "title": "Achievements",
    "body": "Badges you have earned, and the ones within reach.",
    "unlocks": "Badges are awarded already; this screen is where they will be shown."
  },
  "settings": {
    "title": "Settings",
    "body": "Account, language, motion, and control over your own data.",
    "unlocks": "Nothing yet. Data export and deletion land with this screen."
  },
  "explore": {
    "title": "Explore Lessons",
    "body": "Every lesson in Korume, arranged for discovery rather than for your own library.",
    "unlocks": "Nothing yet. This screen is being built."
  }
}
```

`messages/vi/upcoming.json` — same keys, Vietnamese copy. Translate the meaning, not the words; Vietnamese is the primary locale:

```json
{
  "unlocksLabel": "Điều gì lấp đầy trang này",
  "review": {
    "title": "Ôn tập",
    "body": "Thẻ đến hạn từ mọi phần gom về đây — kanji, từ vựng và câu bạn đã thu thập, chung một hàng đợi.",
    "unlocks": "Cứ học bất cứ thứ gì có thẻ, hàng đợi sẽ tự đầy lên."
  },
  "challenges": {
    "title": "Thử thách",
    "body": "Những lượt ngắn có giờ, đẩy một kỹ năng mạnh hơn buổi học thường.",
    "unlocks": "Chưa có gì. Trang này xuất hiện cùng bộ máy thử thách."
  },
  "sensei": {
    "title": "Sensei",
    "body": "Nơi hỏi về bất cứ điều gì bạn đã học, bằng lời của chính bạn.",
    "unlocks": "Chưa có gì. Luyện hội thoại hiện nằm ở mục Luyện nói."
  },
  "roadmap": {
    "title": "Lộ trình",
    "body": "Con đường Companion vẽ ra từ những gì bạn thật sự học, không phải từ một giáo trình cố định.",
    "unlocks": "Cứ học tiếp. Một lộ trình cần vài tuần buổi học thật trước khi nói được điều gì đúng."
  },
  "weeklyReport": {
    "title": "Báo cáo tuần",
    "body": "Mỗi tuần một bản tóm tắt thành thật: điều gì tiến lên, điều gì chưa, và Companion đã điều chỉnh gì.",
    "unlocks": "Học trọn một tuần, bản báo cáo đầu tiên sẽ tự viết ra."
  },
  "statistics": {
    "title": "Thống kê",
    "body": "Những con số phía sau các buổi học — thời lượng, độ chính xác và độ phủ theo thời gian.",
    "unlocks": "Chưa có gì. Trang này xuất hiện khi lịch sử buổi học được tổng hợp."
  },
  "achievements": {
    "title": "Thành tựu",
    "body": "Những huy hiệu bạn đã đạt, và những cái đang trong tầm với.",
    "unlocks": "Huy hiệu đã được trao rồi; đây sẽ là nơi hiển thị chúng."
  },
  "settings": {
    "title": "Cài đặt",
    "body": "Tài khoản, ngôn ngữ, chuyển động, và quyền kiểm soát dữ liệu của chính bạn.",
    "unlocks": "Chưa có gì. Xuất và xoá dữ liệu sẽ về cùng trang này."
  },
  "explore": {
    "title": "Khám phá bài học",
    "body": "Toàn bộ bài học trong Korume, sắp xếp để khám phá thay vì cho thư viện riêng của bạn.",
    "unlocks": "Chưa có gì. Trang này đang được xây."
  }
}
```

- [ ] **Step 2: Wire the namespace — all five steps**

1. Both JSON files above.
2. `lib/i18n/namespaces.ts` line 8 — append `"upcoming"` to `NAMESPACES`.
3. `types/messages.d.ts` — add `import type upcoming from "../messages/en/upcoming.json";` and `upcoming: typeof upcoming;` inside `AppConfig.Messages`. **Skipping this fails `tsc`, not the tests.**
4. Create `messages/en/upcoming.pin.test.ts` following the shape of `messages/en/dashboard.pin.test.ts`: import the catalog and assert each literal, so a copy change is a conscious test edit.
5. `npx vitest run lib/i18n/catalog.test.ts` — it asserts `NAMESPACES` matches the files on disk and ICU-parses every message in every locale.

- [ ] **Step 3: Write the failing component test**

Create `components/layout/upcoming-screen.test.tsx`:

```tsx
import { render, screen } from "@/test/render";
import { UpcomingScreen } from "@/components/layout/upcoming-screen";

describe("UpcomingScreen", () => {
  it("names the screen as a level-1 heading", () => {
    render(<UpcomingScreen title="Roadmap" body="The path…" unlocks="Keep studying." unlocksLabel="What fills this" />);
    expect(screen.getByRole("heading", { level: 1, name: "Roadmap" })).toBeInTheDocument();
  });

  it("states what would fill the screen, not a delivery promise", () => {
    render(<UpcomingScreen title="Roadmap" body="The path…" unlocks="Keep studying." unlocksLabel="What fills this" />);
    expect(screen.getByText("Keep studying.")).toBeInTheDocument();
  });

  it("renders no chart, meter or progress element", () => {
    // The whole point of an honest empty state: a placeholder visualisation
    // would render data the system does not have.
    const { container } = render(
      <UpcomingScreen title="Statistics" body="The numbers…" unlocks="Nothing yet." unlocksLabel="What fills this" />,
    );
    expect(container.querySelector("svg, canvas, progress, meter")).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run components/layout/upcoming-screen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement**

Create `components/layout/upcoming-screen.tsx`:

```tsx
import { Container } from "@/components/ui/container";

/**
 * The honest empty state for a nav destination whose feature is not built.
 *
 * Spec §3.4: a nav row that 404s is worse than one that explains itself. This
 * states WHAT IS MISSING and WHAT WOULD FILL IT. It deliberately renders no
 * chart, meter or progress element — a placeholder visualisation would be
 * showing data the system does not have.
 *
 * Synchronous on purpose: every string arrives as a prop from the page, which
 * is already async and already holds a translator. Reading one string here
 * would make the component async, and React 18 + RTL cannot render an async
 * component — it would be untestable for no gain.
 */
export function UpcomingScreen({
  title,
  body,
  unlocks,
  unlocksLabel,
}: {
  title: string;
  body: string;
  unlocks: string;
  unlocksLabel: string;
}) {
  return (
    <Container className="py-3xl">
      <div className="max-w-[60ch]">
        <h1 className="text-title font-bold">{title}</h1>
        <p className="mt-md text-body text-muted-foreground">{body}</p>
        <div className="mt-xl rounded-md border border-border bg-card p-lg">
          <p className="text-caption font-semibold uppercase tracking-wide text-accent-strong">
            {unlocksLabel}
          </p>
          <p className="mt-xs text-body text-muted-foreground">{unlocks}</p>
        </div>
      </div>
    </Container>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run components/layout/upcoming-screen.test.tsx messages/en/upcoming.pin.test.ts lib/i18n/catalog.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add messages/en/upcoming.json messages/vi/upcoming.json messages/en/upcoming.pin.test.ts lib/i18n/namespaces.ts types/messages.d.ts components/layout/upcoming-screen.tsx components/layout/upcoming-screen.test.tsx
git commit -m "feat(i18n): add the upcoming namespace and the UpcomingScreen empty state"
```

---

## Task 6: Nine placeholder routes

**Files:**
- Create: `app/[locale]/(protected)/(app)/{review,challenges,sensei,roadmap,weekly-report,statistics,achievements,settings}/page.tsx`
- Create: `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx`

**Interfaces:**
- Consumes: `UpcomingScreen` (Task 5), the `upcoming` catalog.
- Produces: nine routes that resolve, which Task 7's href test depends on.

`/sensei` rather than `/companion` — Companion is cross-cutting and a `/companion` route would attract everything AI (spec D17).

- [ ] **Step 1: Write the failing test**

Create `app/[locale]/(protected)/(app)/upcoming-routes.test.tsx`:

```tsx
import { existsSync } from "node:fs";
import path from "node:path";

// Task 7's nav test asserts every href resolves to a route. That test cannot
// distinguish "route missing" from "nav wrong", so this one pins the routes
// themselves.
const ROUTES = [
  "review", "challenges", "sensei", "roadmap", "weekly-report",
  "statistics", "achievements", "settings", "shadowing/explore",
];

describe("upcoming routes", () => {
  it.each(ROUTES)("%s has a page", (route) => {
    const file = path.join(
      process.cwd(), "app", "[locale]", "(protected)", "(app)", route, "page.tsx",
    );
    expect(existsSync(file)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/[locale]/(protected)/(app)/upcoming-routes.test.tsx"`
Expected: FAIL — 9 of 9 missing.

- [ ] **Step 3: Create the eight nav pages**

Each is the same shape. `app/[locale]/(protected)/(app)/roadmap/page.tsx`:

```tsx
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { UpcomingScreen } from "@/components/layout/upcoming-screen";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "upcoming" });
  return { title: t("roadmap.title") };
}

export default async function RoadmapPage() {
  const t = await getTranslations("upcoming");
  return (
    <UpcomingScreen
      title={t("roadmap.title")}
      body={t("roadmap.body")}
      unlocks={t("roadmap.unlocks")}
      unlocksLabel={t("unlocksLabel")}
    />
  );
}
```

Repeat for the other seven, substituting the catalog key and the component name:

| Route | Catalog key | Component |
|---|---|---|
| `review` | `review` | `ReviewPage` |
| `challenges` | `challenges` | `ChallengesPage` |
| `sensei` | `sensei` | `SenseiPage` |
| `weekly-report` | `weeklyReport` | `WeeklyReportPage` |
| `statistics` | `statistics` | `StatisticsPage` |
| `achievements` | `achievements` | `AchievementsPage` |
| `settings` | `settings` | `SettingsPage` |

- [ ] **Step 4: Create the Explore shell**

`app/[locale]/(protected)/(app)/shadowing/explore/page.tsx` — identical shape, key `explore`, component `ExplorePage`. C3 replaces the body; the route and its metadata stay.

- [ ] **Step 5: Run tests**

Run: `npx vitest run "app/[locale]/(protected)/(app)/upcoming-routes.test.tsx" && npx tsc --noEmit && npm run build`
Expected: PASS; build succeeds and lists the nine new routes.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(protected)/(app)"
git commit -m "feat(routes): add nine honest empty-state routes for unbuilt destinations"
```

---

## Task 7: `NAV_GROUPS` to 22 rows, with a scrollable list and an href guard

**Files:**
- Modify: `components/layout/app-nav.tsx:24-58, 90`
- Modify: `messages/en/nav.json`, `messages/vi/nav.json`
- Modify: `messages/en/nav.pin.test.ts`
- Modify: `components/layout/app-nav.test.tsx`

**Interfaces:**
- Consumes: the nine routes from Task 6.
- Produces: `NAV_GROUPS` with 5 groups / 22 rows; `NAV_ITEMS` unchanged in shape.

- [ ] **Step 1: Write the failing tests**

Add to `components/layout/app-nav.test.tsx`:

```tsx
import { existsSync } from "node:fs";
import path from "node:path";

it("renders all five canonical groups in order", () => {
  // navigation-system.md § Navigation Inventory. INSIGHTS sits between STUDY
  // and PROGRESS.
  renderNav();
  const headings = screen.getAllByText(
    /^(Learn|Study|Insights|Progress|Account)$/,
  ).map((el) => el.textContent);
  expect(headings).toEqual(["Learn", "Study", "Insights", "Progress", "Account"]);
});

it("ships all 22 canonical destinations", () => {
  expect(NAV_ITEMS).toHaveLength(22);
});

it("points every nav href at a route that exists", () => {
  // The regression that makes a future rename fail loudly instead of shipping
  // a dead nav row. Plan C1 exists partly because eight rows had no route.
  const missing = NAV_ITEMS.filter((item) => {
    const segments = item.href.replace(/^\//, "");
    const candidates = [
      path.join(process.cwd(), "app", "[locale]", "(protected)", "(app)", segments, "page.tsx"),
      path.join(process.cwd(), "app", "[locale]", "(protected)", "(immersive)", segments, "page.tsx"),
    ];
    return !candidates.some(existsSync);
  });
  expect(missing).toEqual([]);
});

it("lets the nav list scroll when it is taller than the viewport", () => {
  // 22 rows do not fit the sidebar. Every Figma frame shows the list clipped
  // at 585-682px with no scroll region — an export artifact, not a design
  // decision (spec §7.2, D9).
  renderNav();
  const list = document.querySelector("[data-nav-scroll]");
  expect(list).not.toBeNull();
  expect(list?.className).toContain("overflow-y-auto");
});
```

Add the new literals to `messages/en/nav.pin.test.ts`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: FAIL — 4 groups not 5, 14 items not 22.

- [ ] **Step 3: Add the catalog strings**

`messages/en/nav.json` — add `"insights": "Insights"` to `groups`, and the eight row labels:

```json
  "review": "Review",
  "challenges": "Challenges",
  "sensei": "Sensei",
  "roadmap": "Roadmap",
  "weeklyReport": "Weekly Report",
  "statistics": "Statistics",
  "achievements": "Achievements",
  "settings": "Settings",
```

`messages/vi/nav.json` — `"insights": "Thấu hiểu"` plus:

```json
  "review": "Ôn tập",
  "challenges": "Thử thách",
  "sensei": "Sensei",
  "roadmap": "Lộ trình",
  "weeklyReport": "Báo cáo tuần",
  "statistics": "Thống kê",
  "achievements": "Thành tựu",
  "settings": "Cài đặt",
```

`Sensei` stays untranslated in both, like `Kanji` and `JLPT` — it is a name, not a description.

- [ ] **Step 4: Rewrite `NAV_GROUPS`**

`components/layout/app-nav.tsx` lines 24-55. Replace the JSDoc's "only the 14 shipped destinations are wired" paragraph — it is now false:

```ts
/**
 * href → nav catalog key, in the 5-group structure from
 * `docs/design/screens/navigation-system.md` § Navigation Inventory. Keys,
 * not labels: the words live in messages/. Group `key` doubles as the
 * heading catalog key (`nav.groups.*`).
 *
 * All 22 canonical destinations are wired (Plan C1). Eight of them —
 * review, challenges, sensei, roadmap, weeklyReport, statistics,
 * achievements, settings — are real routes rendering an honest empty state
 * rather than a built feature; a nav row that 404s is worse than one that
 * explains itself. `app-nav.test.tsx` asserts every href resolves to a page
 * file, so a future route rename fails loudly instead of shipping a dead row.
 */
export const NAV_GROUPS = [
  {
    key: "learn",
    items: [
      { href: "/dashboard", key: "dashboard" },
      { href: "/shadowing", key: "lessons" },
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
      { href: "/review", key: "review" },
      { href: "/mining", key: "mining" },
      { href: "/playlists", key: "playlists" },
      { href: "/challenges", key: "challenges" },
      { href: "/community", key: "community" },
      { href: "/leaderboard", key: "leaderboard" },
    ],
  },
  {
    key: "insights",
    items: [
      { href: "/sensei", key: "sensei" },
      { href: "/roadmap", key: "roadmap" },
      { href: "/weekly-report", key: "weeklyReport" },
    ],
  },
  {
    key: "progress",
    items: [
      { href: "/journal", key: "journey" },
      { href: "/statistics", key: "statistics" },
      { href: "/achievements", key: "achievements" },
    ],
  },
  {
    key: "account",
    items: [
      { href: "/profile", key: "profile" },
      { href: "/settings", key: "settings" },
    ],
  },
] as const;
```

- [ ] **Step 5: Make the list region scrollable**

Line 90 — add the test hook and keep the existing behaviour:

```tsx
          <div data-nav-scroll className="flex-1 overflow-y-auto">
```

The old class was `flex-1 md:overflow-y-auto`. Dropping the `md:` prefix is deliberate: with 22 rows the mobile list overflows too.

Verify by hand that `ReduceMotionToggle` and the collapse button in the edge rail (lines 162-177) are still reachable by keyboard with the list scrolled — they sit outside the scroll container and must stay that way. CLAUDE.md §2 rule 4 requires the reduce-motion control to be globally reachable, and a previous branch broke exactly this.

- [ ] **Step 6: Run tests**

Run: `npx vitest run components/layout/app-nav.test.tsx messages/en/nav.pin.test.ts lib/i18n/catalog.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/layout/app-nav.tsx components/layout/app-nav.test.tsx messages/en/nav.json messages/vi/nav.json messages/en/nav.pin.test.ts
git commit -m "feat(nav): complete NAV_GROUPS to its 22 canonical rows and let the list scroll"
```

---

## Task 8: Lesson taxonomy — situations and sources

**Files:**
- Create: `supabase/migrations/20260807000025_lesson_taxonomy.sql`
- Create: `lib/data/lesson-taxonomy.ts`, `lib/data/lesson-taxonomy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface LessonTag { id: string; slug: string; displayOrder: number }
  export async function listSituations(): Promise<LessonTag[]>;
  export async function listSources(): Promise<LessonTag[]>;
  export async function getLessonSituations(lessonId: string): Promise<LessonTag[]>;
  export async function getLessonSources(lessonId: string): Promise<LessonTag[]>;
  ```

**The array return types are a requirement, not a style choice (spec §3.5, D11).** The FK columns are the minimum that serves a single-select chip row; they are not a claim that a lesson has one situation. Consumers must never read `videos.situation_id` directly, so that going many-to-many later changes one query body instead of every call site.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260807000025_lesson_taxonomy.sql`:

```sql
-- supabase/migrations/20260807000025_lesson_taxonomy.sql
-- Plan C spec §3.5 / D11. TWO axes, not one: the Figma chip row mixes
-- situations (Restaurant, Office) with sources (Anime, Podcast, News), while
-- the original design prompt kept them as separate sections. One column would
-- freeze that collapse into the schema.
--
-- `source_id` here means CONTENT ORIGIN (NHK, Podcast, Anime, Drama, Vlog).
-- It is unrelated to `transcripts.source`, which records how a transcript was
-- obtained. Neither should be renamed to the other.
--
-- Cardinality is provisional: FK columns serve the single-select chip row that
-- exists today. Going many-to-many is a foreseen evolution (a
-- lesson_situation_assignments table), not a design failure — which is why
-- lib/data/lesson-taxonomy.ts returns arrays from day one.
--
-- Labels are NOT stored here. Slugs only; display strings live in the i18n
-- catalog (shadowing.situations.*, shadowing.sources.*). English label maps in
-- code are the mistake lib/jlpt-ui.ts's SECTION_LABELS already cost us.

create table lesson_situations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_order int not null default 0
);

create table lesson_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_order int not null default 0
);

alter table videos add column situation_id uuid references lesson_situations (id);
alter table videos add column source_id uuid references lesson_sources (id);

create index idx_videos_situation_id on videos (situation_id);
create index idx_videos_source_id on videos (source_id);

alter table lesson_situations enable row level security;
alter table lesson_sources enable row level security;

create policy lesson_situations_read on lesson_situations for select to authenticated using (true);
create policy lesson_sources_read on lesson_sources for select to authenticated using (true);
-- Writes are service-role only (admin curation), same convention as
-- collections/radicals/kanji/badges: no insert/update/delete policy needed.

insert into lesson_situations (slug, display_order) values
  ('conversation', 1), ('restaurant', 2), ('business', 3), ('daily-life', 4),
  ('travel', 5), ('office', 6), ('shopping', 7), ('cafe', 8);

insert into lesson_sources (slug, display_order) values
  ('youtube', 1), ('nhk', 2), ('podcast', 3), ('drama', 4),
  ('anime', 5), ('vlog', 6), ('news', 7);
```

- [ ] **Step 2: Write the failing test**

Create `lib/data/lesson-taxonomy.test.ts`. `test/supabase-mock.ts` takes one **resolver per table**, and each resolver receives the ordered list of calls made on that `.from(table)` chain — so a single table can answer differently per query:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useTables(tables: Record<string, TableResolver>) {
  const supabase = createMockSupabase({ user: { id: "u1" }, tables });
  vi.mocked(createClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createClient>,
  );
}

describe("lesson taxonomy", () => {
  it("lists situations ordered by display_order", async () => {
    useTables({
      lesson_situations: (calls) => {
        expect(calls).toContainEqual({ op: "order", column: "display_order", ascending: true });
        return {
          data: [
            { id: "s1", slug: "conversation", display_order: 1 },
            { id: "s2", slug: "restaurant", display_order: 2 },
          ],
          error: null,
        };
      },
    });
    const { listSituations } = await import("@/lib/data/lesson-taxonomy");
    expect(await listSituations()).toEqual([
      { id: "s1", slug: "conversation", displayOrder: 1 },
      { id: "s2", slug: "restaurant", displayOrder: 2 },
    ]);
  });

  it("returns a lesson's situations as an array even though the column is single-valued", async () => {
    // Spec D11: cardinality is provisional. Consumers must not learn that a
    // lesson has exactly one situation, so going many-to-many later changes
    // this query body and nothing else.
    useTables({
      videos: (calls) => {
        expect(eqValue(calls, "id")).toBe("lesson-1");
        return { data: { situation_id: "s2" }, error: null };
      },
      lesson_situations: () => ({
        data: [{ id: "s2", slug: "restaurant", display_order: 2 }],
        error: null,
      }),
    });
    const { getLessonSituations } = await import("@/lib/data/lesson-taxonomy");
    const result = await getLessonSituations("lesson-1");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([{ id: "s2", slug: "restaurant", displayOrder: 2 }]);
  });

  it("returns an empty array for a lesson with no situation", async () => {
    useTables({
      videos: () => ({ data: { situation_id: null }, error: null }),
      // No lesson_situations resolver on purpose: the mock throws for an
      // unresolved table, so this also proves the second query is skipped.
    });
    const { getLessonSituations } = await import("@/lib/data/lesson-taxonomy");
    expect(await getLessonSituations("lesson-1")).toEqual([]);
  });
});
```

Note `videos` returns an **object, not an array** here: the implementation ends that chain with `.maybeSingle()`.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/data/lesson-taxonomy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `lib/data/lesson-taxonomy.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * A taxonomy row. `slug` only — display labels live in the i18n catalog
 * (`shadowing.situations.*` / `shadowing.sources.*`), never in the database
 * and never in a map in code (spec §3.5).
 */
export interface LessonTag {
  id: string;
  slug: string;
  displayOrder: number;
}

interface TagRow {
  id: string;
  slug: string;
  display_order: number;
}

function toTag(row: TagRow): LessonTag {
  return { id: row.id, slug: row.slug, displayOrder: row.display_order };
}

async function listTable(table: "lesson_situations" | "lesson_sources"): Promise<LessonTag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id, slug, display_order")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return ((data as TagRow[] | null) ?? []).map(toTag);
}

export async function listSituations(): Promise<LessonTag[]> {
  return listTable("lesson_situations");
}

export async function listSources(): Promise<LessonTag[]> {
  return listTable("lesson_sources");
}

/**
 * Returns ARRAYS deliberately. `videos.situation_id` is a single FK today —
 * the minimum that serves a single-select chip row — but that is a provisional
 * cardinality, not a domain claim (spec D11). Consumers never read the column
 * directly, so introducing a join table later changes only this file.
 */
async function lessonTags(
  lessonId: string,
  column: "situation_id" | "source_id",
  table: "lesson_situations" | "lesson_sources",
): Promise<LessonTag[]> {
  const supabase = createClient();
  const { data: lesson, error: lessonError } = await supabase
    .from("videos")
    .select(column)
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError) throw lessonError;

  const tagId = (lesson as Record<string, string | null> | null)?.[column] ?? null;
  if (!tagId) return [];

  const { data, error } = await supabase
    .from(table)
    .select("id, slug, display_order")
    .eq("id", tagId);
  if (error) throw error;
  return ((data as TagRow[] | null) ?? []).map(toTag);
}

export async function getLessonSituations(lessonId: string): Promise<LessonTag[]> {
  return lessonTags(lessonId, "situation_id", "lesson_situations");
}

export async function getLessonSources(lessonId: string): Promise<LessonTag[]> {
  return lessonTags(lessonId, "source_id", "lesson_sources");
}
```

- [ ] **Step 5: Run tests and the migration**

Run: `npx vitest run lib/data/lesson-taxonomy.test.ts && npx supabase db reset && npx tsc --noEmit`
Expected: PASS; 17 migrations apply cleanly.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260807000025_lesson_taxonomy.sql lib/data/lesson-taxonomy.ts lib/data/lesson-taxonomy.test.ts
git commit -m "feat(data): add the situation/source taxonomy behind an array-returning read path"
```

---

## Task 9: Collections read path and seed

**Files:**
- Create: `supabase/migrations/20260807000026_collections_seed.sql`
- Create: `lib/data/collections.ts`, `lib/data/collections.test.ts`

**Interfaces:**
- Consumes: the existing `collections` / `lesson_collections` tables (migration `20260731000019`).
- Produces:
  ```ts
  export interface Collection {
    id: string; slug: string; title: string;
    description: string | null; coverImageUrl: string | null; displayOrder: number;
  }
  export async function listCollections(): Promise<Collection[]>;
  export async function getCollectionBySlug(slug: string): Promise<Collection | null>;
  export async function listCollectionLessons(collectionId: string): Promise<VideoRow[]>;
  ```

- [ ] **Step 1: Write the seed migration**

Create `supabase/migrations/20260807000026_collections_seed.sql`:

```sql
-- supabase/migrations/20260807000026_collections_seed.sql
-- Plan C spec §3.5 / D4. Content is versioned reference data, so it lives in a
-- migration rather than seed.sql — `db push` must deploy it.
--
-- These rows are EDITORIAL CONTENT, NOT TAXONOMY. A collection is a curated
-- set that CONTAINS lessons; it is not an attribute OF a lesson. They are named
-- after level bands only because the curator chose to shelve Explore by level —
-- `videos.jlpt_level_estimate` and `collections` stay independent, and a later
-- collection may cut across levels entirely. Do not derive one from the other.
--
-- `featured` is a collections row with slug = 'featured', not a boolean column
-- and not a fourth library_access value — see 20260731000019's own comment.

insert into collections (slug, title, description, display_order) values
  ('featured', 'Featured', 'The lesson Korume is putting in front of you today.', 0),
  ('beginner-foundation', 'Beginner Foundation',
   'Start with the phrases that make every familiar moment easier.', 1),
  ('daily-conversation', 'Daily Conversation',
   'Build confidence in everyday spoken Japanese.', 2),
  ('natural-japanese', 'Natural Japanese',
   'Notice the pace, shorthand and small expressions people actually use.', 3),
  ('advanced-expression', 'Advanced Expression',
   'Stay present through nuance, preferences and the unexpected.', 4),
  ('native-fluency', 'Native Fluency',
   'Step into full-speed scenes, podcasts and the details underneath them.', 5);
```

- [ ] **Step 2: Write the failing test**

Create `lib/data/collections.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useTables(tables: Record<string, TableResolver>) {
  const supabase = createMockSupabase({ user: { id: "u1" }, tables });
  vi.mocked(createClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createClient>,
  );
}

describe("collections", () => {
  it("lists collections ordered by display_order", async () => {
    useTables({
      collections: (calls) => {
        expect(calls).toContainEqual({ op: "order", column: "display_order", ascending: true });
        return {
          data: [
            { id: "c0", slug: "featured", title: "Featured", description: null, cover_image_url: null, display_order: 0 },
            { id: "c1", slug: "beginner-foundation", title: "Beginner Foundation", description: "Start…", cover_image_url: null, display_order: 1 },
          ],
          error: null,
        };
      },
    });
    const { listCollections } = await import("@/lib/data/collections");
    const result = await listCollections();
    expect(result.map((c) => c.slug)).toEqual(["featured", "beginner-foundation"]);
    expect(result[1]).toEqual({
      id: "c1", slug: "beginner-foundation", title: "Beginner Foundation",
      description: "Start…", coverImageUrl: null, displayOrder: 1,
    });
  });

  it("returns null for an unknown slug rather than throwing", async () => {
    useTables({
      collections: (calls) => {
        expect(eqValue(calls, "slug")).toBe("nope");
        return { data: null, error: null };
      },
    });
    const { getCollectionBySlug } = await import("@/lib/data/collections");
    expect(await getCollectionBySlug("nope")).toBeNull();
  });

  it("returns an empty array for a collection with no lessons", async () => {
    useTables({
      // No `videos` resolver on purpose: the mock throws for an unresolved
      // table, so this also proves the second query is skipped when there are
      // no memberships.
      lesson_collections: () => ({ data: [], error: null }),
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect(await listCollectionLessons("c1")).toEqual([]);
  });

  it("fetches only the member lessons, by id", async () => {
    useTables({
      lesson_collections: () => ({
        data: [{ lesson_id: "v1" }, { lesson_id: "v2" }],
        error: null,
      }),
      videos: (calls) => {
        expect(calls).toContainEqual({ op: "in", column: "id", values: ["v1", "v2"] });
        return { data: [{ id: "v1" }, { id: "v2" }], error: null };
      },
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect((await listCollectionLessons("c1")).map((v) => v.id)).toEqual(["v1", "v2"]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/data/collections.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `lib/data/collections.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";

/**
 * A curated set that CONTAINS lessons. Not an attribute of a lesson, and not
 * derived from `videos.jlpt_level_estimate` — see the seed migration's comment
 * (spec §3.5).
 */
export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  displayOrder: number;
}

interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  display_order: number;
}

const COLLECTION_COLUMNS = "id, slug, title, description, cover_image_url, display_order";

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    displayOrder: row.display_order,
  };
}

export async function listCollections(): Promise<Collection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return ((data as CollectionRow[] | null) ?? []).map(toCollection);
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toCollection(data as CollectionRow) : null;
}

export async function listCollectionLessons(collectionId: string): Promise<VideoRow[]> {
  const supabase = createClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("lesson_collections")
    .select("lesson_id")
    .eq("collection_id", collectionId);
  if (membershipError) throw membershipError;

  const ids = ((memberships as { lesson_id: string }[] | null) ?? []).map((m) => m.lesson_id);
  if (ids.length === 0) return [];

  // RLS on `videos` still applies: a PLUS lesson the viewer cannot read is
  // filtered by the database, not by this function.
  const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ids);
  if (error) throw error;
  return (data as VideoRow[] | null) ?? [];
}
```

- [ ] **Step 5: Run tests and the migration**

Run: `npx vitest run lib/data/collections.test.ts && npx supabase db reset && npx tsc --noEmit`
Expected: PASS; 18 migrations apply; `select slug from collections order by display_order` returns the six rows.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260807000026_collections_seed.sql lib/data/collections.ts lib/data/collections.test.ts
git commit -m "feat(data): add the collections read path and seed the six editorial collections"
```

---

## Task 10: `LessonRankingStrategy` and `PopularStrategyV1`

**Files:**
- Create: `lib/data/lesson-ranking.ts`, `lib/data/lesson-ranking.test.ts`

**Interfaces:**
- Consumes: `VIDEO_COLUMNS`, `VideoRow` from `lib/data/videos`.
- Produces:
  ```ts
  export interface LessonRankingStrategy {
    readonly id: string;
    rank(input: { userId: string; limit: number }): Promise<VideoRow[]>;
  }
  export const PopularStrategyV1: LessonRankingStrategy;
  ```
  C2's Hub depends on the **interface only** and is tested against a stub.

Ranking is a business decision that will change. The Hub must never see the formula, name it, or render the underlying count (spec D12).

- [ ] **Step 1: Write the failing test**

Create `lib/data/lesson-ranking.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useTables(tables: Record<string, TableResolver>) {
  const supabase = createMockSupabase({ user: { id: "u1" }, tables });
  vi.mocked(createClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createClient>,
  );
}

/** `videos` echoes back whatever ids the strategy asked for, in that order. */
const echoVideos: TableResolver = (calls) => {
  const inCall = calls.find(
    (c): c is Extract<typeof c, { op: "in" }> => c.op === "in",
  );
  const ids = (inCall?.values ?? []) as string[];
  return { data: ids.map((id) => ({ id })), error: null };
};

describe("PopularStrategyV1", () => {
  it("ranks by the number of distinct learner libraries containing the lesson", async () => {
    // Spec §4.2.1. This is Popular v1: a recorded PRODUCT decision, not a
    // placeholder. It is the only real signal the system has — there is no view
    // count, no completion rate, no rating.
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "b", user_id: "u1" },
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "a", user_id: "u2" },
          { lesson_id: "a", user_id: "u3" },
          { lesson_id: "b", user_id: "u2" },
          { lesson_id: "c", user_id: "u1" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    const result = await PopularStrategyV1.rank({ userId: "u1", limit: 10 });
    expect(result.map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("counts each learner once even if the ledger has duplicate rows", async () => {
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "b", user_id: "u1" },
          { lesson_id: "b", user_id: "u2" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    const result = await PopularStrategyV1.rank({ userId: "u1", limit: 10 });
    expect(result.map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("respects the limit", async () => {
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "b", user_id: "u1" },
          { lesson_id: "c", user_id: "u1" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(await PopularStrategyV1.rank({ userId: "u1", limit: 2 })).toHaveLength(2);
  });

  it("drops a ranked lesson RLS hid rather than returning a hole", async () => {
    // A PLUS lesson a Free viewer cannot read is filtered by the database, so
    // the returned array is legitimately shorter than the ranking.
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "secret", user_id: "u2" },
        ],
        error: null,
      }),
      videos: () => ({ data: [{ id: "a" }], error: null }),
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect((await PopularStrategyV1.rank({ userId: "u1", limit: 10 })).map((v) => v.id)).toEqual(["a"]);
  });

  it("returns an empty array when no lesson is in any library", async () => {
    useTables({
      // No `videos` resolver: the mock throws for an unresolved table, so this
      // also proves the second query is skipped.
      user_lesson_library: () => ({ data: [], error: null }),
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(await PopularStrategyV1.rank({ userId: "u1", limit: 10 })).toEqual([]);
  });

  it("identifies itself so a later strategy swap is visible", async () => {
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(PopularStrategyV1.id).toBe("popular-v1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/data/lesson-ranking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/data/lesson-ranking.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";

/**
 * How the Hub asks for a ranked set of lessons.
 *
 * The Hub depends on this interface and nothing else: it never sees the
 * formula, never names it, and never renders the underlying number. Ranking is
 * a business decision that will change — later strategies (TrendingStrategy
 * over a time window, RetentionStrategy, AIRecommendedStrategy) drop in behind
 * this same shape without the screen changing (spec D12).
 *
 * The one thing a caller must never do is label a section "Trending" while a
 * library-count strategy is installed. The label belongs to the strategy, not
 * to the layout.
 */
export interface LessonRankingStrategy {
  readonly id: string;
  rank(input: { userId: string; limit: number }): Promise<VideoRow[]>;
}

/**
 * Popular v1: rank by the count of DISTINCT learner libraries containing the
 * lesson. This is a recorded product decision, not an implementation
 * placeholder — it is the only real signal that exists today. There is no view
 * count, no completion rate and no rating in the schema.
 */
export const PopularStrategyV1: LessonRankingStrategy = {
  id: "popular-v1",

  async rank({ limit }): Promise<VideoRow[]> {
    const supabase = createClient();

    const { data: ledger, error: ledgerError } = await supabase
      .from("user_lesson_library")
      .select("lesson_id, user_id");
    if (ledgerError) throw ledgerError;

    const learnersByLesson = new Map<string, Set<string>>();
    for (const row of (ledger as { lesson_id: string; user_id: string }[] | null) ?? []) {
      const learners = learnersByLesson.get(row.lesson_id) ?? new Set<string>();
      learners.add(row.user_id);
      learnersByLesson.set(row.lesson_id, learners);
    }
    if (learnersByLesson.size === 0) return [];

    const ranked = [...learnersByLesson.entries()]
      // Distinct learners descending; lesson id ascending breaks ties so the
      // order is deterministic and the unit tests are not flaky.
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([lessonId]) => lessonId);

    // RLS still applies: a PLUS lesson the viewer cannot read is filtered by
    // the database, so the returned array may be shorter than `limit`.
    const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ranked);
    if (error) throw error;

    const byId = new Map((((data as VideoRow[] | null) ?? []).map((v) => [v.id, v])));
    return ranked.flatMap((id) => {
      const lesson = byId.get(id);
      return lesson ? [lesson] : [];
    });
  },
};
```

Aggregating in TypeScript rather than SQL is deliberate at this scale: PostgREST cannot express `group by … order by count(*)` without a database view or RPC, and the catalogue is small. If the catalogue grows past a few thousand lessons this becomes a view — the interface is what protects the Hub from that change.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/data/lesson-ranking.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/lesson-ranking.ts lib/data/lesson-ranking.test.ts
git commit -m "feat(data): rank lessons behind LessonRankingStrategy with PopularStrategyV1"
```

---

## Task 11: Full verification gate

**Files:** none — this task only runs commands and records their output.

- [ ] **Step 1: Reset the database and apply every migration**

Run: `npx supabase db reset`
Expected: 18 migrations apply with no error.

- [ ] **Step 2: Types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc 0 errors. Lint 0 errors; warnings still `54 no-non-null-assertion + 23 no-unused-vars`. If the mix changed, find out why before continuing — the count alone is not the signal.

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`
Expected: all pass. Baseline was 2007 across 221 files; this plan adds roughly 30 tests across 8 new files. `pitch-contour.test.tsx` and `waveform.test.tsx` are known CPU-contention flakes — re-run them standalone before treating either as a real failure.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds (~52s) and the route list shows `/[locale]/shadowing`, `/[locale]/shadowing/explore`, `/[locale]/shadowing/[id]`, `/[locale]/shadowing/[id]/dictation`, and the eight new `(app)` routes. No `/[locale]/videos` route.

- [ ] **Step 5: End-to-end**

Run: `npx playwright test`
Expected: 12 pass. Kill any stale node on :3000 first.

- [ ] **Step 6: Browser pass by hand**

Start `npm run dev`, sign in, and check:
1. `/vi/shadowing` renders and the nav highlights **Bài học**.
2. The nav shows five groups and scrolls; **Sensei**, **Lộ trình**, **Cài đặt** are reachable and land on their empty states.
3. With the nav list scrolled to the bottom, the collapse button and the reduce-motion control in the edge rail are still reachable **by keyboard** (CLAUDE.md §2 rules 4 and 5).
4. `/vi/videos` redirects to `/vi/shadowing`.
5. Page widths are **unchanged** from before this plan — `Container` was not touched, so `/vi/dashboard` and friends still measure `max-w-6xl`. A width change anywhere outside a `TwoColumnShell` is a defect in this plan, not an improvement.
6. Nothing overflows horizontally at 1280px or on a phone viewport.

Record what you saw. This step is not optional: the token branch shipped a `--muted` contrast defect that only a real screen in a real browser would have caught.

- [ ] **Step 7: Commit any fixes and hand off for review**

```bash
git add -A
git commit -m "chore: Plan C1 verification gate"
```

---

## Self-Review

**Spec coverage.** §3.1 route move → Task 3. §3.1.1 redirects → Task 4. §3.2 tokens → Task 1, consumed by Task 2. §3.3 `TwoColumnShell` → Task 2. §3.4 nav and the eight routes → Tasks 5, 6, 7. §3.5 collections → Task 9; situations/sources → Task 8. §4.2.1's ranking interface is foundation, not Hub UI, so it lands here as Task 10. §6's C1 testing list is distributed across the tasks that create each unit, with the gate in Task 11.

**Deliberately not in this plan:** everything in spec §9, plus the Hub and Explore screens themselves. `/shadowing` keeps rendering the old `videos/page.tsx` body under a new path until C2 replaces it — that is intended, and C2's first task is where it changes.

**Type consistency.** `LessonTag`, `Collection`, and `LessonRankingStrategy` are each defined in the task that creates them and referenced by name afterwards. `VideoRow` and `VIDEO_COLUMNS` come from the existing `lib/data/videos.ts` and are not redefined. The `test/supabase-mock.ts` API used in Tasks 8-10 was read from the file, not assumed: it is `createMockSupabase({ user, tables })` where each table maps to a `TableResolver` receiving the ordered `QueryCall[]` for that chain — there is no `setResult` or `reset`. `eqValue(calls, column)` and `hasCall(calls, op)` are the two exported helpers.

**One behaviour worth knowing before writing Tasks 8-10:** the mock **throws for a table with no resolver**. Three tests exploit this deliberately, asserting a follow-up query is skipped by simply not providing its resolver. Do not "fix" those by adding one.

**Step-4 verification counts** (`17 migrations`, `18 migrations`, `12 e2e`, `2007` unit baseline) are what the plan expects, not what it asserts. If a number differs, find out why rather than editing the plan to match.
