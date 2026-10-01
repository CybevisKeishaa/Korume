# Branch Run State

Branch `shadowing-workspace-1a`.

## Goal and scope

Shadowing workspace Part 1a: the core Shadowing loop at `/[locale]/shadowing/[id]`, ported from Figma
`105:3088`, proven live on the real Ep.729 lesson. Web only. Parts 1b/2/3/4 are separate branches.

## Authorities

- Spec (locked): `docs/superpowers/specs/2026-10-01-shadowing-workspace-part-1a-design.md` @ `8c8f2f6`
- Plan: `docs/superpowers/plans/2026-10-01-shadowing-workspace-part-1a.md` @ `5cec887`
- Packets: `.superpowers/sdd/shadowing-workspace-1a/<task>-brief.md`
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `6ec1133` `8c8f2f6` spec · `e8d4b13` `797b35e` `5cec887` plan

## Contracts and decisions

- Owner rulings in spec §2 (Q1–Q5, architecture option 1, lesson bookmark) and §3 deviation register.
- 2026-10-01 header source line = option (b): nullable `videos.channel_title` from oEmbed `author_name`,
  fallback `YouTube · N3 · 23 min`; no render-time oEmbed; no backfill.
- Execution (owner, 2026-10-01): two-harness. Claude does T0 and T11; Codex does T1–T10 and T12 from
  packets; Claude reviews after every task and commits (`Co-Authored-By: Codex`); whole-branch review at
  the end. T1–T2 may run while T0 runs; **T3/T4/T5 wait for T0's recorded ruling below**. T12 removes
  `ShadowingView` only after parity + deterministic e2e + live Ep.729 gates.

### T0 — YouTube clock and paused initialisation

(pending — Claude fills this with measured numbers and the chosen calls)

## Verification

(none yet)

## Working tree and environment

- Worktree `.worktrees/shadowing-workspace-1a`; `.env.local` copied; `npm ci` run 2026-10-01.
- Codex: never commit (sandbox ACL), never run Playwright, never build or `next start`.
- Port 3000 may hold an orphan `next start` from the `pronunciation-show-more` worktree; Claude uses it
  for T0 probing only, and kills it before T11.
- Local DB holds Ep.729 (`videos.id = 1b94ef3e-df4a-4922-9cf7-88d74860aa6a`); any `db reset` wipes it —
  re-seed from the session scratchpad script until Task 11 ships `scripts/seed-real-lesson.ts`.
- `npx supabase db reset` on this branch is approved by the owner.

- Owner: Codex

## Blockers

- T3, T4, T5 blocked on T0.

## Next actions

1. Codex: Task 1 per `.superpowers/sdd/shadowing-workspace-1a/task-1-brief.md`.
2. Claude: Task 0 probe; record results above.
