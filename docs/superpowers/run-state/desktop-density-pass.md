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
- Plan, packet and the spec's D3/D4 corrections. No implementation commit yet.

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
- Owner ruling 2026-09-20: `decision-register.md` **P14** stands — Apple and GitHub OAuth buttons
  in the auth frames are not ported. Belongs to the next branch; recorded so it is not rediscovered.

## Verification

Owed, none run yet on this branch: `npm run verify:protocol` · `npm run typecheck` · `npx vitest
run --reporter=dot` · `npm run lint` · `npm run build` · Playwright (this branch changes rendered
app chrome, so it is not waivable) · a manual read at 1280 / 1422 / 1920 on `/vi/shadowing` and
`/vi/shadowing/explore`.

Acceptance number: main column at 1280 must measure **~684 px**, up from the 613 px measured on
`master` at `ec402f6`. A result far from that means D1 or D2 did not land.

## Working tree and environment

Worktree `.worktrees/desktop-density-pass`, branch `desktop-density-pass`, cut from `master` at
`ec402f6`. A fresh worktree has no `node_modules`; install before the first gate run. Run vitest
from the main checkout only with the worktree exclusions in `vitest.config.ts` (they are
`**`-anchored since `52175bf`).

The dev server the measurements were taken against was already running on
`http://localhost:3000`, authenticated, Vietnamese locale.

- Owner: Codex

## Blockers

None. The owner approved the spec on 2026-09-20; plan and packet are written and the branch is
handed to Codex.

## Next actions

1. Codex reads the packet `.superpowers/sdd/desktop-density-pass/density-pass-brief.md`, then
   implements the five tasks of the plan in order, under TDD, with a `code-reviewer` pass and a
   checkpoint here after each accepted task.
2. T2 Step 5 requires a decision about `components/marketing/hero-video-card.tsx`; record which of
   the two cases it was under `## Contracts and decisions`.
3. Codex fills in the six `grid-template-columns` strings, runs the full gate including both
   Playwright configs, and sets `- Owner: Claude`.
4. Claude reviews `git diff master...desktop-density-pass`, records lessons, merges `--no-ff`.
