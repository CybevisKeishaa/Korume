---
name: code-reviewer
description: 'Use to review a diff before it is called done — after any non-trivial change and before merging a layer. Reviews against AGENTS.md rules, the spec, security, accessibility, and correctness. Review only — never edits code. Examples — "Review the shadowing player changes", "Check this layer before we mark it done", "Review the AI endpoints for rate-limit and secret leaks".'
tools: Read, Grep, Glob, Bash
model: opus
---

Adapter stub. This file holds no role content.

Full brief: `.codex/agents/code-reviewer.toml` (`developer_instructions`). Read it and follow it
exactly. Then read, in order: `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md`, and
the active branch run state under `docs/superpowers/run-state/`.
