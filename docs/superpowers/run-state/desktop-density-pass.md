# Branch Run State

## Goal and scope

Make the app shell render, at a 1280 CSS viewport, the composition it was designed to render — the
one the owner currently only sees by zooming the browser to 90%. Four measured defects: a fixed
300 px companion rail beside a fluid column, a hardcoded 240 px sidebar next to an unused 224 px
token, a 28 px card radius where the ruled rung is 20, and an 818 px explore search field drawn at
440 on a 1536 canvas.

Out of scope: the type scale, any new breakpoint, the public marketing header and footer (measured
1:1 with their own 1280-wide frame), and the Auth + Error screen port, which is the branch after
this one.

## Authorities

- `docs/superpowers/specs/2026-09-20-desktop-density-pass-design.md` — this branch's design; §2
  holds every measurement and §4 the five decisions. Read it before touching any file.
- `AGENTS.md`, `.codex/docs/workflow.md` (§8 two-harness protocol), `docs/lessons.md`.
- Figma `IwFHZDZdHW7qsSFiNbWrkd`, frames `149:2` (Shadowing hub) and `200:7705` (Explore Lessons),
  both on a 1536 canvas.

## Accepted commits

- `b686945` — spec and this run state.
- `b3ede47` — plan, packet and the spec's D3/D4 corrections.
- `5afa978` — T1 changes the app sidebar from literal `w-60` to measured `w-sidebar`.
- `c50befb` — T2 makes the companion rail a capped shell share and keeps the aside within its track.
- `eb09d90` — T3 removes the unused 28px radius rung and moves every scoped card to `rounded-lg`.
- `59fb51f` — T4 caps the Explore search row and moves its input to the existing 40px height rung.
- `a4a18cf` - T5 writes the frame-fidelity rule for subsequent screen ports.
- `ea73bf2` review, `4da28d6` fixes, then F10 and two nits in the commit below this line.

## Contracts and decisions

- **D1** rail track `clamp(15rem, 27.5%, 21.25rem)`; the aside must become `w-full` or the
  percentage resolves twice. **D2** `w-60` -> `w-sidebar`. **D3** every card uses `rounded-lg`, and
  `--radius-xl` plus its Tailwind key are deleted. **D4** the explore search **input** capped at
  `clamp(18rem, 28.65vw, 27.5rem)` — the row is not capped — and `h-11` -> `h-10`. **D5** no new
  token, breakpoint or type change; one token removed.
- ⚠️ **D4 was corrected 2026-09-21 by owner ruling**, after the whole-branch review. It shipped as
  `max-w-[clamp(18rem,33.5%,27.5rem)]` on the flex **row**, which was wrong twice: the row also
  holds `gap-sm` and the submit button, leaving the input near 210-230 px at 1280 against the
  367 px the spec's own §2 records as the frame equivalent; and 33.5% divides 440 by the 1312
  content region, while §5 rules that a frame dimension divides by the canvas it was drawn on
  (1536 -> 28.65%). D4 was the one decision on this branch that did not obey the branch's own rule.
- ⚠️ **The §5 frame-fidelity rule gains a nav-rail carve-out, 2026-09-21 owner ruling.** As first
  written it condemned D2: `--layout-sidebar-width: 224px` is a shell dimension off a 1536 frame
  shipped as a bare constant. The carve-out is a persistent navigation rail that owns a collapsed
  state and a fixed text measure — a rail that scales crops its labels instead of rebalancing the
  layout, and it already has two escapes (`--layout-sidebar-collapsed`, and the handoff below 1024).
- ⚠️ D3 previously kept `rounded-xl` "for hero surfaces over ~200 px". **That exception was
  measured away**: FeaturedHero (`149:464`, 873 x 280) draws `rounded-[22px]`, the same as the
  339 x 225 rail card. The design draws 22 on every card whatever its size, and 28 appears nowhere.
- ⚠️ D4 previously said the frame's 38 px height "is `h-10`". `h-10` is 40 px; it is the nearest
  existing rung, not the frame value, and no new rung is introduced for the 2 px.
- T2 audit: `hero-video-card.tsx` has no `--layout-companion-width` consumer; its docblock explicitly
  says the marketing depiction is not coupled to the app-shell rail. No marketing change is needed.
- Owner ruling 2026-09-20: `decision-register.md` **P14** stands — Apple and GitHub OAuth buttons
  in the auth frames are not ported. Belongs to the next branch; recorded so it is not rediscovered.

## Task-level verification

Each of T1-T4 went red first, then passed, and was reviewed by `code-reviewer`; Git holds the
commands and counts. Two are worth keeping: T2's mutation from the clamp back to `300px` made the
token guard red and the restore was SHA-256-checked, and T3's guard first went red because Tailwind
inherited `rounded-xl` as `0.75rem` — which is why D3 replaces the radius scale instead of
extending it. T2 also recorded that no browser surface was connected to the Codex environment, so
every browser number on this branch was measured later, under Verification.

Acceptance number: main column at 1280 must measure **~684 px**, up from the 613 px measured on
`master` at `ec402f6`. A result far from that means D1 or D2 did not land.

## Verification

Final gate from this worktree: `npm run verify:protocol` and `npm run typecheck` passed; Vitest
passed 3068/3068; `npm run lint` exited 0 with existing unrelated warnings; and `npm run build`
compiled the production bundle and produced `.next/BUILD_ID`. Build and browser commands loaded the
root local environment only into their processes; no secret file was copied into the worktree.

`npx playwright test --config=playwright.c3.config.ts` passed all 3 Explore cases against the
worktree production build. The first attempt failed before rendering because this worktree had no
Kuromoji dictionary at `process.cwd()/node_modules`; `npm install` added ignored dependencies in the
worktree and the rerun passed.

`npm run test:e2e` ran 45 default cases against an already-listening `localhost:3000` server outside
this worktree and failed 8: landing-page (3), lesson-creation-jobs (3),
route-group-provider-identity, and shadowing-hub. They are not attributed to this diff; the C3 suite
above is the branch production-browser gate.

Production-browser measurements from an isolated worktree server at `http://localhost:3002`:

| viewport | `/vi/shadowing` | `/vi/shadowing/explore` |
| --- | --- | --- |
| 1280 | `677.812px 266.188px` | `968px` |
| 1422 | `780.75px 305.25px` | `1110px` |
| 1920 | `1244px 340px` | `1608px` |

Explore passes no companion rail to `TwoColumnShell`, so its shell resolves to one track. Hub holds
the 27.5% rail share at 1280/1422 and caps it at 340px at 1920.

## Whole-branch review (Claude, 2026-09-21) — findings F1-F10, all closed

Reviewed `git diff master...desktop-density-pass` from the main worktree. The core holds: D1's
clamp and track, D2, the removed rung and the search cap all land, and 27.5% of the 968 px inner
box is 266.19 against the 266.188 measured at 1280. What failed review is the belt around it. Each
fix and its reason is in spec §6; the two corrected decisions are under Contracts above.

- **F1 · CRITICAL · `tests/e2e/shadowing-hub.spec.ts:120` and `:132`** — `toBeCloseTo(300, 0)` pins
  the constant D1 deletes, so the rail geometry has two homes (`AGENTS.md` §6). At the case's 1024
  viewport the inner box is at most 1024 - 224 = 800 whatever the gutter, so the clamp sits on its
  15rem floor, 240 px; ~263 after nav collapse. It can never be 300.
- **F2 · MAJOR · `components/style-guide/style-guide.test.tsx:100-112`** — the D3 guard walks a
  hardcoded six-file list and asserts the length of that same literal. §7 T3 specified a walk over
  `components/` and `app/`; workflow §8 says why. With the `xl` key deleted, a new `rounded-xl`
  renders with no radius and nothing catches it.
- **F3 · MAJOR · `components/shadowing/explore-lesson-card.tsx:23`** — still `rounded-[22px]`, so
  Explore draws lesson cards at 22 and its suggestion card at 20 on the screen this branch
  measured. `components/ui/token-scale.test.ts` forbids the pattern but omits `components/shadowing`
  from `SCANNED_DIRS`, which is how F2's narrow guard and this line found each other.
- **F4 · MEDIUM · `tailwind.config.ts:99`** — `width.companion` survives, now pointing at a token
  holding a percentage. Zero consumers, and using it is the 27.5%-of-27.5% trap D1 warns about.
- **F5, F6 · MEDIUM · ruled and corrected** — D4 capped the wrong element against the wrong
  denominator; the §5 rule as written condemned D2. Both under Contracts.
- **F7 · LOW · accepted as a documented limitation** — from 1024 to ~1177 the floor binds and the
  rail holds ~35% of the shell, against 43.9% for the old constant at the same width. Closing it
  needs a breakpoint D5 forbids. Recorded in spec D1; no code change.
- **F8 · NIT · accepted** — `two-column-shell.tsx:41` keeps `shrink-0`, inert on a grid item;
  `hub-featured-hero.tsx:32` still claims `sizes` 55rem against a slot measured at 677.8 / 1244 px.
- **F9 · deferred to its own branch, owner ruling** — `borderRadius.DEFAULT: "0.25rem"`, an
  undocumented fourth rung at ~25 call sites. Not a regression; spec §9 holds the reasoning.

**Baseline question from the previous checkpoint: answered.** Claude ran `npx playwright test
tests/e2e/shadowing-hub.spec.ts --reporter=line` against the same external 3000 server: 1 passed, 1
failed at **line 112** on an import error-string mismatch, unrelated to this diff. That server runs
a build from outside this worktree, so every failure on it is `master`'s state by construction.
That run is also what exposed F1 — line 112 aborts the case before the rail assertion at 120 — and
a second gap: `playwright.c3.config.ts` carries `testMatch: "shadowing-explore.spec.ts"`, so **no
Playwright run has yet exercised the Hub against a branch build**, and the Hub is what D1 changes.

## Working tree and environment

Worktree `.worktrees/desktop-density-pass`, branch `desktop-density-pass`, cut from `master` at
`ec402f6`. A fresh worktree has no `node_modules`; install before the first gate run. Run vitest
from the main checkout only with the worktree exclusions in `vitest.config.ts` (they are
`**`-anchored since `52175bf`).

Measurements used an isolated production server on `http://localhost:3002`, authenticated as a new
local test learner in the Vietnamese locale. The existing 3000 server was not stopped or reused for
branch browser evidence.

- Owner: Claude

## Review-fix verification (Codex, 2026-09-21)

F1-F6/F8 are fixed. The guard's 300-file walk went red on `rounded-[22px]`; target suites then
passed 76 tests (final style/token pair: 64). Typecheck, lint, build, diff check and full Vitest
(324 files / 3082 tests) passed. At 1024px the branch production Hub rail / track was 240 / 240px,
then 257.390625 / 257.391px after collapse. The Hub file is 2 passed / 1 known import-copy baseline
failure at line 148; the temporary server stopped. Claude re-reviews this delta, records any lesson,
and merges `--no-ff` if approved; F7/F9 remain ruled/deferred.

## Fix verification (Claude, 2026-09-21) — APPROVED

Every gate re-run here rather than read off Codex's report: `verify:protocol` valid, `typecheck`
clean, Vitest 324 files / 3082 tests, `lint` exit 0 on existing warnings, `build` compiled
(`BUILD_ID` `RKcn7bqeKoQeyKm1ZpTfp`). Checked in `.next`, not in source: the CSS carries
`max-width:clamp(18rem,28.65vw,27.5rem)` and `--layout-companion-width:clamp(15rem,27.5%,21.25rem)`
and no longer carries `--radius-xl` or `.w-companion`.

Three mutations, each reverted with the restored blob SHA read back. `rounded-[22px]` in
`explore-lesson-card.tsx` turned both guards red. `rounded-xl` in `components/ui/dialog.tsx` turned
the widened D3 guard red, naming a file the old six-file list could not see.

**F10, found by the third mutation and fixed here.** `rounded-xl` inside the `PHOTO_LEFT_FADE`
constant in `components/marketing/trust.tsx` rendered live and the guard stayed **green** — it was
anchored to `className=`, and this repo routes class strings through module constants into a
template literal. The helper now strips comments and matches the utility as a whole class token
anywhere in code: red on that mutation naming `trust.tsx`, green once reverted. Two nits closed
with it — `token-scale.test.ts` referenced the radius rule as `FORBIDDEN[3]`, a positional index
that would silently enforce a different rule if a pattern were inserted above it, now the named
`RADIUS_LITERAL`; and `hero-video-card.tsx` still pointed at the deleted `w-companion`.

⚠️ **Protocol deviation, owner-directed.** §8 says Claude does not edit code or tests during
review. The owner directed Claude to fix F10 in place rather than hand the branch back for one
guard change. Claude owned the worktree, so there was no second writer. Recorded because the rule
has no standing exception.

## Blockers

None. The Hub import-copy failure at `shadowing-hub.spec.ts:148` is `master`'s baseline, confirmed
on the 3000 server, and was deliberately not repaired here.

## Next actions

1. Claude records the lesson in `docs/lessons.md`, merges `--no-ff`, removes the worktree.

Standing by ruling: F7 (spec D1) and F9 (spec §9). The e2e helper keeps `not.toBeCloseTo(300, 0)`;
it would misfire only at the ~1394 viewport where 27.5% resolves to 300, a ±0.5px window no case
uses, and tightening it would weaken the guard on the very constant F1 removes.
