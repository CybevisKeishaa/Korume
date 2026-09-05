---
description: Plan and build one of Korume's eight implementation layers with the appropriate agents, in order.
argument-hint: <layer number 1-8>
---

Build **Layer $1** of Korume.

First, coordinate as `tech-lead`:

1. Read `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md`, the active branch run state, and the matching modules in `japanese-learning-app-spec.md`.
2. Produce an ordered task list for this layer only: each task → one owner → dependencies → done criteria. Enforce schema → API → UI and identify what may run in parallel.
3. Confirm the plan with the user before implementation.
4. Execute in order, routing work to the named specialists; `test-engineer` establishes TDD.
5. Checkpoint the branch run state after each accepted task, then request a read-only `code-reviewer` review before calling the layer done.

Do not pull work forward from later layers.
