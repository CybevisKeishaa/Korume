# CLAUDE.md — entry pointer for the Claude Code harness

This file is non-normative and is not a second instruction source. It holds no
rule of its own; everything below is a pointer.

Read [AGENTS.md](AGENTS.md) for the repository rules, and
[.codex/docs/workflow.md](.codex/docs/workflow.md) for agent roles, routing and
the branch workflow. Both are canonical for **both** harnesses — `.codex/` is
not Codex-only, it is simply where the shared instruction layer lives.

Before writing anything, read `.codex/docs/workflow.md` §8 (two-harness
protocol): it defines who owns which worktree, how a handoff happens, and what
Claude owns versus Codex.

`.claude/agents/`, `.claude/commands/` and `.claude/docs/` are adapter stubs
that exist only because this harness cannot load `.toml` role definitions. They
hold no role or workflow content. `npm run verify:protocol` enumerates both
trees and fails if a stub grows past 25 lines or 4096 bytes, loses its pointer,
has no canonical counterpart, or lets its `description` or `argument-hint` drift
from that counterpart.
