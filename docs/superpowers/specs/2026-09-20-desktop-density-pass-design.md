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

⚠️ **Implementation trap, stated here because it will not announce itself.** The `<aside>` in
`two-column-shell.tsx` currently carries `w-[--layout-companion-width]`. A percentage in that
position resolves against the aside's own grid area, not the grid content box, so a percentage
track plus that class yields 27.5% of 27.5%. The aside must become `w-full`.

### D2 — The sidebar uses the token that already exists

`components/layout/app-nav.tsx:47` hardcodes `w-60` (240 px) while `--layout-sidebar-width: 224px`
— measured from frame `149:2` and exposed as Tailwind's `w-sidebar` — has **zero consumers**. The
class becomes `w-sidebar`. This is a defect fix, not a design change: the token and its measurement
predate this branch.

### D3 — Card radius uses the ruled rung

Every card surface uses `rounded-lg` (20 px). `rounded-xl` (28 px) is reserved for full-bleed or
hero surfaces taller than ~200 px, where a 28 px corner is under 15% of the short side. The audit
covers the 11 `rounded-xl` occurrences under `components/` and `app/`; each one either moves to
`rounded-lg` or gains a one-line comment naming the surface that justifies 28.

Rationale in one number: a 28 px corner on a 91 px-tall card rounds 31% of its short side. The
frame's rail card rounds 9.8% (22 on 225). That ratio, not the absolute value, is what reads as
bloated.

### D4 — The explore search field is a control, not a banner

The field is capped at `28.6%` of the shell inner box with a 440 px maximum (frame `200:8180`:
440/1536), and its height moves from 44 px to the frame's 38 px — which is `h-10` under the
existing scale, not a new value. At 1280 it renders ~268–367 px instead of 818 px.

### D5 — No new scale, no new breakpoint, no type change

This branch adds no token, no breakpoint and no clamp on the type scale. Every value it writes is
either an existing token or a number read off a frame and recorded in §2. A future "compact
desktop scale" remains possible and is explicitly **not** this branch.

## 5. The rule this leaves behind, for every screen ported after it

Recorded in `docs/design/screens/adaptive-layouts.md` as part of this branch:

> A shell dimension read off a Figma frame is a **share of that frame's canvas**, not a pixel
> constant, unless the element is a fixed control (icon button, avatar, form row height). Frames on
> the 1536 canvas: divide by 1536. Frames on the 1280 canvas: divide by 1280. A constant is allowed
> only as the `max` of a clamp, never as the whole track.

That single sentence is what would have prevented this defect, and it is what the Auth + Error port
(the next branch) is expected to follow.

## 6. Implementation surface

| file | change |
|---|---|
| `app/globals.css` | `--layout-companion-width` becomes the clamp of D1; comment records frame evidence |
| `components/layout/two-column-shell.tsx` | grid track from D1; aside `w-[…]` -> `w-full`; docblock updated (it currently claims 300 px is "the approved fluid-desktop adaptation of 340 px" — that claim is what this branch retires) |
| `components/layout/app-nav.tsx` | `w-60` -> `w-sidebar` |
| 11 `rounded-xl` call sites | audit per D3 |
| the explore search field component | D4 |
| `docs/design/screens/adaptive-layouts.md` | the rule in §5 |

## 7. Tests

Each is falsifiable and must fail before the change:

- **T1** `two-column-shell.test.tsx`: the rail track contains a `clamp(` and does **not** contain a
  bare `300px`; the aside does not carry a width utility resolving to a percentage.
- **T2** `app-nav.test.tsx`: the nav element carries `w-sidebar` and not `w-60`.
- **T3** a new assertion that no file under `components/` or `app/` uses `rounded-xl` without an
  adjacent justification comment — mechanical, in the spirit of the registry's own grep-anchored
  tests (`docs/lessons.md` L-002: anchor the pattern, do not match prose).
- **T4** the explore search field has a max width and a height of `h-10`.
- **T5** the existing `two-column-shell` and nav snapshots are updated deliberately, not
  regenerated blindly; the diff is read.

## 8. Verification gate

`npm run verify:protocol` · `npm run typecheck` · `npx vitest run --reporter=dot` · `npm run lint` ·
`npm run build`, each run and read. Playwright **is** owed here: this branch changes rendered app
chrome on live routes. Plus a manual read at three viewport widths — 1280, 1422, 1920 — on
`/vi/shadowing` and `/vi/shadowing/explore`, with the main-column width recorded at each.

Expected main-column width at 1280 after D1 + D2: **~684 px**, up from 613 (+11.6%). If the measured
number is not within a few pixels of that, D1 or D2 did not land and the branch is not done.

## 9. Open questions

None. The one product conflict discovered while scoping — frames `332:3` / `65:2` draw Apple and
GitHub OAuth buttons while `decision-register.md` **P14** rules auth as email + Google — was ruled
by the owner on 2026-09-20: **P14 stands, the two buttons are not ported**. That ruling belongs to
the next branch, not this one, and is recorded here only so it is not rediscovered.
