# L9a run state — Plan 1 ✅ merged · Plan 2 ✅ merged · style-guide pass ✅ DONE · Plan 3 ✅ WRITTEN, not executed

## ✅ Manual style-guide pass DONE 2026-07-19/20 (the debt Plan 2 left) — 2 commits on master

Ran at `/vi|/en/admin/style-guide`, both themes, measuring on the LIVE DOM rather than by eye.
Admin access: registered `admin@almostgone.vn` / `styleguide-local-dev-2026` locally (the
ADMIN_EMAILS bootstrap promoted it on first /admin visit — designed path, no SQL escalation).
NOTE: this signed the user's own `shamt2004@gmail.com` dev session out; harmless, just log back in.

**1. Contrast — reviewer's suspicion CONFIRMED, and it was NOT badge-only. FIXED (`b4b4fcb`).**
The `bg-X/10 text-X` tint pattern lives in **13 places** (app-nav active state, admin-shell,
auth-form error, jlpt navigator, dictation view, recommendation rail, badges-grid, video-queue,
badge). Measured failures at the 4.5:1 bar (badge text is 12px/weight-500 → NO large-text
exemption): primary tint light/card 4.14, light/bg 4.00, dark/card 4.34 · success tint light/card
4.10, light/bg 3.95 · danger tint dark/card 4.09 · plus plain `text-success` on light `--background`
4.48. A 10% fill barely moves the surface AND costs ~0.7 contrast vs the bare surface.
**Fix (user chose it over darkening the brand):** one token cannot be both a good fill and good
text, so `--primary` stays the brand vermilion driving fills/buttons/ring **unchanged** (solid
pairings already passed 4.64–9.47), and a NEW `--{primary,accent,success,danger}-strong` tier
carries the legible-as-text tone — darker in light, LIGHTER in dark. New primitives:
vermilion-300/700, green-700, red-300/700. 93 class sites migrated `text-X` → `text-X-strong`.
Live-DOM verification: light 5.50–16.37, dark 5.79–16.70, all pass.
**Deliberately EXCLUDED from the migration (do not "finish" this later):**
`components/video-player/pitch-contour.tsx` and `waveform.tsx` set `text-primary` on a wrapper
that the canvas reads via `getComputedStyle(canvas).color` — that class is the WAVEFORM/contour
colour, not text. Non-text contrast needs only 3:1 and `--primary` clears it; recolouring them
would be a visual change with no a11y basis.
**Enforcement:** `lib/design-tokens.contrast.test.ts` parses globals.css, resolves the semantic
aliases per theme, alpha-blends the tint, and asserts 4.5:1 (spec §2.9). Also a new
`lib/utils.test.ts` case: `text-success-strong` must NOT be misclassified by twMerge as a
font-size and strip `text-caption` out of Badge — the cn() hazard from the other direction.

**2. Elevation — FAILS in dark theme. NOT fixed (design decision, → L9c).**
Light: three levels correctly ordered but subtle; `raised` vs `overlay` barely separable at a
glance. Dark: measured on the live DOM, each shadow vs the page background = **1.05:1** and
between adjacent levels = **1.005:1** — i.e. the shadows convey essentially NOTHING on ink-950.
All apparent depth comes from `--card` (L=12%) vs `--background` (L=8%), which is identical for
all three levels. Proper fix = a dark-theme elevation SURFACE ramp (conventional for dark UIs),
which is a design decision beyond a verification pass.

**3. Type scale — new primitives correct, old ones un-migrated (cosmetic).**
badge/dialog/select/tabs/toast/tooltip all use the token scale. button/input/label still use raw
`text-sm`, card uses `text-lg`. Values coincide (`text-sm`=0.875rem=`--text-body`,
`text-base`=1rem=`--text-body-lg`) so there is NO visual inconsistency — except `card`'s
`text-lg` (1.125rem) which is genuinely OFF-SCALE (no token equals it). → L9b/L9c.

**4. Interaction — ALL PASS.** Dialog: `aria-modal="true"`, labelledby set, focus moves inside on
open, 6× Tab never escapes, Escape closes AND returns focus to the trigger → **L7 WCAG 2.4.3 debt
confirmed genuinely repaid**. Toast renders title+description+dismiss. Theme toggle, vi↔en locale
switch, and the reduce-motion kill switch (animation → `1e-06s` while `--duration-base` stays
300ms) all work.

**5. Style guide was under-reporting the palette. FIXED (`300ee94`).** token-sections.tsx claimed
"a token added to globals.css without being listed here shows up in review" — nothing enforced it
and it HAD already drifted: `--card-foreground`, `--input`, `--ring`, `--primary-foreground`,
`--accent-foreground` were missing before this session. Now a test parses globals.css and asserts
the rendered guide names every colour token (found those five by failing first).

**Gates after both commits:** tsc 0 · **1305/1305 (175 files)** · lint exit 0 / 80 pre-existing
warnings, 0 new · build ✓. One intermittent single-test failure appeared in one full run and two
subsequent full runs were green; it was not captured by name, consistent with the documented
CPU-contention flakes (`pitch-contour.test.tsx`, `waveform.test.tsx`).

## ✅ Plan 3 WRITTEN 2026-07-19 (`66ea4b7`, updated `300ee94`+) — NOT executed
`docs/superpowers/plans/2026-07-19-l9a-string-extraction-vietnamese.md`, 19 tasks.
**Key deviation from the spec, forced by the repo:** spec §5 splits Phase 2 (extract EN) from
Phase 3 (fill VN), but `lib/i18n/catalog.test.ts` ALREADY asserts identical key sets across
locales — so an EN-only commit is a red test. VN is filled in the SAME task per module. One pass,
not two.
**Task 1 is the linchpin:** `test/render.tsx` currently passes `messages={{}}`; the moment a
component calls `t()` it renders the KEY and every English assertion in that module dies. Task 1
loads the real EN catalogs via `import.meta.glob`. Do it first or every later task fights itself.
**Companion titles (Task 17):** `titleFor()` is called from a service-role write path and
PERSISTS the rendered string into `companion_memories.title`, where no request locale exists — so
`t()` inside it is impossible. Plan replaces it with `memoryTitleFor()` returning a
`{key, values}` descriptor, writes `title: null` for discovered memories, renders at READ time
(L9b Journal). Also fixes the P12 violation: "giai đoạn 2" → four phase-specific phrasings
containing no numbers.
**Third false-trial instance found in the browser pass**, missed by grep: the REGISTER page reads
"Start your 7-day trial" (`app/[locale]/(auth)/register/page.tsx:9`). All three now tabulated in
plan Task 5. Its "No card required." subtitle is TRUE and stays.
**Honest gap in the plan:** Tasks 1–5 and 17 carry full code; Tasks 6–16 carry exact file lists,
namespace, per-module notes and the 9-step procedure, but not pre-written catalogs — deliberate,
since ~1500 VN strings written blind would be worse than written with the source open. The
binding VN terminology glossary + key-naming convention at the top of the plan are what keep 20
independently-executed tasks consistent.

## Plan 2/3 (Design System Foundation) — ✅ MERGED to master (`fcd35af` --no-ff, 2026-07-18)

All 12 tasks done via subagent-driven-development, every task review clean; final whole-branch
review (fable): READY TO MERGE = YES. **User chose merge-now BEFORE the manual browser pass —
that pass is STILL OWED on master** (checklist below). Local branch deleted; NOT pushed (remote
holds stale `origin/layer-9a-design-system` — prune when pushing). Post-merge verify on master:
tsc 0 · 1293/1293. Gates at tip: **tsc 0 · unit 1293/1293 (175 files) · lint exit 0 (80
pre-existing warnings predate branch, 0 new) · build OK · playwright 2/2**. Plan doc (with
execution addendum): `docs/superpowers/plans/2026-07-18-l9a-design-system.md`.

**Shipped:** middleware-composition regression test (`middleware.test.ts` — auth 3xx
short-circuit + Set-Cookie carry, mutation-proven); full token system in `app/globals.css` +
`tailwind.config.ts` (spacing 2xs–3xl, type scale caption→display + `leading-jp`, elevation
raised/overlay/floating w/ dark variants, motion duration/ease tokens, z ladder nav/overlay/
popover/toast) guarded by `lib/design-tokens.test.ts`; primitive→semantic colour tiers
(bit-identical values, exact-mapping test); Radix boundary (ESLint P8 + fire-tests incl.
deep-import, jsdom polyfills, §8 logical-properties scan test); 8 primitives in
`components/ui/` (dialog w/ real focus trap — admin dialog now a thin wrapper, L7 WCAG 2.4.3
debt repaid; tabs; select flat-options; tooltip; popover; toast + `useToast` + ToastProvider
mounted in `app/[locale]/layout.tsx`; badge; skeleton); living style guide at
`/[locale]/admin/style-guide` behind requireAdmin (D9), nav item in AdminShell.

**LOAD-BEARING new in Plan 2 — never "clean up":**
1. **`lib/utils.ts` uses `extendTailwindMerge` configured with EVERY custom scale.** Plain
   `twMerge` misclassifies `text-body`/`text-caption` as colours and silently STRIPS them in
   `cn()` (the final review's one Critical — it corrupted Badge/Select/Tabs). **Any new token
   scale added to tailwind.config.ts MUST also be added to this config**; `lib/utils.test.ts`
   is the guard.
2. `.eslintrc.json` `components/ui/**` override RESTATES the import rule minus the Radix
   pattern (ESLint overrides replace wholesale — editing one copy requires editing both;
   `lib/eslint-rules.test.ts` fire-tests are the net).
3. Style-guide elevation swatches use a literal class map — dynamic `shadow-${x}` is never
   emitted by Tailwind static extraction.
4. Dialog: explicit `aria-modal` + manual focus capture/restore (Radix 1.1.19 doesn't provide
   them for an external-trigger API); ordering is layout-effect-vs-passive-effect, verified.
5. Tailwind `fontWeight`/`letterSpacing` overridden with identical-value var() refs (deliberate).

**Manual browser pass STILL OWED on master (merge happened first, user's choice):** at `/vi/admin/style-guide` —
(1) badge-variant AA contrast in both themes (reviewer estimates tinted variants may be near/
below 4.5:1 — if failing, darken text tones), (2) three visibly distinct elevation shadows,
(3) tab/select/badge text sizes match the type-scale section, (4) dialog focus trap, theme/
reduce-motion/locale controls, toasts.

**Deferred by final-review triage:** scrim-dark-check scope + popover vi.fn + tabs arrow
coverage + select disabled/ref tests → Plan 3 or L9b; toast dismissLabel + viewport label
i18n → Plan 3 (by design, P4); useToast fresh-object + toast queue cap + per-instance
TooltipProvider skip-delay → L9b/L9c; JP colour comments cosmetic → L9b.

**Plan 3 (string extraction + VN) remains NOT WRITTEN.** Its must-dos (from Plan 1 review)
unchanged below, plus: pass translated `closeLabel`/`dismissLabel` into Dialog/ToastProvider.

---

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
