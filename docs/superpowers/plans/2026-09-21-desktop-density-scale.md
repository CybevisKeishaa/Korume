# Desktop Density Scale Implementation Plan

> **For agentic workers:** this repository runs the two-harness protocol
> (`.codex/docs/workflow.md` §8). **Codex implements this plan** task by task, under TDD, running
> `code-reviewer` and checkpointing `docs/superpowers/run-state/desktop-density-scale.md` after
> each accepted task. Claude reviews the whole branch afterwards and merges. Do not dispatch
> subagents per task; that is the other harness's workflow, not this repo's. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** give the design system a real desktop density function, so the shell renders at a 1280
CSS viewport the composition it was drawn for, without browser zoom — and so the remaining 27
desktop screens inherit the rule instead of the defect.

**Architecture:** one custom property, `--density-unit`, holds the whole density function:
`clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem)`. Every scaled token is authored as its
**1440 value as a bare number** multiplied by that unit — `calc(16 * var(--density-unit))`. A
custom property is chosen over a root font-size change because it cascades, so the three
out-of-scope route groups can reset it on their own subtree. Before any of that can produce a
coherent screen, typography must have exactly one source of truth: 32 `text-sm` and 4 `text-xs`
sites currently duplicate `--text-body` and `--text-caption` under Tailwind's default names, so a
token change alone would move only 8 call sites.

**Tech Stack:** Next.js App Router, React 18, Tailwind (tokens in `app/globals.css`, mapped in
`tailwind.config.ts`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-desktop-density-scale-design.md` — read it first. §3
is the six owner rulings, §5 the mechanism and its browser verification, §6 the token table every
number below comes from, §7 the accessibility floors, §9 the open items.

## Global Constraints

- **Reference viewport is 1440** (ruling 3.1). A frame dimension is normalized to 1440 before it
  becomes a token. Raw px is never copied from a frame into code.
- **Every number in this plan is the spec §6 `@1440` column.** Do not round, re-derive or
  "improve" a value. If one looks wrong, stop and say so — that is what the previous branch failed
  to do.
- **The density rule is bounded to 1280–1440** (ruling 3.5). 1440 = 1.0, 1280 = 0.889, interpolated
  between, held at both ends. Below 1280 the existing responsive rules take over untouched.
- **No CSS `zoom`, no page-level override** (ruling 3.6). Shadowing Hub and Explore are calibration
  samples; the result must come from shared tokens and primitives.
- **`caption` is the only rung with a floor**, and the floor is `max()` on the token, not a `clamp`
  bound on the unit (spec §6.1). A `clamp` minimum would leave the 1280–1320 band unguarded.
- **Do not touch colour tokens, breakpoints, or `--text-hero`** (spec §9 open item 1: `hero` is
  fluid on a different formula, belongs to the marketing surface, and that group holds density at
  1.0).
- **Do not touch `--layout-marketing-max`** (1256px, drawn on a 1280 canvas, out of scope).
- **`decision-register.md` P14 is untouched by this branch.**
- Commit message style: this repo writes a sentence, not a ticket id. Codex signs its own commits.
- Run every command from the worktree `.worktrees/desktop-density-scale`, never from the main
  checkout. `npm test` from the main checkout used to sweep every worktree; that is fixed on
  master, but the habit still matters for `next build` and `next dev`.
- **Use exactly one `next dev` server.** Three were found running from the main checkout sharing
  one `.next`, overwriting each other's chunks. A measurement taken from such a tree is worthless.
- **This worktree shipped with a partial `node_modules`** — `kuromoji` was absent, so
  `lib/japanese/{tokenizer,furigana}.test.ts` failed 11 tests on a missing dictionary file while
  the same 17 tests passed in the main checkout. Fixed by `npm install` here on 2026-09-21. If a
  suite fails on a missing file under `node_modules/`, that is this, not the diff.

## File Structure

| file | responsibility after this branch |
|---|---|
| `app/globals.css` | declares `--density-unit`, the `[data-density="reference"]` reset, and every scaled token as `calc(N * var(--density-unit))`; adds `--control-*` and `--icon-*` |
| `tailwind.config.ts` | maps the new `--control-*` and `--icon-*` tokens into `height` / `size`; radius, spacing and type mappings are unchanged (they already point at the vars) |
| `lib/design-tokens.test.ts` | the token contract: gains `--density-unit`, the new token names, and the density-formula assertions |
| `components/ui/token-scale.test.ts` | Rule #0 guard gains a rule forbidding a Tailwind default type utility where a rung exists, and widens its `components/shadowing` scope |
| `app/[locale]/(marketing)/layout.tsx`, `(auth)/layout.tsx`, `(protected)/(immersive)/layout.tsx` | carry `data-density="reference"` |
| `components/ui/{dialog,popover,select,tooltip}.tsx` | render their Radix `Portal` into a container inside the route-group subtree |
| `components/layout/app-nav.tsx` | typography by role, spacing by token, width from the density-scaled sidebar token, 44px floor on interactive rows |
| `components/shadowing/*.tsx`, both shadowing route pages | typography by role, spacing by token, control heights and icon sizes from tokens |
| `components/style-guide/token-sections.tsx` + `style-guide.test.tsx` | document the scales as `@1440` values with their 1280 rendering |
| `docs/design/screens/adaptive-layouts.md` | the frame-fidelity section is replaced by the normalization rule every later screen follows |

---

### Task 1: Typography gets one source of truth

Ruling 3.4 puts this first, and spec §4 says why: `text-sm` is Tailwind's `0.875rem` and
`--text-body` is also `0.875rem`; `text-xs` (12px) and `--text-caption` (12px) are the same value
under two names. Until this is consolidated, changing the token moves 8 call sites and leaves 32
behind. This is also a standing `AGENTS.md` §6 violation independent of this branch.

**This is an audit, not a search-and-replace.** The role table below is the audit result — each
site was read. Apply it site by site.

**Files:**
- Modify: `components/layout/app-nav.tsx` (5 sites)
- Modify: `components/shadowing/explore-lesson-card.tsx` (2), `explore-preview-drawer.tsx` (6),
  `explore-shelves.tsx` (2), `hub-companion-rail.tsx` (6), `hub-discovery-controls.tsx` (1),
  `hub-empty-state.tsx` (1), `hub-featured-hero.tsx` (1), `hub-lesson-card.tsx` (3),
  `hub-library-section.tsx` (3)
- Modify: `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx` (6)
- Modify: `components/ui/token-scale.test.ts` (the new guard)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the invariant every later task depends on — after this task, `text-caption` and
  `text-body` are the *only* names for 12px and 14px type in the shell and the two calibration
  screens. Task 3 relies on it: without it, converting `--text-body` moves 8 sites out of 40.

**The role table.** `text-caption` is meta and chrome labels; `text-body` is copy, control labels
and anything a reader reads as a sentence.

| file:line | current | role | becomes |
|---|---|---|---|
| `app-nav.tsx:61` | `text-xs font-semibold uppercase tracking-wide` | nav section label | `text-caption` |
| `app-nav.tsx:78` | `text-sm font-medium` | nav item label | `text-body` |
| `app-nav.tsx:103` | `text-xs` | user email, meta | `text-caption` |
| `app-nav.tsx:109` | `text-sm` | sign-out control label | `text-body` |
| `app-nav.tsx:141` | `text-xs` | collapse toggle, chrome | `text-caption` |
| `explore-lesson-card.tsx:28` | `text-sm` | thumbnail fallback copy | `text-body` |
| `explore-lesson-card.tsx:41` | `text-xs font-semibold leading-[18px]` | card title, meta scale | `text-caption` — **and delete `leading-[18px]`**, which is exactly `--leading-caption` |
| `explore-preview-drawer.tsx:70` | `text-sm` (on the `<dl>`) | detail list copy | `text-body` |
| `explore-preview-drawer.tsx:84` | `text-sm font-semibold` | section heading in a drawer | `text-body` |
| `explore-preview-drawer.tsx:86` | `text-sm` | transcript lines | `text-body` |
| `explore-preview-drawer.tsx:90` | `text-sm` | unavailable copy | `text-body` |
| `explore-preview-drawer.tsx:94` | `text-sm font-semibold` | primary action label | `text-body` |
| `explore-preview-drawer.tsx:100` | `text-sm` | error alert copy | `text-body` |
| `explore-shelves.tsx:28`, `:30` | `text-sm` | empty / more-available copy | `text-body` |
| `hub-companion-rail.tsx:41`, `:46`, `:51`, `:58`, `:69` | `text-sm` | rail copy | `text-body` |
| `hub-companion-rail.tsx:63` | `text-sm font-semibold` | rail action link | `text-body` |
| `hub-discovery-controls.tsx:98` | `text-sm` | no-results copy | `text-body` |
| `hub-empty-state.tsx:18` | `text-sm` | empty-state body | `text-body` |
| `hub-featured-hero.tsx:48` | `text-sm font-semibold` | hero CTA label | `text-body` |
| `hub-lesson-card.tsx:55` | `text-sm` | thumbnail fallback copy | `text-body` |
| `hub-lesson-card.tsx:66` | `text-sm` | card detail line | `text-body` |
| `hub-lesson-card.tsx:82` | `text-sm font-semibold` | card action label | `text-body` |
| `hub-library-section.tsx:149` | `text-sm font-semibold` | primary action label | `text-body` |
| `hub-library-section.tsx:169` | `text-sm` | unavailable copy | `text-body` |
| `hub-library-section.tsx:184` | `text-sm` | error alert copy | `text-body` |
| `explore/page.tsx:84` | `text-sm font-semibold` | submit button label | `text-body` |
| `explore/page.tsx:110`, `:115` | `text-sm` | empty-shelf copy | `text-body` |
| `explore/page.tsx:121`, `:123` | `text-sm font-medium` | situation filter chip label | `text-body` |
| `explore/page.tsx:134` | `text-sm` | known-words note | `text-body` |

Only `font-size` names change. **Do not remove `font-semibold`, `font-medium`, `uppercase`,
`tracking-wide`, or any colour class** — weight and tracking are separate decisions from the rung.

**A migration must not change what renders.** The default small rung IS `--text-body` (both 14px)
and the default extra-small rung IS `--text-caption` (both 12px); every site in the table maps
along those lines. If a site looks like it wants a different rung than its current value, that is a
design decision, not part of this task — leave the value alone and name it in the checkpoint. This
caught one real case: `components/layout/mobile-app-handoff.tsx` was re-roled down a rung (14 → 12)
on a below-1024 screen, outside the band this branch touches at all.

**Two files outside the calibration set are in these trees and are in scope**:
`components/layout/mobile-app-handoff.tsx` and `components/layout/notification-bell.tsx`. They are
shared shell, they hold the same duplicate rungs, and the scan reaches them. Migrate them
value-for-value rather than excluding them from the scan.

**`components/shadowing/explore-lesson-card.tsx` needs more than a rename.** It was ported 1:1 off
the 1536 frame and sets its own type at 8–9px with `leading-3` / `leading-4` overrides inside a
fixed-height stack. Owner ruling 2026-09-21: **raise every rung in that card to `caption`.** The
caption line box is 18px, so two rows must grow — the eyebrow drops its `h-3`/`leading-3` and the
summary goes `h-9` → `h-10` — and the interior and card heights follow: `h-[186px]` → `h-[196px]`,
`h-[298px]` → `h-[308px]` (16 + 18 + 26 + 40 + 16 + 24 + 40 + 16). The fixed-height model itself
stays for now and is Task 4 work: px heights cannot scale with `--density-unit`, which is the whole
point of this branch. `tests/e2e/shadowing-explore.spec.ts` pins the card height and must be
re-pinned against a **measured** number, not this arithmetic.

- [ ] **Step 1: Write the failing guard**

The audit is only durable if the next screen cannot reintroduce the second home. Add to
`components/ui/token-scale.test.ts`, immediately after the `RADIUS_LITERAL` declaration:

```ts
/** A Tailwind default type utility where a rung already exists. `text-sm` IS
 *  `--text-body` (0.875rem) and `text-xs` IS `--text-caption` (0.75rem): two
 *  names for one value means a token change moves some call sites and not
 *  others, which is exactly how the density defect survived a whole branch.
 *  `text-lg` and up are NOT listed — they have no rung of their own yet, and
 *  banning a utility with no replacement only teaches people to escape it. */
const DEFAULT_TYPE_UTILITY = /\btext-(sm|xs)\b/; // text-sm → text-body, text-xs → text-caption
```

Then widen the `components/shadowing` scope and add the shell and the two routes to
`SCANNED_DIRS`, replacing that entry. **Give them the FULL rule set**, not radius plus type:

```ts
  // The typography consolidation (2026-09-21 density-scale spec, ruling 3.4)
  // gives these three trees one source of truth per rung. A tree that may not
  // write a default type utility but may still write `text-[8px]` has not
  // been given one source of truth, it has been given a detour.
  { dir: "components/shadowing", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY] },
  { dir: "components/layout", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY] },
  { dir: "app/[locale]/(protected)/(app)/shadowing", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY] },
  { dir: "components/video", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY] },
```

`components/video` is in the list because **the Hub renders into it**: `hub-import-section.tsx`
imports `VideoImportForm`, and both it and `hub-library-section.tsx` import
`LessonCreationProgress`. Following only the page's own imports misses it — the leak is one hop
further down, and a calibration screen whose import card still sets a duplicate rung is not
consolidated. Seven sites across three files, all value-for-value.

⚠️ **Corrected 2026-09-21, after review.** This step first read `[RADIUS_LITERAL,
DEFAULT_TYPE_UTILITY]`, and Codex implemented exactly that — a plan defect, not an implementation
one. It left every other absolute literal legal in the three trees the task had just taken
ownership of, and `components/shadowing/explore-lesson-card.tsx` was already through the hole with
four `text-[8px]` sites and two `text-[9px]` ones. The guard ran green over a file setting 8px type
on a calibration screen: `docs/lessons.md` L-006 again, in the same task that was written to close
it.

The scan reads file TEXT, so a prose comment containing a banned class name fails the file. Keep
rung names out of comments in scanned trees, or spell them descriptively.

- [ ] **Step 2: Run it and watch it fail for the right reason**

Run: `npx vitest run components/ui/token-scale.test.ts`

Expected: FAIL, and **read the file names in the output**. It must name
`components/layout/app-nav.tsx`, the nine `components/shadowing` files and `explore/page.tsx`. A
failure naming only one file means the scan did not reach the others — fix the scan before
fixing the code. (`docs/lessons.md` L-006: a guard blind to the file that violates it is not a
guard. The density pass shipped exactly that mistake twice.)

Also confirm the scan is non-empty for each new directory: the existing
`scans a non-empty set of primitives in <dir>` case runs per entry and must pass for all five.

- [ ] **Step 3: Apply the role table**

Site by site, in the order of the table. After each file, re-read the line you changed — a
`text-sm` inside a `cn(...)` conditional branch is easy to half-edit.

- [ ] **Step 4: Run the guard and the affected unit tests**

Run: `npx vitest run components/ui/token-scale.test.ts components/layout components/shadowing "app/[locale]/(protected)/(app)/shadowing"`

Expected: PASS. If a component test asserted on `text-sm` in a class list, update that assertion
to the rung — that is a real contract change, not a broken test.

- [ ] **Step 5: Commit**

```bash
git add components/ui/token-scale.test.ts components/layout components/shadowing "app/[locale]/(protected)/(app)/shadowing"
git commit -m "refactor(type): one source of truth per typography rung, with a guard"
```

---

### Task 2: The density function

**Files:**
- Modify: `app/globals.css` (the `:root` block that starts at the foundation-token comment, ~line 108)
- Modify: `app/[locale]/(marketing)/layout.tsx`, `app/[locale]/(auth)/layout.tsx`,
  `app/[locale]/(protected)/(immersive)/layout.tsx`
- Test: `lib/design-tokens.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at the CSS level; sequencing only.
- Produces: `--density-unit`, the unit every token in Task 3 multiplies, and the
  `[data-density="reference"]` escape hatch Task 6 relies on. Name it exactly `--density-unit` —
  Task 3, Task 6 and the contract test all spell it that way.

- [ ] **Step 1: Write the failing test**

Append to `lib/design-tokens.test.ts`, inside the top-level scope (a new `describe` after the
existing `describe("design tokens", …)`):

```ts
describe("desktop density scale", () => {
  it("declares the density unit with both bounds in rem, never in px", () => {
    // Spec §5.2: a vw-derived unit ignores the reader's own font-size
    // preference and fails WCAG 1.4.4. rem bounds rise above the vw term
    // when the reader raises their default size, so type still grows.
    expect(css).toMatch(
      /--density-unit:\s*clamp\(\s*0\.0555556rem\s*,\s*calc\(100vw\s*\/\s*1440\)\s*,\s*0\.0625rem\s*\)/,
    );
    const declaration = css.match(/--density-unit:[^;]+;/)?.[0] ?? "";
    expect(declaration).not.toMatch(/\d+px/);
  });

  it("bounds the rule to 1280-1440 and to nothing else", () => {
    // Ruling 3.5: 1440 = 1.0, 1280 = 0.889, held at both ends. 0.0555556rem
    // is 0.888…px at a 16px root, which is 1280/1440. A different lower
    // bound would silently widen or narrow the rule.
    expect(0.0555556 * 16).toBeCloseTo(1280 / 1440, 4);
    expect(0.0625 * 16).toBe(1);
  });

  it("lets a route group opt out, because a custom property cascades", () => {
    // Spec §5.3: rem resolves against the root and is all-or-nothing per
    // document, which is the reason this is a custom property at all.
    expect(css).toMatch(/\[data-density="reference"\]\s*\{\s*--density-unit:\s*0\.0625rem;?\s*\}/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/design-tokens.test.ts -t "desktop density"`
Expected: FAIL — `--density-unit` is not declared.

- [ ] **Step 3: Declare the unit**

In `app/globals.css`, at the top of the foundation-token `:root` block (immediately before
`--font-sans`), insert:

```css
  /* The desktop density function (spec 2026-09-21-desktop-density-scale §5).
     Every app frame in the Figma file is drawn on a 1536 canvas and the
     product is viewed at 1280; a value authored for the wide canvas and
     placed unscaled at 1280 occupies 20% more of the screen than it was
     drawn to occupy. This unit is 1px at the 1440 reference viewport,
     0.888…px at 1280, interpolated between, and held at both ends
     (ruling 3.5 — density is not an unbounded viewport scale).

     BOTH bounds are rem on purpose. A bare vw-derived unit does not answer
     the reader's own font-size preference and would fail WCAG 1.4.4; with
     rem bounds the floor rises above the vw term when the reader raises
     their default size. Verified in Chrome at viewport 1422, not reasoned
     about: calc(28 * unit) gives 27.654px at a 16px root and 31.111px at a
     20px root (spec §5.2 carries the command). */
  --density-unit: clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem);
```

After that `:root` block closes, add the reset:

```css
/* The three route groups that hold density at 1.0. Their frames are drawn on
   a 1280 canvas and are already 1:1 correct; scaling them would take them 10%
   away from their own design. A custom property is what makes this possible —
   a root font-size change is all-or-nothing per document (spec §5.3). */
[data-density="reference"] {
  --density-unit: 0.0625rem;
}
```

- [ ] **Step 4: Wire the three out-of-scope layouts**

`app/[locale]/(marketing)/layout.tsx` — on the existing `<div className="flex min-h-screen flex-col">`:

```tsx
      <div data-density="reference" className="flex min-h-screen flex-col">
```

`app/[locale]/(auth)/layout.tsx` — on the existing `<div className="min-h-screen">`:

```tsx
    <div data-density="reference" className="min-h-screen">
```

`app/[locale]/(protected)/(immersive)/layout.tsx` — on the existing `<main className="min-h-screen">`:

```tsx
    <main data-density="reference" className="min-h-screen">
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: PASS, including the pre-existing cases in that file.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css "app/[locale]/(marketing)/layout.tsx" "app/[locale]/(auth)/layout.tsx" "app/[locale]/(protected)/(immersive)/layout.tsx" lib/design-tokens.test.ts
git commit -m "feat(density): a bounded desktop density unit, with a per-group opt-out"
```

---

### Task 3: Convert the token layer

Every token below is authored as its **1440 value as a bare number** times the unit. The `@1440`
value equals what the token holds today, except the three marked CHANGED — which is the whole
point: the values are already right at 1440; what was missing is the scaling below it.

**Files:**
- Modify: `app/globals.css` (radius block ~line 99, spacing ~120, layout ~141, typography ~173)
- Modify: `tailwind.config.ts` (new `--control-*` / `--icon-*` mappings)
- Test: `lib/design-tokens.test.ts`
- Modify: `components/style-guide/token-sections.tsx`, `components/style-guide/style-guide.test.tsx`

**Interfaces:**
- Consumes: `--density-unit` from Task 2.
- Produces: `--control-sm|md|lg` and `--icon-xs|sm|md|lg`, mapped in Tailwind as
  `h-control-sm|md|lg` and `size-icon-xs|sm|md|lg`. Task 4 consumes exactly those names.

- [ ] **Step 1: Write the failing test**

Append inside the `describe("desktop density scale", …)` block from Task 2:

```ts
  it("scales every rung of every scale through the one unit", () => {
    // Spec §6. The authored number is the 1440 value; nothing is rounded and
    // nothing is re-derived. A rung missing from this list is a rung that
    // silently stopped scaling.
    const scaled: Array<[string, number]> = [
      ["--space-2xs", 4], ["--space-xs", 8], ["--space-sm", 12], ["--space-md", 16],
      ["--space-md-lg", 20], ["--space-lg", 24], ["--space-xl", 32],
      ["--space-2xl", 48], ["--space-3xl", 64],
      ["--radius-sm", 8], ["--radius-md", 14], ["--radius-lg", 20],
      ["--text-body", 14], ["--leading-body", 22],
      ["--text-body-lg", 16], ["--leading-body-lg", 26],
      ["--text-heading", 20], ["--leading-heading", 28],
      ["--text-heading-lg", 24], ["--leading-heading-lg", 32],
      ["--text-title", 28], ["--leading-title", 36],
      ["--text-display", 40], ["--leading-display", 48],
      ["--layout-sidebar-width", 224], ["--layout-sidebar-collapsed", 68],
      ["--layout-content-max", 1240], ["--layout-header-height", 64],
      ["--control-sm", 36], ["--control-md", 40], ["--control-lg", 44],
      ["--icon-xs", 12], ["--icon-sm", 16], ["--icon-md", 24], ["--icon-lg", 28],
    ];
    const missing = scaled.filter(
      ([name, n]) =>
        !new RegExp(`${name}:\\s*calc\\(${n}\\s*\\*\\s*var\\(--density-unit\\)\\)`).test(css),
    );
    expect(missing.map(([name]) => name)).toEqual([]);
  });

  it("floors caption with max(), not with a clamp bound on the unit", () => {
    // Spec §6.1: 12 × w/1440 reaches 11px at w = 1320, so caption is under
    // its floor across the whole 1280-1320 band — not only at the endpoint.
    // Holding the UNIT at 1280 would leave that band unguarded, so the floor
    // wraps the TOKEN. The line-height floors with it, preserving the ratio.
    expect(css).toMatch(
      /--text-caption:\s*max\(0\.6875rem,\s*calc\(12\s*\*\s*var\(--density-unit\)\)\)/,
    );
    expect(css).toMatch(
      /--leading-caption:\s*max\(1\.03125rem,\s*calc\(18\s*\*\s*var\(--density-unit\)\)\)/,
    );
  });

  it("leaves the marketing column and the hero rung alone", () => {
    // Both belong to a surface that holds density at 1.0. --layout-marketing-max
    // is measured off a 1280 canvas; --text-hero is already fluid on a
    // different formula, introduced to fix a WCAG 1.4.10 reflow failure.
    expect(css).toMatch(/--layout-marketing-max:\s*1256px/);
    expect(css).toMatch(/--text-hero:\s*clamp\(/);
    expect(css).not.toMatch(/--text-hero:[^;]*--density-unit/);
  });

  it("scales the companion rail's bounds but not its share", () => {
    // Spec §6.4: the 27.5% share is already proportional and is not touched;
    // the 15rem floor and 21.25rem cap are constants and are.
    expect(css).toMatch(
      /--layout-companion-width:\s*clamp\(\s*calc\(240\s*\*\s*var\(--density-unit\)\)\s*,\s*27\.5%\s*,\s*calc\(340\s*\*\s*var\(--density-unit\)\)\s*\)/,
    );
  });
```

Extend `REQUIRED_TOKENS` in the same file with the new names, after the radius group:

```ts
  // Control heights and icon sizes. NEW in the density scale: h-9/h-10/h-11
  // and h-3/h-4/h-6/h-7 were Tailwind numerics scattered across primitives
  // and screens, so they could not scale with anything.
  "--control-sm", "--control-md", "--control-lg",
  "--icon-xs", "--icon-sm", "--icon-md", "--icon-lg",
  "--density-unit",
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/design-tokens.test.ts -t "desktop density"`
Expected: FAIL — the `missing` array lists every token, because none is `calc()`-authored yet.

- [ ] **Step 3: Convert `app/globals.css`**

Radius — replace the three declarations and **amend the block comment**, which currently says
"Steps are ABSOLUTE, not calc()-derived". That rule was about chaining one rung off another (one
edit to a base skews the scale); multiplying each rung independently by the shared unit does not
chain them. Say so, or the next reader will read the comment as a contradiction:

```css
  /* … existing reasoning about lg = 20px and the absent xl rung stays …
     Each step is authored as its own 1440 value times the density unit. The
     earlier "absolute, never derived" rule forbade CHAINING one rung off
     another, where one edit to a base silently skews every other step; these
     rungs are still independent of each other, and share only the unit. */
  --radius-sm: calc(8 * var(--density-unit));
  --radius-md: calc(14 * var(--density-unit));
  --radius-lg: calc(20 * var(--density-unit));
```

Spacing:

```css
  --space-2xs: calc(4 * var(--density-unit));
  --space-xs: calc(8 * var(--density-unit));
  --space-sm: calc(12 * var(--density-unit));
  --space-md: calc(16 * var(--density-unit));
  --space-lg: calc(24 * var(--density-unit));
  --space-xl: calc(32 * var(--density-unit));
  --space-2xl: calc(48 * var(--density-unit));
  --space-3xl: calc(64 * var(--density-unit));
```

and, in its own block lower down, `--space-md-lg: calc(20 * var(--density-unit));`

Layout — `--layout-gutter` and `--layout-column-gap` keep their `var(--space-*)` references
untouched (they inherit the scaling, and `design tokens › declares layout distances by reference
to the spacing scale` asserts that exact text):

```css
  --layout-sidebar-width: calc(224 * var(--density-unit));
  --layout-sidebar-collapsed: calc(68 * var(--density-unit));
  --layout-content-max: calc(1240 * var(--density-unit));
  --layout-companion-width: clamp(
    calc(240 * var(--density-unit)),
    27.5%,
    calc(340 * var(--density-unit))
  );
  --layout-header-height: calc(64 * var(--density-unit));
```

Amend the `--layout-sidebar-width` comment: the carve-out that exempted the rail as a "fixed
control" is **revoked** by ruling 3.2. The rail is inside the rule; only the hit target holds its
own minimum, which Task 4 applies.

Typography — `caption` takes the `max()` floor, the rest are plain:

```css
  --text-caption: max(0.6875rem, calc(12 * var(--density-unit)));   /* floors at 11px */
  --leading-caption: max(1.03125rem, calc(18 * var(--density-unit))); /* floors at 16.5px */
  --text-body: calc(14 * var(--density-unit));
  --leading-body: calc(22 * var(--density-unit));
  --text-body-lg: calc(16 * var(--density-unit));
  --leading-body-lg: calc(26 * var(--density-unit));
  --text-heading: calc(20 * var(--density-unit));
  --leading-heading: calc(28 * var(--density-unit));
  --text-heading-lg: calc(24 * var(--density-unit));
  --leading-heading-lg: calc(32 * var(--density-unit));
  --text-title: calc(28 * var(--density-unit));
  --leading-title: calc(36 * var(--density-unit));
  --text-display: calc(40 * var(--density-unit));
  --leading-display: calc(48 * var(--density-unit));
```

`--text-hero`, `--leading-hero`, `--leading-jp` (a unitless ratio) and every `--font-weight-*`,
`--tracking-*`, colour, elevation, motion and z-index token are **untouched**.

Add the two new groups after the typography block:

```css
  /* Control heights. NEW: these were h-9 / h-10 / h-11 Tailwind numerics in
     button.tsx, input.tsx, select.tsx and two screens, so they could not
     scale with anything. --control-lg reaches 39.11px at 1280, under the 44px
     touch convention; accepted by spec §7 because this rule is bounded to a
     pointer-driven desktop range and WCAG 2.5.8 requires 24 × 24. Recorded so
     it is not rediscovered as a defect. */
  --control-sm: calc(36 * var(--density-unit));
  --control-md: calc(40 * var(--density-unit));
  --control-lg: calc(44 * var(--density-unit));

  /* Icon sizes. NEW, same reason: h-3 / h-4 / h-6 / h-7 in the card and rail. */
  --icon-xs: calc(12 * var(--density-unit));
  --icon-sm: calc(16 * var(--density-unit));
  --icon-md: calc(24 * var(--density-unit));
  --icon-lg: calc(28 * var(--density-unit));
```

- [ ] **Step 4: Map the new tokens in `tailwind.config.ts`**

In `theme.extend`, add to the existing `height` block (which already holds `header`) and add a
`size` block next to it:

```ts
      height: {
        header: "var(--layout-header-height)",
        "control-sm": "var(--control-sm)",
        "control-md": "var(--control-md)",
        "control-lg": "var(--control-lg)",
      },
      // `min-h-*` reads the minHeight scale, NOT height. In Tailwind 3.4
      // minHeight inherits the SPACING scale (min-h-11 resolves to 2.75rem
      // today), and `control-lg` is not a spacing key — so without this block
      // the `min-h-control-lg` that Task 4 puts on the nav rows would emit
      // nothing at all and the 44px floor would silently not exist. Verified
      // against resolveConfig, not assumed.
      minHeight: {
        "control-sm": "var(--control-sm)",
        "control-md": "var(--control-md)",
        "control-lg": "var(--control-lg)",
      },
      // `size-*` (width and height in one utility) is a 3.4 feature and has
      // its own theme key; this repo is on 3.4.19.
      size: {
        "icon-xs": "var(--icon-xs)",
        "icon-sm": "var(--icon-sm)",
        "icon-md": "var(--icon-md)",
        "icon-lg": "var(--icon-lg)",
      },
```

Leave `borderRadius`, `spacing`, `fontSize` and `width` exactly as they are — they already
reference the vars, so they inherit the conversion with no edit.

**`borderRadius.DEFAULT` scales — owner ruling 2026-09-21**, closing the spec §9 open item. It is
~25 bare `rounded` call sites and it was deferred out of `desktop-density-pass`; the owner has now
ruled it into this conversion, so the whole radius scale moves together:

```ts
      DEFAULT: "calc(4 * var(--density-unit))",
```

It cannot be checked by the Step 1 `scaled` list, which reads `app/globals.css`; this rung lives in
`tailwind.config.ts` as a literal, like `none` and `full`. Assert it where it lives — add to the
`describe("desktop density scale", …)` block:

```ts
  it("scales the default radius rung, which lives in the Tailwind config, not the stylesheet", () => {
    // Owner ruling 2026-09-21. ~25 bare `rounded` sites; deferred out of
    // desktop-density-pass and ruled in here, so the radius scale moves as
    // one. `none` and `full` stay literal: 0 does not scale and 9999 is a
    // pill, not a measurement.
    expect(tailwind).toMatch(/DEFAULT:\s*"calc\(4\s*\*\s*var\(--density-unit\)\)"/);
    expect(tailwind).toMatch(/none:\s*"0px"/);
    expect(tailwind).toMatch(/full:\s*"9999px"/);
  });
```

- [ ] **Step 5: Run the token contract**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: PASS. `lib/design-tokens.contrast.test.ts` is unaffected — no colour token moves — but
run it too and say so in the checkpoint rather than assuming it.

- [ ] **Step 6: Update the style guide and its test**

`components/style-guide/token-sections.tsx:50-52` labels radius as `rounded-sm · 8px`. Those are
now 1440 values. Change the data to carry both, so the page documents the rule rather than a
single number:

```tsx
/** The three radius steps (app/globals.css). Values are the 1440 reference;
 *  each renders ~11% smaller at 1280 through --density-unit. */
const RADIUS_STEPS = [
  { cls: "rounded-sm", px: 8, at1280: 7.11 },
  { cls: "rounded-md", px: 14, at1280: 12.44 },
  { cls: "rounded-lg", px: 20, at1280: 17.78 },
];
```

Render the label as `${cls} · ${px}px @1440 · ${at1280}px @1280`, and update
`style-guide.test.tsx:108` to match the new string:

```tsx
      expect(
        screen.getByText(new RegExp(`${cls} · ${px}px @1440`)),
      ).toBeInTheDocument();
```

- [ ] **Step 7: Run the whole suite and read the failures**

Run: `npm test`

Expected: **red, in named places**. Spec §9 says so in advance: pinned pixel assertions in the
token contract, the density pass's own guards and the e2e geometry cases were written against
fixed values. For each failure decide, and write the decision in the checkpoint:

- an assertion pinning a **token value** → update it to the `@1440` number;
- an assertion pinning a **rendered geometry at a viewport ≥ 1440** → it must still pass; a red
  one there is a real regression, not churn (jsdom has no layout, so unit tests see the CSS text,
  not computed px);
- anything else → stop and report it rather than loosening the assertion. `docs/lessons.md` L-004:
  loosening one threshold twice means the metric is wrong, not the number.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/design-tokens.test.ts components/style-guide
git commit -m "feat(density): every scale authored at 1440 and scaled through one unit"
```

---

### Task 4: Migrate the two calibration screens

Ruling 3.6: no page-level value that a token or a shared primitive could carry. The screens are
samples of the system, not exceptions to it.

**Files:**
- Modify: `components/ui/button.tsx:18-19`, `components/ui/input.tsx:12`, `components/ui/select.tsx:45`
- Modify: `components/layout/app-nav.tsx` (spacing numerics + the 44px row floor)
- Modify: `components/shadowing/explore-lesson-card.tsx` (spacing numerics, control, icons),
  `hub-discovery-controls.tsx` (`h-11`), `explore-preview-drawer.tsx` (`min-h-11`),
  `hub-section-heading.tsx` (`mt-1`)
- Modify: `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx` (`h-10`)

**Interfaces:**
- Consumes: `h-control-sm|md|lg` and `size-icon-xs|sm|md|lg` from Task 3.
- Produces: nothing later tasks import. Task 5 measures the result.

**The spacing map.** Tailwind numerics are 4px per step; the named scale is the design system's
vocabulary:

| numeric | px | token |
|---|---|---|
| `-1` | 4 | `2xs` |
| `-2` | 8 | `xs` |
| `-3` | 12 | `sm` |
| `-4` | 16 | `md` |

**The control map:** `h-9` → `h-control-sm`, `h-10` → `h-control-md`, `h-11` / `min-h-11` →
`h-control-lg` / `min-h-control-lg`.

**The icon map:** `h-3 w-3` → `size-icon-xs`, `h-4 w-4` → `size-icon-sm`, `h-6 w-6` →
`size-icon-md`, `h-7 w-7` → `size-icon-lg`.

**`button.tsx`'s `h-12` is NOT in this map and does not change — owner ruling 2026-09-21**, closing
the second spec §9 open item. Spec §6.5 defines three control rungs and 48px is not one of them; the
owner ruled against adding a fourth. The `lg` button keeps 48px and does not scale while `sm` and
`md` do. That is the decision, not an oversight — do not "fix" it.

- [ ] **Step 1: Write the failing test**

Add to `components/layout/app-nav.test.tsx`, inside the existing `describe("AppNav", …)`:

```tsx
  it("keeps a 44px floor under interactive rows while the rail itself scales", () => {
    // Ruling 3.2 puts the rail inside the density rule (224 → 199.11 at 1280),
    // and spec §7 carves out exactly one thing: the hit target. The WIDTH may
    // scale; the TARGET may not shrink below 44px. These are two different
    // dimensions and the carve-out applies only to the second.
    renderNav();
    const [firstLink] = screen.getAllByRole("link");
    expect(firstLink.className).toContain("min-h-control-lg");
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/layout/app-nav.test.tsx -t "44px floor"`
Expected: FAIL — the nav rows carry `py-2` and no minimum height.

- [ ] **Step 3: Migrate the primitives**

`components/ui/button.tsx:18` `h-9` → `h-control-sm`; `:19` `h-10` → `h-control-md`; `:20` `h-12`
unchanged. `components/ui/input.tsx:12` and `components/ui/select.tsx:45`: `h-10` →
`h-control-md`. These primitives are shared with the out-of-scope groups — that is safe and is the
point: those groups hold `--density-unit` at 1.0, so the same token renders the same 40px there.

- [ ] **Step 4: Migrate the shell and the screens**

Apply the three maps above to every site the audit command prints:

```bash
grep -rnE '\b[pm][trblxy]?-[0-9]+\b|\bgap(-[xy])?-[0-9]+\b|\bspace-[xy]-[0-9]+\b|\bh-(9|10|11)\b|\bmin-h-11\b|\b[hw]-(3|4|6|7)\b' \
  components/layout/app-nav.tsx components/layout/two-column-shell.tsx \
  components/shadowing/*.tsx \
  "app/[locale]/(protected)/(app)/shadowing/page.tsx" \
  "app/[locale]/(protected)/(app)/shadowing/explore/page.tsx" \
  | grep -v '\.test\.'
```

and add `min-h-control-lg` to the nav's interactive rows (`app-nav.tsx:78` item link,
`:109` sign-out, `:141` collapse toggle), keeping their existing `py-*`.

**Leave `w-sidebar` alone** — it already resolves to `--layout-sidebar-width`, which Task 3 made
density-scaled. It needs no edit here, which is what a working token layer looks like.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/layout components/shadowing components/ui "app/[locale]/(protected)/(app)/shadowing"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ui components/layout components/shadowing "app/[locale]/(protected)/(app)/shadowing"
git commit -m "refactor(density): the two calibration screens carry tokens, not numerics"
```

---

### Task 5: Measure it in a browser, at both ends of the rule

This is the task the previous branch got wrong, and the reason this one exists. It graded itself
against a number derived from its own clamp arithmetic instead of against the composition the
owner was comparing to. **The acceptance number here is the owner's zoom-90% composition**, which
is the spec §1 table.

**Files:**
- Modify: `docs/superpowers/run-state/desktop-density-scale.md` (record the measurements)

**Interfaces:**
- Consumes: the whole branch so far.
- Produces: the evidence the whole-branch review reads.

- [ ] **Step 1: Build and serve once**

```bash
npm run build
npx next start -p 3100
```

A production build, not `next dev` — and **one** server. Confirm nothing else is listening first:

```bash
netstat -ano | findstr ":3000 :3001 :3002 :3100"
```

- [ ] **Step 2: Re-run the mechanism check before trusting any number**

In the page console on an app route, `docs/lessons.md` L-002 — record the command with the result:

```js
const p = document.createElement("div");
p.style.cssText = "font-size: calc(28 * var(--density-unit))";
document.body.append(p);
({ vw: innerWidth, title: getComputedStyle(p).fontSize });
```

At viewport 1440 this must report ~28px; at 1280, ~24.89px. If it does not, the unit is not
reaching the page and **every measurement below is meaningless** — stop and report.
(`korume-false-green-before-believing`: prove the subject exists before believing the check.)

- [ ] **Step 3: Measure `/vi/shadowing` and `/vi/shadowing/explore` at 1280 and 1440**

Authenticated, one server, no zoom. For each screen and viewport record: main column width,
companion rail width, whole-page scroll height, and the computed `font-size` of a `text-body` and
a `text-caption` node.

The acceptance table, from spec §1 and §6:

| at 1280 | target | source |
|---|---|---|
| main column | **≈768px**, the zoom-90% composition | spec §1 (768.6px measured at zoom 90%) |
| companion rail | ≈300px | spec §1 (300.6px at zoom 90%) |
| whole-page scroll height | ≈2085px, not 2352 | spec §1 |
| `text-body` computed | 12.44px | spec §6.1 |
| `text-caption` computed | **11px**, floored — not 10.67 | spec §6.1 |
| `--control-lg` element | 39.11px | spec §6.5 |

| at 1440 | target |
|---|---|
| `text-body` computed | 14px |
| `text-caption` computed | 12px |
| sidebar | 224px |

Spec §9 warns that `100vw` includes the scrollbar: at a 1280 window with a 15px scrollbar the unit
is computed on 1280 while the content box is 1265, so a measured column sits ~1% under the table's
figure. That is the intended reading. **A gap larger than ~1% is a finding, not rounding** — and
the honest move is to report the number, not to widen the band.

- [ ] **Step 4: Check the three floors hold**

- `text-caption` is 11px at 1280 **and across 1280–1320** — measure at 1300 as well, which is the
  band a `clamp` bound on the unit would have left unguarded.
- Nav interactive rows are ≥44px tall at 1280.
- At a 20px browser root font size, type grows (WCAG 1.4.4). Set it in browser settings, reload,
  and record `text-body`.

- [ ] **Step 5: Record every number in the run state and commit**

Write the measurements into `docs/superpowers/run-state/desktop-density-scale.md` under
Verification — the numbers as measured, next to the targets, including any that missed.

```bash
git add docs/superpowers/run-state/desktop-density-scale.md
git commit -m "docs(density): the measured composition at 1280 and 1440"
```

---

### Task 6: Portal containers

`dialog`, `popover`, `select` and `tooltip` render through a Radix `Portal` into `document.body`,
outside every route-group subtree. With the fluid value on `:root`, a dialog opened from an app
screen inherits the right density by default — but one opened from a `data-density="reference"`
group would not, because the attribute is on a `<div>` the portal escapes.

**Files:**
- Modify: `components/ui/dialog.tsx:66`, `popover.tsx:37`, `select.tsx:57`, `tooltip.tsx:24`
- Test: `components/ui/dialog.test.tsx` (or the existing test file for each primitive)

**Interfaces:**
- Consumes: `[data-density="reference"]` from Task 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

```tsx
  it("renders its portal inside the density scope it was opened from", () => {
    // A Radix Portal defaults to document.body, outside every route-group
    // subtree, so a dialog opened from an auth screen would inherit the app's
    // fluid density instead of the reference 1.0 its frames were drawn at.
    render(
      <div data-density="reference" data-testid="scope">
        <Dialog open>
          <DialogContent>hello</DialogContent>
        </Dialog>
      </div>,
    );
    const scope = screen.getByTestId("scope");
    expect(scope).toContainElement(screen.getByText("hello"));
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/ui/dialog.test.tsx -t "density scope"`
Expected: FAIL — the content is under `document.body`, not under the scope element.

- [ ] **Step 3: Give each primitive a container**

Resolve the nearest density scope from the trigger's own tree and pass it as the portal container,
falling back to `undefined` (Radix's own default) when there is none:

```tsx
const [container, setContainer] = React.useState<HTMLElement | null>(null);
const anchorRef = React.useRef<HTMLSpanElement>(null);

React.useEffect(() => {
  setContainer(anchorRef.current?.closest("[data-density]") ?? null);
}, []);
```

Render a zero-size `<span ref={anchorRef} aria-hidden />` next to the trigger and pass
`container={container ?? undefined}` to the `Portal`. `useEffect` (not `useLayoutEffect`) keeps
this out of the server render; the first paint uses Radix's default and the container attaches on
mount, which is invisible because the overlay is not open on that frame.

Repeat for all four primitives.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/ui`
Expected: PASS, including every existing dialog/popover/select/tooltip case — these primitives are
used across the app and a portal change is exactly the kind that breaks focus traps.

- [ ] **Step 5: Commit**

```bash
git add components/ui
git commit -m "fix(density): portals inherit the density scope they were opened from"
```

---

### Task 7: Write the rule the next 27 screens inherit

The `Frame Fidelity: shares, not constants` section at `docs/design/screens/adaptive-layouts.md:696`
is the previous branch's rule. Two of its claims are now wrong: the persistent-rail carve-out is
revoked (ruling 3.2), and "divide by the canvas the frame was drawn on" stops one step short of
what this branch actually does — normalize to 1440 and express the result as a token.

**Files:**
- Modify: `docs/design/screens/adaptive-layouts.md:696-715`

**Interfaces:**
- Consumes: the finished mechanism.
- Produces: the rule every later screen port follows.

- [ ] **Step 1: Replace the section**

```markdown
# Frame Fidelity: normalize to 1440, then tokenize

A dimension read off a Figma frame is never implemented as the pixel value the frame draws. It is
**normalized to the 1440 reference viewport**, and then expressed as a token — `calc(N *
var(--density-unit))`, where N is the normalized 1440 value.

- App frames in the Korume file are drawn on a **1536** canvas: multiply by 1440/1536 = 0.9375.
  The auth, error and membership batch and the marketing page are drawn on **1280** and belong to
  route groups that hold density at 1.0 (`data-density="reference"`), so their values are used
  as drawn.
- The density unit is `clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem)`: 1.0 at 1440 and above,
  0.889 at 1280 and below, interpolated between. Both bounds are `rem` so the reader's own
  font-size preference still works (WCAG 1.4.4).
- **There is no carve-out for a persistent navigation rail.** The earlier version of this section
  exempted one as a "fixed control"; owner ruling 2026-09-21 revoked that. The rail scales like
  everything else. Only a dimension tied to a **hit target** holds its own minimum — 44px on an
  interactive row — and that minimum is on the target, not on the container's width.
- A percentage belongs on the grid **track**, never on the element sitting in that track — a
  percentage there resolves against the track and applies itself twice.
- A raw px constant is allowed only where a token cannot express the value, with an inline comment
  saying why. `components/ui/token-scale.test.ts` enforces this.

Why this exists: the companion rail shipped as a fixed `300px` measured off a 1536 frame, and the
branch that fixed four such widths still left the owner reading the app at browser zoom 90% —
because it normalized three dimensions and left type, spacing, radius, control heights and icon
sizes at wide-canvas values. Fixing the widths one at a time cannot work; the ratio of every value
to the viewport is what density means. See
`docs/superpowers/specs/2026-09-21-desktop-density-scale-design.md`.
```

- [ ] **Step 2: Verify nothing else still cites the revoked carve-out**

```bash
grep -rn "fixed control\|persistent navigation rail" docs/ --include='*.md'
```

Every hit must be either this section or a dated historical record. A live rule document repeating
the revoked carve-out is exactly the defect the C4 branch's last review found — three authority
documents describing behaviour the code had removed.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/adaptive-layouts.md
git commit -m "docs(design): frame fidelity means normalize to 1440, then tokenize"
```

---

## Branch gate, before handing back to Claude

Run all of these from the worktree, and paste the real output into the run state — not a summary
of it:

```bash
npm run verify:protocol     # must exit 0 BEFORE the Owner line changes (§8)
npx tsc --noEmit
npm test
npm run lint
npm run build
npx playwright test tests/e2e/shadowing-hub.spec.ts tests/e2e/shadowing-explore.spec.ts
```

Then set `- Owner: Claude` in `docs/superpowers/run-state/desktop-density-scale.md` and commit
that line by itself. That commit is the handoff; nothing else signals readiness.

## Open items carried into the review

State each of these in the final checkpoint, with what you did:

1. **`borderRadius.DEFAULT`** — left as a literal, ~25 call sites, awaiting an owner ruling.
2. **`button.tsx`'s `h-12`** — left unscaled; 48px has no rung in spec §6.5.
3. **`--control-lg` at 39.11px** — under the 44px touch convention, accepted by spec §7.
4. **`--text-hero`** — confirmed untouched and still on its own fluid formula (spec §9).
5. Any pinned assertion you changed, with the reason it was a contract change rather than a
   loosened threshold.
