# L9a Plan 1 of 3 — Localization Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the localization capability (`lib/i18n/**`) and move the app under `app/[locale]/`, so every route is locale-prefixed and every navigation is locale-aware — **with zero change to what a user sees**, and without opening the auth hole that locale prefixes would otherwise create.

**Architecture:** `next-intl` v4 sits entirely below a foundation boundary. Feature code imports only `@/lib/i18n/*`; ESLint physically prevents it from reaching past that to `next-intl`, `next/link`, or the locale-sensitive half of `next/navigation`. Middleware composes `next-intl`'s routing with the existing Supabase `updateSession`, and route protection is re-expressed against a **locale-stripped** pathname. All UI text stays hardcoded English in this plan — extraction is Plan 3.

**Tech Stack:** Next.js 14.2.35 (App Router, pinned — do NOT bump), React 18.3.1, TypeScript 5.6 strict, `next-intl` 4.13.2 (peer-supports Next 14 + React 18 — verified 2026-07-17), Vitest + RTL, Playwright, ESLint 8.57.

**Spec:** `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`. Read §0 (North Star, Ownership, Non-goals) and §2 (Principles) before starting.

**Plan split (spec §4.5 — two independent capabilities):**
- **Plan 1 (this doc)** — Localization architecture. Spec Phase 1.
- **Plan 2** — Design system (tokens → semantic → primitives → style guide). Depends on Plan 1.
- **Plan 3** — String extraction (Phase 2) + Vietnamese (Phase 3). Depends on Plan 1.

## Global Constraints

- **Next.js stays on 14.2.35.** Do not bump. `next-intl@4.13.2` supports it. (`mem:project_status` — "don't silently bump".)
- **Zero user-visible change in this plan.** All UI text stays hardcoded English. If a diff changes what a user reads, it belongs to Plan 3.
- **No schema change, no migration.** Locale lives in the URL + `NEXT_LOCALE` cookie only (spec D5).
- **No learning-content localization** (spec D8). Kanji/vocab/grammar/JLPT/reading/transcripts stay VN for every locale.
- **The full regression suite must be green at every commit** (spec P9). Baseline: **1190 unit tests passing.**
- **Feature code must never import** `next-intl`, `next/link`, or `redirect`/`useRouter`/`usePathname` from `next/navigation`. Only `lib/i18n/**` may (spec P1, P2).
- **Every lint rule ships with a test proving it fires** on a violation — not merely that it exists (spec §2.9; Spec A's standard).
- **TypeScript strict.** No `any` without a justifying comment (`CLAUDE.md` §6).
- **Commit after every task.** Standing permission granted; never push without an explicit ask.
- **If reality contradicts this plan, reality wins.** Report it, fix the plan, do not force the code to match. (Spec Status line; Spec A's hardest-won lesson.)

---

## File Structure

**Created:**
- `lib/i18n/routing.ts` — the single source of truth for the locale list + routing policy.
- `lib/i18n/namespaces.ts` — the catalog namespace tuple.
- `lib/i18n/navigation.ts` — locale-aware `Link`/`redirect`/`useRouter`/`usePathname`.
- `lib/i18n/request.ts` — per-request config; merges per-namespace catalogs.
- `lib/i18n/locale-path.ts` — `stripLocale()`; pure.
- `lib/i18n/index.ts` — the public contract (barrel).
- `lib/i18n/catalog.test.ts` — parity across locales + namespace list matches disk.
- `lib/i18n/locale-path.test.ts`
- `lib/supabase/route-protection.ts` — `isProtectedPath`/`isAuthRoute`, extracted from middleware; pure.
- `lib/supabase/route-protection.test.ts` — **the security matrix** (locale × prefix × signed-out).
- `lib/eslint-rules.test.ts` — proves each restricted-import rule actually fires.
- `messages/{vi,en}/common.json`, `messages/{vi,en}/nav.json` — seed catalogs.
- `types/messages.d.ts` — TS module augmentation for type-safe keys.
- `app/[locale]/layout.tsx` — the root layout (moved), plus provider + `setRequestLocale`.

**Modified:**
- `package.json` — add `next-intl`.
- `next.config.js` — wrap with `createNextIntlPlugin`.
- `middleware.ts` — compose intl routing with `updateSession`.
- `lib/supabase/middleware.ts` — new signature; locale-stripped protection.
- `.eslintrc.json` — restricted-import rules + `lib/i18n/**` override.
- `playwright.config.ts` — pin `locale: "en"` for deterministic e2e.
- `tests/e2e/*.spec.ts` — prefixed URLs.
- 32 files importing `next/link`; 17 importing `next/navigation`.

**Moved:** `app/layout.tsx` → `app/[locale]/layout.tsx`; `app/(marketing)/`, `app/(auth)/`, `app/(app)/`, `app/(admin)/` → `app/[locale]/`. `app/globals.css` and `app/api/` **stay put** (API routes are not localized).

---

## Task 1: The localization foundation module

**Files:**
- Modify: `package.json`, `next.config.js`
- Create: `lib/i18n/routing.ts`, `lib/i18n/namespaces.ts`, `lib/i18n/request.ts`, `lib/i18n/index.ts`, `types/messages.d.ts`
- Create: `messages/en/common.json`, `messages/en/nav.json`, `messages/vi/common.json`, `messages/vi/nav.json`
- Test: `lib/i18n/catalog.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `routing` (with `routing.locales: readonly ["vi","en"]`, `routing.defaultLocale: "vi"`), `type Locale = "vi" | "en"`, `NAMESPACES: readonly string[]`, and a default-exported request config for the next-intl plugin.

- [ ] **Step 1: Install next-intl**

```bash
npm install next-intl@4.13.2
```

Expected: added, no peer warnings about `next` or `react`.

- [ ] **Step 2: Create the routing single source of truth**

`lib/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

/**
 * The single source of truth for which locales exist and how they appear in
 * URLs (spec D2/D3). Adding a locale = adding it here + adding its catalog
 * directory. No feature code changes (spec P7).
 *
 * `localePrefix: "always"` keeps every locale symmetric — no locale is a
 * special case, so ja/zh/ko need no new thinking.
 */
export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 3: Create the namespace tuple**

`lib/i18n/namespaces.ts`:

```ts
/**
 * Catalog namespaces. One namespace per feature = one owner (spec P4).
 * A string needed by several features is promoted to `common`.
 *
 * Plan 3 adds a namespace per module as it extracts strings. `catalog.test.ts`
 * asserts this list matches the files on disk, so the two cannot drift.
 */
export const NAMESPACES = ["common", "nav"] as const;

export type Namespace = (typeof NAMESPACES)[number];
```

- [ ] **Step 4: Create the seed catalogs**

`messages/en/common.json`:

```json
{
  "appName": "Nihongo Cinema"
}
```

`messages/en/nav.json`:

```json
{
  "dashboard": "Dashboard"
}
```

`messages/vi/common.json`:

```json
{
  "appName": "Nihongo Cinema"
}
```

`messages/vi/nav.json`:

```json
{
  "dashboard": "Bảng điều khiển"
}
```

- [ ] **Step 5: Write the failing catalog-parity test**

This is the mechanism that makes spec P5 and P7 true rather than hoped-for. It is generated from `routing.locales`, so a new locale is covered whether or not anyone remembers.

`lib/i18n/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { routing } from "./routing";
import { NAMESPACES } from "./namespaces";

const MESSAGES_DIR = join(process.cwd(), "messages");

function readCatalog(locale: string, namespace: string): unknown {
  return JSON.parse(
    readFileSync(join(MESSAGES_DIR, locale, `${namespace}.json`), "utf8"),
  );
}

/** Flattens {a: {b: "x"}} to ["a.b"]. */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Extracts ICU argument names: "Hi {name}, {count, plural, ...}" -> ["name","count"]. */
function icuArgs(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{\s*(\w+)/g)].map((m) => m[1]).sort();
}

function flattenMessages(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (typeof value !== "object" || value === null) return {};
  return Object.entries(value as Record<string, unknown>).reduce(
    (acc, [k, v]) => ({
      ...acc,
      ...flattenMessages(v, prefix ? `${prefix}.${k}` : k),
    }),
    {},
  );
}

describe("catalog", () => {
  it("declares every namespace that exists on disk, for every locale", () => {
    for (const locale of routing.locales) {
      const onDisk = readdirSync(join(MESSAGES_DIR, locale))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort();
      expect(onDisk).toEqual([...NAMESPACES].sort());
    }
  });

  it("has identical key sets across all locales", () => {
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceKeys = flattenKeys(readCatalog(reference, namespace)).sort();
      for (const locale of routing.locales) {
        const keys = flattenKeys(readCatalog(locale, namespace)).sort();
        expect(keys, `${locale}/${namespace}.json`).toEqual(referenceKeys);
      }
    }
  });

  it("has identical ICU arguments for every message across all locales", () => {
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceMessages = flattenMessages(readCatalog(reference, namespace));
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, message] of Object.entries(referenceMessages)) {
          expect(icuArgs(messages[key]), `${locale}/${namespace}.json → ${key}`).toEqual(
            icuArgs(message),
          );
        }
      }
    }
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run lib/i18n/catalog.test.ts`
Expected: FAIL — `Cannot find module './routing'` (the file exists only after Step 2; if you followed the order it will instead fail on the missing `messages/` files, which is equally acceptable). The point is that it fails before the catalogs exist.

- [ ] **Step 7: Run the test to verify it passes**

With Steps 2–4 in place:

Run: `npx vitest run lib/i18n/catalog.test.ts`
Expected: PASS — 3 tests.

Sanity-check that the test can actually fail: temporarily add `"extra": "x"` to `messages/vi/nav.json`, re-run, confirm the key-set test FAILS, then remove it. A parity test that cannot fail is worse than no test.

- [ ] **Step 8: Create the request config**

`lib/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "./routing";
import { NAMESPACES } from "./namespaces";

/**
 * Merges the per-namespace catalogs into the single message object next-intl
 * expects. Catalogs are split per feature for ownership (spec P4) and to keep
 * files small (CLAUDE.md §6) — the merge is an implementation detail of the
 * foundation; features never see it.
 */
async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(
      async (namespace) =>
        [
          namespace,
          (await import(`../../messages/${locale}/${namespace}.json`)).default,
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return { locale, messages: await loadMessages(locale) };
});
```

- [ ] **Step 9: Wire the plugin into next.config.js**

Modify `next.config.js` — add the import at the top and wrap the export. **Keep the existing `webpack` edge-alias block untouched**; it exists because `@anthropic-ai/sdk` cannot be bundled for the edge runtime, and removing it breaks the build.

```js
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config unchanged ...
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 10: Add the barrel — the public contract**

`lib/i18n/index.ts`:

```ts
/**
 * The localization capability's public contract (spec §0.2).
 *
 * Feature code imports from here (or `@/lib/i18n/navigation`) and nothing else.
 * `next-intl` lives below this boundary and is enforced out of feature code by
 * ESLint. Replacing the i18n library means rewriting `lib/i18n/**` — and
 * nothing else (spec §4.1).
 */
export { routing, type Locale } from "./routing";
export { NAMESPACES, type Namespace } from "./namespaces";
```

- [ ] **Step 11: Add type-safe message keys**

`types/messages.d.ts`. A wrong key becomes a `tsc` error, which is what turns Plan 3's 131-file refactor into something the compiler checks (spec D1). `en` is the type source because EN is authored verbatim first (spec D4); parity with `vi` is guaranteed by the test above, not by convention.

```ts
import type common from "../messages/en/common.json";
import type nav from "../messages/en/nav.json";
import type { routing } from "../lib/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: {
      common: typeof common;
      nav: typeof nav;
    };
  }
}
```

Note for Plan 3: adding a namespace means adding it in **three** places — `namespaces.ts`, this file, and the catalog directories. The disk-parity test in Step 5 catches two of the three; the third is a `tsc` error. This duplication is accepted: a runtime tuple cannot generate a compile-time type.

- [ ] **Step 12: Verify the whole suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: tsc 0 errors; **1193 tests passing** (1190 + 3 new); lint clean.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json next.config.js lib/i18n types/messages.d.ts messages
git commit -m "feat(i18n): add the localization foundation module

next-intl 4.13.2 (peer-supports the pinned Next 14.2.35). lib/i18n owns
routing, namespaces and catalog loading; messages/ holds per-namespace
catalogs so each feature owns its own strings.

The catalog-parity test is what makes 'adding a locale is configuration,
not refactoring' true rather than aspirational: key sets and ICU argument
sets must match across every locale, and the namespace list must match
the files on disk. It is generated from routing.locales, so a new locale
is covered whether or not anyone remembers to cover it.

No app wiring yet — nothing renders differently.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Locale-aware navigation

**Files:**
- Create: `lib/i18n/navigation.ts`
- Modify: `lib/i18n/index.ts`

**Interfaces:**
- Consumes: `routing` from Task 1.
- Produces: `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/lib/i18n/navigation` — the only navigation feature code may import (spec P2).

- [ ] **Step 1: Create the navigation module**

`lib/i18n/navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation (spec P2: every navigation preserves the current
 * locale; a feature never decides what locale goes in a URL).
 *
 * These are drop-in replacements for `next/link` and the locale-sensitive
 * half of `next/navigation`. `useSearchParams`, `useParams` and `notFound`
 * have nothing to do with locale — keep importing those from `next/navigation`
 * directly. That is why the ESLint rule restricts named imports rather than
 * the whole module (spec §2.9).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 2: Re-export from the barrel**

Append to `lib/i18n/index.ts`:

```ts
export { Link, redirect, usePathname, useRouter, getPathname } from "./navigation";
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/navigation.ts lib/i18n/index.ts
git commit -m "feat(i18n): add locale-aware navigation to the foundation

Link/redirect/useRouter/usePathname that preserve the current locale.
Call sites move over in Task 7; the ESLint rule that forbids the raw
imports lands in Task 8, once there are no violations left to report.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Route protection as pure logic — and the security matrix

> **This is the highest-severity task in the plan.** Read spec §4.2 first.
>
> `lib/supabase/middleware.ts` matches `PROTECTED_PREFIXES` against
> `pathname === "/dashboard"` / `startsWith("/dashboard/")`. The moment URLs become
> `/vi/dashboard`, **no prefix matches** ⇒ `isProtected === false` ⇒ **no auth check, and a
> signed-out visitor walks straight into every protected route.** This task exists to make that
> impossible before Task 5 introduces the prefix.

**Files:**
- Create: `lib/i18n/locale-path.ts`, `lib/supabase/route-protection.ts`
- Test: `lib/i18n/locale-path.test.ts`, `lib/supabase/route-protection.test.ts`

**Interfaces:**
- Consumes: `routing` from Task 1.
- Produces:
  - `stripLocale(pathname: string): { locale: Locale | null; pathname: string }`
  - `isProtectedPath(pathname: string): boolean` — takes an **already locale-stripped** pathname.
  - `isAuthRoute(pathname: string): boolean` — same.
  - `PROTECTED_PREFIXES: readonly string[]`, `AUTH_ROUTES: readonly string[]`

- [ ] **Step 1: Write the failing locale-strip test**

`lib/i18n/locale-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stripLocale } from "./locale-path";
import { routing } from "./routing";

describe("stripLocale", () => {
  it("strips a known locale prefix", () => {
    expect(stripLocale("/vi/dashboard")).toEqual({
      locale: "vi",
      pathname: "/dashboard",
    });
    expect(stripLocale("/en/videos/abc/shadowing")).toEqual({
      locale: "en",
      pathname: "/videos/abc/shadowing",
    });
  });

  it("maps a bare locale root to /", () => {
    expect(stripLocale("/vi")).toEqual({ locale: "vi", pathname: "/" });
    expect(stripLocale("/en/")).toEqual({ locale: "en", pathname: "/" });
  });

  it("leaves an unprefixed pathname alone", () => {
    expect(stripLocale("/dashboard")).toEqual({
      locale: null,
      pathname: "/dashboard",
    });
    expect(stripLocale("/")).toEqual({ locale: null, pathname: "/" });
  });

  it("does not strip a segment that merely starts with a locale code", () => {
    // "/vietnamese" must not be read as locale "vi" + "/etnamese".
    expect(stripLocale("/vietnamese")).toEqual({
      locale: null,
      pathname: "/vietnamese",
    });
  });

  it("handles every configured locale", () => {
    for (const locale of routing.locales) {
      expect(stripLocale(`/${locale}/profile`)).toEqual({
        locale,
        pathname: "/profile",
      });
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/i18n/locale-path.test.ts`
Expected: FAIL — `Cannot find module './locale-path'`.

- [ ] **Step 3: Implement stripLocale**

`lib/i18n/locale-path.ts`:

```ts
import { routing, type Locale } from "./routing";

/**
 * Splits a locale prefix off a pathname.
 *
 * Route protection MUST run against the stripped pathname: with
 * `localePrefix: "always"` every URL carries a prefix, and matching
 * "/vi/dashboard" against "/dashboard" silently yields "not protected" —
 * i.e. an auth bypass (spec §4.2, P3).
 */
export function stripLocale(pathname: string): {
  locale: Locale | null;
  pathname: string;
} {
  const segments = pathname.split("/");
  // "/vi/dashboard".split("/") === ["", "vi", "dashboard"]
  const candidate = segments[1];
  const locale = routing.locales.find((l) => l === candidate);

  if (!locale) return { locale: null, pathname };

  const rest = `/${segments.slice(2).join("/")}`;
  return { locale, pathname: rest === "/" ? "/" : rest.replace(/\/$/, "") };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/i18n/locale-path.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write the failing security-matrix test**

The table is generated from `routing.locales` × `PROTECTED_PREFIXES`, so a new locale or a new protected route is covered automatically and CI fails if the foundation regresses (spec §2.9).

`lib/supabase/route-protection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { routing } from "@/lib/i18n/routing";
import { stripLocale } from "@/lib/i18n/locale-path";
import {
  AUTH_ROUTES,
  PROTECTED_PREFIXES,
  isAuthRoute,
  isProtectedPath,
} from "./route-protection";

describe("route protection", () => {
  it("protects every prefix under every locale", () => {
    for (const locale of routing.locales) {
      for (const prefix of PROTECTED_PREFIXES) {
        const url = `/${locale}${prefix}`;
        expect(
          isProtectedPath(stripLocale(url).pathname),
          `${url} must be protected`,
        ).toBe(true);
      }
    }
  });

  it("protects nested routes under every prefix and locale", () => {
    for (const locale of routing.locales) {
      for (const prefix of PROTECTED_PREFIXES) {
        const url = `/${locale}${prefix}/nested/deep`;
        expect(
          isProtectedPath(stripLocale(url).pathname),
          `${url} must be protected`,
        ).toBe(true);
      }
    }
  });

  it("recognises auth routes under every locale", () => {
    for (const locale of routing.locales) {
      for (const route of AUTH_ROUTES) {
        expect(isAuthRoute(stripLocale(`/${locale}${route}`).pathname)).toBe(true);
      }
    }
  });

  it("leaves public routes unprotected", () => {
    for (const locale of routing.locales) {
      expect(isProtectedPath(stripLocale(`/${locale}`).pathname)).toBe(false);
      expect(isProtectedPath(stripLocale(`/${locale}/login`).pathname)).toBe(false);
    }
  });

  it("does not protect a path that merely starts with a prefix's characters", () => {
    // "/videosomething" must not be swallowed by the "/videos" prefix.
    expect(isProtectedPath("/videosomething")).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: FAIL — `Cannot find module './route-protection'`.

- [ ] **Step 7: Extract the protection logic**

`lib/supabase/route-protection.ts` — move the two constants verbatim out of `lib/supabase/middleware.ts`, **including the existing `/admin` comment block** (it explains a deliberate two-layer split and must not be lost).

```ts
/** Route prefixes that require an authenticated session. Locale-stripped paths. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/kanji",
  "/vocab",
  "/grammar",
  "/videos",
  "/reading",
  "/speaking",
  "/jlpt",
  "/jlpt-test",
  "/community",
  "/playlists",
  "/leaderboard",
  "/profile",
  "/content-manager",
  "/video-curator",
  // Layer 7 admin CMS (`app/[locale]/(admin)/admin/**`). Middleware only ensures
  // the request is signed IN — it has no cheap way to check `users.is_admin`
  // here (that requires a service-role DB read; see `lib/admin/guard.ts`), so a
  // signed-in non-admin still reaches the route and is bounced to `/dashboard`
  // by the admin layout's own server-side check. Treat this entry as "auth
  // required", not "admin required" — the two checks are deliberately split
  // across two layers.
  "/admin",
] as const;

export const AUTH_ROUTES = ["/login", "/register"] as const;

/**
 * @param pathname MUST already be locale-stripped (see `stripLocale`).
 * Passing a prefixed pathname here returns false for protected routes —
 * that is the auth bypass this module exists to prevent (spec §4.2).
 */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** @param pathname MUST already be locale-stripped. */
export function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 9: Prove the matrix would catch the bypass**

Do not skip this. A security test that cannot fail is theatre.

Temporarily change Step 5's first test to skip the strip — `isProtectedPath(`/${locale}${prefix}`)` instead of `isProtectedPath(stripLocale(...).pathname)`.

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: **FAIL** — `/vi/dashboard must be protected`. This is exactly the production bug spec §4.2 describes. Revert the change and confirm PASS again.

- [ ] **Step 10: Commit**

```bash
git add lib/i18n/locale-path.ts lib/i18n/locale-path.test.ts lib/supabase/route-protection.ts lib/supabase/route-protection.test.ts
git commit -m "feat(i18n): extract route protection and add the security matrix

Locale prefixes are about to make every protected route's match fail:
PROTECTED_PREFIXES compares against '/dashboard', and '/vi/dashboard'
matches nothing, so isProtected would silently return false and let a
signed-out visitor into every protected route (spec §4.2).

Extracts the protection predicates as pure functions taking a
locale-stripped pathname, and covers them with a matrix generated from
routing.locales × PROTECTED_PREFIXES — so a new locale or a new
protected route is covered whether or not anyone remembers.

Verified the matrix fails when the strip is removed. Middleware adopts
these in Task 4; no behaviour changes yet.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: updateSession composes with an incoming response

**Files:**
- Modify: `lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `stripLocale` (Task 3), `isProtectedPath`/`isAuthRoute` (Task 3).
- Produces: `updateSession(request: NextRequest, response: NextResponse): Promise<NextResponse>` — **note the new second parameter**; `middleware.ts` (Task 5) passes next-intl's response in so Supabase's cookies land on it.

- [ ] **Step 1: Rewrite lib/supabase/middleware.ts**

Two changes, both required by locale routing:
1. It now **mutates a response handed to it** rather than creating its own — next-intl's response carries the rewrite headers that tell the app which locale was resolved, so discarding it would discard the locale.
2. Protection matches the **locale-stripped** pathname, and redirects are **locale-preserving** (spec P2 — `/vi/dashboard` must bounce to `/vi/login`, not `/login`).

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasPublicSupabaseEnv, publicEnv } from "@/lib/env";
import { stripLocale } from "@/lib/i18n/locale-path";
import { routing } from "@/lib/i18n/routing";
import { isAuthRoute, isProtectedPath } from "./route-protection";

/**
 * Refreshes the Supabase auth cookie on every request and enforces access:
 * signed-out users are bounced from protected routes to /login; signed-in
 * users are bounced from the auth pages to /dashboard.
 *
 * @param response The response from next-intl's routing middleware. Supabase's
 * refreshed cookies are written onto it, and it is returned untouched
 * otherwise — it carries the headers that tell the app which locale resolved.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  // Before Supabase is configured, don't attempt auth — let the site run.
  if (!hasPublicSupabaseEnv()) {
    return response;
  }

  const supabase = createServerClient(
    publicEnv.supabaseUrl(),
    publicEnv.supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase (do not trust
  // getSession() alone in middleware).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // CRITICAL: match on the locale-stripped path. "/vi/dashboard" does not
  // start with "/dashboard", so matching the raw pathname would report every
  // protected route as public (spec §4.2). Covered by route-protection.test.ts.
  const { locale, pathname } = stripLocale(request.nextUrl.pathname);
  const activeLocale = locale ?? routing.defaultLocale;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/login`;
    // redirectTo carries the locale-stripped path; the login page redirects
    // within the active locale.
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 2: Verify typecheck fails at the old call site**

Run: `npx tsc --noEmit`
Expected: FAIL — `middleware.ts` calls `updateSession(request)` with 1 argument, expected 2. **This is the desired result**: the compiler is proving no other caller was missed. Task 5 fixes it.

- [ ] **Step 3: Verify the suite is otherwise unaffected**

Run: `npx vitest run`
Expected: PASS — **1203** tests (1190 baseline + 3 catalog + 5 locale-path + 5 route-protection). Record the real number you observe; if it differs from this arithmetic, **the observed number is right and this plan's arithmetic is wrong** — note it and move on.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "refactor(auth): updateSession takes the response and locale-stripped path

Locale routing forces two changes: next-intl's response carries the
resolved-locale headers, so updateSession must write Supabase's cookies
onto that response instead of creating its own; and protection must match
the locale-stripped pathname or every protected route silently reads as
public (spec §4.2).

Redirects are now locale-preserving: /vi/dashboard bounces to /vi/login.

middleware.ts does not compile until Task 5 composes the two — that is
the compiler proving no caller was missed.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Activate locale routing

> This task is deliberately large because it is **atomic**: `app/` cannot be half-moved. Between
> the directory move and the middleware composition the app does not serve a single working
> route, so they are one commit.

**Files:**
- Move: `app/layout.tsx` → `app/[locale]/layout.tsx`; `app/(marketing)/`, `app/(auth)/`, `app/(app)/`, `app/(admin)/` → `app/[locale]/`
- Stay: `app/globals.css`, `app/api/**` (API routes are not localized)
- Modify: `middleware.ts`, `app/[locale]/layout.tsx`, `playwright.config.ts`, `tests/e2e/home.spec.ts`, `tests/e2e/review.spec.ts`

**Interfaces:**
- Consumes: `routing` (Task 1), `updateSession(request, response)` (Task 4).
- Produces: every page served at `/{vi,en}/...`; `app/[locale]/layout.tsx` provides `NextIntlClientProvider` to all client components.

- [ ] **Step 1: Move the route groups**

```bash
git mv app/layout.tsx app/_layout-tmp.tsx
mkdir -p "app/[locale]"
git mv app/_layout-tmp.tsx "app/[locale]/layout.tsx"
git mv "app/(marketing)" "app/[locale]/(marketing)"
git mv "app/(auth)" "app/[locale]/(auth)"
git mv "app/(app)" "app/[locale]/(app)"
git mv "app/(admin)" "app/[locale]/(admin)"
```

`app/[locale]/layout.tsx` becomes the root layout (it renders `<html>`). `app/globals.css` and `app/api/` stay where they are.

Verify: `ls app` should show only `[locale]`, `api`, and `globals.css`.

- [ ] **Step 2: Rewrite the locale layout**

`app/[locale]/layout.tsx`. Note `params` is a plain object — **this is Next 14; params are not Promises** (that is Next 15, and this repo is pinned to 14.2.35).

```tsx
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import {
  ThemeProvider,
  themeInitScript,
} from "@/components/providers/theme-provider";
import { routing } from "@/lib/i18n/routing";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
});

export const metadata: Metadata = {
  title: {
    default: "Nihongo Cinema — Learn Japanese through video",
    template: "%s · Nihongo Cinema",
  },
  description:
    "Learn Japanese through video shadowing, kanji, vocab, grammar and JLPT prep.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1420" },
  ],
};

/** Enables static rendering for every locale (spec §7 risk 2). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Without this, every page below falls out of static rendering silently —
  // no error, just slower (spec §7 risk 2).
  setRequestLocale(locale);

  // Ships the whole catalog to the client. Deliberate for now: 65 client
  // components make per-namespace splitting a real design question, and
  // optimising before measuring would complicate the architecture. Filed as a
  // specific item for the L9c perf audit (spec §7 risk 3).
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${notoJp.variable} font-sans`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

The metadata strings stay hardcoded English on purpose — localizing them is Plan 3.

- [ ] **Step 3: Compose the middleware**

`middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  // A 3xx here means the URL had no (or an unknown) locale prefix and intl is
  // redirecting to a prefixed one. Return immediately: there is nothing to
  // protect on a redirect, and this skips a supabase.auth.getUser() network
  // round-trip on every bare URL (spec §4.2).
  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  return updateSession(request, response);
}

export const config = {
  // Run on all paths except Next internals, API routes and static assets.
  // API routes are not localized and must not be locale-redirected.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**`api` is newly excluded from the matcher.** API routes are not localized; letting the intl middleware redirect `/api/srs/review` to `/vi/api/srs/review` would break every client fetch. Losing `updateSession` on API routes is safe — routes authenticate via their own `requireUser()`/`createClient()` server-side.

- [ ] **Step 4: Verify typecheck and the unit suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0 errors (Task 4's deliberate error is now resolved); unit suite green at the number recorded in Task 4 Step 3.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: success. In the route table, pages appear as `/[locale]/...`. Confirm they are marked **static** (`○`) — if they are dynamic (`ƒ`), `setRequestLocale` is missing somewhere (spec §7 risk 2).

- [ ] **Step 6: Pin the e2e locale**

Playwright's Chrome sends `Accept-Language: en-US`, so next-intl would negotiate `/en` — but that is incidental, not chosen. Pin it, so the e2e suite runs on `en` deliberately (spec D6) and stays green when Plan 3 makes `vi` the fully-translated default.

`playwright.config.ts` — add `locale` to `use`:

```ts
  use: {
    baseURL,
    locale: "en",
    trace: "on-first-retry",
  },
```

- [ ] **Step 7: Use prefixed URLs in the e2e specs**

`tests/e2e/home.spec.ts` — change the first line of the test:

```ts
  await page.goto("/en");
```

`tests/e2e/review.spec.ts` — change the two navigations and the URL assertion:

```ts
  await page.goto("/en/register");
```

```ts
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 15000 });
```

```ts
  await page.goto("/en/vocab/review");
```

- [ ] **Step 8: Run the e2e suite**

Run: `npx playwright test`
Expected: PASS — 2 tests. Requires Docker/Supabase running (`npx supabase start`).

If `home.spec.ts` fails on `/start free trial/i`, **do not fix it here** — that copy is a known defect (no trial exists) and Plan 3 §9.1 corrects it. It should still pass in this plan, since no text changed.

- [ ] **Step 9: Manually verify the security fix**

The matrix test proves the predicate; this proves the wiring. Do not skip — this is the failure mode the whole task exists to prevent.

```bash
npm run dev
```

In a **signed-out** browser (or a private window), visit `http://localhost:3000/vi/dashboard`.
Expected: redirected to `http://localhost:3000/vi/login?redirectTo=%2Fdashboard`.

Then visit `http://localhost:3000/dashboard` (no prefix).
Expected: redirected to a prefixed URL, then to that locale's login.

Then visit `http://localhost:3000/`.
Expected: redirected to `/vi` or `/en` (whichever your browser's `Accept-Language` negotiates) and the landing page renders in English, exactly as before this plan.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(i18n): activate locale routing under app/[locale]

Moves every route group under app/[locale]/ and composes next-intl's
routing middleware with updateSession. The directory move and the
middleware wiring are one commit because app/ cannot be half-moved —
between them no route serves.

The intl middleware runs first and returns immediately on a redirect,
skipping a supabase.auth.getUser() round-trip on every bare URL. API
routes are excluded from the matcher: they are not localized, and
redirecting /api/* to /vi/api/* would break every client fetch. They keep
authenticating server-side via their own requireUser().

e2e is pinned to locale 'en' rather than relying on Playwright Chrome's
Accept-Language happening to negotiate it — the regression suite runs on
en by design (spec D6), and that must survive Plan 3 completing vi.

No user-visible change: all text remains hardcoded English.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Move every call site to locale-aware navigation

**Files:**
- Modify: 32 files importing `next/link`; 17 files importing from `next/navigation`

**Interfaces:**
- Consumes: `Link`, `redirect`, `useRouter`, `usePathname` from `@/lib/i18n/navigation` (Task 2).
- Produces: no new API — after this task, no feature file imports `next/link`, which is what makes Task 7's lint rule enable-able.

- [ ] **Step 1: List the call sites**

```bash
grep -rl 'from "next/link"' app components --include=*.tsx | grep -v test
grep -rlE 'from "next/navigation"' app components --include=*.tsx | grep -v test
```

Expected: 32 and 17 files respectively. If the counts differ, **trust the grep, not this plan** — record the real numbers.

- [ ] **Step 2: Swap the Link imports**

In each file from the first list, replace:

```tsx
import Link from "next/link";
```

with:

```tsx
import { Link } from "@/lib/i18n/navigation";
```

`Link` is a named export here, not a default — that is the only shape change; every `<Link href="/dashboard">` call site stays byte-identical, and now resolves to `/vi/dashboard` or `/en/dashboard` automatically.

- [ ] **Step 3: Swap the navigation imports**

In each file from the second list, split the import by what is locale-sensitive:

```tsx
// before
import { useRouter, useSearchParams } from "next/navigation";

// after
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/navigation";
```

Move only `redirect`, `useRouter`, `usePathname`. **Leave `useSearchParams`, `useParams` and `notFound` on `next/navigation`** — they have nothing to do with locale, and the Task 7 lint rule deliberately permits them (spec §2.9).

- [ ] **Step 4: Verify no call sites remain**

```bash
grep -rn 'from "next/link"' app components --include=*.tsx | grep -v test
grep -rnE 'import \{[^}]*\b(redirect|useRouter|usePathname)\b[^}]*\} from "next/navigation"' app components --include=*.tsx | grep -v test
```

Expected: no output from either.

- [ ] **Step 5: Verify typecheck, suite and build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green, at the test count recorded in Task 4.

- [ ] **Step 6: Verify locale is preserved when navigating**

```bash
npm run dev
```

Sign in, land on `/vi/dashboard`, and click through the nav. Every URL must keep the `/vi` prefix. Then repeat from `/en/dashboard` — every URL must keep `/en`. A link that drops the prefix is a missed call site (spec P2).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(i18n): route all navigation through the foundation

Swaps 32 next/link imports and the locale-sensitive named imports from
next/navigation over to @/lib/i18n/navigation, so every navigation
preserves the active locale (spec P2).

useSearchParams, useParams and notFound stay on next/navigation — they
have nothing to do with locale, and banning the whole module would be
banning the wrong thing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Enforce the boundary with ESLint — and prove the rules fire

> Enabling the rules *after* Task 6 is deliberate: enabling them earlier would report 49
> pre-existing violations and force the swap and the rule into one unreviewable commit.

**Files:**
- Modify: `.eslintrc.json`
- Test: `lib/eslint-rules.test.ts`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: the enforcement mechanism behind spec P1 and P2.

- [ ] **Step 1: Write the failing rule test**

Spec §2.9 is explicit — a rule must be verified to *fire*, not merely to exist. This test lints source text through the real project config.

`lib/eslint-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: process.cwd() });

async function lint(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.message);
}

describe("import boundary rules", () => {
  it("forbids feature code from importing next-intl directly", async () => {
    const messages = await lint(
      `import { useTranslations } from "next-intl";\nexport const a = useTranslations;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n/);
  });

  it("allows the foundation to import next-intl", async () => {
    const messages = await lint(
      `import { createNavigation } from "next-intl/navigation";\nexport const a = createNavigation;\n`,
      "lib/i18n/example.ts",
    );
    expect(messages.join("\n")).not.toMatch(/lib\/i18n/);
  });

  it("forbids feature code from importing next/link", async () => {
    const messages = await lint(
      `import Link from "next/link";\nexport const a = Link;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n\/navigation/);
  });

  it("forbids locale-sensitive named imports from next/navigation", async () => {
    const messages = await lint(
      `import { useRouter } from "next/navigation";\nexport const a = useRouter;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n\/navigation/);
  });

  it("permits locale-irrelevant imports from next/navigation", async () => {
    const messages = await lint(
      `import { useSearchParams, notFound } from "next/navigation";\nexport const a = [useSearchParams, notFound];\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).not.toMatch(/lib\/i18n\/navigation/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/eslint-rules.test.ts`
Expected: FAIL — the three "forbids" tests fail because no rule exists yet. (The two "allows/permits" tests pass vacuously; that is fine — they are regression guards for over-broad rules.)

- [ ] **Step 3: Add the rules**

`.eslintrc.json` — **merge into the existing `no-restricted-imports`; do not replace it.** The AI-provider pattern must survive.

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
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
  },
  "overrides": [
    {
      "files": ["lib/ai/providers/*.ts", "test/claude-mock.ts"],
      "rules": { "no-restricted-imports": "off" }
    },
    {
      "files": ["lib/i18n/**", "app/[locale]/layout.tsx", "test/render.tsx"],
      "rules": { "no-restricted-imports": "off" }
    }
  ]
}
```

The second override lists the three legitimate places below the boundary: the foundation itself, the root layout (it must mount `NextIntlClientProvider` — spec §4.1 names this as wiring the abstraction deliberately does not hide), and the test render helper Plan 3 adds.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/eslint-rules.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Verify the repo is clean under the new rules**

Run: `npm run lint`
Expected: clean. A violation here means Task 6 missed a call site.

- [ ] **Step 6: Commit**

```bash
git add .eslintrc.json lib/eslint-rules.test.ts
git commit -m "feat(i18n): enforce the localization boundary with lint

Feature code may not import next-intl, next/link, or the locale-sensitive
named exports of next/navigation. Only lib/i18n (plus the root layout that
mounts the provider) may reach below the boundary.

The rules ship with tests that lint real source text through the real
project config and assert each rule actually fires — Spec A's standard,
because a rule that exists but never fires is worse than no rule.

useSearchParams/useParams/notFound are deliberately permitted: they have
nothing to do with locale, and a module-wide ban would ban the wrong thing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Phase 1 verification gate

> Spec §5 Phase 1's definition of done: *the localization architecture exists; user-visible
> behaviour is unchanged; the full regression suite is green; the security boundary is intact,
> proven by the matrix test rather than asserted.* This task proves all four.

**Files:** none — this is a gate, not a change.

- [ ] **Step 1: Run the full verification set**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```

Expected: tsc 0 errors · lint clean · unit suite green (≥1190 baseline + the new foundation tests) · build succeeds · 2 e2e pass.

Record the **actual** unit-test count. If any command fails, stop and fix before proceeding — do not report Phase 1 done with a red command (`CLAUDE.md` §7: never claim something works without showing the command output).

- [ ] **Step 2: Confirm the security boundary by hand, once more**

Signed out, in a private window, against `npm run dev`, confirm each redirects to that locale's login:
- `http://localhost:3000/vi/dashboard`
- `http://localhost:3000/en/dashboard`
- `http://localhost:3000/vi/admin`
- `http://localhost:3000/en/profile`

- [ ] **Step 3: Confirm zero user-visible change**

Compare against `git stash`-ing to master if useful. The landing page, dashboard, and one learning page must read **exactly** as they did before this plan — same English, same layout. Any text difference means a string was translated, which belongs to Plan 3.

- [ ] **Step 4: Request code review**

Use the `superpowers:requesting-code-review` skill, or dispatch the `code-reviewer` agent over the branch diff. Per `CLAUDE.md` §9, non-trivial work is not done until `code-reviewer` has signed off.

Direct the reviewer's attention to:
- `lib/supabase/middleware.ts` + `lib/supabase/route-protection.ts` — the auth-bypass fix (spec §4.2). **This is the highest-risk change in the plan.**
- `middleware.ts` — the API-route matcher exclusion, and whether losing `updateSession` on `/api/*` is genuinely safe for every route.
- `.eslintrc.json` — whether the overrides are the minimum set.

- [ ] **Step 5: Update the Serena memory**

Add to `mem:project_status` under Progress: L9a Plan 1 built, what shipped, the real test count, and that Plans 2 and 3 remain. Note in `mem:feature_backlog_deferred` that #10 (i18n site-wide) is **in progress, not done** — the shell is still English until Plan 3.

---

## Self-Review

**Spec coverage:**

| Spec item | Task |
|---|---|
| D1 next-intl | 1 |
| D2 `localePrefix: 'always'` | 1 (config), 5 (activation) |
| D3 vi + en | 1 |
| D4 per-module catalogs, `en` type source | 1 |
| D5 cookie + URL, no DB column | 1 (next-intl's `NEXT_LOCALE` default; no schema touched anywhere) |
| D6 regression suite on `en` | 5 (e2e pin); the unit-side render helper is **Plan 3**, where the first component consumes `t()` |
| D7 primitives | **Plan 2** |
| D8 app-only, no content/schema | Global Constraints |
| D9 style guide | **Plan 2** |
| §2.9 P1/P2 enforcement | 7 |
| §2.9 P3 enforcement (security matrix) | 3 |
| §2.9 P5/P7 enforcement (parity) | 1 |
| §4.1 foundation module | 1, 2 |
| §4.2 middleware + security | 3, 4, 5 |
| §4.3 navigation | 2, 6 |
| §4.4/§4.5 design system | **Plan 2** |
| §5 Phase 1 DoD | 8 |
| §5 Phase 2/3 | **Plan 3** |
| §7 risk 2 (`setRequestLocale`) | 5 (layout + build check) |
| §7 risk 3 (client payload) | 5 (documented in code, deferred to L9c) |
| §7 risk 4 (e2e) | 5 |
| §8 logical properties | **Plan 2** |
| §9.1 "Start free trial" defect | **Plan 3** (it is a copy change) |

No spec gap falls to nobody: every deferred row names its plan.

**Placeholder scan:** none. Every code step carries complete code; every command carries expected output.

**Type consistency:** `stripLocale` returns `{ locale, pathname }` in Task 3 and is destructured as `{ locale, pathname }` in Task 4. `isProtectedPath`/`isAuthRoute` take one `string` in both. `updateSession(request, response)` is defined in Task 4 and called with two arguments in Task 5. `routing.locales` is used identically in Tasks 1, 3, 5. `Link` is a **named** export in Tasks 2 and 6.

**One arithmetic caveat, stated rather than hidden:** the plan predicts a final unit count of 1190 + 3 (catalog) + 5 (locale-path) + 5 (route-protection) + 5 (eslint) = **1208**. Test counts drift. If the observed number differs, the observed number is right and this plan is wrong — record reality and move on (spec Status line).
