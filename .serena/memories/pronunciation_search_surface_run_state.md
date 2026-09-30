# Pronunciation search surface — run state (2026-10-01)

## Where things stand
- `pronunciation-library-port` MERGED to master `a80a254` (local; the owner pushes by hand). Rulings 15–19 done,
  all gates + e2e green, owner looked in Chrome.
- Branch `pronunciation-show-more`, worktree `.worktrees/pronunciation-show-more` (own `node_modules` via
  `npm ci`, `.env.local` copied from the old worktree). Tip `84fd661`. NOT merged.
  - `dac0259` — Show more on the result surface (`?shown=`, pages of 24 up to 984 = limit+1 ≤ max_rows;
    client `HubResultsPager` moves focus to the first new card, pending label) and ONE resume lesson for the
    featured course (latest unfinished lesson watched OR spoken; hero opens it and says Continue; the rail's
    Continue Practice deliberately unchanged). Reviewed, vitest 3644, e2e green.
  - Owner then rejected the result look (2 columns, 12 rows, big cards) → brainstorm → spec + plan, APPROVED.

## Documents (read these first)
- Spec: `docs/superpowers/specs/2026-10-01-pronunciation-search-surface-design.md`
- Plan: `docs/superpowers/plans/2026-10-01-pronunciation-search-surface.md` (6 tasks)

## Design in one breath
- 3 states: Default (no q, defaults) = Figma curated shelves UNCHANGED; Browse (no q, any lesson setting) =
  compact lesson grid + controls + Show more, no tabs; Search (q) = "Results for “q”" + tabs
  All · Lessons · Learning paths · Practice goals · Collections & situations, each with a count.
- URL: q trimmed (spaces = none); `type` ∈ lessons|paths|goals|library, absent = All, never `type=all`,
  invalid → redirect without it; new search drops type+shown; `shown` only on concrete tabs / Browse; lesson
  settings (sort, duration, hideCompleted, filter) preserved in the URL but ignored outside lessons.
- All: one real row of previews per group (≤4 fetched, extra items `display:none` via `@container`), "See all",
  empty groups hidden, one shared empty state. Lesson preview + "Lessons (N)" apply lesson FILTERS; sort only
  orders. The lesson controls on All are labelled as lesson-only; hidden on paths/goals/library tabs.
- Library = typed merge of the 5 editorial shadowing collections + curated situations (i18n labels), sorted by
  Intl.Collator label (ties: collection, then id), then sliced; count = sum.
- Paths/goals: SQL `search_learning_collections(kind, pattern, limit, offset)` → rows + total, only collections
  with a lesson the caller can see (videos RLS, invoker) — so a PLUS-only path is not counted for Free.
- Grid: `repeat(auto-fill, minmax(12rem, 1fr))`, gap `--space-md`; new `HubLessonResultCard` (HubLessonCard and
  /shadowing untouched).
- MEASURED at the owner's 1280×529: result pane 704 px (nav shown) / 876 (hidden), rail 275/302, gap 14.2 →
  3 cols ≈225 / 4 cols ≈208. The owner's first ask (3/4 cols AND 240–290 px) was impossible beside the rail;
  owner chose COLUMNS (acceptance: cards 200–235 at 1280, ≤300 anywhere, no overflow).

## Next
1. Task 1 → Codex (packet from the plan; Owner flip on a run-state file — none exists for this branch yet).
   Tasks 1–5: Codex implements (no commit, no Playwright, no Docker); Claude runs Task 2's DB steps
   (`npx supabase db reset`, `npm run verify:db:pronunciation`), reviews, commits. Every task gets an
   independent `code-reviewer` before commit (each has found real defects).
2. Task 6 (Claude): service-role e2e fixture (`loadEnvConfig` from `@next/env`, test process only, prefix +
   cleanup) + Playwright geometry at 1280×529 nav shown/hidden; delete the 30 local rows
   `videos.youtube_video_id like 'showmore-probe-%'` and the untracked `tests/e2e/.probe/`.
3. Whole-branch review, fresh reset + gates, owner's Chrome look (nav shown and hidden), merge decision.

## Gotchas met on this branch
- Playwright with the repo config starts its own webServer (`npm run build`) and clobbers a running dev server's
  `.next` in the same worktree → 500s. For measurements use a config with no webServer
  (`tests/e2e/.probe/probe.config.ts`); after e2e, stop 3001, `rm -rf .next`, restart `next dev -p 3001`.
- A cold worktree: Playwright's 120 s webServer timeout is too short for the first build — build first,
  `npm run start`, then run specs. Without `.env.local`, `next start` 500s on env validation.
- JLPT/situation e2e (`pronunciation.spec.ts:166`, `:201`) flake under parallel workers; green with `--workers=1`.
- A reaped background Bash kills only the wrapper: `codex exec` / `next dev` can live on — check the port.
- Codex from the Bash tool: `codex exec -s workspace-write -C <wt> -o <file> - < brief.md`.

Follow-ups (not scheduled): `collections.ts` still recomputes "in progress" in TS (the view has the rule);
`getKnownVocabLemmas` could embed vocab in one paged read.
