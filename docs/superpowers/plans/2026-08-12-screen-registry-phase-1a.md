# Screen Registry — Phase 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/product/screen-registry.ts` as the single typed source of screen identity, derive `NAV_GROUPS` from it, and prove the derivation reproduces today's navigation **byte-for-byte** — changing nothing a user can see.

**Architecture:** A pure route resolver turns every `app/[locale]/**/page.tsx` into its URL route plus the chrome contract it lives under. A hand-populated registry records one entry per screen (`screenId · kind · impl · route · chrome · navGroup · navOrder` + Figma provenance). `NAV_GROUPS` stops being a literal and becomes a derived view of the registry, guarded by a snapshot frozen **before** any refactor begins.

**Tech Stack:** TypeScript strict · Vitest · Node `fs`/`path` for filesystem-facing tests · no new dependencies.

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-08-08-screen-registry-design.md` and `docs/product/decision-register.md`. **Every task's requirements implicitly include this section.**

- **R8 — zero visual diff.** The derived `NAV_GROUPS` must be **byte-for-byte identical** to the literal running today. If navigation changes during Phase 1a, that is a **defect**, not a cleanup.
- **§5 out of scope, verbatim:** *"Adding, removing, or renaming any screen or route."* · *"Changing any navigation label, order, or grouping."* · *"Any message-catalog edit (R9)."* · *"Any data, component, state, responsive, token, or copy work."* · *"Closing the 44↔56 gap."*
- **⛔ The LOCKED IA (`decision-register.md` §2, A1–A13) MUST NOT be implemented in this phase.** It lands in **Phase 1b** as a separate data-only commit. Phase 1a encodes **today's** navigation. A task that "helpfully" applies the new IA fails R8 and must be rejected in review.
- **R12 — the registry holds no field describing appearance or behaviour.** No copy, no colours, no layout, no data requirements. Adding one makes it a second Figma.
- **R9 — do not touch any message catalog.** `screenId` adopts the existing nav key wherever one exists (`dashboard`, `lessons`, `speaking`, `journey`, …).
- **R7 — no automated Figma verification exists or may be implied.** `figmaCheckedAt` proves only that a human compared an entry at that date.
- **R3 + trim:** `screenId` is kebab-case stable identity. **Five Figma frame names carry leading/trailing whitespace — `screenId` derivation must `trim()` before slugifying**, or `· Kanji library` yields a leading-dash id.
- **Every test MUST be mutation-checked** — break the thing, watch it go red, restore. `L-004`. An assertion nobody has seen fail is not a test; three rounds of Plan C1 shipped assertions that could not fail.
- **`L-002` — never write a derived count into a document or a commit message.** Write the command. (This plan obeys it: entry counts appear nowhere below.)
- **TypeScript strict, lint clean.** `tsc` 0 errors; lint error count unchanged from the pre-branch baseline.

**Baseline to capture before starting** (record the output, do not guess it):

```bash
npx tsc --noEmit ; npm test -- --run 2>&1 | tail -5 ; npx next lint 2>&1 | tail -5
```

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/product/nav-baseline.fixture.ts` | Frozen literal copy of today's `NAV_GROUPS`. Written once, never edited again in 1a | 1 |
| `lib/product/screen-registry-types.ts` | `ScreenKind · ScreenImpl · ScreenChrome · RepoOnlyReason · NavGroupId · ScreenEntry`. **Created in Task 2** because the resolver needs `ScreenChrome` | 2 |
| `lib/product/route-resolver.ts` | Pure: page-file path → `{ route, chrome }`. No registry knowledge | 2 |
| `lib/product/route-resolver.test.ts` | T2b — every shape in spec §3.4's table | 2 |
| `lib/product/screen-registry.ts` | The data. One responsibility, so the ~300-line guidance does not apply (spec §3.2) | 3 |
| `lib/product/screen-registry.test.ts` | T3 · T4 · T5 · T7 · T9 · T10 — pure structural invariants | 3 |
| `lib/product/screen-registry.routes.test.ts` | T1 · T2 · T8 — registry ↔ filesystem | 4 |
| `lib/product/nav-derivation.ts` | Registry → `NAV_GROUPS` shape | 5 |
| `lib/product/nav-derivation.test.ts` | T6 — derived deep-equals the frozen baseline | 5 |
| `components/layout/app-nav.tsx:23` | `NAV_GROUPS` literal → re-export of the derived view | 5 |
| `components/layout/app-nav.test.tsx:156` | The href-resolves guard folds into T1 (spec §4.1) | 5 |

---

### Task 1: Freeze the navigation baseline

**This must be the first commit on the branch.** T6 compares against a snapshot frozen *before* the refactor (spec §7 risk 3: *"Capture the snapshot first, not after"*). Frozen afterwards it would agree with whatever the refactor produced and assert nothing.

**Files:**
- Create: `lib/product/nav-baseline.fixture.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `NAV_BASELINE: readonly { key: string; items: readonly { href: string; key: string }[] }[]` — the exact value `NAV_GROUPS` has today.

- [ ] **Step 1: Copy today's literal into a fixture**

Copy the `NAV_GROUPS` array body from `components/layout/app-nav.tsx:23-71` **verbatim** — same groups, same order, same items, same order within each group. Do not tidy, reorder, or "fix" anything, including the `journey → /journal` row that the LOCKED IA changes in Phase 1b.

```ts
/**
 * Frozen copy of `NAV_GROUPS` as it shipped BEFORE the Phase 1a registry
 * refactor, captured first so T6 (spec R8) compares the derivation against a
 * real baseline rather than against its own output.
 *
 * ⛔ DO NOT EDIT THIS FILE IN PHASE 1a. It is the definition of "zero visual
 * diff". Phase 1b re-freezes it against the LOCKED IA
 * (docs/product/ia-proposal.md §2) as a deliberate, separate commit.
 *
 * `journey` pointing at `/journal` is a known defect the LOCKED IA fixes in
 * Phase 1b (decision-register.md A8). It is preserved here on purpose: 1a
 * proves the engine, 1b changes the product decision.
 */
export const NAV_BASELINE = [
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

- [ ] **Step 2: Prove the fixture equals the live literal**

This is the only moment both values exist independently, so it is the only moment the copy can be verified. Create the assertion inside `lib/product/nav-derivation.test.ts` (the file Task 5 fills out):

```ts
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/layout/app-nav";
import { NAV_BASELINE } from "./nav-baseline.fixture";

describe("nav baseline fixture", () => {
  it("is a faithful copy of the literal shipping today", () => {
    expect(NAV_BASELINE).toEqual(NAV_GROUPS);
  });
});
```

- [ ] **Step 3: Run it — it must PASS immediately**

Run: `npx vitest run lib/product/nav-derivation.test.ts`
Expected: **PASS**. A failure here means the copy is wrong; fix the fixture, never `app-nav.tsx`.

- [ ] **Step 4: Mutation-check it**

Change one `href` in the fixture (e.g. `/dashboard` → `/dashboardX`), re-run, confirm **FAIL**, then restore and confirm **PASS**. Record both outputs in the commit message.

- [ ] **Step 5: Commit**

```bash
git add lib/product/nav-baseline.fixture.ts lib/product/nav-derivation.test.ts
git commit -m "test(registry): freeze the nav baseline before the Phase 1a refactor"
```

---

### Task 2: Registry types + the route resolver (T2b)

**Files:**
- Create: `lib/product/screen-registry-types.ts`
- Create: `lib/product/route-resolver.ts`
- Test: `lib/product/route-resolver.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Every type in spec §3.1: `ScreenKind · ScreenImpl · ScreenChrome · RepoOnlyReason · NavGroupId · ScreenEntry`. **The types ship here, not in Task 3**, because the resolver's return type needs `ScreenChrome` and a task may not import from a file a later task creates.
  - `resolvePageRoute(relativePath: string): { route: string; chrome: ScreenChrome | null }`
  - `relativePath` is POSIX-style, relative to the repo root, e.g. `app/[locale]/(protected)/(app)/kanji/[id]/page.tsx`.
  - `listPageRoutes(rootDir: string): { route: string; chrome: ScreenChrome | null; file: string }[]` — globs `app/[locale]/**/page.tsx` and resolves each.

- [ ] **Step 1: Write the types**

Copy from spec §3.1 exactly — do not add fields (R12), do not widen enums.

```ts
export type ScreenKind = "screen" | "state-variant" | "deprecated" | "repo-only";
export type ScreenImpl = "built" | "placeholder" | "none";
export type ScreenChrome = "app" | "focus" | "immersive" | "admin" | "auth" | "marketing";
export type RepoOnlyReason = "out-of-design-scope" | "legacy-unreviewed";

/** Today's five groups. Phase 1b replaces this union with the LOCKED IA's. */
export type NavGroupId = "learn" | "study" | "insights" | "progress" | "account";

export interface ScreenEntry {
  /** Stable product identity (R3). kebab-case. The join key for every other artifact. */
  screenId: string;
  /** The Figma frame name, for humans. Display only — never a key (R3). */
  name: string;
  kind: ScreenKind;
  /** Required when kind === 'state-variant', null otherwise (R11). */
  variantOf: string | null;
  /** Null only when kind === 'repo-only' (R6). */
  figmaNodeId: string | null;
  /** Required when kind === 'repo-only', null otherwise (R13). */
  repoOnlyReason: RepoOnlyReason | null;
  /** ISO date of the last human Figma↔registry comparison (R7). */
  figmaCheckedAt: string | null;
  /** Next.js route incl. dynamic segments. Null = designed, no route yet (R5). */
  route: string | null;
  chrome: ScreenChrome | null;
  impl: ScreenImpl;
  navGroup: NavGroupId | null;
  navOrder: number | null;
}
```

**The rule, and why it has no rules of its own to get wrong (spec §3.4):** drop `app/[locale]`, drop every `(group)` segment, drop the trailing `/page.tsx`. That *is* the Next.js rule. `[id]` survives untouched because it is an ordinary segment. `chrome` is **read from** the groups that were dropped — never used to rebuild them, which is what makes T8 a real check instead of a tautology.

- [ ] **Step 2: Write the failing test — every shape in spec §3.4's table**

```ts
import { describe, expect, it } from "vitest";
import { resolvePageRoute } from "./route-resolver";

const P = "app/[locale]";

describe("resolvePageRoute", () => {
  it.each([
    ["static, one segment", `${P}/(protected)/(app)/dashboard/page.tsx`, "/dashboard", "app"],
    ["static, nested", `${P}/(protected)/(app)/community/peer-review/page.tsx`, "/community/peer-review", "app"],
    ["one dynamic segment", `${P}/(protected)/(app)/kanji/[id]/page.tsx`, "/kanji/[id]", "app"],
    ["static AFTER dynamic", `${P}/(protected)/(focus)/shadowing/[id]/dictation/page.tsx`, "/shadowing/[id]/dictation", "focus"],
    ["two dynamic segments (no repo counterpart)", `${P}/(protected)/(app)/a/[x]/b/[y]/page.tsx`, "/a/[x]/b/[y]", "app"],
    ["immersive chrome", `${P}/(protected)/(immersive)/journal/page.tsx`, "/journal", "immersive"],
    ["admin chrome", `${P}/(admin)/admin/style-guide/page.tsx`, "/admin/style-guide", "admin"],
    ["auth chrome", `${P}/(auth)/login/page.tsx`, "/login", "auth"],
  ])("%s", (_name, file, route, chrome) => {
    expect(resolvePageRoute(file)).toEqual({ route, chrome });
  });

  it("collapses a root-level group to the index route, not to an empty string", () => {
    // The `(marketing)` case. "" is the bug this pins.
    expect(resolvePageRoute(`${P}/(marketing)/page.tsx`)).toEqual({
      route: "/",
      chrome: "marketing",
    });
  });

  it("collapses two nested groups to nothing", () => {
    expect(resolvePageRoute(`${P}/(protected)/(app)/review/page.tsx`).route).toBe("/review");
  });

  it("reports null chrome when no known chrome group is present", () => {
    expect(resolvePageRoute(`${P}/something/page.tsx`).chrome).toBeNull();
  });

  it("accepts Windows-style separators", () => {
    // Glob results on win32 arrive backslashed; the resolver must not care.
    expect(resolvePageRoute(`app\\[locale]\\(protected)\\(app)\\vocab\\page.tsx`).route).toBe("/vocab");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/product/route-resolver.test.ts`
Expected: FAIL — `Failed to resolve import "./route-resolver"`.

- [ ] **Step 4: Write the implementation**

```ts
import { readdirSync } from "node:fs";
import path from "node:path";
import type { ScreenChrome } from "./screen-registry-types";

const CHROME_GROUPS: Record<string, ScreenChrome> = {
  "(app)": "app",
  "(focus)": "focus",
  "(immersive)": "immersive",
  "(admin)": "admin",
  "(auth)": "auth",
  "(marketing)": "marketing",
};

const isGroup = (segment: string) => segment.startsWith("(") && segment.endsWith(")");

/**
 * page-file path → URL route + the chrome contract it sits under.
 *
 * The transformation is exactly Next.js's own rule (spec §3.4): drop
 * `app/[locale]`, drop every `(group)`, drop the trailing `page.tsx`. Dynamic
 * segments need no special case — `[id]` is an ordinary path segment and
 * survives untouched.
 *
 * `chrome` is READ FROM the dropped groups. Never reconstruct a file path from
 * `route` + `chrome`: that direction encodes an assumption about how groups
 * nest and breaks the moment one moves — and it would make T8 a tautology.
 */
export function resolvePageRoute(relativePath: string): {
  route: string;
  chrome: ScreenChrome | null;
} {
  const segments = relativePath.replace(/\\/g, "/").split("/");

  const start = segments.indexOf("[locale]");
  const afterLocale = start === -1 ? segments : segments.slice(start + 1);

  const withoutPage = afterLocale.filter(
    (segment) => segment !== "page.tsx" && segment !== "",
  );

  let chrome: ScreenChrome | null = null;
  const routeSegments: string[] = [];
  for (const segment of withoutPage) {
    if (isGroup(segment)) {
      // Last chrome group wins: `(protected)/(app)` is chrome `app`, and
      // `(protected)` is a session boundary that names no chrome of its own.
      chrome = CHROME_GROUPS[segment] ?? chrome;
      continue;
    }
    routeSegments.push(segment);
  }

  // A group at the root leaves zero segments — that is the index route `/`,
  // never the empty string.
  return { route: `/${routeSegments.join("/")}`.replace(/\/$/, "") || "/", chrome };
}

/** Recursive walk, not a glob — see the warning below. Returns repo-relative
 *  POSIX-ish paths, which is what `resolvePageRoute` expects. */
function walkPages(dir: string, rootDir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPages(full, rootDir, out);
    else if (entry.name === "page.tsx") out.push(path.relative(rootDir, full));
  }
  return out;
}

export function listPageRoutes(rootDir: string) {
  return walkPages(path.join(rootDir, "app"), rootDir)
    .map((file) => ({ file, ...resolvePageRoute(file) }))
    .sort((a, b) => a.route.localeCompare(b.route));
}
```

> ⚠️⚠️ **Do NOT use `fs.globSync` here, and do not "simplify" this walk back into one.** Two independent reasons, both measured:
>
> 1. **The obvious pattern silently matches nothing.** `globSync("app/[locale]/**/page.tsx")` returns **0 files** — glob reads `[locale]` as a character class, not a literal directory name. Escaping it (`app/[[]locale[]]/**/page.tsx`) returns 44. **A resolver that returns `[]` makes Task 4's T1 compare an empty set and pass while asserting nothing** — the exact failure `L-004` exists for, and one this repo has already shipped three times.
> 2. **Version floor.** `fs.globSync` landed in Node 22. This repo pins `@types/node@^20` and declares no `engines` field, so `tsc` does not even know the function exists (forcing a `declare module` augmentation) and it crashes outright on Node 20.
>
> The `readdirSync` walk has neither problem: no augmentation, no dependency, no version floor. Import `readdirSync` from `node:fs` and `path` from `node:path`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/product/route-resolver.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Mutation-check the two cases that matter**

1. Delete the `|| "/"` fallback → the `(marketing)` root case must FAIL. Restore.
2. Change `chrome = CHROME_GROUPS[segment] ?? chrome` to `chrome = CHROME_GROUPS[segment] ?? null` → the `(protected)/(app)` cases must FAIL (`(app)` is last, so this one survives — instead reorder to prove it: assert `(protected)` alone yields `null`). Restore.

- [ ] **Step 7: Commit**

```bash
git add lib/product/screen-registry-types.ts lib/product/route-resolver.ts lib/product/route-resolver.test.ts
git commit -m "feat(registry): registry types + route resolver (T2b)"
```

---

### Task 3: Registry data and structural invariants (T3 · T4 · T5 · T7 · T9 · T10)

**Files:**
- Create: `lib/product/screen-registry.ts`
- Test: `lib/product/screen-registry.test.ts`

**Interfaces:**
- Consumes: every type from `lib/product/screen-registry-types.ts` (Task 2).
- Produces: `SCREEN_REGISTRY: readonly ScreenEntry[]`. Task 4 and Task 5 both import it.

- [ ] **Step 1: Write the failing invariant tests**

```ts
import { describe, expect, it } from "vitest";
import { SCREEN_REGISTRY } from "./screen-registry";

describe("screen registry invariants", () => {
  it("T3: figmaNodeId is present iff the entry is not repo-only", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.figmaNodeId, entry.screenId).toBeNull();
      } else {
        expect(entry.figmaNodeId, entry.screenId).not.toBeNull();
      }
    }
  });

  it("T4: variantOf is present iff state-variant, and names a real screen", () => {
    const screens = new Set(
      SCREEN_REGISTRY.filter((e) => e.kind === "screen").map((e) => e.screenId),
    );
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "state-variant") {
        expect(entry.variantOf, entry.screenId).not.toBeNull();
        expect(screens, entry.screenId).toContain(entry.variantOf);
      } else {
        expect(entry.variantOf, entry.screenId).toBeNull();
      }
    }
  });

  it("T5: screenId is unique, and route is unique among non-null routes", () => {
    const ids = SCREEN_REGISTRY.map((e) => e.screenId);
    expect(new Set(ids).size).toBe(ids.length);

    const routes = SCREEN_REGISTRY.map((e) => e.route).filter(
      (r): r is string => r !== null,
    );
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("T7: a nav entry has a navOrder, unique within its group", () => {
    const byGroup = new Map<string, number[]>();
    for (const entry of SCREEN_REGISTRY) {
      if (entry.navGroup === null) {
        expect(entry.navOrder, entry.screenId).toBeNull();
        continue;
      }
      expect(entry.navOrder, entry.screenId).not.toBeNull();
      const orders = byGroup.get(entry.navGroup) ?? [];
      orders.push(entry.navOrder as number);
      byGroup.set(entry.navGroup, orders);
    }
    for (const [group, orders] of byGroup) {
      expect(new Set(orders).size, group).toBe(orders.length);
    }
  });

  it("T9: repoOnlyReason is present iff the entry is repo-only", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.repoOnlyReason, entry.screenId).not.toBeNull();
      } else {
        expect(entry.repoOnlyReason, entry.screenId).toBeNull();
      }
    }
  });

  it("T10: out-of-design-scope is restricted to admin chrome", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.repoOnlyReason === "out-of-design-scope") {
        expect(entry.chrome, entry.screenId).toBe("admin");
      }
    }
  });

  it("R12: no entry carries an appearance or behaviour field", () => {
    // The concrete guard on R1. If someone adds `copy`, `layout`, `colors` or
    // `dataNeeds`, the registry has started becoming a second Figma.
    const ALLOWED = new Set([
      "screenId", "name", "kind", "variantOf", "figmaNodeId", "repoOnlyReason",
      "figmaCheckedAt", "route", "chrome", "impl", "navGroup", "navOrder",
    ]);
    for (const entry of SCREEN_REGISTRY) {
      for (const key of Object.keys(entry)) {
        expect(ALLOWED, `${entry.screenId}.${key}`).toContain(key);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/product/screen-registry.test.ts`
Expected: FAIL — `Failed to resolve import "./screen-registry"`.

- [ ] **Step 3: Populate the registry**

**Authorities, in this order. Do not invent an entry from memory.**

| Source | Gives |
|---|---|
| `docs/product/figma-frame-map.md` | frame name → `figmaNodeId`, all 57, post-rename and verified |
| `docs/product/screen-inventory.md` Part II §6–§20 | `kind` per frame — every heading is tagged `CONFIRMED screen` / `STATE-VARIANT` / `interaction` / `MODAL` / `component` |
| `listPageRoutes(process.cwd())` from Task 2 | the authoritative `route` + `chrome` set |
| `components/layout/app-nav.tsx:23` | `navGroup` + `navOrder` — **today's**, in today's order |

Run these to produce the working set:

```bash
grep -nE '^### .*`CONFIRMED` screen' docs/product/screen-inventory.md
grep -nE '^### .*(STATE-VARIANT|interaction|MODAL|NOT screens|component)' docs/product/screen-inventory.md
node -e "const{readdirSync}=require('node:fs'),p=require('node:path');(function w(d){for(const e of readdirSync(d,{withFileTypes:true}))e.isDirectory()?w(p.join(d,e.name)):e.name==='page.tsx'&&console.log(p.join(d,e.name))})('app')"
```

**Population rules:**

1. **A frame tagged `interaction`, `MODAL`, `component`, or `NOT screens` gets NO entry.** They are not screens (R11 for state-variants; §4 of the IA proposal for the rest). Only `screen` and `STATE-VARIANT` frames become entries.
2. **`screenId` = the existing nav key where one exists** (R9): `dashboard`, `lessons`, `kanji`, `vocab`, `grammar`, `reading`, `speaking`, `jlpt`, `review`, `mining`, `playlists`, `challenges`, `community`, `leaderboard`, `sensei`, `roadmap`, `weeklyReport`, `journey`, `statistics`, `achievements`, `profile`, `settings`. **These 22 strings are fixed — do not re-derive them from frame names.**
3. **Everything else: `screenId` = `slugify(name.trim())`.** The `trim()` is mandatory — five frame names carry invisible whitespace.
4. **`impl`**: `built` if the route renders the real screen; `placeholder` if it renders `UpcomingScreen`; `none` if there is no `page.tsx`. Verify `placeholder` by grepping: `grep -rln "UpcomingScreen" app/`.
5. **`figmaCheckedAt`**: `"2026-08-12"` for every entry sourced from the Phase 0 inventory — that pass genuinely compared them (R7).
6. **`repo-only`**: a route with no frame. `repoOnlyReason: "out-of-design-scope"` **only** for `chrome: "admin"`; everything else `"legacy-unreviewed"` (R13). `/jlpt-test` is an 8-line dead `redirect()` superseded in Layer 5 — record it `kind: "deprecated"` with `figmaNodeId: null`… ⚠️ **which T3 forbids.** Resolve it as `kind: "repo-only"` + `repoOnlyReason: "legacy-unreviewed"` and note the deprecation in `name`; raise the `deprecated`-without-a-frame gap as a **Phase 2 spec question**, do not amend T3 here.

**Worked examples covering each shape — copy the style exactly:**

```ts
import type { ScreenEntry } from "./screen-registry-types";

export const SCREEN_REGISTRY: readonly ScreenEntry[] = [
  // A nav destination, designed and built.
  {
    screenId: "dashboard",
    name: "Homepage",           // ⚠️ the frame's name; the SCREEN is the Dashboard
    kind: "screen",
    variantOf: null,
    figmaNodeId: "111:515",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/dashboard",
    chrome: "app",
    impl: "built",
    navGroup: "learn",
    navOrder: 1,
  },
  // A nav destination that is an honest placeholder (Plan C1).
  {
    screenId: "roadmap",
    name: "Roadmap",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "64:2061",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/roadmap",
    chrome: "app",
    impl: "placeholder",
    navGroup: "insights",
    navOrder: 2,
  },
  // Designed, no route yet (R5) — legal and meaningful, NOT an error.
  {
    screenId: "pricing",
    name: "Pricing",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "74:564",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
  },
  // A state of another screen (R11) — never promoted to a screen.
  {
    screenId: "explore-lessons-with-preview",
    name: "Explore Lessons (with preview)",
    kind: "state-variant",
    variantOf: "explore-lessons",
    figmaNodeId: "200:10726",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
  },
  // Built, no frame at this pass (R6) — named debt for Phase 2 (R13).
  {
    screenId: "playlists",
    name: "Playlists",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "legacy-unreviewed",
    figmaCheckedAt: null,
    route: "/playlists",
    chrome: "app",
    impl: "built",
    navGroup: "study",
    navOrder: 3,
  },
  // Tooling Figma will never cover — the ONLY legal use of out-of-design-scope (R13/T10).
  {
    screenId: "admin-style-guide",
    name: "Admin — Style Guide",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/admin/style-guide",
    chrome: "admin",
    impl: "built",
    navGroup: null,
    navOrder: null,
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/product/screen-registry.test.ts`
Expected: PASS. Fix **data**, never a test, until green.

- [ ] **Step 5: Mutation-check all seven**

One at a time, restoring after each — for each, confirm the named test goes red and the others stay green:

| Mutation | Must break |
|---|---|
| Give any `repo-only` entry a `figmaNodeId` | T3 |
| Point a `state-variant`'s `variantOf` at a `state-variant` | T4 |
| Duplicate a `screenId` | T5 |
| Give two entries in one group the same `navOrder` | T7 |
| Null a `repo-only` entry's `repoOnlyReason` | T9 |
| Set `out-of-design-scope` on a non-admin entry | T10 |
| Add `copy: "hello"` to any entry | R12 guard |

- [ ] **Step 6: Commit**

```bash
git add lib/product/screen-registry.ts lib/product/screen-registry.test.ts
git commit -m "feat(registry): typed screen registry + structural invariants (T3,T4,T5,T7,T9,T10)"
```

---

### Task 4: Registry ↔ filesystem completeness (T1 · T2 · T8)

**Files:**
- Test: `lib/product/screen-registry.routes.test.ts`

**Interfaces:**
- Consumes: `listPageRoutes` (Task 2), `SCREEN_REGISTRY` (Task 3).
- Produces: nothing importable — this task is assertions only.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { listPageRoutes } from "./route-resolver";
import { SCREEN_REGISTRY } from "./screen-registry";

const derived = listPageRoutes(process.cwd());
const derivedRoutes = new Set(derived.map((r) => r.route));
const byRoute = new Map(
  SCREEN_REGISTRY.filter((e) => e.route !== null).map((e) => [e.route as string, e]),
);

describe("registry ↔ repo routes", () => {
  it("T1: every page.tsx in the repo has exactly one registry entry", () => {
    const orphans = [...derivedRoutes].filter((route) => !byRoute.has(route));
    expect(orphans).toEqual([]);
  });

  it("T2: every entry claiming built/placeholder resolves to a real page.tsx", () => {
    // `impl: 'built'` is never taken on trust (spec §3.4).
    const lying = SCREEN_REGISTRY.filter(
      (e) => e.route !== null && e.impl !== "none" && !derivedRoutes.has(e.route),
    ).map((e) => e.screenId);
    expect(lying).toEqual([]);
  });

  it("T8: chrome matches the route groups actually dropped from the file path", () => {
    // Catches a screen moved between chrome contracts. Entries with no page
    // are exempt — they have nothing to disagree with.
    const mismatched = derived
      .filter((r) => {
        const entry = byRoute.get(r.route);
        return entry !== undefined && entry.chrome !== r.chrome;
      })
      .map((r) => r.route);
    expect(mismatched).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/product/screen-registry.routes.test.ts`
Expected: **FAIL on T1** with a non-empty orphan list, unless Task 3 populated every route. **The orphan list is the work item** — add an entry per orphan, then re-run.

- [ ] **Step 3: Close the gaps by editing the registry only**

Add one entry per orphaned route. **Never** widen a test or delete a `page.tsx` to make this pass — that is out of scope per the Global Constraints.

- [ ] **Step 4: Run to verify all three pass**

Run: `npx vitest run lib/product/screen-registry.routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Mutation-check**

| Mutation | Must break |
|---|---|
| Delete any entry whose `route` is non-null and built | T1 |
| Change a built entry's `route` to `/nope` | T2 |
| Flip a `(focus)` entry's `chrome` to `"app"` | T8 |

⚠️ **T8's mutation check is the one most likely to silently pass.** If flipping a chrome value does not turn it red, the test is comparing a value against itself — re-read `resolvePageRoute` and confirm `chrome` is read from the path, not from the registry.

- [ ] **Step 6: Commit**

```bash
git add lib/product/screen-registry.routes.test.ts lib/product/screen-registry.ts
git commit -m "test(registry): registry-to-filesystem completeness (T1,T2,T8)"
```

---

### Task 5: Derive `NAV_GROUPS` (T6) and retire the literal

**The task R8 exists for.** Nothing a user can see may change.

**Files:**
- Create: `lib/product/nav-derivation.ts`
- Modify: `lib/product/nav-derivation.test.ts` (Task 1 created it)
- Modify: `components/layout/app-nav.tsx:23-71`
- Modify: `components/layout/app-nav.test.tsx:156-168`

**Interfaces:**
- Consumes: `SCREEN_REGISTRY` (Task 3), `NAV_BASELINE` (Task 1).
- Produces: `deriveNavGroups(registry: readonly ScreenEntry[]): NavGroup[]` where `NavGroup = { key: NavGroupId; items: { href: string; key: string }[] }`.

- [ ] **Step 1: Write the failing T6 test**

Append to `lib/product/nav-derivation.test.ts`, keeping Task 1's fixture-fidelity test above it:

```ts
import { deriveNavGroups } from "./nav-derivation";
import { SCREEN_REGISTRY } from "./screen-registry";

describe("T6: derived NAV_GROUPS reproduces today's literal exactly", () => {
  it("deep-equals the frozen baseline (R8, zero visual diff)", () => {
    expect(deriveNavGroups(SCREEN_REGISTRY)).toEqual(NAV_BASELINE);
  });

  it("preserves group order, not just membership", () => {
    expect(deriveNavGroups(SCREEN_REGISTRY).map((g) => g.key)).toEqual(
      NAV_BASELINE.map((g) => g.key),
    );
  });

  it("preserves item order within every group", () => {
    const derived = deriveNavGroups(SCREEN_REGISTRY);
    for (const [index, group] of NAV_BASELINE.entries()) {
      expect(derived[index].items.map((i) => i.key), group.key).toEqual(
        group.items.map((i) => i.key),
      );
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/product/nav-derivation.test.ts`
Expected: FAIL — `Failed to resolve import "./nav-derivation"`.

- [ ] **Step 3: Write the derivation**

```ts
import type { NavGroupId, ScreenEntry } from "./screen-registry-types";

/** Group order is IA, not data — the registry stores membership and order
 *  within a group, never the order OF groups. Phase 1b edits this array when
 *  the LOCKED IA's five groups replace today's. */
const GROUP_ORDER: readonly NavGroupId[] = [
  "learn",
  "study",
  "insights",
  "progress",
  "account",
];

export type NavGroup = {
  key: NavGroupId;
  items: { href: string; key: string }[];
};

/**
 * Registry → the shape `app-nav.tsx` renders (R4). The registry owns nav
 * membership and order; `app-nav.tsx` keeps presentation (label key lookup,
 * icons, active state).
 *
 * `key` is the screenId: R9 makes them the same string for every nav
 * destination, which is what lets this land without touching a message
 * catalog.
 */
export function deriveNavGroups(registry: readonly ScreenEntry[]): NavGroup[] {
  return GROUP_ORDER.map((key) => ({
    key,
    items: registry
      .filter((entry) => entry.navGroup === key && entry.route !== null)
      .sort((a, b) => (a.navOrder as number) - (b.navOrder as number))
      .map((entry) => ({ href: entry.route as string, key: entry.screenId })),
  }));
}
```

> ⚠️ **`weeklyReport` is camelCase while every other nav key is a single lowercase word.** R9 requires adopting the existing key, so its `screenId` is `weeklyReport` — **not** `weekly-report` — even though R3 says kebab-case. Record this as the one deliberate exception in a comment on that entry; changing it would need a message-catalog edit, which R9 forbids in Phase 1.

- [ ] **Step 4: Run to verify T6 passes**

Run: `npx vitest run lib/product/nav-derivation.test.ts`
Expected: PASS. If it fails, the **registry data** is wrong — fix `navOrder`/`navGroup`, never `NAV_BASELINE`.

- [ ] **Step 5: Replace the literal in `app-nav.tsx`**

Delete the `NAV_GROUPS` array at `components/layout/app-nav.tsx:23-71` and replace it with the derived export. Keep `NAV_ITEMS` exactly as it is — it already re-derives from `NAV_GROUPS`, which is the precedent R4 builds on.

```ts
import { deriveNavGroups } from "@/lib/product/nav-derivation";
import { SCREEN_REGISTRY } from "@/lib/product/screen-registry";

/**
 * Derived from the screen registry (R4) — no longer a literal. The registry
 * owns nav membership and order; this file owns presentation.
 *
 * Phase 1a proved this derivation reproduces the previous literal byte-for-byte
 * (T6 vs lib/product/nav-baseline.fixture.ts). Changing navigation means
 * editing the registry, not this file.
 */
export const NAV_GROUPS = deriveNavGroups(SCREEN_REGISTRY);

/** Flat view kept for the catalog-parity test; no production consumer today. */
export const NAV_ITEMS = NAV_GROUPS.map((group) => group.items).flat();
```

- [ ] **Step 6: Run the full nav suite — it must be untouched-green**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: **PASS, with zero edits to that file so far.** Every existing assertion — `expectedCounts` (learn 8, study 6, insights 3, progress 3, account 2), `NAV_ITEMS` length 22, the five group headings in order, `journey → /en/journal`, `lessons → /en/shadowing` — must still pass.

⚠️ **This is the real acceptance gate for Phase 1a.** If any of these fail, the derivation is wrong. **Do not adjust the expectations to match.**

- [ ] **Step 7: Restore the label-exhaustiveness guarantee the refactor weakens**

⚠️ **A type-precision loss the derivation causes, found in the pre-flight scan.** Today `NAV_GROUPS` is a `const` literal, so `(typeof NAV_ITEMS)[number]["key"]` is a union of 22 string literals, and `app-nav.test.tsx:28`'s `EXPECTED_LABELS: Record<(typeof NAV_ITEMS)[number]["key"], string>` is **exhaustive** — omit a label and `tsc` fails.

After Task 5 Step 5, `deriveNavGroups` returns `{ href: string; key: string }[]`, so that type widens to `Record<string, string>` and the compile-time exhaustiveness is gone. `expectedCounts` and `EXPECTED_GROUP_LABELS` are unaffected — they key off `NavGroupId`, which stays a union.

Do **not** fix this with `as const satisfies` gymnastics on the registry; that fights the derivation for little gain. Restore the guarantee as a runtime assertion instead — add to `components/layout/app-nav.test.tsx`:

```ts
  it("has a pinned label for every nav destination", () => {
    // Restores the exhaustiveness that `NAV_GROUPS`-as-a-literal used to give
    // at compile time. Once NAV_GROUPS is derived from the registry, the key
    // type widens to `string`, so a missing EXPECTED_LABELS entry would no
    // longer be a tsc error — this makes it a test failure instead.
    const missing = NAV_ITEMS.filter((item) => !(item.key in EXPECTED_LABELS));
    expect(missing).toEqual([]);
  });
```

Mutation-check it: delete one key from `EXPECTED_LABELS`, confirm **FAIL**, restore.

- [ ] **Step 8: Fold the old href guard into T1**

`components/layout/app-nav.test.tsx:156-168` (`"points every nav href at a route that exists"`) hardcodes only `(app)` and `(immersive)` candidate paths. T1 now covers this properly for every route and every chrome group (spec §4.1: *"should be folded in, not duplicated"*). Delete that `it(...)` block and replace it with a pointer:

```ts
  // The href-resolves guard moved to lib/product/screen-registry.routes.test.ts
  // (T1), which checks EVERY page.tsx against the registry rather than only
  // nav hrefs under (app)/(immersive). Spec §4.1: folded in, not duplicated.
```

- [ ] **Step 9: Verify the whole suite and the types**

```bash
npx tsc --noEmit && npx vitest run && npx next lint
```
Expected: `tsc` 0 errors · every test green · lint error count equal to the Global Constraints baseline.

- [ ] **Step 10: Mutation-check T6 — the most important one in the plan**

Change one registry entry's `navOrder` so two rows swap within a group. **T6 must go red**, and so must `app-nav.test.tsx`'s group-order assertions. Restore, confirm green. If T6 stays green while rows move, R8 is not actually enforced and Phase 1a has failed its one job.

- [ ] **Step 11: Commit**

```bash
git add lib/product/nav-derivation.ts lib/product/nav-derivation.test.ts components/layout/app-nav.tsx components/layout/app-nav.test.tsx
git commit -m "refactor(nav): derive NAV_GROUPS from the screen registry (R4, T6)"
```

---

## Acceptance for Phase 1a

Per spec §5, and **all four must be shown, not asserted** (`superpowers:verification-before-completion`):

1. **T1–T10 and T2b pass, each mutation-checked.** Paste the red-then-green output.
2. **Zero visual diff.** `components/layout/app-nav.test.tsx` passes with no expectation edited. T6 is the machine-checkable form.
3. **`tsc` 0 errors; lint error count unchanged** from the baseline captured in Global Constraints.
4. **Every registry entry sourced from Figma carries `figmaCheckedAt: "2026-08-12"`.**

**Then STOP.** Phase 1b is a separate plan and a separate review. Do not begin it, and do not "while I'm here" apply any part of the LOCKED IA.

---

## Out of scope — reject these in review

- Applying A1–A13 (the LOCKED IA). **Phase 1b.**
- Renaming `/jlpt` → `/certification`. Carries a migration. **Phase 2.**
- Removing `/vocab`, `/reading`, `/community`, `/leaderboard` nav rows. **Phase 1b.**
- Creating `/companion` or `/pronunciation` routes. **Phase 1b/2.**
- Any message-catalog edit (R9), including fixing `weeklyReport`'s casing.
- Any component, token, copy, or responsive work.
- Adding a registry field for purpose, entry points, actions, or data needs — **explicitly forbidden** (R12), and the user has named "the product ontology system" as the thing this must not become.
