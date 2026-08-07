# Screen-Port Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two things every screen port depends on — a token system the primitives actually
use, and a chrome contract expressed by route groups — so the 29 designed screens can be ported
without re-deciding buttons, cards and navigation 29 times.

**Architecture:** A `(protected)` route group owns the authenticated session's lifetime and mounts
`AmbientProvider`; three child groups — `(app)`, `(focus)`, `(immersive)` — differ only in chrome.
Provider lifetime outlives layout lifetime, so Companion state survives a chrome change. On the token
side, one typography step (`hero`) is added and the eight primitives still on raw Tailwind are moved
onto the `--space-*` and typography scales, with a test that keeps them there.

**Tech Stack:** Next.js 14.2.35 App Router · React 18.3.1 · TypeScript strict · Tailwind v3 ·
Vitest + RTL · Playwright · Supabase (`@supabase/ssr`).

**Spec:** `docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md` (`7ff3970`, `d6d7c56`).

## Global Constraints

- **Rule #0 (spec §2):** Pixel values in Figma are not an API. Every value maps to a semantic token.
  Exceptions require an inline comment saying why no token can express the value.
- **No geometry decisions (spec §8.2).** Sidebar width, gutters, toolbar height, right-column width
  and content max-width are out of scope. `components/ui/container.tsx` is not touched.
- **No new primitives.** Avatar is out of scope (spec §1.1).
- **Task 1 is a gate.** No route moves beyond the one Task 1 makes until its test passes.
- **Behaviour-preserving.** Tasks 4–7 change classes, never a component's public API or rendered
  semantics. The existing per-primitive tests are the regression net.
- **Baseline to preserve:** unit **1966 / 218 files** · `tsc` 0 · lint 0 errors + **77** warnings
  (`54 no-non-null-assertion + 23 no-unused-vars` — compare the rule mix, not the count) ·
  Playwright **6/6**.
- **`tests/e2e/` is excluded from `vitest.config.ts`.** `npm test` cannot catch a broken Playwright
  selector. Any label or route change must be swept there by hand.
- **If a worktree is used:** it has no `.env.local` (gitignored). Copy it from the main checkout
  before trusting any Playwright run, and remove the secrets afterwards. Also run vitest with
  `--exclude ".worktrees/**"` from the repo root.
- **Commit freely** (standing permission). Never push.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `lib/auth/current-user.ts` | `getCurrentUser()` — the request-scoped, `cache()`-deduped auth read. One round trip even when two layouts in the same render need the user. |
| `app/[locale]/(protected)/layout.tsx` | The session lifetime boundary: auth gate + `AmbientProvider`. Renders no chrome. |
| `app/[locale]/(protected)/(app)/layout.tsx` | Chrome contract "nav visible". |
| `app/[locale]/(protected)/(immersive)/layout.tsx` | Chrome contract "no nav". |
| `app/[locale]/(protected)/(focus)/layout.tsx` | Chrome contract "nav mounted, hidden by default". |
| `tests/e2e/route-group-provider-identity.spec.ts` | The §8.1 gate: client-side transition + provider identity across a group boundary. |
| `components/ui/token-scale.test.ts` | Rule #0 enforcement over `components/ui/**`. |

**Moved**

| From | To |
|---|---|
| `app/[locale]/(app)/*` (all routes) | `app/[locale]/(protected)/(app)/*` |
| `app/[locale]/(protected)/(app)/journal` | `app/[locale]/(protected)/(immersive)/journal` |
| `app/[locale]/(protected)/(app)/videos/[id]/shadowing` · `.../dictation` | `app/[locale]/(protected)/(focus)/videos/[id]/…` |

**Modified**

`app/globals.css` · `tailwind.config.ts` · `lib/utils.ts` · `lib/design-tokens.test.ts` ·
`components/layout/app-nav.tsx` · `components/ui/{button,card,input,label,badge,dialog,toast,select}.tsx` ·
`components/layout/notification-bell.tsx` · `components/learning/badges-grid.tsx` ·
`components/companion/journal-view.tsx` · `docs/design/screens/navigation-system.md`

**Deleted:** `app/[locale]/(app)/layout.tsx` (its four jobs split across `(protected)` and `(app)`).

---

### Task 1: The gate — `(protected)` lifetime boundary, proven by test

Spec §5.1, §5.2, §8.1. This task creates the structure and makes exactly one chrome change
(`/journal` becomes immersive — the user's own worked example of the type). Its test is the gate for
every later route move.

**Files:**
- Create: `lib/auth/current-user.ts`
- Create: `app/[locale]/(protected)/layout.tsx`
- Create: `app/[locale]/(protected)/(app)/layout.tsx`
- Create: `app/[locale]/(protected)/(immersive)/layout.tsx`
- Delete: `app/[locale]/(app)/layout.tsx`
- Move: every directory under `app/[locale]/(app)/` into `app/[locale]/(protected)/(app)/`, then
  `journal/` on into `app/[locale]/(protected)/(immersive)/`
- Modify: `components/companion/journal-view.tsx` (back affordance — see Step 6)
- Test: `tests/e2e/route-group-provider-identity.spec.ts`

**Interfaces:**
- Produces: `getCurrentUser(): Promise<User | null>` from `@/lib/auth/current-user`. Tasks 2 and 3
  consume it. It is `cache()`-wrapped, so calling it in both `(protected)/layout.tsx` and a child
  layout costs one auth round trip per request.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/route-group-provider-identity.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

/**
 * Spec §8.1 — the gate for the whole chrome architecture.
 *
 * `AmbientProvider` owns Companion state. It lives in `(protected)`, above the
 * chrome groups, precisely so a chrome change does not reset it. Two things
 * have to hold for that to be true, and neither is observable from the DOM:
 *
 *   1. The transition is client-side. A window sentinel survives one and is
 *      wiped by a document load.
 *   2. The provider instance survives. `phaseRequestedRef` makes the phase read
 *      fire ONCE per provider lifetime, so a second `/api/user/stats` request
 *      after crossing the boundary is a remount — no instrumentation needed.
 *
 * Registration mechanics + the fresh-email convention are copied from
 * tests/e2e/journal.spec.ts.
 */
test("Companion state survives the (app) -> (immersive) boundary", async ({ page }) => {
  const email = `e2e_group_${Date.now()}@example.com`;
  const password = "password123";

  let statsRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/user/stats") statsRequests += 1;
  });

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Route Group Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  // The dashboard mounts a CompanionAnchor, which triggers the provider's
  // one-time phase read. Wait for it before the count means anything.
  await expect.poll(() => statsRequests, { timeout: 15000 }).toBe(1);

  await page.evaluate(() => {
    (window as unknown as { __groupSentinel?: number }).__groupSentinel = 1;
  });

  await page.getByRole("link", { name: "Journey", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/journal$/, { timeout: 15000 });
  await expect(page.getByText("The day the two of you met.")).toBeVisible();

  // 1. The navigation stayed client-side.
  expect(
    await page.evaluate(
      () => (window as unknown as { __groupSentinel?: number }).__groupSentinel,
    ),
  ).toBe(1);

  // 2. The provider was not remounted. /journal mounts its own anchor; if the
  //    provider had been rebuilt, its fresh `phaseRequestedRef` would have
  //    fired a second phase read.
  expect(statsRequests).toBe(1);

  // 3. The chrome contract actually changed: (immersive) mounts no nav.
  await expect(page.getByRole("navigation", { name: /main/i })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx playwright test tests/e2e/route-group-provider-identity.spec.ts
```

Expected: FAIL on assertion 3 — `/journal` is still inside `(app)` today, so the nav renders.
(Kill any stale node on :3000 first; `reuseExistingServer` will pick it up.)

- [ ] **Step 3: Add the cached auth read**

Create `lib/auth/current-user.ts`:

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user for the current request, or null.
 *
 * `cache()` is load-bearing, not an optimisation: `(protected)/layout.tsx`
 * needs the user for the auth gate and `(app)/layout.tsx` needs it for the nav
 * footer, and a child layout cannot receive props from its parent. Without
 * dedupe that is two `auth.getUser()` round trips on every protected render.
 */
export const getCurrentUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
```

- [ ] **Step 4: Create the lifetime boundary layout**

Create `app/[locale]/(protected)/layout.tsx`:

```tsx
import { redirect } from "@/lib/i18n/navigation";
import { AmbientProvider } from "@/components/companion/ambient-provider";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * The authenticated session's lifetime boundary (spec §5.1). It renders no
 * chrome of its own — that is the point. `(app)`, `(focus)` and `(immersive)`
 * are siblings beneath it, so moving between them swaps the chrome layout
 * while THIS layout instance, and the provider inside it, survive.
 *
 * Principle: provider lifetime > layout lifetime. Any future session-scoped
 * owner (AI conversation, study queue, draft journal, mining selection)
 * belongs here for the same reason.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // Auth is also enforced in middleware; this is defence in depth.
  if (!hasPublicSupabaseEnv()) redirect({ href: "/login", locale });

  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  return <AmbientProvider>{children}</AmbientProvider>;
}
```

- [ ] **Step 5: Create the two chrome layouts**

Create `app/[locale]/(protected)/(app)/layout.tsx`:

```tsx
import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Chrome contract: nav visible. The auth gate lives in `(protected)`;
 * `getCurrentUser` is cached, so reading the user again here is free.
 */
export default async function AppChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav userEmail={user?.email ?? ""} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

Create `app/[locale]/(protected)/(immersive)/layout.tsx`:

> **Correction (2026-08-07, final whole-branch review F4).** The block below originally read "Chrome
> contract: no nav. Not 'nav hidden' — not mounted at all, and there is no toggle," with a layout body
> containing no `ReduceMotionToggle`. That was wrong and was fixed in the spec + `navigation-system.md`
> at commit `91d9084` but never carried back to this plan. The immersive contract is **no Nav Column**,
> not **no chrome**: every immersive screen still carries a back affordance (per-screen) plus a global
> `ReduceMotionToggle` (CLAUDE.md §2 rules 4 and 5 — a globally reachable reduce-motion control with
> full keyboard reach, and immersive is where motion is heaviest). This reflects the user's ruling of
> 2026-08-07 that the immersive contract is back affordance PLUS reduce-motion control. The code block
> below is corrected to match what actually shipped (`app/[locale]/(protected)/(immersive)/layout.tsx`);
> the surrounding narrative is intentionally left as-is elsewhere in this plan except where this
> correction required touching it.

```tsx
/**
 * Chrome contract: no nav. Not "nav hidden" — the Nav Column is not mounted at
 * all, and there is no toggle. Companion Diary and onboarding are rooms, not
 * destinations. This is "no Nav Column", not "no chrome" — see the correction
 * above and `docs/design/screens/navigation-system.md` § Navigation States.
 *
 * Consequence (spec §5.6): there is no `<nav>` landmark here, so every
 * immersive screen must carry its own labelled way back. CLAUDE.md §2 rules 4
 * and 5 additionally require a globally reachable, keyboard-reachable
 * reduce-motion control at all times — immersive is where motion is heaviest,
 * so this layout mounts `ReduceMotionToggle` directly, independent of both the
 * Nav Column (not mounted here) and Companion state.
 */
export default function ImmersiveChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <div className="flex justify-end p-md text-muted-foreground">
        <ReduceMotionToggle />
      </div>
      {children}
    </main>
  );
}
```

- [ ] **Step 6: Move the routes and give `/journal` its way back**

```bash
mkdir -p "app/[locale]/(protected)/(app)" "app/[locale]/(protected)/(immersive)"
git mv "app/[locale]/(app)/community" "app/[locale]/(app)/conversation" \
       "app/[locale]/(app)/dashboard" "app/[locale]/(app)/grammar" \
       "app/[locale]/(app)/jlpt" "app/[locale]/(app)/jlpt-test" \
       "app/[locale]/(app)/kanji" "app/[locale]/(app)/leaderboard" \
       "app/[locale]/(app)/mining" "app/[locale]/(app)/playlists" \
       "app/[locale]/(app)/profile" "app/[locale]/(app)/reading" \
       "app/[locale]/(app)/videos" "app/[locale]/(app)/vocab" \
       "app/[locale]/(protected)/(app)/"
git mv "app/[locale]/(app)/journal" "app/[locale]/(protected)/(immersive)/journal"
git rm "app/[locale]/(app)/layout.tsx"
```

Then in `components/companion/journal-view.tsx`, add the back affordance the immersive contract
requires. Put it as the first child of the view's outermost element:

```tsx
<Link
  href="/dashboard"
  className="mb-lg inline-flex items-center gap-2xs text-caption text-muted-foreground hover:text-foreground"
>
  ← {t("backToDashboard")}
</Link>
```

Add `"backToDashboard": "Back to dashboard"` to `messages/en/companion.json` and
`"backToDashboard": "Về bảng điều khiển"` to `messages/vi/companion.json`. Import `Link` from
`@/lib/i18n/navigation` — never from `next/link`; the ESLint boundary rejects the latter.

- [ ] **Step 7: Run the gate**

```bash
npx playwright test tests/e2e/route-group-provider-identity.spec.ts
```

Expected: PASS, all three assertions.

**If assertion 1 or 2 fails, STOP and do not continue to Task 2.** Per spec §8.1 the architectural
model still holds and only the implementation strategy is revisited: the fallback is a single layout
receiving a chrome mode, with `AmbientProvider` still mounted above it. Report the failure and the
fallback rather than working around it.

- [ ] **Step 8: Run the full suite**

```bash
npx tsc --noEmit && npx vitest run && npx playwright test
```

Expected: `tsc` 0 · unit 1966/1966 · Playwright **7/7** (6 existing + the new gate).
`tests/e2e/journal.spec.ts` must still pass unchanged — it reaches `/journal` by clicking "Journey"
from the dashboard, which still has nav.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]" lib/auth components/companion/journal-view.tsx messages tests/e2e
git commit -m "feat(chrome): add the (protected) lifetime boundary and the immersive contract

AmbientProvider owns Companion state, so putting the nav-mode groups side by
side with (app) would have unmounted it on every chrome change. (protected) is
the shared segment that keeps the provider instance alive while its children
swap chrome. /journal moves to (immersive) as the first real member.

The e2e gate asserts what the DOM cannot show: the transition stayed
client-side, and exactly one /api/user/stats fired across the boundary, which
is only true if the provider was never rebuilt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The `(focus)` contract — nav mounted, hidden by default

Spec §5.3. `screen-shadowing-practice.md` § Sidebar mandates hidden-by-default inside the Lesson
Workspace; `navigation-system.md:98-99` records it as unbuilt and owned by whichever plan builds the
route group. This is that plan.

**Files:**
- Modify: `components/layout/app-nav.tsx:60`, `:71-73`
- Create: `app/[locale]/(protected)/(focus)/layout.tsx`
- Move: `videos/[id]/shadowing/`, `videos/[id]/dictation/`
- Test: `components/layout/app-nav.test.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()` from Task 1.
- Produces: `AppNav({ userEmail, defaultVisible }: { userEmail: string; defaultVisible?: boolean })`.
  `defaultVisible` defaults to `true`, so every existing call site is unchanged.

- [ ] **Step 1: Write the failing test**

Append to `components/layout/app-nav.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/layout/app-nav.test.tsx
```

Expected: FAIL — `defaultVisible` is not a prop, so the nav renders visible and the first assertion
finds the Dashboard link.

- [ ] **Step 3: Add the prop**

In `components/layout/app-nav.tsx`, replace the signature at line 60 and the state at line 73:

```tsx
export function AppNav({
  userEmail,
  defaultVisible = true,
}: {
  userEmail: string;
  defaultVisible?: boolean;
}) {
```

```tsx
  // Not persisted: session-scoped state. It survives client-side navigation
  // WITHIN a chrome group, because AppNav lives in that group's layout —
  // crossing into another group is a chrome change, and resetting to the new
  // group's default is the intended behaviour, not a bug.
  const [visible, setVisible] = useState(defaultVisible);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run components/layout/app-nav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Create the `(focus)` layout and move the workspaces**

Create `app/[locale]/(protected)/(focus)/layout.tsx`:

```tsx
import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Chrome contract: nav mounted, hidden by default. This is what separates
 * (focus) from (immersive) — the learner in a workspace can still reach the
 * rest of the product, they just are not shown it while working
 * (screen-shadowing-practice.md § Sidebar).
 *
 * "Hidden" is not "Collapsed / Icon rail" (navigation-system.md § Navigation
 * States) — that state remains planned and unbuilt. Do not conflate them.
 */
export default async function FocusChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav userEmail={user?.email ?? ""} defaultVisible={false} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

```bash
mkdir -p "app/[locale]/(protected)/(focus)/videos/[id]"
git mv "app/[locale]/(protected)/(app)/videos/[id]/shadowing" \
       "app/[locale]/(protected)/(focus)/videos/[id]/shadowing"
git mv "app/[locale]/(protected)/(app)/videos/[id]/dictation" \
       "app/[locale]/(protected)/(focus)/videos/[id]/dictation"
```

`/videos` itself stays in `(app)` — it is the Hub, an App page. Only the workspaces move. The URLs
`/videos/[id]/shadowing` and `/videos/[id]/dictation` are unchanged, so no `href` anywhere needs
editing.

- [ ] **Step 6: Verify the whole suite**

```bash
npx tsc --noEmit && npx vitest run && npx playwright test
```

Expected: `tsc` 0 · unit 1968/1968 (1966 + the two new nav tests) · Playwright 7/7.

- [ ] **Step 7: Commit**

```bash
git add components/layout/app-nav.tsx components/layout/app-nav.test.tsx "app/[locale]"
git commit -m "feat(chrome): add the (focus) contract for lesson workspaces

Shadowing and Dictation move out of (app). The nav is still mounted — a
workspace learner can reopen it — but it starts hidden, which is what
screen-shadowing-practice.md has mandated and nothing implemented.

defaultVisible defaults to true, so every existing AppNav call site is
untouched. Hidden is not the planned Collapsed/Icon-rail state; they are
different and the comment says so.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Reconcile `navigation-system.md` with the code

Spec §6.1, §6.2. The document currently describes a mechanism that did not exist; after Tasks 1–2 it
does. This task makes the document match, and labels the change as a reconciliation so a later reader
does not read it as new design.

**Files:**
- Modify: `docs/design/screens/navigation-system.md:136-140`, § Navigation States, § Layout Regions

- [ ] **Step 1: Replace the inaccurate paragraph**

Replace lines 136-140 (the paragraph beginning "Per `screen-architecture.md` § Navigation
Philosophy") with:

```markdown
Per `screen-architecture.md` § Navigation Philosophy, navigation is expected to recede during focused
study. That reduction is expressed by the **chrome contract of the route group a screen lives in**
(`docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md` §5):

| Group | Contract |
|---|---|
| `(app)` | Nav Column mounted and visible. The default for every destination in § Navigation Inventory. |
| `(focus)` | Nav Column mounted, **hidden by default**, recoverable by the learner. Lesson workspaces — Shadowing Practice, Dictation, Pronunciation Studio. |
| `(immersive)` | Nav Column **not mounted**. No toggle. Companion Diary, onboarding. |

Route groups express chrome contracts, not feature categories: features churn, chrome contracts do
not. All three sit beneath `(protected)`, which owns the authenticated session's lifetime and mounts
the Ambient Layer — so moving between contracts changes the chrome without resetting Companion state.

The Collapsed / Icon-rail state in `adaptive-layouts.md` is a further refinement of this same
philosophy and remains planned. **`(focus)`'s "hidden" is not "collapsed"** — hidden removes the
column and leaves a way back; collapsed keeps a narrow rail. Do not conflate them.

> **Reconciliation note (2026-08-07).** This paragraph previously stated that Shadowing / Listening
> Practice / Review "render outside the persistent nav chrome context for that flow." That was not
> what the code did: those routes were inside `(app)`, which mounts the Nav Column, and no nested
> layout removed it. The mechanism above is what makes the original intent true.
```

- [ ] **Step 2: Update § Navigation States**

In the states table, append to the "Collapsed / Icon rail" row's description:

```markdown
Distinct from `(focus)`'s hidden-by-default contract, which ships in the same plan — hidden is a
visibility default, collapsed is a different rendering of the column.
```

- [ ] **Step 3: Update § Layout Regions**

After the two region bullets, add:

```markdown
Both regions exist only under a chrome contract that mounts the Nav Column. In `(immersive)` there is
no Nav Column and therefore no Nav Column region; the whole viewport is Content Region, and Companion
anchors are positioned within it exactly as elsewhere.
```

- [ ] **Step 4: Verify no other doc contradicts the new mechanism**

```bash
grep -rn "outside the persistent nav\|renders outside" docs/design/
```

Expected: no hits remain. If a sibling doc repeats the old claim, fix it in this task — a
reconciliation that leaves one copy behind is the two-sources-of-truth failure mode this repo has
paid for twice.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/navigation-system.md
git commit -m "docs(design): describe navigation recession as a route-group contract

The document said focused-study flows render outside the nav chrome. The code
had them inside (app), which mounts the column, and no nested layout removed
it. Tasks 1-2 built the mechanism; this makes the document match it, and says
plainly that it is a reconciliation rather than new design.

Also separates (focus)'s hidden-by-default from the planned Collapsed/Icon-rail
state, which are easy to conflate and are not the same thing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The `hero` typography step

Spec §3. One step, four files — and the fourth is the one that gets forgotten.

**Files:**
- Modify: `app/globals.css:142-143`
- Modify: `tailwind.config.ts:91-98`
- Modify: `lib/utils.ts:20`
- Modify: `lib/design-tokens.test.ts:32-35`

**Interfaces:**
- Produces: the Tailwind utility `text-hero` (64px / 68px line-height). Task 6 does not use it; screen
  ports in step 5 do.

- [ ] **Step 1: Write the failing test**

In `lib/design-tokens.test.ts`, extend the typography token list at lines 32-35:

```ts
  "--text-caption", "--text-body", "--text-body-lg", "--text-heading",
  "--text-title", "--text-display", "--text-hero",
  "--leading-caption", "--leading-body", "--leading-body-lg",
  "--leading-heading", "--leading-title", "--leading-display", "--leading-hero",
  "--leading-jp",
```

And add to `lib/utils.test.ts`:

```ts
it("keeps text-hero in the font-size group, not the colour group", () => {
  // Stock tailwind-merge classifies unknown `text-*` as a COLOUR utility and
  // drops it when a real colour follows. A new scale in tailwind.config.ts
  // that is not also registered in lib/utils.ts fails exactly here.
  expect(cn("text-hero", "text-foreground")).toBe("text-hero text-foreground");
});
```

- [ ] **Step 2: Run both and watch them fail**

```bash
npx vitest run lib/design-tokens.test.ts lib/utils.test.ts
```

Expected: FAIL — `--text-hero` is not declared, and `cn("text-hero", "text-foreground")` returns
`"text-foreground"` because `text-hero` was classified as a colour and dropped.

- [ ] **Step 3: Declare the token**

In `app/globals.css`, after the `--text-display` / `--leading-display` pair (lines 142-143):

```css
  /* Editorial hero — the largest headline, and the only step above display.
     Earned by semantic role, not size: the four sites are page-opening <h1>s
     and one pull-quote, all in the display face (spec §3.2). The 62px
     watermark and the 128/150px kanji are larger and deliberately excluded —
     large Japanese glyphs are content presentation, not interface typography. */
  --text-hero: 4rem;
  --leading-hero: 4.25rem;
```

- [ ] **Step 4: Wire the two consumers**

`tailwind.config.ts`, inside `fontSize`:

```ts
        hero: ["var(--text-hero)", "var(--leading-hero)"],
```

`lib/utils.ts`, line 20 — **this is the step that gets skipped**:

```ts
      "font-size": [{ text: ["caption", "body", "body-lg", "heading", "title", "display", "hero"] }],
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run lib/design-tokens.test.ts lib/utils.test.ts
```

Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/utils.ts lib/design-tokens.test.ts lib/utils.test.ts
git commit -m "feat(tokens): add the hero typography step

One step above display, at 4rem. It earns a token on shared semantic role, not
on frequency or size: four page-opening headlines in the display face. The
62px watermark and the 104-150px kanji are larger and excluded on purpose.

Registered in all four places a scale has to be registered, including
lib/utils.ts — without it tailwind-merge reads text-hero as a colour and drops
it silently. lib/utils.test.ts now pins that.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Rule #0 enforcement, and the three sites already violating it

Spec §2, §7.

**Files:**
- Create: `components/ui/token-scale.test.ts`
- Modify: `components/layout/notification-bell.tsx:201`
- Modify: `components/learning/badges-grid.tsx:95`, `:97`

- [ ] **Step 1: Write the failing test**

Create `components/ui/token-scale.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rule #0 (spec §2): pixel values in Figma are not an API. A primitive that
 * hardcodes `text-[12px]` has copied a number instead of mapping a role, and
 * every screen that imitates the primitive inherits the mistake.
 *
 * Only ABSOLUTE literals are forbidden. Arbitrary values that express a
 * relationship are fine and deliberately allowed: CSS custom properties
 * (min-w-[--radix-select-trigger-width]), viewport units (h-[80vh]), calc(),
 * and percentages. The distinction is the whole point of the rule.
 *
 * Exceptions require an inline comment saying why no token can express the
 * value — see spec §7. Deleting this test is not an exception.
 */
const FORBIDDEN = [
  /\btext-\[[\d.]+(px|rem|em)\]/, // text-[12px] → text-caption
  /\b[pm][trblxy]?-\[[\d.]+(px|rem|em)\]/, // p-[10px] → p-sm
  /\bgap(-[xy])?-\[[\d.]+(px|rem|em)\]/, // gap-[6px] → gap-xs
  /\brounded(-[a-z]+)?-\[[\d.]+(px|rem|em)\]/, // rounded-[22px] → rounded-lg
  /\bleading-\[[\d.]+(px|rem|em)\]/, // leading-[18px] → a paired token
  /\bshadow-\[[^\]]*#/, // shadow-[0_0_12px_#FF8A3D] → shadow-raised
];

const uiDir = path.join(process.cwd(), "components/ui");

function collectSources(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSources(fullPath));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(path.relative(uiDir, fullPath));
    }
  }
  return files;
}

describe("Rule #0 — semantic tokens are the API (spec §2)", () => {
  const sources = collectSources(uiDir);

  it("scans a non-empty set of primitives", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("%s hardcodes no absolute px/rem literal", (file) => {
    const text = readFileSync(path.join(uiDir, file), "utf8");
    const hits = FORBIDDEN.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });

  // The three sites outside components/ui that already violated the rule
  // before it existed. Pinned individually so that fixing them cannot silently
  // regress, without widening the scan to all of components/** (spec §7).
  it.each([
    "components/layout/notification-bell.tsx",
    "components/learning/badges-grid.tsx",
  ])("%s uses no arbitrary font size", (file) => {
    const text = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(/\btext-\[[\d.]+(px|rem|em)\]/.test(text)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/ui/token-scale.test.ts
```

Expected: FAIL on the last two cases — `notification-bell.tsx` has `text-[10px]`, `badges-grid.tsx`
has `text-[11px]` twice. The `components/ui/**` cases should already pass; that is the point of
locking them now.

- [ ] **Step 3: Fix the three sites**

`components/layout/notification-bell.tsx:201` — the unread-count badge. `text-[10px]` → `text-caption`
(12px). The badge is `h-4 min-w-4`; a two-digit count at 12px still fits because the pill grows with
`min-w-4` rather than clipping.

```tsx
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-caption font-bold text-danger-foreground",
```

`components/learning/badges-grid.tsx:95` and `:97` — `text-[11px]` → `text-caption` on both.

```tsx
                earnedDate && <p className="text-caption text-muted-foreground">{earnedDate}</p>
```

```tsx
                <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run components/ui/token-scale.test.ts
```

Expected: PASS.

- [ ] **Step 5: Check no snapshot or assertion pinned the old sizes**

```bash
npx vitest run components/layout components/learning
```

Expected: PASS. If a test asserted `text-[10px]`, update the assertion to `text-caption` — the size
changed by 2px on purpose and the test should say so.

- [ ] **Step 6: Commit**

```bash
git add components/ui/token-scale.test.ts components/layout/notification-bell.tsx components/learning/badges-grid.tsx
git commit -m "test(tokens): enforce Rule #0, and fix the three sites that broke it

Forbids absolute px/rem literals in components/ui/**; allows arbitrary values
that express a relationship (CSS vars, vh/vw, calc, %), because those are not
copied pixels.

The three pre-existing violations were all below the caption step: a 10px
notification count and two 11px badge labels. notification-bell.tsx is the
same file that escaped a single-pattern grep on the token branch — this is its
second escape, which is why this ships as a test and not a sweep.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Move the primitives onto the token scales

Spec §4. Eight files. Behaviour-preserving: classes change, APIs and rendered semantics do not.

Reference — the scales these map onto:

```
--space-2xs 4px   xs 8px   sm 12px   md 16px   lg 24px   xl 32px   2xl 48px   3xl 64px
--text-     caption 12   body 14   body-lg 16   heading 20   title 28   display 40   hero 64
```

Three substitutions are not exact. They are rounded on purpose and recorded here so a reviewer does
not read them as mistakes:

| Site | Was | Becomes | Delta |
|---|---|---|---|
| `card.tsx` CardHeader | `space-y-1.5` (6px) | `space-y-xs` (8px) | +2px |
| `card.tsx` CardTitle | `text-lg` (18px) | `text-heading` (20px) | +2px — and `CardTitle` renders an `<h3>`, so the heading step is the semantically right home |
| `badge.tsx` | `py-0.5` (2px) | `py-2xs` (4px) | +2px |

Heights (`h-9`, `h-10`, `h-12`) are **not** touched: there is no height token scale, and inventing
one is out of scope.

**Files:**
- Modify: `components/ui/button.tsx:18-20,37`
- Modify: `components/ui/card.tsx:22,31,41`
- Modify: `components/ui/input.tsx:12`
- Modify: `components/ui/label.tsx:9`
- Modify: `components/ui/badge.tsx:30`
- Modify: `components/ui/dialog.tsx:98,104`
- Modify: `components/ui/toast.tsx:86,93`

`select.tsx` is **already clean** and needs no change here — its `p-2xs` / `py-2xs` are tokens, not
`p-2`. It is in the test's file list to keep it that way.

- [ ] **Step 1: Write the failing test**

Create `components/ui/token-scale-adoption.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec §4: the token scale existed but only five of thirteen primitives used
 * it. button, card and input appear on nearly every screen — if they still
 * read `px-4 py-2 text-sm gap-2` when porting begins, every ported screen
 * copies those numbers by imitation.
 *
 * This pins the fix. It is narrower than Rule #0 (which forbids arbitrary
 * literals): raw Tailwind numeric spacing is legal Tailwind, just not the
 * design system's vocabulary.
 */
// Two things this regex must NOT do, both verified by measurement against the
// current tree:
//   - `p-2xs` / `py-2xs` / `gap-2xs` are TOKENS. A naive /\bp-\d/ matches their
//     "p-2" prefix and reports five clean files as dirty. Hence the trailing
//     (?![\w-]).
//   - `pt-0` is legitimate — zero needs no token, and card.tsx keeps it. Hence
//     the numeric alternation, which accepts 0.5 but not a bare 0.
const RAW = [
  /\b[pm][trblxy]?-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // p-6 / px-3 / py-2 / py-0.5
  /\bgap(-[xy])?-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // gap-2
  /\bspace-[xy]-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // space-y-1.5
  /\btext-(xs|sm|base|lg|xl|\dxl)\b/, // text-sm / text-lg / text-base
];

const FILES = [
  "button.tsx",
  "card.tsx",
  "input.tsx",
  "label.tsx",
  "badge.tsx",
  "dialog.tsx",
  "toast.tsx",
  "select.tsx",
];

describe("primitives use the design system's own scales (spec §4)", () => {
  it.each(FILES)("%s uses no raw Tailwind spacing or font size", (file) => {
    const text = readFileSync(
      path.join(process.cwd(), "components/ui", file),
      "utf8",
    );
    const hits = RAW.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/ui/token-scale-adoption.test.ts
```

Expected: FAIL for `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `dialog.tsx`,
`toast.tsx`. `select.tsx` should already pass.

- [ ] **Step 3: `button.tsx`**

Replace the `sizes` record (lines 17-21):

```tsx
const sizes: Record<Size, string> = {
  sm: "h-9 px-sm text-body",
  md: "h-10 px-md text-body",
  lg: "h-12 px-lg text-body-lg",
};
```

And in `buttonStyles`, line 37, `gap-2` → `gap-xs`:

```tsx
    "inline-flex items-center justify-center gap-xs rounded-md font-medium transition-colors",
```

- [ ] **Step 4: `card.tsx`**

Line 22 (`CardHeader`), line 31 (`CardTitle`), line 41 (`CardContent`):

```tsx
  return <div className={cn("space-y-xs p-lg", className)} {...props} />;
```

```tsx
      className={cn("text-heading font-semibold leading-none tracking-tight", className)}
```

```tsx
  return <div className={cn("p-lg pt-0", className)} {...props} />;
```

- [ ] **Step 5: `input.tsx` and `label.tsx`**

`input.tsx` line 12:

```tsx
        "flex h-10 w-full rounded-md border border-input bg-inputBackground px-sm py-xs text-body",
```

(the `bg-inputBackground` rename is Task 7 — leave it alone here so the two changes stay reviewable
apart.)

`label.tsx` line 9:

```tsx
    <label
      className={cn("text-body font-medium text-foreground", className)}
```

- [ ] **Step 6: `badge.tsx`, `dialog.tsx`, `toast.tsx`**

`badge.tsx` line 30:

```tsx
        "inline-flex items-center rounded-full px-xs py-2xs text-caption font-medium",
```

`dialog.tsx` and `toast.tsx` each have **two** raw values, not one. The close button's `px-1` →
`px-2xs` (`dialog.tsx:98`, `toast.tsx:93`):

```tsx
              className="shrink-0 rounded px-2xs text-muted-foreground hover:bg-secondary hover:text-foreground"
```

…and the description's `mt-1` → `mt-2xs` (`dialog.tsx:104`, `toast.tsx:86`):

```tsx
            <RadixDialog.Description className="mt-2xs text-body text-muted-foreground">
```

```tsx
                <RadixToast.Description className="mt-2xs text-body text-muted-foreground">
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npx vitest run components/ui/
```

Expected: PASS, including `token-scale-adoption.test.ts`, `token-scale.test.ts`,
`logical-properties.test.ts` and every per-primitive suite.

- [ ] **Step 8: Run the full suite — this touches nearly every screen**

```bash
npx tsc --noEmit && npx vitest run && npx playwright test
```

Expected: `tsc` 0 · unit 1969+/1969+ · Playwright 7/7. Any failure here is a test that asserted a
raw class name; update the assertion to the token, and note the pixel delta if it is one of the
three in the table above.

- [ ] **Step 9: Commit**

```bash
git add components/ui
git commit -m "refactor(ui): move the remaining primitives onto the token scales

Five of thirteen primitives used the design system's spacing and typography
scales. The three most-used - button, card, input - used none of them. Ported
screens copy their primitives by imitation, so leaving raw Tailwind in place
would have spread it across 29 screens.

Classes only: no public API and no rendered semantics change. Three
substitutions round by 2px and are listed in the plan rather than hidden -
CardTitle also moves to the heading step, which is where an <h3> belongs.
Heights are untouched; there is no height token and inventing one is not this
plan's job.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `inputBackground` → `input-background`

Spec §4.2 item 4. The CSS variable is already kebab-case (`--input-background`, `globals.css:58`);
only the Tailwind colour key is camelCase, which makes `bg-inputBackground` the single camelCase
utility in a kebab-case codebase.

**Files:**
- Modify: `tailwind.config.ts:34`
- Modify: `components/ui/input.tsx:12`
- Modify: `components/ui/select.tsx:46`
- Modify: `lib/design-tokens.test.ts` (only if it asserts the Tailwind key — it asserts the CSS
  variable, which does not change)

- [ ] **Step 1: Write the failing test**

Append to `components/ui/token-scale-adoption.test.ts`:

```ts
it("uses the kebab-case field-fill utility, not the camelCase outlier", () => {
  for (const file of ["input.tsx", "select.tsx"]) {
    const text = readFileSync(
      path.join(process.cwd(), "components/ui", file),
      "utf8",
    );
    expect(text).not.toContain("bg-inputBackground");
    expect(text).toContain("bg-input-background");
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/ui/token-scale-adoption.test.ts
```

Expected: FAIL — both files still say `bg-inputBackground`.

- [ ] **Step 3: Rename the key and both call sites**

`tailwind.config.ts` line 34:

```ts
        "input-background": "hsl(var(--input-background) / <alpha-value>)",
```

`components/ui/input.tsx` line 12 and `components/ui/select.tsx` line 46: `bg-inputBackground` →
`bg-input-background`.

- [ ] **Step 4: Prove no call site was missed**

```bash
grep -rn "inputBackground" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Expected: no output. A single grep is not an audit, so also check the style guide, which enumerates
tokens for display:

```bash
grep -rn "input" components/style-guide/
```

Expected: only `--input-background` (the CSS variable name), which is unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: PASS · `tsc` 0.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts components/ui
git commit -m "refactor(tokens): rename the inputBackground utility to kebab-case

The CSS variable was already --input-background; only the Tailwind colour key
was camelCase, which made bg-inputBackground the one camelCase utility in a
kebab-case codebase. Two call sites.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Move `requireUser` into `lib/auth/` — OPTIONAL, read the note first

Spec §5.5 justifies this move on the grounds that `requireUser` is "an auth helper used by every
protected layout." **Measured, that rationale does not hold:** the protected layouts use
`getCurrentUser()` from Task 1, and `requireUser` has **22 importers**, all of them in `lib/data/**`,
where it does exactly what its docstring says — "shared by every `lib/data/videos*` module".

So this is a pure tidiness move touching 22 files for no functional gain. **Confirm with the user
before doing it.** If they decline, delete this task; nothing else in the plan depends on it.

**Files:**
- Create: `lib/auth/require-user.ts`
- Modify: `lib/data/videos.ts:30-36` (remove) + 21 importers

- [ ] **Step 1: Move the function**

Create `lib/auth/require-user.ts`:

```ts
import type { createClient } from "@/lib/supabase/server";

/** Resolves the signed-in user for an explicit client, or `null`. Distinct from
 *  `getCurrentUser()`: this one takes the caller's client so a data module can
 *  reuse the client it already built. */
export async function requireUser(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
```

Delete lines 30-36 of `lib/data/videos.ts`.

- [ ] **Step 2: Update every importer in one pass**

```bash
grep -rln "requireUser" lib app components --include="*.ts" --include="*.tsx"
```

Most importers take `requireUser` as the only symbol from that module, so a path substitution covers
them:

```bash
grep -rl 'import { requireUser } from "@/lib/data/videos"' lib app components \
  | xargs sed -i 's|import { requireUser } from "@/lib/data/videos"|import { requireUser } from "@/lib/auth/require-user"|'
```

Then handle the remainder by hand:

```bash
grep -rn "requireUser" lib app components --include="*.ts" --include="*.tsx" | grep "lib/data/videos"
```

Where a file imports `requireUser` **alongside** other symbols from `@/lib/data/videos`, split it
into two import statements. Do not leave a re-export in `videos.ts` — two paths to one function is
the drift this move exists to remove.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: `tsc` 0 · unit all green.

- [ ] **Step 4: Commit**

```bash
git add lib
git commit -m "refactor(auth): move requireUser out of lib/data/videos

It was never a videos concern - 22 modules import it. No re-export shim: two
paths to one function is the drift this removes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Final verification

After the last task:

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
npx playwright test
```

Expected: `tsc` 0 · unit ≥1969 all passing · lint 0 errors with the **same rule mix** as the 77-warning
baseline (`no-non-null-assertion` + `no-unused-vars`; a new rule appearing is a regression even if the
total drops) · build succeeds · Playwright **7/7**.

Then request review with `superpowers:requesting-code-review` for a whole-branch pass. The last four
branches each produced Important findings that no per-task review could see, because each was a
contradiction only visible across files — this branch touches layouts, tokens, primitives and a
governance doc at once, which is exactly that shape.

## Deliberately not in this plan

Shell geometry (spec §8.2) · `components/ui/container.tsx` · the Avatar primitive · widening the
Rule #0 scan to all of `components/**` · the `/videos` → `/shadowing` route rename (Shadowing Hub
Plan C) · the planned Collapsed / Icon-rail nav state · light mode · any of the 29 screens.
