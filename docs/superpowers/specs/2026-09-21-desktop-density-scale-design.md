# Desktop density scale — design (2026-09-21)

> Branch `desktop-density-scale`. Owner of this document: Claude. Implementation: Codex.
>
> This spec exists because `desktop-density-pass` (merged `296c9a4`) did not close the symptom it
> was written to close. The owner still reports that the app reads correctly only at browser zoom
> 90%, and supplied four screenshots at 100% and 90% of the same two screens, taken from the same
> post-merge server, to prove it. This spec replaces the earlier spec's central claim, sizes the
> real defect, and closes a rule the remaining 27 desktop screens inherit.

## 1. What the previous spec got wrong

`2026-09-20-desktop-density-pass-design.md` §1 opens with:

> "The 90% preference is **not** a preference for smaller text. Every CSS pixel value is identical
> at both zoom levels; the only thing that changes is the CSS viewport width."

The first sentence is false, and it is why the branch fixed four widths and left the symptom
standing. Both zoom levels do hold the same CSS pixel values — but the *ratio* of those values to
the viewport does not. 16 px is 1.25% of a 1280 viewport and 1.13% of a 1422 one. That ratio is
what "density" names, and it is the whole of what the owner is reacting to.

Measured on `localhost:3001` (post-merge server), `/vi/shadowing`, authenticated, viewport 1280:

| | zoom 100% | zoom 90% | gap |
| --- | --- | --- | --- |
| Main column | 666.7 px | 768.6 px | +101.9 px |
| Companion rail | 262.0 px | 300.6 px | +38.6 px |
| Whole-page scroll height | 2352 px | 2085 px | −267 px |

The merged branch moved the main column from 613 px to 666.7 px. The distance still to travel was
101.9 px. It closed roughly 27% of the gap and reported success against an acceptance number
(~684 px) derived from its own clamp arithmetic rather than from the composition the owner was
comparing against.

The previous spec's §2 table also computed the correct normalized values — `22px on a 1536 canvas
= 18.3px at 1280`, `20px padding = 16.7px at 1280` — and then shipped the unnormalized ones. The
rule was written and not applied. This is evidence on `docs/lessons.md` L-002 and L-006.

## 2. The real defect

Every app frame in the Korume Figma file is drawn on a **1536** canvas. The port copied frame pixel
values into code 1:1 — sidebar 224, card padding 20, card radius 22, the type scale. The product is
viewed at **1280**. A value authored for 1536 and placed unscaled into 1280 occupies 20% more of
the screen than it was drawn to occupy.

`desktop-density-pass` normalized three dimensions (the rail share, the sidebar token, the Explore
search cap) and left the rest. So the shell has **no viewport adaptation at all between 1280 and
1536**: type, spacing, radius, control heights and icon sizes are fixed at wide-canvas values.

The owner's zoom-90% viewport is 1422, which is within 1.3% of **1440**. At that width the current
token values read correctly to them. That is the load-bearing evidence in this spec: **the token
values are already right at 1440; what is missing is the scaling below it.**

## 3. Owner rulings that bind this spec

Ruled 2026-09-21, in the conversation that produced this document:

1. **Reference viewport is 1440.** Frames drawn on any other canvas are normalized to 1440 before
   becoming tokens. Raw px is never copied from a frame into code.
2. **The sidebar carve-out from `desktop-density-pass` is revoked.** The sidebar is inside the
   density rule: 224 @1440 → ~199 @1280. Expanded and collapsed widths normalize through the same
   system. Only dimensions tied directly to hit target or accessibility may hold their own minimum.
3. **Typography scales by the rule, with a floor of 11 px on `caption` only.** `body` 14 → 12.4 at
   1280 stands, because that is close to the density the owner approved at zoom 90%. The scale is
   not raised wholesale because one rung reaches its floor.
4. **The `text-sm` / `text-xs` migration is approved, but not as a search-and-replace.** Each site
   is audited and migrated by semantic role. After migration every typography rung has exactly one
   source of truth. This is the first task.
5. **The density rule applies only across 1280–1440.** 1440 = 1.0, 1280 = 0.889, interpolated
   between. Above 1440 it holds at 1.0. Below 1280 it stops; the existing responsive rules take
   over. Density is not an unbounded viewport scale.
6. **No CSS `zoom`, and no page-level override** that imitates the two screenshots. Shadowing Hub
   and Explore are calibration samples; the shipped result must come from shared tokens and
   primitives.

`decision-register.md` P14 is untouched by this branch.

## 4. Evidence gathered for this spec

Measured in the two calibration screens plus `two-column-shell.tsx` and `app-nav.tsx`:

| finding | count |
| --- | --- |
| Named-scale spacing utilities (`p-md`, `gap-lg`, …) | 95 |
| Numeric Tailwind spacing utilities (`p-4`, `gap-2`, `px-3`, …) | 26 |
| `text-sm` | 32 |
| `text-caption` | 20 |
| `text-body` | 8 |
| `text-xs` | 4 |
| `text-title` / `text-heading` / `text-heading-lg` / `text-lg` | 3 / 2 / 1 / 1 |
| Radius: `rounded-lg` / `rounded-md` / `rounded-full` / `rounded-none` | 10 / 5 / 6 / 1 |
| Control heights, `components/ui/**` | `h-10` ×3, `h-9`, `h-12` |

Two of these decide the shape of the work:

- **Typography has two homes.** `text-sm` is Tailwind's default `0.875rem`; `--text-body` is also
  `0.875rem`. `text-xs` (12 px) and `--text-caption` (12 px) are likewise the same value under two
  names. Changing the token moves 8 call sites and leaves 32 behind. Until this is consolidated,
  no token change can produce a coherent screen. This is why ruling 3.4 puts it first, and it is a
  standing `AGENTS.md` §6 violation independent of this branch.
- **Radius and spacing are largely tokenized already**, so those rungs will move as soon as the
  token values do.

## 5. Mechanism

### 5.1 The density unit

One custom property holds the entire density function. Every scaled token is a plain number
multiplied by it.

```css
:root {
  /* 1px at the 1440 reference; 0.888…px at 1280; interpolated between; held at
     both ends. 0.0625rem = 1px at a 16px root. */
  --density-unit: clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem);
}
```

A token is then authored as its **1440 value as a bare number**:

```css
--space-md: calc(16 * var(--density-unit));
--text-title: calc(28 * var(--density-unit));
```

`100vw / 1440` is a length divided by a number, which is a length: exactly 1 px when the viewport
is 1440. The `clamp` bounds supply ruling 3.5 — below 1280 and above 1440 the unit stops moving.

### 5.2 Why the bounds are in `rem`, and the accessibility result

A `vw`-derived unit does not respond to the reader's own font-size preference, which would fail
WCAG 1.4.4. Expressing both clamp bounds in `rem` fixes that: when the reader raises their default
font size, the bounds rise above the `vw` term and take over.

**Verified in Chrome, not reasoned about.** The formula above was injected into a live page and
measured at viewport 1422:

| | root 16 px | root 20 px |
| --- | --- | --- |
| `calc(28 * var(--density-unit))` | 27.654 px | 31.111 px |
| `calc(16 * var(--density-unit))` | 15.802 px | 17.778 px |

27.654 is 28 × 1422/1440 — the interpolation is exact. At a 20 px root the `rem` floor takes over
and type grows. The mechanism scales with the viewport *and* with the reader.

Re-run this before trusting the table (`docs/lessons.md` L-002 — record the command):

```js
// in the page console, on any app route
const p = document.createElement("div");
p.style.cssText = "--density-unit: clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem);" +
                  "font-size: calc(28 * var(--density-unit))";
document.body.append(p);
({ vw: innerWidth, title: getComputedStyle(p).fontSize });
```

### 5.3 Scoping, and why `rem` could not have done this

`rem` always resolves against the root element, so a root font-size change is all-or-nothing for
one document and cannot exempt a route group. A **custom property cascades**, so `--density-unit`
can be overridden on any subtree. That is the reason this mechanism is chosen over a root
font-size change.

The fluid value is the default on `:root`, because 38 of the 39 protected pages want it. The three
out-of-scope groups reset it:

```css
[data-density="reference"] { --density-unit: 0.0625rem; }  /* held at 1.0 */
```

> ⚠️ **CORRECTED 2026-09-21, after the line above shipped and did nothing.** That reset alone is
> **not** the opt-out, and the paragraph above is only half true. A `var()` inside a custom
> property is substituted on the element that **declares** the property, not on the element that
> reads it. Every token declared on `:root` as `calc(N * var(--density-unit))` therefore resolves
> against `:root`'s unit and inherits a finished length; overriding `--density-unit` on a
> descendant cannot reach it.
>
> Measured in Chrome at viewport 1280, with only the reset in place:
>
> | inside `[data-density="reference"]` | rendered | should have been |
> | --- | --- | --- |
> | `padding-left: var(--space-md)` (a `:root`-declared token) | **14.222px** | 16px |
> | `padding-left: calc(16 * var(--density-unit))` (direct) | 16px | 16px |
>
> The three layouts carried an attribute that changed nothing, and the whole marketing surface
> would have shipped ~11% small. **The opt-out is therefore two rules**: the reset above, plus a
> `[data-density]` block that re-declares the entire derived token layer on the scope element,
> where it resolves against that element's unit. `--density-unit` itself is not re-declared there.
>
> Two guards, because the first kind of guard is what let this through:
> `lib/design-tokens.test.ts` asserts the two token lists are the same set, and
> `tests/e2e/landing-page.spec.ts` **measures a computed value in a real browser**. A stylesheet
> assertion cannot catch this class of defect — the CSS text was correct throughout.

applied by the `(marketing)`, `(auth)` and `(immersive)` layouts. Those frames are drawn on a 1280
canvas and are already 1:1 correct; scaling them would take them 10% away from their own design.

**Portals.** `components/ui/{dialog,popover,select,tooltip}.tsx` render through a Radix `Portal`
into `document.body`, outside any route-group subtree. With the fluid value on `:root` a dialog
opened from an app screen inherits the correct density by default. A dialog opened from a
`data-density="reference"` group would not. Task 6 gives those four primitives a portal container
inside the group subtree so the attribute is inherited in both directions.

## 6. The token table

`@1440` is the authored value and, except where marked **NEW** or **CHANGED**, is the value the
token already holds. `@1280` is what renders at the owner's viewport.

### 6.1 Typography — `size / line-height`, px

| token | now | @1440 | @1280 |
| --- | --- | --- | --- |
| `caption` | 12 / 18 | 12 / 18 | **11 / 16.5** (floored, ruling 3.3) |
| `body` | 14 / 22 | 14 / 22 | 12.44 / 19.56 |
| `body-lg` | 16 / 26 | 16 / 26 | 14.22 / 23.11 |
| `heading` | 20 / 28 | 20 / 28 | 17.78 / 24.89 |
| `heading-lg` | 24 / 32 | 24 / 32 | 21.33 / 28.44 |
| `title` | 28 / 36 | 28 / 36 | 24.89 / 32.00 |
| `display` | 40 / 48 | 40 / 48 | 35.56 / 42.67 |
| `hero` | already fluid | — | see §9 open item |

When a rung reaches its floor its line-height floors with it, preserving the authored ratio; this
is why `caption` is 11 / 16.5 and not 11 / 16.

**The floor is `max()`, not a `clamp` bound, and the difference is not cosmetic.** `12 × w/1440`
reaches 11 px at w = 1320, so `caption` is under its floor across the whole 1280–1320 band, not
only at the 1280 endpoint. A `clamp` minimum on `--density-unit` holds the *unit* at 1280 and would
leave that band unguarded. The floor therefore wraps the token:

```css
--text-caption:    max(0.6875rem,   calc(12 * var(--density-unit)));  /* 11px    */
--leading-caption: max(1.03125rem,  calc(18 * var(--density-unit)));  /* 16.5px  */
```

`caption` is the only rung that needs this: the next one up, `body`, bottoms out at 12.44 px and
never approaches a floor inside the range.

### 6.2 Spacing — px

| token | @1440 | @1280 | | token | @1440 | @1280 |
| --- | --- | --- | --- | --- | --- | --- |
| `2xs` | 4 | 3.56 | | `lg` | 24 | 21.33 |
| `xs` | 8 | 7.11 | | `xl` | 32 | 28.44 |
| `sm` | 12 | 10.67 | | `2xl` | 48 | 42.67 |
| `md` | 16 | 14.22 | | `3xl` | 64 | 56.89 |
| `md-lg` | 20 | 17.78 | | | | |

### 6.3 Radius — px

| token | @1440 | @1280 |
| --- | --- | --- |
| `sm` | 8 | 7.11 |
| `md` | 14 | 12.44 |
| `lg` | 20 | 17.78 |
| `DEFAULT` | 4 | 3.56 — see §9 open item |
| `full` | 9999 | literal, never scales |

### 6.4 Layout — px

| token | @1440 | @1280 | note |
| --- | --- | --- | --- |
| `--layout-sidebar-width` | 224 | **199.11** | **CHANGED** — carve-out revoked, ruling 3.2 |
| `--layout-sidebar-collapsed` | 68 | **60.44** | **CHANGED**, with the hit-target floor in §7 |
| `--layout-content-max` | 1240 | 1102.22 | |
| `--layout-header-height` | 64 | 56.89 | |
| `--layout-companion-width` | `clamp(15rem, 27.5%, 21.25rem)` | share unchanged | **CHANGED** — the 15rem floor and 21.25rem cap become density-scaled (240 → 213.33, 340 → 302.22); the 27.5% share is already proportional and is not touched |
| `--layout-gutter` | `var(--space-xl)` | follows `xl` | no separate value |
| `--layout-column-gap` | `var(--space-lg)` | follows `lg` | no separate value |
| `--layout-marketing-max` | 1256 | **1256** | does NOT scale — drawn on a 1280 canvas, out of scope |

### 6.5 Control heights — **NEW**

| token | @1440 | @1280 | replaces |
| --- | --- | --- | --- |
| `--control-sm` | 36 | 32.00 | `h-9` |
| `--control-md` | 40 | 35.56 | `h-10` |
| `--control-lg` | 44 | 39.11 | `h-11` |

### 6.6 Icon sizes — **NEW**

| token | @1440 | @1280 | replaces |
| --- | --- | --- | --- |
| `--icon-xs` | 12 | 10.67 | `h-3` |
| `--icon-sm` | 16 | 14.22 | `h-4` |
| `--icon-md` | 24 | 21.33 | `h-6` |
| `--icon-lg` | 28 | 24.89 | `h-7` |

## 7. Accessibility floors

Ruling 3.2 allows a dimension tied to hit target or accessibility to hold its own minimum. Three
do:

- **`caption` floors at 11 px / 16.5 px line-height.** Ruling 3.3.
- **Interactive rows in the collapsed rail keep a 44 px minimum height**, independent of the
  60.44 px rail width. The width may scale; the target may not shrink below 44.
- **`--control-lg` reaches 39.11 px at 1280**, below the 44 px touch-target convention. This is
  accepted: the density rule is bounded to 1280–1440, a pointer-driven desktop range, and WCAG
  2.5.8 (AA) requires 24 × 24. Recorded so it is not rediscovered as a defect.

Unchanged and re-verified after the token change: every colour pairing still passes WCAG AA
(`lib/design-tokens.contrast.test.ts` is unaffected — no colour token moves), and WCAG 1.4.4
resize is preserved by §5.2.

## 8. Tasks, in the owner's order

1. **Consolidate the typography source of truth.** Audit all 36 `text-sm` / `text-xs` sites in the
   two calibration screens and the shared shell; migrate each by semantic role to `text-body`,
   `text-caption` or the correct rung. No blind replacement — `text-sm` on a label and `text-sm` on
   body copy are different decisions. Land a guard that fails when a Tailwind default type utility
   is used where a rung exists. Exit condition: one source of truth per rung.
2. **Define the density function.** `--density-unit` on `:root`, the `data-density="reference"`
   reset, and the three out-of-scope layouts wired to it. Tests pin both endpoints and one
   interpolated point.
3. **Convert the token layer.** Type, spacing, radius, layout, plus the new control and icon
   tokens, all expressed as `calc(N * var(--density-unit))` per §6. Update
   `lib/design-tokens.test.ts` to the new contract.
4. **Migrate the two calibration screens.** Replace the 26 numeric spacing utilities and the
   scattered `h-9`/`h-10`/`h-11` and icon sizes with the semantic tokens. No page-level values that
   a token or shared primitive could carry (ruling 3.6).
5. **Visual regression at 1280 and 1440.** Production-build browser measurement of both screens at
   both viewports, against the numbers in §6 and against the owner's approved zoom-90% composition.
6. **Portal containers** for `dialog`, `popover`, `select`, `tooltip` (§5.3).
7. **Write the rule** into `docs/design/screens/adaptive-layouts.md`, replacing the frame-fidelity
   section the previous branch left: desktop frame fidelity does **not** mean copying raw px; a
   frame dimension is normalized to the 1440 reference and expressed as a token before it is
   implemented. Every desktop screen after this one uses this scale by default.

## 9. Open items, named so they are not discovered late

- **`--text-hero` is already fluid** on a different formula, introduced by the landing-page port to
  fix a WCAG 1.4.10 reflow failure. It is a marketing-surface token and the marketing group holds
  density at 1.0, so the two systems do not currently collide. Task 3 must confirm that and leave
  `hero` alone, or reconcile it deliberately — not silently.
- **`borderRadius.DEFAULT` (4 px, ~25 call sites)** was deferred out of `desktop-density-pass` by
  owner ruling. It will scale automatically once the radius scale is converted. That is a change
  the earlier ruling did not authorize, so task 3 surfaces it for a decision rather than assuming
  it.
- **`100vw` includes the scrollbar.** At a 1280 window with a 15 px scrollbar the density unit is
  computed on 1280 while the content box is 1265. This is the intended reading — the reference is
  the viewport, not the content box — but it means a measured column will sit ~1% under the table's
  figure. The §5.2 verification numbers already carry this.
- **Pinned pixel assertions will go red**: the token contract, the density pass's own guards, and
  the e2e geometry cases. Expected, and part of tasks 1–3, not a surprise to be triaged later.

## 10. Out of scope

The `(marketing)`, `(auth)` and `(immersive)` route groups; the Auth + Error UX port, which is the
branch after this one; any colour token; any new breakpoint; and mobile or tablet behaviour below
1280, which ruling 3.5 explicitly leaves to the existing responsive rules.
