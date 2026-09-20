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

## Contracts and decisions

- **D1** rail track `clamp(15rem, 27.5%, 21.25rem)`; the aside must become `w-full` or the
  percentage resolves twice. **D2** `w-60` -> `w-sidebar`. **D3** every card uses `rounded-lg`, and
  `--radius-xl` plus its Tailwind key are deleted. **D4** explore search row capped at
  `clamp(18rem, 33.5%, 27.5rem)`, input `h-11` -> `h-10`. **D5** no new token, breakpoint or type
  change; one token removed.
- ⚠️ D3 previously kept `rounded-xl` "for hero surfaces over ~200 px". **That exception was
  measured away**: FeaturedHero (`149:464`, 873 x 280) draws `rounded-[22px]`, the same as the
  339 x 225 rail card. The design draws 22 on every card whatever its size, and 28 appears nowhere.
- ⚠️ D4 previously said the frame's 38 px height "is `h-10`". `h-10` is 40 px; it is the nearest
  existing rung, not the frame value, and no new rung is introduced for the 2 px.
- The rule this branch leaves behind, to be written into
  `docs/design/screens/adaptive-layouts.md`: a shell dimension read off a frame is a share of that
  frame's canvas, not a constant; a constant is allowed only as the `max` of a clamp.
- T2 audit: `hero-video-card.tsx` has no `--layout-companion-width` consumer; its docblock explicitly
  says the marketing depiction is not coupled to the app-shell rail. No marketing change is needed.
- Owner ruling 2026-09-20: `decision-register.md` **P14** stands — Apple and GitHub OAuth buttons
  in the auth frames are not ported. Belongs to the next branch; recorded so it is not rediscovered.

## Task-level verification

Status at task checkpoints; superseded by the final verification below.

Owed, none run yet on this branch: `npm run verify:protocol` · `npm run typecheck` · `npx vitest
run --reporter=dot` · `npm run lint` · `npm run build` · Playwright (this branch changes rendered
app chrome, so it is not waivable) · a manual read at 1280 / 1422 / 1920 on `/vi/shadowing` and
`/vi/shadowing/explore`.

T1: `npx vitest run components/layout/app-nav.test.tsx -t "measured layout token"` went red because
the rendered nav had `w-60`, then `npx vitest run components/layout/app-nav.test.tsx` passed (22 tests).

T2: `npx vitest run components/layout/two-column-shell.test.tsx` went red on the missing `w-full`
and clamp token, then passed (6 tests); `npx vitest run components/layout/` passed (64 tests). A
mutation from the clamp back to `300px` made the token guard red; restoration was SHA-256-checked.
The code-reviewer approved with one nit, removed before this checkpoint. Browser measurements remain
owed: no browser surface is connected to this Codex environment.

T3: `npx vitest run components/style-guide/style-guide.test.tsx` went red because Tailwind inherited
`rounded-xl` as `0.75rem`; after replacing the project radius scale, `npx vitest run
components/style-guide/ components/shadowing/` passed (47 tests), and `npm run typecheck` passed.
The code-reviewer required and approved the resolved-config and six-source-file regression guards.

T4: the target test went red on the absent width cap after its textbox query was disambiguated from
the search landmark, then the complete Explore page test file passed (2 tests). The code-reviewer
approved; its independent `npm run build` passed and found the generated clamp utility.

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

## Working tree and environment

Worktree `.worktrees/desktop-density-pass`, branch `desktop-density-pass`, cut from `master` at
`ec402f6`. A fresh worktree has no `node_modules`; install before the first gate run. Run vitest
from the main checkout only with the worktree exclusions in `vitest.config.ts` (they are
`**`-anchored since `52175bf`).

Measurements used an isolated production server on `http://localhost:3002`, authenticated as a new
local test learner in the Vietnamese locale. The existing 3000 server was not stopped or reused for
branch browser evidence.

- Owner: Claude

## Blockers

No branch-specific blocker. Claude must confirm the eight default-suite failures on the external
3000 server are baseline during whole-branch review.

## Next actions

1. Claude performs the required whole-branch review, confirms the external default-suite baseline,
   records an applicable lesson only if one exists, and merges with `--no-ff`.

**Historical task plan, retained as a completed record:**

1. Codex writes the frame-fidelity rule, runs the remaining branch gate, records every actual result,
   and performs the final checkpoint for Claude's whole-branch review.
2. T2 consumer audit found no `hero-video-card.tsx` token consumer: it explicitly documents that it
   is not coupled to the app shell. The only live consumer is `TwoColumnShell`.
3. Codex fills in the six `grid-template-columns` strings, runs the full gate including both
   Playwright configs, and sets `- Owner: Claude`.
4. Claude reviews `git diff master...desktop-density-pass`, records lessons, merges `--no-ff`.
