---
description: Plan and build one of the 8 implementation layers with the right agents, in order.
argument-hint: <layer number 1-8>
---

Build **Layer $1** of Korume.

First, act as (or delegate to) the `tech-lead`:

1. Read `CLAUDE.md` and `.claude/docs/workflow.md`. Locate Layer $1 in the workflow's §3 build order
   and read the matching modules in `japanese-learning-app-spec.md`.
2. Produce an **ordered task list** for this layer only: each task → single owner agent → dependencies
   → done-criteria. Enforce data-flows-down (schema → API → UI). Note parallelizable vs blocking tasks.
3. Confirm the plan with the user before implementing.
4. Execute task by task, routing each to its owner agent (`database-engineer`, `backend-engineer`,
   `frontend-engineer`, `motion-engineer`, `ai-engineer`), with `test-engineer` establishing TDD.
5. After integration, route the diff to `code-reviewer`. The layer is done only on sign-off with
   passing tests (shown output), per CLAUDE.md §9.

Do NOT pull work forward from later layers. Keep scope to Layer $1.
