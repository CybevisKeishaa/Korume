# Landing page port (`/`) — run state

> **Live file. Short on purpose.** The full narrative of sessions 1-6 — every measurement, every
> rejected attempt, every piece of evidence behind the rulings below — is in
> `mem:landing_page_port_archive` (~96KB; grep it, do not open it whole). Split 2026-09-03 because
> reading the combined file had become the expensive part of starting a session.
>
> ⚠️ **This memory is navigation, process, and decisions taken on the owner's behalf. It does NOT
> restate the design or the plan.** The spec and `docs/superpowers/plans/2026-08-27-landing-page-port.md`
> travel with the repo; this does not. If this file and either of them disagree, they win.

# ▶▶ RESUME HERE

**Run `git log --oneline -5`.** The last hash this file can honestly state is **`27f74b8`**
(2026-09-03, session 6); anything after it was written by a later session. A file cannot name the
commit that contains it — writing one means predicting it, which is the L-002 failure this branch
has paid for four times.

**Branch `landing-page-port`. Nothing merged, nothing pushed.** Everything is built: tasks 1-13,
A1/A2/A3, P, V, the independent review and its fixes.

Gate, each command run and read (session 6): `tsc` exit 0 · `npm run lint` **0 errors, 81 warnings**
(all pre-existing, none in the diff — verified per file; an older note said "11", which was a
different counting method — do not repeat it) · `npx vitest run` **2589 over 281 files** ·
`npx playwright test` **27/27**.

## ▶▶ WHAT REMAINS, IN ORDER

1. **Task A-MOTION** — the whole-page motion pass, plus the unexplained `/en#problem` scroll drift.
   ▶ It also owns **the mobile sheet's transition**: `site-menu.tsx` ships with NO animation
   deliberately, and adding one turns §2's currently-vacuous reduced-motion gate into a real one.
2. **Whole-branch review** (L-011), then a review of the fix wave (L-012) — on this project the
   second pass has repeatedly caught defects the first wave created.
3. **The branch-end `docs/lessons.md` pass — 16 queued entries** (listed at the end of the archive's
   session-5 and session-6 sections).
4. **The owner's mobile landing page** — new, large, and deliberately out of scope. See below.

## ⚠️⚠️ THE OWNER'S MOBILE LANDING PAGE — NOT STARTED, SCOPE ALREADY RULED

Figma file `IwFHZDZdHW7qsSFiNbWrkd`: `429:2` "Landing page 320 px", `433:728` "Landing page 390px",
`434:1453` "Menu". Their generating prompt (18 sections, colours, type sizes, spacing) was given in
the session-6 chat.

⚠️ **The frames are 935px-wide artboards with a ~380/430px centred design column and full-bleed
backgrounds.** Do not read the frame width as the viewport.

⚠️ **It is not a mobile version of the built page — it is a richer page.** ~12 sections against our
9, and at least five have no counterpart: "Understand the pieces without losing the sentence"
(思 / 思ったより / 〜より table) · "Your learning journey becomes context" (timeline) · "Practice
before the real thing" (JLPT N3 set) · "Mistakes become part of the lesson" (01-04 ✓/✕ + Explain) ·
"Your Japanese, all in one place" (あなたの日本語 hub + 9 chips).

▶ **RULED 2026-09-03: build the HEADER + MENU only and close Task 13. The rest is separate work.**

**Two questions must be answered before any of it is built:**
1. **Do the five new sections go on DESKTOP too?** If mobile has them and desktop does not, one page
   carries two different contents — CLAUDE.md §6 calls that a defect, not a trade-off.
2. **What do the menu rows point at?** The owner says a row scrolls to its section. It cannot today:
   the rows are Explore / Shadowing / Kanji / Grammar / Practice / Companion / Pricing / FAQ and no
   section carries those names. The shipped sheet therefore uses the six existing `NAV_ITEMS` at
   their existing routes and drops Pricing/FAQ, which have no URL anywhere.

## ✅ TASK 13 — DONE (`9cebadd`)

The page no longer scrolls sideways at any width in either locale (WCAG 1.4.10, CLAUDE.md §2 r5).
**Three causes, where every earlier note named at most two:**

| where | cause | fix |
|---|---|---|
| en 320/360/390 | `#hero h1` — "understand." is 390.5px at a fixed 64px, in a 288px column | `--text-hero` → `clamp(2rem, 5.7vw + 1rem, 4rem)` |
| en+vi 768 | footer `admin@almostgone.vn` — 153.9px in a 118.4px grid track | `break-words` |
| **en +27.6 / vi +9.6 @320** | **§0's header — in NO earlier note; in vi it is the ONLY offender** | hamburger + sheet |

Also closed here: §3's two Japanese sentence lines got `break-words` (a romaji token measured 285px
in a 68px panel), and the ledger's owed §3 assertion landed as containment **and** keyboard reach.

**Density: settled, do not touch `py-2xl`.** 4480px at 1280 vs frame 347:6277's 4028. Six of eight
sections sit within ±43px of the frame's own bands; the 452px is **+208 signoff** (a section the
frame does not have — owner-ruled), **+358 hero**, **−151 journey**, +35 the rest. Frame bands:
header 60 · 519.7 · 450.0 · 522.9 · 473.3 · 393.3 · 357.7 · 234.1 · 336.5 · footer 681.6.

### ⚠️ The 2026-08-28 "no hamburger" ruling is REVERSED, by the owner

R4 said mobile nav → the app stores instead of a hamburger. Their Figma draws a hamburger. The
arithmetic agreed independently: at 320 the bar has **288px** and its four clusters need
**380.6 (en) / 403.1 (vi)** unwrapped — no combination of smaller type fits, so it was structural,
not styling. Store links keep both footer blocks; nothing was lost.

`components/layout/site-menu.tsx` — read its docblock before changing it. Three things are
load-bearing and each was learned the hard way:
- **Disclosure, not `components/ui/dialog.tsx`.** The design draws no scrim; the Radix modal would
  add a scrim, a scroll lock and a focus trap the design does not have.
- **`absolute top-full`, never `fixed`.** The bar has `backdrop-blur`, and a backdrop filter makes
  its element a containing block for fixed descendants — a `fixed` panel anchors to the 64px bar.
- **It closes on focus-out.** Tabbing past the last row put focus on the hero CTA *underneath* the
  opaque sheet: a focus ring nobody can see, WCAG 2.4.7 failing at exactly one step. jsdom cannot
  see this; only the browser sweep found it.

## ▶ THE METHOD RULES THIS BRANCH PAID FOR — apply before measuring anything

- **Finding page overflow: use a `Range` over TEXT NODES plus an ancestor `overflow-x` walk.**
  Filtering on `getBoundingClientRect().right` returns a wall of irrelevant `LI`s inside `#journey`'s
  scroll container and CANNOT see the offender, because text overflowing its own box does not move
  the box's rect. This single mistake misdirected Task 13 through three sessions.
- **A dead dev server reports ZERO overflow at every width**, because a 500 page has
  `scrollWidth === clientWidth` too. Every browser measurement must first assert the page rendered
  (9 sections). One sweep this session was green against a server returning 500s.
- **A new test that passes on its first run is a defect in the test.** The §3 long-token guard used
  kana and went green instantly — Japanese breaks between characters, so there was no unbreakable
  token in it. Romaji made it red.
- **`aria-hidden` is INHERITED.** Checking it on the element alone reported six false positives.
- **A bound is not a target.** The first hero clamp (`13vw`) was derived only from the reflow ceiling
  and rendered 50.7px at 390 — inside the bound and visibly wrong against the owner's own brief.
  Re-anchored on their two stated sizes (36-40px at 390, 64px at 1280).
- **`git checkout -- <file>` to undo a mutation check DESTROYS uncommitted work in that file.** Copy,
  mutate, restore from the copy, verify with `sha256sum -c`.
- **A guard written over existing code cannot fail first — mutation-check it** and report both
  outputs (CLAUDE.md §7). A collection gathered by a pattern must also be asserted non-empty and of
  the size you expect (L-004).
- **Render at 3x and LOOK, then put the render in front of the owner.** Both of the owner's §4
  corrections came after every metric was green, and both were about the picture.

## ▶ ENVIRONMENT — read before planning any measurement

- **Playwright attaches to a running `next dev` via `reuseExistingServer`. No build is needed.** The
  suite is `fullyParallel` against that one server: transient failures appear in unrelated specs
  under load and pass on re-run — **re-run before believing an e2e failure**, and record a
  non-reproducible one as such (L-009), not as fixed. A test doing many navigations needs
  `test.slow()`; the 18-navigation reflow sweep blew the 30s default under five workers.
- **`.next` goes corrupt** (`Cannot find module './vendor-chunks/@swc.js'`) and the dev server then
  serves 500s. `rm -rf .next` and restart. `next dev` and `next build` share one `.next` and clobber
  each other — that cost one implementer two false diagnoses.
- **`taskkill //PID <pid> //F` worked in session 6**; an older note said the permission classifier
  blocks it. Check the port before starting a second server.
- **This machine is 1280 logical px.** `resize_window` below that reports success while doing
  nothing, and root `zoom` does not move media queries. Use Playwright, or a fixed-width same-origin
  iframe. ⚠️ This ceiling already shipped a WCAG failure once: task A2's implementer measured only at
  1280, where the reflow defect is invisible. **Treat "verified in the browser" as unverified unless
  the widths are named.**

## ▶ STILL OWED TO THE USER — none of it blocks the merge

- **Session 6's own additions:** sign-in is kept in the mobile sheet though the design omits it
  (without it a phone visitor cannot reach an account) — one line removes it; and the two new
  Vietnamese menu strings (`nav.menuOpen` / `menuClose` / `menuAriaLabel`) are mine and are owed to
  the owner's copy pass. Every other vi string is byte-identical.
- **`EMAIL_PROVIDER=none` in almostgone.vn's `.env` before the next deploy.** The only deploy blocker
  left; `sharp` is done (`2d14481`). ▶ **It is an OPS task, not a code task** — this repo has no
  `.env` at all, so no commit here can close it.
- **The five photographs** — still the reason `AssetSlot` exists.
- **Discord / Facebook / TikTok URLs do not exist** (reconfirmed 2026-09-02; "after the app is
  stable"). They ship as plain TEXT, not anchors, per spec §2.3. Nothing is broken.
- **§3's card 2 is missing four strings the reference has**: a `5 / 12` counter, a tag chip, a romaji
  line, a small icon caption. A2 built without them rather than inventing content — romaji is *study
  content*, not decoration (CLAUDE.md §2.3). Two catalog keys and one chip would close it.
- **§5's "i+1 Perfect Next Step" badge and topic chips** — in the reference, absent from the frame.
- **`text-heading-lg` widened the app-wide type scale** — the smallest change satisfying §13.1(2)
  without an arbitrary value, but the user may prefer 20px. One line reverses it.
- **`assets/mascot/source/` is 22MB stored, not served.** Deleting it later touches no code path, but
  it is what spec §5.3's inventory table describes.
- **`git stash@{0}` is obsolete** — the first, killed A2 attempt; it contains a test written before
  its implementation and must never be applied. Safe to drop; left because dropping is irreversible.

## ▶ RULINGS THAT STILL BIND — do not re-open any of these

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` · the
frame's footer and its "A quieter way to keep going." section win over the reference · `346:6275` is
the visual quality bar, stays out of the registry, and **must NOT be deleted** · imagery is
AI-generated so there is no licensing question · **P13** PayOS only · **P14** auth is email + Google
+ Apple, GitHub no · **Blender mascot renders are REJECTED** · mascot poses are per-placement
hand-picked with real alpha, five placements, `mix-blend-mode: screen` retired · "Save Sentence" →
`/mining` · store affordances → the stores' own front pages.

- **§1's two owed owner decisions are CLOSED** (`44c56f3`). The transport bar's four glyphs DEPICT
  and never function. ⚠️ The timestamp shows ELAPSED ONLY, deliberately — `hero.video.duration` is
  already four rows above it, and "0:24 / 13:00" would put one fact in two places. Do not "complete"
  it.
- **§6's icons are CLOSED** — the owner ruled 2026-09-02 that the shipped glyphs stand, even though
  `346:6275` draws different ones.
- **§6's `xl:items-end` is CORRECT and load-bearing** — the node grid's bottom edge IS the rail, so
  bottom-aligning the companion is what puts its orb on the line. `items-center` looks harmless and
  lifts it off. Pinned in e2e.
- **§4's contours are solid strokes** — WCAG 1.4.1 rests on stroke weight there, an owner-accepted
  trade.
- **The Vietnamese copy is the owner's.** Do NOT create a task, write a report, or edit
  `messages/vi/marketing.json` copy. Parked nits stay in the ledger.
- **§3's card 4 renders `journey.steps.understand.detail` with `journey.steps.mine.detail` tinted
  inside it.** If a copy pass makes the fragment stop occurring in the sentence, a guard goes RED by
  design. Fix the strings or the test, not the fallback.
- **Deferred with rulings, for the whole-branch review, not as section defects:** §6's between-tile
  gap (39.34px vs the reference's ~55) and §6's seven Minors; the physical-axis utility cluster
  (`mx-auto`, `left-1/2`) which is branch-wide with no lint rule; `max-w-md`/`basis-56` hardcoded rem,
  which five prior reviews shipped.

## ▶ WHERE THE FULL RECORD LIVES

- `mem:landing_page_port_archive` — sessions 1-6 in full. Grep it.
- `.superpowers/sdd/2026-08-27-landing-page-port/progress.md` — the ledger. ⚠️ **GITIGNORED**, so it
  does not travel; it exists only on this machine.
- `.superpowers/sdd/2026-08-27-landing-page-port/review-19b05d5-HEAD-report.md` — the independent
  review, 555 lines. **With fixes · 0 Critical · 9 Important · 7 Minor.** Its central claim was
  re-derived and holds (deltaCoherence 0.327 rejected vs 0.720 shipped, threshold 0.45 between).
  **Do not re-raise it as a next action.**
- `docs/lessons.md` — the project's law-adjacent experience, by `L-NNN` id.
