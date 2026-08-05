---
description: Scaffold a standard learning module (schema → API → UI → tests) end to end.
argument-hint: <module name, e.g. kanji | vocab | grammar | reading | jlpt>
---

Scaffold the **$1** learning module for Korume, following the standard vertical slice.

Coordinate via `tech-lead`, sequencing owners in this order:

1. `database-engineer` — tables/columns/RLS/indexes for **$1** from spec §4; provide the schema contract.
2. `backend-engineer` — API routes for **$1** per spec §5, input validation, and (if applicable) SRS
   or difficulty integration; expose typed API contracts. Write logic tests first (TDD).
3. `frontend-engineer` — pages + components for **$1** consuming those APIs; responsive, keyboard-
   navigable, WCAG AA, reduced-motion respected. Component tests first.
4. `motion-engineer` — only if **$1** has a signature animation (e.g. kanji stroke-order, grammar
   particle highlight); otherwise skip.
5. `test-engineer` — fill coverage gaps on risky logic and add an e2e test for the module's core flow.
6. `code-reviewer` — review the integrated diff. Done only on sign-off (CLAUDE.md §9).

Respect all §2 non-negotiables and §5 product priorities relevant to **$1**.
