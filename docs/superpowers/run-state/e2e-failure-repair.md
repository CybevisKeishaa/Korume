# Branch Run State

## Goal and scope

Make `npm run test:e2e` green again, by root cause rather than by suppression.

`master` at `133618a` ran **7 failed / 59 passed**, and had for weeks. Four
consecutive branches (`auth-error-ux`, `desktop-density-pass`, `settings-page`,
`settings-review-fixes`) recorded the same seven as "pre-existing" and moved on.
There are exactly **two** causes, not seven failures:

1. **The below-1024 mobile handoff gate.** `app/[locale]/layout.tsx` renders
   `MobileAppHandoff` above every route group and `app/globals.css:1133` hides
   `[data-desktop-web]` outright below 1024 (`0014ea2`, 2026-09-09).
   `tests/e2e/landing-page.spec.ts` never learned it.
2. **A spec run by a config that does not own it.** `playwright.c4.config.ts`
   claims `lesson-creation-jobs.spec.ts` via `testMatch` and supplies the two
   things it cannot run without; `playwright.config.ts` had no `testIgnore`.

⚠️ **Out of scope, deliberately:** the `display-scale` / `settings` load flakes
under eight parallel workers (they also fire on the master baseline), the
`pitch-contour` / `waveform` canvas flake family, and the hero-still preload
noted below.

## Authorities

- **The owner's ruling, this session:** the gate is intended — *"cái màn để
  direct qua CH Play và App Store, là màn đó dành cho điện thoại, điện thoại sẽ
  không thấy landing page luôn."* A phone never sees the landing page. Any later
  pass that "fixes" the landing page below 1024 is reverting a product decision.
- `docs/lessons.md` L-004 (vacuous guards), L-006 (a threshold derived from the
  list it guards), L-009 (never wave a flake through), L-012 (review the fix
  wave), L-013 (right measurement, wrong diagnosis). All five fired here.
- `AGENTS.md` §2 rule 5 (WCAG 1.4.10 at 320 CSS px), §6 (one fact one home, no
  dead code), §7 (mutation-check a guard written over existing code), §9 (DoD).

## Accepted commits

| Commit | What |
|---|---|
| `31ec182` | `landing-page.spec.ts` stops measuring where the page does not render; `journey.tsx` docblock |
| `873a67a` | `playwright.config.ts` `testIgnore` for the spec `c4` owns |
| `b212544` | whole-branch review wave — 4 Important, 6 Minor |
| *(this)* | L-012 review wave — 1 Critical, 3 Important, 9 Minor |

## Contracts and decisions

- **`landingRendered` is the file's render guard, not `toHaveCount(9)`.**
  `display: none` on an ancestor removes no node, so the count returns 9 against
  a zero-box page. Visibility is the only predicate that can tell them apart.
  The old count cost three red tests and **three silently green** ones.
- **§3's card row no longer overflows at any supported width** —
  `scrollWidth === clientWidth` measured at 1024/1080/1120/1256/1280/1440 in
  both locales. The old "it overflows and contains it" assertion is unreachable,
  not relocatable. 1024 has **no slack**: 663px, five cards, exact.
- **Five `sizes` constants carry an unreachable below-1024 clause and all five
  stay** — the grammar requires a final unconditional value. The single home for
  that fact is `asset-slot.tsx`'s `DEFAULT_SIZES`. ⚠️ The reason does **not**
  extend to an unreachable *media-query branch*: `recommendation.tsx`'s
  `(min-width: 640px) 440px` was deleted, not annotated.
- **`c3` deliberately gets no npm script.** Its specs already run under the
  default config, and `playwright.c3.config.ts` sets `reuseExistingServer: true`,
  which is how a run ends up measuring another worktree's server.
- **`npm run test:e2e` and `npm run test:e2e:c4` must not run concurrently** —
  same `.next`, and `c4` rebuilds with `reuseExistingServer: false`.

## Verification

Measured in this worktree, never in the main checkout.

| Gate | Result |
|---|---|
| `npm run test:e2e` (branch) | see below — re-measure at the tip |
| `npm run test:e2e` (`master` `133618a`, detached, same worktree) | **7 failed / 59 passed** |
| `npm run test:e2e:c4` | **3 passed** |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 errors, warning baseline unchanged |
| `npm run verify:protocol` | valid |
| `npx vitest run --reporter=dot` | 368 files / 3434 tests, 0 failed |

⚠️ **Quote the commit with any figure.** `b212544`'s own message and the
`docs/lessons.md` entry both carried "3 failed / 59 passed", which was measured
at `873a67a` (62 cases); the tip runs more, because each wave added tests.

**Mutation checks** (`AGENTS.md` §7 — every guard here is written over code that
already exists, so none can fail first). Each restored and verified by blob hash.

| Guard | Mutation | Red output |
|---|---|---|
| `landingRendered` | a sweep width of 768 | `expect(#hero).toBeVisible()` → received `"hidden"`; 1280/1440 stayed green |
| h1 scope | `[data-desktop-web] h1` → `h1` | expected 1, received 2 |
| row fits | `CARD_BASIS` floor 8rem → 10rem | expected 663, received 816 |
| row containment | `overflow-x-auto` → `overflow-x-clip` | expected `"auto"`, received `"clip"` |
| row focusable | `tabIndex={0}` removed | expected true, received false |
| handoff tab order | `tabIndex={-1}` on the Play Store link | `toEqual([APP_STORE_URL, PLAY_STORE_URL])` red — **the pre-fix version PASSED this**, which is what made it a Critical |
| handoff sweep size | `PHONE_WIDTHS` → `[320]` | expected length 10, received 2 |

## Working tree and environment

`.worktrees/e2e-failure-repair`, branch `e2e-failure-repair`, cut from `master`
`133618a`. Its own `node_modules` and a copied `.env.local`.

⚠️ **Serena's editing tools write to the MAIN CHECKOUT.** They resolve
`relative_path` against the activated project root and ignore the shell cwd, so
in a worktree they silently patch `master` and still report `OK`. Seven edits
landed there before a re-run showed identical pre-fix failures. Use
`Read` + `Edit`/`Write` or `sed` here.

- Owner: Claude  <!-- exactly one; the handoff is the commit that changes this line -->

## Blockers

None.

## Next actions

1. Re-run the full gate at the tip and record the figures against that commit.
2. A third review, of this L-012 wave, if the owner wants the chain closed —
   the previous two each found real defects, the second a Critical.
3. `--no-ff` merge to `master`. **Owner decision, not taken.**

▶ **Found here, deliberately not fixed** — each wants its own ticket:
- **Every phone visitor downloads the landing page's hero still (~400 KB).**
  The image carries `priority`, so Next emits a preload link, and a preload
  fetches regardless of `display: none`. Measured: at 1023 the `load` event
  never fires on a cold cache because of it.
- `display-scale` / `settings` e2e failures under parallel load; they fire on
  master too, differ between runs, and pass 11/11 alone.
- `README.md`'s script table was two commands out of date before this branch.
