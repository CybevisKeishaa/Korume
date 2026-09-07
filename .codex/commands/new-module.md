---
description: Scaffold a standard learning module (schema → API → UI → tests) end to end.
argument-hint: <module name, e.g. kanji | vocab | grammar | reading | jlpt>
---

Scaffold the **$1** learning module for Korume as a vertical slice. Read `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md`, and the active run state before dispatching.

Coordinate through `tech-lead` in this order:

1. `database-engineer` — schema, RLS, indexes, and the schema contract from spec §4.
2. `backend-engineer` — validated API routes and typed contracts from spec §5; write deterministic logic tests first.
3. `frontend-engineer` — responsive, keyboard-navigable, WCAG AA pages and components that consume those APIs; write component tests first.
4. `motion-engineer` — only if the module has a signature animation.
5. `test-engineer` — close risky-logic coverage gaps and add an end-to-end core-flow test.
6. `code-reviewer` — review the integrated diff read-only.

Checkpoint after each accepted task. Respect every AGENTS.md non-negotiable and applicable product priority.
