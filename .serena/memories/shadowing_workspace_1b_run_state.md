# Shadowing workspace Part 1b — MERGED (2026-10-03) and COMPLETE

Owner looked at the merged build in Chrome (worktree build on :3000, AI off) on 2026-10-03 and closed 1b. The server
is stopped. Next session: ask the owner which project starts — Korume Companion in Shadowing or Summary (Part 4).

Merged to master `ede3833` (`--no-ff`) after the reframe. Master is ahead of origin; the owner pushes by hand.
Worktree `.worktrees/shadowing-workspace-1b` kept (untracked `.tmp/import.sh` re-imports the local dictionary).
Ledger with every `Ruling:` line: `.worktrees/shadowing-workspace-1b/.superpowers/sdd/2026-10-02-shadowing-workspace-part-1b/progress.md`.

## Shipped
- Shadowing = practice surface: Look-up (word card, kanji Inspector in the drawer, Enter on Live Sentence → word list),
  drawer tabs Mining + Notes only. No Vocabulary/Grammar/AI/✨/Analyze anywhere in Shadowing (never restore them).
- `GET /api/lines/[id]/analysis?scope=lexical|full`; Shadowing sends lexical only.
- Knowledge core merged but DORMANT (no Shadowing caller). Migration 040: a late settle/release after an expired hold
  still spends its cost once (expired_at / late_spent_at). Providers time out at PROVIDER_TIMEOUT_MS 60 s (< 90 s lease).

## Commits (reframe)
26fc4b6 handoff · fab1515 R1 · fa84ac3 R2+R3 · 0c2cb3e R4 · ba22e6d R5 · 822e38d T16a docs · 4d10810 review fixes ·
631bc69 run state · ede3833 merge. Final gates: vitest 482/4357, e2e intelligence+1a 26/26, live Ep.729 2/2, all verify:db 0.

## Follow-ups
Review M5 analysis memo keyed by line id (not text) · M6 no per-user cap on system-funded gloss · M7 staging snapshots
never purged · M8 ai_release_expired lock order · M9 raw note length cap · Anthropic timeout untested · list focus
one-shot ref · RESERVATION_TTL comment · dict:import activation can hit the API statement timeout · T16b skipped
`supabase db reset` (needs the owner).

## Gotchas
- Local dictionary empty → `/api/dictionary/kanji/*` 404: re-run `.tmp/import.sh`; if activation times out, run
  `select dict_activate_snapshot('<id>')` via psql in `supabase_db_nihongo-cinema`.
- Bash heredocs break on an apostrophe in prose: put scripts in files.
- Codex: ~107k tokens per small packet; it hit its quota mid-R3a at 137k — Claude finished.

Next: Korume Companion in Shadowing (Figma 215:15164, first Knowledge-core caller, live AI with Gemini), then Summary (Part 4).
