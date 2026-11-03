# Practice modes B2 — Listening Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Listening Practice (Word Bank + Typing) as the third mode of the Shadowing workspace, with server-owned scoring, honest per-format Summary/Dashboard/Mission data, learner-proof score rows, and the legacy `/dictation` route retired.

**Architecture:** The mode page lives at `(workspace)/listening`, so the one player instance survives. A server-only kuromoji chunker (versioned) cuts each line into ≤ 8 bunsetsu chunks; the server re-derives chunks, hint units and the score from the line itself on every submit and writes the row with the service-role client. The URL's `?format=` is the one source of the active format. A shell-level reveal provider keyed by line + format + attempt lets the left column (subtitle overlay, listen-only cover) follow the right column's attempt without a single frame of leaked answer.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase (Postgres), kuromoji 0.1.2, zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` — B2 = §5, §6.2, B2 rows of §7–§9, plus §3.2/§3.5/§3.6 rows marked B2. Read it before any task. B1's plan and run state (`docs/superpowers/plans/2026-10-15-practice-pronunciation.md`, `docs/superpowers/run-state/practice-pronunciation.md`) are the model for gates and conventions.

**Execution:** subagent-driven (owner, 2026-10-21): one implementer per task, an independent `code-reviewer` per task, focused tests + one mutation per behaviour, then full suite, whole-branch review and a reviewed fix wave. No merge before the owner's Chrome look and approval.

## Global Constraints

- Desktop-only; review viewports 1280×529, 1440×900, 1920×1080, plus nav collapsed (spec §9).
- Type uses the shared `--text-*` tokens only (L-052); layout may scale (L-051). No hardcoded colour where a token exists.
- No fabricated data: no Figma numbers, no time metrics (spec §3.5). The two formats are never averaged together (D5, §3.5).
- One player instance: no `template.tsx`, no pathname-derived `key` between `(workspace)/layout.tsx` and mode pages (spec §3.1).
- Word Bank: at most 8 chunks, no distractors, deterministic shuffle per line (D8). Unreliable cut → Typing with a visible notice (D9).
- Hints unlimited, one unit per press; hinted parts never count; fully hinted = 0 (D10). Show answer = `revealed`, never a score, never a mission outcome (D11).
- `REVIEW_DICTATION_BELOW = 80` (`lib/summary/thresholds.ts`) is the one review cut for Listening (R2).
- `authenticated`/`anon` have no INSERT/UPDATE on `dictation_attempts`; the app writes with `createServiceClient()` (`lib/supabase/service.ts`) after the user-scoped client verified the user and the line (D25, §7.1).
- Read functions: `security invoker`, `set search_path = public`, `revoke … from public, anon`, grant `authenticated`.
- Every API response carrying learner data or line answers: `Cache-Control: private, no-store`.
- Copy in both `messages/en/*.json` and `messages/vi/*.json`.
- **The owner's DB (owner 2026-10-21):** never reset; no migration experiment, no SQL mutation and no function redefinition runs on it. Migrations, DB gates and SQL mutations are proven on a disposable database first; the owner's DB only receives the final, proven migration once (Task 1). If a disposable database cannot be built, that gate is **unmet** and the task stops (L-050) — the owner's DB is never the substitute.
- A mutation must turn its test RED. A mutation that leaves the test green is the wrong mutation: record it, choose another, and report both.
- Build, serve and install only inside `.worktrees/practice-listening`; every shell command starts with `Set-Location C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\practice-listening` (the tool cwd defaults to the main checkout). Vitest: `npx vitest run --minWorkers=1 --maxWorkers=2 <files>`; full suite `npx vitest run --reporter=dot` (L-035).
- Every task that touches TypeScript ends with `npx tsc --noEmit` and `npm run lint` (L-029, L-018), not only the last one.
- Code mutations keep `<file>.mutbak` beside the file; never `git checkout --` to restore.

## Plan-time rulings (decisions the spec leaves open or states differently from the repo)

- **P1 — chunks route path.** Every existing `/api/lines` route uses the dynamic segment `[lineId]` (`app/api/lines/[lineId]/analysis`); Next forbids a sibling with another name. The spec's `GET /api/lines/[id]/chunks` is built at `app/api/lines/[lineId]/chunks/route.ts` — one folder, no `[id]`.
- **P2 — legacy redirect lives in `next.config.mjs`.** The repo redirects retired routes there (`/sensei`, `/videos/:id/dictation`). Spec §5.10's "dictation/page.tsx becomes a permanent redirect" is built as a `permanent: true` rule `/:locale(vi|en)/shadowing/:id/dictation` → `/:locale/shadowing/:id/listening?format=typing`, the `/videos/:id/dictation` rule points straight at the same destination (one hop), and `dictation/page.tsx` is deleted with `DictationView` (Task 9). Locale, lesson id and any query string of an old deep link (e.g. `?line=`) are kept — E2E-tested in both locales (Task 9).
- **P3 — where the B2 SQL lives (owner-approved 2026-10-21, measured the same day).**
  - Facts: 043, 045 and 047 are on master and applied on the owner's DB (`schema_migrations` holds 043–047); 043 was edited twice and 045 ten times after they were added (AGENTS §6 mandates in-place edits), and `migration up` kept applying later files, so the CLI records versions, not file contents. Nothing in migrations 044–047 calls `lesson_summary_evidence`, `weekly_skill_windows`, `weakness_scores`, `practice_activity` or `practice_stats` (only tests and TypeScript do). On the owner's Postgres `check_function_bodies = on`: a `language sql` function naming `dictation_attempts.format` fails at creation (`column "format" does not exist`); the same body in `plpgsql` is created.
  - Consequence: a function that reads the new columns cannot be defined in a file that runs before the columns exist (fresh replay breaks), and cannot be edited in a file the owner's DB has already run (upgrade never sees the change). **Every function whose body reads a B2 column therefore has its single home in the new `supabase/migrations/20261021000048_practice_listening.sql`**: `lesson_summary_evidence` (from 043), `weekly_skill_windows`, `weakness_scores`, `practice_activity` (from 045) and `practice_stats` (from 047). Each moves with its `revoke`/`grant`; 048 defines it with `create or replace`, so a fresh chain creates it and an upgraded DB replaces its old copy. The old files lose only those definitions and keep a one-line pointer comment; nothing else in them changes. Every other B2 object (columns, backfill, checks, trigger, index, privilege change) is new and lives in 048 too.
  - Fresh replay and the upgrade path are both proven on disposable databases before the owner's DB is upgraded (Task 1). AGENTS §6 one-home holds: one definition per function, no superseding duplicate.
- **P4 — navigator state `revealed`.** §3.4 lists a separate "revealed" chip, §3.6 says revealed reads as needs-review. `practice_stats` returns `state: "revealed"` for Listening; the navigator shows it with the review tone and the label "Answer shown"; every review rule treats it as review (R2).
- **P5 — Dashboard copy (owner 2026-10-21).** The Dashboard has no Listening empty state (only `skills.listening` labels in the weekly and weakness cards). D20's copy change lands on that label, layout unchanged: EN "Listening (Typing)", VI "Nghe (gõ chính tả)".
- **P6 — Summary status rows.** `LessonStatus.listening` becomes `listeningWordBank` + `listeningTyping` (two labelled rows). Reflection evidence carries both qualities; its fingerprint moves, so each cached reflection regenerates once — accepted.
- **P7 — one base string.** Chunks, `grapheme4` units, kuromoji tokens and the Typing reference are all cut over `base = normalizeJa(text_jp)` (`lib/dictation/normalize.ts`). Displayed answers keep `text_jp`. `textHash = sha256(text_jp)` hex. **Display amended by P13.**
- **P8 — shuffle on the client.** `GET …/chunks` returns chunks in reference order; client and server share the pure `bankOrder(n, lineId)` (`lib/dictation/shuffle.ts`). The server never needs the bank order (it scores `chunkOrder` against reference order).
- **P9 — mission.** `dictation_lines` counts DISTINCT lines with a `submitted` attempt across both formats; `revealed` never counts (D11, §6.2). Its copy becomes "Practise listening to N sentences" / "Luyện nghe N câu", because Word Bank now counts. Weakness `practiceHref` for listening goes to `/listening?format=typing` (Dashboard listening is Typing-only, D20).
- **P10 — the URL is the one source of the active format (owner 2026-10-21).** Panel, hint unit, stat strip, stats fetch and reveal key all read `listeningFormat(searchParams.get("format"))`; nothing keeps a second copy. The D9 fallback is a URL change: when the current line's chunks come back `reliable: false` while the URL says Word Bank, the body calls `router.replace` to the same path with `format=typing` (other params kept, no scroll) and renders no practice controls until the URL agrees — so no frame shows Typing under Word Bank stats or the reverse. On an unreliable line the Typing panel shows the notice "This sentence can't be split reliably, so it's Typing only", and the format switch's Word Bank option is disabled with that reason. The format then stays Typing until the learner switches back.
- **P11 — reveal state keyed by line + format + attempt (owner 2026-10-21).** `ListeningRevealProvider` lives in `WorkspaceLayout`, receives the current `lineId` and URL `format` as props and holds `{ key: "<lineId>|<format>", attempt, phase, videoShown }`. When the props' key differs from the stored key it resets to `answering`, cover on, `attempt + 1` **during render** (React's "adjust state when a prop changes" pattern, on its own state), so the committed frame after a line or format change is already concealed — no effect involved. `newAttempt()` (Try again) resets in the click handler. `markChecked(attempt)` / `markRevealed(attempt)` / `showVideo(attempt)` are no-ops when `attempt` is stale, so a late response from a discarded attempt can never reveal anything. The player shows the subtitle only when `answerVisible` (stored key equals the current key and phase is `checked | revealed`). The mode body mounts its panels with `key={`${lineId}|${format}|${attempt}`}`, so their local state (placed chunks, typed text) starts empty on the same frame.
- **P12 — the chunks memo never skips the access check (owner 2026-10-21).** Every request authenticates and reads the line through the learner's RLS first; the memo is keyed by the **text hash of the line this request just read**, never by `lineId` alone, and is consulted only after that read succeeded. A cache hit therefore cannot exist for a learner who cannot read the line. The memo holds only the chunker's output (no learner data); the submit path uses the same memoised `chunkLine(textJp)` after its own checks.
- **P13 — the learner sees the original characters (owner 2026-10-21, after the Task 2 coverage report).** Normalisation (NFKC, whitespace removal) serves cutting and scoring only. Every chunk, hint unit and diff character shown to the learner is the matching slice of the raw `text_jp` (`…`, `？`, `！`, half-width kana stay as written), never the normalised form. The slice map is built per grapheme cluster: `normalizeJa(cluster)` for each cluster of `text_jp` must concatenate to `normalizeJa(text_jp)`; when it does not (a cross-cluster NFKC composition), the line falls back to showing the normalised chunks and the case is logged in the coverage report — never a wrong slice. Scoring, `chunk_snapshot` and `chunkOrder` stay on the normalised chunks. Also from the owner's decision: `"` joins the supported punctuation set (an UNKNOWN token made only of punctuation never blocks Word Bank, Task 2b), and the owner's open questions are closed: Latin/digits keep the Typing fallback; the revealed label stays "Answer shown" / "Đã xem đáp án".
- **P14 — contextual learning feedback (owner 2026-10-21).** Beyond the score and colours, the panel says in one or two short sentences what the learner's own action did, built by deterministic rules from the real attempt data (no AI call, no praise or claim the data does not prove), in EN and VI:
  - **Hint:** how many units are hinted so far and that hinted parts do not count toward recall; when every unit is hinted, that this attempt scores 0 for recall.
  - **Check, Word Bank:** own-correct / hinted / wrong counts out of the total; all own-correct with no hint → "You arranged the whole sentence yourself!" / "Bạn đã tự sắp xếp đúng toàn bộ câu!"; otherwise e.g. "You got 3/5 chunks right. Listen again and watch the order of the 2 chunks still wrong." / "Bạn đúng 3/5 cụm. Hãy nghe lại câu và chú ý thứ tự 2 cụm còn sai."
  - **Check, Typing:** wrong / missing / extra character counts and the expected characters that were wrong or missing (shown as raw slices, P13, at most 8, then "…"), plus "replay the sentence and listen for them"; a Kanji or Grammar remark only when that metric exists (§5.6) and is strictly below Recall; perfect with no hint → "Every character written from memory."
  - **Try again:** a neutral restart line that may state the previous attempt's score for this line and format in this visit — no praise. Pressing Try again proves nothing: "You fixed N chunk(s) since your last try" (Word Bank: slots wrong before and own-correct now) or "N fewer character errors than last try" (Typing) appears only after the learner **submits** the new attempt and the server returns its result, comparing two valid submitted results of the same line and format, and only when N > 0 (owner 2026-10-21).
  - **Show answer:** "This sentence is marked for review. This attempt has no score and doesn't count toward today's mission." / "Câu này được đánh dấu cần ôn lại. Lượt này không tính điểm và không tính vào nhiệm vụ."
  - While answering, feedback never contains the text of an unhinted unit, and nothing after Check names an answer the screen does not already show. The region is a polite live region. The floating Korume mascot / Companion stays hidden in Listening (spec §3); the only Korume in Listening is P15's small figure.
- **P15 — Korume beside the feedback (owner 2026-10-21).** After a **successful** Check or Show answer only, a small static Korume figure sits in the Live Feedback area, next to the P14 text. It is not shown while answering, submitting or waiting, and never as a popup, overlay, animation or separate card. Its expression follows the P14 outcome:
  - all own-correct with no hint → gentle joy (`happy.png`);
  - partial, or real progress between two submitted results → encouraging (`neutral.png`; no existing pose reads as "encouraging", so the owner's neutral fallback applies — the owner may swap it at the Chrome look);
  - Show answer → thinking, toward review (`thinking.png`);
  - any attempt with a hint never gets the joy pose.
  
  Korume says nothing of its own: no Companion line, no AI call, no change to Companion memory. Scores and error analysis belong to the practice system; Korume only accompanies. It disappears in the same commit that conceals the answer (Try again, line change, format change: it renders from `answerVisible` plus the current attempt's result, P11), and a late response from a stale attempt can never show it. Existing art only. At 1280×529 it must not push Check, Hint, Show answer or Next out of view; it shrinks or hides when space is short, and the text always stays.


## Review Focus

1. **Double Check / Enter twice** on one attempt: exactly one row is written, the button stays disabled until the response. → Task 6 (panel test counts `fetch` calls).
2. **Submit fails (network or 5xx)**: the arrangement or typed text survives, an error says so, Check works again; nothing is concealed or reset. → Task 6 (Word Bank), Task 7 (Typing), Task 9 E2E.
3. **Hint while a wrong chunk sits in the hinted slot**: the wrong chunk returns to the bank (never lost, never duplicated); the hinted chunk is locked in its slot. → Task 6.
4. **Arrow keys / Space while the Typing input has focus** type characters and never move the sentence or toggle play; Enter during IME composition never submits. → Task 7.
5. **A line whose chunks have identical texts** (`はい、はい。`): identical chunks are interchangeable when scoring; the bank may look solved and that is correct. → Task 3.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20261021000048_practice_listening.sql` (+ `.test.ts` pin) | columns, backfill, checks, trigger, index, privileges; the five read functions that need them (P3) | 1 |
| `supabase/migrations/20261004000043_lesson_summary.sql` (+ its `.test.ts`), `…045_port_dashboard.sql`, `…047_practice_pronunciation.sql` | moved definitions removed, pointer comments (P3) | 1 |
| `supabase/tests/practice-listening.sql`, `scripts/verify-listening-gate.ps1` | DB gate | 1 |
| `lib/dictation/chunk.ts` (+ test) | server-only chunker registry, memoised `chunkLine`, `lineTextHash`, `typingHintUnit`, `grammarRanges` | 2 |
| `lib/dictation/shuffle.ts` (+ test) | `bankOrder` | 2 |
| `scripts/dictation/chunk-coverage.ts` | coverage report | 2 |
| `lib/dictation/listening-score.ts` (+ test) | units, strip map, Word Bank / Typing scoring, metrics | 3 |
| `lib/validation/dictation.ts`, `lib/data/dictation.ts`, `app/api/dictation/attempt/route.ts` | submit / reveal | 4 |
| `lib/data/line-chunks.ts`, `app/api/lines/[lineId]/chunks/route.ts` | chunks API | 4 |
| `lib/data/practice-stats.ts`, `app/api/shadowing/[id]/practice-stats/route.ts` | per-format stats | 4 |
| `lib/dictation/display.ts` (+ test); `PUNCTUATION` + `"`; `LineChunks.display`, reveal `display` | original-character display (P13), `"` | 4b |
| `lib/dictation/listening-feedback.ts` (+ test) | contextual feedback rules (P14) | 6 |
| `components/shadowing-workspace/practice/listening-feedback-korume.tsx`, `components/mascot/mascot-poses.ts` | Korume beside the feedback (P15) | 7b |
| `lib/shadowing-workspace/learning-modes.ts` | `listeningFormat`, `practiceStatsMode` | 5 |
| `components/shadowing-workspace/practice/listening-reveal-context.tsx` | reveal state keyed by line + format + attempt (P11) | 5 |
| `components/shadowing-workspace/workspace-shell.tsx`, `workspace-player.tsx`, `practice/listen-cover.tsx`, `practice/practice-stats-context.tsx`, `practice/lesson-stat-strip.tsx`, `practice/sentence-navigator.tsx` | Listening-aware shell | 5 |
| `components/shadowing-workspace/practice/use-listening-attempt.ts`, `listening-mode-body.tsx`, `word-bank-panel.tsx`, `listening-feedback.tsx`, `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/listening/page.tsx` | the mode, Word Bank, D9 fallback | 6 |
| `components/shadowing-workspace/practice/typing-panel.tsx`, `listening-format-switch.tsx` | Typing, format switch | 7 |
| `lib/summary/*`, `components/lesson-summary/*`, `lib/data/dashboard/{mission,facts}.ts`, `messages/*/{shadowing,dashboard}.json` | Summary, Dashboard, Mission | 8 |
| `next.config.mjs`, `lib/product/screen-registry.ts`, `tests/e2e/typography/routes.ts`, `tests/e2e/practice-listening.spec.ts`, deleted legacy files | mode on, E2E, legacy retired | 9 |

---

### Task 1: Migration 048 — proven on disposable databases, then the owner's DB upgraded once

**Files:**
- Create: `supabase/migrations/20261021000048_practice_listening.sql`, `supabase/migrations/20261021000048_practice_listening.test.ts` (the text pins of `20261004000043_lesson_summary.test.ts` for `lesson_summary_evidence` move here)
- Modify: `supabase/migrations/20261004000043_lesson_summary.sql` (+ `.test.ts`), `supabase/migrations/20261008000045_port_dashboard.sql`, `supabase/migrations/20261015000047_practice_pronunciation.sql` — remove the moved definitions with their `revoke`/`grant`, leave `-- <name>: defined in 20261021000048_practice_listening.sql (it reads B2 columns).`
- Create: `supabase/tests/practice-listening.sql`, `scripts/verify-listening-gate.ps1`; Modify: `package.json` (`"verify:db:listening": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-listening-gate.ps1"`)
- Modify: `supabase/tests/lesson-summary.sql`, `supabase/tests/port-dashboard.sql`, `supabase/tests/practice-pronunciation.sql` where they insert `dictation_attempts` (now with `format`/`status`, as `postgres`) or assert the old evidence shape
- Check first (L-023): `grep -rn "lesson_summary_evidence\|weekly_skill_windows\|weakness_scores\|practice_activity\|practice_stats" supabase lib scripts` — every hit outside `supabase/tests` and the TS callers is a pin that moves with its definition.

**Interfaces:**
- Produces (SQL): `dictation_attempts` columns `format`, `status`, `hint_unit`, `hinted_units`, `chunk_order`, `chunker_version`, `chunk_snapshot` (spec §5.3). All read functions below: `security invoker`, granted `authenticated`, signatures unchanged.
  - `practice_stats(p_video uuid, p_mode text, p_review_below numeric) returns jsonb` accepts `pronunciation | word_bank | typing`; pronunciation behaviour byte-identical; for a Listening format `lines[].state ∈ scored | needs_review | revealed | unscored`, `score` = latest `submitted` in that format (R1), state from the latest attempt of any status in that format (R2); any other mode raises `22023`.
  - `lesson_summary_evidence(p_video uuid, p_mastery int) returns jsonb` — `dictationMean` is replaced by `wordBankMean` and `typingMean` (mean over lines of each line's latest `submitted` attempt in that format, R1); each `lines[]` entry loses `dictation`/`dictationInput` and gains `listening: [{ format, status, score, input }]` = the latest attempt of **any** status per format (R2); a line is kept when it has any listening attempt (plus the existing conditions).
  - `weekly_skill_windows`, `weakness_scores`: the listening evidence reads `format = 'typing' and status = 'submitted'` only (D20).
  - `practice_activity`: `dictation_lines` = `count(distinct transcript_line_id)` over rows with `status = 'submitted'` (both formats; P9); `last_at` / `last_video_id` over the same rows.
- Produces (tooling): `scripts/verify-listening-gate.ps1 [-Database <name>]` (default `postgres`), so the same gate runs against a disposable database.

**Where each step runs:** steps 0 and 9–10 touch the owner's DB (read-only in steps 0 and 3's copy/diff; one `migration up` and self-cleaning gates in 9–10). Steps 3–8 run only on disposable databases (D0 drift replay, D1 copy of the owner's DB, D2 fresh replay), all dropped at the end of the step that uses them.

- [ ] **Step 0: Owner's DB — read-only baseline** (Docker + `npx supabase start` running; spec §9 migration gate). Confirm `select max(version) from supabase_migrations.schema_migrations` is `20261015000047`, then save to `.superpowers/sdd/2026-10-21-practice-listening/`:
  - `legacy-count.txt`: `select count(*), count(*) filter (where accuracy_score is null) from dictation_attempts` (B1 measured `107|0` on 2026-10-17);
  - `legacy-before.txt`: `select id, user_id, transcript_line_id, accuracy_score, user_input, created_at from dictation_attempts order by id`;
  - `functions-before.txt`: for each user who owns legacy rows, `lesson_summary_evidence` (for each of their lessons), `weekly_skill_windows`, `weakness_scores`, `practice_activity` called with that user's `request.jwt.claims` inside `begin … rollback` — the listening numbers each consumer returns today.
  Nothing in this step writes to the owner's DB. Every file holding learner data stays in the git-ignored `.superpowers/` workspace (`.gitignore:61`) and is never committed.

- [ ] **Step 1: Write the failing DB test** `supabase/tests/practice-listening.sql` in the harness style of `supabase/tests/practice-pronunciation.sql` (fixed uuids, prefix `listengate-`, `set local role` + `request.jwt.claims`, `raise exception 'FAIL n'` / `raise notice 'PASS n'`, cleanup on the way in and out — L-017). Fixture: users A, B; one lesson, lines l1–l3; attempt rows inserted as `postgres` with explicit `format`/`status` (the backfill rule is checked on a temp copy in case 2). Cases:
  1. **Privileges (D25):** as `authenticated` A, `insert into dictation_attempts (user_id, user_input, accuracy_score, format, status) values (A, 'x', 50, 'typing', 'submitted')` raises `insufficient_privilege` (PASS 1a); `update … set accuracy_score = 100` raises (PASS 1b); A's `select count(*)` sees only A's rows.
  2. **Backfill rule:** the migration's backfill `update`, run against a `create temp table … (like dictation_attempts)` copy holding one scored and one unscored legacy row → `('typing','submitted')` and `('typing','unscored')`.
  3. **Checks:** (postgres) `status = 'submitted'` with null score → `check_violation`; `status = 'revealed'` with a score → `check_violation`; `format = 'word_bank', status = 'submitted', chunk_order null` → `check_violation`; `format = 'word_bank', status = 'revealed', chunk_order null` → allowed.
  4. **`unscored` trigger:** insert `status = 'unscored'` → raises; update a `submitted` row to `unscored` → raises; a legacy `unscored` row still reads and can be updated in another column (`user_input`).
  5. **`practice_stats` per format** as A, `p_review_below = 80`, fixture: l1 typing submitted 95 (older) then typing revealed (newer); l2 typing submitted 70; l2 word_bank submitted 90 with `chunk_order '{1,0}'`; l3 typing legacy `unscored`. `typing` → `scoredLines = 2`, `mean = 82.5`, l1 `{revealed, 95}`, l2 `{needs_review, 70}`, l3 `{unscored, null}`. `word_bank` → `scoredLines = 1`, `mean = 90`, l2 `{scored, 90}`. B's rows never appear. `'listening'` raises `22023`.
  6. **`lesson_summary_evidence`** as A: `typingMean = 82.5`, `wordBankMean = 90`; l1 `listening` contains `{format: typing, status: revealed, score: null}`; l2 contains both formats; key `dictationMean` absent.
  7. **Dashboard:** `weekly_skill_windows` and `weakness_scores` count only typing `submitted` rows for listening (the word_bank 90 and the revealed row are absent).
  8. **Mission:** `practice_activity(now() - interval '7 days')` → `dictation_lines` outcomes = **2** (l1, l2 submitted; revealed and unscored rows do not count; l2's two formats count once).
  9. **Grants:** for all five functions `has_function_privilege('anon', …)` false and `('authenticated', …)` true.
  Update the existing gates' fixtures and expectations to the new shape (`lesson-summary.sql`: re-derive each expected value from its fixture rows; `port-dashboard.sql`: give its `dictation_attempts` inserts `format = 'typing', status = 'submitted'`).

- [ ] **Step 2: Gate script** `scripts/verify-listening-gate.ps1` — copy `scripts/verify-practice-gate.ps1`, point it at `supabase/tests/practice-listening.sql`, add the `-Database` parameter passed to `psql -d`.

- [ ] **Step 3: Disposable database D1 = a copy of the owner's DB as it is — then RED.** Same version 047 does not mean the same schema (043 and 045 were edited after they were applied), so D1 is **copied from the owner's DB**, not replayed from migration files (owner 2026-10-21):
  1. `create database listening_t1_d1 template template0` in the same local container. Copy the owner's DB into it with a read-only `pg_dump` of the owner's DB piped straight into `psql -d listening_t1_d1` inside the container (no dump file on disk): the `public` schema in full (schema, data, grants, policies, triggers, functions) and the Supabase platform pieces it depends on (the `auth` schema with `auth.users`, `storage`, the extensions in use; B1's `task-1-report.md` item 7 shows which platform objects the product needs). Restore with constraints on, so a missing parent row fails the copy instead of being dropped.
  2. **Representativeness gate (must pass before anything else on D1):**
     - **Schema:** `pg_dump --schema-only --schema=public` of the owner's DB and of D1, normalised (database name stripped), diff → empty; plus `has_function_privilege` / `has_table_privilege` for `anon`, `authenticated`, `service_role` on `dictation_attempts`, `shadowing_sessions`, `transcript_lines`, `transcripts`, `videos`, `users`, `user_video_progress`, `sentence_marks`, `sentence_mining_cards`, `learning_outcomes` and the five moved functions → identical in both. Any difference is listed; one that touches a B2 object, its grants, policies, triggers or the five functions stops the task (UNMET).
     - **Data:** per-table row counts equal for every `public` table and `auth.users`; every foreign key of `dictation_attempts` (and of the tables it references) holds in D1 (`select` of orphans per FK → 0, and no constraint was skipped during restore); the Step 0 queries run on D1 give results identical to `legacy-before.txt` and `functions-before.txt`.
  3. **Drift report (information for the owner, B2-relevant drift stops the task):** replay `001 … 047` from **master** (`git show master:supabase/migrations/<file>`) into a third disposable database D0 the way B1 did (template0 + platform bootstrap), dump its `public` schema and diff it with the owner's. Record every difference in the run state; drop D0. A difference in a B2 object means fresh replay and the owner's DB disagree before B2 starts — stop and report it.
  4. Run `scripts/verify-listening-gate.ps1 -Database listening_t1_d1` → **FAIL at case 1** (columns missing). Write 048 only after this RED.
  If D1 cannot be copied faithfully, or either gate in 2 is not green, record **UNMET** and stop before 048 is applied anywhere that matters (Step 8).

- [ ] **Step 4: Write 048 in full** — table part first, then the five moved functions:

```sql
-- Practice modes B2: Listening (spec docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md §5.3, §6.2, §7, §7.1).
-- The read functions below live here, not in 043/045/047: their bodies read columns this file adds (plan P3).
alter table dictation_attempts
  add column format text check (format in ('word_bank', 'typing')),
  add column status text check (status in ('submitted', 'revealed', 'unscored')),
  add column hint_unit text check (hint_unit in ('chunk', 'grapheme4')),
  add column hinted_units int[] not null default '{}',
  add column chunk_order int[],
  add column chunker_version smallint,
  add column chunk_snapshot text[];

-- D21: every legacy attempt was typed; a scored one was submitted, an unscored one is legacy-only.
update dictation_attempts
   set format = 'typing', status = case when accuracy_score is null then 'unscored' else 'submitted' end;

alter table dictation_attempts
  alter column format set not null,
  alter column status set not null,
  -- submitted ⇔ scored; so revealed (and legacy unscored) carry no score.
  add constraint dictation_attempts_score_status check ((status = 'submitted') = (accuracy_score is not null)),
  add constraint dictation_attempts_word_bank_order check (format <> 'word_bank' or chunk_order is not null or status = 'revealed');

-- §5.3: a CHECK cannot tell an old row from a new one; only legacy rows may be (or stay) unscored.
create function dictation_attempts_no_new_unscored() returns trigger
  language plpgsql set search_path = public
as $$
begin
  if new.status = 'unscored' and (tg_op = 'INSERT' or old.status is distinct from 'unscored') then
    raise exception 'dictation_attempts: unscored is legacy-only' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger dictation_attempts_no_new_unscored before insert or update on dictation_attempts
  for each row execute function dictation_attempts_no_new_unscored();

create index idx_dictation_line_format on dictation_attempts (user_id, transcript_line_id, format, created_at desc);

-- D25: learners read their rows (RLS dictation_own) but only the server writes them.
revoke insert, update on dictation_attempts from authenticated, anon;
```

Then cut each of the five definitions (with `revoke`/`grant`) from its old file, paste it here as `create or replace function`, and apply the Interfaces changes; everything not named there stays byte-identical. For `practice_stats` keep the pronunciation branch and add, for `word_bank | typing`:

```sql
attempts as (
  select d.transcript_line_id as line_id, d.status, d.accuracy_score, d.created_at, d.id
  from dictation_attempts d
  where d.user_id = auth.uid() and d.format = p_mode and d.transcript_line_id in (select id from lines)
), latest_scored as (
  select distinct on (line_id) line_id, accuracy_score as score
  from attempts where status = 'submitted' order by line_id, created_at desc, id desc
), latest_any as (
  select distinct on (line_id) line_id, status from attempts order by line_id, created_at desc, id desc
)
-- state: case a.status when 'revealed' then 'revealed' when 'unscored' then 'unscored'
--        else (case when ls.score < p_review_below then 'needs_review' else 'scored' end) end
```

- [ ] **Step 5: D1 — upgrade path GREEN.** Apply 048 to D1 (the copy of the owner's DB) with the same command shape `migration up` uses (a single transaction of the file): exit 0. Run against D1: the listening gate and the existing practice, summary, dashboard, erasure and profile SQL gates (each `.sql` piped with `psql -d listening_t1_d1`, as B1 did) → all PASS. Compatibility on D1: `legacy-before` query → same `id, accuracy_score, user_input`; every row `format = 'typing'`, `status` per D21; the Step 0 function calls → the same listening numbers as `functions-before.txt` (any difference is reported with its cause before going on).

- [ ] **Step 6: D1 — mutations RED, then restored GREEN.** On D1 only, `create or replace` a mutated definition, run the listening gate, restore the canonical text from 048, rerun:
  - trigger without `tg_op = 'INSERT' or` → case 4 RED;
  - `practice_activity` without `and status = 'submitted'` → case 8 RED (3 outcomes);
  - `practice_stats` reading `latest_any` for the score instead of `latest_scored` → case 5 RED.
  Each must be RED; a mutation that stays green is replaced and both are recorded. Logs to the SDD workspace. Drop D1.

- [ ] **Step 7: Disposable database D2 — fresh replay GREEN.** New `listening_t1_d2`, same bootstrap, apply the **branch's** full chain `001 … 048` in order: exit 0 (this proves 043/045/047 no longer need the moved functions and 048 creates them). Run the listening, practice, summary, dashboard, erasure and profile gates against D2 → all PASS. Drop D2 and confirm both catalogs are gone.

- [ ] **Step 8: Stop point.** If D0, D1 or D2 could not be built, if the representativeness gate or the drift report found a B2-relevant difference, or if any gate above is not green, stop: report the gate as UNMET to the owner (L-050). Nothing touches the owner's DB.

- [ ] **Step 9: Owner's DB — upgrade once.** `npx supabase migration up` (applies only 048). No `psql` hand-apply, no mutation, no reset.

- [ ] **Step 10: Owner's DB — compatibility gates.** Re-run the Step 0 read-only queries into `legacy-after.txt` / `functions-after.txt` and diff against the before files: no legacy row changed (`id, user_id, transcript_line_id, accuracy_score, user_input, created_at` identical; `format = 'typing'`, `status` per D21), the listening numbers unchanged. Then the self-cleaning gates (`npm run verify:db:listening; npm run verify:db:practice; npm run verify:db:summary; npm run verify:db:dashboard; npm run verify:db:erasure; npm run verify:db:profile`; fixtures use their own prefixes and clean up on the way in and out) → all exit 0. Record every output in the run state.

- [ ] **Step 11: `npx vitest run --minWorkers=1 --maxWorkers=2 supabase/migrations` (the moved pins) and commit**

```bash
git add supabase/migrations supabase/tests scripts/verify-listening-gate.ps1 package.json
git commit -m "feat(db): listening formats, legacy-only unscored, score write privileges, per-format read functions"
```

---

### Task 2: Chunker v1, shuffle, coverage report

**Files:**
- Create: `lib/dictation/chunk.ts`, `lib/dictation/chunk.test.ts`, `lib/dictation/shuffle.ts`, `lib/dictation/shuffle.test.ts`, `scripts/dictation/chunk-coverage.ts`
- Modify: `package.json` (`"kuromoji": "0.1.2"` exact, spec §5.2; the installed version is 0.1.2 — the lockfile's resolved version must not change)

**Interfaces:**
- Produces (`lib/dictation/chunk.ts`, `import "server-only"`):
  - `type ChunkReason = "mismatch" | "unknown_token" | "latin_or_digit" | "single_chunk"`
  - `interface ChunkResult { version: number; reliable: boolean; reason: ChunkReason | null; chunks: string[] }` — `chunks` is `[]` when unreliable.
  - `const CURRENT_CHUNKER = 1`; `const CHUNKERS: Readonly<Record<number, (textJp: string) => Promise<ChunkResult>>>`
  - `chunkLine(textJp: string, version?: number): Promise<ChunkResult>` — `CHUNKERS[version ?? CURRENT_CHUNKER]` memoised per process by `version:lineTextHash(textJp)` (P12: callers must have read `textJp` under the learner's access first; the memo holds no learner data). `// ponytail: unbounded per-process memo, an LRU if line counts grow`.
  - `lineTextHash(textJp: string): string` (sha256 hex of the raw text, P7)
  - `typingHintUnit(result: ChunkResult): "chunk" | "grapheme4"` (`chunk` iff `reliable && chunks.length >= 2`)
  - `grammarRanges(textJp: string): Promise<{ start: number; end: number }[]>` — code-point ranges over `normalizeJa(textJp)` of tokens whose `pos` is `助詞` or `助動詞` (§5.6 Grammar).
- Produces (`lib/dictation/shuffle.ts`, client-safe): `bankOrder(n: number, seed: string): number[]`.

- [ ] **Step 1: Failing tests** (`chunk.test.ts` uses the real tokenizer, like `lib/japanese/tokenizer.test.ts`):
  - `今日は雨です。` → `["今日は", "雨です。"]`, reliable.
  - `毎日日本語を勉強しました。` → `["毎日", "日本語を", "勉強しました。"]` (compound noun kept; `ました` never split).
  - `注文をお願いします。` → `["注文を", "お願いします。"]` (prefix `お` binds forward).
  - `「はい」と言った。` → the opening `「` belongs to the chunk after it, every other punctuation to the chunk before it; `chunks.join("") === normalizeJa(line)`.
  - A sentence with > 8 raw chunks (e.g. `昨日私は友達と駅の近くの新しい店で美味しいラーメンをゆっくり食べました。`) → exactly 8 chunks, concatenation unchanged, and the first merge is a noun|noun or modifier|head boundary (assert the merged pair).
  - Unreliable: `ABCです` → `latin_or_digit`; `3時です` → `latin_or_digit`; `はい。` → `single_chunk`; a line with a token kuromoji marks `UNKNOWN` (find one with a probe and record which) → `unknown_token`; `chunks` is `[]` in each.
  - `chunkLine` on the same text twice → the chunker runs once; on edited text → runs again.
  - `lineTextHash("a") !== lineTextHash("b")`, 64 hex chars.
  - `shuffle.test.ts`: `bankOrder(5, "line-1")` is stable across calls and a permutation of 0..4; for 200 seeds with `n = 2` never the identity; `bankOrder(1, x)` is `[0]`; `bankOrder(0, x)` is `[]`.

- [ ] **Step 2: Run to verify they fail:** `npx vitest run --minWorkers=1 --maxWorkers=2 lib/dictation/chunk.test.ts lib/dictation/shuffle.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Implement `chunkV1`** over `base = normalizeJa(textJp)` with the raw kuromoji tokens from `getTokenizer()` (`lib/japanese/tokenizer.ts`; the shared `toToken` drops `word_type`, which the UNKNOWN rule needs):
  1. Reliability checks in order: surfaces concatenate to `base` (else `mismatch`); no `word_type === "UNKNOWN"` (else `unknown_token`); no `/[A-Za-z0-9]/` in `base` (else `latin_or_digit`).
  2. A token **starts** a chunk when it is the first token, or its `pos` is `名詞` (not after another `名詞`, and `pos_detail_1` not `接尾`/`非自立`), `動詞`/`形容詞` with `pos_detail_1 = 自立` (except `する` right after a `名詞` with `pos_detail_1 = サ変接続`), `副詞`, `連体詞`, `接続詞`, `感動詞`, `フィラー`, `接頭詞` — and the previous token is neither a `接頭詞` nor an opening bracket (`「『（(【`). Everything else (`助詞`, `助動詞`, `記号` except opening brackets, non-independent or suffix verbs/adjectives/nouns) attaches to the current chunk. An opening bracket starts the chunk of the token after it.
  3. More than 8 chunks: repeatedly merge the adjacent pair across the weakest boundary. Rank, weakest first: (1) noun|noun, (2) modifier|head — left chunk ends with `連体詞`, a `助詞` with `pos_detail_1 = 連体化`, or a `動詞`/`形容詞`, and the right chunk starts with `名詞`, (3) adverb|predicate — left ends with `副詞` or a `助詞` with `pos_detail_1 = 副詞化`, right starts with `動詞`/`形容詞`, (4) after a case particle (`pos_detail_1 = 格助詞`), (5) after `、`, (6) any other. Ties: the shorter merged pair (code points), then the leftmost.
  4. One chunk → `single_chunk`.
  `CHUNKERS = Object.freeze({ 1: chunkV1 })`, with a comment that a version is never edited. `bankOrder`: Fisher–Yates driven by a seeded PRNG (FNV-1a of `seed` → mulberry32); identity with `n > 1` → rotate by one.

- [ ] **Step 4: Pass; `tsc`; `lint`.**

- [ ] **Step 5: Coverage report (spec §5.2 gate)** `scripts/dictation/chunk-coverage.ts` — reads every `transcript_lines.text_jp` from the local DB (read-only; service client from `.env.local`, as `scripts/seed-real-lesson.ts` does), runs `CHUNKERS[CURRENT_CHUNKER]`, prints total lines, Word Bank-usable share, fallback share per `ChunkReason` with 3 samples each, and the chunk-count histogram. Run `npx vite-node scripts/dictation/chunk-coverage.ts` and paste the output into the run state. **No rule is loosened in this task**; the report goes to the owner first.

- [ ] **Step 6: Mutation.** Remove the opening-bracket rule → the `「はい」と言った。` test RED; restore.

- [ ] **Step 7: Commit** — `feat(dictation): versioned bunsetsu chunker, seeded bank order, coverage report`.

---

### Task 3: Units and scoring

**Files:**
- Create: `lib/dictation/listening-score.ts`, `lib/dictation/listening-score.test.ts`
- Modify: `lib/dictation/index.ts` (export the new public names)

**Interfaces:**
- Consumes: `alignSequences` (`lib/dictation/align.ts`), `normalizeJa`, `DictationDiff`.
- Produces (pure, client-safe):
  - `type Range = { start: number; end: number }` (code-point indices into `base`, end exclusive)
  - `PUNCTUATION = /[。、！？「」『』（）…・!?()\s.,]/u` — the spec's set plus the NFKC forms `normalizeJa` produces
  - `stripPunctuation(base: string): { chars: string[]; map: number[] }` — `chars[i]` is the i-th kept code point, `map[i]` its index in `Array.from(base)`
  - `chunkUnits(chunks: string[]): Range[]`; `grapheme4Units(base: string): Range[]` (4 grapheme clusters each via `Intl.Segmenter("ja", { granularity: "grapheme" })`, the last unit may be shorter)
  - `type ListeningDiffOp = DictationDiff | { type: "hinted"; expected: string }`
  - `interface ListeningMetrics { recall: number; slots?: { correct: number; total: number }; kanji?: number; grammar?: number }`
  - `scoreWordBank(chunks: string[], order: number[], hinted: ReadonlySet<number>): { score: number; slots: { chunkIndex: number; correct: boolean; hinted: boolean }[]; metrics: ListeningMetrics }`
  - `scoreTyping(base: string, input: string, hintedRanges: Range[], grammar: Range[]): { score: number; diff: ListeningDiffOp[]; metrics: ListeningMetrics }`
  - Scores and metrics are 0–100 with one decimal (as `scoreDictation`).

- [ ] **Step 1: Failing tests** (`listening-score.test.ts`):
  - Word Bank: chunks `["今日は","雨です。"]`, order `[1,0]` → 0; `[0,1]` → 100; hinted `{0}` + `[0,1]` → 50 with slot 0 `hinted: true`; all hinted → 0; `metrics.slots = { correct: 2, total: 2 }` for `[0,1]`, no `kanji`/`grammar`.
  - Identical texts (Review Focus 5): chunks `["はい、","はい、","はい。"]`, order `[1,0,2]` → 100.
  - Typing: base `今日は雨です。`, input `今日は雨です` → 100 (punctuation ignored); `きょうは雨です` → recall < 100 with `missing`/`wrong` ops at the kanji positions; empty input → 0.
  - Mid-sentence hint at its own position: base `注文をお願いします。`, hinted range = chunk 1 (`お願いします。`), input `注文を` → 33.3 (3 of 9 stripped chars matched; the 6 hinted chars excluded and marked `hinted`, not `missing`).
  - Offset typing: same base, hinted chunk 0 (`注文を`), input `お願いします` → 66.7.
  - Fully hinted typing → 0.
  - `grapheme4Units("👨‍👩‍👧家族です")` never splits the family emoji (the first unit spans the emoji's code points + 3).
  - Kanji: base `今日は雨です。`, perfect input → `kanji = 100`; a line with no Han → `kanji` absent. Grammar from the given ranges; empty ranges → absent.
  - Empty stripped reference → 0 (guard, like `scoreDictation`).

- [ ] **Step 2: Run to verify they fail** → module missing.

- [ ] **Step 3: Implement.** Typing: `ref = stripPunctuation(base)`, `hyp = stripPunctuation(normalizeJa(input)).chars`; hinted ref indices = `{ i : some hinted range contains ref.map[i] }`; align `ref.chars` vs `hyp` with `alignSequences`; a hinted ref index becomes `{ type: "hinted", expected }` whatever its op; score = matched-and-not-hinted ÷ `ref.chars.length` × 100. Kanji/grammar = the same ratio over ref indices in `\p{Script=Han}` / inside a `grammar` range (via `map`); absent when the set is empty. Word Bank: slot `i` correct iff `chunks[order[i]] === chunks[i]`; score = correct and not hinted ÷ n × 100.

- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutation.** Score typing hints by input position instead of `ref.map` → the offset test RED; restore.
- [ ] **Step 6: Commit** — `feat(dictation): listening units, strip map, word bank and typing scoring`.

---

### Task 4: Chunks API, submit/reveal API, per-format stats API

**Files:**
- Create: `lib/data/line-chunks.ts` (+ test), `app/api/lines/[lineId]/chunks/route.ts` (+ test) — same `[lineId]` folder as `analysis` (P1)
- Modify: `lib/validation/dictation.ts`, `lib/data/dictation.ts`, `app/api/dictation/attempt/route.ts`, `lib/data/missions-prewrite.integration.test.ts` (and the route/data tests beside them)
- Modify: `lib/data/practice-stats.ts`, `app/api/shadowing/[id]/practice-stats/route.ts` (+ tests)

**Interfaces:**
- Consumes: Task 2 (`chunkLine`, `CHUNKERS`, `lineTextHash`, `typingHintUnit`, `grammarRanges`), Task 3 (`scoreWordBank`, `scoreTyping`, `chunkUnits`, `grapheme4Units`, `ListeningDiffOp`, `ListeningMetrics`).
- Produces:
  - `interface LineChunks { version: number; textHash: string; reliable: boolean; reason: ChunkReason | null; chunks: string[]; typingHintUnit: "chunk" | "grapheme4" }`
  - `GET /api/lines/[lineId]/chunks` → `200 { data: LineChunks }`, `401`, `404` (line not readable under the learner's RLS — same access as `/api/lines/[lineId]/analysis`), `400` bad uuid; `private, no-store`. `loadLineChunks(lineId): Promise<{ kind: "ok"; data: LineChunks } | { kind: "unauthorized" } | { kind: "not_found" }>` — per request: user → line read under RLS → `chunkLine(text_jp)` (P12).
  - `dictationAttemptSchema` = zod discriminated union of the four `.strict()` shapes in spec §5.4 (`kind`, `format`; `version` int ≥ 1; `textHash` 64 hex; `chunkOrder` int[] ≤ 8; `hintedUnits` int[] ≤ 200; `input` ≤ 2000).
  - `submitListeningAttempt(input): Promise<ListeningAttemptResult>` replacing `submitAttempt`:
    - `{ ok: true; data: ListeningSubmitData }` where `ListeningSubmitData = { kind: "submit"; score: number; slots?: ReturnType<typeof scoreWordBank>["slots"]; diff?: ListeningDiffOp[]; metrics: ListeningMetrics; answer: string }`, or `{ ok: true; data: { kind: "reveal"; answer: string; chunks: string[] } }`;
    - `{ ok: false; status: 400 | 401 }`, `{ ok: false; status: 409; error: "line_changed" | "chunker_version" }`, `{ ok: false; status: 429; retryAfter }`.
  - `loadPracticeStats(videoId, mode: "pronunciation" | "word_bank" | "typing")`; the stats route accepts the three modes; the Listening review cut is `REVIEW_DICTATION_BELOW`; `PracticeLineState` gains `"revealed"`.

- [ ] **Step 1: Failing tests.**
  - Chunks route: 400 bad id; 401 no user; 404 unreadable line; 200 shape with `private, no-store`; two calls → chunker run once.
  - **P12 cache safety:** prime the memo with learner A's successful read of line L; then (a) a request with no user → 401, (b) learner B whose RLS read of L returns no row → 404, and in both the response carries no chunks and the RLS read was attempted (a) not at all / (b) once — the memo is never consulted before the read succeeds.
  - Validation (spec §5.4 list): a non-permutation `chunkOrder`, a duplicate hint, an out-of-range hint, a Word Bank body carrying `hintUnit` (strict → 400), a Typing `hintUnit` that disagrees with the line, a `grapheme4` line's out-of-range index; each → 400 and **no insert** (assert the service client's `insert` was not called).
  - `textHash` mismatch → 409 `line_changed`; `version: 99` → 409 `chunker_version`; `format: "word_bank"` on an unreliable line → 400.
  - A line from another lesson (`videoId` mismatch) → 400 before any write (§7.1).
  - Submit Word Bank → service-client insert `{ user_id: <verified>, format: "word_bank", status: "submitted", accuracy_score, hint_unit: "chunk" | null, hinted_units, chunk_order, chunker_version, chunk_snapshot }`, then `recordActivity({ source: "dictation", parts: { lineId } })` and `claimActiveMission` (order `ensure → write → record → claim`, pinned by `missions-prewrite.integration.test.ts`).
  - Submit Typing → `user_input`, `hint_unit` = the server's unit (or null when no hints).
  - Reveal → insert `status: "revealed", accuracy_score: null`, **no** `recordActivity`, **no** `claimActiveMission`; response carries `answer`.
  - The user-scoped client never writes `dictation_attempts`.
  - Stats route: `mode=typing` passes `p_mode: "typing", p_review_below: 80`; `mode=listening` → 400; `state: "revealed"` parses.

- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Order in `submitListeningAttempt`: user → rate limit (`dictation:attempt:<user>`, 60/min) → line under RLS joined to `transcripts.video_id = videoId` → `textHash` → `chunkLine(text_jp, version)` (unknown version → 409) → hint unit (`chunk` for Word Bank; `typingHintUnit` for Typing, compared with the body's) → validate indices against the unit count (`chunks.length` or `grapheme4Units(base).length`) → `ensureDailyMission` → score → service-client insert → activity + claim for `submit` only. Typing hinted ranges = the hinted units' ranges; grammar ranges from `grammarRanges(text_jp)`. The route maps 409 to `{ error }` with status 409; every response `private, no-store`.
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutations.** (a) Move `recordActivity` above the `kind === "submit"` branch → the reveal test RED; (b) in `loadLineChunks`, look the memo up by `lineId` before the RLS read → the P12 test RED. Restore both.
- [ ] **Step 6: Commit** — `feat(api): line chunks, server-scored listening submit and reveal, per-format stats`.

---

### Task 4b: Original-character display and `"` (owner 2026-10-21, P13)

**Files:**
- Create: `lib/dictation/display.ts` (+ test), client-safe
- Modify: `lib/dictation/listening-score.ts` (`PUNCTUATION` gains `"`; Typing diff ops carry their reference index), `lib/dictation/chunk.ts` (`"` pairing), `lib/dictation/types.ts` (`LineChunks.display`), `lib/data/line-chunks.ts`, `lib/data/dictation.ts` (+ their tests), `scripts/dictation/chunk-coverage.ts`

**Interfaces:**
- Produces:
  - `displayMap(textJp: string): string[] | null` — one entry per code point of `normalizeJa(textJp)`: the raw text of the grapheme cluster it came from on the cluster's first base code point, `""` on the cluster's other base code points; `null` when the per-cluster normalisation does not concatenate to `normalizeJa(textJp)`.
  - `displayRange(map: string[] | null, base: string, range: Range): string` — the concatenated raw slice, or `Array.from(base).slice(range.start, range.end).join("")` when `map` is `null`.
  - `LineChunks.display: string[]` (same length and order as `chunks`); `ListeningRevealData.display: string[]`; every Typing `ListeningDiffOp` except `extra` gains `display: string` (the raw slice of its reference character); the client shows only these display strings, never `chunks` text.
- Consumes: `normalizeJa`, `chunkUnits`, `grapheme4Units`, `Intl.Segmenter("ja", { granularity: "grapheme" })`.

- [ ] **Step 1: Failing tests.**
  - `display.test.ts`: `お値段が…みたいな` → the map's display of the chunk `お値段が...みたいな時が` is `お値段が…みたいな時が`; `天気ですね？` → `？` (not `?`); half-width `ｶﾀｶﾅ` displays half-width; whitespace in `text_jp` (`" お店の性格 "っていうのを`) is absent from the display (normalisation removed it from the base) and nothing else is lost; a constructed cross-cluster composition case → `null` and `displayRange` falls back to the base slice; for every reliable line the concatenated display of all chunks equals `text_jp` with whitespace removed.
  - `chunk.test.ts` (probed by the controller 2026-10-21 with kuromoji 0.1.2: each `"` is its own UNKNOWN 名詞 token; today both lines are `unknown_token`): `"お店の性格"っていうのを` → `["\"お店の", "性格\"っていうのを"]` (odd `"` opens and binds forward, even `"` closes and binds back; 性格 starts its chunk after の by the existing rules); `彼は"はい"と言った` → `["彼は", "\"はい\"と", "言った"]`.
  - `listening-score.test.ts`: `"` is stripped from the Typing reference and input; a Typing diff op's `display` is the raw character (`ｶ` stays `ｶ`).
  - `line-chunks.test.ts` / `dictation.test.ts`: the chunks payload and the reveal payload carry `display` equal to the raw slices; the submit Typing diff ops carry `display`; nothing else in either payload changes (scoring, `chunk_snapshot`, `chunkOrder` stay normalised).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Build the map once per request from the `text_jp` the request just read (P12 order unchanged). The chunker edit is v1 in place (R17: no Word Bank attempt exists yet).
- [ ] **Step 4: Pass; `tsc`; `lint`; rerun the coverage script** and report usable N/603, the lines that changed, and every line whose display map is `null`.
- [ ] **Step 5: Mutations.** (a) Display the normalised chunk instead of the raw slice → the `…` / `？` display tests RED; (b) treat every `"` as an opener → the closing-quote test RED. Restore both.
- [ ] **Step 6: Commit** — `feat(dictation): show the original characters, quotes as punctuation (owner 2026-10-21)`.

---

### Task 5: Listening-aware shell: format, stats, reveal provider, subtitle gate, cover

**Files:**
- Modify: `lib/shadowing-workspace/learning-modes.ts` (+ test)
- Create: `components/shadowing-workspace/practice/listening-reveal-context.tsx` (+ test), `components/shadowing-workspace/practice/listen-cover.tsx`
- Modify: `components/shadowing-workspace/workspace-shell.tsx`, `workspace-player.tsx`, `practice/practice-stats-context.tsx`, `practice/lesson-stat-strip.tsx`, `practice/sentence-navigator.tsx` (+ their tests), `messages/{en,vi}/shadowing.json`

**Interfaces:**
- Produces:
  - `type ListeningFormat = "word_bank" | "typing"`; `listeningFormat(param: string | null): ListeningFormat` (anything but `"typing"` → `"word_bank"`); `type PracticeStatsMode = "pronunciation" | ListeningFormat`; `practiceStatsMode(mode: PracticeModeId, format: ListeningFormat): PracticeStatsMode | null` (`null` for Shadowing).
  - `ListeningRevealProvider({ lineId, format, children })` (P11) and `useListeningReveal(): { attempt: number; phase: "answering" | "checked" | "revealed"; answerVisible: boolean; videoVisible: boolean; markChecked(attempt: number): void; markRevealed(attempt: number): void; showVideo(attempt: number): void; newAttempt(): void }`. Key = `${lineId}|${format}`; a key change resets `{ phase: "answering", videoShown: false, attempt: attempt + 1 }` during render; stale-attempt calls are no-ops; `answerVisible` = stored key equals the current key and phase is `checked | revealed`.
  - `PracticeStatsProvider` takes `mode: PracticeStatsMode | null` (fetches when non-null).

- [ ] **Step 1: Failing tests.**
  - `learning-modes.test.ts`: `listeningFormat(null) === "word_bank"`, `("typing") === "typing"`, `("x") === "word_bank"`; `practiceStatsMode("listening", "typing") === "typing"`; `("shadowing", …) === null`.
  - `listening-reveal-context.test.tsx` — a probe child pushes `answerVisible` into an array on **every render**:
    - `markChecked(attempt)` for line A / Word Bank → visible; rerender with `format: "typing"` → no recorded render after the prop change has `true` (concealed from the first render, no effect flush needed); same for a line change A → B, and for B → A (returning never re-shows A's old answer);
    - `newAttempt()` from a click handler → concealed in that same commit;
    - `markChecked(staleAttempt)` after a key change → stays concealed;
    - `showVideo` follows the same rules for `videoVisible`.
  - `workspace-shell.test.tsx` at `/en/shadowing/<id>/listening`: in the **first render** (assert before effects flush, as B1's first-frame test does) there is no `workspace-subtitle`, no utility drawer slot, no Korume mascot, and the `listen-cover` is present; the CC toggle is on and still no subtitle. Pronunciation and Shadowing still show the drawer and subtitle (regression).
  - Cover: "Show video" lifts it (`aria-pressed`), changing line or format restores it; play, previous, next, rewind, speed and loop stay focusable and clickable with the cover on (the cover sits under the control bar and centre play button, and keeps the surface's click-to-toggle).
  - `lesson-stat-strip.test.tsx`: the strip's format label and the stats fetch both follow the URL — `?format=typing` → "Typing · Submitted x/N" and `mode=typing`; no `format` → "Word Bank · …" and `mode=word_bank`; changing the URL refetches (formats never averaged, P10).
  - `sentence-navigator.test.tsx`: `state: "revealed"` → accessible name "Sentence 3, answer shown", review tone (P4). **Done in Task 4 (`79ba1bca`, ruling R21)**; Task 5 only folds the duplicated review-tone class into one constant.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** In `WorkspaceLayout`: `const format = listeningFormat(useSearchParams().get("format"))`; pass `practiceStatsMode(mode, format)` to the stats provider; wrap the columns in `ListeningRevealProvider lineId={current line id} format={format}`; `drawerShown` and `korumeVisible` are false in Listening (the `k` shortcut goes with `korumeVisible`). In `WorkspacePlayer`: `const listening = practiceModeFromPath(usePathname()) === "listening"`; the subtitle renders when `subtitles && subtitle !== null && (!listening || answerVisible)`; render `<ListenCover />` above the iframe surface and below the control bar when `listening && !videoVisible`. Copy under `shadowing.workspace.practice.listening.*` (`cover.title` "Listen only" / "Chỉ nghe", `cover.show` "Show video" / "Hiện video", strip and navigator labels).
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutations.** (a) Reset the provider in a `useEffect` instead of during render → the "no recorded render is visible after a format change" test RED; (b) drop the stale-attempt guard → the stale `markChecked` test RED. Restore both.
- [ ] **Step 6: Commit** — `feat(workspace): listening conceals answers per line, format and attempt; listen-only cover; per-format strip`.

---

### Task 6: Listening mode body, Word Bank, feedback, D9 fallback

**Files:**
- Create: `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/listening/page.tsx`, `components/shadowing-workspace/practice/listening-mode-body.tsx`, `use-listening-attempt.ts`, `word-bank-panel.tsx`, `listening-feedback.tsx` (+ tests), `lib/dictation/listening-feedback.ts` (+ test, client-safe, P14), copy in `messages/{en,vi}/shadowing.json`

**Interfaces:**
- Consumes: Tasks 4 and 5; `PracticePanel`, `SentenceNavigator`, `usePlaybackController`, `useCurrentSentence`, `useLesson`, `useRouter`/`useSearchParams`, `bankOrder`, `usePracticeStats().refresh`.
- Produces: `useListeningAttempt(lineId: string | null, format: ListeningFormat)` returning `{ chunks: LineChunks | null; chunksStatus: "loading" | "ready" | "error"; submitting: boolean; hinted: number[]; result: ListeningSubmitData | null; answer: string | null; error: "network" | "line_changed" | "rate_limited" | null; inProgress: boolean; hint(): void; submit(payload): Promise<void>; reveal(): Promise<void>; tryAgain(): void }`. It captures `attempt` from `useListeningReveal()` when a request starts, calls `markChecked(attempt)` / `markRevealed(attempt)` when it resolves and drops a response whose attempt is stale; `tryAgain` calls `newAttempt()` in the click handler. It never writes reveal state from an effect (P11). `inProgress` (a placed chunk or typed text) is consumed by Task 7's format switch. It also returns `previous: { score: number; ownCorrect?: number; wrongSlots?: number[]; errorCount?: number } | null` — the last checked result for this `lineId|format` in this visit (kept in a ref map across Try again and line changes, never persisted), consumed by P14's retry rules.
- Produces (P14, `lib/dictation/listening-feedback.ts`, pure): `type FeedbackEvent = { kind: "hint"; unit: "chunk" | "grapheme4"; hinted: number; total: number } | { kind: "checked_word_bank"; slots: { correct: boolean; hinted: boolean }[]; previous: { wrongSlots: number[] } | null } | { kind: "checked_typing"; diff: ListeningDiffOp[]; metrics: ListeningMetrics; previous: { errorCount: number } | null } | { kind: "retry"; previousScore: number | null } | { kind: "revealed" }` and `listeningFeedback(event): { id: FeedbackId; values: Record<string, string | number> }[]` (one to three messages, rendered from `shadowing.workspace.practice.listening.feedback.<id>` with ICU plurals in EN and VI). It takes no answer text other than the diff's own `display` characters, so it cannot leak an unhinted unit.

- [ ] **Step 1: Failing tests** (`listening-feedback.test.ts`; `listening-mode-body.test.tsx`, `word-bank-panel.test.tsx`, fetch mocked):
  - **P14 rules** (`listening-feedback.test.ts`, exact ids and values):
    - hint 1 of 5 chunks → `hint_used { count: 1, unit: "chunk" }`; 5 of 5 → `hint_used` + `hint_all`;
    - Word Bank 5/5 own-correct, no hint → only `wb_perfect`; 3 own-correct + 2 wrong → `wb_partial { correct: 3, total: 5, wrong: 2 }` and no `wb_perfect`; 4 correct of which 1 hinted → `wb_partial { correct: 3, … }` + `wb_hinted { hinted: 1 }` (a hinted slot is never praised as own work);
    - Typing: 2 wrong + 1 missing + 0 extra → `ty_errors { wrong: 2, missing: 1, extra: 0, chars: "<display chars, in reference order>" }`; 10 misses → `chars` holds 8 then `…`; perfect without hint → `ty_perfect`; a perfect line with one hinted unit → not `ty_perfect`; `kanji` 50 with recall 80 → `ty_kanji { kanji: 50 }`; `kanji` absent → no kanji message; `grammar` ≥ recall → no grammar message;
    - retry with `previousScore: 60` → `retry { score: 60 }` and no praise id; `previousScore: null` → `retry_first`;
    - after a retry, Word Bank previous wrong slots `[1, 3]` and now slot 1 own-correct, slot 3 still wrong → `wb_fixed { fixed: 1 }`; nothing fixed → no `wb_fixed`; Typing `errorCount` 5 → 2 → `ty_fewer { fewer: 3 }`; 2 → 4 → no `ty_fewer`;
    - revealed → exactly `revealed`.
    - every message id has an EN and a VI string (a test walks the ids against both `messages/{en,vi}/shadowing.json`); the VI strings for `wb_perfect`, `wb_partial` and `revealed` are the owner's wording in P14.
  - **No leak while answering:** with a hint on chunk 0 of `今日は|雨です。`, the rendered feedback region contains no text of chunk 1 (assert on `textContent`); the region has `role="status"` and `aria-live="polite"`.
  - The bank shows chunks in `bankOrder(n, lineId)`; clicking a bank chip places it in the first empty slot; clicking a placed chip returns it; every chip is a keyboard-reachable button (Enter/Space); slots announce "Slot 2 of 4, empty" / "Slot 2 of 4, 雨です。".
  - Check is disabled until every slot is filled; it sends the strict Word Bank body (`chunkOrder`, `hintedUnits`, `version`, `textHash`; no `hintUnit`).
  - **Review Focus 1:** two fast Check clicks / Enter → one `fetch`.
  - **Review Focus 2:** `fetch` rejects → arrangement kept, error text shown, Check enabled again, still concealed.
  - **Review Focus 3:** a wrong chunk in slot 0, Hint → chunk 0 locked in slot 0 tagged "Hint", the wrong chunk back in the bank once.
  - Chips, slots and the revealed chunks show `display` strings (P13): a line with `…` shows `…`, never `...`.
  - After 200: coloured slots (correct / wrong / hinted), score + label (cuts `REVIEW_DICTATION_BELOW` / `STRONG_DICTATION_AT`), metrics Recall + Slots only, the P14 Word Bank message, the answer `text_jp`, the subtitle visible, stats `refresh()` called.
  - Try again after a checked attempt → the `retry` message with the previous score and no `wb_fixed` (pressing Try again proves nothing); the next **successful** Check with one slot fixed → `wb_fixed` shown; a failed Check after Try again → no `wb_fixed`; a Show answer after Try again is not a submitted result and never feeds `previous`; Show answer → the `revealed` message, no score, no `wb_*` message.
  - A response that arrives after the learner moved to the next line is dropped: the new line stays concealed and shows no result.
  - Show answer → `kind: "reveal"` with the hints so far; full answer shown; video stays covered; no score.
  - 409 `line_changed` → "This sentence changed, start again" and a fresh attempt after refetching chunks.
  - Try again → same bank order, empty slots, concealed, cover restored — in the click's own commit.
  - Next sentence → `controller.nextSentence()`; the new line starts concealed with empty slots.
  - **D9 fallback (P10):** URL without `format` (Word Bank) and chunks `reliable: false` → `router.replace` called once with `format=typing` (other params kept, `scroll: false`); until the URL changes the body renders neither bank nor input; after it changes, the Typing panel shows the notice and the stat strip / stats fetch use `typing`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Page = `export default function ListeningModePage() { return <ListeningModeBody />; }` (mirror the pronunciation page). The body reads `format` from the URL only (P10), reuses Pronunciation's empty-transcript branch and initial `seekToSentence` effect, and mounts the panel with `key={`${lineId}|${format}|${attempt}`}` (P11). The navigator is never disabled in Listening (an in-progress attempt is discarded on line change, D12). Feedback renders only fields that exist (§5.6).
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutations.** (a) Remove the `submitting` guard → the double-click test RED; (b) render the Typing panel locally on `reliable: false` without the URL replace → the fallback test (stats fetch must say `typing`) RED; (c) count hinted-correct slots as own-correct in `listeningFeedback` → the `wb_hinted` / no-praise test RED; (d) let the `wb_fixed` rule fire on `fixed = 0` → its test RED. Restore all.
- [ ] **Step 6: Commit** — `feat(listening): word bank mode with hints, show answer, contextual feedback and URL-synced typing fallback`.

---

### Task 7: Typing and the format switch

**Files:**
- Create: `components/shadowing-workspace/practice/typing-panel.tsx`, `listening-format-switch.tsx` (+ tests)
- Modify: `listening-mode-body.tsx`, copy

**Interfaces:**
- Consumes: `useListeningAttempt` (Task 6), `grapheme4Units`, `chunkUnits`, `normalizeJa`, `Dialog` (`components/ui/dialog`, as `unsaved-take-guard.tsx` uses it).
- Produces: `ListeningFormatSwitch({ format, inProgress, wordBankAvailable })` — a segmented control (`role="radiogroup"`) that changes only `?format=` (`router.replace`, other params kept, `scroll: false`); with `inProgress` it opens an in-app confirm ("Discard this attempt?") first; when `wordBankAvailable` is false (unreliable line) the Word Bank option is disabled with the D9 reason. Concealment on switch comes from the reveal key (P11), not from this component.

- [ ] **Step 1: Failing tests.**
  - The Typing body carries `hintUnit` = `chunks.typingHintUnit` and `input`; the hint line shows the next unit's text (chunk text, or 4 graphemes on a `grapheme4` line) above the input; a hint never edits the learner's text.
  - **Review Focus 4:** with focus in the input, ArrowLeft/ArrowRight/Space move the caret or type, and `controller.previousSentence/nextSentence/togglePlay` are not called; Enter with `isComposing: true` (and with `keyCode 229`) does not submit; Enter otherwise submits once.
  - Feedback after submit: coloured diff (match / wrong / missing / extra / hinted) drawn from the ops' `display` characters (P13), Recall, Kanji only when the line has kanji, Grammar only when it has particles/auxiliaries, and the P14 Typing messages (`ty_errors` with the wrong/missing characters, `ty_kanji`/`ty_grammar` only under their rules, `ty_perfect` only for a perfect unhinted attempt; after Try again, `ty_fewer` only when errors dropped).
  - Hint in Typing → the `hint_used` message with the grapheme4 or chunk unit wording; the hint line shows the unit's `display` text.
  - Format switch: nothing in progress → switches immediately; with typed text → confirm; Cancel keeps text and format; Confirm switches.
  - **Reveal does not cross formats:** checked Word Bank (answer and subtitle visible) → switch to Typing → the first render after the URL change shows no answer, no subtitle, an empty input, cover on; switching back to Word Bank shows empty slots, still concealed.
  - Unreliable line: the Word Bank option is disabled with the reason, and the notice is visible.
  - Review Focus 2 for Typing: a failed submit keeps the typed text.
- [ ] **Step 2–4: fail, implement, pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutations.** (a) Drop the `isComposing` check → the IME test RED; (b) render the diff from the normalised `expected` instead of `display` → the half-width / `？` display test RED. Restore both.
- [ ] **Step 6: Commit** — `feat(listening): typing format, IME-safe submit, format switch with confirm`.

---

### Task 7b: Korume beside the feedback (owner 2026-10-21, P15)

**Files:**
- Create: `components/shadowing-workspace/practice/listening-feedback-korume.tsx` (+ test)
- Modify: `components/mascot/mascot-poses.ts` (three entries: `listening-joy` → `happy.png`, `listening-encourage` → `neutral.png`, `listening-review` → `thinking.png`, sizes from the files), `listening-feedback.tsx`, `lib/dictation/listening-feedback.ts` (`feedbackMood(messages): "joy" | "encourage" | "review" | null`), `tests/e2e/practice-listening.spec.ts`

**Interfaces:**
- Consumes: P14's message ids; `useListeningReveal().answerVisible`; the attempt result of `useListeningAttempt`.
- Produces: `feedbackMood` — `joy` iff the messages contain `wb_perfect` or `ty_perfect`; `review` iff `revealed`; `encourage` for any other checked outcome; `null` before a successful Check or Show answer. `ListeningFeedbackKorume({ mood })` — decorative (`alt=""`, `aria-hidden`), inline beside the text, renders nothing for `null`.

- [ ] **Step 1: Failing tests.**
  - `listening-feedback.test.ts`: `feedbackMood` for perfect (joy), perfect-with-one-hint (encourage, never joy), partial (encourage), `wb_fixed` / `ty_fewer` (encourage), revealed (review), hint only while answering (null), error responses (null).
  - `listening-feedback-korume.test.tsx` inside the mode body, fetch mocked: no figure in the first render, while a Check is pending, or after a 4xx/5xx/network failure; joy after a perfect Check; review after Show answer; Try again / Next / format switch → the figure is gone in the same commit as the concealment (render-recorder probe, as Task 5); a response for a stale attempt resolving after Try again shows no figure; the figure has no accessible name and the P14 text is still read by the live region.
  - Layout at 1280×529 is checked in Chrome (Task 10), not in jsdom.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** The figure sits in the feedback row (flex, text first in DOM order); its size comes from a token-based clamp so it can shrink; a container query hides it when the panel is too short to keep Check / Hint / Show answer / Next in view.
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutations.** (a) Derive the mood from the score alone, ignoring hints → the perfect-with-hint test RED; (b) render the figure from the stored result without the `answerVisible` gate → the Try-again / stale-response test RED. Restore both.
- [ ] **Step 6: E2E additions** to `practice-listening.spec.ts` (run in Task 9): in cases 3, 4, 5 and 6, the figure is absent while answering and submitting, shows joy / encourage / encourage-with-hint (never joy) / review after the result, and disappears on Try again and Next. A delayed `POST` (route held, then Try again, then released) never shows the figure.
- [ ] **Step 7: Commit** — `feat(listening): korume beside the feedback, outcome-based and concealed with the answer`.

---

### Task 8: Summary, Dashboard and Mission

**Files:**
- Modify: `lib/summary/snapshot.ts`, `lib/summary/thresholds.ts`, `lib/summary/reflection/evidence.ts` (+ the prompt if it lists modes/reasons), `components/lesson-summary/lesson-status-card.tsx`, `components/lesson-summary/review-list.tsx`, every test fixture that builds `LessonStatus` / evidence lines (grep `listening:` and `dictationMean`; this list is a floor, L-013/L-023)
- Modify: `lib/data/dashboard/mission.ts`, `lib/data/dashboard/facts.ts` (+ tests), `messages/{en,vi}/{shadowing,dashboard}.json`

**Interfaces:**
- Consumes: Task 1's evidence shape.
- Produces: `lessonEvidenceSchema` with `wordBankMean`, `typingMean`, `lines[].listening: { format, status, score, input }[]`; `LessonStatus = { shadowing; pronunciation; listeningWordBank; listeningTyping; retention }`; `ReviewReason` gains `"revealed"`; `modeQuality` accepts `"listeningWordBank" | "listeningTyping"` (listening cuts).

- [ ] **Step 1: Failing tests.**
  - `snapshot.test.ts`: `typingMean 72.4` → `listeningTyping: { kind: "scored", score: 72 }`, `wordBankMean null` → `listeningWordBank: not_started`; a line whose latest typing attempt is `revealed` (older submitted 95) → reasons include `"revealed"` and no `"dictation"` from the 95 (spec §8: average keeps 95, line in Review); latest typing `submitted 70` with input → `"dictation"` + `focusSpan` from `mistakeSpan`; Word Bank `submitted 70` → `"dictation"`, `focusSpan` from grammar.
  - `lesson-status-card` renders five rows; "Listening · Word Bank" and "Listening · Typing" each carry their own value.
  - `review-list` labels `revealed` "Answer shown" / "Đã xem đáp án".
  - Reflection evidence carries both listening qualities; `isEmptyEvidence` still true for a fresh learner.
  - `mission.test.ts`: `dictation_lines` href `/shadowing/v1/listening`; `facts.test.ts`: listening weakness `practiceHref` `/shadowing/d5/listening?format=typing` (P9).
  - Messages: `dashboard.mission.item.dictation` EN "Practise listening to {target} sentence(s)" (ICU plural as today), VI "Luyện nghe {target} câu"; `dashboard.skills.listening` EN "Listening (Typing)", VI "Nghe (gõ chính tả)" (P5).
- [ ] **Step 2–4: fail, implement, pass; `tsc`; `lint`; then `npm run verify:db:summary; npm run verify:db:dashboard` (read paths only; fixtures self-clean).**
- [ ] **Step 5: Mutation.** Compute R2 from the latest **submitted** instead of the latest of any status → the "Typing 95 then Show answer" test RED; restore.
- [ ] **Step 6: Commit** — `feat(summary): listening per format, answer-shown review reason; dashboard typing-only listening`.

---

### Task 9: Switch the mode on, E2E, retire the legacy route

**Files:**
- Modify: `lib/shadowing-workspace/learning-modes.ts` (`listening.complete = true`, D24) + its test
- Create: `tests/e2e/practice-listening.spec.ts`
- Modify: `next.config.mjs`, `next.config.test.ts`, `tests/e2e/route-rename-redirects.spec.ts`, `lib/product/screen-registry.ts` (`dictation-in-shadowing` → route `/shadowing/[id]/listening`, name per the Figma frame map), `tests/e2e/typography/routes.ts` (`(focus) shadowing/[id]/listening` replaces the dictation row)
- Delete (only after the E2E is green **and** a grep finds no caller, D22): `app/[locale]/(protected)/(focus)/shadowing/[id]/dictation/page.tsx`, `components/video-player/dictation-view.tsx` + test; then the `dictation` messages namespace if nothing else reads it (`messages/{en,vi}/dictation.json`, `messages/en/dictation.pin.test.ts`, its entry in `lib/i18n/namespaces.ts` and `types/messages.d.ts`)

- [ ] **Step 1: E2E** `practice-listening.spec.ts` (fixtures as `practice-pronunciation.spec.ts`: `registerViaUi`, `installFakeYouTube`, `seedWorkspaceData`; serial). "Answer surface" below means any of: `workspace-subtitle`, the answer text in the panel, the Word Bank slot colouring, the Typing diff. "Never visible" is checked by a `MutationObserver` installed with `page.addInitScript` that records every time an answer surface is attached or made visible, read at the end of the case — not by a single snapshot.
  1. **One player instance across three modes** (spec §3.1 B2 gate): marker on `fake-yt`, Shadowing → Pronunciation → Listening (Word Bank) → Listening (Typing) → Shadowing; marker kept, `onReady` fired once.
  2. **Entering Listening conceals from the first frame:** from navigation start no answer surface is ever recorded, the cover is on, drawer and mascot are absent, CC on does not show a subtitle. Every player control works with the cover on (play, pause, next, previous, rewind 5 s, speed 0.75×, loop on/off), and "Show video" lifts the cover for that line only.
  3. **Word Bank, correct:** place all chunks in order → score 100, slots coloured correct, the `wb_perfect` message ("You arranged the whole sentence yourself!"), the subtitle appears for this line only; Next sentence → the observer records no answer surface for the new line, slots empty, cover back.
  4. **Word Bank, wrong + Try again:** swap two chunks → score < 100 with wrong slots coloured and the `wb_partial` counts matching the colouring; Try again → same bank order, empty slots, concealed, cover back, the `retry` message with the previous score; place correctly and Check → `wb_fixed` with 2.
  5. **Hint:** with a wrong chunk in slot 0, Hint → chunk 0 locked in slot 0 tagged "Hint", the wrong chunk back in the bank; complete and Check → the hinted slot counted as hinted, not correct.
  6. **Show answer (reveal):** one hint (the `hint_used` message, and the observer records no unhinted chunk text in the feedback region), then Show answer → full answer shown, the `revealed` message, no score, video still covered; reload → navigator chip "answer shown"; the stat strip average is unchanged; the Summary page lists the line under review with "Answer shown".
  7. **Typing:** `?format=typing`, type with one deliberate error → coloured diff, score < 100; Kanji/Grammar metrics present for a line that has them; a hint shows its unit above the input without editing it; ArrowLeft/ArrowRight/Space in the input do not move the sentence or start playback; Enter during an IME composition (dispatch `compositionstart` + keydown `isComposing`) does not submit.
  8. **Changing sentence mid-attempt:** chunks placed / text typed, then the navigator or Next → the new line is concealed and empty; returning to the first line shows a fresh, concealed attempt (no old answer).
  9. **Changing format:** with text typed → confirm; Cancel keeps text and format; Confirm → Word Bank, concealed. After a **checked** Word Bank attempt, switching to Typing records no answer surface on the Typing side and the stat strip / stats request say Typing; back to Word Bank → empty, concealed.
  10. **D9 fallback:** a seeded line the chunker marks unreliable (fixture line with Latin letters), opened with no `format` → the URL becomes `?format=typing`, the notice is visible, the Word Bank option is disabled with its reason, and the stat strip says Typing.
  11. **API failures:** route `POST /api/dictation/attempt` to fail (network abort, then 500) → the arrangement / typed text stays, an error is shown, nothing is revealed, Check works on retry; a 409 `line_changed` (route fulfilled with it) → the "sentence changed" message and a fresh attempt; `GET …/chunks` failing → an error with retry, no bank and no answer shown.
  12. **Legacy deep links (P2), both locales:** for `vi` and `en`, `GET /<locale>/shadowing/<id>/dictation` → 308 to `/<locale>/shadowing/<id>/listening?format=typing`; `/<locale>/videos/<id>/dictation` → one hop to the same; `/<locale>/shadowing/<id>/dictation?line=<lineId>` keeps `line` (and `format=typing`) and the workspace opens Typing on that line, concealed.
  13. **Mission:** the same line submitted in Word Bank and in Typing, plus a Show answer on another line → Dashboard mission `dictation_lines` progress counts 1 (spec §8; P9).
- [ ] **Step 2: Run** (L-017: free :3000 first, fresh build in this worktree): `npx playwright test tests/e2e/practice-listening.spec.ts tests/e2e/practice-pronunciation.spec.ts tests/e2e/shadowing-workspace.spec.ts tests/e2e/summary.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/route-rename-redirects.spec.ts` → all green, twice.
- [ ] **Step 3: E2E mutations** (each RED, then restored): (a) show the subtitle on `phase !== "answering"` without the key equality → case 9 RED; (b) drop the URL replace in the D9 fallback → case 10 RED; (c) point the `/shadowing/:id/dictation` rule at `/:locale/shadowing/:id/listening` without `?format=typing` → case 12 RED (the deep link would open Word Bank).
- [ ] **Step 4: Retire the route** (P2): the two `next.config.mjs` rules, `next.config.test.ts` now expects six rules with the new destinations, registry + typography rows; grep `rg -n "dictation-view|DictationView|/dictation\b" app components lib tests` with a positive control in the same invocation (L-019) → only the redirect rules and history remain; delete the files listed above; rerun Step 2 and `npx vitest run --reporter=dot`.
- [ ] **Step 5: `tsc`; `lint`; `npm run verify:protocol`.**
- [ ] **Step 6: Commit** (two commits: mode on + E2E; legacy retirement).

---

### Task 10: Gates, Chrome, review, owner look

- [ ] **Step 1: Gates after the last product edit** (L-044): `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run lint`; `npm run verify:protocol`; DB gates `listening, practice, summary, dashboard, erasure, profile, shadowing` (self-cleaning, read/write only their own prefixed fixtures); typography gate (G4) with the listening route; full Playwright on the owner's machine (dictionary imported) — only reds already listed in B1's run state may remain.
- [ ] **Step 2: Chrome** at 1280×529, 1440×900, 1920×1080 and nav collapsed: the document never scrolls; the P15 Korume figure never pushes Check / Hint / Show answer / Next out of view (record its size or that it hid at 1280×529); at 1280×529 the bank, slots and Check are visible without panel scroll for an 8-chunk line, or the panel scrolls on its own (record which); no subtitle frame on entering Listening, changing line or changing format; the cover keeps every control usable; type tokens only.
- [ ] **Step 3: Reviews.** `code-reviewer` per task during execution; whole-branch review from `git diff master...practice-listening`; the fix wave reviewed on its own (L-012).
- [ ] **Step 4: Owner look** on the real mode bar (mode enabled in-branch, D24) with screenshots en + vi, and the chunker coverage report (Task 2). Merge `--no-ff` only after the owner's Chrome check and approval; record lessons in `docs/lessons.md`.
