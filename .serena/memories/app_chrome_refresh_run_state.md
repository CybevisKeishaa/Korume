# app-chrome-refresh — run state pointer (2026-10-14, end of session)

▶ **RESUME HERE.** Branch `app-chrome-refresh`, worktree `.worktrees/app-chrome-refresh` (node_modules = junction to
the main checkout's), base master `a3df0220`, tip `c47a95db`. NOT merged, **no product code yet**.

## Where it is
- Spec `docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md` — **owner-approved** after two review rounds
  (`0bc90f55`, `c976abce`).
- Plan `docs/superpowers/plans/2026-10-14-app-chrome-refresh.md` (`b7ae73ac`, 10 tasks, plan-time corrections P1–P5).
- Owner chose **subagent-driven** execution. Next session: `superpowers:subagent-driven-development` from **Task 1**
  (zero-due review destination). Branch run state: `docs/superpowers/run-state/app-chrome-refresh.md`.

## What it builds
Learner sidebar from Figma page `655:2` (file `IwFHZDZdHW7qsSFiNbWrkd`): Figma = STRUCTURE only; the owner asked for a
modern refinement with Korume DNA (spec §4). 12 items / 4 groups (no IA change), expanded 240 / rail 72 at 1280 on
`--nav-u = 1.125 × density unit`, 44px hit-target floor wins over Figma's 34px rows, lucide-react@1.48.0 (kanji = 文),
logo `public/korume.png`, account menu (Hồ sơ, Cài đặt, Giảm chuyển động, Đăng xuất), rail tooltips, `/help` =
UpcomingScreen on the registry `faq` row, Ôn tập → dynamic review destination + live due badge (approach C: server
initial + `GET /api/nav/summary` on route change and after a saved review), 401 → clear personal data then one full
reload (not router.refresh — app-footer T7), cookie `korume_nav` for (app) only, (focus) always rail.

## Standing rules
- Owner pastes another assistant's review as their answer — treat it as their decision.
- Subagents never use Serena (bound to the main checkout). Never build in the main checkout.
- Shared `reviewDestination()` change (Task 1) also changes the Dashboard Review tile at 0 due → `/kanji`.
