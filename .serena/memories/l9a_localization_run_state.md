# L9a Plan 1/3 (Localization Architecture) — RESUMABLE RUN STATE

**Read this + `mem:project_status` before touching L9a. Written 2026-07-17 mid-run.**

## TL;DR to resume

- Branch **`layer-9a-localization-architecture`** (off master @ `0419c15`), tip **`37e00de`**.
- **Tasks 1–4 DONE, committed, reviewed.** Suite was **1210/1210** at `37e00de`.
- **Task 5 is ~85% done but UNCOMMITTED IN THE WORKING TREE** (a subagent was interrupted
  mid-task). Suite currently **1216** with those changes. `tsc` 0 errors. See "Task 5" below —
  **do not redo it from scratch; finish and commit it.**
- Tasks 6–8 not started.
- Method: **subagent-driven-development**. Ledger: `.superpowers/sdd/progress.md` (GITIGNORED
  scratch — it has more per-task detail than this memory; if it is gone, this memory + `git log`
  are the recovery map).

Spec: `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`
Plan: `docs/superpowers/plans/2026-07-17-l9a-localization-architecture.md` (8 tasks)
Evidence doc: `.superpowers/sdd/cookie-forwarding-investigation.md` (gitignored; see §"Auth bug")

## The layer

L9a = make **localization** and the **design system** platform capabilities. Spec §0 North Star:
*L9a does not exist to make the app multilingual; it exists so features never solve localization
or visual-language infrastructure again.* Split into 3 plans (spec §4.5 says the two capabilities
are independent):
- **Plan 1 (in progress)** — localization architecture. `lib/i18n/**`, `app/[locale]/`,
  locale-aware navigation, ESLint boundary. **Zero user-visible change** — all text stays
  hardcoded English.
- **Plan 2 (not written)** — design system: tokens → semantic tokens → primitives → living style
  guide. Depends on Plan 1.
- **Plan 3 (not written)** — string extraction (EN verbatim) + Vietnamese. Depends on Plan 1.

Roadmap order after L9a: **L9b surfaces → L8 billing → L9c polish/perf.** (L8 deliberately late.)

## Commits on the branch (oldest → newest)

```
9f8fbb6 feat(i18n): add the localization foundation module          (Task 1)
4cee78e docs(i18n): state contract requirement instead of false ESLint enforcement
3be51ae feat(i18n): add locale-aware navigation to the foundation   (Task 2)
23d5611 docs(l9a): fix the plan text that reintroduced a corrected defect
c74b505 fix(test): remove dead /^next$/ regex from vitest inline deps
ab71a17 feat(i18n): extract route protection and add the security matrix  (Task 3)
d95b582 fix(i18n): harden route-protection security matrix per review
0a19901 refactor(auth): updateSession takes the response ...  <-- REFUTED DESIGN, superseded
798f20b docs(l9a): revise Tasks 4-5 after measurement refuted the design
bc20fa0 refactor(auth): match route protection on the locale-stripped path  (Task 4, correct)
37e00de docs(l9a): fix the Task 4 commit-message template ...
```

## Tasks 1–4 (DONE)

**Task 1 — foundation module.** `next-intl@4.13.2` (peer-supports the pinned Next 14.2.35 +
React 18.3.1 — verified against the registry; **no Next bump needed**). Created
`lib/i18n/{routing,namespaces,request,index,server}.ts`, `messages/{vi,en}/{common,nav}.json`,
`types/messages.d.ts`. `routing` = locales `["vi","en"]`, defaultLocale `"vi"`,
localePrefix **`"always"`**.

**Task 2 — navigation.** `lib/i18n/navigation.ts` = `createNavigation(routing)` exporting
`Link, redirect, usePathname, useRouter, getPathname`. Barrel re-exports them + `useTranslations`.

**Task 3 — route protection + security matrix.** `lib/i18n/locale-path.ts` (`stripLocale`) and
`lib/supabase/route-protection.ts` (`isProtectedPath`/`isAuthRoute`, pure, take an ALREADY-STRIPPED
pathname). Matrix generated from `routing.locales` × `PROTECTED_PREFIXES`.

**Task 4 — `updateSession` matches the stripped path** + locale-preserving redirects. Signature
UNCHANGED (`updateSession(request)`).

## Task 5 — UNCOMMITTED WORK IN THE TREE (finish this first)

A subagent was dispatched and interrupted. `git status` shows: whole `app/` moved to
`app/[locale]/` (git detects them as renames `R`), plus modified `middleware.ts`,
`lib/supabase/middleware.ts`, `components/auth/auth-form.tsx`, `playwright.config.ts`,
`tests/e2e/*.spec.ts`, and a NEW untracked `lib/supabase/middleware.test.ts` (125 lines).

**Already done in the tree (verified by reading the files):**
- `app/` → `app/[locale]/` for all 4 route groups + root layout. `app/` now holds only
  `[locale]`, `api`, `auth`, `globals.css`.
- `app/[locale]/layout.tsx` has `generateStaticParams`, `setRequestLocale`, `hasLocale` guard,
  `NextIntlClientProvider`, `<html lang={locale}>`.
- `middleware.ts` composed **Supabase FIRST, then intl**, copying Set-Cookie onto intl's response.
- Step 3a done: `redirectTo` now carries the LOCALE-PREFIXED path (`lib/supabase/middleware.ts:85`).
- `playwright.config.ts` pins `locale: "en"`.
- `npx tsc --noEmit` → 0 errors. `npx vitest run` → **1216 passing**.

**A REAL DISCOVERY the plan had MISSED — keep it:** the matcher must exclude **`auth`** as well
as `api`. `app/auth/` holds the OAuth/email-confirmation route handlers; without the exclusion
`/auth/callback` 307s to `/vi/auth/callback`, which does not exist — **silently breaking every
Google sign-in**. The tree's matcher is:
`"/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"`

**Still NOT done for Task 5:**
- `npm run build` — and check the route table shows `/[locale]/...` as **static (○)** not dynamic
  (ƒ). Dynamic ⇒ a missing `setRequestLocale` (spec §7 risk 2).
- `npx playwright test` (needs Docker + `npx supabase start`).
- Step 9 manual browser pass, signed out: `/vi/dashboard`, `/en/dashboard`, `/vi/admin`,
  `/en/profile` must each redirect to that locale's login. Plus the login round trip: sign in from
  `/en/...` and confirm you land back in `en`, not `vi`.
- Verify `safeRedirectPath` (`lib/safe-redirect.ts`, used at `app/[locale]/(auth)/actions.ts:35`)
  still accepts the now locale-prefixed `redirectTo` **and** has not become an open-redirect hole.
  **This was explicitly flagged to check and is NOT confirmed done.**
- **COMMIT IT** (nothing is committed).
- Then: review-package + task reviewer.

## THE BIG LESSON OF THIS RUN — an auth bug the PLAN itself mandated

Task 4's first attempt (`0a19901`) followed the plan exactly and shipped an **auth bug**. Review
caught it; the user said *verify before deciding*; measurement against real `next@14.2.35` proved it:

```
response built BEFORE request.cookies.set() -> x-middleware-request-cookie: sb-access-token=OLD
response built AFTER  request.cookies.set() -> x-middleware-request-cookie: sb-access-token=NEW
```

`NextResponse.next(init)` bakes the forwarded `x-middleware-request-*` headers **once, at
construction**; `response.cookies.set()` afterwards writes into a throwaway cloned `Headers` never
assigned back. The plan had `updateSession` write cookies onto next-intl's already-built response
⇒ on a token-rotation request the browser gets the fresh cookie but **that same request's Server
Components read the stale, just-expired token** whose refresh token middleware already consumed ⇒
middleware admits the user, the page renders them signed out. Intermittent; invisible to tests.

**Consequences now baked into the design — DO NOT "optimise" them back:**
1. **Middleware order is Supabase FIRST, then next-intl.** Not stylistic. Cost accepted: a
   `getUser()` round-trip now also runs on bare URLs intl would redirect.
2. **`response = NextResponse.next({ request })` inside `updateSession`'s `setAll`, positioned
   AFTER `request.cookies.set()`, is LOAD-BEARING.** It carries a comment saying so. Deleting it
   as "redundant" reintroduces the bug.

## Hard-won facts (verified, not recalled — trust these over any doc)

- **`next.config.mjs`**, not `next.config.js` (the plan said `.js`). Its `webpack` block aliasing
  away `@anthropic-ai/sdk` for the edge runtime is load-bearing — build breaks without it.
- **`vitest.config.ts` needs `test.server.deps.inline: [/next-intl/]`** — LOAD-BEARING FOR PLAN 3.
  `next@14.2.35` ships **no `exports` map**; Vitest externalizes `next-intl`, which imports
  `next/navigation` as an extensionless bare specifier; Node's native ESM resolver then fails.
  ~62 test files will render inside `NextIntlClientProvider` in Plan 3 and all depend on this.
  A `/^next$/` entry was also added then removed: it is **dead config** — vite-node tests the
  regex against the RESOLVED ABSOLUTE PATH, which an anchored `/^next$/` can never match (a
  reviewer proved it by substituting an unmatchable pattern and getting identical results).
- **No webpack context-module warning** ⇒ `request.ts` ships the plain template-literal dynamic
  import; the `LOADERS` map fallback was NOT needed. **Plan 3 can add ~18 namespaces with no
  loader-map maintenance.**
- **ESLint override glob for the root layout must be `app/[[]locale[]]/layout.tsx`.** ESLint globs
  are minimatch: an unescaped `[locale]` is a CHARACTER CLASS (matches `app/e/layout.tsx`, not the
  literal dir). Backslash escaping does NOT work. Do **not** "simplify" to `app/**/layout.tsx` —
  that exempts every nested layout from the boundary rule. Verified empirically. (Task 7.)
- **`types/messages.d.ts` augmentation is REAL**, not decorative — a reviewer compiled a bad key
  and `tsc` errored correctly.
- Adding a namespace touches **three** places: `lib/i18n/namespaces.ts`, `types/messages.d.ts`,
  and the catalog dirs. The disk-parity test catches two; the third is a `tsc` error.
- **Known pre-existing flake:** `components/video-player/pitch-contour.test.tsx` fails under
  full-suite CPU contention, passes standalone. Known since L6. NOT caused by L9a.

## Tasks 6–8 (not started)

- **Task 6** — move **32** files importing `next/link` and **17** importing `next/navigation` to
  `@/lib/i18n/navigation`. Leave `useSearchParams`/`useParams`/`notFound` on `next/navigation` —
  they are locale-irrelevant. Ends with a grep proving only `lib/i18n/**` + the root layout touch
  `next-intl`. **Fix any violation; do NOT add a lint override to accommodate it.**
- **Task 7** — ESLint boundary rules (merge into the EXISTING `no-restricted-imports` that guards
  the AI provider SDKs — do not replace it) + tests proving each rule **fires**, and that the
  escape hatch works for `lib/i18n/**` and the root layout. Enabled AFTER Task 6 so there are no
  pre-existing violations.
- **Task 8** — verification gate: `tsc` · `lint` · `vitest` · `build` · `playwright`; record the
  REAL unit count + build/e2e duration as the baseline for Plans 2/3 and L9c's perf audit;
  manual signed-out checks; confirm zero user-visible change; `code-reviewer` sign-off; update
  Serena memory.

## Carried MINORs (for the final whole-branch review)

- `package.json` uses `^4.13.2` while `next` is pinned exact. Matches repo convention for every
  non-next/react dep; lockfile resolves 4.13.2.
- `lib/supabase/middleware.ts` `locale ?? routing.defaultLocale`: with Supabase running first,
  `locale` is null for bare/invalid-prefix URLs, so a signed-out `en` user on bare `/dashboard`
  goes to `/vi/login`, skipping next-intl's NEXT_LOCALE/Accept-Language negotiation. A reviewer
  judged default-locale the RIGHT call (reading the cookie = the locale-recomputation the JSDoc
  forbids; a deterministic locale beats a guess). Wants a one-line comment so it reads as
  intentional. Fail-closed on auth is preserved. Cosmetic.
- `lib/supabase/middleware.ts` JSDoc "Runs BEFORE next-intl's middleware" — becomes true once
  Task 5's composition is committed.
- Spec §7 risk 3, deferred to **L9c perf audit**: `NextIntlClientProvider` ships the WHOLE catalog
  in the RSC payload (65 client components). Deliberate for now — optimise after measuring.
- Spec §9.1, deferred to **Plan 3**: the landing page says **"Start free trial"** but the business
  model has **no trial**. Fix the copy during extraction; do not translate a falsehood into VN.

## Process notes that paid off (repeat them)

- **Reality outranks the plan.** It happened repeatedly this run: `next.config.mjs` vs `.js`, the
  `icuArgs` typecheck, the vitest resolver gap, the `auth` matcher exclusion, and the auth bug
  above. Every time the implementer reported instead of forcing, the plan was wrong.
- **Fix the plan, not just the code.** A corrected comment defect came back one commit later
  because the plan's code block still carried it. Fixing only the code lets it return.
- **Prove tests can go red.** Mutation checks caught two real blind spots: the parity test's ICU
  check, and a security matrix that stayed green after `/profile` was deleted from
  `PROTECTED_PREFIXES` (fixed with a literal-contents pin test).
- Reviewers verified claims independently (reran builds, reproduced errors, read library source)
  rather than trusting reports. That is what caught the dead regex and the auth bug.
