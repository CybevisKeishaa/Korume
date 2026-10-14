# App Chrome Refresh (AppNav) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the learner sidebar with the Figma `655:2` structure (expanded 240 / rail 72 at 1280), a refined Korume visual finish, real nav data (name, plan, review due) that stays fresh, an accessible account menu and rail tooltips.

**Architecture:** Server layouts read a small nav summary and the `korume_nav` cookie and pass plain props to the client `AppNav`; a client hook refreshes the summary from `GET /api/nav/summary` on route change and after a review save. Pure helpers (cookie, active-route matching, menu placement) live in `lib/nav/nav-state.ts` so they are unit-testable. Styling is one BEM block `.app-nav*` in `app/globals.css` on a nav-local layout unit `--nav-u`; type stays on `--text-*`.

**Tech Stack:** Next.js 14.2.35 App Router, React 18.3.1, next-intl, Supabase, Tailwind + globals.css tokens, Vitest + RTL, Playwright, `lucide-react@1.48.0` (new).

**Spec:** `docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md` (approved 2026-10-14). Read it before any task.

## Global Constraints

- Work only in `.worktrees/app-chrome-refresh`; never build or serve in the main checkout. Subagents never use Serena (it edits the main checkout).
- Every nav LAYOUT size is `calc(<figma px> * var(--nav-u))` with `--nav-u: calc(1.125 * var(--density-unit))`; widths 240/72 at 1280 (spec §2).
- Type only via `--text-caption | --text-body | --text-body-lg | --text-heading` (+ matching `--leading-*`); no `text-sm`/`text-[..]`/inline `fontSize` (enforced by `lib/typography-scan.test.ts`).
- Every interactive row/button/menu item is at least `var(--hit-target-min)` (44px) tall (spec §2 deviation).
- Colours only from existing tokens (`--muted`, `--card`, `--secondary`, `--border`, `--primary`, `--ember-300`, `--sand-400`, `--coral-300`, `--surface-overlay`, `--foreground`, `--muted-foreground`, `--ink-950`); no new colour.
- RSC → client props are plain data only (no functions) — lesson `rsc-client-props-strings-only`.
- `(focus)` never reads or writes the `korume_nav` cookie.
- `/api/nav/summary` responds with `Cache-Control: private, no-store`; 401 when signed out.
- Gate after the last edit: `npx vitest run --minWorkers=1 --maxWorkers=2` full suite + `npm run typecheck` + `npm run lint` after the final change of each task.

## Plan-time corrections to the spec (flag to the owner with the plan)

- **P1** `/help` reuses the registry's existing `faq` row (`figmaNodeId 75:1424`, route null today) by giving it `route: "/help"`, `chrome: "app"`, `impl: "placeholder"` — instead of adding a new `help` row (registry T5 forbids two screens for one destination; T1 needs exactly one entry per page).
- **P2** When the review read fails, `reviewHref` falls back to `/kanji` (the library — never possibly-empty), the safer of the two zero-due destinations.
- **P3** The account menu and the tooltip use `position: fixed` + `z-popover` instead of the HTML Popover API: React 18.3 types do not know the `popover` attribute and jsdom has no `showPopover`, while `fixed` already escapes the nav's scroll clipping and the owner's requirement (above content, not clipped, inside the viewport) is met the same way. E4 measures it.
- **P4** The kanji item's icon is the glyph 文 (font-jp, aria-hidden) rather than a lucide icon — Korume DNA; all other icons are lucide.
- **P5** The notification bell's panel currently opens with `right-0` (leftward) and would leave the viewport from a 240/72px sidebar; it changes to `left-0` (opens over the content). Measured in E4.

## Review Focus

1. A learner who toggles the rail, opens a lesson in `(focus)`, toggles there, and comes back expects their own `(app)` choice — pinned by E2 and the AppNav cookie unit tests (Task 6).
2. A learner whose session expires mid-visit must not keep seeing the previous name/plan/badge, and must not loop on reload — pinned by useNavSummary 401 tests (Task 4) and E6 (Task 9).
3. A learner at 0 due must never land in an empty review — pinned by `reviewDestination` tests (Task 1) and the AppNav fallback href test (Task 6).
4. A keyboard user must reach every destination, open/close the account menu and toggle reduce motion — pinned by AccountMenu tests (Task 7) and tooltip focus tests (Task 8).
5. Very long names / 3-digit due counts must not break the layout — pinned by the truncation and "99+" tests (Task 6).

---

### Task 1: Zero-due review destination

**Files:**
- Modify: `lib/dashboard/review-surfaces.ts` (`reviewDestination`)
- Test: `lib/dashboard/review-surfaces.test.ts`

**Interfaces:**
- Produces: `reviewDestination(summaries, surfaces): { href: string; due: number }` — new branch: due 0 and some deck reviewed before → `{ href: "/kanji", due: 0 }`. Exported `const KANJI_LIBRARY_HREF = "/kanji"`.

- [ ] **Step 1: Replace the old zero-due test with the new contract**

In `lib/dashboard/review-surfaces.test.ts`, replace the test `"with nothing due, opens the most recently reviewed deck"` with:

```ts
  it("with nothing due but a review history, opens the kanji library — never a possibly-empty session", () => {
    expect(reviewDestination([summary("mining", 0, "2026-10-07T00:00:00Z"), summary("kanji", 0, "2026-10-01T00:00:00Z")], surfaces))
      .toEqual({ href: "/kanji", due: 0 });
    expect(reviewDestination([summary("mining", 0, "2026-10-07T00:00:00Z")], surfaces))
      .toEqual({ href: "/kanji", due: 0 });
  });
```

Keep `"a brand-new learner lands on kanji review"` unchanged (it still must pass).

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run lib/dashboard/review-surfaces.test.ts`
Expected: FAIL — received `/mining/review`.

- [ ] **Step 3: Implement**

In `lib/dashboard/review-surfaces.ts` add below `NEW_LEARNER_HREF`:

```ts
/** Zero due with a review history: the real kanji library, never a review session that may be empty (app-chrome-refresh §3.3). */
export const KANJI_LIBRARY_HREF = "/kanji";
```

and in `reviewDestination`, after the new-learner line:

```ts
  if (due === 0) return { href: KANJI_LIBRARY_HREF, due };
```

Update the doc comment above the function to: `most due → most recently reviewed (ties) → registry order; nothing due: kanji review for a brand-new learner, else the kanji library.`

- [ ] **Step 4: Run the file and the Dashboard callers' tests**

Run: `npx vitest run lib/dashboard lib/data/dashboard`
Expected: PASS. If a Dashboard test pinned `/mining/review` at 0 due, update that expectation to `/kanji` (same contract) and say so in the commit body.

- [ ] **Step 5: Mutation check** — temporarily delete the new `if (due === 0)` line; the new test must fail; restore it (keep a `.mutbak` copy beside the file, never `git checkout --`).

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/review-surfaces.ts lib/dashboard/review-surfaces.test.ts
git commit -m "fix(review-surfaces): zero due with history goes to the kanji library, never an empty session (app-chrome-refresh §3.3)"
```

---

### Task 2: Nav state helpers

**Files:**
- Create: `lib/nav/nav-state.ts`
- Test: `lib/nav/nav-state.test.ts`

**Interfaces:**
- Produces (all exported from `lib/nav/nav-state.ts`, client-safe, no `server-only`):
  - `type NavPlan = "free" | "plus"`
  - `interface NavSummary { name: string; avatarUrl: string | null; plan: NavPlan | null; reviewDue: number | null; reviewHref: string }`
  - `const NAV_COOKIE = "korume_nav"`
  - `const REVIEW_SUBMITTED_EVENT = "korume:review-submitted"`
  - `const REVIEW_ROUTES: readonly ["/review", "/kanji/review", "/mining/review"]`
  - `const REVIEW_FALLBACK_HREF = "/kanji"`
  - `parseNavCookie(value: string | undefined): boolean | null` — `"collapsed"`→true, `"expanded"`→false, else null
  - `readNavCookie(cookieHeader: string): boolean | null`
  - `navCookieValue(collapsed: boolean): string` — full `document.cookie` assignment string
  - `activeKey(pathname: string, candidates: readonly { key: string; prefixes: readonly string[] }[]): string | null` — longest matching prefix wins; a prefix matches when `pathname === p || pathname.startsWith(p + "/")`
  - `dueLabel(due: number): string` — `"99+"` above 99
  - `placeMenu(anchor: Rect, menu: { width: number; height: number }, viewport: { width: number; height: number }, side: "above" | "right"): { left: number; top: number }` where `type Rect = { left: number; top: number; right: number; bottom: number }` — 8px gap, clamped 8px inside the viewport; `"above"` flips below when it would leave the top.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { activeKey, dueLabel, navCookieValue, parseNavCookie, placeMenu, readNavCookie, REVIEW_ROUTES } from "./nav-state";

describe("nav cookie", () => {
  it("parses only the two known values", () => {
    expect(parseNavCookie("collapsed")).toBe(true);
    expect(parseNavCookie("expanded")).toBe(false);
    expect(parseNavCookie("rail")).toBeNull();
    expect(parseNavCookie(undefined)).toBeNull();
  });
  it("reads the value out of a full cookie header", () => {
    expect(readNavCookie("a=1; korume_nav=collapsed; b=2")).toBe(true);
    expect(readNavCookie("xkorume_nav=collapsed")).toBeNull();
    expect(readNavCookie("")).toBeNull();
  });
  it("writes a year-long, site-wide, lax cookie", () => {
    expect(navCookieValue(true)).toBe("korume_nav=collapsed; path=/; max-age=31536000; samesite=lax");
    expect(navCookieValue(false)).toBe("korume_nav=expanded; path=/; max-age=31536000; samesite=lax");
  });
});

describe("activeKey", () => {
  const candidates = [
    { key: "kanji", prefixes: ["/kanji"] },
    { key: "mining", prefixes: ["/mining"] },
    { key: "review", prefixes: REVIEW_ROUTES },
    { key: "dashboard", prefixes: ["/dashboard"] },
  ];
  it("matches exact and nested paths", () => {
    expect(activeKey("/dashboard", candidates)).toBe("dashboard");
    expect(activeKey("/kanji/42", candidates)).toBe("kanji");
  });
  it("lets the longest prefix win so review routes light Ôn tập, not their parent", () => {
    expect(activeKey("/kanji/review", candidates)).toBe("review");
    expect(activeKey("/mining/review", candidates)).toBe("review");
    expect(activeKey("/review", candidates)).toBe("review");
  });
  it("does not match a sibling that only shares characters", () => {
    expect(activeKey("/kanjix", candidates)).toBeNull();
    expect(activeKey("/settings", candidates)).toBeNull();
  });
});

describe("dueLabel", () => {
  it("caps at 99+", () => {
    expect(dueLabel(7)).toBe("7");
    expect(dueLabel(99)).toBe("99");
    expect(dueLabel(100)).toBe("99+");
  });
});

describe("placeMenu", () => {
  const viewport = { width: 1280, height: 529 };
  const menu = { width: 216, height: 220 };
  it("opens above the trigger, left-aligned", () => {
    expect(placeMenu({ left: 12, top: 470, right: 228, bottom: 514 }, menu, viewport, "above")).toEqual({ left: 12, top: 242 });
  });
  it("flips below when above would leave the viewport", () => {
    expect(placeMenu({ left: 12, top: 100, right: 228, bottom: 144 }, menu, viewport, "above")).toEqual({ left: 12, top: 152 });
  });
  it("opens to the right of a rail trigger, bottom-aligned, clamped inside", () => {
    expect(placeMenu({ left: 14, top: 470, right: 58, bottom: 514 }, menu, viewport, "right")).toEqual({ left: 66, top: 294 });
    expect(placeMenu({ left: 14, top: 10, right: 58, bottom: 54 }, menu, viewport, "right")).toEqual({ left: 66, top: 8 });
  });
  it("never leaves the right or bottom edge", () => {
    const placed = placeMenu({ left: 1200, top: 500, right: 1270, bottom: 520 }, menu, viewport, "right");
    expect(placed.left + menu.width).toBeLessThanOrEqual(1272);
    expect(placed.top + menu.height).toBeLessThanOrEqual(521);
  });
});
```

- [ ] **Step 2: Run and see it fail** — `npx vitest run lib/nav/nav-state.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/nav/nav-state.ts`**

```ts
/** Client-safe nav state: the summary shape, the expanded/rail cookie, active-route matching and menu placement
 * (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md §3). No server-only imports. */
export type NavPlan = "free" | "plus";
export interface NavSummary { name: string; avatarUrl: string | null; plan: NavPlan | null; reviewDue: number | null; reviewHref: string }

export const NAV_COOKIE = "korume_nav";
export const REVIEW_SUBMITTED_EVENT = "korume:review-submitted";
export const REVIEW_ROUTES = ["/review", "/kanji/review", "/mining/review"] as const;
/** Where Ôn tập points when the review read failed: the library, never a possibly-empty session (plan P2). */
export const REVIEW_FALLBACK_HREF = "/kanji";

export function parseNavCookie(value: string | undefined): boolean | null {
  if (value === "collapsed") return true;
  if (value === "expanded") return false;
  return null;
}

export function readNavCookie(cookieHeader: string): boolean | null {
  const match = cookieHeader.match(/(?:^|;\s*)korume_nav=([^;]*)/);
  return parseNavCookie(match?.[1]);
}

export function navCookieValue(collapsed: boolean): string {
  return `${NAV_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
}

export function activeKey(pathname: string, candidates: readonly { key: string; prefixes: readonly string[] }[]): string | null {
  let best: { key: string; length: number } | null = null;
  for (const { key, prefixes } of candidates) {
    for (const prefix of prefixes) {
      const hit = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { key, length: prefix.length };
    }
  }
  return best?.key ?? null;
}

export function dueLabel(due: number): string {
  return due > 99 ? "99+" : String(due);
}

export type Rect = { left: number; top: number; right: number; bottom: number };
const GAP = 8;
const EDGE = 8;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function placeMenu(
  anchor: Rect, menu: { width: number; height: number }, viewport: { width: number; height: number }, side: "above" | "right",
): { left: number; top: number } {
  let left: number;
  let top: number;
  if (side === "right") {
    left = anchor.right + GAP;
    top = anchor.bottom - menu.height;
  } else {
    left = anchor.left;
    top = anchor.top - GAP - menu.height;
    if (top < EDGE) top = anchor.bottom + GAP;
  }
  return {
    left: clamp(left, EDGE, viewport.width - EDGE - menu.width),
    top: clamp(top, EDGE, viewport.height - EDGE - menu.height),
  };
}
```

- [ ] **Step 4: Run** — `npx vitest run lib/nav/nav-state.test.ts` → PASS.

- [ ] **Step 5: Mutation check** — change `prefix.length > best.length` to `>=` with the review candidate listed first; the longest-prefix test must fail; restore.

- [ ] **Step 6: Commit**

```bash
git add lib/nav/nav-state.ts lib/nav/nav-state.test.ts
git commit -m "feat(nav): client-safe nav state - cookie, longest-prefix active match, due label, menu placement"
```

---

### Task 3: Nav summary (server) and `GET /api/nav/summary`

**Files:**
- Create: `lib/data/nav-summary.ts`, `lib/data/nav-summary.test.ts`
- Create: `app/api/nav/summary/route.ts`, `app/api/nav/summary/route.test.ts`

**Interfaces:**
- Consumes: `NavSummary`, `REVIEW_FALLBACK_HREF` (Task 2); `getCurrentUser()` (`lib/auth/current-user.ts`, returns `User | null`); `getActivePlanTier(userId): Promise<"free" | "plus">` (`lib/data/subscriptions.ts`); `getReviewSummary(): Promise<{ href: string; due: number }>` (`lib/data/dashboard/review.ts`); `createClient()` (`lib/supabase/server`).
- Produces: `getNavSummary(): Promise<NavSummary | null>` (null = signed out); route `GET /api/nav/summary` → 200 `{ data: NavSummary }` | 401 `{ error: "Unauthorized" }`, both with `Cache-Control: private, no-store`.

- [ ] **Step 1: Write the failing data tests** (`lib/data/nav-summary.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { getReviewSummary } from "@/lib/data/dashboard/review";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/data/subscriptions", () => ({ getActivePlanTier: vi.fn() }));
vi.mock("@/lib/data/dashboard/review", () => ({ getReviewSummary: vi.fn() }));

import { getNavSummary } from "./nav-summary";

const user = { id: "u1", email: "yuki.tanaka@example.com" };
function profile(row: { name: string | null; avatar_url: string | null } | null, error: unknown = null) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    tables: { users: { select: { data: row, error } } },
  }) as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(user as never);
  vi.mocked(getActivePlanTier).mockResolvedValue("plus");
  vi.mocked(getReviewSummary).mockResolvedValue({ href: "/kanji/review", due: 32 });
});

describe("getNavSummary", () => {
  it("returns null when signed out", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getNavSummary()).resolves.toBeNull();
  });
  it("assembles name, avatar, plan and review", async () => {
    profile({ name: "Yuki Tanaka", avatar_url: "https://x/a.png" });
    await expect(getNavSummary()).resolves.toEqual({
      name: "Yuki Tanaka", avatarUrl: "https://x/a.png", plan: "plus", reviewDue: 32, reviewHref: "/kanji/review",
    });
  });
  it("falls back to the email local part and no avatar", async () => {
    profile({ name: "  ", avatar_url: null });
    await expect(getNavSummary()).resolves.toMatchObject({ name: "yuki.tanaka", avatarUrl: null });
  });
  it("hides the plan instead of guessing when the plan read fails", async () => {
    profile({ name: "Yuki", avatar_url: null });
    vi.mocked(getActivePlanTier).mockRejectedValue(new Error("db"));
    await expect(getNavSummary()).resolves.toMatchObject({ plan: null });
  });
  it("hides the badge and points at the library when the review read fails", async () => {
    profile({ name: "Yuki", avatar_url: null });
    vi.mocked(getReviewSummary).mockRejectedValue(new Error("rpc"));
    await expect(getNavSummary()).resolves.toMatchObject({ reviewDue: null, reviewHref: "/kanji" });
  });
  it("survives a profile read error with the email fallback", async () => {
    profile(null, { message: "boom" });
    await expect(getNavSummary()).resolves.toMatchObject({ name: "yuki.tanaka", avatarUrl: null });
  });
});
```

Before writing, open `test/supabase-mock.ts` and adapt the `tables` shape in `profile()` to the mock's real API (it is the repo's own helper — match its option names exactly; the assertions stay as written).

- [ ] **Step 2: Run and see it fail** — `npx vitest run lib/data/nav-summary.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/data/nav-summary.ts`**

```ts
import "server-only";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getReviewSummary } from "@/lib/data/dashboard/review";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_FALLBACK_HREF, type NavSummary } from "@/lib/nav/nav-state";

/** The sidebar's personal data (spec §3.3). Each read falls back on its own: a failed plan read hides the chip
 * (never guesses FREE), a failed review read hides the badge and points at the library. */
export async function getNavSummary(): Promise<NavSummary | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [profile, plan, review] = await Promise.allSettled([
    createClient().from("users").select("name, avatar_url").eq("id", user.id).maybeSingle(),
    getActivePlanTier(user.id),
    getReviewSummary(),
  ]);
  const row = profile.status === "fulfilled" && !profile.value.error
    ? (profile.value.data as { name: string | null; avatar_url: string | null } | null)
    : null;
  return {
    name: row?.name?.trim() || (user.email ?? "").split("@")[0] || "",
    avatarUrl: row?.avatar_url ?? null,
    plan: plan.status === "fulfilled" ? plan.value : null,
    reviewDue: review.status === "fulfilled" ? review.value.due : null,
    reviewHref: review.status === "fulfilled" ? review.value.href : REVIEW_FALLBACK_HREF,
  };
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Write the failing route tests** (`app/api/nav/summary/route.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { getNavSummary } from "@/lib/data/nav-summary";

vi.mock("@/lib/data/nav-summary", () => ({ getNavSummary: vi.fn() }));
import { GET, dynamic } from "./route";

describe("GET /api/nav/summary", () => {
  it("is never statically cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });
  it("401s when signed out, private no-store", async () => {
    vi.mocked(getNavSummary).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("returns the summary, private no-store", async () => {
    const data = { name: "Yuki", avatarUrl: null, plan: "free", reviewDue: 3, reviewHref: "/mining/review" } as const;
    vi.mocked(getNavSummary).mockResolvedValue(data);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(res.json()).resolves.toEqual({ data });
  });
});
```

- [ ] **Step 6: Implement `app/api/nav/summary/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getNavSummary } from "@/lib/data/nav-summary";

/** The sidebar's refresh read (spec §3.3). Per-user and private: never cached by Next or any shared cache. */
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const data = await getNavSummary();
  if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ data }, { headers: NO_STORE });
}
```

- [ ] **Step 7: Run both files** — `npx vitest run lib/data/nav-summary.test.ts app/api/nav/summary` → PASS. Confirm `middleware.ts`'s matcher lets `/api/nav/summary` through the same way as `/api/notifications` (read the matcher; do not change it unless it differs).

- [ ] **Step 8: Mutation check** — replace `plan.status === "fulfilled" ? plan.value : null` with `... : "free"`; the plan-read-fails test must fail; restore.

- [ ] **Step 9: Commit**

```bash
git add lib/data/nav-summary.ts lib/data/nav-summary.test.ts app/api/nav/summary
git commit -m "feat(nav): server nav summary + private no-store GET /api/nav/summary (spec §3.3)"
```

---

### Task 4: `useNavSummary` refresh hook and the review-saved event

**Files:**
- Create: `components/layout/use-nav-summary.ts`, `components/layout/use-nav-summary.test.tsx`
- Modify: `components/learning/review-session.tsx` (inside `grade`, after `if (!res.ok) throw ...`)
- Modify: `components/video-player/mining-review-session.tsx` (same place)
- Test: the two sessions' existing test files (`components/learning/review-session.test.tsx`, `components/video-player/mining-review-session.test.tsx` — find with `ls`; add one test each)

**Interfaces:**
- Consumes: `NavSummary`, `REVIEW_SUBMITTED_EVENT` (Task 2); `usePathname` from `@/lib/i18n/navigation`.
- Produces: `useNavSummary(initial: NavSummary | null): NavSummary | null`; `reloadForSignIn(now?: number): boolean` (true when it reloaded). Storage key `korume_nav_401_reload_at`.

- [ ] **Step 1: Write the failing hook tests**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_SUBMITTED_EVENT, type NavSummary } from "@/lib/nav/nav-state";

let pathname = "/dashboard";
vi.mock("@/lib/i18n/navigation", () => ({ usePathname: () => pathname }));
import { pageReload, reloadForSignIn, useNavSummary } from "./use-nav-summary";

const first: NavSummary = { name: "Yuki", avatarUrl: null, plan: "free", reviewDue: 32, reviewHref: "/kanji/review" };
const next: NavSummary = { ...first, reviewDue: 31 };
const ok = (data: NavSummary) => new Response(JSON.stringify({ data }), { status: 200 });
let reload: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pathname = "/dashboard";
  sessionStorage.clear();
  reload = vi.spyOn(pageReload, "run").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useNavSummary", () => {
  it("starts from the server value and replaces it with the fetched one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(next)));
    const { result } = renderHook(() => useNavSummary(first));
    expect(result.current).toEqual(first);
    await waitFor(() => expect(result.current?.reviewDue).toBe(31));
  });
  it("keeps the last good value on a network error or a 5xx", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => useNavSummary(first));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    pathname = "/kanji"; rerender();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual(first);
  });
  it("on 401 clears every personal field before reloading once", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { result } = renderHook(() => useNavSummary(first));
    await waitFor(() => expect(result.current).toBeNull());
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("refetches when a review is saved, without a route change", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(first)).mockResolvedValueOnce(ok(next));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNavSummary(first));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => { window.dispatchEvent(new Event(REVIEW_SUBMITTED_EVENT)); });
    await waitFor(() => expect(result.current?.reviewDue).toBe(31));
  });
  it("aborts the stale request so a late response cannot win", async () => {
    let resolveSlow!: (r: Response) => void;
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return signals.length === 1 ? new Promise<Response>((r) => { resolveSlow = r; }) : Promise.resolve(ok(next));
    }));
    const { result, rerender } = renderHook(() => useNavSummary(first));
    pathname = "/kanji"; rerender();
    await waitFor(() => expect(result.current?.reviewDue).toBe(31));
    expect(signals[0].aborted).toBe(true);
    resolveSlow(ok({ ...first, reviewDue: 99 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current?.reviewDue).toBe(31);
  });
});

describe("reloadForSignIn", () => {
  it("reloads once, then not again within 10s", () => {
    expect(reloadForSignIn(1_000)).toBe(true);
    expect(reloadForSignIn(5_000)).toBe(false);
    expect(reloadForSignIn(12_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run and see it fail** — `npx vitest run components/layout/use-nav-summary.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/layout/use-nav-summary.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "@/lib/i18n/navigation";
import { REVIEW_SUBMITTED_EVENT, type NavSummary } from "@/lib/nav/nav-state";

const RELOAD_KEY = "korume_nav_401_reload_at";
const RELOAD_WINDOW_MS = 10_000;

/** Indirection so tests can observe the reload — jsdom's window.location cannot be redefined. */
export const pageReload = { run: () => window.location.reload() };

/** A 401 means the session is gone. A full reload passes the middleware, which sends a signed-out request to
 * /<locale>/login?redirectTo=… — router.refresh() can be discarded by a concurrent navigation (app-footer T7).
 * One reload per 10s per tab, so a stubborn 401 cannot loop. */
export function reloadForSignIn(now: number = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (now - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage blocked: reload anyway; the middleware redirect ends the loop.
  }
  pageReload.run();
  return true;
}

/** Server value first, then refreshed on mount, on every route change and after a saved review (spec §3.4). */
export function useNavSummary(initial: NavSummary | null): NavSummary | null {
  const pathname = usePathname();
  const [summary, setSummary] = useState(initial);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    let res: Response;
    try {
      res = await fetch("/api/nav/summary", { signal: controller.signal, cache: "no-store" });
    } catch {
      return; // network error or aborted: keep the last good value
    }
    if (controller.signal.aborted) return;
    if (res.status === 401) {
      setSummary(null);
      reloadForSignIn();
      return;
    }
    if (!res.ok) return;
    try {
      const body = (await res.json()) as { data: NavSummary };
      if (!controller.signal.aborted) setSummary(body.data);
    } catch {
      // malformed body: keep the last good value
    }
  }, []);

  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    const onSaved = () => { void refresh(); };
    window.addEventListener(REVIEW_SUBMITTED_EVENT, onSaved);
    return () => window.removeEventListener(REVIEW_SUBMITTED_EVENT, onSaved);
  }, [refresh]);
  useEffect(() => () => inFlight.current?.abort(), []);

  return summary;
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Add the event dispatch to both review sessions**

In both `grade` callbacks, directly after `if (!res.ok) throw new Error(\`Review failed (${res.status})\`);` add:

```ts
        window.dispatchEvent(new Event(REVIEW_SUBMITTED_EVENT));
```

and import `REVIEW_SUBMITTED_EVENT` from `@/lib/nav/nav-state`. In each session's test file add:

```tsx
  it("tells the nav a review was saved only after the server accepted it", async () => {
    const heard = vi.fn();
    window.addEventListener("korume:review-submitted", heard);
    // first grade: server rejects
    // second grade: server accepts
    // …drive the component exactly as the file's existing grading test does, with fetch mocked
    //   to resolve { ok: false, status: 500 } then { ok: true, status: 200 }.
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener("korume:review-submitted", heard);
  });
```

Fill the two driving steps by copying the existing grading test in that file (same render, same "show answer" + grade clicks) — the assertion lines stay as written.

- [ ] **Step 6: Run** — `npx vitest run components/layout/use-nav-summary.test.tsx components/learning components/video-player` → PASS.

- [ ] **Step 7: Mutation checks** — (a) move the dispatch above the `res.ok` check; the session test must fail; restore. (b) in `useNavSummary` swap `setSummary(null)` and `reloadForSignIn()` order is fine, but delete `setSummary(null)`; the 401 test must fail; restore.

- [ ] **Step 8: Commit**

```bash
git add components/layout/use-nav-summary.ts components/layout/use-nav-summary.test.tsx components/learning/review-session.tsx components/video-player/mining-review-session.tsx components/learning/*.test.tsx components/video-player/*.test.tsx
git commit -m "feat(nav): useNavSummary refresh (route, saved review), 401 clears then reloads once (spec §3.4)"
```

---

### Task 5: `/help` placeholder route and copy

**Files:**
- Create: `app/[locale]/(protected)/(app)/help/page.tsx`
- Modify: `lib/product/screen-registry.ts` (`faq` row), `app/[locale]/(protected)/(app)/upcoming-routes.test.tsx` (`ROUTES` + length 9)
- Modify: `messages/vi/upcoming.json`, `messages/en/upcoming.json` (add `help`)

**Interfaces:**
- Produces: route `/help` (placeholder, `(app)` chrome). Nav uses the literal `"/help"`.

- [ ] **Step 1: Failing test** — in `upcoming-routes.test.tsx` add `"help"` to `ROUTES` and change `toHaveLength(8)` to `toHaveLength(9)`. Run `npx vitest run "app/[locale]/(protected)/(app)/upcoming-routes.test.tsx" lib/product` → FAIL (no page).

- [ ] **Step 2: Registry** — in the `faq` entry set `route: "/help"`, `chrome: "app"`, `impl: "placeholder"` and add the comment `// app-chrome-refresh P1: the sidebar's Help row lands here until FAQ/QuickStart are built.` above it.

- [ ] **Step 3: Copy** — add to `messages/vi/upcoming.json`:

```json
  "help": {
    "title": "Trợ giúp",
    "body": "Câu hỏi thường gặp và hướng dẫn bắt đầu nhanh đang được soạn — cách học với Korume, cách ôn tập, và mẹo dùng từng màn.",
    "unlocks": "Trong lúc chờ, bạn có thể hỏi Korume ngay trong bài học bất cứ khi nào."
  },
```

and to `messages/en/upcoming.json`:

```json
  "help": {
    "title": "Help",
    "body": "The FAQ and the quick-start guide are being written — how to learn with Korume, how review works, and tips for each screen.",
    "unlocks": "Meanwhile, you can ask Korume inside any lesson at any time."
  },
```

- [ ] **Step 4: Page** — `app/[locale]/(protected)/(app)/help/page.tsx`, the same shape as `review/page.tsx`:

```tsx
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { UpcomingScreen } from "@/components/layout/upcoming-screen";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "upcoming" });
  return { title: t("help.title") };
}

export default async function HelpPage() {
  const t = await getTranslations("upcoming");
  return <UpcomingScreen title={t("help.title")} body={t("help.body")} unlocks={t("help.unlocks")} unlocksLabel={t("unlocksLabel")} />;
}
```

- [ ] **Step 5: Run** — `npx vitest run "app/[locale]/(protected)/(app)" lib/product test/messages.test.ts lib/i18n` → PASS (registry T1/T2/T8/T12, message parity).

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(protected)/(app)/help" "app/[locale]/(protected)/(app)/upcoming-routes.test.tsx" lib/product/screen-registry.ts messages/vi/upcoming.json messages/en/upcoming.json
git commit -m "feat(help): /help placeholder on the faq registry row (app-chrome-refresh D9, plan P1)"
```

---

### Task 6: AppNav shell — modes, cookie, items, badge, visual finish, layouts

**Files:**
- Modify: `package.json`, `package-lock.json` (add `lucide-react@1.48.0`)
- Create: `components/layout/nav-icons.tsx`
- Modify: `components/layout/app-nav.tsx` (rewrite), `components/layout/app-nav.test.tsx` (rewrite)
- Modify: `app/globals.css` (tokens at lines ~230 and ~469, new `.app-nav` block after the `.app-footer` block)
- Modify: `app/[locale]/(protected)/(app)/layout.tsx`, `app/[locale]/(protected)/(focus)/layout.tsx`
- Modify: `components/layout/notification-bell.tsx` (panel `right-0` → `left-0`, plan P5)
- Modify: `components/marketing/marketing-container.tsx` (comment "224px" → the new token)
- Modify: `messages/vi/nav.json`, `messages/en/nav.json`

**Interfaces:**
- Consumes: Task 2 helpers, `useNavSummary` (Task 4), `NavGroup` type (`lib/product/nav-derivation`), `NAV_GROUPS` (server only, in layouts), `getNavSummary` (Task 3, in layouts).
- Produces: `AppNav({ groups, userEmail, initialSummary, mode, initialCollapsed })` where `mode: "app" | "focus"`; `NavIcon({ navKey }: { navKey: string })`. Task 7 plugs `AccountMenu` into the footer slot marked `{/* account */}`; Task 8 plugs the tooltip into rail links.

- [ ] **Step 1: Dependency** — the worktree's `node_modules` is a junction to the main checkout's. Run in the worktree: `npm install --save-exact lucide-react@1.48.0`. It installs into the shared folder (harmless to master: unused there) and writes the worktree's `package.json`/lock. Confirm `git diff package.json` shows only `"lucide-react": "1.48.0"`.

- [ ] **Step 2: Messages** — `messages/vi/nav.json`: replace `"toggle"` with

```json
  "toggle": { "expand": "Mở rộng điều hướng", "collapse": "Thu gọn điều hướng" },
  "help": "Trợ giúp",
  "reviewDue": "{count} thẻ đến hạn",
  "plan": { "free": "FREE", "plus": "PLUS" },
  "account": { "menu": "Tài khoản", "trigger": "Tài khoản của {name}", "reduceMotion": "Giảm chuyển động" },
  "brand": "Korume — về Tổng quan"
```

`messages/en/nav.json`: same keys — `"Expand navigation"`, `"Collapse navigation"`, `"Help"`, `"{count} due"`, `"FREE"`, `"PLUS"`, `"Account"`, `"{name}'s account"`, `"Reduce motion"`, `"Korume — go to Dashboard"`.

- [ ] **Step 3: Write the failing AppNav tests** — rewrite `components/layout/app-nav.test.tsx`. Keep the file's first block (imports, `EXPECTED_LABELS`, `EXPECTED_GROUP_LABELS`, `EXPECTED_ARIA_LABEL`, the `usePathname` and `NotificationBell` mocks) and the structural tests "catalog's destination key set…", "catalog's group key set…", "has a pinned label…", "drops every hidden and absorbed row…", "routes Lessons at /shadowing", "routes the Journey entry at /roadmap…", "names the nav landmark…", "does not offer a theme toggle…". Set `CHROME_KEYS = new Set(["ariaLabel", "groups", "toggle", "help", "reviewDue", "plan", "account", "brand"])`. Mock the hook and render with the new props:

```tsx
import type { NavSummary } from "@/lib/nav/nav-state";

let mockSummary: NavSummary | null = null;
vi.mock("@/components/layout/use-nav-summary", () => ({ useNavSummary: () => mockSummary }));

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
```

Replace the group-count test (account group no longer listed):

```tsx
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
```

New behaviour tests:

```tsx
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
    expect(document.cookie).toContain("korume_nav=expanded");
    expect(document.cookie).not.toContain("korume_nav=collapsed");
  });
  it("adopts a newer cookie on mount in (app) (router-cache replay, spec §3.2)", () => {
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
  it("truncates a long name with the full name in title", () => {
    renderNav({ summary: { ...SUMMARY, name: "A".repeat(80) } });
    expect(screen.getByTitle("A".repeat(80))).toHaveClass("app-nav__account-name");
  });
  it("shows no personal data when the summary is cleared", () => {
    renderNav({ summary: null });
    expect(screen.queryByText("Yuki Tanaka")).toBeNull();
    expect(screen.queryByText("FREE")).toBeNull();
  });
  it("hides the plan chip when the plan is unknown, and shows PLUS for plus", () => {
    const { unmount } = renderNav({ summary: { ...SUMMARY, plan: null } });
    expect(screen.queryByText(/^(FREE|PLUS)$/)).toBeNull();
    unmount();
    renderNav({ summary: { ...SUMMARY, plan: "plus" } });
    expect(screen.getByText("PLUS")).toBeInTheDocument();
  });
  it("keeps every interactive row on the hit-target floor", () => {
    const { container } = renderNav();
    const rows = container.querySelectorAll(".app-nav__item, .app-nav__icon-button, .app-nav__help");
    expect(rows.length).toBeGreaterThanOrEqual(15);
  });
```

(The 44px floor itself is asserted on the CSS in Step 6 and measured in E7; this test only proves the classes carrying it are present.)

Delete the old "visibility toggle" describe block and the "sign-out control", "sizes the rail…w-sidebar" tests (sign-out moves to Task 7's menu).

- [ ] **Step 4: Run and see it fail** — `npx vitest run components/layout/app-nav.test.tsx` → FAIL.

- [ ] **Step 5: Icons** — `components/layout/nav-icons.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { AudioLines, Bookmark, BookOpenText, Clapperboard, GraduationCap, Layers, LayoutDashboard, ListVideo, MessagesSquare, Route, Sparkles } from "lucide-react";

/** One icon per nav destination key (plan P4: kanji is the 文 glyph — Korume DNA). */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, lessons: Clapperboard, grammar: BookOpenText, speaking: MessagesSquare,
  jlpt: GraduationCap, "pronunciation-library": AudioLines, review: Layers, mining: Bookmark,
  playlists: ListVideo, roadmap: Route, "companion-home": Sparkles,
};

export function NavIcon({ navKey }: { navKey: string }) {
  if (navKey === "kanji") return <span aria-hidden="true" className="app-nav__glyph font-jp">文</span>;
  const Icon = ICONS[navKey] ?? LayoutDashboard;
  return <Icon aria-hidden="true" className="app-nav__icon" strokeWidth={1.75} />;
}
```

If `tsc` reports a missing export, open `node_modules/lucide-react/dist/lucide-react.d.ts`, pick the nearest existing name with the same meaning, and note the swap in the commit body.

- [ ] **Step 6: CSS** — in `app/globals.css`, in BOTH token blocks (`:root` ~line 230 and `[data-density]` ~line 469) replace the two sidebar lines with:

```css
  /* App chrome refresh §2: Figma 655:2 is drawn AT 1280, where 1 Figma px = 1 rendered px = 1.125 density units. */
  --nav-u: calc(1.125 * var(--density-unit));
  --layout-sidebar-width: calc(240 * var(--nav-u));
  --layout-sidebar-collapsed: calc(72 * var(--nav-u));
```

Then append after the `.app-footer` rules:

```css
/* App navigation (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md). Figma 655:2 structure; visual
   finish §4 on existing tokens. LAYOUT on --nav-u, TYPE on --text-*, every target >= --hit-target-min. */
.app-nav { position: sticky; top: 0; z-index: 20; display: flex; flex-direction: column; flex-shrink: 0; block-size: 100vh;
  inline-size: var(--layout-sidebar-width); border-right: 1px solid hsl(var(--border)); background:
  radial-gradient(calc(220 * var(--nav-u)) calc(140 * var(--nav-u)) at 0 0, hsl(var(--primary) / 0.06), transparent 70%), hsl(var(--muted));
  transition: inline-size 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
.app-nav[data-collapsed="true"] { inline-size: var(--layout-sidebar-collapsed); }
.app-nav__header { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: calc(8 * var(--nav-u));
  padding: calc(13 * var(--nav-u)) calc(12 * var(--nav-u)) calc(8 * var(--nav-u)); border-bottom: 1px solid hsl(var(--border)); }
.app-nav[data-collapsed="true"] .app-nav__header { grid-template-columns: 1fr; justify-items: center; gap: calc(4 * var(--nav-u)); padding-inline: 0; }
.app-nav__brand { display: flex; align-items: center; gap: calc(10 * var(--nav-u)); min-block-size: var(--hit-target-min); border-radius: var(--radius-sm); }
.app-nav__logo { inline-size: calc(36 * var(--nav-u)); block-size: calc(36 * var(--nav-u)); border-radius: calc(10 * var(--nav-u));
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.25); }
.app-nav__wordmark { font-family: var(--font-display), var(--font-sans), sans-serif; font-size: var(--text-heading); line-height: var(--leading-heading);
  font-weight: 700; letter-spacing: -0.04em; color: hsl(var(--foreground)); white-space: nowrap; }
.app-nav__header-actions { grid-column: 3 / 5; display: flex; gap: calc(4 * var(--nav-u)); }
.app-nav[data-collapsed="true"] .app-nav__header-actions { grid-column: auto; flex-direction: column; align-items: center; }
.app-nav__icon-button { display: grid; place-items: center; min-inline-size: var(--hit-target-min); min-block-size: var(--hit-target-min);
  border-radius: 999px; color: hsl(var(--muted-foreground)); transition: background-color 150ms, color 150ms; }
.app-nav__icon-button:hover { background: hsl(var(--secondary)); color: hsl(var(--foreground)); }
.app-nav__scroll { position: relative; flex: 1 1 auto; min-block-size: 0; overflow-y: auto; scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent; padding: calc(8 * var(--nav-u)) calc(12 * var(--nav-u));
  mask-image: linear-gradient(to bottom, transparent 0, #000 calc(12 * var(--nav-u)), #000 calc(100% - 12 * var(--nav-u)), transparent 100%); }
.app-nav[data-collapsed="true"] .app-nav__scroll { padding-inline: calc(9 * var(--nav-u)); }
.app-nav__group + .app-nav__group { margin-top: calc(14 * var(--nav-u)); }
.app-nav__group-label { margin: 0; padding: calc(6 * var(--nav-u)) calc(11 * var(--nav-u)); font-size: var(--text-caption);
  line-height: var(--leading-caption); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: hsl(var(--muted-foreground)); }
.app-nav[data-collapsed="true"] .app-nav__group-label { block-size: 1px; padding: 0; margin: calc(6 * var(--nav-u)) calc(6 * var(--nav-u));
  overflow: hidden; color: transparent; background: hsl(var(--border)); }
.app-nav__list { display: flex; flex-direction: column; gap: calc(4 * var(--nav-u)); margin: 0; padding: 0; list-style: none; }
.app-nav__item { position: relative; display: flex; align-items: center; gap: calc(12 * var(--nav-u)); min-block-size: max(var(--hit-target-min), calc(34 * var(--nav-u)));
  padding-inline: calc(13 * var(--nav-u)); border-radius: var(--radius-sm); color: hsl(var(--muted-foreground));
  font-size: var(--text-body); line-height: var(--leading-body); font-weight: 500; transition: background-color 150ms, color 150ms; }
.app-nav[data-collapsed="true"] .app-nav__item { justify-content: center; padding-inline: 0; }
.app-nav__item:hover { background: hsl(var(--secondary)); color: hsl(var(--foreground)); }
.app-nav__item[aria-current="page"] { background: hsl(var(--primary) / 0.12); color: hsl(var(--ember-300)); }
.app-nav__item[aria-current="page"]::before { content: ""; position: absolute; inset-block: calc(8 * var(--nav-u)); inset-inline-start: 0;
  inline-size: 3px; border-radius: 3px; background: hsl(var(--primary)); box-shadow: 0 0 calc(10 * var(--nav-u)) hsl(var(--primary) / 0.6); }
.app-nav__item:focus-visible, .app-nav__icon-button:focus-visible, .app-nav__help:focus-visible, .app-nav__brand:focus-visible {
  outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
.app-nav__icon { inline-size: calc(18 * var(--nav-u)); block-size: calc(18 * var(--nav-u)); flex-shrink: 0; }
.app-nav__glyph { inline-size: calc(18 * var(--nav-u)); text-align: center; font-size: var(--text-body-lg); line-height: 1; flex-shrink: 0; }
.app-nav__label { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-nav[data-collapsed="true"] .app-nav__label { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.app-nav__badge { margin-inline-start: auto; min-inline-size: calc(24 * var(--nav-u)); padding: 0 calc(7 * var(--nav-u)); border-radius: 999px;
  background: hsl(var(--primary) / 0.16); color: hsl(var(--ember-300)); font-size: var(--text-caption); line-height: var(--leading-caption);
  font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; }
.app-nav__dot { position: absolute; inset-block-start: calc(8 * var(--nav-u)); inset-inline-end: calc(14 * var(--nav-u));
  inline-size: 6px; block-size: 6px; border-radius: 999px; background: hsl(var(--primary)); }
.app-nav__footer { display: flex; flex-direction: column; gap: calc(6 * var(--nav-u)); padding: calc(6 * var(--nav-u)) calc(12 * var(--nav-u)) calc(8 * var(--nav-u));
  border-top: 1px solid hsl(var(--border)); }
.app-nav[data-collapsed="true"] .app-nav__footer { padding-inline: calc(9 * var(--nav-u)); align-items: stretch; }
.app-nav__help { display: flex; align-items: center; gap: calc(12 * var(--nav-u)); min-block-size: var(--hit-target-min); padding-inline: calc(13 * var(--nav-u));
  border-radius: var(--radius-sm); color: hsl(var(--muted-foreground)); font-size: var(--text-body); line-height: var(--leading-body); }
.app-nav[data-collapsed="true"] .app-nav__help { justify-content: center; padding-inline: 0; }
.app-nav__help:hover { background: hsl(var(--secondary)); color: hsl(var(--foreground)); }
@media (prefers-reduced-motion: reduce) { .app-nav, .app-nav * { transition: none !important; } }
[data-reduce-motion] .app-nav, [data-reduce-motion] .app-nav * { transition: none !important; }
```

Before using `[data-reduce-motion]`, grep `app/globals.css` for the selector the existing kill switch uses and use exactly that one.

- [ ] **Step 7: Rewrite `components/layout/app-nav.tsx`**

```tsx
"use client";

/**
 * The learner sidebar (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md). Figma 655:2 structure:
 * fixed header, independently scrolling destinations, fixed footer; expanded or rail. Holds no nav data of its own —
 * groups arrive from the registry via the server layouts.
 *
 * ⛔ Do not import `SCREEN_REGISTRY` or `NAV_GROUPS` here: this is a client module (final whole-branch review FIX 3).
 */
import Image from "next/image";
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { NotificationBell } from "@/components/layout/notification-bell";
import { NavIcon } from "@/components/layout/nav-icons";
import { useNavSummary } from "@/components/layout/use-nav-summary";
import type { NavGroup } from "@/lib/product/nav-derivation";
import { activeKey, dueLabel, navCookieValue, readNavCookie, REVIEW_FALLBACK_HREF, REVIEW_ROUTES, type NavSummary } from "@/lib/nav/nav-state";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AppNav({ groups, userEmail, initialSummary, mode, initialCollapsed }: {
  groups: readonly NavGroup[];
  userEmail: string;
  initialSummary: NavSummary | null;
  mode: "app" | "focus";
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const summary = useNavSummary(initialSummary);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Next 14.2's router cache can replay an (app) layout rendered before the last toggle (app-footer T7): the cookie
  // is the learner's latest choice, so adopt it before paint. (focus) never reads it (spec §3.2).
  useIsoLayoutEffect(() => {
    if (mode !== "app") return;
    const stored = readNavCookie(document.cookie);
    if (stored !== null) setCollapsed(stored);
  }, [mode]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (mode === "app") document.cookie = navCookieValue(next);
  };

  const listed = groups.filter((group) => group.key !== "account");
  const accountItems = groups.find((group) => group.key === "account")?.items ?? [];
  const reviewHref = summary?.reviewHref ?? REVIEW_FALLBACK_HREF;
  const current = activeKey(pathname, listed.flatMap((group) => group.items).map((item) => ({
    key: item.key, prefixes: item.key === "review" ? REVIEW_ROUTES : [item.href],
  })));
  const due = summary?.reviewDue ?? 0;

  return (
    <nav aria-label={t("ariaLabel")} className="app-nav" data-collapsed={collapsed}>
      <div className="app-nav__header">
        <Link href="/dashboard" className="app-nav__brand" aria-label={t("brand")}>
          <Image src="/korume.png" alt="" width={36} height={36} className="app-nav__logo" priority />
          {!collapsed && <span className="app-nav__wordmark" aria-hidden="true">Korume</span>}
        </Link>
        <div className="app-nav__header-actions">
          <NotificationBell />
          <button type="button" className="app-nav__icon-button" aria-expanded={!collapsed} onClick={toggle}
            aria-label={collapsed ? t("toggle.expand") : t("toggle.collapse")}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" className="app-nav__icon" /> : <PanelLeftClose aria-hidden="true" className="app-nav__icon" />}
          </button>
        </div>
      </div>

      <div className="app-nav__scroll" data-nav-scroll>
        {listed.map((group) => (
          <div key={group.key} className="app-nav__group">
            <p id={`app-nav-group-${group.key}`} className="app-nav__group-label">{t(`groups.${group.key}`)}</p>
            <ul aria-labelledby={`app-nav-group-${group.key}`} className="app-nav__list">
              {group.items.map((item) => {
                const isReview = item.key === "review";
                // item.key is `string` once derived from the registry (R4); catalog coverage is pinned by the tests.
                const label = t(item.key as Parameters<typeof t>[0]);
                const name = isReview && due > 0 ? `${label}, ${t("reviewDue", { count: due })}` : label;
                return (
                  <li key={item.key}>
                    <Link href={isReview ? reviewHref : item.href} className="app-nav__item" aria-label={name}
                      aria-current={current === item.key ? "page" : undefined}>
                      <NavIcon navKey={item.key} />
                      <span className="app-nav__label">{label}</span>
                      {isReview && due > 0 && (collapsed
                        ? <span className="app-nav__dot" aria-hidden="true" />
                        : <span className="app-nav__badge" aria-hidden="true">{dueLabel(due)}</span>)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="app-nav__footer">
        <Link href="/help" className="app-nav__help" aria-label={t("help")}>
          <CircleHelp aria-hidden="true" className="app-nav__icon" />
          <span className="app-nav__label">{t("help")}</span>
        </Link>
        {/* account — Task 7 replaces this placeholder with <AccountMenu …/> */}
        <span data-account-slot hidden>{userEmail}{accountItems.length}</span>
      </div>
    </nav>
  );
}
```

Note: the `aria-label` on links equals the visible label except for Review with due, so the tests' `name: "Dashboard"` etc. still resolve; the badge is `aria-hidden` because the count is in the name.

The truncation and plan-chip tests in Step 3 need the account trigger; mark those two tests `it.todo` in this task and turn them back into `it` in Task 7 (Task 7 Step 1 says so).

- [ ] **Step 8: Bell panel** — in `components/layout/notification-bell.tsx` change the panel's `absolute right-0 top-full` to `absolute left-0 top-full` (plan P5). Run `npx vitest run components/layout/notification-bell.test.tsx` → PASS (update a class assertion if one pins `right-0`).

- [ ] **Step 9: Layouts**

`app/[locale]/(protected)/(app)/layout.tsx`:

```tsx
import { cookies } from "next/headers";
import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getNavSummary } from "@/lib/data/nav-summary";
import { NAV_COOKIE, parseNavCookie } from "@/lib/nav/nav-state";
import { NAV_GROUPS } from "@/lib/product/nav-groups";

export default async function AppChromeLayout({ children }: { children: React.ReactNode }) {
  const [user, summary] = await Promise.all([getCurrentUser(), getNavSummary()]);
  const collapsed = parseNavCookie(cookies().get(NAV_COOKIE)?.value) ?? false;
  return (
    <div className="flex min-h-screen flex-row text-body">
      <AppNav groups={NAV_GROUPS} userEmail={user?.email ?? ""} initialSummary={summary} mode="app" initialCollapsed={collapsed} />
      {/* `id` + `tabIndex={-1}`: the app footer's back-to-top button moves focus here (app-footer spec F3), so it
          works on a page with no h1. Programmatic focus only — never in the tab order. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
    </div>
  );
}
```

Keep the file's existing doc comment above the function, updated to say the nav is expanded/rail per the cookie.

`app/[locale]/(protected)/(focus)/layout.tsx`: same imports minus `cookies`/`parseNavCookie`/`NAV_COOKIE`; render
`<AppNav groups={NAV_GROUPS} userEmail={user?.email ?? ""} initialSummary={summary} mode="focus" initialCollapsed />`; keep its wrapper classes and update its doc comment (focus = rail, never the cookie).

- [ ] **Step 10: Comment** — in `components/marketing/marketing-container.tsx` replace the "`--layout-sidebar-width` is 224px" wording with "`--layout-sidebar-width` is 240 nav units (240px at 1280)".

- [ ] **Step 11: Run** — `npx vitest run components/layout lib/typography-scan.test.ts components/ui/token-scale.test.ts` → PASS, then `npm run typecheck` and `npm run lint` → clean. If `token-scale.test.ts` or another CSS test pins `224`/`68` for the sidebar tokens, update it to the new `--nav-u` expressions and say so in the commit body.

- [ ] **Step 12: Mutation checks** — (a) remove `if (mode === "app")` before the cookie write; the (focus) cookie test must fail. (b) drop the `item.key === "review" ? REVIEW_ROUTES :` branch; the Task 9 E2E will catch it, but also add/keep a unit expectation: with `usePathname` mocked to `/mining/review` the Review link has `aria-current="page"` and Collection does not (add this test now with a second `vi.mock` override via a module-level `let mockPath`). Restore each.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json components/layout app/globals.css "app/[locale]/(protected)/(app)/layout.tsx" "app/[locale]/(protected)/(focus)/layout.tsx" components/marketing/marketing-container.tsx messages/vi/nav.json messages/en/nav.json
git commit -m "feat(nav): AppNav 240/72 on --nav-u - rail, cookie, live review badge, refined finish (spec §2-§4)"
```

---

### Task 7: AccountMenu

**Files:**
- Create: `components/layout/account-menu.tsx`, `components/layout/account-menu.test.tsx`
- Modify: `components/layout/app-nav.tsx` (replace the account slot), `components/layout/app-nav.test.tsx` (turn the two `it.todo` back on)
- Modify: `app/globals.css` (append `.app-nav__account*` and `.account-menu*`)

**Interfaces:**
- Consumes: `NavSummary`, `placeMenu` (Task 2); `useTheme()` → `{ accountReduceMotion: boolean; setReduceMotion(on: boolean): void }` (`components/providers/theme-provider`); account items `{ href: string; key: string }[]`.
- Produces: `AccountMenu({ summary, email, items, collapsed }: { summary: NavSummary | null; email: string; items: readonly { href: string; key: string }[]; collapsed: boolean })`.

- [ ] **Step 1: Failing tests** (`account-menu.test.tsx`)

```tsx
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccountMenu } from "./account-menu";

const ITEMS = [{ href: "/profile", key: "profile" }, { href: "/settings", key: "settings" }];
const SUMMARY = { name: "Yuki Tanaka", avatarUrl: null, plan: "free" as const, reviewDue: 3, reviewHref: "/kanji/review" };
function setup(collapsed = false) {
  render(<ThemeProvider><AccountMenu summary={SUMMARY} email="yuki@example.com" items={ITEMS} collapsed={collapsed} /></ThemeProvider>);
  return { user: userEvent.setup(), trigger: screen.getByRole("button", { name: "Yuki Tanaka's account" }) };
}

describe("AccountMenu", () => {
  it("is a closed menu button showing name and plan", () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("FREE")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("opens on Enter with focus on the first item, in order", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}");
    const items = screen.getAllByRole(/menuitem/);
    expect(items.map((el) => el.textContent)).toEqual(["Profile", "Settings", "Reduce motion", "Sign out"]);
    expect(items[0]).toHaveFocus();
  });
  it("moves with arrows, Home and End, and wraps", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const items = screen.getAllByRole(/menuitem/);
    await user.keyboard("{ArrowUp}");
    expect(items[3]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items[3]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
  });
  it("ArrowUp on the trigger opens on the last item", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  });
  it("Escape closes and returns focus to the trigger", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it("Tab and an outside click close it", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("Reduce motion is a real checkbox item bound to the theme state", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const item = screen.getByRole("menuitemcheckbox", { name: "Reduce motion" });
    expect(item).toHaveAttribute("aria-checked", "false");
    await user.click(item);
    expect(screen.getByRole("menuitemcheckbox", { name: "Reduce motion" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-reduce-motion");
  });
  it("Sign out submits the existing POST form", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut).toHaveAttribute("type", "submit");
    expect(signOut.closest("form")).toHaveAttribute("action", "/auth/signout");
    expect(signOut.closest("form")).toHaveAttribute("method", "post");
  });
  it("in rail mode shows only the avatar and keeps the accessible name", () => {
    setup(true);
    expect(screen.queryByText("FREE")).toBeNull();
    expect(screen.getByRole("button", { name: "Yuki Tanaka's account" })).toBeInTheDocument();
  });
});
```

Check `ThemeProvider` for the real attribute the reduce-motion state sets on `<html>` and use that in the `data-reduce-motion` assertion. In `app-nav.test.tsx` change the two `it.todo` back to `it` and give the truncation test the class `app-nav__account-name`.

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement `components/layout/account-menu.tsx`**

```tsx
"use client";

import { ChevronsUpDown, LogOut, Settings, User, Wind } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { useTheme } from "@/components/providers/theme-provider";
import { placeMenu, type NavSummary } from "@/lib/nav/nav-state";

const ITEM_ICONS: Record<string, typeof User> = { profile: User, settings: Settings };

/** Account trigger + menu (spec §3.5). Fixed-position in the viewport (plan P3) so the nav's scroll region can
 * never clip it; keyboard: ↑/↓/Home/End, Esc returns focus, Tab and outside click close. */
export function AccountMenu({ summary, email, items, collapsed }: {
  summary: NavSummary | null; email: string; items: readonly { href: string; key: string }[]; collapsed: boolean;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { accountReduceMotion, setReduceMotion } = useTheme();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focusOn, setFocusOn] = useState<"first" | "last">("first");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const itemsIn = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  const openMenu = (where: "first" | "last") => { setFocusOn(where); setOpen(true); };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const anchor = triggerRef.current.getBoundingClientRect();
    const box = menuRef.current.getBoundingClientRect();
    setPosition(placeMenu(anchor, { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }, collapsed ? "right" : "above"));
    const list = itemsIn();
    (focusOn === "first" ? list[0] : list[list.length - 1])?.focus();
  }, [open, collapsed, focusOn]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  const onMenuKey = (event: React.KeyboardEvent) => {
    const list = itemsIn();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { event.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (event.key === "ArrowDown") go(index + 1);
    else if (event.key === "ArrowUp") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(list.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close(false);
  };

  const name = summary?.name ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "·";

  return (
    <>
      <button ref={triggerRef} type="button" className="app-nav__account" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} aria-label={t("account.trigger", { name: name || t("account.menu") })}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); openMenu("first"); }
          if (event.key === "ArrowUp") { event.preventDefault(); openMenu("last"); }
        }}>
        <span className={summary?.plan === "plus" ? "app-nav__avatar app-nav__avatar--plus" : "app-nav__avatar"} aria-hidden="true">
          {summary?.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- avatar from storage or OAuth, arbitrary origin.
            ? <img src={summary.avatarUrl} alt="" />
            : initial}
        </span>
        {!collapsed && (
          <>
            <span className="app-nav__account-text">
              <span className="app-nav__account-name" title={name}>{name}</span>
              {summary?.plan && <span className={`app-nav__plan app-nav__plan--${summary.plan}`}>{t(`plan.${summary.plan}`)}</span>}
            </span>
            <ChevronsUpDown aria-hidden="true" className="app-nav__icon app-nav__chevron" />
          </>
        )}
      </button>

      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={t("account.menu")} className="account-menu" onKeyDown={onMenuKey}
          style={position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: "hidden" }}>
          <div className="account-menu__header" aria-hidden="true">
            <span className="account-menu__name">{name}</span>
            <span className="account-menu__email">{email}</span>
          </div>
          {items.map((item) => {
            const Icon = ITEM_ICONS[item.key] ?? User;
            return (
              <Link key={item.key} href={item.href} role="menuitem" tabIndex={-1} className="account-menu__item" onClick={() => close(false)}>
                <Icon aria-hidden="true" className="app-nav__icon" />{t(item.key as Parameters<typeof t>[0])}
              </Link>
            );
          })}
          <button type="button" role="menuitemcheckbox" aria-checked={accountReduceMotion} tabIndex={-1} className="account-menu__item"
            onClick={() => setReduceMotion(!accountReduceMotion)}>
            <Wind aria-hidden="true" className="app-nav__icon" />{t("account.reduceMotion")}
            <span className="account-menu__switch" data-on={accountReduceMotion} aria-hidden="true" />
          </button>
          <div role="separator" className="account-menu__divider" />
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" tabIndex={-1} className="account-menu__item account-menu__item--danger">
              <LogOut aria-hidden="true" className="app-nav__icon" />{tCommon("auth.signOut")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

If the `textContent` order test fails because the header row's text is included, it is not (the test reads only `menuitem*` elements) — keep the header `aria-hidden`.

- [ ] **Step 4: Wire it** — in `app-nav.tsx` replace the placeholder `<span data-account-slot …>` with
`<AccountMenu summary={summary} email={userEmail} items={accountItems} collapsed={collapsed} />` and import it.

- [ ] **Step 5: CSS** — append:

```css
.app-nav__account { display: flex; align-items: center; gap: calc(10 * var(--nav-u)); inline-size: 100%; min-block-size: var(--hit-target-min);
  padding: calc(5 * var(--nav-u)) calc(8 * var(--nav-u)); border: 1px solid hsl(var(--border)); border-radius: var(--radius-md);
  background: hsl(var(--secondary)); color: hsl(var(--foreground)); text-align: left; transition: border-color 150ms; }
.app-nav__account:hover { border-color: hsl(var(--primary) / 0.4); }
.app-nav__account:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
.app-nav[data-collapsed="true"] .app-nav__account { justify-content: center; padding-inline: 0; border-color: transparent; background: transparent; }
.app-nav__avatar { display: grid; place-items: center; flex-shrink: 0; inline-size: calc(28 * var(--nav-u)); block-size: calc(28 * var(--nav-u));
  overflow: hidden; border-radius: 999px; background: hsl(var(--primary) / 0.16); color: hsl(var(--ember-300));
  font-size: var(--text-caption); line-height: var(--leading-caption); font-weight: 700; }
.app-nav__avatar img { inline-size: 100%; block-size: 100%; object-fit: cover; }
.app-nav__avatar--plus { box-shadow: 0 0 0 2px hsl(var(--sand-400)); }
.app-nav__account-text { display: flex; flex-direction: column; min-inline-size: 0; flex: 1; }
.app-nav__account-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-body); line-height: var(--leading-body); font-weight: 600; }
.app-nav__plan { align-self: flex-start; padding: 0 calc(6 * var(--nav-u)); border-radius: 999px; font-size: var(--text-caption);
  line-height: var(--leading-caption); font-weight: 700; letter-spacing: 0.08em; }
.app-nav__plan--free { border: 1px solid hsl(var(--border)); color: hsl(var(--muted-foreground)); }
.app-nav__plan--plus { background: hsl(var(--sand-400)); color: hsl(var(--ink-950)); }
.app-nav__chevron { color: hsl(var(--muted-foreground)); }
.account-menu { position: fixed; z-index: 50; min-inline-size: calc(216 * var(--nav-u)); padding: calc(8 * var(--nav-u));
  border: 1px solid hsl(var(--border)); border-radius: var(--radius-md); background: hsl(var(--surface-overlay));
  box-shadow: 0 calc(18 * var(--nav-u)) calc(48 * var(--nav-u)) hsl(0 0% 0% / 0.45); }
.account-menu__header { display: flex; flex-direction: column; padding: calc(6 * var(--nav-u)) calc(10 * var(--nav-u)) calc(8 * var(--nav-u));
  border-bottom: 1px solid hsl(var(--border)); margin-bottom: calc(6 * var(--nav-u)); }
.account-menu__name { font-size: var(--text-body); line-height: var(--leading-body); font-weight: 600; color: hsl(var(--foreground)); }
.account-menu__email { font-size: var(--text-caption); line-height: var(--leading-caption); color: hsl(var(--muted-foreground)); }
.account-menu__item { display: flex; align-items: center; gap: calc(11 * var(--nav-u)); inline-size: 100%; min-block-size: var(--hit-target-min);
  padding-inline: calc(10 * var(--nav-u)); border-radius: var(--radius-sm); color: hsl(var(--foreground)); font-size: var(--text-body);
  line-height: var(--leading-body); text-align: left; }
.account-menu__item:hover, .account-menu__item:focus-visible { background: hsl(var(--secondary)); outline: none; }
.account-menu__item--danger { color: hsl(var(--coral-300)); }
.account-menu__divider { block-size: 1px; margin: calc(6 * var(--nav-u)) 0; background: hsl(var(--border)); }
.account-menu__switch { margin-inline-start: auto; inline-size: calc(28 * var(--nav-u)); block-size: calc(16 * var(--nav-u)); border-radius: 999px;
  background: hsl(var(--border)); position: relative; }
.account-menu__switch::after { content: ""; position: absolute; inset-block-start: 2px; inset-inline-start: 2px; inline-size: calc(12 * var(--nav-u));
  block-size: calc(12 * var(--nav-u)); border-radius: 999px; background: hsl(var(--foreground)); transition: transform 150ms; }
.account-menu__switch[data-on="true"] { background: hsl(var(--primary)); }
.account-menu__switch[data-on="true"]::after { transform: translateX(calc(12 * var(--nav-u))); }
```

If `z-popover` maps to a different number in `tailwind.config.ts`, use that value instead of 50 (read it, do not guess).

- [ ] **Step 6: Run** — `npx vitest run components/layout` → PASS; `npm run typecheck`, `npm run lint`.

- [ ] **Step 7: Mutation checks** — (a) remove `triggerRef.current?.focus()` from `close`; the Escape test must fail. (b) bind `aria-checked={false}`; the reduce-motion test must fail. Restore each.

- [ ] **Step 8: Commit**

```bash
git add components/layout/account-menu.tsx components/layout/account-menu.test.tsx components/layout/app-nav.tsx components/layout/app-nav.test.tsx app/globals.css
git commit -m "feat(nav): accessible account menu - profile, settings, reduce motion, sign out (spec §3.5)"
```

---

### Task 8: Rail tooltip

**Files:**
- Create: `components/layout/nav-tooltip.tsx`, `components/layout/nav-tooltip.test.tsx`
- Modify: `components/layout/app-nav.tsx` (rail links + Help get tooltip props), `app/globals.css` (`.nav-tooltip`)

**Interfaces:**
- Produces: `useNavTooltip(enabled: boolean): { tooltip: React.ReactNode; bind(label: string): { onPointerEnter; onPointerLeave; onFocus; onBlur; onKeyDown; "aria-describedby"?: string } }`. Tooltip id is stable per nav; shown only while `enabled` (rail mode).

- [ ] **Step 1: Failing tests**

```tsx
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useNavTooltip } from "./nav-tooltip";

function Harness({ enabled = true }: { enabled?: boolean }) {
  const { tooltip, bind } = useNavTooltip(enabled);
  return (<div><a href="/x" aria-label="Review, 32 due" {...bind("Review · 32")}>R</a><a href="/y" aria-label="Kanji" {...bind("Kanji")}>K</a>{tooltip}</div>);
}

describe("useNavTooltip", () => {
  it("shows the label on hover, beside the link, and hides on leave", () => {
    render(<Harness />);
    fireEvent.pointerEnter(screen.getByLabelText("Review, 32 due"));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Review · 32");
    expect(tip).toHaveClass("nav-tooltip");
    expect(tip.style.left).toMatch(/px$/);
    expect(tip.style.top).toMatch(/px$/);
    fireEvent.pointerLeave(screen.getByLabelText("Review, 32 due"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("shows on keyboard focus, is described-by linked, and Escape hides it", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    fireEvent.focus(link);
    const tip = screen.getByRole("tooltip");
    expect(link).toHaveAttribute("aria-describedby", tip.id);
    fireEvent.keyDown(link, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("hides on blur and on scroll", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    fireEvent.focus(link);
    fireEvent.blur(link);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(link);
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("renders nothing when disabled (expanded mode)", () => {
    render(<Harness enabled={false} />);
    fireEvent.pointerEnter(screen.getByLabelText("Kanji"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Implement `components/layout/nav-tooltip.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useId, useState } from "react";

/** One tooltip per AppNav for the rail (spec §3.6). position: fixed, so the scroll region cannot clip it (plan P3);
 * shown on hover and keyboard focus, hidden on leave, blur, Escape and any scroll. */
export function useNavTooltip(enabled: boolean) {
  const id = useId();
  const [tip, setTip] = useState<{ label: string; left: number; top: number; owner: string } | null>(null);
  const hide = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!tip) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [tip, hide]);
  useEffect(() => { if (!enabled) setTip(null); }, [enabled]);

  const bind = (label: string) => {
    const show = (event: React.SyntheticEvent<HTMLElement>) => {
      if (!enabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setTip({ label, left: rect.right + 10, top: rect.top + rect.height / 2, owner: label });
    };
    return {
      onPointerEnter: show,
      onPointerLeave: hide,
      onFocus: show,
      onBlur: hide,
      onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Escape") hide(); },
      "aria-describedby": enabled && tip?.owner === label ? id : undefined,
    };
  };

  const tooltip = enabled && tip
    ? <span role="tooltip" id={id} className="nav-tooltip" style={{ left: tip.left, top: tip.top }}>{tip.label}</span>
    : null;
  return { tooltip, bind };
}
```

- [ ] **Step 4: Wire into AppNav** — call `const { tooltip, bind } = useNavTooltip(collapsed);` and spread `{...bind(isReview && due > 0 ? \`${label} · ${dueLabel(due)}\` : label)}` on every nav `Link`, `{...bind(t("help"))}` on the Help link; render `{tooltip}` as the last child of `<nav>`. Add one AppNav test: in rail mode, focusing the Kanji link shows a tooltip "Kanji".

- [ ] **Step 5: CSS**

```css
.nav-tooltip { position: fixed; z-index: 50; transform: translateY(-50%); padding: calc(5 * var(--nav-u)) calc(10 * var(--nav-u));
  border: 1px solid hsl(var(--border)); border-radius: var(--radius-sm); background: hsl(var(--secondary)); color: hsl(var(--foreground));
  font-size: var(--text-caption); line-height: var(--leading-caption); font-weight: 600; white-space: nowrap; pointer-events: none;
  box-shadow: 0 calc(8 * var(--nav-u)) calc(24 * var(--nav-u)) hsl(0 0% 0% / 0.4); }
```

- [ ] **Step 6: Run** — `npx vitest run components/layout` → PASS; typecheck, lint.

- [ ] **Step 7: Mutation check** — remove the `onFocus: show` line; the keyboard test must fail; restore.

- [ ] **Step 8: Commit**

```bash
git add components/layout/nav-tooltip.tsx components/layout/nav-tooltip.test.tsx components/layout/app-nav.tsx components/layout/app-nav.test.tsx app/globals.css
git commit -m "feat(nav): rail tooltips on hover and keyboard focus, outside the scroll region (spec §3.6)"
```

---

### Task 9: E2E — persistence, focus boundary, live badge, layering, expiry, sizes

**Files:**
- Create: `tests/e2e/app-nav.spec.ts`
- Modify: `tests/e2e/route-group-provider-identity.spec.ts` (the `(focus)` steps 3–5)

**Interfaces:**
- Consumes: `registerViaUi`, `uniqueEmail` (`tests/e2e/fixtures/auth.ts`); `seedWorkspaceData()` → `WorkspaceData { admin, userIdByEmail(email), videoId, cleanup(), … }` (`tests/e2e/fixtures/workspace-data.ts` — read its interface first and use its real field names).

- [ ] **Step 1: Update the route-group spec** — in its `(focus)` test, replace steps 3–5 with:

```ts
  // 3. The (focus) chrome contract since app-chrome-refresh: the Main nav is mounted as the rail (spec D5).
  const main = page.getByRole("navigation", { name: "Main" });
  await expect(main).toHaveCount(1);
  await expect(main).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByRole("navigation", { name: "Learning modes" })).toHaveCount(1);
  const expand = page.getByRole("button", { name: /expand navigation/i });
  await expect(expand).toHaveAttribute("aria-expanded", "false");

  // 4. Reduce motion stays reachable: through the account menu, as a real checkbox item.
  await page.getByRole("button", { name: /'s account$/ }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: /reduce motion/i })).toBeVisible();
  await page.keyboard.press("Escape");

  // 5. Expanding works in place.
  await expand.click();
  await expect(main).toHaveAttribute("data-collapsed", "false");
```

The Dashboard link click in step 6 still works (expanded now).

- [ ] **Step 2: Write `tests/e2e/app-nav.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

test.describe.configure({ mode: "serial" });
let lesson: WorkspaceData;
let userId: string | undefined;

test.beforeAll(async () => { lesson = await seedWorkspaceData(); });
test.afterAll(async () => { await lesson?.cleanup(); });
test.afterEach(async () => {
  if (userId) {
    await lesson.admin.from("user_kanji_progress").delete().eq("user_id", userId);
    const deleted = await lesson.admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
    userId = undefined;
  }
});

const nav = (page: Page) => page.getByRole("navigation", { name: "Main", exact: true });
const width = (page: Page) => nav(page).evaluate((el) => el.getBoundingClientRect().width);

async function register(page: Page) {
  const email = uniqueEmail("e2e_appnav");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "Nav Learner", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  userId = await lesson.userIdByEmail(email);
}

test("E1 the rail choice survives a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.reload();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  expect(await width(page)).toBeCloseTo(72, 0);
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await page.reload();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  expect(await width(page)).toBeCloseTo(240, 0);
});

test("E2 (focus) is the rail and never overwrites the (app) choice", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  // client navigation into (focus)
  await nav(page).getByRole("link", { name: "Lessons", exact: true }).click();
  await page.getByRole("link", { name: /E2E Seed Video/ }).first().click();
  await expect(page).toHaveURL(/\/en\/shadowing\/.+$/, { timeout: 15_000 });
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  const cookie = async () => (await context.cookies()).find((c) => c.name === "korume_nav")?.value;
  expect(await cookie()).toBeUndefined();
  // client navigation back to (app)
  await nav(page).getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  await page.reload();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  // collapsed (app) choice survives a full-load round trip through (focus)
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.goto(page.url().replace(/\/dashboard$/, "/shadowing"));
  await page.getByRole("link", { name: /E2E Seed Video/ }).first().click();
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await page.goto("/en/dashboard");
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  expect(await cookie()).toBe("collapsed");
});

test("E3 the review badge drops right after a saved review, same route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  const kanji = await lesson.admin.from("kanji").select("id").order("id").limit(1).single();
  if (kanji.error) throw kanji.error;
  const earlier = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const seeded = await lesson.admin.from("user_kanji_progress").insert({
    user_id: userId, kanji_id: kanji.data.id, srs_stage: 1, next_review_at: earlier, last_reviewed_at: earlier,
  });
  if (seeded.error) throw seeded.error;
  await page.goto("/en/kanji/review");
  const review = nav(page).getByRole("link", { name: /^Review/ });
  await expect(review).toHaveAccessibleName("Review, 1 due");
  const url = page.url();
  await page.getByRole("button", { name: /show answer/i }).click();
  await page.getByRole("button", { name: /good/i }).click();
  await expect(review).toHaveAccessibleName("Review");
  expect(page.url()).toBe(url);
});

async function topmostInside(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, topmost: !!hit && el.contains(hit) };
  });
}

test("E4 account menu, rail tooltip and bell panel sit on top, inside 1280x529", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await page.getByRole("button", { name: /'s account$/ }).click();
  expect(await topmostInside(page, '[role="menu"]')).toEqual({ inside: true, topmost: true });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.getByRole("button", { name: /'s account$/ }).click();
  expect(await topmostInside(page, '[role="menu"]')).toEqual({ inside: true, topmost: true });
  await page.keyboard.press("Escape");
  await nav(page).getByRole("link", { name: "Kanji" }).focus();
  expect(await topmostInside(page, '[role="tooltip"]')).toEqual({ inside: true, topmost: true });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  expect(await topmostInside(page, '[role="dialog"]')).toMatchObject({ inside: true });
});

test("E6 an expired session clears personal data and lands on sign-in", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await expect(nav(page).getByText("Nav Learner")).toBeVisible();
  const auth = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(auth.length).toBeGreaterThan(0);
  await context.clearCookies({ name: /^sb-/ });
  await nav(page).getByRole("link", { name: "Kanji", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/login\?redirectTo=%2Fen%2F/, { timeout: 15_000 });
  await expect(page.getByText("Nav Learner")).toHaveCount(0);
});

test("E7 every interactive nav target is at least 44px tall", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  for (const collapsed of [false, true]) {
    if (collapsed) await page.getByRole("button", { name: "Collapse navigation" }).click();
    const heights = await nav(page).locator("a, button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThanOrEqual(15);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(43.5);
  }
});

for (const [vw, vh, expanded, rail, row] of [[1280, 529, 240, 72, 44], [1440, 900, 270, 81, 44], [1920, 1080, 337.5, 101.25, 47.8]] as const) {
  test(`A1 sizes at ${vw}x${vh}`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    await register(page);
    expect(Math.abs((await width(page)) - expanded)).toBeLessThanOrEqual(0.5);
    const rowHeight = await nav(page).locator(".app-nav__item").first().evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(rowHeight - row)).toBeLessThanOrEqual(0.5);
    const scroll = nav(page).locator("[data-nav-scroll]");
    const footerBefore = await nav(page).locator(".app-nav__footer").evaluate((el) => el.getBoundingClientRect().top);
    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    expect(await nav(page).locator(".app-nav__footer").evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo(footerBefore, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Collapse navigation" }).click();
    expect(Math.abs((await width(page)) - rail)).toBeLessThanOrEqual(0.5);
  });
}
```

E3: `/kanji/review` builds its queue with `getReviewQueue("kanji", level)` — read `app/[locale]/(protected)/(app)/kanji/review/page.tsx` to see where `level` comes from, and seed a kanji from that level (or visit with the matching `?level=`), otherwise the due card is filtered out and the test measures nothing.

`context.clearCookies({ name: /^sb-/ })` needs Playwright ≥ 1.43; check `@playwright/test` in `package.json` — if older, use `const keep = (await context.cookies()).filter((c) => !c.name.startsWith("sb-")); await context.clearCookies(); await context.addCookies(keep);`. Confirm the auth cookie prefix by printing cookie names once (Supabase SSR uses `sb-<ref>-auth-token`).

- [ ] **Step 3: Build and run in THIS worktree only** — stop anything on :3000 first (`Get-NetTCPConnection -LocalPort 3000` → stop that process), then `npm run build` and `npx playwright test tests/e2e/app-nav.spec.ts tests/e2e/route-group-provider-identity.spec.ts tests/e2e/typography.spec.ts --workers=1`. Expected: all PASS. A failure is a product bug until proven otherwise — debug it (systematic-debugging), do not loosen a number.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app-nav.spec.ts tests/e2e/route-group-provider-identity.spec.ts
git commit -m "test(nav): e2e persistence, focus boundary, live badge, layering, expiry, 44px floor, 1280/1440/1920 sizes"
```

---

### Task 10: Full gate, Chrome look, run state

**Files:**
- Modify: `docs/superpowers/run-state/app-chrome-refresh.md`

- [ ] **Step 1: Full suite after the last edit** — `npx vitest run --minWorkers=1 --maxWorkers=2`, `npm run typecheck`, `npm run lint`, `npm run verify:protocol`. All green, or stop and fix.

- [ ] **Step 2: Full E2E** — `npx playwright test --workers=1` in this worktree's build. Known pre-existing reds on master (do not fix here, list them): landing-page :287/:608/:700, summary :29 and shadowing-intelligence :159 under `AI_PROVIDER=gemini`. Anything else red is this branch's.

- [ ] **Step 3: Whole-branch review** — dispatch the `code-reviewer` subagent on `git diff master...HEAD` with the spec and this plan; fix Criticals/Importants, re-review the fix wave.

- [ ] **Step 4: Chrome look** — serve this worktree's build (`npm run start` from the worktree, absolute paths), open the owner's Chrome at `/vi/dashboard` (`Start-Process chrome.exe <url>` if the extension is offline), 1280×529: expanded, rail, account menu open, a rail tooltip, a `(focus)` lesson. Record A1/E-results and screenshots paths in the run state.

- [ ] **Step 5: Run state + commit** — fill "Accepted commits", "Verification", "Next actions: owner look → merge on approval".

```bash
git add docs/superpowers/run-state/app-chrome-refresh.md
git commit -m "docs(app-chrome-refresh): run state - gates, measurements, ready for the owner's look"
```
