# L9a Plan 1/3 (Localization Architecture) — ✅ COMPLETE & MERGED (`69f22e6`, 2026-07-18)

**Run finished 2026-07-18. All 8 tasks done + reviewed; final whole-branch review (opus) verdict:
READY TO MERGE = YES, 0 Critical, 0 Important-blocking. User chose merge --no-ff → master
`69f22e6`; local branch deleted; post-merge verify tsc 0 + 1229/1229. NOT pushed
(origin/layer-9a-... holds a stale pre-finish tip).** Was branch
`layer-9a-localization-architecture` (off master @ `0419c15`), final tip `cddf961`, 18 commits. Method: subagent-driven-development; full
per-task detail in `.superpowers/sdd/progress.md` (gitignored scratch; if gone, this + `git log`).

## What shipped (Plan 1 of 3)

- `lib/i18n/**`: routing (vi/en, defaultLocale vi, localePrefix "always"), namespaces, request
  config, locale-aware navigation (createNavigation), stripLocale, server barrel (+`getLocale`).
- `app/` → `app/[locale]/` (4 route groups + root layout w/ generateStaticParams,
  setRequestLocale, hasLocale guard, NextIntlClientProvider, `<html lang>`).
- Middleware composed **Supabase FIRST → next-intl**, Set-Cookie copied onto intl's response;
  matcher excludes **api AND auth**; route protection matches locale-STRIPPED paths (security
  matrix generated from routing.locales × PROTECTED_PREFIXES + literal-pin test).
- ALL feature code imports Link/redirect/useRouter/usePathname from `@/lib/i18n/navigation`
  (useSearchParams/useParams/notFound stay on next/navigation).
- ESLint boundary MERGED into Spec A's AI-SDK no-restricted-imports; escape hatches
  `lib/i18n/**`, `app/[[]locale[]]/layout.tsx` (minimatch-escaped), `test/render.tsx`;
  `lib/eslint-rules.test.ts` 7/7 lints REAL source via real resolved config (rules FIRE).
- Zero user-visible change confirmed (text still hardcoded EN; seed catalogs unused by render).

## Verified baseline at ceb7445 (Task 8 gate — Plans 2/3 + L9c compare against THESE)

**Unit 1229 tests / 162 files · lint clean · tsc 0 · build 52s · playwright 2/2 in 37s.**
Build route table: every no-dynamic-segment page = SSG per locale; the 9 ƒ pages are pre-existing
[id]/[type] routes. Curl signed-out matrix: all 4 locale×route pairs redirect to matching-locale
login with locale-prefixed redirectTo.

## LOAD-BEARING — never "clean up" (measured, reviewer-verified at library-source level)

1. **Middleware order Supabase FIRST → intl**, cookie copy loop in `middleware.ts`. next-intl
   4.13.2 forwards `new Headers(request.headers)` at run time, AFTER Supabase's
   `request.cookies.set()` wrote through — reversing reintroduces the stale-token auth bug.
2. **`response = NextResponse.next({request})` AFTER `request.cookies.set()`** in updateSession's
   setAll (`lib/supabase/middleware.ts:54`, commented).
3. **Matcher excludes `auth`** — else `/auth/callback` 307s to `/vi/auth/callback` = every Google
   sign-in broken.
4. **Anti-double-prefix in `app/[locale]/(auth)/actions.ts`**: a PRESENT redirectTo is already
   locale-prefixed (from middleware) — login() strips (stripLocale) then re-adds via getLocale();
   next-intl v4 `redirect` takes **`{href, locale}`**, NOT a string. OAuth absolute URLs pass
   through unprefixed (isLocalizableHref=false for `^[a-z]+:`). Comment at call site load-bearing.
5. **`vitest.config.ts` `server.deps.inline: [/next-intl/]`** — Plan 3's ~62 provider-rendered
   test files depend on it.
6. **ESLint glob `app/[[]locale[]]/layout.tsx`** — unescaped `[locale]` is a minimatch char class.
7. **`lib/i18n/navigation.ts` redirect wrapper fn** — TS can't narrow `never` return destructured
   from generic createNavigation; wrapper is documented, not redundant.
8. `next.config.mjs` (not .js); its webpack edge-alias for @anthropic-ai/sdk stays.

## Patterns Plans 2/3 MUST reuse

- **Server-side redirect**: `const locale = await getLocale(); redirect({ href: "/unprefixed", locale })`
  (see `app/[locale]/(admin)/admin/layout.tsx`).
- **Component tests**: import render from **`@/test/render`** (wraps NextIntlClientProvider,
  locale="en"); href assertions expect `/en/...`-prefixed INCLUDING query preservation.
- Adding a namespace touches 3 places: `lib/i18n/namespaces.ts`, `types/messages.d.ts`, catalog
  dirs (~18 coming in Plan 3; plain template-literal dynamic import, no loader map needed).

## Follow-ups assigned by the final review (do NOT lose)

- **PLAN 2, FIRST**: automated test for the top-level `middleware()` composition (mock
  updateSession → assert Set-Cookie carried onto intl response + 3xx short-circuits before intl).
  The one place a refactor could silently reopen the measured auth-cookie bug.
- **PLAN 3**: re-prefix `app/auth/callback/route.ts` error branch (bare `/login?error=auth`);
  OAuth + login round-trip e2e (closes carried d/g); fix "Start free trial" copy (no-trial model);
  move Companion template titles into i18n.
- Optional: AI-SDK ESLint fire-test (guard currently proven only by manual verification).
- Accepted as-is: `^4.13.2` caret (repo convention); getPathname reserved surface; whole catalog
  in RSC payload (deferred L9c, documented in layout); login() uses login-page locale over a
  hand-crafted mismatched redirectTo locale (cosmetic).
- Known flakes under full-suite CPU contention (standalone-green): pitch-contour.test.tsx,
  waveform.test.tsx. Also: a STALE node process on port 3000 makes playwright reuseExistingServer
  pick it up → kill stale node before e2e.

## Next after merge

Roadmap: **Plan 2 (design system) and Plan 3 (string extraction + VN) — both unblocked now, can
run in parallel** → L9b surfaces → L8 billing → L9c polish/perf. Plans 2/3 are NOT WRITTEN yet
(need writing-plans runs off the spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`).

## Process lessons this run re-proved

- Reality outranks the plan (redirect signature `{href,locale}`; ESLint "comment" key; brief's
  file counts wrong twice — 33 not 32 next/link, 18+actions.ts not 17 next/navigation).
- Verify claims, don't trust reports: a fixer mislabeled its own test breakage "pre-existing";
  controller disproved via the green-at-base fact and forced the repair.
- Reviewers verifying independently (rereading library source, manually firing lint rules,
  adversarial route probing) caught everything that mattered: 2 missed migration files, the
  matrix blindness, the auth-cookie ordering bug (previous session).
