# Landing-page motion doctrine — IN PROGRESS, paused 2026-09-05

> **Branch `landing-page-motion-doctrine`, 18 commits off master `faa2cfd`. NOTHING merged,
> NOTHING pushed, master untouched.** Paused at the owner's request mid-Task-4.
>
> ⚠️ **This file is navigation, rulings, and method. It does NOT restate the design or the plan** —
> both travel with the repo and win if they disagree with this:
> - Spec: `docs/superpowers/specs/2026-09-04-landing-page-motion-doctrine-design.md`
> - Plan: `docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md` (12 tasks, 83 steps)
> - SDD ledger: `.superpowers/sdd/2026-09-04-landing-page-motion-doctrine/progress.md`
>   ⚠️ **gitignored — machine-local, does not travel.** Everything load-bearing from it is here.

# ▶▶ READ FIRST IF YOU ARE PICKING THIS UP

**What this is.** The landing page shipped one entrance mechanism applied to nine sections — fade
and rise, everywhere. Only §4 (pitch contours) and §6 (chain cascade) read as authored. The owner's
words, 2026-09-04: *"motion kiểu vậy thì nó chung chung nhàm quá"*. This branch gives each section
its own metaphor and verb, bound by one thread grammar so variety does not become noise.

**Where execution stands:**

| Phase | Task | State |
|---|---|---|
| 0 | 1 · motion gate (`lib/motion/motion-enabled.ts`) | ✅ complete, review clean after 1 fix round |
| 0 | 2 · scroll-progress provider | ✅ complete, review clean after 2 fix rounds |
| 0 | 3 · thread tokens + contract test | ✅ complete, review clean after 1 fix round |
| 01 | 4 · §5 donut sweep + first `ThreadSegment` | ✅ complete, review clean after 2 fix rounds |
| 02 | 5 · §1 Hero heading + card interior | not started |
| 02 | 6 · §1 Hero scroll-linked camera push | not started |
| 03-07 | 7 §2 · 8 §3 · 9 §7 · 10 §8 · 11 §9 | not started |
| — | 12 · whole-branch review + `docs/lessons.md` pass | not started |

**🔒 §4 (`pitch-showcase.tsx`, `pitch-chart.tsx`) and §6 (`capability-chain.tsx`) are FROZEN and are
NOT tasks.** They already ship correct. Any change to them in this work is a regression.

## ▶ WHEN RESUMING: start at Task 5. Task 4 is signed off.

The final re-review returned **ADDRESSED / APPROVE** after the pause was announced. Working tree is
clean, the mutation left behind by that reviewer was restored by editing the file back (verified
byte-identical to HEAD, §5 suite re-run 10/10 green).

⚠️ **One residual, recorded honestly:** the split e2e guard was proven red in the *thread-vanishing*
direction but only **reasoned, not observed**, in the *arc-vanishing* direction. The reasoning is
sound — the two collections are fetched by independent `page.locator()` calls and asserted
separately, so neither can mask a loss in the other — but nobody has watched `expect(arcs)
.toHaveLength(2)` actually go red. Cheap to close whenever someone is next in that file.

⚠️ **Do not believe the claim that "the harness silently reverts direct-to-disk edits on tracked
files".** That reviewer's `sed` mutation really did disappear mid-run, and it inferred a sandbox
protection — but the true cause was mundane: the CONTROLLER restored the file while the reviewer
was still running, during the session-pause cleanup. The harness does no such thing. Recording the
correction because a false environment fact costs the next session real time.

Last gate actually measured, on `11a2882`: `npm test` **2657 tests / 286 files, 0 failed, 0
skipped** · `npx tsc --noEmit` 0 · lint 0 errors, pre-existing warning mix unchanged · the §5
reduce-motion e2e case green against a freshly rebuilt server. Never re-quote these — run the
commands (`L-002`).

---

# ▶ RULINGS I MADE ON THE OWNER'S BEHALF — read these, they are decisions, not notes

**R1 — Branch, not worktree.** Repo convention, and `mem:project_status` records two live worktree
hazards here (`vitest.config.ts` does not exclude `.worktrees/`; a worktree has no `.env.local`,
`L-020`). *Cost if wrong: none material.*

**R2 — The scroll-progress provider settles to `0`, not `1`, when motion is off.** This closed a
reduce-motion defect the plan contained. Its consumer applies the property in a **static
`transform`**, and both kill-switch blocks in `globals.css` collapse only `animation-*` and
`transition-*` — neither reaches a static transform. Settling to `1` would have left §1's hero card
permanently at `scale(0.94)` for a reader who asked for no motion. *Cost if wrong: a future consumer
whose resting state is genuinely `1` must gate its own CSS rather than flip this global — the plan
names that case.*

**R3/R4 — `THREAD_RULE_COUNT` and `REVEAL_GATE_COUNT` are state pins, read from a real run.** Never
a number counted in your head. R3 corrected 2→3 before it shipped.

**R6 — Re-enabling motion mid-session MUST resume tracking; "off" is never terminal for the mount.**
The gate exists because the toggle flips mid-session; a reader who turns motion back on and gets a
dead page until reload has hit a second, quieter bug. **This ruling dictates the provider's shape**:
`active` is never cleared on pause — the observer stays the single source of truth for what is on
screen, and a `paused` flag decides only whether the loop may run. *Cost if wrong: making "off"
terminal is a small change; a one-way toggle is the worse default to ship.*

**R7 — The style-guide colour-drift guard STAYS; the token gets listed.** `--thread-color` tripped
`style-guide.test.tsx`, which asserts every colour token (including `var()` aliases) is documented.
The alternative — narrowing the guard's sweep — was rejected: the guard is right, the code was what
was missing, and weakening a guard to accommodate the first token that trips it is how guards die.
*Cost if wrong: an alias in the palette is mild noise; a drift guard with a hole is not.*

**R8 — `--thread-width` is enforced with `vectorEffect="non-scaling-stroke"`, verified in a
browser.** `stroke-width: 2px` inside a `viewBox`ed SVG resolves in **user units** and is scaled by
the viewBox→viewport transform: the shipped segment drew at **1.33px**, and the scale is set by each
caller's `className` — so the "invariant no section may define its own width" was silently
redefinable by any section's sizing. *Cost if wrong: fallback is unitless user-units plus a
documented scale rule — weaker but recoverable.*

---

# ▶ THE METHOD LESSONS THIS BRANCH HAS ALREADY PAID FOR

## ⭐ Four checks were found green while measuring less than they claimed

This is the branch's defining pattern, not four coincidences. It matches `mem:korume-false-green-before-believing` exactly.

1. **Task 1** — the test's `matchMedia` mock built a `listeners` Set and returned it; all five call
   sites discarded it. The production listener could be **deleted outright** and the suite stayed
   7/7 green.
2. **Task 2** — `expect(cancel).toHaveBeenCalled()` was satisfied by a no-op
   `cancelAnimationFrame(0)`, because no intersection was ever driven so no frame was ever scheduled.
3. **Task 3** — a `-t`-filtered run reporting `8 passed | 15 skipped` was written up as "PASS, all
   tests". The real regression was in a **third file** neither that run nor the brief's own
   unfiltered run would have touched.
4. **Task 4** — an e2e comment promised "at least one of each kind"; the code asserted
   `length >= 2`, and one kind alone already supplies 2. Losing the other kind entirely would have
   stayed green. **L-004 inside code whose own comment claimed to prevent L-004.**

▶ **A reviewer hit the same trap from the other side of the desk**: its first attempt to reproduce a
mutation used `-t thread`, which false-greened because that test's title has no literal "thread" in
it. Filtered runs are not evidence about anything outside the filter.

## ⭐⭐ SVG behaved differently in a browser than on paper TWICE, in one task

Both were invisible to the entire test suite, and both are now Global Constraints in the plan.

1. **`stroke: var(--thread-color)` computes to an INVALID colour.** This repo's colour tokens hold
   **bare HSL channels** (`--sand-400: 29 75% 64%`) deliberately, so Tailwind can write
   `hsl(var(--accent) / <alpha-value>)`. An unwrapped var is not a colour — and an invalid stroke
   **does not error, it renders nothing**. The segment shipped in the DOM, fully drawn,
   `data-reveal="in"`, and completely invisible. jsdom does not compute colour. Found only by
   reading `getComputedStyle` in a real browser. **Every consumer must wrap: `hsl(var(--token))`.**
2. **R8's user-units rescale**, above.

▶ **Method that worked, use it again:** a deterministic Web Animations API scrub — pause the
animation, seek `Animation.currentTime` to fixed points, read `getComputedStyle` at each — beats
hoping to catch a frame. It proved `strokeDashoffset` interpolating 1px→0px while `strokeWidth`
stayed exactly 2px, plus a screenshot of a frozen half-drawn state as the defence against
"numerically fine, visually wrong".

⚠️ `non-scaling-stroke` was verified for the **`connection` morphology only**, in one engine — the
only one in the DOM today. **Tasks 9-11 wire `line` and `resolution` and must re-verify then.**

## Ten real defects, and not one was found by reading code

They were found by running mutations, constructing event sequences, and running the right command
scope. Most came from code **in the plan**, written by the controller — which is the argument for
the independent review seat, and against trusting your own plausible-looking code.

⚠️ **Two §2 r4 (reduce-motion) violations were caught before merge**, both in the scroll provider,
both reproduced rather than theorised: the loop resuming after a mid-session toggle-off, and then
the same defect through the mount-time-off door. The second existed because the first fix was
applied to only one half of a state machine — **two branches encoding one state machine, and the
branches disagreeing IS the bug** (CLAUDE.md §6).

---

# ▶ PROCESS NOTES FOR THE NEXT CONTROLLER

- **Reviewer prompts must forbid every tree/index/stash-mutating git command.** A reviewer here ran
  `git stash && … ; git stash pop` and **popped the unrelated `landing-page-port: A2 partial`
  stash** — the one `mem:project_status` says must never be applied. It recovered, and I verified
  independently (tree clean, HEAD right, `stash@{0}` intact). Reviewers restore a mutation by
  editing the file back, never via git.
- **Do not pre-judge findings in a review prompt.** Ask the open question and adjudicate the answer.
  Several of the best findings came from questions I did not know to ask precisely.
- **Ask reviewers to CONSTRUCT sequences, not read for bugs.** Every defect on this branch was found
  that way; none by inspection.
- **Ask the reviewer to run a mutation the implementer did NOT try.** Twice this exposed that a test
  was pinned to a precondition rather than to behaviour.
- **Opus was worth it once**: Task 4's review (5 mutation-proven Importants, including the
  user-units rescale). Sonnet handled every other review and re-review adequately. Haiku was
  correct for Task 3, where the brief carried complete code.
- **Sync the plan whenever a fix corrects plan-authored code.** Done three times here. A plan left
  holding the buggy version rebuilds the bug on any re-run, and later tasks copy its CSS verbatim.

# ▶ ENVIRONMENT

- `app/globals.css` and some components show as modified with an **empty `git diff --numstat`** —
  pure CRLF normalisation, pre-existing, benign. Verify with `--numstat` before believing a diff.
- A stale `next` process on :3000 plus a corrupted `.next` blocked one build. Check the port
  (`Get-NetTCPConnection -LocalPort 3000 -State Listen`); `next dev` and `next build` share one
  `.next` and clobber each other.
- Playwright hardcodes :3000 with `reuseExistingServer: true` — it will attach to a server running a
  build you have since changed. **Rebuild AND restart between mutations.**
- The known parallel-load flake pair is `components/video-player/pitch-contour.test.tsx` and
  `waveform.test.tsx`. Both appeared and passed in the last full runs. **A third file joining them
  would be new information.**
- `npx playwright test` is never fully green without local Supabase — five specs fail
  `ECONNREFUSED 127.0.0.1:54321`. None touches the landing page.
