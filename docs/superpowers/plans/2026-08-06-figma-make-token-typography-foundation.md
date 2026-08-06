# Figma Make Token & Typography Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the light-first L9a-Plan-2 design tokens with the dark Korume palette, radius,
elevation and typography taken from the Figma Make design, so the 29 designed screens have a token
layer that agrees with them.

**Architecture:** Two token tiers stay. The primitive tier is renamed off the Japanese scheme
(`vermilion`/`indigo`/`washi`/`sumi`) onto neutral material names and re-valued from the Figma
palette. The semantic tier keeps its shadcn names so no component import changes. Dark values move
into `:root` and the `[data-theme="dark"]` blocks are deleted, while `ThemeProvider` and the
`data-theme` mechanism stay so light mode can return as one block of values.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, **Tailwind v3 + `tailwind.config.ts`**,
Vitest + RTL, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md`
(committed `f728731`, revised `4d74ec8`). Read it before starting — this plan implements it and does
not restate its reasoning.

## Global Constraints

- **Tailwind v3 only.** `@theme inline`, `@import 'tailwindcss'`, and `calc()`-derived radius steps
  are Tailwind v4 idioms from the Figma bundle. Never use them here. Token mapping happens in
  `tailwind.config.ts` → `theme.extend`.
- **CSS stores HSL channels, never hex.** `tailwind.config.ts` consumes
  `hsl(var(--x) / <alpha-value>)`; a hex value silently breaks `bg-primary/90`, `border-border/60`
  and both token tests. Hex appears only in trailing comments.
- **No `[data-theme="light"]` block is written.** Dark values live in `:root`.
- **`components/providers/theme-provider.tsx`, `components/ui/theme-toggle.tsx` and their tests are
  not modified or deleted.** Only mount points change.
- **WCAG AA (CLAUDE.md §2 rule 5)** — 4.5:1 for all text pairings, enforced by
  `lib/design-tokens.contrast.test.ts`, which measures the *blended* background for tint patterns.
- **Text on a warm fill is `--ink-950`, never `--paper-50`.** `--paper-50` on `--accent` is 1.98:1
  and on `--danger` is 2.98:1.
- **`-foreground` is for solid fills; `-strong` is for text on a tint.** Using `-foreground` on a
  `bg-<c>/<alpha>` surface is the bug Task 6 fixes.
- **No Figma export code enters the repo** (spec §1.1). The bundle at
  `C:\Users\tplon\Downloads\Design Shadowing Page UI` is a stale reference only.
- **Commit after every task.** Never `--no-verify`.
- **Baseline to preserve:** `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 with **78 warnings**
  (pre-existing; "clean" means zero NEW) · `npm test` **1960 tests / 218 files** green.
- ⚠️ **If a git worktree exists**, `npm test` from the repo root scans it too (`vitest.config.ts`
  excludes `node_modules`, `.next`, `tests/e2e` — *not* `.worktrees/`). Pass
  `--exclude ".worktrees/**"` or remove the worktree first.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `app/globals.css` | Both token tiers, radius scale, elevation, font tokens | 1, 2, 3, 4 |
| `tailwind.config.ts` | Maps CSS vars onto Tailwind scales | 1, 2, 4 |
| `lib/design-tokens.test.ts` | Token existence + alias contract | 1, 2, 3, 4 |
| `lib/design-tokens.contrast.test.ts` | WCAG AA contract, single theme | 1 |
| `lib/utils.ts` | `extendTailwindMerge` custom-scale registration | 4 |
| `components/ui/button.tsx` | `secondary` variant repointed to `--secondary` | 6 |
| `components/conversation/message-bubble.tsx` | Latent AA failure fix | 6 |
| `components/layout/app-nav.tsx`, `components/layout/site-header.tsx` | `ThemeToggle` unmount | 5 |
| `app/[locale]/layout.tsx` | 5 font families, `themeColor` meta | 4, 5 |
| `components/companion/companion-sprite.tsx`, `components/video-player/pitch-contour.tsx`, `components/video-player/waveform.tsx` | Raw hex not flowing through tokens | 7 |
| `components/style-guide/style-guide.tsx` | Living documentation of the new system | 8 |

---

## Task 1: Colour tiers — rename, re-value, collapse to dark-only

**Files:**
- Modify: `app/globals.css:19-114` (both `:root` colour block and the `[data-theme="dark"]` colour block)
- Modify: `tailwind.config.ts:16-56` (add `secondary`)
- Test: `lib/design-tokens.test.ts:44-61,97-169`
- Test: `lib/design-tokens.contrast.test.ts:60-81,131-211`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the primitive names `--void-950|900|850|800`, `--slate-800|400`, `--paper-50`,
  `--ink-950`, `--ember-500`, `--sand-400`, `--mint-400`, `--coral-400|300`; and the semantic tokens
  `--secondary` / `--secondary-foreground` / `--input-background`, which Tasks 6 and 8 rely on.

- [ ] **Step 1: Rewrite the contrast test for a single theme**

The current test splits `globals.css` at `[data-theme="dark"]` and runs every assertion twice. That
block is being deleted, so `darkStart` becomes `-1` and every assertion silently measures garbage.
Replace lines 60-81 and the `describe` body (131-211) so there is exactly one theme.

Replace `lib/design-tokens.contrast.test.ts` lines 60-81 with:

```ts
const primitives = parsePrimitives(css);

/** Parses `--primary: var(--ember-500)` aliases. */
function parseAliases(source: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const match of source.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/g)) {
    const [, name, target] = match;
    if (name && target) aliases.set(name, target);
  }
  return aliases;
}

/**
 * Korume ships dark-only (2026-08-06 adoption spec §2.2): every semantic value
 * lives in `:root` and there is no second theme block to diff against. The
 * `data-theme` mechanism is retained, so if a light block is ever added this
 * file must go back to asserting both.
 */
const theme = parseAliases(css);

function resolve(token: string): Hsl {
  const target = theme.get(token);
  if (!target) throw new Error(`${token} is not defined as a var() alias`);
  const hsl = primitives.get(target);
  if (!hsl) throw new Error(`${token} aliases ${target}, which has no HSL definition`);
  return hsl;
}
```

Then replace **lines 125-211** — that is `SURFACES`, `TINTED`, `THEMES` *and* the `describe` block,
not just `describe`; the replacement below redefines `SURFACES` and `TINTED`, so leaving the
originals in place would be a duplicate-declaration error — with:

```ts
/** Surfaces a tinted element can actually sit on in this app. */
const SURFACES = ["--card", "--background", "--muted"] as const;

/** The four semantic colours used with the `bg-X/10 text-X-strong` pattern. */
const TINTED = ["primary", "accent", "success", "danger"] as const;

describe("design token contrast (WCAG AA)", () => {
  it("defines a -strong text tone for every tinted colour", () => {
    const missing = TINTED.filter((name) => !theme.has(`--${name}-strong`));
    expect(missing).toEqual([]);
  });

  it("tinted pattern (bg-X/10 + text-X-strong) meets 4.5:1 on every surface", () => {
    const failures: string[] = [];
    for (const name of TINTED) {
      const fill = hslToRgb(resolve(`--${name}`));
      const text = hslToRgb(resolve(`--${name}-strong`));
      for (const surface of SURFACES) {
        const blended = alphaBlend(fill, hslToRgb(resolve(surface)), 0.1);
        const ratio = contrastRatio(text, blended);
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(
            `${name}-strong on ${surface} tint: ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL_TEXT})`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("plain -strong text meets 4.5:1 on every surface", () => {
    const failures: string[] = [];
    for (const name of TINTED) {
      const text = hslToRgb(resolve(`--${name}-strong`));
      for (const surface of SURFACES) {
        const ratio = contrastRatio(text, hslToRgb(resolve(surface)));
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(`${name}-strong on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("solid fills keep their paired foreground legible", () => {
    const failures: string[] = [];
    for (const [fill, foreground] of [
      ["--primary", "--primary-foreground"],
      ["--accent", "--accent-foreground"],
      ["--secondary", "--secondary-foreground"],
    ] as const) {
      const ratio = contrastRatio(hslToRgb(resolve(foreground)), hslToRgb(resolve(fill)));
      if (ratio < AA_NORMAL_TEXT) failures.push(`${foreground} on ${fill}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("body and muted text meet 4.5:1 on every surface", () => {
    const failures: string[] = [];
    for (const text of ["--foreground", "--muted-foreground"] as const) {
      for (const surface of SURFACES) {
        const ratio = contrastRatio(hslToRgb(resolve(text)), hslToRgb(resolve(surface)));
        if (ratio < AA_NORMAL_TEXT) failures.push(`${text} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });
});
```

⚠️ **Do not add a test asserting that `--foreground` is *illegible* on `--accent` / `--danger`.**
An earlier draft of this plan did; it was removed before execution by the human partner's ruling.
Such a test encodes an incidental fact about the current palette rather than an invariant, so
darkening `--accent` later would fail it with nothing actually broken. The real protection is the
`solid fills keep their paired foreground legible` test above, plus Task 6's component fix.

Also update the doc comment on line 36 from `--vermilion-500: 4 74% 49%` to `--ember-500: 24 100% 62%`.

- [ ] **Step 2: Update the token contract test**

In `lib/design-tokens.test.ts`, replace `PRIMITIVE_TOKENS` (lines 44-52) and `SEMANTIC_COLOR_TOKENS`
(lines 56-61) with:

```ts
const PRIMITIVE_TOKENS = [
  "--void-950", "--void-900", "--void-850", "--void-800",
  "--slate-800", "--slate-400",
  "--paper-50", "--ink-950",
  "--ember-500", "--sand-400",
  "--mint-400", "--coral-400", "--coral-300",
];

// The semantic tier must be a var() alias of a primitive. This list is the
// WHOLE table from the adoption spec §3.2 — a half-updated list reads as
// protection while leaving new tokens unguarded.
const SEMANTIC_COLOR_TOKENS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--muted", "--muted-foreground", "--input-background",
  "--border", "--input", "--ring",
  "--primary", "--primary-foreground", "--primary-strong",
  "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground", "--accent-strong",
  "--success", "--success-strong",
  "--danger", "--danger-strong",
  "--surface-overlay",
];
```

Then replace the entire last `it(...)` (lines 97-169) with a single-theme version:

```ts
  it("defines every semantic colour as a var() alias of the correct primitive", () => {
    // Exact mappings from the adoption spec §3.2. Korume is dark-only, so there
    // is one block: `:root`. `--scrim` is deliberately a literal, not an alias.
    const mappings: Record<string, string> = {
      "--background": "--void-950",
      "--foreground": "--paper-50",
      "--card": "--void-850",
      "--card-foreground": "--paper-50",
      "--muted": "--void-900",
      "--muted-foreground": "--slate-400",
      "--input-background": "--void-900",
      "--border": "--slate-800",
      "--input": "--slate-800",
      "--ring": "--ember-500",
      "--primary": "--ember-500",
      "--primary-foreground": "--ink-950",
      "--primary-strong": "--ember-500",
      "--secondary": "--void-800",
      "--secondary-foreground": "--paper-50",
      "--accent": "--sand-400",
      "--accent-foreground": "--ink-950",
      "--accent-strong": "--sand-400",
      "--success": "--mint-400",
      "--success-strong": "--mint-400",
      "--danger": "--coral-400",
      "--danger-strong": "--coral-300",
      "--surface-overlay": "--void-850",
    };

    expect(Object.keys(mappings).sort()).toEqual([...SEMANTIC_COLOR_TOKENS].sort());

    for (const [token, primitive] of Object.entries(mappings)) {
      const pattern = new RegExp(String.raw`${token}:\s*var\(${primitive}\)`);
      expect(css, `${token} should alias ${primitive}`).toMatch(pattern);
    }

    expect(css).toMatch(/--scrim:\s*0 0% 0%/);
  });

  it("ships dark-only: no light theme block exists", () => {
    // The data-theme MECHANISM is retained (provider + toggle component stay);
    // only the values are single-theme. Adding a light block means this test and
    // the contrast test must both go back to asserting two themes.
    expect(css).not.toContain('[data-theme="light"]');
    expect(css).not.toContain('[data-theme="dark"]');
  });
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run lib/design-tokens.test.ts lib/design-tokens.contrast.test.ts`
Expected: FAIL — `PRIMITIVE_TOKENS` missing (`--void-950` etc. not in css), semantic aliases not
matching, and `no light theme block exists` failing because `[data-theme="dark"]` is still present.

- [ ] **Step 4: Rewrite the colour tiers in globals.css**

Replace `app/globals.css` lines 5-114 (the doc comment, the `:root` colour block, and the whole
`[data-theme="dark"]` colour block) with:

```css
/**
 * Colour, two tiers (adoption spec 2026-08-06 §2).
 *
 * Primitive tier: the raw Korume palette taken from the Figma Make design.
 * Named after the material, knows nothing about usage.
 *
 * Semantic tier: what features and primitives actually consume (via Tailwind:
 * bg-primary, text-muted-foreground, bg-secondary…). Always a var() alias of a
 * primitive. Restyling the product means editing THIS mapping, not 131 files.
 *
 * Korume ships DARK-ONLY. These values live in :root, and there is no light
 * block. The data-theme mechanism, ThemeProvider and the ThemeToggle component
 * are all retained, so light mode returns as one added block — not a rebuild.
 *
 * Values are HSL channels (no hsl() wrapper) so Tailwind's <alpha-value>
 * works. Trailing hex comments are the design values; they are NOT the format.
 * Every pairing is WCAG AA — enforced by lib/design-tokens.contrast.test.ts.
 */
:root {
  /* — primitive tier — */
  --void-950: 220 21% 5%; /* #0b0d11 page */
  --void-900: 220 20% 9%; /* #12151b recessed */
  --void-850: 220 16% 11%; /* #171a20 card */
  --void-800: 220 16% 15%; /* #20242c secondary surface */
  /* Figma draws hairlines as rgba(255,255,255,.065). Tailwind's <alpha-value>
     cannot carry a non-1 default alpha, so this is that colour composited over
     --card, where hairlines overwhelmingly appear. Legitimate only because the
     app is dark-only and the backdrop is therefore known. The design's separate
     .07 value for inputs flattens to within 1% lightness — export noise, not a
     design signal, so both share this primitive (spec §2.5). */
  --slate-800: 217 10% 16%; /* #26292e hairline */
  --slate-400: 221 10% 58%; /* #89909f metadata */
  --paper-50: 48 20% 95%; /* #f5f4f0 */
  --ink-950: 24 29% 7%; /* #16100c text on warm fills */
  --ember-500: 24 100% 62%; /* #ff8a3d the one accent */
  --sand-400: 29 75% 64%; /* #e8a05d tags/status — never a CTA */
  --mint-400: 155 53% 65%; /* #75d5ad */
  --coral-400: 6 75% 62%; /* #e76557 */
  --coral-300: 9 100% 70%; /* #ff7e67 */

  /* — semantic tier — */
  --background: var(--void-950);
  --foreground: var(--paper-50);
  --card: var(--void-850);
  --card-foreground: var(--paper-50);
  --muted: var(--void-900);
  --muted-foreground: var(--slate-400);
  --input-background: var(--void-900);
  --border: var(--slate-800);
  --input: var(--slate-800);
  --ring: var(--ember-500);
  --primary: var(--ember-500);
  --primary-foreground: var(--ink-950);
  /* Secondary CTA surface (Later / Preview / View Details), per Figma's own
     --secondary. Warm sand is NOT a CTA colour — it is for tags and status. */
  --secondary: var(--void-800);
  --secondary-foreground: var(--paper-50);
  --accent: var(--sand-400);
  --accent-foreground: var(--ink-950);
  --success: var(--mint-400);
  --danger: var(--coral-400);
  /* — text tones —
     A semantic colour used as a FILL and the same colour used as TEXT have
     different contrast requirements. The tint pattern (`bg-primary/10
     text-primary-strong`) paints text on what is effectively the bare surface.
     "-strong" means stronger CONTRAST, which on dark surfaces means lighter.
     Ember, sand and mint already clear 4.5:1 at their base tone, so they alias
     it; only danger needs a lighter step (coral-400 measures 4.69:1 in the tint
     pattern — passing but with no headroom; coral-300 measures 6.03:1).
     Enforced by lib/design-tokens.contrast.test.ts — do not hand-tune. */
  --primary-strong: var(--ember-500);
  --accent-strong: var(--sand-400);
  --success-strong: var(--mint-400);
  --danger-strong: var(--coral-300);
  /* Surface a floating panel (dialog, popover, select menu, toast) sits on. */
  --surface-overlay: var(--void-850);
  /* Backdrop behind modals, used with alpha (bg-scrim/50). A literal, not an
     alias — a scrim dims, it does not theme. */
  --scrim: 0 0% 0%;

  --radius: 0.75rem;
}
```

⚠️ Leave `--radius: 0.75rem` alone here — Task 2 owns it.

**Then delete the second `[data-theme="dark"]` block too** — the elevation override at (currently)
lines 186-191, its comment included. Both dark blocks must go in this task, because Step 2's
`ships dark-only` test asserts the string `[data-theme="dark"]` appears nowhere in the file. Task 3
re-values what those overrides used to say; it does not remove them.

Everything else below line 114 stays.

- [ ] **Step 5: Add the `secondary` colour to tailwind.config.ts**

In `tailwind.config.ts`, insert after the `primary` block (after line 37):

```ts
        // Secondary CTA surface — a quiet dark plane, not a second accent.
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
```

Also update the file's header comment (lines 3-7) so it no longer claims the scale "serves light +
dark themes":

```ts
/**
 * Korume design tokens.
 * Colours are driven by CSS variables (see app/globals.css). Korume ships
 * dark-only; the data-theme mechanism is retained so light mode can return
 * without restructuring. WCAG AA contrast is enforced by
 * lib/design-tokens.contrast.test.ts (CLAUDE.md §2 rule 5).
 */
```

And fix the now-wrong 朱色 comment on lines 30-32:

```ts
        // The single Korume accent — warm ember. `strong` = the legible-as-TEXT
        // tone. Use `text-primary-strong` for words and icons, `bg-primary` for
        // fills. `accent` is warm sand for tags/status and is NOT a CTA colour.
```

- [ ] **Step 6: Run both token tests to verify they pass**

Run: `npx vitest run lib/design-tokens.test.ts lib/design-tokens.contrast.test.ts`
Expected: PASS, all assertions green.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0. Vitest green. If a component test asserts a literal colour class it will fail
here — fix it to assert the semantic class name, not a primitive.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/design-tokens.test.ts lib/design-tokens.contrast.test.ts
git commit -m "feat(tokens): re-value the colour tiers to the Korume dark palette

Primitives renamed off the Japanese scheme onto neutral material names and
re-valued from Figma. Indigo is deleted; one ember accent remains, with a new
--secondary surface for secondary CTAs and warm sand reserved for tags.
Dark values move into :root and both theme blocks are gone, while the
data-theme mechanism stays so light mode can return as one block.

Both token tests rewritten for a single theme; the contract now asserts the
whole semantic table rather than a subset."
```

---

## Task 2: Absolute radius scale

**Files:**
- Modify: `app/globals.css` (`--radius` line inside `:root`)
- Modify: `tailwind.config.ts:61-65`
- Test: `lib/design-tokens.test.ts:23-42` (`REQUIRED_TOKENS`)

**Interfaces:**
- Consumes: the `:root` block from Task 1.
- Produces: `--radius-sm|md|lg|xl` and the Tailwind classes `rounded-sm|md|lg|xl`.

- [ ] **Step 1: Add the radius steps to the contract test**

In `lib/design-tokens.test.ts`, add to `REQUIRED_TOKENS` after the `// spacing` group:

```ts
  // radius — declared absolutely, never derived. A calc()-chained scale means
  // one edit to the base silently skews every other step.
  "--radius", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl",
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts -t "required token"`
Expected: FAIL — `["--radius-sm","--radius-md","--radius-lg","--radius-xl"]` missing.

- [ ] **Step 3: Declare the steps in globals.css**

Replace the `--radius: 0.75rem;` line in `:root` with:

```css
  /* Radius. Base moves 12px -> 20px to match the Figma cards (the design draws
     rounded-[22px] and its DNA states "20-24px"). Steps are ABSOLUTE, not
     calc()-derived, so changing one rung cannot skew the others. `sm` is kept
     because chips, badges and field interiors need a radius well below the
     card value; the point is that the scale is fixed, not that it has 3 rungs. */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius: 20px; /* compatibility default */
```

- [ ] **Step 4: Map the steps in tailwind.config.ts**

Replace `tailwind.config.ts` lines 61-65 with:

```ts
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/design-tokens.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0. The `resolves every var() referenced by tailwind.config.ts` assertion
also covers the four new `var()`s.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/design-tokens.test.ts
git commit -m "feat(tokens): declare an absolute 8/14/20/28 radius scale

Base moves 12px to 20px to match the Figma cards. Steps are declared
independently rather than derived with calc() so one edit cannot skew the rest."
```

---

## Task 3: Elevation re-value and raw-shadow sweep

**Files:**
- Modify: `app/globals.css` (`--elevation-*` in the second `:root` block, and the
  `[data-theme="dark"]` elevation override block)
- Modify: `components/community/save-to-playlist-button.tsx:159,169`,
  `components/layout/notification-bell.tsx:215`,
  `components/reading/word-lookup-popover.tsx:93`,
  `components/ui/card.tsx:10`,
  `components/video-player/mine-line-control.tsx:126`
- Test: `lib/design-tokens.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `shadow-raised` / `shadow-overlay` / `shadow-floating` as the only shadow vocabulary.

Note: `components/ui/button.tsx`'s two `shadow-sm` usages are handled in Task 6 alongside the
variant change, to keep that file in one task.

- [ ] **Step 1: Write the failing test**

Add to `lib/design-tokens.test.ts` inside `describe("design tokens", …)`:

```ts
  it("keeps elevation single-theme and Korume-soft", () => {
    // Depth in Korume comes from the surface ladder (--background -> --card ->
    // --secondary), not from shadow: a black shadow on #0b0d11 is nearly
    // invisible by construction, which is the "almost invisible" quality the
    // design asks for. These three tokens only assist.
    expect(css).toMatch(/--elevation-raised:\s*0 1px 2px 0 rgb\(0 0 0 \/ 0\.24\)/);
    expect(css).toMatch(/--elevation-overlay:\s*0 8px 20px -4px rgb\(0 0 0 \/ 0\.32\)/);
    expect(css).toMatch(/--elevation-floating:\s*0 18px 40px -8px rgb\(0 0 0 \/ 0\.18\)/);
    // Each elevation token is defined exactly once — the dark override block is
    // gone with the rest of the two-theme structure.
    for (const token of ["--elevation-raised", "--elevation-overlay", "--elevation-floating"]) {
      expect(css.match(new RegExp(`${token}\\s*:`, "g"))?.length).toBe(1);
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts -t "elevation"`
Expected: FAIL — values still `0.05`/`0.1`, and each token defined twice.

- [ ] **Step 3: Re-value elevation**

Task 1 already deleted the `[data-theme="dark"]` elevation override block, so each token is defined
once. Replace the three `--elevation-*` lines with:

```css
  /* Elevation. Almost invisible, soft, premium — never Material. The design's
     one "floating" shadow appears five ways (0 18px 40px /.18, 0 16px 34px /.16,
     0 18px 42px /.18, 0 18px 42px /.2, 0 15px 32px /.14); this is its canonical
     form. Real depth comes from the surface ladder, not from these. */
  --elevation-raised: 0 1px 2px 0 rgb(0 0 0 / 0.24);
  --elevation-overlay: 0 8px 20px -4px rgb(0 0 0 / 0.32);
  --elevation-floating: 0 18px 40px -8px rgb(0 0 0 / 0.18);
```

- [ ] **Step 4: Sweep the five raw shadow usages onto the scale**

`shadow-sm` → `shadow-raised`; `shadow-md` → `shadow-overlay` (all five sites are floating panels:
popovers, dropdowns, a notification panel).

- `components/ui/card.tsx:10` — `shadow-sm` → `shadow-raised`
- `components/community/save-to-playlist-button.tsx:159` — `shadow-sm` → `shadow-raised`
- `components/community/save-to-playlist-button.tsx:169` — `shadow-md` → `shadow-overlay`
- `components/layout/notification-bell.tsx:215` — `shadow-md` → `shadow-overlay`
- `components/reading/word-lookup-popover.tsx:93` — `shadow-md` → `shadow-overlay`
- `components/video-player/mine-line-control.tsx:126` — `shadow-md` → `shadow-overlay`

- [ ] **Step 5: Verify no raw shadow utilities remain outside the scale**

Run: `grep -rnE "shadow-(sm|md|lg|xl|2xl|inner)\b" --include=*.tsx components app`
Expected: only `components/ui/button.tsx` lines 9 and 11 (Task 6 owns that file).

- [ ] **Step 6: Run the tests**

Run: `npx vitest run lib/design-tokens.test.ts && npx vitest run components/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/
git commit -m "feat(tokens): re-value elevation and sweep raw shadow utilities

The design writes one floating shadow five ways; this is its canonical form.
Depth in Korume comes from the surface ladder, so the tokens stay almost
invisible. Deletes the dark elevation override block and moves five raw
shadow-sm/md usages onto the raised/overlay scale."
```

---

## Task 4: Typography — five font roles

**Files:**
- Modify: `app/[locale]/layout.tsx:3,14-19,84`
- Modify: `app/globals.css` (`--font-sans` / `--font-jp` lines, currently 122-124)
- Modify: `tailwind.config.ts:57-60`
- Modify: `lib/utils.ts`
- Test: `lib/design-tokens.test.ts`, `lib/utils.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-3.
- Produces: the Tailwind classes `font-sans`, `font-display`, `font-serif`, `font-mono`, `font-jp`,
  which Task 8's style guide renders.

Rationale (spec §4): the design prompts name **no** font — grep of
`Jakarta|Outfit|M PLUS|Noto|Inter|DM Mono|Mincho|Gothic` over all 21 tier-A prompts returns zero
hits. Three faces the bundle uses (Outfit, Noto Serif JP, DM Mono) have **no Vietnamese subset** and
were assigned to the most Vietnamese text in the product, so they are substituted.

- [ ] **Step 1: Write the failing test**

Add to `lib/design-tokens.test.ts`:

```ts
  it("defines all five typeface roles", () => {
    for (const token of ["--font-sans", "--font-display", "--font-serif", "--font-mono", "--font-jp"]) {
      expect(css, `${token} must be defined`).toMatch(new RegExp(`${token}\\s*:`));
    }
  });
```

And add to `lib/utils.test.ts`:

```ts
it("keeps custom font-family utilities out of the font-weight group", () => {
  // twMerge classifies bare `font-*` ambiguously. Without registration it can
  // treat `font-display`/`font-jp` as weights and drop them next to a real one.
  expect(cn("font-jp", "font-medium")).toBe("font-jp font-medium");
  expect(cn("font-display", "font-semibold")).toBe("font-display font-semibold");
  expect(cn("font-sans", "font-display")).toBe("font-display");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/design-tokens.test.ts -t "typeface" lib/utils.test.ts -t "font-family"`
Expected: FAIL — `--font-display` undefined; `cn("font-sans","font-display")` does not collapse.

- [ ] **Step 3: Load the five families in layout.tsx**

Replace `app/[locale]/layout.tsx` line 3 and lines 14-19 with:

```ts
import {
  Plus_Jakarta_Sans,
  Be_Vietnam_Pro,
  Noto_Serif,
  IBM_Plex_Mono,
  Noto_Sans_JP,
} from "next/font/google";
```

```ts
/**
 * Five typeface roles (adoption spec §4). The design names no font, so these
 * are chosen — and three of the bundle's faces (Outfit, Noto Serif JP, DM Mono)
 * are substituted because they have NO Vietnamese subset and Korume is VN-first.
 *
 * Only sans and jp are preloaded: they carry the shell and the learning content.
 * The other three are role fonts that appear below the fold on most screens, so
 * they swap in rather than block paint.
 */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});
const display = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});
const serif = Noto_Serif({
  subsets: ["latin", "vietnamese"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});
const mono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});
// Carries furigana, which renders very small above the kanji — mincho serifs
// break first at that size, so the Japanese role stays sans.
const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
  display: "swap",
});
```

Then replace line 84's `<body>` className:

```tsx
      <body
        className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable} ${notoJp.variable} font-sans`}
      >
```

- [ ] **Step 4: Add the fallback tokens in globals.css**

Replace the two font lines in the second `:root` block (currently 122-124) with:

```css
  /* Font families. next/font in app/[locale]/layout.tsx sets these at runtime;
     the values here are only the pre-hydration fallback. */
  --font-sans: system-ui, sans-serif;
  --font-display: var(--font-sans);
  --font-serif: Georgia, serif;
  --font-mono: ui-monospace, monospace;
  --font-jp: system-ui, sans-serif;
```

- [ ] **Step 5: Map them in tailwind.config.ts**

Replace lines 57-60 with:

```ts
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        jp: ["var(--font-jp)", "var(--font-sans)", "sans-serif"],
      },
```

- [ ] **Step 6: Register the custom families with twMerge**

In `lib/utils.ts`, add to `classGroups`:

```ts
      "font-family": [{ font: ["sans", "display", "serif", "mono", "jp"] }],
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run lib/design-tokens.test.ts lib/utils.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 8: Verify Japanese glyphs actually render (spec risk §7.3)**

Run: `npm run build && npm run dev`, open `http://localhost:3000/vi/kanji`, and confirm kanji render
in Noto Sans JP rather than a system fallback (DevTools → Computed → font-family, and the Rendered
Fonts panel). Google exposes no named `japanese` subset for Noto Sans JP — CJK arrives via
unicode-range slicing — so this must be observed, not assumed. **If glyphs fall back, stop and report
rather than guessing at subsets.**

- [ ] **Step 9: Commit**

```bash
git add app/[locale]/layout.tsx app/globals.css tailwind.config.ts lib/utils.ts lib/design-tokens.test.ts lib/utils.test.ts
git commit -m "feat(tokens): adopt the five-role Korume typeface system

Plus Jakarta Sans for UI, Be Vietnam Pro for display, Noto Serif for prose,
IBM Plex Mono for metadata, Noto Sans JP kept for Japanese content because
furigana renders too small for mincho serifs.

Outfit, Noto Serif JP and DM Mono are substituted rather than adopted: none
has a Vietnamese subset, and the design assigned them to the headings and
diary prose, which are exactly the most Vietnamese text in the product.
Only sans and jp preload."
```

---

## Task 5: Dark-only surfaces — unmount the toggle, fix the meta

**Files:**
- Modify: `components/layout/app-nav.tsx:7,129-132`
- Modify: `components/layout/site-header.tsx:5,18`
- Modify: `app/[locale]/layout.tsx:41-46`
- Test: `components/layout/app-nav.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

⚠️ `components/ui/theme-toggle.tsx` and `components/providers/theme-provider.tsx` are **not**
touched. `components/style-guide/style-guide.tsx:52` **keeps** its `ThemeToggle` — the admin style
guide is where a future light palette gets previewed.

- [ ] **Step 1: Write the failing test**

In `components/layout/app-nav.test.tsx`, add:

```tsx
it("does not offer a theme toggle — Korume ships dark-only", () => {
  render(<AppNav userEmail="a@b.co" />);
  expect(screen.queryByRole("button", { name: /theme|giao diện/i })).toBeNull();
});
```

⚠️ Read the existing `AppNav` render helper in that file first and match its props and setup exactly
rather than copying this call verbatim. Also update the comment at line 66 (`// AppNav renders
ThemeToggle + ReduceMotionToggle, both of which call…`) so it no longer names ThemeToggle.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/layout/app-nav.test.tsx -t "dark-only"`
Expected: FAIL — the toggle button is found.

- [ ] **Step 3: Unmount from app-nav**

Delete the `ThemeToggle` import (line 7) and replace lines 129-132 with:

```tsx
            <div className="flex items-center justify-end">
              <ReduceMotionToggle />
            </div>
```

- [ ] **Step 4: Unmount from site-header**

Delete the `ThemeToggle` import (line 5) and the `<ThemeToggle />` element (line 18).

- [ ] **Step 5: Fix the mobile theme-color**

Replace `app/[locale]/layout.tsx` lines 41-46 with:

```ts
/** Korume ships dark-only, so the browser chrome does not vary by preference. */
export const viewport: Viewport = {
  themeColor: "#0b0d11",
};
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run components/layout/ && npx tsc --noEmit`
Expected: PASS, tsc exit 0. Any test asserting a ThemeToggle in the header must be updated here.

- [ ] **Step 7: Commit**

```bash
git add components/layout/ app/\[locale\]/layout.tsx
git commit -m "feat(theme): unmount the theme toggle and set a dark theme-color

Korume ships dark-only. The toggle leaves app-nav and the marketing header but
stays in the admin style guide, which is where a future light palette would be
previewed; the provider, the component and its tests are untouched so light
mode returns as one block of values."
```

---

## Task 6: Fix the latent AA failure and repoint the secondary button

**Files:**
- Modify: `components/conversation/message-bubble.tsx:128`
- Modify: `components/ui/button.tsx:9,11`
- Test: `components/ui/button.test.tsx`

**Interfaces:**
- Consumes: `--secondary` / `--secondary-foreground` from Task 1; `shadow-raised` from Task 3.
- Produces: nothing consumed by later tasks.

⚠️ **No API rename happens here.** `Button` already exposes `primary | secondary | outline | ghost`;
its `secondary` variant merely points at the wrong token. `Badge`'s `accent` variant is correct as
written — a badge is a tag, which is exactly what warm sand is for.

- [ ] **Step 1: Write the failing test**

Add to `components/ui/button.test.tsx`:

```tsx
it("paints the secondary variant with the secondary surface, not the accent", () => {
  // Warm sand (--accent) is for tags and status. A secondary CTA is a quiet
  // dark plane (--secondary), per the adoption spec §3.2.
  render(<Button variant="secondary">Later</Button>);
  const button = screen.getByRole("button", { name: "Later" });
  expect(button.className).toContain("bg-secondary");
  expect(button.className).not.toContain("bg-accent");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ui/button.test.tsx -t "secondary variant"`
Expected: FAIL — className contains `bg-accent`.

- [ ] **Step 3: Repoint the variant**

In `components/ui/button.tsx`, replace lines 8-11 with:

```ts
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-raised",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-raised",
```

- [ ] **Step 4: Fix the message-bubble contrast failure**

`components/conversation/message-bubble.tsx:128` pairs a `/20` tint with the solid-fill tone. On the
new palette that measures **1.59:1**; `-strong` measures **5.43:1**. It is already broken in today's
dark theme (indigo/20 + ink-950) and went unseen only because nobody uses dark.

Replace line 128:

```tsx
            className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-strong"
```

- [ ] **Step 5: Audit every other alpha-tint site for the same mistake**

Run: `grep -rnE "bg-(primary|accent|success|danger)/[0-9]+" --include=*.tsx components app`

For each hit, confirm the text colour is `text-<c>-strong`, `text-foreground`, or inherited — **never
`text-<c>-foreground`**. The six other accent sites were checked and are correct
(`video-card.tsx:41` and `playback-controls.tsx:190` are solid fills, so `-foreground` is right
there); verify the primary/success/danger ones the same way and fix any that pair a tint with
`-foreground`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run components/ui/ components/conversation/ && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add components/ui/button.tsx components/conversation/message-bubble.tsx components/ui/button.test.tsx
git commit -m "fix(a11y): pair alpha tints with -strong tones, repoint secondary button

message-bubble paired bg-accent/20 with the solid-fill tone, which measures
1.59:1 — a failure that predates this work and was invisible only because
nobody used the dark theme. The secondary button variant moves off --accent
onto the new --secondary surface; its public API is unchanged."
```

---

## Task 7: Review the three raw-hex canvas/SVG files

**Files:**
- Modify (as needed): `components/companion/companion-sprite.tsx`,
  `components/video-player/pitch-contour.tsx`, `components/video-player/waveform.tsx`

**Interfaces:**
- Consumes: the palette from Task 1.
- Produces: nothing consumed by later tasks.

These three draw with raw hex rather than Tailwind classes, so they do **not** re-colour themselves
when the tokens change. They were authored against a light background.

- [ ] **Step 1: Find every hardcoded colour**

Run: `grep -nE "#[0-9a-fA-F]{3,8}|rgb\(|hsl\(" components/companion/companion-sprite.tsx components/video-player/pitch-contour.tsx components/video-player/waveform.tsx`

- [ ] **Step 2: Judge each against `#0b0d11` / `#171a20`**

For each colour, decide: does it still read on the dark surface? Prefer replacing it with a token
read from CSS (`hsl(var(--primary))` works inside inline `style` and SVG `stroke`/`fill`) over
inventing a new hex. Where a canvas API needs a literal, keep it but add a comment naming the
surface it was tuned against.

⚠️ Do not restyle these components. The goal is legibility on the new background, not a redesign.
`pitch-contour.tsx` in particular must keep its reference-dashed / user-solid distinction, and the
`.stroke-draw` reduced-motion kill switch must remain intact.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, then check `/vi/videos/<id>/shadowing` (pitch contour + waveform) and any screen
rendering the Companion sprite. Confirm every stroke and fill is visible.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/video-player/ components/companion/`
Expected: PASS. `pitch-contour.test.tsx` and `waveform.test.tsx` are known CPU-contention flakes —
if one fails, re-run it standalone before investigating.

- [ ] **Step 5: Commit**

```bash
git add components/
git commit -m "fix(ui): make canvas and SVG drawing legible on the dark surface

These three components draw with raw hex rather than Tailwind classes, so the
token change does not reach them. Adjusted for #0b0d11 without restyling."
```

---

## Task 8: Update the living style guide

**Files:**
- Modify: `components/style-guide/style-guide.tsx`
- Test: `components/style-guide/style-guide.test.tsx`

**Interfaces:**
- Consumes: every token from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Read the file and find the section structure**

Run: `grep -n "function\|<section\|<h2\|Swatch\|Sample" components/style-guide/style-guide.tsx`

Follow the existing section pattern; do not restructure the page.

- [ ] **Step 2: Update the swatches and samples**

- Colour: render every semantic token from spec §3.2, including the new `--secondary`,
  `--secondary-foreground` and `--input-background`. Remove any swatch naming a deleted primitive.
- Radius: show all four steps `rounded-sm | rounded-md | rounded-lg | rounded-xl` with their pixel
  values labelled.
- Typography: show all five roles — `font-sans`, `font-display`, `font-serif`, `font-mono`,
  `font-jp` — each with a **Vietnamese sample containing two-tier diacritics** (e.g.
  `Học tiếng Nhật cùng Korume — ắ ặ ễ ộ ữ`) so a missing Vietnamese subset is visible on the page.
  The `font-jp` sample uses Japanese (e.g. `日本語 · 話す · ひらがな`).
- Elevation: show `shadow-raised | shadow-overlay | shadow-floating` on a `bg-card` tile.
- Keep `<ThemeToggle />` at line 52.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run components/style-guide/`
Expected: PASS. Update assertions that name removed swatches.

- [ ] **Step 4: Browser pass**

Run: `npm run dev`, open `http://localhost:3000/vi/admin/style-guide` (sign in as the bootstrap admin
— `ADMIN_EMAILS="admin@almostgone.vn"`). Confirm every swatch, radius, type sample and shadow
renders, and that no Vietnamese sample shows fallback glyphs.

- [ ] **Step 5: Commit**

```bash
git add components/style-guide/
git commit -m "docs(style-guide): document the Korume dark token system

Adds the new semantic colours, the four radius steps, the five typeface roles
and the elevation scale. Every Latin type sample carries two-tier Vietnamese
diacritics so a missing subset is visible rather than silent."
```

---

## Task 9: Whole-branch verification

**Files:** none modified unless a failure is found.

- [ ] **Step 1: Full unit suite, three consecutive runs**

Run: `npx vitest run` (three times)
Expected: green all three times, **218 files / 1960 tests** or higher. Flakes in
`pitch-contour.test.tsx` / `waveform.test.tsx` are known under CPU contention — confirm they pass
standalone before treating one as a regression, and check nothing else is running vitest concurrently.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc exit 0. Lint exit 0 with **78 warnings** — the pre-existing baseline. Any new warning
must be fixed, not accepted.

- [ ] **Step 3: Build, then measure LCP and the font payload**

Spec §4.3 requires **LCP measured before and after**, not just a bundle figure — so this step needs
both, and needs a baseline captured from `master`.

Baseline first, from a clean checkout of `master` (or `git stash` the branch):

```bash
npm run build
ls .next/static/media | wc -l          # font file count
npm run start                          # production server, not dev
```

Then in Chrome, open `http://localhost:3000/vi/dashboard`, DevTools → **Lighthouse** → Performance,
Desktop preset, and record **LCP** in seconds. Repeat the identical sequence on the branch.

Report four numbers: LCP before/after and font-file count before/after, plus the First Load JS
figure from each build. Five typeface families instead of two is a real increase — it belongs in the
report as a measurement, not an assumption. ⚠️ Measure against `npm run start`, never `npm run dev`:
the dev server does not apply production font optimisation and the figure would be meaningless.

- [ ] **Step 4: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS. ⚠️ This needs a live dev server and Supabase (`npx supabase start`, Docker Desktop
running). It was **skipped** at the Plan B merge, and `vitest.config.ts:13` excludes `tests/e2e` so
`npm test` structurally cannot cover it — a visual/token change is exactly the kind that moves a
Playwright selector. If the environment cannot be brought up, say so explicitly in the report rather
than marking this done.

- [ ] **Step 5: Manual dark pass on two dense screens**

Run `npm run dev` and walk `/vi/dashboard` and `/vi/videos`. No route in this app was ever designed
dark (spec risk §7.2), so expect some screens to look wrong — record what you see, but **do not
restyle screens here**; that is the porting spec's job. Only fix outright illegibility (text at
under 4.5:1, invisible borders, a control that cannot be seen).

- [ ] **Step 6: Request review**

Use `superpowers:requesting-code-review` for a whole-branch review. Three prior plans in this repo
had the final whole-branch review find Critical/Important issues that no per-task diff could reveal —
treat it as mandatory, not optional.

---

## Notes for the reviewer

- The spec's §5 list is ordered by how silently each item fails. Item 1 (the contrast test's
  `[data-theme="dark"]` lookup) is a certainty, not a risk.
- Two things were deliberately **not** done and must not be flagged as omissions: the orange glow
  `shadow-[0_0_12px_#FF8A3D]` is not adopted as a token (it contradicts the design's own "No neon"
  rule, and per the one-directional rule the fix belongs in Figma); and the seven reserved support
  colours from spec §3.1.1 are documented but not declared, because tokens with no consumer are dead
  code under CLAUDE.md §6.
- `Badge`'s `accent` variant is intentionally unchanged.
