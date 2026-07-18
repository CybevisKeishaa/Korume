# L9a Plan 2 — Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the design system a capability of the platform — full token system (spacing,
typography, elevation, motion, z-index), a semantic colour layer, eight accessible primitives
(dialog, tabs, select, tooltip, popover, toast, badge, skeleton), and a living style guide —
plus the middleware-composition regression test committed as this plan's first task.

**Architecture:** Tokens live as CSS custom properties in `app/globals.css` and are exposed
through `tailwind.config.ts` (spec §4.4). Colours split into a primitive tier
(`--vermilion-500`) and a semantic tier (`--primary`, `--surface-overlay`) so L9b restyles by
remapping semantics. Behaviour-heavy primitives (dialog, tabs, select, tooltip, popover, toast)
wrap **Radix UI** but never leak its API (spec D7/P8, lint-enforced); presentational ones
(badge, skeleton) are in-house. The style guide is a real route under `/admin` (spec D9) so it
runs on the real theme/locale/token/component implementations and cannot drift.

**Tech Stack:** Next.js 14.2.35 App Router · React 18.3.1 · TypeScript strict · Tailwind 3.4 ·
Radix UI (`@radix-ui/react-*`) · Vitest + RTL (`@/test/render`) · ESLint `no-restricted-imports`.

## Global Constraints

Copied from the spec (`docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`),
`CLAUDE.md`, and Serena `mem:l9a_localization_run_state`. Every task's requirements implicitly
include this section.

- **Where this plan and the code disagree, the code is right and the plan is a bug** — say so,
  fix the plan, don't force reality to match it (spec header; Spec A's hardest-won lesson).
- **Branch:** `layer-9a-design-system` off `master`. Commit freely; NEVER push.
- **Spec §2.9 / P8:** `@radix-ui/*` may be imported ONLY inside `components/ui/**`. The ESLint
  rule ships WITH a test proving it fires (Task 4). `components/ui/*` must NOT leak Radix's API
  to feature code: no `asChild` prop, no re-exported Radix compound parts. Where a compound
  pattern is the best API (Tabs), we define our own components that wrap Radix internally.
- **Spec §8 (binding):** design-system code uses **CSS logical properties** — `ps-*`/`pe-*`,
  `ms-*`/`me-*`, `text-start`/`text-end`, `border-s`/`border-e`, `start-*`/`end-*`,
  `rounded-s-*`/`rounded-e-*` — never `pl-`/`pr-`/`ml-`/`mr-`/`text-left`/`text-right`/
  `border-l`/`border-r`/`rounded-l`/`rounded-r`. Exception: genuinely physical geometry
  (centering transforms `left-1/2 -translate-x-1/2`, swipe gesture direction, shadow direction).
  Enforced by an automated test (Task 4), not convention.
- **P9 / zero visible change:** every token change is additive or value-preserving. Existing
  Tailwind utilities (`bg-primary`, `text-muted-foreground`, `shadow-sm`, `p-4`…) keep working
  with identical computed values. The ONLY intended user-visible change in this plan is the
  admin dialog gaining a real focus trap (an a11y fix repaying the L7 review debt).
- **Keep untouched (load-bearing, from `mem:l9a_localization_run_state`):** middleware order
  (Supabase FIRST → intl) and its cookie-copy loop; `response = NextResponse.next({request})`
  inside `updateSession`'s `setAll`; matcher excluding `api` and `auth`; the HSL-channel token
  format (`4 74% 49%`, no `hsl()` wrapper) with `<alpha-value>`; light/dark via `data-theme`;
  the reduce-motion kill-switch blocks at the bottom of `globals.css`; `vitest.config.ts`
  `server.deps.inline: [/next-intl/]`; the ESLint escape-hatch glob `app/[[]locale[]]/layout.tsx`.
- **CLAUDE.md §5/§9:** every primitive keyboard-navigable, WCAG AA contrast, respects
  reduced-motion (all new animation is plain CSS → automatically covered by the existing
  kill-switch, which collapses `animation-duration`/`transition-duration` globally).
- **CLAUDE.md §7 TDD:** failing test first, then implementation, output shown. Component tests
  import `render` from **`@/test/render`** (never bare `@testing-library/react`).
- **CLAUDE.md §6:** files kebab-case, components PascalCase, TS strict, no `any` without a
  justifying comment, extract when a file passes ~300 lines.
- **P4 (copy ownership):** primitives take user-facing strings via props with English defaults
  (e.g. `closeLabel`). Plan 3 (string extraction) will pass translated copy from feature code;
  primitives themselves never call `useTranslations` (they'd violate the next-intl import
  boundary anyway).
- **Baseline to compare against** (from `mem:project_status`, measured 2026-07-18 @ `69f22e6`):
  unit **1229 tests / 162 files** · `tsc` 0 errors · lint clean · build ~52s · playwright 2/2
  ~37s. Known CPU-contention flakes (standalone-green): `pitch-contour.test.tsx`,
  `waveform.test.tsx`. Kill any stale node on :3000 before e2e (`reuseExistingServer` picks it up).
- Windows shell: commands below use POSIX syntax; run them through the Bash tool (Git Bash).

## File structure (what this plan creates/modifies)

```
middleware.test.ts                          NEW  Task 1  composition regression test
app/globals.css                             MOD  Tasks 2,3  token system + semantic tiers
tailwind.config.ts                          MOD  Tasks 2,3  token exposure
lib/design-tokens.test.ts                   NEW  Tasks 2,3  token-reference + kill-switch guard
.eslintrc.json                              MOD  Task 4  P8 Radix boundary
lib/eslint-rules.test.ts                    MOD  Task 4  fire tests for the new rule
vitest.setup.ts                             MOD  Task 4  jsdom polyfills Radix needs
components/ui/logical-properties.test.ts    NEW  Task 4  spec §8 enforcement
components/ui/dialog.tsx (+test)            NEW  Task 5  Radix dialog, focus trap
components/admin/dialog.tsx                 MOD  Task 5  thin wrapper over ui/dialog
components/ui/tabs.tsx (+test)              NEW  Task 6
components/ui/select.tsx (+test)            NEW  Task 7
components/ui/tooltip.tsx (+test)           NEW  Task 8
components/ui/popover.tsx (+test)           NEW  Task 8
components/ui/toast.tsx (+test)             NEW  Task 9
app/[locale]/layout.tsx                     MOD  Task 9  mount ToastProvider
components/ui/badge.tsx (+test)             NEW  Task 10
components/ui/skeleton.tsx (+test)          NEW  Task 10
components/style-guide/token-sections.tsx   NEW  Task 11
components/style-guide/primitive-sections.tsx NEW Task 11
components/style-guide/style-guide.tsx (+test) NEW Task 11
app/[locale]/(admin)/admin/style-guide/page.tsx NEW Task 11
components/admin/admin-shell.tsx            MOD  Task 11  nav item
```

---

### Task 1: Middleware composition regression test

> Committed as this plan's FIRST task in the L9a Plan 1 final review (Serena
> `mem:l9a_localization_run_state` → "Follow-ups assigned by the final review"). The top-level
> `middleware()` in `middleware.ts` composes Supabase-first → next-intl with a cookie-copy loop.
> That ordering fixed a measured stale-auth-cookie bug, and today NO automated test covers the
> composition — a refactor could silently reopen it. This test is the guard.

**Files:**
- Create: `middleware.test.ts` (repo root, next to `middleware.ts`)

**Interfaces:**
- Consumes: `middleware(request: NextRequest): Promise<NextResponse>` from `middleware.ts`;
  `updateSession` from `@/lib/supabase/middleware` (mocked); real `next-intl` middleware via
  `@/lib/i18n/routing` (`defaultLocale: "vi"`, `localePrefix: "always"`).
- Produces: nothing for later tasks — a pure regression guard.

- [ ] **Step 0: Branch off master**

```bash
git checkout master
git checkout -b layer-9a-design-system
```

- [ ] **Step 1: Write the test**

Create `middleware.test.ts`:

```ts
// @vitest-environment node
//
// Node, not the suite-wide jsdom: NextRequest/NextResponse are built on undici's
// Request/Headers, and Next asserts `headers instanceof Headers`. jsdom installs
// its own Headers global, so a NextRequest built under jsdom fails that check
// inside NextResponse.next(). Same precedent as lib/supabase/middleware.test.ts.
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the top-level middleware COMPOSITION (Supabase first → next-intl →
 * cookie copy), not updateSession's own logic (covered by
 * lib/supabase/middleware.test.ts). This ordering fixed a measured
 * stale-auth-cookie bug (.superpowers/sdd/cookie-forwarding-investigation.md);
 * these tests are what keep a future refactor from silently reopening it.
 *
 * updateSession is mocked; next-intl's middleware runs for real, so the
 * assertions cover what intl actually returns (rewrite for a prefixed URL,
 * 307 for a bare one), not a stub of it.
 */
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

const supabaseMiddleware = await import("@/lib/supabase/middleware");
const updateSession = vi.mocked(supabaseMiddleware.updateSession);
const { middleware } = await import("./middleware");

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

/** updateSession outcome: pass-through response carrying a refreshed cookie. */
function passThroughWithCookie(req: NextRequest): NextResponse {
  const response = NextResponse.next({ request: req });
  response.cookies.set("sb-test-auth-token", "refreshed", { path: "/" });
  return response;
}

describe("middleware composition (Supabase → intl → cookie copy)", () => {
  beforeEach(() => {
    updateSession.mockReset();
  });

  it("returns updateSession's auth redirect untouched — intl never runs over it", async () => {
    // Bare /dashboard: if the auth short-circuit were broken, intl would win
    // and the final Location would be its own redirect (/vi/dashboard). So
    // asserting /vi/login proves the 3xx returned BEFORE intl, behaviourally.
    updateSession.mockImplementation(async (req) =>
      NextResponse.redirect(
        new URL("/vi/login?redirectTo=%2Fvi%2Fdashboard", req.url),
      ),
    );

    const response = await middleware(request("/dashboard"));

    expect(updateSession).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe("/vi/login");
    expect(location.searchParams.get("redirectTo")).toBe("/vi/dashboard");
  });

  it("carries Supabase's refreshed Set-Cookie onto intl's pass-through response", async () => {
    updateSession.mockImplementation(async (req) => passThroughWithCookie(req));

    // Prefixed URL: intl rewrites internally and returns a 200.
    const response = await middleware(request("/en/kanji"));

    expect(response.status).toBe(200);
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
  });

  it("carries the refreshed cookie even when intl redirects a bare URL", async () => {
    updateSession.mockImplementation(async (req) => passThroughWithCookie(req));

    // Bare URL, no Accept-Language, no NEXT_LOCALE cookie → intl 307s to the
    // default locale. The refreshed session cookie must ride along, or the
    // token refresh is lost on every prefix redirect.
    const response = await middleware(request("/kanji"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe("/vi/kanji");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
  });
});
```

- [ ] **Step 2: Run it — expect PASS (characterization test of correct existing code)**

Run: `npx vitest run middleware.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 3: Prove the test can fail (mutation check — same standard as the lint fire-tests)**

Temporarily comment out the cookie-copy loop in `middleware.ts`
(`authResponse.cookies.getAll().forEach(...)`) and run again:

Run: `npx vitest run middleware.test.ts`
Expected: the two cookie tests FAIL (`sb-test-auth-token` undefined).

Then temporarily move the `authResponse.status >= 300` early-return to AFTER
`handleI18nRouting(request)`'s return and confirm the first test FAILS
(location becomes `/vi/dashboard`). **Restore `middleware.ts` exactly** (verify
`git diff middleware.ts` is empty) and re-run: 3/3 PASS.

- [ ] **Step 4: Commit**

```bash
git add middleware.test.ts
git commit -m "test(i18n): guard middleware composition — auth short-circuit + cookie carry"
```

---

### Task 2: Token system — spacing, typography, elevation, motion, z-index

> Spec §4.4 "Tokens": extend `globals.css` from four groups to a full system, exposed through
> Tailwind. All additive — existing utilities keep their exact values. Also §4.5 touchpoint 1:
> typography must serve the locales (VN stacks two tiers of diacritics → generous body
> line-height; Japanese wants more → `--leading-jp`).

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Create: `lib/design-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 5–11): Tailwind utilities `p-2xs…p-3xl`/`gap-*`/`m-*` (spacing keys
  `2xs xs sm md lg xl 2xl 3xl`), `text-caption|body|body-lg|heading|title|display`,
  `leading-jp`, `shadow-raised|overlay|floating`, `duration-fast|base|slow`,
  `ease-standard|out-expo`, `z-nav|overlay|popover|toast`. CSS vars of the same names.

- [ ] **Step 1: Write the failing test**

Create `lib/design-tokens.test.ts` (precedent: `lib/eslint-rules.test.ts` — a repo-config
verification test living in `lib/`):

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The token system's automated contract (spec §2.9: architectural invariants
 * are enforced by tests, not documentation).
 *
 * - Required tokens exist in globals.css — a deleted/renamed token fails here
 *   before it silently falls back to `unset` in the browser.
 * - Every var() referenced by tailwind.config.ts resolves to a definition in
 *   globals.css — a typo'd var name in the Tailwind mapping is otherwise
 *   invisible (CSS treats it as an empty value at runtime).
 * - The reduce-motion kill-switch survives every globals.css edit
 *   (CLAUDE.md §2.4 non-negotiable).
 */
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const tailwind = readFileSync(
  path.join(process.cwd(), "tailwind.config.ts"),
  "utf8",
);

const REQUIRED_TOKENS = [
  // spacing
  "--space-2xs", "--space-xs", "--space-sm", "--space-md",
  "--space-lg", "--space-xl", "--space-2xl", "--space-3xl",
  // typography
  "--text-caption", "--text-body", "--text-body-lg", "--text-heading",
  "--text-title", "--text-display",
  "--leading-caption", "--leading-body", "--leading-body-lg",
  "--leading-heading", "--leading-title", "--leading-display", "--leading-jp",
  "--font-weight-regular", "--font-weight-medium", "--font-weight-semibold",
  "--font-weight-bold",
  "--tracking-tight", "--tracking-wide",
  // elevation
  "--elevation-raised", "--elevation-overlay", "--elevation-floating",
  // motion
  "--duration-fast", "--duration-base", "--duration-slow",
  "--ease-standard", "--ease-out-expo",
  // z-index
  "--z-nav", "--z-overlay", "--z-popover", "--z-toast",
];

describe("design tokens", () => {
  it("defines every required token in globals.css", () => {
    const missing = REQUIRED_TOKENS.filter(
      (token) => !new RegExp(`${token}\\s*:`).test(css),
    );
    expect(missing).toEqual([]);
  });

  it("resolves every var() referenced by tailwind.config.ts", () => {
    const referenced = [...tailwind.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(
      (match) => match[1],
    );
    expect(referenced.length).toBeGreaterThan(0);
    const undefinedVars = referenced.filter(
      (name) => !new RegExp(`${name}\\s*:`).test(css),
    );
    expect(undefinedVars).toEqual([]);
  });

  it("keeps the reduce-motion kill-switch intact", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(':root[data-reduce-motion="true"]');
    // Both blocks must keep collapsing animation AND transition durations.
    const matches = css.match(/animation-duration: 0\.001ms !important/g);
    expect(matches?.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: FAIL — first test reports the full `REQUIRED_TOKENS` list missing.

- [ ] **Step 3: Add the tokens to `app/globals.css`**

Insert AFTER the `[data-theme="dark"]` block and BEFORE `@layer base` (keep both existing
colour blocks and everything below untouched in this task):

```css
/**
 * Foundation tokens beyond colour (L9a Plan 2, spec §4.4).
 * Theme-independent: neither light/dark nor locale changes these. Consumed via
 * tailwind.config.ts (p-md, text-body, shadow-overlay, duration-fast, z-toast…).
 */
:root {
  /* Spacing rhythm. Tailwind's numeric scale stays available; this named scale
     is the design system's own vocabulary for new UI. */
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;

  /* Typography scale: size + line-height pairs. Body line-heights are
     deliberately generous — Vietnamese stacks two tiers of diacritics (ắ ặ ễ)
     and must not clip at any size (spec §4.5 touchpoint 1). */
  --text-caption: 0.75rem;
  --leading-caption: 1.125rem;
  --text-body: 0.875rem;
  --leading-body: 1.375rem;
  --text-body-lg: 1rem;
  --leading-body-lg: 1.625rem;
  --text-heading: 1.25rem;
  --leading-heading: 1.75rem;
  --text-title: 1.75rem;
  --leading-title: 2.25rem;
  --text-display: 2.5rem;
  --leading-display: 3rem;
  /* Japanese line-height: kanji + furigana want more vertical room than Latin
     script at the same size. Use with font-jp (leading-jp utility). */
  --leading-jp: 1.8;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --tracking-tight: -0.025em;
  --tracking-wide: 0.025em;

  /* Elevation. Three steps are enough: resting card, dropdown/popover, modal. */
  --elevation-raised: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --elevation-overlay: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --elevation-floating: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* Motion. Durations + easings as tokens instead of literals scattered
     through CSS (spec §4.4). --ease-out-expo is the curve the L6 celebration
     keyframes already used twice as a literal. */
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --duration-slow: 600ms;
  --ease-standard: ease-out;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* Z-index ladder. Fixed rungs so stacking is a decision made once, not a
     bidding war of hardcoded z-40s. */
  --z-nav: 30;
  --z-overlay: 40;
  --z-popover: 50;
  --z-toast: 60;
}

[data-theme="dark"] {
  /* Shadows need more weight against dark surfaces to read as elevation. */
  --elevation-raised: 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --elevation-overlay: 0 4px 6px -1px rgb(0 0 0 / 0.45), 0 2px 4px -2px rgb(0 0 0 / 0.45);
  --elevation-floating: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5);
}
```

Then migrate the existing motion literals in the SAME file to the tokens (the spec's explicit
"instead of `0.6s cubic-bezier(...)` scattered through CSS"). Values move to the nearest token
rung — deltas are ≤50ms and imperceptible; the curves `ease`→`ease-out` on `.stroke-draw` and
`ease-out` stays `ease-out` elsewhere:

| Selector | Before | After |
|---|---|---|
| `.stroke-draw` | `stroke-draw 0.6s ease forwards` | `stroke-draw var(--duration-slow) var(--ease-standard) forwards` |
| `.level-fill` | `level-fill-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both` | `level-fill-in var(--duration-slow) var(--ease-out-expo) both` |
| `.badge-settle` | `badge-settle-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both` | `badge-settle-in var(--duration-base) var(--ease-out-expo) both` |
| `.panel-in` | `panel-in 0.16s ease-out both` | `panel-in var(--duration-fast) var(--ease-standard) both` |
| `.badge-pulse` | `badge-pulse 0.35s ease-out` | `badge-pulse var(--duration-base) var(--ease-standard)` |

- [ ] **Step 4: Expose the tokens in `tailwind.config.ts`**

Add to `theme.extend` (keep everything already there; `fade-in`'s literal moves to tokens too):

```ts
      spacing: {
        "2xs": "var(--space-2xs)",
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
      },
      fontSize: {
        caption: ["var(--text-caption)", "var(--leading-caption)"],
        body: ["var(--text-body)", "var(--leading-body)"],
        "body-lg": ["var(--text-body-lg)", "var(--leading-body-lg)"],
        heading: ["var(--text-heading)", "var(--leading-heading)"],
        title: ["var(--text-title)", "var(--leading-title)"],
        display: ["var(--text-display)", "var(--leading-display)"],
      },
      lineHeight: {
        jp: "var(--leading-jp)",
      },
      fontWeight: {
        regular: "var(--font-weight-regular)",
        medium: "var(--font-weight-medium)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
      },
      letterSpacing: {
        tight: "var(--tracking-tight)",
        wide: "var(--tracking-wide)",
      },
      boxShadow: {
        raised: "var(--elevation-raised)",
        overlay: "var(--elevation-overlay)",
        floating: "var(--elevation-floating)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        "out-expo": "var(--ease-out-expo)",
      },
      zIndex: {
        nav: "var(--z-nav)",
        overlay: "var(--z-overlay)",
        popover: "var(--z-popover)",
        toast: "var(--z-toast)",
      },
```

and change the existing `animation` entry to:

```ts
      animation: {
        "fade-in": "fade-in var(--duration-base) var(--ease-standard) both",
      },
```

Notes for the implementer:
- `fontWeight`/`letterSpacing` keys `medium|semibold|bold|tight|wide` intentionally OVERRIDE
  Tailwind defaults with var() references to the **identical values** — zero visual change,
  but the style guide can document them and a future theme can adjust them centrally.
- Spacing keys are additive; Tailwind's numeric utilities (`p-4`) are unaffected. `max-w-lg`
  etc. are also unaffected (`maxWidth` is a separate scale that doesn't read `spacing`).

- [ ] **Step 5: Run the token test + full verification**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: 3/3 PASS.

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: full suite green (1229 + 3 new + 3 from Task 1 = 1235), tsc 0, lint clean. The five
migrated animation classes are covered by existing component tests (level-card, badges-grid,
notification-bell) — if any fails, the migration table above was applied wrong.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/design-tokens.test.ts
git commit -m "feat(design): spacing/typography/elevation/motion/z-index token system"
```

---

### Task 3: Semantic colour layer — primitive tier → semantic tier

> Spec §4.4 "Semantic layer": today `--primary` is simultaneously the brand colour and the
> button colour. Split into primitive (`--vermilion-500`) → semantic (`--primary`,
> `--surface-overlay`). L9b restyling then means remapping semantics, not editing 131 files.
> Every existing semantic var keeps its EXACT channel values (they become aliases), so computed
> colours — and therefore the AA contrast pairs — are bit-identical.

**Files:**
- Modify: `app/globals.css` (the two colour blocks only)
- Modify: `tailwind.config.ts` (two new colour keys)
- Modify: `lib/design-tokens.test.ts` (extend contract)

**Interfaces:**
- Consumes: Task 2's file layout.
- Produces (used by Tasks 5–11): Tailwind colours `bg-overlay` (surface for dialog/popover/
  toast panels, alias of today's card colour) and `bg-scrim` (backdrop, used as `bg-scrim/50`);
  the primitive palette vars for the style guide's swatches.

- [ ] **Step 1: Extend the failing test**

Add to `lib/design-tokens.test.ts` inside the existing `describe`:

```ts
  const PRIMITIVE_TOKENS = [
    "--washi-50", "--washi-100", "--white", "--sumi-900",
    "--neutral-100", "--neutral-300", "--neutral-400", "--neutral-600",
    "--ink-700", "--ink-800", "--ink-900", "--ink-950",
    "--vermilion-400", "--vermilion-500",
    "--indigo-300", "--indigo-600",
    "--green-400", "--green-600", "--red-400", "--red-600",
  ];

  // The semantic tier must be var() aliases of primitives in BOTH themes —
  // that indirection is the whole point (L9b restyles by remapping it).
  const SEMANTIC_COLOR_TOKENS = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--muted", "--muted-foreground", "--border", "--input", "--ring",
    "--primary", "--primary-foreground", "--accent", "--accent-foreground",
    "--success", "--danger", "--surface-overlay",
  ];

  it("defines the primitive colour palette", () => {
    const missing = PRIMITIVE_TOKENS.filter(
      (token) => !new RegExp(`${token}\\s*:`).test(css),
    );
    expect(missing).toEqual([]);
  });

  it("defines every semantic colour as a var() alias of a primitive, in both themes", () => {
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const token of SEMANTIC_COLOR_TOKENS) {
      expect(css).toMatch(new RegExp(`${token}:\\s*var\\(--`));
      expect(darkBlock).toMatch(new RegExp(`${token}:\\s*var\\(--`));
    }
    // --scrim is theme-independent: defined once, not remapped in dark.
    expect(css).toMatch(/--scrim:\s*0 0% 0%/);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: FAIL — primitives missing, semantics are raw channels not `var(--…)`.

- [ ] **Step 3: Rewrite the two colour blocks in `app/globals.css`**

Replace the existing `:root { --background: … --radius: 0.75rem; }` and the existing
`[data-theme="dark"] { … }` colour block with (channel values copied verbatim from the current
file — the primitive names are new, the numbers are not):

```css
/**
 * Colour, two tiers (L9a Plan 2, spec §4.4).
 *
 * Primitive tier: raw palette. Named after the material, knows nothing about
 * usage. Theme-independent — both themes draw from the same palette.
 *
 * Semantic tier: what features and primitives actually consume (via Tailwind:
 * bg-primary, text-muted-foreground, bg-overlay…). Always a var() alias of a
 * primitive. Dark theme = remapping the semantic tier, nothing else.
 * L9b restyles the product by editing THIS mapping, not 131 files.
 *
 * Values are HSL channels (no hsl() wrapper) so Tailwind's <alpha-value>
 * works. Contrast pairs unchanged from L1 — WCAG AA (CLAUDE.md §5).
 */
:root {
  /* — primitive tier — */
  --washi-50: 40 33% 98%; /* 生成り washi off-white */
  --washi-100: 40 20% 94%;
  --white: 0 0% 100%;
  --sumi-900: 220 26% 12%; /* 墨 sumi ink */
  --neutral-100: 40 12% 92%;
  --neutral-300: 220 14% 86%;
  --neutral-400: 220 12% 66%;
  --neutral-600: 220 12% 38%;
  --ink-700: 224 16% 22%; /* cinematic dark surfaces */
  --ink-800: 224 18% 18%;
  --ink-900: 224 26% 12%;
  --ink-950: 224 32% 8%;
  --vermilion-400: 4 84% 60%; /* 朱色 vermilion */
  --vermilion-500: 4 74% 49%;
  --indigo-300: 210 70% 66%; /* 藍 indigo */
  --indigo-600: 218 46% 30%;
  --green-400: 148 46% 52%;
  --green-600: 148 52% 34%;
  --red-400: 0 72% 60%;
  --red-600: 0 72% 44%;

  /* — semantic tier (light) — */
  --background: var(--washi-50);
  --foreground: var(--sumi-900);
  --card: var(--white);
  --card-foreground: var(--sumi-900);
  --muted: var(--neutral-100);
  --muted-foreground: var(--neutral-600);
  --border: var(--neutral-300);
  --input: var(--neutral-300);
  --ring: var(--vermilion-500);
  --primary: var(--vermilion-500);
  --primary-foreground: var(--washi-50);
  --accent: var(--indigo-600);
  --accent-foreground: var(--washi-50);
  --success: var(--green-600);
  --danger: var(--red-600);
  /* Surface a floating panel (dialog, popover, select menu, toast) sits on.
     Same as --card today; a separate token so overlays can diverge in L9b. */
  --surface-overlay: var(--white);
  /* Backdrop behind modals, used with alpha (bg-scrim/50). Deliberately the
     same in both themes — a scrim dims, it does not theme. */
  --scrim: 0 0% 0%;

  --radius: 0.75rem;
}

[data-theme="dark"] {
  --background: var(--ink-950);
  --foreground: var(--washi-100);
  --card: var(--ink-900);
  --card-foreground: var(--washi-100);
  --muted: var(--ink-800);
  --muted-foreground: var(--neutral-400);
  --border: var(--ink-700);
  --input: var(--ink-700);
  --ring: var(--vermilion-400);
  --primary: var(--vermilion-400);
  --primary-foreground: var(--ink-950);
  --accent: var(--indigo-300);
  --accent-foreground: var(--ink-950);
  --success: var(--green-400);
  --danger: var(--red-400);
  --surface-overlay: var(--ink-900);
}
```

- [ ] **Step 4: Add the two new colours to `tailwind.config.ts`**

In `theme.extend.colors`, after `danger`:

```ts
        // Floating-panel surface (dialog/popover/select/toast) — semantic tier.
        overlay: "hsl(var(--surface-overlay) / <alpha-value>)",
        // Modal backdrop; use with alpha: bg-scrim/50.
        scrim: "hsl(var(--scrim) / <alpha-value>)",
```

- [ ] **Step 5: Run tests + verify zero visual change**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: all PASS (now 5+ tests in the file).

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: suite green, build succeeds. Because every semantic var resolves to the identical
channel string, rendered CSS colours are byte-identical — reviewers can spot-check by comparing
`git diff app/globals.css` value-by-value against the table in Step 3.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/design-tokens.test.ts
git commit -m "feat(design): split colour into primitive + semantic tiers"
```

---

### Task 4: Design-system boundary — Radix install, P8 lint rule + fire tests, jsdom polyfills, logical-properties enforcement

> Spec §2.9: P8 is enforced by ESLint (`@radix-ui/*` forbidden outside `components/ui/**`) and
> the rule must be PROVEN to fire (Spec A's standard). Spec §8's logical-properties rule gets
> the same treatment — a test, not a convention. Radix needs a few DOM APIs jsdom lacks; the
> polyfills land here so every later primitive task starts from a working harness.

**Files:**
- Modify: `package.json` (+6 Radix deps, via npm install)
- Modify: `.eslintrc.json`
- Modify: `lib/eslint-rules.test.ts`
- Modify: `vitest.setup.ts`
- Create: `components/ui/logical-properties.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `@radix-ui/react-{dialog,tabs,select,tooltip,popover,toast}` importable inside
  `components/ui/**` only; jsdom that Radix primitives render in; the §8 source-scan test that
  Tasks 5–11's files must satisfy.

- [ ] **Step 1: Install Radix**

```bash
npm install @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip
```

Expected: installs cleanly against React 18.3.1 (all Radix 1.x packages support React 18).

- [ ] **Step 2: Write the failing lint fire-tests**

Append inside the `describe("import boundary rules", …)` block of `lib/eslint-rules.test.ts`:

```ts
  it("forbids feature code from importing Radix directly (P8)", async () => {
    const messages = await lint(
      `import * as RadixDialog from "@radix-ui/react-dialog";\nexport const a = RadixDialog;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/components\/ui/);
  });

  it("allows the design system to import Radix", async () => {
    const messages = await lint(
      `import * as RadixDialog from "@radix-ui/react-dialog";\nexport const a = RadixDialog;\n`,
      "components/ui/dialog.tsx",
    );
    expect(messages.join("\n")).not.toMatch(/components\/ui/);
  });

  it("still forbids next/link inside components/ui (override must not gut the other rules)", async () => {
    const messages = await lint(
      `import Link from "next/link";\nexport const a = Link;\n`,
      "components/ui/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n\/navigation/);
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run lib/eslint-rules.test.ts`
Expected: first new test FAILS (no rule yet); third may pass already — the trio together is the
contract.

- [ ] **Step 4: Add the rule to `.eslintrc.json`**

Two changes. First, add a pattern to the TOP-LEVEL `no-restricted-imports` `patterns` array
(after the `next/link` entry):

```json
        {
          "group": ["@radix-ui/*"],
          "message": "Radix may only be imported inside components/ui/. Features consume the design-system primitives, never the headless library (spec §P8, D7)."
        }
```

Second, add an override for `components/ui/**`. It must NOT simply switch
`no-restricted-imports` off (that would also re-allow `next/link`/`next-intl` there — exactly
what the third fire-test guards). Instead it restates the rule minus the Radix pattern:

```json
    {
      "files": ["components/ui/**"],
      "rules": {
        "no-restricted-imports": ["error", {
          "patterns": [
            {
              "group": ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*", "@google/genai"],
              "message": "Provider SDKs may only be imported inside lib/ai/providers/. Application code speaks the port (lib/ai/port.ts). See docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md."
            },
            {
              "group": ["next-intl", "next-intl/*"],
              "message": "next-intl may only be imported inside lib/i18n/. Feature code consumes the localization capability via @/lib/i18n. See docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md §P1."
            },
            {
              "group": ["next/link"],
              "message": "Use { Link } from '@/lib/i18n/navigation' so navigation preserves the active locale. See spec §P2."
            }
          ],
          "paths": [
            {
              "name": "next/navigation",
              "importNames": ["redirect", "useRouter", "usePathname"],
              "message": "Import redirect/useRouter/usePathname from '@/lib/i18n/navigation' so navigation preserves the active locale. useSearchParams, useParams and notFound are locale-irrelevant and stay here. See spec §P2."
            }
          ]
        }]
      }
    }
```

(Yes, this duplicates the top-level config minus one pattern. ESLint overrides replace rule
config wholesale — there is no "extend minus one" syntax in `.eslintrc`. The duplication is the
price of keeping the other boundaries live inside `components/ui/**`; the fire-tests are what
keep the two copies honest.)

- [ ] **Step 5: Run the fire-tests + lint**

Run: `npx vitest run lib/eslint-rules.test.ts && npm run lint`
Expected: all 10 lint-rule tests PASS; `npm run lint` clean (no existing file imports Radix).

- [ ] **Step 6: Write the failing logical-properties test**

Create `components/ui/logical-properties.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec §8 (binding): the design system uses CSS logical properties so RTL is
 * not precluded. Physical inline-axis utilities lock the door on every
 * component they touch. Automated because "convention" decays (spec §2.9).
 *
 * Scope is components/ui/** only — the design system. Feature code migrates
 * when it moves onto the primitives (L9b), not here.
 *
 * Symmetric utilities (px-, mx-, inset-x-) are fine: they render identically
 * in RTL. Centering transforms (left-1/2 -translate-x-1/2) are genuinely
 * physical geometry and also fine — they are not in the forbidden list.
 */
const FORBIDDEN = [
  /\bp[lr]-/, // pl-4 / pr-2 → ps- / pe-
  /\bm[lr]-/, // ml-2 / mr-auto → ms- / me-
  /\btext-left\b/, // → text-start
  /\btext-right\b/, // → text-end
  /\bborder-[lr]\b/, // border-l → border-s
  /\bborder-[lr]-/, // border-l-2 → border-s-2
  /\brounded-[lr]\b/, // rounded-l → rounded-s
  /\brounded-[lr]-/, // rounded-l-md → rounded-s-md
];

const uiDir = path.join(process.cwd(), "components/ui");

describe("design-system logical properties (spec §8)", () => {
  const sources = readdirSync(uiDir).filter(
    (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
  );

  it("scans a non-empty set of primitives", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("%s uses no physical inline-axis utilities", (file) => {
    const text = readFileSync(path.join(uiDir, file), "utf8");
    const hits = FORBIDDEN.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 7: Run it; fix any existing violations**

Run: `npx vitest run components/ui/logical-properties.test.ts`

If any existing primitive (`input.tsx`, `label.tsx`, `container.tsx`, toggles…) fails, convert
the flagged classes to their logical equivalents (`ml-*`→`ms-*`, `pr-*`→`pe-*`,
`text-left`→`text-start`, `border-l*`→`border-s*`, `rounded-l*`→`rounded-s*`; identical
rendering in LTR — zero visual change). Re-run until green.

- [ ] **Step 8: Add the jsdom polyfills Radix needs**

Append to `vitest.setup.ts`:

```ts
// --- Radix primitives under jsdom -------------------------------------------
// Radix (and the floating-ui positioning inside Select/Tooltip/Popover) calls
// DOM APIs jsdom doesn't implement. Guarded: node-environment test files
// (middleware tests) have no window; existing jsdom globals are never replaced.
if (typeof window !== "undefined") {
  if (!window.ResizeObserver) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
```

- [ ] **Step 9: Full suite + commit**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: green (the polyfills must not disturb the existing 162 files — they only fill gaps).

```bash
git add package.json package-lock.json .eslintrc.json lib/eslint-rules.test.ts vitest.setup.ts components/ui/logical-properties.test.ts
git commit -m "feat(design): Radix boundary (P8 lint + fire tests), jsdom polyfills, §8 logical-properties enforcement"
```

---

### Task 5: Dialog primitive (focus trap) + admin dialog rebuilt on it

> Spec §4.4: "dialog (with a focus trap — this also repays the L7 debt)". The L7 review found
> `components/admin/dialog.tsx` lets Tab escape the modal (WCAG 2.4.3). The new
> `components/ui/dialog.tsx` wraps Radix Dialog (real focus trap, portal, scroll lock,
> outside-click dismiss); the admin dialog becomes a thin wrapper with its EXACT current props,
> so its three consumers (`confirm-dialog`, `content-form`, `video-queue`) need zero changes.

**Files:**
- Create: `components/ui/dialog.tsx`
- Create: `components/ui/dialog.test.tsx`
- Modify: `components/admin/dialog.tsx` (replace body with wrapper)

**Interfaces:**
- Consumes: Task 2/3 tokens (`z-overlay`, `bg-scrim`, `bg-overlay`, `shadow-floating`, `p-md`);
  Task 4 polyfills + lint boundary.
- Produces: `Dialog` with props `{ open: boolean; onClose: () => void; title: string;
  description?: string; children: ReactNode; className?: string;
  initialFocusRef?: RefObject<HTMLElement>; closeLabel?: string }`. Admin `Dialog` keeps its
  existing `DialogProps` (`open, title, onClose, children, className, initialFocusRef`).

- [ ] **Step 1: Write the failing test**

Create `components/ui/dialog.test.tsx`:

```tsx
import { useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        <p>secret</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible modal with title and content when open", () => {
    render(
      <Dialog open onClose={() => {}} title="Attach transcript" description="Paste SRT or VTT.">
        <p>body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Attach transcript" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Paste SRT or VTT.")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("focuses the close button on open and traps Tab inside", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => {}} title="Trap">
        <button>first</button>
        <button>last</button>
      </Dialog>,
    );
    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(close).toHaveFocus();
    await user.tab(); // close → first
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
    await user.tab(); // first → last
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
    await user.tab(); // last → WRAPS to close (the trap — the L7 debt)
    expect(close).toHaveFocus();
  });

  it("honours initialFocusRef", () => {
    function Harness() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Dialog open onClose={() => {}} title="Focus" initialFocusRef={ref}>
          <button ref={ref}>target</button>
        </Dialog>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("button", { name: "target" })).toHaveFocus();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Esc">
        <p>body</p>
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns focus to the trigger after closing", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open dialog</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Cycle">
            <p>body</p>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ui/dialog.test.tsx`
Expected: FAIL — `./dialog` does not exist.

- [ ] **Step 3: Implement `components/ui/dialog.tsx`**

```tsx
"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting line under the title; wired to aria-describedby. */
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Element to focus when the dialog opens; defaults to the close button. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Accessible label for the × button. Feature code passes translated copy (P4). */
  closeLabel?: string;
}

/**
 * Modal dialog primitive. Radix supplies the parts hand-rolled modals get
 * wrong — focus trap (repays the L7 WCAG 2.4.3 debt), focus return to the
 * trigger, Escape + outside-click dismiss, scroll lock, portal — while the
 * API stays ours: controlled open/onClose, no Radix surface leaks (P8/D7).
 *
 * Centering uses left-1/2/-translate-x-1/2: genuinely physical geometry,
 * exempt from the §8 logical-properties rule.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  initialFocusRef,
  closeLabel = "Close dialog",
}: DialogProps) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-overlay bg-scrim/50" />
        <RadixDialog.Content
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          // Radix warns to console when Content has neither a Description nor
          // an explicit aria-describedby={undefined}; spread the opt-out only
          // when no description is given.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed left-1/2 top-1/2 z-overlay max-h-[90vh] w-[calc(100%-2rem)] max-w-lg",
            "-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border",
            "bg-overlay p-md text-foreground shadow-floating",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-xs">
            <RadixDialog.Title className="text-heading font-semibold">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label={closeLabel}
              className="shrink-0 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ×
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="mt-1 text-body text-muted-foreground">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className="mt-sm">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run components/ui/dialog.test.tsx`
Expected: 6/6 PASS.

- [ ] **Step 5: Rebuild the admin dialog as a wrapper**

Replace the ENTIRE body of `components/admin/dialog.tsx` with:

```tsx
"use client";

import { Dialog as UiDialog } from "@/components/ui/dialog";

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Element to focus when the dialog opens; defaults to the built-in close
   * (×) button. */
  initialFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * Admin CMS dialog — now a thin wrapper over the design-system dialog
 * (components/ui/dialog.tsx), which adds the real focus trap the L7 review
 * flagged (WCAG 2.4.3). Props are unchanged so the three consumers
 * (confirm-dialog, content-form, video-queue) did not move.
 */
export function Dialog(props: DialogProps) {
  return <UiDialog {...props} />;
}
```

- [ ] **Step 6: Run the admin suites + full suite**

Run: `npx vitest run components/admin`
Expected: PASS. (The wrapper keeps the same roles, the same "Close dialog" label, and Escape
behaviour; content now renders in a portal, which RTL `screen` queries handle. If an admin test
asserts DOM structure that genuinely changed — e.g. querying within a container instead of
`screen` — fix the TEST, and say so in the commit message.)

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add components/ui/dialog.tsx components/ui/dialog.test.tsx components/admin/dialog.tsx
git commit -m "feat(design): dialog primitive with focus trap; admin dialog rides it (repays L7 WCAG 2.4.3 debt)"
```

---

### Task 6: Tabs primitive

**Files:**
- Create: `components/ui/tabs.tsx`
- Create: `components/ui/tabs.test.tsx`

**Interfaces:**
- Consumes: tokens + Task 4 harness.
- Produces: `Tabs { value?: string; defaultValue?: string; onValueChange?: (value: string) =>
  void; className?: string; children }` · `TabsList { "aria-label"?: string; className?;
  children }` · `TabsTrigger { value: string; className?; children }` · `TabsContent { value:
  string; className?; children }`. Our own compound components (the pattern adopted as ours per
  D7 — nothing Radix-specific in the API).

- [ ] **Step 1: Write the failing test**

Create `components/ui/tabs.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Harness() {
  return (
    <Tabs defaultValue="queue">
      <TabsList aria-label="Peer review">
        <TabsTrigger value="queue">Queue</TabsTrigger>
        <TabsTrigger value="mine">Mine</TabsTrigger>
      </TabsList>
      <TabsContent value="queue">queue panel</TabsContent>
      <TabsContent value="mine">mine panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders the tablist pattern with only the active panel visible", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Peer review" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("queue panel")).toBeInTheDocument();
    expect(screen.queryByText("mine panel")).not.toBeInTheDocument();
  });

  it("switches panels on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Mine" }));
    expect(screen.getByText("mine panel")).toBeInTheDocument();
    expect(screen.queryByText("queue panel")).not.toBeInTheDocument();
  });

  it("moves selection with arrow keys (roving tabindex)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Queue" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true");
    // Only the focused tab is in the Tab order (roving tabindex).
    expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute("tabindex", "-1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ui/tabs.test.tsx`
Expected: FAIL — `./tabs` does not exist.

- [ ] **Step 3: Implement `components/ui/tabs.tsx`**

```tsx
"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Tabs primitive. Radix supplies roving tabindex, arrow-key navigation and
 * the WAI-ARIA tabs pattern; the compound API (Tabs/TabsList/TabsTrigger/
 * TabsContent) is defined here as our own (D7: adopt the pattern, never
 * re-export the import).
 */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={className}
    >
      {children}
    </RadixTabs.Root>
  );
}

export function TabsList({
  "aria-label": ariaLabel,
  className,
  children,
}: {
  "aria-label"?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.List
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-2xs rounded-md bg-muted p-2xs", className)}
    >
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        "rounded-sm px-sm py-2xs text-body font-medium text-muted-foreground",
        "transition-colors duration-fast hover:text-foreground",
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-raised",
        className,
      )}
    >
      {children}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Content value={value} className={cn("mt-md", className)}>
      {children}
    </RadixTabs.Content>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run components/ui/tabs.test.tsx components/ui/logical-properties.test.ts`
Expected: PASS (including the §8 scan over the new file).

- [ ] **Step 5: Commit**

```bash
git add components/ui/tabs.tsx components/ui/tabs.test.tsx
git commit -m "feat(design): tabs primitive (WAI-ARIA tabs, roving tabindex)"
```

---

### Task 7: Select primitive

**Files:**
- Create: `components/ui/select.tsx`
- Create: `components/ui/select.test.tsx`

**Interfaces:**
- Consumes: tokens + Task 4 harness (Select is WHY the pointer-capture polyfills exist).
- Produces:
  `SelectOption { value: string; label: string; disabled?: boolean }` ·
  `Select { value?: string; onValueChange?: (value: string) => void; options: SelectOption[];
  placeholder?: string; id?: string; disabled?: boolean; className?: string;
  "aria-label"?: string }`. Flat options-prop API — no compound parts at all, so nothing can
  leak (P8). `id` lets a feature pair it with `<Label htmlFor>`.

- [ ] **Step 1: Write the failing test**

Create `components/ui/select.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { Select } from "./select";

const options = [
  { value: "n5", label: "JLPT N5" },
  { value: "n4", label: "JLPT N4" },
  { value: "n3", label: "JLPT N3", disabled: true },
];

describe("Select", () => {
  it("renders a combobox showing the placeholder until a value is chosen", () => {
    render(
      <Select options={options} placeholder="Choose a level" aria-label="Level" />,
    );
    const trigger = screen.getByRole("combobox", { name: "Level" });
    expect(trigger).toHaveTextContent("Choose a level");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click and lists the options", async () => {
    const user = userEvent.setup();
    render(<Select options={options} aria-label="Level" />);
    await user.click(screen.getByRole("combobox", { name: "Level" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JLPT N5" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JLPT N3" })).toHaveAttribute(
      "data-disabled",
    );
  });

  it("reports the chosen value and closes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select options={options} onValueChange={onValueChange} aria-label="Level" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Level" }));
    await user.click(await screen.findByRole("option", { name: "JLPT N4" }));
    expect(onValueChange).toHaveBeenCalledWith("n4");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the selected option's label when controlled", () => {
    render(<Select options={options} value="n5" aria-label="Level" />);
    expect(screen.getByRole("combobox", { name: "Level" })).toHaveTextContent(
      "JLPT N5",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ui/select.test.tsx`
Expected: FAIL — `./select` does not exist.

- [ ] **Step 3: Implement `components/ui/select.tsx`**

```tsx
"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Pair with <Label htmlFor={id}>. */
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Select primitive. Radix supplies typeahead, keyboard navigation and the
 * listbox ARIA pattern. The API is a flat options array on purpose: nothing
 * compound to leak (P8), and every call site stays declarative.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-xs rounded-md border border-input",
          "bg-card px-sm text-body text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon aria-hidden="true" className="text-muted-foreground">
          ▾
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-popover max-h-72 min-w-[--radix-select-trigger-width] overflow-y-auto",
            "rounded-md border border-border bg-overlay shadow-overlay",
          )}
        >
          <RadixSelect.Viewport className="p-2xs">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "flex cursor-default select-none items-center justify-between gap-xs rounded-sm",
                  "px-sm py-2xs text-body text-foreground outline-none",
                  "data-[highlighted]:bg-muted data-[disabled]:opacity-50",
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator aria-hidden="true">✓</RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run components/ui/select.test.tsx components/ui/logical-properties.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/select.tsx components/ui/select.test.tsx
git commit -m "feat(design): select primitive (flat options API over Radix listbox)"
```

---

### Task 8: Tooltip + Popover primitives

**Files:**
- Create: `components/ui/tooltip.tsx`, `components/ui/tooltip.test.tsx`
- Create: `components/ui/popover.tsx`, `components/ui/popover.test.tsx`

**Interfaces:**
- Consumes: tokens + Task 4 harness.
- Produces:
  `type Side = "top" | "bottom" | "left" | "right"` (geometric vocabulary, defined by us) ·
  `Tooltip { content: ReactNode; side?: Side; children: ReactElement }` — children is the
  trigger element; the trigger gains `aria-describedby` wiring automatically ·
  `Popover { trigger: ReactElement; open?: boolean; onOpenChange?: (open: boolean) => void;
  side?: Side; align?: "start" | "center" | "end"; className?: string; children: ReactNode }`.
  (`asChild` is used INTERNALLY on the trigger; it never appears in our props — P8.)

- [ ] **Step 1: Write the failing tooltip test**

Create `components/ui/tooltip.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("is hidden until the trigger is focused, then describes it", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Plays the reference audio">
        <button>play</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab(); // keyboard focus opens instantly — a11y path, no hover needed
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Plays the reference audio");
    expect(screen.getByRole("button", { name: /play/ })).toHaveAttribute(
      "aria-describedby",
    );
  });

  it("hides again on blur", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="tip">
        <button>trigger</button>
      </Tooltip>,
    );
    await user.tab();
    await screen.findByRole("tooltip");
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ui/tooltip.test.tsx`
Expected: FAIL — `./tooltip` does not exist.

- [ ] **Step 3: Implement `components/ui/tooltip.tsx`**

```tsx
"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

export type Side = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: React.ReactNode;
  side?: Side;
  /** The trigger. Must be a single focusable element (button, link…). */
  children: React.ReactElement;
}

/**
 * Tooltip primitive. Radix wires aria-describedby, opens on keyboard focus
 * (not only hover — CLAUDE.md §5), and positions with collision handling.
 * Never put interactive content in a tooltip; that is what Popover is for.
 */
export function Tooltip({ content, side = "top", children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-popover rounded-md bg-foreground px-xs py-2xs text-caption text-background shadow-overlay"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
```

- [ ] **Step 4: Run the tooltip test**

Run: `npx vitest run components/ui/tooltip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing popover test**

Create `components/ui/popover.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Popover } from "./popover";

describe("Popover", () => {
  it("opens on trigger click and renders content", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>save to playlist</button>}>
        <p>playlist list</p>
      </Popover>,
    );
    expect(screen.queryByText("playlist list")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "save to playlist" }));
    expect(await screen.findByText("playlist list")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "save to playlist" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>open</button>}>
        <p>content</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "open" });
    await user.click(trigger);
    await screen.findByText("content");
    await user.keyboard("{Escape}");
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("supports controlled open state", async () => {
    render(
      <Popover trigger={<button>anchor</button>} open onOpenChange={() => {}}>
        <p>controlled content</p>
      </Popover>,
    );
    expect(await screen.findByText("controlled content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run components/ui/popover.test.tsx`
Expected: FAIL — `./popover` does not exist.

- [ ] **Step 7: Implement `components/ui/popover.tsx`**

```tsx
"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import type { Side } from "./tooltip";

export interface PopoverProps {
  /** The anchor/trigger. Must be a single focusable element. */
  trigger: React.ReactElement;
  /** Controlled open state; omit for uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: Side;
  align?: "start" | "center" | "end";
  className?: string;
  children: React.ReactNode;
}

/**
 * Popover primitive: interactive floating content anchored to a trigger.
 * Radix supplies focus management, Escape/outside-click dismiss, positioning
 * with collision handling. The trigger is passed as a prop; `asChild` stays
 * an internal detail (P8).
 */
export function Popover({
  trigger,
  open,
  onOpenChange,
  side = "bottom",
  align = "center",
  className,
  children,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-popover rounded-md border border-border bg-overlay p-md text-foreground shadow-overlay",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
```

- [ ] **Step 8: Run both + §8 scan**

Run: `npx vitest run components/ui/popover.test.tsx components/ui/tooltip.test.tsx components/ui/logical-properties.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/ui/tooltip.tsx components/ui/tooltip.test.tsx components/ui/popover.tsx components/ui/popover.test.tsx
git commit -m "feat(design): tooltip + popover primitives"
```

---

### Task 9: Toast primitive + provider mounted in the locale layout

**Files:**
- Create: `components/ui/toast.tsx`
- Create: `components/ui/toast.test.tsx`
- Modify: `app/[locale]/layout.tsx` (mount `ToastProvider` inside `ThemeProvider`)

**Interfaces:**
- Consumes: tokens + Task 4 harness.
- Produces: `ToastProvider { children; dismissLabel?: string }` (mounted once, app-wide) ·
  `useToast(): { toast: (options: ToastOptions) => void }` ·
  `ToastOptions { title: string; description?: string; variant?: "default" | "success" |
  "danger"; durationMs?: number }`. Any client component anywhere under the layout can call
  `useToast()` — this is the app-wide notification surface L9b builds on.

- [ ] **Step 1: Write the failing test**

Create `components/ui/toast.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@/test/render";
import { ToastProvider, useToast } from "./toast";

function Demo() {
  const { toast } = useToast();
  return (
    <button
      onClick={() =>
        toast({ title: "Card saved", description: "Added to your deck", variant: "success" })
      }
    >
      save
    </button>
  );
}

describe("Toast", () => {
  it("shows a toast with title and description when requested", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findByText("Card saved")).toBeInTheDocument();
    expect(screen.getByText("Added to your deck")).toBeInTheDocument();
  });

  it("dismisses via the close button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("Card saved");
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitForElementToBeRemoved(() => screen.queryByText("Card saved"));
  });

  it("stacks multiple toasts", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findAllByText("Card saved")).toHaveLength(2);
  });

  it("useToast outside the provider throws a helpful error", () => {
    // Silence React's error boundary noise for the expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Demo />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
```

(add `vi` to the vitest import line: `import { describe, expect, it, vi } from "vitest";`)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ui/toast.test.tsx`
Expected: FAIL — `./toast` does not exist.

- [ ] **Step 3: Implement `components/ui/toast.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay. Defaults to the provider's 5000ms. */
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/** Fire a toast from any client component under <ToastProvider>. */
export function useToast(): { toast: (options: ToastOptions) => void } {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return { toast };
}

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-success/50",
  danger: "border-danger/50",
};

/**
 * App-wide toast surface (mounted once in app/[locale]/layout.tsx). Radix
 * supplies aria-live announcement, hotkey focus (F8), pause-on-hover and
 * swipe dismiss; the queue and the `toast()` API are ours (P8).
 *
 * swipeDirection is genuinely physical (a gesture), exempt from §8.
 */
export function ToastProvider({
  children,
  dismissLabel = "Dismiss notification",
}: {
  children: React.ReactNode;
  dismissLabel?: string;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToasts((current) => [...current, { ...options, id: nextId.current }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      <RadixToast.Provider duration={5000} swipeDirection="right">
        {children}
        {toasts.map((item) => (
          <RadixToast.Root
            key={item.id}
            duration={item.durationMs}
            onOpenChange={(open) => {
              if (!open) remove(item.id);
            }}
            className={cn(
              "flex items-start justify-between gap-xs rounded-md border bg-overlay p-sm",
              "text-foreground shadow-floating",
              variantStyles[item.variant ?? "default"],
            )}
          >
            <div>
              <RadixToast.Title className="text-body font-medium">
                {item.title}
              </RadixToast.Title>
              {item.description ? (
                <RadixToast.Description className="mt-1 text-body text-muted-foreground">
                  {item.description}
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close
              aria-label={dismissLabel}
              className="shrink-0 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ×
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport
          className={cn(
            "fixed bottom-4 end-4 z-toast flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-xs",
            "outline-none",
          )}
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run components/ui/toast.test.tsx components/ui/logical-properties.test.ts`
Expected: PASS.

- [ ] **Step 5: Mount the provider in `app/[locale]/layout.tsx`**

Add the import:

```tsx
import { ToastProvider } from "@/components/ui/toast";
```

and change the provider nesting in the returned JSX from
`<ThemeProvider>{children}</ThemeProvider>` to:

```tsx
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
```

- [ ] **Step 6: Full suite + build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: green; the build's route table still shows every no-dynamic-segment page as SSG per
locale (ToastProvider is a client component but renders on the server without touching
browser APIs at module scope, so it must not force anything dynamic).

- [ ] **Step 7: Commit**

```bash
git add components/ui/toast.tsx components/ui/toast.test.tsx "app/[locale]/layout.tsx"
git commit -m "feat(design): toast primitive + app-wide provider"
```

---

### Task 10: Badge + Skeleton primitives (in-house)

> D7's other half: mostly-presentational primitives are implemented in-house, no headless dep.

**Files:**
- Create: `components/ui/badge.tsx`, `components/ui/badge.test.tsx`
- Create: `components/ui/skeleton.tsx`, `components/ui/skeleton.test.tsx`

**Interfaces:**
- Consumes: tokens.
- Produces: `Badge` (`React.HTMLAttributes<HTMLSpanElement> & { variant?: "neutral" | "primary"
  | "accent" | "success" | "danger" | "outline" }`) · `Skeleton`
  (`React.HTMLAttributes<HTMLDivElement>`, always `aria-hidden`).

- [ ] **Step 1: Write the failing tests**

Create `components/ui/badge.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>N5</Badge>);
    expect(screen.getByText("N5")).toBeInTheDocument();
  });

  it("applies the variant style", () => {
    render(<Badge variant="success">passed</Badge>);
    expect(screen.getByText("passed").className).toContain("text-success");
  });

  it("defaults to the neutral variant and merges className", () => {
    render(<Badge className="uppercase">draft</Badge>);
    const badge = screen.getByText("draft");
    expect(badge.className).toContain("bg-muted");
    expect(badge.className).toContain("uppercase");
  });
});
```

Create `components/ui/skeleton.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive tech and pulses", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const skeleton = container.firstElementChild as HTMLElement;
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    // animate-pulse is collapsed to a single 0.001ms iteration by the global
    // reduce-motion kill-switch — no extra handling needed here.
    expect(skeleton.className).toContain("animate-pulse");
    expect(skeleton.className).toContain("w-32");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/ui/badge.test.tsx components/ui/skeleton.test.tsx`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement**

Create `components/ui/badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "danger"
  | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  outline: "border border-border text-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Small status label (JLPT level, verified flag, counts). Purely visual —
 * pair with visually-hidden text if the colour alone carries meaning. */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-xs py-0.5 text-caption font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
```

Create `components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils";

/**
 * Loading placeholder. aria-hidden always: loading state should be announced
 * by the surface that owns it (aria-busy / status text), not by each bone.
 * The pulse is killed by the global reduce-motion switch.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run + commit**

Run: `npx vitest run components/ui/badge.test.tsx components/ui/skeleton.test.tsx components/ui/logical-properties.test.ts`
Expected: PASS.

```bash
git add components/ui/badge.tsx components/ui/badge.test.tsx components/ui/skeleton.tsx components/ui/skeleton.test.tsx
git commit -m "feat(design): badge + skeleton primitives (in-house)"
```

---

### Task 11: The living style guide (D9)

> An executable specification inside the app: real routing, real provider, real theme, real
> tokens, real components — gated behind the existing `(admin)` layout (`requireAdmin()`), which
> satisfies D9's "dev/admin" gate with zero new auth logic (local dev has a bootstrap admin via
> `ADMIN_EMAILS`). All demo copy is English — Plan 3 extracts admin-surface strings.

**Files:**
- Create: `components/style-guide/token-sections.tsx`
- Create: `components/style-guide/primitive-sections.tsx`
- Create: `components/style-guide/style-guide.tsx`
- Create: `components/style-guide/style-guide.test.tsx`
- Create: `app/[locale]/(admin)/admin/style-guide/page.tsx`
- Modify: `components/admin/admin-shell.tsx` (one nav item)

**Interfaces:**
- Consumes: everything Tasks 2–10 produced, plus existing `Button`, `Card`, `Input`, `Label`,
  `Container`, `ThemeToggle`, `ReduceMotionToggle`, and `Link` from `@/lib/i18n/navigation`.
- Produces: route `/[locale]/admin/style-guide`. No code interface for later tasks.

- [ ] **Step 1: Write the failing smoke test**

Create `components/style-guide/style-guide.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ToastProvider } from "@/components/ui/toast";
import { StyleGuide } from "./style-guide";

/**
 * Smoke coverage only: every section of the executable spec renders inside
 * the real providers. Behaviour of each primitive is covered by its own
 * test file; visual verification is the page's own job (D9).
 *
 * ToastProvider wraps the render because PrimitiveSections calls useToast();
 * the real page gets the provider from app/[locale]/layout.tsx (Task 9).
 */
function renderGuide() {
  return render(
    <ToastProvider>
      <StyleGuide />
    </ToastProvider>,
  );
}

describe("StyleGuide", () => {
  it("renders every section", () => {
    renderGuide();
    for (const heading of [
      "Colour",
      "Typography",
      "Spacing",
      "Elevation",
      "Motion",
      "Z-index",
      "Primitives",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("shows the locale-stress samples (VN diacritics + Japanese)", () => {
    render(<StyleGuide />);
    expect(
      screen.getByText(/Học tiếng Nhật qua phim/),
    ).toBeInTheDocument();
    expect(screen.getByText(/映画で日本語を学ぶ/)).toBeInTheDocument();
  });

  it("demos every primitive", () => {
    render(<StyleGuide />);
    for (const name of [
      "Button",
      "Badge",
      "Skeleton",
      "Dialog",
      "Tabs",
      "Select",
      "Tooltip",
      "Popover",
      "Toast",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/style-guide/style-guide.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the token sections**

Create `components/style-guide/token-sections.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";

/** Token catalogues. Kept as plain data so the page IS the documentation —
 * a token added to globals.css without being listed here shows up in review. */
const PRIMITIVE_COLORS = [
  "--washi-50", "--washi-100", "--white", "--sumi-900",
  "--neutral-100", "--neutral-300", "--neutral-400", "--neutral-600",
  "--ink-700", "--ink-800", "--ink-900", "--ink-950",
  "--vermilion-400", "--vermilion-500", "--indigo-300", "--indigo-600",
  "--green-400", "--green-600", "--red-400", "--red-600",
];

const SEMANTIC_COLORS = [
  "--background", "--foreground", "--card", "--muted", "--muted-foreground",
  "--border", "--primary", "--accent", "--success", "--danger",
  "--surface-overlay", "--scrim",
];

const SPACING = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"];

const TYPE_SCALE = [
  { cls: "text-display", name: "display" },
  { cls: "text-title", name: "title" },
  { cls: "text-heading", name: "heading" },
  { cls: "text-body-lg", name: "body-lg" },
  { cls: "text-body", name: "body" },
  { cls: "text-caption", name: "caption" },
] as const;

const MOTION_TOKENS = [
  "--duration-fast", "--duration-base", "--duration-slow",
  "--ease-standard", "--ease-out-expo",
];

const Z_TOKENS = ["--z-nav", "--z-overlay", "--z-popover", "--z-toast"];

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-xs">
      <span
        aria-hidden="true"
        className="h-8 w-8 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: `hsl(var(${token}))` }}
      />
      <code className="text-caption">{token}</code>
    </div>
  );
}

export function ColorSection() {
  return (
    <section aria-labelledby="sg-colour">
      <h2 id="sg-colour" className="text-heading font-semibold">Colour</h2>
      <h3 className="mt-md text-body-lg font-medium">Primitive tier</h3>
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-3 lg:grid-cols-4">
        {PRIMITIVE_COLORS.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
      <h3 className="mt-md text-body-lg font-medium">Semantic tier</h3>
      <p className="text-body text-muted-foreground">
        Features consume ONLY this tier. Dark theme remaps it; L9b restyles by editing the
        mapping, not the features.
      </p>
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-3 lg:grid-cols-4">
        {SEMANTIC_COLORS.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
    </section>
  );
}

export function TypographySection() {
  return (
    <section aria-labelledby="sg-typography">
      <h2 id="sg-typography" className="text-heading font-semibold">Typography</h2>
      <div className="mt-md space-y-sm">
        {TYPE_SCALE.map(({ cls, name }) => (
          <div key={name}>
            <code className="text-caption text-muted-foreground">{name}</code>
            <p className={cls}>Học tiếng Nhật qua phim — ắ ặ ễ ỡ ườ</p>
          </div>
        ))}
        <div>
          <code className="text-caption text-muted-foreground">font-jp + leading-jp</code>
          <p lang="ja" className="font-jp text-body-lg leading-jp">
            映画で日本語を学ぶ — 振り仮名のための行間。
          </p>
        </div>
        <p className="text-body text-muted-foreground">
          Body line-heights are sized for stacked Vietnamese diacritics; Japanese text takes
          leading-jp (spec §4.5 touchpoint 1).
        </p>
      </div>
    </section>
  );
}

export function SpacingSection() {
  return (
    <section aria-labelledby="sg-spacing">
      <h2 id="sg-spacing" className="text-heading font-semibold">Spacing</h2>
      <div className="mt-md space-y-xs">
        {SPACING.map((step) => (
          <div key={step} className="flex items-center gap-sm">
            <code className="w-12 text-caption">{step}</code>
            <span
              aria-hidden="true"
              className="h-4 rounded-sm bg-primary"
              style={{ width: `var(--space-${step})` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ElevationSection() {
  return (
    <section aria-labelledby="sg-elevation">
      <h2 id="sg-elevation" className="text-heading font-semibold">Elevation</h2>
      <div className="mt-md flex flex-wrap gap-lg">
        {(["raised", "overlay", "floating"] as const).map((step) => (
          <Card key={step} className={`shadow-${step} p-md`}>
            <code className="text-caption">shadow-{step}</code>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function MotionSection() {
  return (
    <section aria-labelledby="sg-motion">
      <h2 id="sg-motion" className="text-heading font-semibold">Motion</h2>
      <ul className="mt-md space-y-2xs">
        {MOTION_TOKENS.map((token) => (
          <li key={token}>
            <code className="text-caption">{token}</code>
          </li>
        ))}
      </ul>
      <p className="mt-xs animate-fade-in text-body text-muted-foreground">
        This line uses animate-fade-in (duration-base × ease-standard). With reduce motion
        on — toggle above — it must appear instantly.
      </p>
    </section>
  );
}

export function ZIndexSection() {
  return (
    <section aria-labelledby="sg-zindex">
      <h2 id="sg-zindex" className="text-heading font-semibold">Z-index</h2>
      <ul className="mt-md space-y-2xs">
        {Z_TOKENS.map((token) => (
          <li key={token}>
            <code className="text-caption">{token}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Implement the primitive sections**

Create `components/style-guide/primitive-sections.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Popover } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

function Demo({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-md">
      <h3 className="text-body-lg font-medium">{name}</h3>
      <div className="mt-sm">{children}</div>
    </div>
  );
}

export function PrimitiveSections() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [level, setLevel] = useState<string | undefined>();
  const { toast } = useToast();

  return (
    <section aria-labelledby="sg-primitives">
      <h2 id="sg-primitives" className="text-heading font-semibold">Primitives</h2>
      <div className="mt-md grid gap-md lg:grid-cols-2">
        <Demo name="Button">
          <div className="flex flex-wrap items-center gap-xs">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </Demo>

        <Demo name="Badge">
          <div className="flex flex-wrap items-center gap-xs">
            <Badge>neutral</Badge>
            <Badge variant="primary">primary</Badge>
            <Badge variant="accent">accent</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="outline">outline</Badge>
          </div>
        </Demo>

        <Demo name="Skeleton">
          <div className="space-y-xs">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Demo>

        <Demo name="Dialog">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Example dialog"
            description="Focus is trapped; Escape and backdrop close it."
          >
            <Button onClick={() => setDialogOpen(false)}>Done</Button>
          </Dialog>
        </Demo>

        <Demo name="Tabs">
          <Tabs defaultValue="one">
            <TabsList aria-label="Example tabs">
              <TabsTrigger value="one">First</TabsTrigger>
              <TabsTrigger value="two">Second</TabsTrigger>
            </TabsList>
            <TabsContent value="one">First panel — arrow keys move selection.</TabsContent>
            <TabsContent value="two">Second panel.</TabsContent>
          </Tabs>
        </Demo>

        <Demo name="Select">
          <Select
            aria-label="JLPT level"
            placeholder="Choose a level"
            value={level}
            onValueChange={setLevel}
            options={[
              { value: "n5", label: "JLPT N5" },
              { value: "n4", label: "JLPT N4" },
              { value: "n3", label: "JLPT N3", disabled: true },
            ]}
          />
        </Demo>

        <Demo name="Tooltip">
          <Tooltip content="Shown on hover and on keyboard focus">
            <Button variant="outline">Focus or hover me</Button>
          </Tooltip>
        </Demo>

        <Demo name="Popover">
          <Popover trigger={<Button variant="outline">Open popover</Button>}>
            <p className="text-body">Interactive floating content.</p>
          </Popover>
        </Demo>

        <Demo name="Toast">
          <div className="flex flex-wrap gap-xs">
            <Button
              variant="outline"
              onClick={() => toast({ title: "Saved", variant: "success" })}
            >
              Success toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Something failed",
                  description: "With a description line.",
                  variant: "danger",
                })
              }
            >
              Danger toast
            </Button>
          </div>
        </Demo>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Implement the page shell**

Create `components/style-guide/style-guide.tsx`:

```tsx
"use client";

import { Link } from "@/lib/i18n/navigation";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { routing } from "@/lib/i18n/routing";
import {
  ColorSection,
  ElevationSection,
  MotionSection,
  SpacingSection,
  TypographySection,
  ZIndexSection,
} from "./token-sections";
import { PrimitiveSections } from "./primitive-sections";

/**
 * D9: the design-system laboratory. Not documentation ABOUT the system — it
 * renders the real tokens and the real primitives through the real providers,
 * so it cannot drift. Verify theme × locale × reduced-motion × responsive here.
 *
 * The explicit per-locale links are the locale axis of the lab. Passing
 * `locale` to Link is the one surface where choosing a locale IS the feature —
 * the exception that proves P2, same as lib/i18n's own internals.
 */
export function StyleGuide() {
  return (
    <div className="space-y-2xl">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="text-title font-semibold">Style guide</h1>
          <p className="text-body text-muted-foreground">
            Executable spec — tokens and primitives rendered from the live implementation.
          </p>
        </div>
        <div className="flex items-center gap-md">
          <nav aria-label="Style guide locale">
            <ul className="flex items-center gap-xs">
              {routing.locales.map((locale) => (
                <li key={locale}>
                  <Link
                    href="/admin/style-guide"
                    locale={locale}
                    className="rounded-md border border-border px-xs py-2xs text-caption uppercase hover:bg-muted"
                  >
                    {locale}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
          <ReduceMotionToggle />
        </div>
      </header>
      <ColorSection />
      <TypographySection />
      <SpacingSection />
      <ElevationSection />
      <MotionSection />
      <ZIndexSection />
      <PrimitiveSections />
    </div>
  );
}
```

NOTE for the implementer: `routing` is imported from `@/lib/i18n/routing`, which is part of the
foundation's public surface (`lib/i18n` barrel re-exports it — check `lib/i18n/index.ts` and
prefer the barrel import if it exposes `routing`). If ESLint objects to neither, either import
is fine; if `Link locale=…` types complain, consult `lib/i18n/navigation.ts` — the code is
right, adjust the usage.

Create `app/[locale]/(admin)/admin/style-guide/page.tsx`:

```tsx
import type { Metadata } from "next";
import { StyleGuide } from "@/components/style-guide/style-guide";

export const metadata: Metadata = { title: "Style guide" };

/**
 * D9 gate: this route lives under the (admin) group, whose layout enforces
 * requireAdmin() server-side (dev reaches it via the ADMIN_EMAILS bootstrap
 * admin). Dev/admin-only by construction — no extra gate logic.
 */
export default function StyleGuidePage() {
  return <StyleGuide />;
}
```

- [ ] **Step 6: Add the nav item**

In `components/admin/admin-shell.tsx`, extend `NAV_ITEMS`:

```tsx
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/videos", label: "Video queue" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/style-guide", label: "Style guide" },
] as const;
```

- [ ] **Step 7: Run tests + build**

Run: `npx vitest run components/style-guide/style-guide.test.tsx`
Expected: 3/3 PASS. (The smoke test renders `useToast` inside `@/test/render`'s provider-less
tree — if it throws, wrap the render in the test with `ToastProvider`; the PAGE gets it from
the locale layout. Add `import { ToastProvider } from "@/components/ui/toast";` and wrap
`<ToastProvider><StyleGuide /></ToastProvider>` in each render call — this is expected, do it
directly rather than treating it as a failure.)

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: green; the build route table gains `/[locale]/admin/style-guide` under the (admin)
group (dynamic — the admin layout is `force-dynamic`; that is correct and expected).

- [ ] **Step 8: Commit**

```bash
git add components/style-guide "app/[locale]/(admin)/admin/style-guide/page.tsx" components/admin/admin-shell.tsx
git commit -m "feat(design): living style guide at /admin/style-guide (D9)"
```

---

### Task 12: Full verification gate + docs + review

**Files:**
- Possibly modify: `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md` (ONLY
  if implementation legitimately diverged — per the spec's own header, fix the spec to match
  the code and record why).

**Interfaces:** none — this is the layer gate (CLAUDE.md §9 DoD).

- [ ] **Step 1: Full local gate**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: tsc 0 · unit suite ≥ 1229 + ~40 new tests all passing (if `pitch-contour.test.tsx` or
`waveform.test.tsx` fail under full-suite CPU contention, re-run them standalone before
concluding anything — known flakes) · lint clean · build succeeds ~52s.

- [ ] **Step 2: E2E**

```bash
# Kill any stale dev server first — reuseExistingServer picks it up.
npx playwright test
```

Expected: 2/2 pass (~37s).

- [ ] **Step 3: Manual browser spot-check (the D9 payoff)**

`npm run dev` → sign in as the bootstrap admin → `/vi/admin/style-guide`:
- toggle theme: both tiers of swatches change; AA holds visually
- toggle reduce motion: the Motion section's fade appears instantly; skeleton stops pulsing
- open the dialog: Tab cycles inside; Escape closes; focus returns to the trigger
- exercise tabs (arrow keys), select (keyboard), tooltip (focus), popover, both toasts
- switch locale via the vi/en links: URL prefix changes, page intact
- confirm an admin CMS dialog (e.g. video reject) now traps Tab

Record what was checked in the commit/PR notes. Anything broken → fix within this task before
review.

- [ ] **Step 4: Code review**

Dispatch `code-reviewer` on the whole branch diff (`git diff master...HEAD`) per CLAUDE.md §9.
Address findings; commit fixes.

- [ ] **Step 5: Update the spec only if reality diverged**

If any decision changed during implementation (component API shapes, token names), update the
spec file and say so in the commit message. Do NOT rewrite history that didn't diverge.

- [ ] **Step 6: Final commit + hand off**

```bash
git add -A
git commit -m "chore(design): L9a Plan 2 verification gate — full suite green"
```

Then use superpowers:finishing-a-development-branch (merge decision belongs to the user;
branch policy: merge --no-ff to master only after DoD, never push unless asked). After merge,
update Serena memories `project_status` + `l9a_localization_run_state` (Plan 2 status, new
baseline numbers, any new load-bearing constructs — e.g. the `.eslintrc.json` override
duplication and WHY it exists).

---

## Self-review (performed at plan-writing time)

**Spec coverage:**
- §4.4 tokens (spacing/typography/elevation/motion/z-index) → Task 2. Semantic layer → Task 3.
  Primitives dialog/tabs/select/badge/skeleton/toast/tooltip/popover → Tasks 5–10 (dialog focus
  trap repays the L7 debt explicitly — Task 5).
- §2.9/P8 lint + proven-to-fire → Task 4. §8 logical properties, enforced not hoped → Task 4
  test + every primitive.
- §4.5 touchpoint 1 (typography serves VN/JA) → Task 2 tokens + Task 11 stress samples.
  Touchpoint 2 (style guide consumes both capabilities) → Task 11 locale links + theme toggles.
- D7 (Radix for behavioural, in-house for presentational; API never leaks) → Tasks 5–10.
- D9 (executable style guide, dev/admin gated) → Task 11 via the existing (admin) layout.
- P9 (backward compat at every commit) → all token work additive/value-preserving; admin dialog
  keeps its props; full suite runs in every task.
- Review-committed first task (middleware composition) → Task 1, with a mutation check.
- Out of scope, confirmed omitted on purpose: string extraction/VN (Plan 3), feature-UI
  migration onto primitives (L9b), new animations/surfaces (§0.3 non-goals).

**Known judgment calls (flag to reviewer, not hidden):**
- Tailwind `fontWeight`/`letterSpacing` defaults overridden with identical var() values —
  zero visual change, centralises the knobs.
- Motion literals moved to token rungs with ≤50ms deltas (`0.32s→300ms`, `0.35s→300ms`,
  `0.4s→300ms`, `0.16s→150ms`, `.stroke-draw` `ease`→`ease-out`) — imperceptible, and the
  point of tokens; existing component tests assert behaviour, not durations.
- `.eslintrc.json` override for `components/ui/**` duplicates the top-level rule minus the
  Radix pattern — ESLint overrides replace rule config wholesale; the three fire-tests keep
  the copies honest.
- Radix versions installed at latest 1.x with caret (repo convention, matches `^4.13.2`
  next-intl precedent).
