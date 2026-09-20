# Desktop density pass — design (2026-09-20)

> Branch `desktop-density-pass`. Owner of this document: Claude. Implementation: Codex.
>
> This spec exists because the owner reported that the app "looks bad, too big, too much
> scrolling" at browser zoom 100% and "looks much classier" at 90%, and asked that the 90%
> composition become the default at 100% for every screen ported from here on.

## 1. The finding

The 90% preference is **not** a preference for smaller text. Every CSS pixel value is identical at
both zoom levels; the only thing that changes is the CSS viewport width. On the owner's machine
(1280x720 DIP, OS scaling 150%):

| browser zoom | CSS viewport |
|---|---|
| 100% | 1280 px |
| 90% | 1422 px |

Four fixed-pixel decisions in the shell were sized against a wider canvas than the owner's
viewport. At 1422 they land on their designed proportion; at 1280 they do not. That is the whole
effect, and each of the four is measured below.

## 2. Evidence

All app frames in the Korume Figma file (`IwFHZDZdHW7qsSFiNbWrkd`) are drawn on a **1536** canvas.
The auth / error / membership batch captured 2026-08-23 is drawn on **1280**. The marketing frame
`347:6277` is also 1280. Mixed authoring widths is a fact about the file, not a defect this branch
fixes; it matters only because the shell was ported from a 1536 frame.

Frame `149:2` (Shadowing hub, 1536 canvas), read via `get_metadata` and `get_design_context`:

| element | frame value | share of its container |
|---|---|---|
| Sidebar | 224 px | 14.6% of 1536 |
| Main content region | 1312 px at x=224 | — |
| Inner container | 1240 px, gutter 36, top 24 | — |
| Main column | 873 px | 70.4% of 1240 |
| Companion rail (`149:1162`) | **339 px** | **27.3% of 1240** |
| Column gap | 28 px | — |
| Rail card (`149:1163`) | radius **22**, padding **20**, border 0.8 | — |
| Rail card inner chip (`149:1197`) | radius 10, padding 12/10 | — |
| FeaturedHero (`149:464`), 873 x 280 | radius **22**, padding 28 | the largest card draws the same radius as the smallest |

Frame `200:7705` (Explore Lessons, 1536 canvas):

| element | frame value |
|---|---|
| Sidebar | 224 px |
| Main content region | 1312 px |
| Search field (`200:8180` Label) | **440 px wide, 38 px tall**, centred in a 72 px header |

The running app, measured in Chrome at viewport 1280 and again at 1422 (dev server, `/vi/shadowing`
and `/vi/shadowing/explore`, Vietnamese locale):

| element | shipped | at vw 1280 | at vw 1422 | frame equivalent |
|---|---|---|---|---|
| Sidebar | `w-60` = **240 px** | 18.8% of vw | 16.9% | 224 px / 14.6% |
| Shell inner content box | — | 937 px | 1079 px | 1240 px |
| Main column | `minmax(0,1fr)` | **613 px** | 753 px | 873 px |
| Companion rail | `300px` fixed | **32.0%** of inner | **27.8%** | **27.3%** |
| Card radius | `rounded-xl` = **28 px** | on boxes 91 px tall (31% of the short side) | same | 22 px on a 1536 canvas = 18.3 px at 1280 |
| Card padding | `p-md-lg` = 20 px | same at every card size | same | 20 px on a 1536 canvas = 16.7 px at 1280 |
| Explore search field | **818 x 44 px** | 87% of the inner box | same ratio | 440 x 38 = 367 x 32 at 1280 |

**How to re-measure the shipped column, rather than trusting the table** (`docs/lessons.md` L-002 —
record the command, not its output). With the dev server running and authenticated, at the viewport
you want to test:

```js
// in the page console, on /vi/shadowing
const shell = document.querySelector('main .grid');
({ vw: innerWidth,
   cols: getComputedStyle(shell).gridTemplateColumns,
   nav: document.querySelector('nav').getBoundingClientRect().width });
```

The rail's share is the second track divided by the sum of both tracks plus the gap. The frame side
re-measures with `get_metadata` on `149:2` and `200:7705`, and `get_design_context` on `149:1163`
(rail card) and `149:464` (featured hero) for radius and padding.

**The rail number is the whole explanation.** At 1422 the rail holds 27.8% of the shell, which is
the frame's 27.3% to within half a point. At 1280 it holds 32.0%, because 300 px is a constant
while the column beside it is not. The rail does not grow; the main column shrinks by 19%, from
753 px to 613 px. That is what the owner saw as "the right-hand part is too big and it squeezes the
middle column".

## 3. What is NOT wrong — measured, so this is not reopened

- **The 70/30 column split is correct.** Shipped 753/1077 = 69.9% against the frame's 873/1240 =
  70.4%. The split is right; only the rail's *fixed* track is wrong.
- **The type scale is correct and is not touched by this branch.** Body 14 px and caption 12 px
  match the frame's own absolute values. Shrinking type would be a legibility regression
  (`AGENTS.md`, WCAG) and would not fix the rail.
- **The marketing header and footer are already at frame scale.** `--layout-marketing-max` is
  1256 px with a 32 px gutter, measured off frame `347:6277`, which is itself 1280 wide — so at the
  owner's 1280 viewport the public pages render 1:1 with their design. Measured: header inner
  1256 x 64, footer inner 1256. **No change is owed on the public header or footer**, and the
  request to "include the navbar and the footer" is answered by D2 (the app sidebar), not by
  editing `site-header.tsx` or the marketing footer.
- **`--radius-lg: 20px` is already the ruled card radius.** `app/globals.css` states it moved
  12 -> 20 "to match the Figma cards (the design draws rounded-[22px])". This branch invents no new
  radius; it fixes call sites that reach for the wrong rung.

## 4. Decisions

### D1 — The companion rail is a proportion, not a constant

`--layout-companion-width: 300px` is replaced by a track that holds the frame's share of the shell
and stops growing once it reaches the frame's own pixel value:

```
grid-cols-[minmax(0,1fr)_clamp(15rem,27.5%,21.25rem)]
```

- 27.5% is frame `149:2`'s 339/1240, rounded to the nearest half point.
- 21.25rem = 340 px is the frame's own rail width, so the rail never exceeds what was drawn.
- 15rem = 240 px is the floor, below which the rail stops being usable and the layout must stack
  (the existing responsive behaviour below the `xl` breakpoint is unchanged by this branch).

Resulting rail share: 27.5% at every width from ~873 px of inner box up to 1236 px, then capped.

**Documented limitation, accepted by the owner 2026-09-21.** Between a 1024 viewport (where the
mobile handoff stops and the two-column grid starts) and roughly 1177, the inner box is below
873 px, the 15rem floor binds, and the rail holds ~35% of the shell rather than 27.5% — more than
the 32% that this spec calls the defect at 1280. It is still an improvement at the same width: the
shipped 300 px constant held 43.9% there. The floor is deliberate — a rail below 240 px stops being
usable — and `TwoColumnShell` carries no responsive variant that would stack instead. Restoring the
frame share across that band means a new breakpoint, which D5 rules out of this branch.

⚠️ **Implementation trap, stated here because it will not announce itself.** The `<aside>` in
`two-column-shell.tsx` currently carries `w-[--layout-companion-width]`. A percentage in that
position resolves against the aside's own grid area, not the grid content box, so a percentage
track plus that class yields 27.5% of 27.5%. The aside must become `w-full`.

### D2 — The sidebar uses the token that already exists

`components/layout/app-nav.tsx:47` hardcodes `w-60` (240 px) while `--layout-sidebar-width: 224px`
— measured from frame `149:2` and exposed as Tailwind's `w-sidebar` — has **zero consumers**. The
class becomes `w-sidebar`. This is a defect fix, not a design change: the token and its measurement
predate this branch.

### D3 — Card radius uses the ruled rung, and the unused rung is removed

Every card surface uses `rounded-lg` (20 px). There is **no** hero exception.

⚠️ An earlier draft of this decision kept `rounded-xl` "for full-bleed or hero surfaces taller than
~200 px". **That exception was measured and does not exist.** Frame `149:2`'s FeaturedHero
(`149:464`) is 873 x 280 — the largest card on the page — and draws `rounded-[22px]`, the same
radius as the 339 x 225 rail card. The design draws 22 on every card surface regardless of size.

Consequences:

- The nine product call sites of `rounded-xl` move to `rounded-lg`:
  `hub-companion-rail.tsx` (4), `hub-empty-state.tsx`, `hub-featured-hero.tsx`,
  `hub-lesson-card.tsx`, `hub-library-section.tsx`, and
  `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx`.
- `--radius-xl: 28px` then has no product consumer, only the style guide documenting itself. It is
  **removed**, from `app/globals.css`, from `tailwind.config.ts`'s `borderRadius` map, and from the
  style guide's own table (`token-sections.tsx`, `style-guide.test.tsx`). The scale becomes
  sm 8 / md 14 / lg 20.
- Removing the Tailwind key matters as much as removing the variable: leaving `xl` mapped to a
  deleted variable would make a future `rounded-xl` silently render square.

Rationale in one number: a 28 px corner on a 91 px-tall card rounds 31% of its short side; the
frame rounds 9.8% (22 on 225). That ratio, not the absolute value, is what reads as bloated.

An unused rung is also precisely the shape of D2's defect — `--layout-sidebar-width` sat correct and
unconsumed while the code hardcoded a different number. This branch does not leave a second one.

### D4 — The explore search field is a control, not a banner

Frame `200:7705` draws the field 440 px wide inside a 1312 px content region — **33.5%**, with the
440 as its value at the 1536 canvas. Shipped, the row is `flex` with `flex-1` on the input, so it
takes whatever is left: 818 px at a 1280 viewport, 2.2x the design.

The **input** is capped — a share, with the frame value as the maximum. The row is not capped:

```
max-w-[clamp(18rem,28.65vw,27.5rem)]   // on the input, not on the flex row
```

27.5rem = 440 px is the frame's own width; 18rem = 288 px is the floor below which the field stops
holding a useful query. At a 1280 viewport the input renders ~367 px instead of 818.

⚠️ **Corrected 2026-09-21, owner ruling, after whole-branch review.** This decision first read
`max-w-[clamp(18rem,33.5%,27.5rem)]` **on the flex row**. Both halves of that were wrong:

- **Wrong element.** The row holds the input, a `gap-sm`, and the submit button. Capping the row at
  the frame's field width leaves the input at roughly 210–230 px at a 1280 viewport, against the
  367 px this spec's own §2 records as the frame equivalent. Frame `200:8180` measures the
  **field**; the cap belongs on the field.
- **Wrong denominator.** 33.5% is 440 of the 1312 content region. §5 rules that a frame dimension
  divides by *the canvas the frame was drawn on* — 1536 — which is 28.65%, and viewport units are
  how that share is expressed without re-deriving the content box. 28.65vw resolves to 366.7 px at
  1280, 440 px at 1536, and is held at the 27.5rem cap above that. The percentage form made D4 the
  one decision on this branch that did not obey the rule the branch exists to establish.

Height moves from `h-11` (44 px) to `h-10` (40 px), the nearest existing rung to the frame's 38 px.
No new height value is introduced.

### D5 — No new scale, no new breakpoint, no type change

This branch adds no token, no breakpoint and no clamp on the type scale. It **removes** one token
(`--radius-xl`, D3) because the evidence says nothing draws it. Every value it writes is either an
existing token or a number read off a frame and recorded in §2. A future "compact desktop scale"
remains possible and is explicitly **not** this branch.

## 5. The rule this leaves behind, for every screen ported after it

Recorded in `docs/design/screens/adaptive-layouts.md` as part of this branch:

> A shell dimension read off a Figma frame is a **share of that frame's canvas**, not a pixel
> constant, unless the element is a fixed control (icon button, avatar, form row height) or a
> **persistent navigation rail that owns a collapsed state and a fixed text measure**. Frames on
> the 1536 canvas: divide by 1536. Frames on the 1280 canvas: divide by 1280. A constant is allowed
> only as the `max` of a clamp, never as the whole track.

That single sentence is what would have prevented this defect, and it is what the Auth + Error port
(the next branch) is expected to follow.

⚠️ **The nav-rail carve-out was added 2026-09-21 by owner ruling**, because the rule as first
written condemned D2. `--layout-sidebar-width: 224px` is a shell dimension read off the 1536 frame
(14.6%, which would be 187 px at 1280) and D2 ships it as a bare constant. That is correct and the
rule was incomplete: the rail carries label text at a fixed type size and a collapse control, so
narrowing it with the viewport crops the labels rather than rebalancing the layout — a rail that
scales has no width at which it both fits its text and holds its share. The two escapes it already
owns are the collapsed rung (`--layout-sidebar-collapsed: 68px`) and, below 1024, the mobile
handoff. A shell element with a fixed text measure and a discrete collapsed state is therefore a
fixed control in the sense this rule means, and the rule now says so instead of leaving the next
port to rediscover it.

## 6. Implementation surface

| file | change |
|---|---|
| `app/globals.css` | `--layout-companion-width` becomes the clamp of D1; comment records frame evidence |
| `components/layout/two-column-shell.tsx` | grid track from D1; aside `w-[…]` -> `w-full`; docblock updated (it currently claims 300 px is "the approved fluid-desktop adaptation of 340 px" — that claim is what this branch retires) |
| `components/layout/app-nav.tsx` | `w-60` -> `w-sidebar` |
| 9 product `rounded-xl` call sites | `rounded-lg` per D3 |
| `tailwind.config.ts`, `components/style-guide/token-sections.tsx`, `components/style-guide/style-guide.test.tsx` | drop the `xl` radius rung per D3 |
| the explore search field component | D4 — the cap goes on the **input**, not the row |
| `docs/design/screens/adaptive-layouts.md` | the rule in §5, including the nav-rail carve-out |

Added 2026-09-21 by the whole-branch review, all six accepted by the owner:

| file | change |
|---|---|
| `tests/e2e/shadowing-hub.spec.ts` | `toBeCloseTo(300, 0)` at both call sites asserts the constant D1 deletes. Replace with an assertion of the *behaviour*: the rail equals the clamp the shell resolves, and is never the bare 300 |
| `components/style-guide/style-guide.test.tsx` | the D3 guard walks a hardcoded six-file list; widen it to a directory walk over `components/` and `app/`, per §7 T3 as written |
| `components/shadowing/explore-lesson-card.tsx` | `rounded-[22px]` -> `rounded-lg`; it is a card surface and D3 admits no exception |
| `components/ui/token-scale.test.ts` | add `components/shadowing` to `SCANNED_DIRS`, which is why the line above survived |
| `tailwind.config.ts` | delete `width.companion`; the token behind it now holds a percentage, so `w-companion` is the 27.5%-of-27.5% trap D1 warns about, with zero consumers |
| `components/layout/two-column-shell.tsx`, `components/shadowing/hub-featured-hero.tsx` | drop the no-op `shrink-0` on the grid-item aside; refresh the hero's `sizes` hint, which still claims 55rem against a slot now measured at 677.8 px / 1244 px |

## 7. Tests

Each is falsifiable and must fail before the change:

- **T1** `two-column-shell.test.tsx`: the rail track contains a `clamp(` and does **not** contain a
  bare `300px`; the aside does not carry a width utility resolving to a percentage.
- **T2** `app-nav.test.tsx`: the nav element carries `w-sidebar` and not `w-60`.
- **T3** `style-guide.test.tsx` no longer lists `["rounded-xl", 28]`, and a grep-anchored assertion
  holds that `rounded-xl` appears nowhere under `components/` or `app/` — anchored to the class
  attribute, not to prose (`docs/lessons.md` L-002).
- **T4** the explore search **input** carries the max width and a height of `h-10`; the row carries
  no cap.
- **T5** the existing `two-column-shell` and nav snapshots are updated deliberately, not
  regenerated blindly; the diff is read.
- **T6** (added 2026-09-21) `shadowing-hub.spec.ts` asserts the rail against the resolved clamp and
  fails if it is 300. It cannot be mutation-checked from green, because the case is masked by an
  unrelated baseline failure at its line 112 — see §8. Run it against a branch build and read the
  rail width it reports before and after the change.
- **T7** (added 2026-09-21) the widened D3 guard scans a directory walk and asserts the collected
  file count is greater than the six it replaces (`AGENTS.md` §7: a pattern-gathered collection
  asserts its own non-emptiness). It must go red on `explore-lesson-card.tsx` **before** that file
  is fixed — that is the mutation check, and it is free here because the violation already exists.

## 8. Verification gate

`npm run verify:protocol` · `npm run typecheck` · `npx vitest run --reporter=dot` · `npm run lint` ·
`npm run build`, each run and read. Playwright **is** owed here: this branch changes rendered app
chrome on live routes. Plus a manual read at three viewport widths — 1280, 1422, 1920 — on
`/vi/shadowing` and `/vi/shadowing/explore`, with the main-column width recorded at each.

Expected main-column width at 1280 after D1 + D2: **~684 px**, up from 613 (+11.6%). If the measured
number is not within a few pixels of that, D1 or D2 did not land and the branch is not done.

**Added 2026-09-21: the Hub is not covered by a branch Playwright run.** `playwright.c3.config.ts`
carries `testMatch: "shadowing-explore.spec.ts"` — three Explore cases — and the default suite ran
against a server outside the worktree, i.e. against `master`. D1 changes the Hub, so the Hub gate
must be a run of `shadowing-hub.spec.ts` against a **branch** production build, not the default
suite against 3000.

Baseline confirmed by Claude 2026-09-21: on the 3000 `master` server, `shadowing-hub.spec.ts` fails
at **line 112**, an import error-string mismatch ("Something went wrong importing that video" vs the
expected "We couldn't fetch details for that video"), unrelated to this diff. That failure aborts
the case *before* the rail assertion at line 120 — which is why a 300 px pin survived a branch that
deletes the 300 px constant.

## 9. Open questions

**Deferred to its own branch, owner ruling 2026-09-21: the `rounded` DEFAULT rung.** D3 replaces
Tailwind's radius scale outright, which means `tailwind.config.ts` now declares
`DEFAULT: "0.25rem"` — a 4 px literal that is not a token, is reachable as `rounded`, is drawn at
roughly 25 product call sites, and is invisible to `token-sections.tsx` and `style-guide.test.tsx`,
both of which state the scale has exactly three rungs. Behaviour is unchanged from the framework
default, so this is not a regression; it is a rung nothing documents, which is the mirror image of
the rung nothing drew that D3 removed. It is **not** fixed here: moving 25 call sites without frame
evidence for what each should become is a design pass, not a density fix, and D5 forbids inventing
the rung this branch would need.

The one product conflict discovered while scoping — frames `332:3` / `65:2` draw Apple and
GitHub OAuth buttons while `decision-register.md` **P14** rules auth as email + Google — was ruled
by the owner on 2026-09-20: **P14 stands, the two buttons are not ported**. That ruling belongs to
the next branch, not this one, and is recorded here only so it is not rediscovered.
