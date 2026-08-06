# Figma Make Adoption — Token & Typography Foundation — Design

> **Status:** Approved by user (Trần Nguyễn Phi Long) on 2026-08-06, brainstormed in conversation.
> Ready for `superpowers:writing-plans`.
>
> **Trigger:** The Korume rebrand Plan B merged (`44521bc`), clearing the gate recorded in
> `mem:figma_make_design_source`. The user has designed 29 screens in a Figma Make project whose
> visual language shares nothing with the shipped L9a-Plan-2 palette. Before any of those screens can
> be ported, the token layer has to stop disagreeing with them.
>
> **Amends** `app/globals.css` (both colour tiers, radius, elevation, font tokens),
> `tailwind.config.ts` (radius scale, font families, one new colour), `lib/design-tokens.test.ts`,
> `lib/design-tokens.contrast.test.ts`, `components/ui/button.tsx`, `components/ui/badge.tsx`,
> `app/[locale]/layout.tsx`.
>
> **Supersedes** the "keep the Japanese primitive names — only re-VALUE the primitive tier"
> recommendation recorded in `mem:figma_make_design_source` § B. See §2.3 for why the user overruled
> it and why the cost turned out to be far lower than that memory assumed.
>
> **Does NOT touch** any screen, `docs/design/**`, navigation, or the Companion boundary.

---

## 1. Scope

This spec closes the first two steps of the sequence the user set:

1. **Chốt token dark Korume** (colour, radius, elevation) ← this spec
2. **Chốt font có tiếng Việt** ← this spec
3. Verify the 8 `components/ui/**` primitives against the new tokens ← next spec
4. Layout primitives + shared shell / AppNav ← next spec
5. Port screens by group ← later
6. Polish ← later

The user's ordering rationale, recorded because it changes how the porting spec is written:
**Token → Component → Layout primitives → Pages**, *not* screen-by-screen (Hub → Practice →
Companion → …). Once tokens and the shared primitives are correct, most of the 29 screens reduce to
layout work. Porting screen-first would re-litigate the same button, card and badge decisions 29
times.

**Explicitly out of scope**, and deferred to the screen-port workflow spec that follows this one:
porting any screen; an `AppShell` / navigation-mode contract; the four-way screen classification
(app page / immersive / workspace / overlay); and every category-C divergence ruling (Figma Make vs
`docs/design/**`). Nothing in this spec creates or resolves a category-C conflict, because it never
looks at a screen.

### 1.1 Governing principles (locked here, detailed in the next spec)

Recorded now so the porting work cannot drift from them:

- **Figma is the design source of truth, one-directionally.** `Figma → design tokens → React UI`.
  Never the reverse. When shipped UI disagrees with Figma, the repo changes.
- **Production code lives only in real Next.js routes and components.** This repo has no `src/`;
  the App Router already treats a route as a screen. No parallel `screens/` layer.
- **Figma exports are never committed as source.** They are read, compared against, and ported —
  they do not become canonical code, do not enter the runtime, and do not sit in the repo as dead
  code (CLAUDE.md §6). The canonical pair is: *the live Figma file* ↔ *the running route*.
- **Navigation and screen chrome obey `docs/design/screens/navigation-system.md`** and the Nav Column
  mechanism shipped in `44521bc`. If a `navigation="app" | "none" | "focus"` distinction is needed,
  it must be expressed through the existing governance point or upgrade it there — not by inventing
  a second layout API.

**Recorded intent, no action here (user, 2026-08-06):** once the ~30 screens settle, Figma should be
promoted from a pile of screen mockups to a *design-system file* — colours, typography, spacing,
elevation, radius, and the component set (buttons, cards, inputs, sidebar, dialogs, drawers, empty
states, loading, charts, Companion/Lesson/Study components) extracted as reusable library entries.
New screens then get assembled from components instead of re-prompted from scratch. This is work
inside Figma, not in this repo; it is noted so the sequencing is not lost.

---

## 2. Architecture

### 2.1 Two tiers stay

Primitive tier = raw material palette. Semantic tier = the UI roles that Tailwind and every component
consume (`bg-primary`, `text-muted-foreground`, …). Collapsing to one tier would be cheaper to write
once and worse forever: it breaks the `PRIMITIVE_TOKENS` / `SEMANTIC_COLOR_TOKENS` split that
`lib/design-tokens.test.ts` enforces, and it forfeits the property that a restyle is a remap of ~25
aliases rather than an edit of 131 files.

The semantic tier **keeps its shadcn names**. 92 usages of `bg-primary`/`text-primary-strong` and the
whole `tailwind.config.ts` colour map depend on them.

### 2.2 Dark-only, mechanism retained

Dark values live directly in `:root`. **No `[data-theme="light"]` block is written.**

`components/providers/theme-provider.tsx`, the `data-theme` attribute, and
`components/ui/theme-toggle.tsx` (plus its tests) all stay. Only the *mount points* change:

| Mount point | Action |
|---|---|
| `components/layout/app-nav.tsx:130` | remove |
| `components/layout/site-header.tsx:18` | remove |
| `components/style-guide/style-guide.tsx:52` | **keep** — the admin style guide is precisely where a future light palette would be previewed |

Restoring light mode later is then "write one block of values", not "rebuild the mechanism". This was
the user's explicit condition, motivated by a possible future marketing landing page.

### 2.3 Primitive tier is renamed, not just re-valued

The user overruled the earlier recorded plan to keep `--vermilion-*` / `--indigo-*`. Reason: those
names would be lying. `#ff8a3d` is a warm orange, not 朱色 vermilion, and indigo (cool, technical) is
being removed from the system entirely because it contradicts the Korume DNA (dark / warm / calm /
quiet).

**The cost is much lower than `mem:figma_make_design_source` assumed.** Verified: primitive token
names appear in exactly **two** places — `app/globals.css` and the `PRIMITIVE_TOKENS` array in
`lib/design-tokens.test.ts`. `components/style-guide/style-guide.tsx` references them **zero** times,
and no component references them at all. The memory's warning that renaming "would forfeit the
enforcement tests" was wrong and is corrected by this spec.

New primitive names are neutral material names: `void` (surfaces), `paper` / `ink` (extremes),
`slate` (neutral greys + hairlines), `ember` (the one accent), `sand` / `gold` / `clay` (support),
`mint` (success), `coral` (danger).

⚠️ `--accent` must **not** be used as a primitive name — it is already a semantic-tier name. The two
tiers cannot share an identifier.

### 2.4 Notation: hex in the spec, HSL channels in CSS

The design values are recorded here as `#hex` for easy comparison against Figma. **Runtime CSS stores
HSL channels without the `hsl()` wrapper**, because `tailwind.config.ts` consumes them as
`hsl(var(--x) / <alpha-value>)` and `lib/design-tokens.contrast.test.ts` parses that exact shape.
Putting hex into `--primary` would silently break `bg-primary/80`, `border-border/50`, and the
contrast test in one move.

### 2.5 Alpha hairlines are flattened deliberately

Figma expresses hairlines as `--border: rgba(255,255,255,0.065)` and `--input: rgba(255,255,255,0.07)`.
Tailwind's `<alpha-value>` placeholder cannot carry a non-1 default alpha, so these are **composited
against `--card` `#171a20`** — the surface where hairlines overwhelmingly appear — and stored opaque:

| Alpha | Composite over `#171a20` | HSL |
|---|---|---|
| 0.065 (`--border`) | `#26292e` | `217 10% 16%` |
| 0.07 (`--input`) | `#272a30` | `220 10% 17%` |

The two differ by **1% lightness** — below the threshold of perception. Per the user's ruling this is
**export/tooling noise, not a design signal**, so both collapse to one primitive `--slate-800`
(`217 10% 16%`). Keeping two near-identical primitives is exactly the drift this spec exists to remove.

Accepted trade-off: a hairline drawn on `--background` rather than `--card` renders slightly lighter
than the design intends. This is legitimate only because the app is dark-only, so the backdrop is
known in advance.

---

## 3. The palette

### 3.1 Primitive tier

Computed from the design hexes; contrast verified in §3.3. **Every primitive listed here has a
semantic consumer in §3.2** — there are no orphans.

```
--void-950:  220 21% 5%;    /* #0b0d11 */
--void-900:  220 20% 9%;    /* #12151b */
--void-850:  220 16% 11%;   /* #171a20 */
--void-800:  220 16% 15%;   /* #20242c */
--slate-800: 217 10% 16%;   /* #26292e — flattened hairline, see §2.5 */
--slate-400: 221 10% 58%;   /* #89909f */
--paper-50:   48 20% 95%;   /* #f5f4f0 */
--ink-950:    24 29%  7%;   /* #16100c */
--ember-500:  24 100% 62%;  /* #ff8a3d */
--sand-400:   29 75% 64%;   /* #e8a05d */
--mint-400:  155 53% 65%;   /* #75d5ad */
--coral-400:   6 75% 62%;   /* #e76557 */
--coral-300:   9 100% 70%;  /* #ff7e67 */
```

#### 3.1.1 Reserved support colours — documented, NOT added as tokens

The design also uses these, but no shipped surface consumes them yet. Adding them now would create
seven tokens with no consumer — dead code by CLAUDE.md §6, and dead entries in the token contract
test. They are recorded here so a screen port can promote one to a real token **at the moment it is
needed**, with its contrast measured then:

| Hex | HSL | Design role |
|---|---|---|
| `#ffb067` | `29 100% 70%` | lighter ember |
| `#2a1b17` | `13 29% 13%` | ember tint surface (`--sidebar-accent`) |
| `#c4a675` | `37 40% 61%` | gold (`--chart-4`) |
| `#7a8291` | `219 9% 52%` | cool slate (`--chart-3`) |
| `#534d47` | `30 8% 30%` | clay (`--chart-5`) |
| `#86dfb8` | `154 58% 70%` | lighter mint |
| `#313640` | `220 13% 22%` | switch track (`--switch-background`) |

### 3.2 Semantic tier

| Token | Primitive | Role |
|---|---|---|
| `--background` | `--void-950` | page |
| `--foreground` | `--paper-50` | body text |
| `--card`, `--surface-overlay` | `--void-850` | cards, popovers, dialogs, toasts |
| `--card-foreground` | `--paper-50` | |
| `--muted`, `--input-background` | `--void-900` | recessed surfaces, field interiors |
| `--muted-foreground` | `--slate-400` | metadata, helper text |
| `--border`, `--input` | `--slate-800` | hairlines |
| `--primary`, `--ring` | `--ember-500` | **the one accent** — primary CTA, focus ring, active state |
| `--primary-foreground` | `--ink-950` | text on ember fills |
| `--primary-strong` | `--ember-500` | ember as text (already ≥4.5:1, needs no lighter tone) |
| `--secondary` **(new token)** | `--void-800` | secondary CTA surface |
| `--secondary-foreground` | `--paper-50` | |
| `--accent`, `--accent-strong` | `--sand-400` | tags, status, soft emphasis — **never a CTA** |
| `--accent-foreground` | `--ink-950` | |
| `--success`, `--success-strong` | `--mint-400` | |
| `--danger` | `--coral-400` | fills |
| `--danger-foreground` **(added during execution — see §3.3)** | `--ink-950` | text on danger fills |
| `--danger-strong` | `--coral-300` | danger as text (see §3.3) |
| `--scrim` | `0 0% 0%` | unchanged — a scrim dims, it does not theme |

**Absorbed drift.** The design's six oranges (`#ff8a3d` ×96, `#f28c52` ×71, `#ffb067` ×69,
`#f28a45` ×62, `#f6a36a` ×21, `#ff8a4c` ×12) and its near-miss card surfaces (`#171a1f`, `#0e1013`,
`#0f1014`, `#0f1217`, `#15181f`, `#12151b`, `#1a1f28`) collapse into the tokens above. Ported screens
consume tokens; they never re-introduce a near-miss hex.

**Success has no declared source.** `theme.css` declares no green at all, but the components use
mint `#75d5ad` (13×) and `#86dfb8` (13×), plus one leak of Tailwind's default `#4ade80` (7×). The
mint family is therefore evidence-based and fits the "no neon" DNA; the `#4ade80` leak is discarded.

**Indigo is deleted.** `--indigo-300` / `--indigo-600` leave the system entirely.

### 3.3 Contrast verification (WCAG AA, CLAUDE.md §2 rule 5)

All pairs measured against the flat 4.5:1 bar (no pairing here qualifies for the 3:1 large-text
exemption). Every pair passes:

| Pair | Ratio |
|---|---|
| `--foreground` on `--background` | 17.67:1 |
| `--foreground` on `--card` | 15.83:1 |
| `--muted-foreground` on `--card` | 5.44:1 |
| `--muted-foreground` on `--background` | 6.07:1 |
| `--primary-foreground` on `--primary` | 8.04:1 |
| `--secondary-foreground` on `--secondary` | 14.13:1 |
| `--accent-foreground` on `--accent` | 8.64:1 |
| `--ink-950` on `--success` | 10.67:1 |
| `--ink-950` on `--danger` | 5.74:1 |

⚠️ **Text on a warm fill must be `--ink-950`, never `--paper-50`.** Measured: `--paper-50` on
`--accent` is **1.98:1** and on `--danger` is **2.98:1** — both far below AA. Every one of these
fills is light enough to need dark text. The plan must not introduce a `*-foreground` that defaults
to the page foreground.

Tint pattern `bg-<c>/10 text-<c>-strong` measured against the **blended** background, on `--card`:

| Token | Ratio |
|---|---|
| primary | 6.37:1 |
| accent | 6.75:1 |
| success | 8.05:1 |
| danger (`--coral-300`) | 6.03:1 |

`--coral-400` `#e76557` in the same tint pattern measures **4.69:1** — passing but with almost no
headroom. Hence the split: `--danger` = `--coral-400` for fills, `--danger-strong` = `--coral-300`
for text. This follows the existing rule that `-strong` means *more contrast*, which points lighter
on dark surfaces.

### 3.4 Radius

Base moves 12px → 20px (`theme.css` `--radius: 20px`; DNA states "20–24px"; cards draw
`rounded-[22px]`).

Steps are declared **absolutely**, not derived, so that a later change to one step cannot silently
skew the others:

```
--radius-sm:  8px;
--radius-md: 14px;
--radius-lg: 20px;
--radius-xl: 28px;
```

An earlier draft also kept an unqualified `--radius: 20px` "compatibility default." It was deleted
during the final fix wave (2026-08-07): `grep -- "var(--radius)"` returned zero hits outside
`docs/`, so it was a token nothing read — forbidden by §3.1.1.

⚠️ Mapped in `tailwind.config.ts` → `theme.extend.borderRadius` as `var(--radius-sm|md|lg|xl)`.
**Not** `calc()`, and **not** `@theme inline` — that is Tailwind v4 syntax and this repo is Tailwind
v3 with `tailwind.config.ts`. (The bundle is Vite + Tailwind v4; do not copy its idioms.)

Four steps, not three: `sm 8px` is retained because it is what Figma's own `@theme` block declares
(`--radius-sm: calc(var(--radius) - 12px)`) and because chips, badges and field interiors need a
radius well below the 20px card value. The point of the change is that the scale is *fixed and
small* — no 10/12/16/18 improvisation — not that it has exactly three rungs.

### 3.5 Elevation

The design's shadows show the same category-A drift as its oranges. One "floating" shadow is written
five ways — `0 18px 40px rgb(0 0 0 /.18)` ×5, `0 16px 34px /.16` ×3, `0 18px 42px /.18` ×2,
`0 18px 42px /.2` ×2, `0 15px 32px /.14` ×2 — and 137 shadow usages are dominated by raw Tailwind
defaults (`shadow-lg` ×11, `shadow-md` ×8, `shadow-xl` ×4, `shadow-2xl` ×3) that never passed through
a token at all.

The three existing tokens are re-valued to the design's intent — *almost invisible, soft, premium;
never Material*:

| Token | Value |
|---|---|
| `--elevation-raised` | `0 1px 2px 0 rgb(0 0 0 / 0.24)` |
| `--elevation-overlay` | `0 8px 20px -4px rgb(0 0 0 / 0.32)` |
| `--elevation-floating` | `0 18px 40px -8px rgb(0 0 0 / 0.18)` — the canonical form of the five near-misses |

The `[data-theme="dark"]` shadow override block in `globals.css` is deleted along with the rest of
the dark block; these values *are* the dark values now.

**Depth comes from surface lightness, not from shadow.** A black shadow on `#0b0d11` is nearly
invisible by construction, which is precisely the "almost invisible" quality asked for. The real
elevation ladder is `--background #0b0d11` → `--card #171a20` → `--secondary #20242c`; shadow only
assists. Ported screens must not reach for a heavier shadow to create separation that belongs to the
surface step.

**Repo-side drift to sweep in the same pass:** 8 usages of raw `shadow-sm` / `shadow-md` in
`components/` and `app/` bypass the `raised/overlay/floating` scale. Move them onto the tokens.

⚠️ **One design element is held back deliberately.** `shadow-[0_0_12px_#FF8A3D]` (×3) is an orange
glow, which contradicts the Design DNA's own "**No neon**" rule. Two inset uses —
`inset 0 0 0 1px rgba(242,138,69,0.55)` and `inset 0 -2px 0 #FF8A3D` — are a selection ring and an
active-tab underline, i.e. not elevation at all. None of the three becomes an elevation token here;
they are per-screen decisions for the porting spec, where the glow-vs-no-neon conflict gets one
recorded ruling.

---

## 4. Typography

Figma does not specify a typeface. Verified: grepping `Jakarta|Outfit|M PLUS|Noto|Inter|DM Mono|
Mincho|Gothic` across all 21 tier-A design prompts returns **zero** hits — the prompts only ask for
"large / elegant / premium typography". The families present in the bundle were chosen by Figma
Make's generator, not designed. Font is therefore an open decision made here, not a port.

Also corrected: `mem:figma_make_design_source` states the repo fonts are unset `system-ui`
placeholders. They are not — `app/[locale]/layout.tsx:14-19` loads **Inter** and **Noto Sans JP** via
`next/font/google`.

### 4.1 The binding constraint: Vietnamese

Korume is VN-first (L9a). Any face carrying Latin copy must cover two-tier Vietnamese diacritics.
Checked against Next.js's own `font-data.json` (offline, authoritative):

| Face | Vietnamese subset |
|---|---|
| Plus Jakarta Sans | ✅ |
| **Outfit** | ❌ latin, latin-ext only |
| **Noto Serif JP** | ❌ latin only |
| **DM Mono** | ❌ latin, latin-ext only |
| Be Vietnam Pro / Noto Serif / IBM Plex Mono | ✅ |

Three of the four faces the design leans on cannot render Vietnamese — and they were assigned to the
*most* Vietnamese text in the product (large headings, and the whole Companion Diary prose). Shipping
them would drop exactly the heaviest-diacritic characters to a fallback face.

### 4.2 Resolution — roles kept, faces substituted

| Token | Face | Role |
|---|---|---|
| `--font-sans` | **Plus Jakarta Sans** | UI / body: labels, buttons, layout, data |
| `--font-display` | **Be Vietnam Pro** (replaces Outfit) | emotional headings, quotes, story copy, CTA headings |
| `--font-serif` | **Noto Serif** (replaces Noto Serif JP) | Companion Diary reading experience |
| `--font-mono` | **IBM Plex Mono** (replaces DM Mono) | metadata, dates, system labels |
| `--font-jp` | **Noto Sans JP** (unchanged) | Japanese learning content |

`--font-jp` stays sans on technical grounds, not taste: it carries **furigana**, which renders at very
small size above the kanji, and mincho serifs are the first thing to break there. Using Noto Serif JP
for Japanese *prose* inside the Diary is a per-screen decision belonging to a later spec.

Where the substituted faces appear in Figma, the user updates Figma to match — preserving the
one-directional flow of §1.1.

### 4.3 Loading strategy and its trade-off

This raises the app from 2 font families to 5, and Noto Sans JP is already the heaviest asset (CJK).
Mitigation, binding on the implementation:

- All five load through `next/font/google`.
- **Preload only `--font-sans` and `--font-jp`.**
- `--font-display`, `--font-serif`, `--font-mono` use `display: "swap"` and are **not** preloaded.
- Measure LCP before and after, and record both numbers in the plan's completion report. If the
  regression is material it surfaces now, not during the L9c performance audit.

---

## 5. Enforcement — what breaks if not changed in the same commit

Ordered by how silently each one fails.

1. **`lib/design-tokens.contrast.test.ts` will break outright.** It locates the dark theme via
   `css.indexOf('[data-theme="dark"]')` and diffs two theme blocks. With dark moved into `:root` and
   no light block, it must be rewritten to verify a single theme. Its HSL-triplet parser keeps
   working unchanged (§2.4) — only the block-finding logic changes. The pairs in §3.3 are the new
   expected set.
2. **`lib/design-tokens.test.ts`** — replace `PRIMITIVE_TOKENS` wholesale, and bring the contract up
   to cover the **whole** semantic table of §3.2, not just the tokens that happen to be listed today.
   A partially-updated list is worse than none: it reads as protection while leaving new tokens
   unguarded. Explicit closure list —

   - `SEMANTIC_COLOR_TOKENS` must include every row of §3.2: `--background`, `--foreground`, `--card`,
     `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, **`--input-background`**,
     `--ring`, `--primary`, `--primary-foreground`, **`--primary-strong`**, **`--secondary`**,
     **`--secondary-foreground`**, `--accent`, `--accent-foreground`, **`--accent-strong`**,
     `--success`, **`--success-strong`**, `--danger`, **`--danger-strong`**, **`--surface-overlay`**.
   - `REQUIRED_TOKENS` must gain the four radius steps `--radius-sm|md|lg|xl` (plus `--radius`).
   - Bolded entries are the ones either newly introduced by this spec or already present in
     `globals.css` but **never asserted** by the contract — both categories are how a token silently
     falls back to `unset` in the browser.
   - The existing "every semantic token is a `var()` alias of a primitive" assertion still holds for
     all of them except `--scrim`, which stays a literal by design (a scrim dims, it does not theme).
3. **`components/ui/button.tsx` — repoint one variant. No API rename needed.**
   ⚠️ Corrected after reading the files: `Button` **already** exposes
   `primary | secondary | outline | ghost`, and its `secondary` variant merely points at the wrong
   token (`bg-accent text-accent-foreground`). It becomes `bg-secondary text-secondary-foreground`.
   The public API does not change, no call site changes, and `badge.tsx`'s `accent` variant is
   **correct as written** — a Badge is a tag, which is exactly what warm sand is for. It simply
   inherits the new value.

   **The real find in this area is a latent AA failure, not a rename.**
   `components/conversation/message-bubble.tsx:128` pairs `bg-accent/20` with
   `text-accent-foreground`. `*-foreground` is the tone for a *solid* fill; on a 20% tint the surface
   stays dark, so the pairing measures **1.59:1**. It must become `text-accent-strong` (**5.43:1**).
   This is already broken in today's dark theme (indigo/20 + ink-950) and went unseen only because
   nobody uses dark — a concrete instance of risk §7.2. Audit every `bg-<c>/<alpha>` site for the
   same `-foreground`-instead-of-`-strong` mistake while here; the other six accent call sites were
   checked and are correct.
4. **`app/[locale]/layout.tsx`** — the `theme-color` meta is a light hex; it must become `#0b0d11`
   or the mobile browser chrome will clash with the app.
5. **Three canvas/SVG files carry raw hex and do not flow through tokens** —
   `components/companion/companion-sprite.tsx`, `components/video-player/pitch-contour.tsx`,
   `components/video-player/waveform.tsx`. They will not re-colour themselves; review each against
   `#0b0d11`.
6. **`lib/utils.ts` (`extendTailwindMerge`)** — any new Tailwind scale must be registered there or
   `cn()` silently strips classes; `lib/utils.test.ts` is the guard. Verify after adding the radius
   steps and font families.
7. **`components/style-guide/style-guide.tsx`** — the living style guide must render the new palette,
   the four radius steps, and the five type roles. It references no primitive names today, so the
   work is additive.

---

## 6. Testing

- **Token contract** (`lib/design-tokens.test.ts`): every required token exists; every `var()` in
  `tailwind.config.ts` resolves; the reduce-motion kill switch survives the edit.
- **Contrast** (`lib/design-tokens.contrast.test.ts`, rewritten): the §3.3 table, computed from
  `app/globals.css` rather than hardcoded, so a later token edit that breaks AA fails here.
- **Component tests**: `button.test.tsx` and `badge.test.tsx` updated for the `secondary` variant.
- **Existing suite**: the full unit suite (1960 tests at `44521bc`) must stay green — a palette change
  that breaks a snapshot or a class assertion is a real signal, not noise.
- ⚠️ **Run `npm run test:e2e`.** It was skipped at the Plan B merge, and `vitest.config.ts:13`
  excludes `tests/e2e`, so `npm test` structurally cannot cover it. A visual/token change is exactly
  the kind that moves a Playwright selector.
- **Manual pass** on the style guide plus at least one dense real screen (`/dashboard` or `/videos`),
  since 35 routes were only ever eyeballed in light.

---

## 7. Known risks

1. **The local bundle snapshot is already stale.** `C:\Users\tplon\Downloads\Design Shadowing Page UI`
   was downloaded 2026-08-05; its `fonts.css` imports only Plus Jakarta Sans + DM Mono, while the
   user reports the live project now also loads Noto Serif JP. One day of drift. Treat the **live
   Figma Make project** as authoritative and re-check any value before relying on it. This is also
   the concrete evidence for the §1.1 rule against committing snapshots.
2. **Thirty-five routes flip to dark unseen.** No route was designed dark. The token layer makes them
   *consistent*, not *good* — some will look wrong until their own port. That is expected and is not
   a reason to widen this spec.
3. **`--font-jp` and Japanese glyph coverage.** `layout.tsx` requests `subsets: ["latin"]` for
   Noto Sans JP, and Google's metadata lists no `japanese` subset for it (CJK ships via unicode-range
   slicing). Japanese rendering is core product surface — verify glyphs actually render during
   implementation rather than assuming.
4. **Five font families is a real payload increase.** Mitigated by §4.3, measured rather than assumed.

---

## 8. Definition of Done

- [ ] `app/globals.css`: primitives renamed + re-valued, semantic tier remapped, dark in `:root`,
      no light block (including the dark elevation override), four absolute radius steps,
      three re-valued elevation tokens, five font tokens
- [ ] 8 raw `shadow-sm` / `shadow-md` usages swept onto the elevation scale
- [ ] `tailwind.config.ts`: `--secondary` colour, four radius steps via `var()`, four new font
      families — Tailwind **v3** syntax
- [ ] `ThemeToggle` unmounted from app-nav + site-header, retained in the style guide; provider and
      component untouched
- [ ] Both token tests rewritten and passing; contrast table reproduced from CSS
- [ ] `button.tsx` `secondary` variant repointed to `--secondary`; `message-bubble.tsx:128` fixed
      from `text-accent-foreground` to `text-accent-strong`; every `bg-<c>/<alpha>` site audited for
      the same mistake
- [ ] `theme-color` meta, three raw-hex canvas files, and `extendTailwindMerge` all reviewed
- [ ] `npx tsc --noEmit` 0 · `npm run lint` 0 errors (78 warnings = the pre-existing baseline) ·
      `npm test` green · **`npm run test:e2e` run, not skipped**
- [ ] LCP measured before and after, both numbers reported
- [ ] `code-reviewer` sign-off (CLAUDE.md §9)
