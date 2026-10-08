# port-dashboard — run state (Serena mirror)

> Authority is the branch run state `docs/superpowers/run-state/port-dashboard.md` (on branch `port-dashboard`,
> worktree `.worktrees/port-dashboard`). This file is the resume pointer for a new session.

## Where it stands (2026-10-08 end of session)

- Branch `port-dashboard` from master `b89f49d`; worktree `.worktrees/port-dashboard`. **NOT merged, no code yet.**
- Spec `docs/superpowers/specs/2026-10-08-port-dashboard-design.md` — `6cb8c70` + owner spec-review corrections
  `812c7c3` — **APPROVED**.
- Plan `docs/superpowers/plans/2026-10-08-port-dashboard.md` — `74f2e55`, 16 tasks — **APPROVED by the owner** incl.
  plan-time corrections P1–P9.
- Branch run state `6e3b99d` (Owner: Claude). Tasks T1–T16 not started.
- Owner said: execution happens in the NEXT session. **Execution method not chosen yet** — ask first
  (Claude recommended subagent-driven; Codex via Paseo as implementer per `port-profile` R-route2; if Codex hits its
  quota Claude finishes the task without asking).

## Resume steps

1. Read this file → branch run state → spec §0–§1 (rulings) → plan header (Global Constraints, P1–P9).
2. Ask the owner: subagent-driven or native.
3. In the worktree: junction `node_modules` → `..\port-profile\node_modules`, copy `.env.local` from the main
   checkout, `npm run verify:protocol`.
4. Task 1. `npx supabase db reset` needs owner approval in auto mode; every reset wipes the dictionary →
   `bash ../shadowing-workspace-1b/.tmp/import.sh`.

## Owner rulings in one line each (full text: spec §1)

D1 real daily missions, XP only (Journey Point dropped) · D2 Journey = curriculum progress, not JLPT proficiency ·
D2b curated `collections.kind='curriculum'` + manifest, no estimate fallback · D2c production manifest empty at merge,
"Lộ trình JLPT đang được biên soạn" · D3 Weakness = ≤3 families (Listening, Reading, one Pronunciation metric), no
Grammar · D4 Weekly = 10 rolling 7-day windows, deltas in points · D4b mining `mastered_at`, distinct lexical items,
Profile switches too · D5 Continue = most recent incomplete, 4 states · D6 AI Sensei → Korume, deterministic cue,
silence allowed, positive-only weekly cue · D7 56-date heatmap from learning_outcomes · D8 earned then in-progress
badges · D9 Dashboard-owned header, no search, AppNav untouched · D10 Review smart entry, frozen due set · D11 50 XP,
cycle identity `mission:<id>`, ensure BEFORE the write, conversation dropped · D12 A10 stands: review = Mining + Kanji.

## Facts found while designing (keep)

- Web is DESKTOP-ONLY (owner 2026-10-08); mobile is a separate native app. Ports review at 1280x529 + 1440x900 only.
- Local DB has only 8 demo/e2e videos; no deployed DB; N5/N4 curriculum curation is a separate content work item.
- `recordActivity` runs AFTER every learning write → mission snapshot must be ensured before the write.
- `user_grammar_progress.mastery_score` has no writer; `hundred_kanji` badge is unreachable (45 curated kanji);
  conversation outcome has no minimum-turn rule; `completed_at` is overwritten (S7 `first_completed_at` fixes it for missions).
- Pinned §10 values (heatmap 1–4/5–14/15–29/≥30, min 3 attempts, +5 points) are unmeasured — no real data exists.
