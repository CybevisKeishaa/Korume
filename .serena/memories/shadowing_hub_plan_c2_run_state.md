# Shadowing Hub C2 — resume index (updated 2026-09-16)

> **Sync note.** The repair worktree is now at `3904afd`; older references to
> `afb50f6` below are the immediately preceding checkpoint, not the latest tip.

## Canonical state

Read `docs/superpowers/run-state/shadowing-hub-plan-c2.md` first. It is the
single source of truth for this long-running repair; this Serena memory is
only the short resume pointer.

## Current checkpoint

- Worktree: `.worktrees/shadowing-hub-c2-repair`
- Branch: `shadowing-hub-c2-repair`
- Latest commit: `3904afd fix(shadowing): close Hub review findings`
- Worktree was clean immediately after that commit.
- The long-lived root-checkout server on port 3000 is stale for this work.
  Inspect the current isolated production artifact at
  `http://localhost:3002/en/shadowing` instead, when its local process is
  still running.

## What the latest commit changed

The owner supplied Figma file `IwFHZDZdHW7qsSFiNbWrkd` and Import-card node
`149:520`, then approved the implementation. The Shadowing Hub Import card
now has the Figma-like hierarchy: eyebrow, title, explanatory copy, compact
YouTube URL form, support copy, and quota capsule. EN and VI messages remain
in a checked copy contract.

At `xl`, the quota capsule is to the right of the form. At the C2 desktop
threshold (1024px) through below `xl`, it moves below the form *inside the
card*. This keeps the required desktop-only shell, permanent 300px rail, and
three outer columns while preventing the actual URL input from becoming too
narrow. Do not reintroduce the mobile web UI below 1024px: that range is the
app-download handoff by approved product decision.

Quota copy is truthful: free users see the remaining actual count; Plus or an
unlimited limit shows only the unlimited statement. No invented progress,
ETA, jobs, goal, or usage data is permitted.

## Evidence and review

- Focused unit, import-form, and copy-contract suite: 18 tests passed.
- Browser spec against the freshly built port-3002 artifact: 2 passed,
  covering 1023px handoff-only and the 1024px desktop layout, including an
  actual URL-input-width assertion.
- Typecheck, production build, lint, and `git diff --check` passed. Lint has
  pre-existing warnings outside this change.
- Task review approved after replacing an unnecessary native `aside` with a
  `div`; RTL now asserts no extra complementary landmark.

## Resume discipline

Before a further Hub change, read the canonical run-state above, the relevant
spec/plan it cites, `AGENTS.md`, and `docs/lessons.md`. Keep the repair branch
isolated; do not confuse its artifact with port 3000. A further non-trivial
change requires tests first, review, fresh build/browser evidence, and a
whole-branch review before any merge claim.
