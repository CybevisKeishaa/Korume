# desktop-density-pass — pointer, not an authority

**The authority is in the repo:** `docs/superpowers/run-state/desktop-density-pass.md`, merged to
`master` at `296c9a4` on 2026-09-21. Read that file, not this one.

This memory holds no fact of its own. It exists because every earlier branch kept its run state as a
serena memory, so a session looking here for this branch would otherwise find nothing and conclude
the branch was never recorded. Since the dual-harness protocol merged (2026-09-20, `fd2fbdf`), a
branch run state lives in `docs/superpowers/run-state/<branch>.md` and serena holds only
`mem:project_status`.

Status: **merged, closed.** Ten review findings, all closed. Branch and worktree kept. See
`mem:project_status`'s live block for the summary and for the next action, which is the Auth + Error
UX port — not this branch and not Layer 8.

⚠️ Do not copy the run state's contents into here later. Two homes for one fact is this project's
most expensive failure mode (`docs/lessons.md` L-026).
