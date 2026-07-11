---
description: Run the code-reviewer on the current working diff and report a ranked verdict.
---

Review the current changes with the `code-reviewer` agent.

1. Gather the diff: run `git status` and `git diff` (and `git diff --staged`) to see all pending changes.
2. Hand the diff to `code-reviewer`, which checks — in priority order — the CLAUDE.md §2
   non-negotiables, correctness, security, accessibility, tests, simplicity, and conventions.
3. Report findings ranked most-severe first: severity · file:line · defect · suggested fix.
4. End with a clear verdict: **APPROVE** / **APPROVE WITH NITS** / **CHANGES REQUIRED**, and who
   should fix what.

Do not edit code during review — this command is review-only.
