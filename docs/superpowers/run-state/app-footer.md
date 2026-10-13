# Branch Run State

Branch `app-footer`, worktree `.worktrees/app-footer`, base master `44fc84f0`.

## Goal and scope

Port Figma Footer `203:13813` as `AppFooter` on the 13 outer app pages (spec F1), one scaled single-row
composition (L1: 24 · 230 · 24 · 330 · 24 · 361 · 24 at a 1017px footer), with a real per-account newsletter
opt-in (`users.newsletter_opt_in_at`, definer RPC, Settings toggle). Landing footer unchanged. Desktop-only.
Not in scope: the app navbar (own branch `app-chrome-refresh` once the owner's Figma frame exists), new
marketing/legal pages, mail sending.

## Authorities

- Spec `docs/superpowers/specs/2026-10-13-app-footer-design.md` — **approved by the owner 2026-10-13** after
  three review rounds (round 3 = one composition, space reallocated; O1 store badges as on the landing).
- Plan `docs/superpowers/plans/2026-10-13-app-footer.md` — 9 tasks, plan-time corrections P1–P6, Review Focus
  1–5. **Awaiting owner review + choice of execution method.**
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-011, L-044, L-051).

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Spec | approved | `1af6902d` … `6659e197` |
| Plan | written, awaiting owner review | see git log |
| T1–T9 | not started | — |

## Contracts and decisions

Spec F1–F6, L1–L3 (L2a–L2e), N1–N5, T1–T6, O1. Plan P1 API route not server action; P2 `router.refresh()`
not `revalidatePath`; P3 T2 static + runtime split; P4 art `/mascot/poses/sleeping.png`; P5 sign-in = reload
(middleware adds `redirectTo`); P6 email = session account email.

## Verification

None yet. L2d values (footer width at floor, `--f` floor/ceiling, section widths, L2b used or not) to be pinned
here by Task 8.

## Working tree and environment

- Owner: Claude

`node_modules` is a junction to `.worktrees/port-profile/node_modules`; `.env.local` copied from the main
checkout. Codex is gone (owner 2026-10-12): Claude implements, reviews and merges. Serve on a port other than
3000 (owner's dev server). Demo learner `demo.dashboard@korume.local` / `password123`; run the demo seed's
`-- --cleanup` before any E2E.

## Blockers

Owner review of the plan and choice of execution method (subagent-driven recommended).

## Next actions

1. Owner reviews the plan, picks subagent-driven or native.
2. Task 1 (migration + `verify:db:footer`; `npx supabase migration up`, ask before any `db reset`).
