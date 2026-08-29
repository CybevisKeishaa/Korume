# Landing page port (`/`) — run state

> **Status: EXECUTION IN PROGRESS. Tasks 1–7 + Task M/R + Task A1 built and committed on branch
> `landing-page-port`. Nothing merged.** Paused at the user's request 2026-08-29 (third pause).
>
> ⚠️ **This memory is navigation, process and the decisions taken on the user's behalf. It
> deliberately does NOT restate the design or the plan.** The spec and the plan travel with the repo;
> this does not. If this file and either of them disagree, they win and this file is the bug.

# ▶▶ RESUME HERE

**BASE is `0002b21`.** The next action is **Task A2 (§3 Journey)** — its brief is written, updated
and ready at `.superpowers/sdd/2026-08-27-landing-page-port/task-A2-brief.md`. No decision is owed
by the user before it starts.

**A2 was dispatched once and killed mid-task; it made no commit.** Its partial work is in
`git stash@{0}`. It is **incomplete, not merely uncommitted** — it wrote the rail test before wiring
the rail, so `components/marketing` runs 1 red. **Re-dispatch A2 from its brief on a clean tree** and
treat the stash as reference only (`git stash show -p stash@{0}`); drop it once A2 lands.

**Execution mode is subagent-driven** (user, 2026-08-27). Re-enter with
`superpowers:subagent-driven-development`; it will find the ledger and resume.

## ⚠️ THE FULL RECORD IS GIT-IGNORED AND DOES NOT TRAVEL

`.superpowers/sdd/2026-08-27-landing-page-port/progress.md` is the SDD ledger: every task's commits,
every review's findings, every ruling with its cost-if-wrong, every deferred minor. Far more
detailed than this memory, **gitignored**, and it dies with this working copy. **Read it first on
resume.** Briefs, reports and reviews sit beside it — including A2's and A3's briefs, both written.

## THE USER'S SEQUENCING RULING (2026-08-29) — this reversed my own recommendation

I proposed building the motion vocabulary first. The user argued motion is holistic (cursor effects,
page-level rhythm) and that sections not yet built will want motion too, so a vocabulary designed
against 3 of 9 sections over-fits. They are right, and the split they implied is now the plan:

  Task A-STATIC (A1 §2 ✅ · A2 §3 · A3 §4)  composition + linework expressiveness. ZERO motion.
  Tasks 8–11        build to §13's visual bar; each records 1–2 ledger lines naming what it will
                    later want to animate, so the static build does not FUSE elements that must
                    move separately. No motion implemented.
  Task 12           page composition
  Task A-MOTION     ONE pass over the whole composed page: shared vocabulary + the global layer.
  Task 13 · Task V · whole-branch review

**Why doing static early forecloses nothing:** static expressiveness (stroke weight, curve,
gradient, glow) and motion (draw-on, scrub) are disjoint layers on the same `<path>`. And §13's
composition half — §2's "bố cục xấu hẳn" — is not a motion defect at all and could not wait, because
§5–§9 were about to be built on the same broken `Section` shape.

## What Task A1 established — every later section task consumes this

1. **ROOT CAUSE of "bố cục xấu hẳn" was shared infra, not §2.** `section.tsx` stacked eyebrow +
   heading + children always. The reference is a two-column split: rail ≈28.6%, showcase ≈71.4%.
   `Section` now takes an optional `rail` prop, guarded `rail != null` (not `!== undefined`, so
   `rail={cond ? <X/> : null}` cannot select the split with an empty rail).
2. ⚠️ **A NEW SCALE TOKEN NEEDS FIVE HOMES.** `app/globals.css`, `tailwind.config.ts`,
   **`lib/utils.ts`'s tailwind-merge `font-size` group**, and `lib/design-tokens.test.ts`. Without
   the tailwind-merge home, `cn()` classifies the class as a text COLOUR and silently drops it —
   `lib/utils.ts` already records this bug hitting badge/select/tabs. I said "two homes", the
   implementer found four, the reviewer found five. `text-heading-lg` (1.5rem) now exists for
   split-layout headings; 20px was measurably too small and 28px too large, with nothing between.
3. **`AssetSlot` now passes `sizes`.** Without it `fill` made the browser fetch a 3840px / 1336 KB
   variant for a 379px slot — 4.9 s of empty section, worse than the placeholder it replaced.
4. ⚠️ **AN OVERLAPPING DECORATIVE IMAGE NEEDS THREE MECHANISMS, NOT A PERCENTAGE.** §2's photo at
   the reference's 41.5% forces a ~104px overlap with the constellation, because our chip grid is
   423px where the reference's is 329px (our 12px type floor — the reference's width and its
   clearance cannot both hold). It is safe only via the left-edge fade + `relative z-10` on the
   constellation + `pointer-events-none` on the photo. All three are commented load-bearing and
   mutation-guarded. **A3's mascot overflowing the companion card is the same shape of problem.**

## Rulings I made this session (all in the ledger with cost-if-wrong)

- **Fold the `Section` split prop into §2** rather than a separate primitive task — §2 is its first
  consumer and proves the pattern.
- **`pitch-demo.ts`'s numbers may be rewritten** (its own header calls them illustrative mock data);
  the shape must still read as 日本の秋はとても美しいですね。 and the You track must still flatten
  the peak — that is the pedagogical point.
- **§4's native contour goes solid + heavier, the You track becomes the thin dashed one**, inverting
  Task 7 fix F3. F3's real requirement was WCAG 1.4.1, which still holds via dash AND weight; which
  line got dashed was arbitrary.
- **§3's Shadow card draws an AUDIO WAVEFORM, not a shrunken pitch contour.** `journey.tsx`'s
  current doc comment argues bars misrepresent pitch — true for §4, wrong here: the reference's
  graphic is symmetric about a centre line, i.e. amplitude, and reusing §4's contour makes §3 a
  duplicate of §4, part of why the page reads flat.
- **Promoted two Minor findings into A1's fix loop** (connector turn ~3.4px vs the reference's 15px;
  the centre node's flare a hard 1px rect). The expressiveness of that linework is the whole point
  of the task; a generic rubric scores it cosmetic.
- **Accepted the implementer's out-of-scope `sizes` fix** — it was a regression the photo wiring
  itself introduced.
- **§1's player chrome was mine to fix**, not scope creep: I pulled §1 in for a one-prop change and
  its chrome then read as a smudge over a real photograph.

## ▶ THE FIVE PHOTOGRAPHS ARRIVED. §5.2 PROVENANCE IS IN THE LEDGER.

The user generated all six themselves from short per-slot descriptions I wrote, and pasted them into
`public/marketing/`. Aspect ratios measured exact (1672×941 = 16/9 ×4; 1086×1448 = 3/4 ×2), matching
the `ratio` each slot already declared. Alt fidelity spot-checked (`problem.photoAlt` says
"headphones on"; a zoom shows headphones). Licensing was ruled closed 2026-08-26 (AI-generated).

- **Wired:** `hero-still.png` (§1), `problem-desk.png` (§2) — both committed.
- **Owed:** `journey-thumb.png` → Task A2 (its brief carries it) · `recommend-commute.png` → Task 8 ·
  `trust-window.png` → Task 10 · `cta-bridge.png` → Task 11. These four are still untracked, which
  is correct. **A committed reference to an untracked asset would ship a 404** — checked, did not happen.
- ⚠️ **`cta-bridge.png` is a full-bleed background with text over it.** "Looks dark" is not WCAG AA;
  Task 11 must add a scrim and measure. A scrim over a REAL image is allowed — the no-scrim rule is
  scoped to pending placeholders.
- Ruling: PNGs committed as-is, 13MB. `sharp` is NOT installed, so converting means writing an
  encoder. `next/image` optimises at request time.

## ⚠️ TWO DEPLOY BLOCKERS FOR almostgone.vn, BOTH NOW EVIDENCED

1. **`sharp` is not installed.** Next falls back to the WASM optimiser: cold variant generation runs
   2–5 s and **the dev server died twice** with `Jest worker encountered 2 child process exceptions`
   (500 on every route). almostgone.vn is the same shape of single long-running Node host. This is a
   blocker candidate, not a footnote.
2. `EMAIL_PROVIDER=none` must be in its `.env` before the next deploy (older debt, still open).

Also learned: **`next dev` and `next build` share one `.next` and clobber each other** — it cost one
implementer two false diagnoses.

## Environment ceiling — THREE agents have now hit it

This machine is 1280 logical px. `resize_window` below that **reports success while doing nothing**,
and root `zoom` does not move media queries. Mobile has never been observed by anyone. A
**fixed-width same-origin iframe DOES move real media queries** and is the workaround that worked
for geometry and hit-testing. 1280 is the reference's own width, so that one can be seen whole.
Mobile and Lighthouse are deferred to Task 13 / Task V, which need Playwright or a real narrow viewport.

## Process facts worth keeping

- **A killed subagent may not be resumable** — "No transcript found for agent ID" — so the REPORT
  FILE on disk is the persistent memory, not the session. Keep making implementers write full
  reports to disk; it is what made a fresh implementer able to take over A1 at fix round 2.
- **Check `git status` before assuming a killed agent's work was lost.** A1's first fix attempt died
  on an Opus session rate limit having changed nothing.
- **After killing an agent mid-mutation-check, verify no deliberate break is live** — compare each
  `.tsx.bak` against its live file before deleting anything. All four matched this time.
- `code-reviewer` is code-only (Read/Grep/Glob/Bash). For anything visual or Figma-touching, use
  `general-purpose` — it can render the page and open reference crops.
- Reference crops for the briefs live OUTSIDE the repo in the session scratchpad (derived from
  Figma, not ours to commit). Regenerate with `scripts/mascot/png.js` — note `decode` returns
  `{w,h,ch,data}`, NOT `{width,height}`.

## Still owed to the user

- **Discord / Facebook / TikTok URLs** — they will do these "after the app is stable". The links
  currently ship as plain TEXT, not anchors, per spec §2.3. Nothing is broken.
- **Whether to delete `public/mascot/renders/` and `assets/blender/references/`** now Blender is rejected.
- ⚠️ **`text-heading-lg` widened the app-wide type scale** — a design decision beyond §2. It is the
  smallest change satisfying §13.1(2) without an arbitrary value, but the user may prefer 20px; one
  line reverses it.
- **Vietnamese copy: the user will do it themselves.** DO NOT create a task, write a report, or edit
  `messages/vi/marketing.json` copy. Parked nits are in the ledger.

## Still true from earlier rulings — do not re-open

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` ·
the frame's footer and its "A quieter way to keep going." section win over the reference ·
`346:6275` is the visual quality bar, stays out of the registry, and **must NOT be deleted** ·
imagery is AI-generated so there is no licensing question · **P13** PayOS only · **P14** auth is
email + Google + Apple, GitHub no · **Blender mascot renders are REJECTED** · mascot poses are
per-placement hand-picked with real alpha, five placements, `mix-blend-mode: screen` retired ·
"Save Sentence" → `/mining` · store affordances → the stores' own front pages.
