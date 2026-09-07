---
description: Run the code-reviewer on the current working diff and report a ranked verdict.
---

Review the current changes with the `code-reviewer` agent.

1. Gather `git status`, `git diff`, and `git diff --staged`.
2. Give the diff, relevant task packet, AGENTS.md, lessons, active run state, and direct dependencies to the reviewer.
3. The reviewer checks, in order: AGENTS.md non-negotiables, correctness, security, accessibility, tests, simplicity, and conventions.
4. Report findings ranked most-severe first: severity · file:line · defect · suggested fix. End with **APPROVE**, **APPROVE WITH NITS**, or **CHANGES REQUIRED** and name the owner.

Review is read-only. A reviewer may not edit files or run `git stash`, `git reset`, or `git checkout`.
