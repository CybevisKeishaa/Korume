# Layer 9a — Localization & Design System Foundation

> **Status:** Design approved 2026-07-17. **Not implemented.** Where this spec and the code
> disagree once implementation starts, **the code is right and this file is a bug** — say so,
> fix the spec, do not force reality to match the plan. (Spec A's hardest-won lesson, saved six
> times: an instruction that contradicts reality is a wrong instruction.)
> **Scope:** Make localization and the design system **capabilities of the platform**. Application
> shell only — no learning-content localization, no schema change.
> **Position in the roadmap:** L9a is the foundation for L9b (surfaces) and L9c (polish + perf
> audit). Companion Plans 2/3 are hard-blocked on it. L8 (PayOS billing) comes after L9b.
> **Related:** root `CLAUDE.md` §2 (non-negotiables), §5 (a11y), §6 (conventions), §9 (DoD) ·
> `japanese-learning-app-spec.md` §8 (VN-first) · `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md`
> (the capability-boundary pattern this spec follows) · Serena `mem:project_status`,
> `mem:feature_backlog_deferred` items #10 (i18n site-wide), #4 (badge icons).

---

## 1. Problem

The app is functionally complete through Layer 7 plus the Companion Core, but its **foundation
does not match what it is about to become**.

**Localization does not exist.** No i18n library, `<html lang="en">` hardcoded, and English
strings baked into 131 `.tsx` files. The product launches **VN-first** (`japanese-learning-app-spec.md`
§8), so today's shell is wrong for every intended user. This has been deferred since Layer 5 as
a deliberate one-time site-wide decision (`mem:feature_backlog_deferred` #10) — that decision is
now due.

**The design system is a stub.** `globals.css` + `tailwind.config.ts` define colours, one radius,
two fonts, and one keyframe. `components/ui/` holds six primitives (`button`, `card`, `container`,
`input`, `label`, two toggles). Every layer from L2 to L7 therefore invented its own Tailwind
inline — there is no dialog, tabs, select, badge, skeleton, toast, tooltip, or popover to reuse,
no spacing scale, no typography scale, no elevation or motion tokens.

**Both are the same problem.** L9b must build the landing page, twelve feature UIs, the tutorial,
and the Companion surfaces. Building them on a stub design system and a monolingual shell means
building them twice — and L9c's polish/perf audit would then run against a UI that is already
being rewritten. This is precisely why the audit was split out into L9c: **polish what exists,
after it exists.**

### 1.1 What this spec is really answering

Not *"which i18n library do we use?"* — that is an implementation detail. The question is:

> **Localization and the design system are capabilities of the platform. The foundation owns
> those capabilities entirely; features merely consume them.**

This mirrors the AI Provider Abstraction (Spec A): application code speaks a port, never an SDK.

---

## 2. Principles (binding)

These are the decision filter for L9a. Each one carries a **verification mechanism** — §2.9
explains why that column is mandatory rather than decorative.

| # | Principle |
|---|---|
| **P1** | **i18n is a system boundary, not a translation library.** Feature code never depends on the routing framework, the navigation framework, or the i18n library. It talks only to the localization layer. |
| **P2** | **All navigation is locale-aware by default.** Every navigation in the system preserves the current locale. A feature never decides what locale goes in a URL. |
| **P3** | **Localization MUST NOT weaken existing security boundaries.** Adding a locale prefix must not change the semantics of authentication, authorization, or route protection. This holds for any future routing change, not just this one. |
| **P4** | **Each feature owns its namespace.** Namespacing exists for ownership, not tidiness. A feature must not depend on another feature's messages. A string needed by several features is promoted to a shared namespace. |
| **P5** | **Localization scales along feature and locale axes independently.** Adding a feature = adding that feature's messages, with no need to understand the localization system. Adding a locale = changing no feature. |
| **P6** | **Application Localization ≠ Content Localization.** The foundation owns the app chrome. Learning content is a different domain and a future, independent layer. |
| **P7** | **Adding a locale is configuration, not refactoring.** Add catalog → register locale → translate. Features, business logic, and UI stay untouched. |
| **P8** | **The design system's contract is stable; its implementation is a detail.** Features must not know or depend on whether a primitive is built on a headless library or written in-house. |
| **P9** | **Backward compatibility during rollout.** After every commit, un-migrated features keep working normally. Each step changes exactly one kind of risk. |

### 2.9 Why every principle must carry a verification mechanism

A principle that lives only in a document is a principle that decays. **The foundation must prove
its own contracts, continuously** — every architectural invariant needs a corresponding
enforcement in the compiler, lint, a test, or CI.

The repo has direct precedent: `.eslintrc.json` forbids importing a provider SDK outside
`lib/ai/providers/`, and Spec A recorded the matching lesson — **the rule was verified to actually
fire, not merely to exist.** L9a inherits that standard: an added lint rule ships with a test
proving it fires on a violation.

| Principle | Enforced by |
|---|---|
| P1 | ESLint `no-restricted-imports`: `next-intl` forbidden outside `lib/i18n/**` |
| P2 | ESLint: `next/link` forbidden by default; named imports `redirect`/`useRouter`/`usePathname` forbidden from `next/navigation` outside `lib/i18n/**` |
| P3 | Middleware security-matrix test: every protected prefix × every locale × signed-out ⇒ must redirect. The table is **generated from the `locales` constant**, so a new locale is covered automatically and CI fails if it is not |
| P4 | Namespace = catalog filename; code review |
| P5, P7 | Catalog-parity test: identical key sets and identical ICU argument sets across all locales |
| P8 | ESLint: `@radix-ui/*` forbidden outside `components/ui/**` |
| P9 | The full regression suite must stay green at every commit |

**P2's rule is deliberately narrow.** `next/navigation` also exports `useSearchParams`, `useParams`,
and `notFound`, none of which have anything to do with locale. Banning the whole module would be
banning the wrong thing; the rule restricts *named imports*, not the module.

---

## 3. Decisions

### D1 — Library: `next-intl`

**Chosen.** Decisive factor: the repo mixes 65 client components with server components, and
`next-intl` works in **both** under the App Router. It also supplies `[locale]` routing with
`localePrefix: 'always'` (D2), real ICU message format, and type-safe messages via TS module
augmentation — so a wrong key is a `tsc` error, which is what turns a 131-file refactor into
something the compiler checks.

Rejected: **`react-i18next`** — largest ecosystem, but RSC support must be hand-rolled and it pulls
everything client-ward, against this codebase's grain. **DIY `getDictionary()`** — zero deps, but
we would re-implement interpolation, plurals, and date/number formatting; i.e. re-implement ICU.

### D2 — Locale routing: `localePrefix: 'always'`

`/vi/...` and `/en/...`; `/` redirects to the negotiated locale. Fully symmetric — no locale is
special-cased, so `ja`/`zh`/`ko` need no new thinking (P7). Cost: `app/` moves under
`app/[locale]/`, and `/` costs a redirect.

Rejected: **as-needed prefix** (clean VN URLs, but the default locale becomes a special case);
**cookie-only, no routing** (cheapest, but forfeits per-locale SEO and language-correct shareable
links).

### D3 — Locales: `vi` (default) + `en`, both first-class from day one

VN is the default and is completed first; EN is secondary but supported from the start. The
architecture must admit further locales without touching feature logic.

**This is far cheaper than it sounds**, for a non-obvious reason: because the shell is currently
**all English**, extracting strings to a catalog yields the EN catalog *verbatim, for free*. The
real work is the VN translation, not the bilingual infrastructure.

### D4 — Catalog: per-module files, `en` as the type source

`messages/<locale>/{common,nav,auth,kanji,vocab,grammar,videos,shadowing,dictation,mining,jlpt,reading,conversation,community,playlists,leaderboard,dashboard,profile,admin,companion}.json`,
merged in `lib/i18n/request.ts`.

Rationale is P4 (ownership) plus `CLAUDE.md` §6 (one purpose per file; extract past ~300 lines).
A flat catalog for 131 UI files becomes a ~2000-line file that every module edits — a merge-conflict
engine during L9b. **`en.json` is the type source** because EN is authored first (verbatim
extraction); parity with `vi` is guaranteed by test, not by convention.

### D5 — Locale persistence: cookie + URL prefix, no DB column

Follows necessarily from "no schema change in L9a" (D8): a `users.locale` column is a schema
change. Source of truth = URL prefix; `NEXT_LOCALE` cookie carries the preference across visits.
Syncing locale into the DB profile is a **backlog item** (§8).

### D6 — Test strategy: regression suite runs on `en`

62 test files carry **592 assertions** bound to English text (`getByText`, `name: /…/`). The
English strings are extracted **verbatim**, so those assertions keep passing unchanged: the
1190-test suite stays intact and becomes **the safety net for the very refactor that threatens
it**, while simultaneously verifying the EN catalog.

The cost of that choice is that VN copy gets no direct assertion coverage. The **catalog-parity
test is the compensating control** — it guarantees VN has every key with matching ICU arguments.
New features may add locale-specific tests where warranted; the default regression suite stays EN.

Rejected: **assert on message keys** (rewrites all 592, and tests stop reflecting what a user
actually sees); **switch all tests to VN** (rewrites all 592 *during* the refactor — losing the
safety net exactly when it is most needed).

### D7 — Primitives: chosen by behavioural complexity and a11y risk

Not by component type, and not by a fixed list. The criterion:

- Where **accessibility and interaction logic are a solved standard problem** — focus management,
  keyboard navigation, portals, positioning, collision handling — **inherit a proven headless
  foundation** rather than re-implementing it. `CLAUDE.md` §5 makes a11y a requirement, and these
  are exactly the places hand-rolled implementations get it wrong. **The headless foundation
  selected is Radix UI** — headless, so it imposes no look and "cinematic" stays ours. Naming it
  here is not a contradiction of "implementation is a detail": the detail is *hidden from
  features*, not undecided. The foundation must know exactly what it depends on — that is what
  §2.9's `@radix-ui/*` import rule enforces.
- Where a primitive is **mostly presentational or has minimal behaviour** — implement it in-house
  and stay lean.

**P8 is the constraint that makes this safe:** every primitive must expose the same API, the same
design language, and the same quality bar regardless of what powers it. Concretely, `components/ui/*`
**must not leak the headless library's API** (`asChild`, its compound components) to feature code.
Where a compound pattern genuinely is the best API, **we adopt the pattern as our own** rather than
re-exporting the import. Without the ESLint rule in §2.9, this principle would rot within one layer.

### D8 — Application Localization only; no content localization, no schema change

L9a localizes the **application chrome**: navigation, buttons, dialogs, forms, toasts, metadata,
accessibility strings, shell, dashboard, profile, Companion UI, and (in L9b) landing.

**Learning content — kanji, vocab, grammar, JLPT, reading passages, transcripts — is a different
domain.** It stays VN for every locale; an EN user sees an EN shell over VN content. Localizing it
will be an **independent content-localization layer**, designed when the need genuinely
materialises. L9a deliberately **does not** design its schema or data model — locking the
architecture before the problem is understood is the failure mode to avoid.

### D9 — Style guide: an executable specification inside the app

A route in the app, gated to dev/admin, running on the **real** routing, provider, theme, tokens,
locale, and component implementations. It is not documentation *about* the system; it is a
**design-system laboratory**: all tokens, every primitive in every state and variant, and a place
to exercise theme, locale, responsive, and a11y in one environment. Because it shares the
implementation, it cannot drift.

Rejected: **Storybook** (a whole second build pipeline plus RSC config to maintain);
**markdown docs** (not living — guaranteed drift).

---

## 4. Architecture

### 4.1 The localization capability

```
lib/i18n/
  routing.ts     defineRouting({ locales: ['vi','en'], defaultLocale: 'vi',
                 localePrefix: 'always' })  ← single source of truth for locales
  navigation.ts  createNavigation(routing) → locale-aware Link / redirect /
                 useRouter / usePathname   ← the ONLY navigation feature code may import
  request.ts     per-request config; merges per-module catalogs
  index.ts       barrel: the public contract
messages/
  vi/*.json      en/*.json
```

**Honest boundary of the abstraction.** The AI-port analogy holds only halfway, and the spec must
not overclaim. The AI port wraps two operations behind a network boundary, so swapping Anthropic
for Gemini is real. i18n is not swappable to that degree:

- **Genuinely wrapped** — translation access, navigation, reading the current locale. This is
  100% of the surface feature code touches.
- **Not wrapped, and needn't be** — `NextIntlClientProvider` in the layout, `lib/i18n/request.ts`,
  middleware composition, `setRequestLocale`. These are App-Router-level wiring. **No feature
  touches them**, so they sit wholly inside the foundation and the contract holds.

Therefore the truthful claim is: **replacing the i18n library means rewriting `lib/i18n/**`, with
zero feature changes** — not "zero changes anywhere". What makes this worth doing is that **ICU
message format is an industry standard, not a `next-intl` invention**: the catalogs — the real
asset, and the expensive one — remain portable even across a library change.

### 4.2 Middleware composition — and the security invariant

**A real vulnerability, not a nit.** `lib/supabase/middleware.ts` matches `PROTECTED_PREFIXES`
against `pathname === "/dashboard"` / `startsWith("/dashboard/")`. Once the URL becomes
`/vi/dashboard`, **no prefix matches** ⇒ `isProtected === false` ⇒ **no auth check, and a
signed-out visitor walks straight in.** Every protected route silently opens. No existing test
catches it, because the current tests are unit-level.

This is the direct consequence of D2, and it is why P3 exists as an architectural invariant
rather than a bug report. **Phase 1 must fix it in the same step as the directory move.**

Composition order:

1. Run `intlMiddleware(request)`. If it returns a redirect (URL missing a prefix), **return
   immediately** — this avoids a `supabase.auth.getUser()` network round-trip on every bare URL.
2. Otherwise pass the intl response into `updateSession(request, response)` so Supabase's cookies
   land on that response.

Required changes to `lib/supabase/middleware.ts`:

- `updateSession` takes a `response` to mutate (new signature).
- `PROTECTED_PREFIXES` matches against the **locale-stripped** pathname.
- Redirects become `/${locale}/login`, `/${locale}/dashboard`.

### 4.3 Navigation

`createNavigation(routing)` exports locale-aware `Link`/`redirect`/`useRouter`/`usePathname`.
**32 files** import `next/link` and **17 files** import from `next/navigation`; all move to
`@/lib/i18n/navigation`, or links drop the locale (P2).

### 4.4 The design system capability

**Tokens.** Extend `globals.css` from four groups (colour, radius, font, one keyframe) to a full
system: **spacing**, **typography** (size / line-height / weight / tracking), **elevation**,
**motion** (duration + easing as tokens, instead of `0.6s cubic-bezier(...)` scattered through
CSS), **z-index**.

Keep what already works, untouched: HSL channels with `<alpha-value>`, light/dark via
`data-theme`, and the global reduce-motion kill-switch (`CLAUDE.md` §2.4, §5).

**Semantic layer.** Today `--primary` is simultaneously the brand colour and the button colour.
Split into two tiers: primitive (`--vermilion-500`) → semantic (`--action-primary`,
`--surface-raised`, `--text-muted`). L9b restyling then means remapping semantics, not editing
131 files.

**Primitives.** Add what L9b will certainly need: `dialog` (with a focus trap — this also repays
the L7 debt), `tabs`, `select`, `badge`, `skeleton`, `toast`, `tooltip`, `popover`. Each:
keyboard-navigable, AA contrast, tested — per `CLAUDE.md` §9.

### 4.5 Two capabilities, and exactly where they touch

Localization and the design system are **independent capabilities** that happen to share a layer.
A feature can consume the design system with little localization, or vice versa. This keeps L9a
modular instead of one monolith that must complete all at once. The design-system track can run
in parallel with i18n once Phase 1 lands.

**But independence is not absolute, and the spec says so rather than claiming otherwise.** They
touch in exactly two places:

1. **Typography tokens must serve the locales.** Vietnamese stacks two tiers of diacritics, and
   Japanese wants a different line-height from Latin script. This is a requirement i18n places
   *on* the design system.
2. **The style guide consumes both** — it exists to verify theme × locale × responsive × a11y in
   one environment (D9).

Outside those two, they build, ship, and test independently.

---

## 5. Rollout

Each phase changes **exactly one kind of risk**. Routing changes are never combined with
localization changes, so a red test is never ambiguous about its cause, and review stays clear.
Per P9, un-migrated features keep working after every commit.

### Phase 1 — Architecture. Zero visible change.

Work: `git mv app/*` → `app/[locale]/`; middleware composition **plus the §4.2 security fix plus
the security-matrix test**; provider + `lib/i18n/**`; swap 32 `next/link` + 17 `next/navigation`
files to the foundation's navigation; enable the ESLint rules **and verify each actually fires**;
update the 2 Playwright e2e specs to prefixed URLs. **All text stays hardcoded English.**

**Definition of done:** the localization architecture exists; **user-visible behaviour is
unchanged**; the full regression suite is green; the security boundary is intact (proven by the
matrix test, not asserted).

### Phase 2 — Extraction, module by module.

Per module: extract EN **verbatim** → catalog → replace with `t()`. That module's tests get the
provider wrapper **at that moment**, so churn touches only files that genuinely need it — not all
64 up front.

**Definition of done:** no hardcoded UI strings remain within the migrated module's scope; the
feature consumes the localization layer exclusively.

### Phase 3 — Vietnamese.

Fill the `vi` catalog. The parity test is the gate.

**Definition of done:** Vietnamese is a first-class locale; every supported locale passes parity
verification.

### Design system track

Tokens → semantic layer → primitives → style guide. Runs in parallel after Phase 1 (§4.5).

---

## 6. Testing

Three new foundation-level test kinds, all pure and deterministic (`CLAUDE.md` §7):

1. **Catalog parity** — identical key sets and identical ICU argument sets across all locales,
   generated from the `locales` constant. This is what makes P5 and P7 true rather than hoped-for.
2. **Middleware security matrix** — protected prefix × locale × signed-out ⇒ redirect. Table
   generated from `locales`, so a new locale is covered whether or not anyone remembers.
3. **ESLint rule tests** — each rule proven to fire on a violation (Spec A's standard).

Plus `test/render.tsx`, wrapping `NextIntlClientProvider(locale='en')`, adopted per module during
Phase 2.

---

## 7. Risks

1. **Auth bypass via locale prefix** (§4.2) — the highest-severity item. Addressed in Phase 1 and
   proven by the matrix test.
2. **A forgotten `setRequestLocale` on a page** silently drops that page out of static rendering.
   No error — just slower. L9c's perf audit will catch it; recorded here as a known trap.
3. **Client message payload.** With 65 client components, `NextIntlClientProvider` ships the
   **entire** catalog in the RSC payload by default. Phase 1 deliberately ships all of it for
   simplicity, and this is filed as a **specific item for the L9c perf audit** — optimising early
   would complicate the architecture for a cost we have not yet measured.
4. **Playwright e2e** — 2 specs use unprefixed URLs; updated in Phase 1.
5. **Long-term: catalog quality at scale.** As locales multiply, maintaining catalog quality and
   consistency becomes a **larger problem than the i18n infrastructure itself**. Not L9a's job,
   but recorded now: this will eventually need a real translation-management, review, and
   versioning process rather than continuing to treat catalogs as "just JSON files".

---

## 8. Out of scope (recorded, not forgotten)

Per the standing mandate (2026-07-14) that no brainstormed feature is silently dropped, these
go to `mem:feature_backlog_deferred`:

- **Content localization** — an independent layer; designed when the need is real (D8).
- **Locale synced to the DB profile** — needs a schema change (D5).
- **Badge icons** — `badges.icon_url` all null; a content/design task (backlog #4).
- **Feature UIs, landing, tutorial, Companion surfaces** — L9b, consuming this foundation.
- **Product-level polish, animation, perf audit** — L9c.

### 8.1 One defect fixed in passing

The landing page reads **"Start free trial"**. The business model has **no trial**
(`docs/product/business-model.md`; conversion is Contextual Discovery). Phase 2 corrects the copy
rather than faithfully translating a falsehood into Vietnamese.

---

## 9. The outcome that matters

Not "the app supports two languages". The outcome is:

> **After L9a, localization and the design system are platform capabilities. Adding a new locale
> or building a new feature UI no longer requires changing the foundation — it only requires
> consuming the capabilities L9a provides.**

Foundation provides capability; the layers above consume it without needing to know how it is
implemented underneath.
