# Branch Run State

Branch `app-footer`, worktree `.worktrees/app-footer`, base master `44fc84f0`.

## Goal and scope

Port Figma Footer `203:13813` as `AppFooter` on the outer app pages (spec F1 table), with a real per-account
newsletter opt-in (`users.newsletter_opt_in_at`, Settings toggle). Landing footer unchanged. Desktop-only.
Not in scope: the app navbar (own branch once the owner's Figma frame exists), new marketing/legal pages, mail sending.

## Authorities

- Spec `docs/superpowers/specs/2026-10-13-app-footer-design.md` — design approved in conversation 2026-10-13;
  written spec awaiting owner review.
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-051 binds the layout).

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Spec | written, awaiting owner review | see git log |

## Contracts and decisions

Spec F1–F6, L1–L3, N1–N5, T1–T6. Visible trade-off for the owner: F6 (mascot art without the frame's captions).

## Verification

None yet.

## Working tree and environment

- Owner: Claude

`node_modules` is a junction to `.worktrees/port-profile/node_modules`; `.env.local` copied from the main checkout.
Codex is gone (owner 2026-10-12): Claude implements, reviews and merges.

## Blockers

Owner review of the written spec.

## Next actions

1. Owner reviews the spec → corrections → approval.
2. `writing-plans` → owner approves the plan and the execution method.
