# Practice modes B2 — Listening Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Listening Practice (Word Bank + Typing) as the third mode of the Shadowing workspace, with server-owned scoring, honest per-format Summary/Dashboard/Mission data, learner-proof score rows, and the legacy `/dictation` route retired.

**Architecture:** The mode page lives at `(workspace)/listening`, so the one player instance survives. A server-only kuromoji chunker (versioned) cuts each line into ≤ 8 bunsetsu chunks; the server re-derives chunks, hint units and the score from the line itself on every submit and writes the row with the service-role client. A small shell-level reveal context lets the left column (subtitle overlay, listen-only cover) follow the right column's attempt state without a frame of leaked answer.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase (Postgres), kuromoji 0.1.2, zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` — B2 = §5, §6.2, B2 rows of §7–§9, plus §3.2/§3.5/§3.6 rows marked B2. Read it before any task. B1's plan and run state (`docs/superpowers/plans/2026-10-15-practice-pronunciation.md`, `docs/superpowers/run-state/practice-pronunciation.md`) are the model for gates and conventions.

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
- Build, serve and install only inside `.worktrees/practice-listening`; every shell command starts with `Set-Location C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\practice-listening` (the tool cwd defaults to the main checkout). Vitest: `npx vitest run --minWorkers=1 --maxWorkers=2 <files>`; full suite `npx vitest run --reporter=dot` (L-035).
- Every task that touches TypeScript ends with `npx tsc --noEmit` and `npm run lint` (L-029, L-018), not only the last one.
- Each fix or behaviour gets one mutation proving its test fails without it; keep `<file>.mutbak` beside the file, never `git checkout --` to restore.
- Never `npx supabase db reset` on the owner's DB (L-050: a fresh-chain gate needs a separate disposable DB, or is reported unmet).

## Plan-time rulings (decisions the spec leaves open or states differently from the repo)

- **P1 — chunks route path.** The existing dynamic segment is `app/api/lines/[lineId]/…`; Next forbids a sibling `[id]`. The spec's `GET /api/lines/[id]/chunks` is built at `app/api/lines/[lineId]/chunks/route.ts`.
- **P2 — legacy redirect lives in `next.config.mjs`.** The repo redirects retired routes there (`/sensei`, `/videos/:id/dictation`). Spec §5.10's "dictation/page.tsx becomes a permanent redirect" is built as a `permanent: true` rule `/:locale(vi|en)/shadowing/:id/dictation` → `/:locale/shadowing/:id/listening?format=typing`, the `/videos/:id/dictation` rule points straight at the same destination (one hop), and `dictation/page.tsx` is deleted with `DictationView` (Task 10). Same behaviour, one home, no page that exists only to redirect.
- **P3 — where the B2 SQL lives.** New columns, backfill, checks, trigger, index and the privilege change go in a new `supabase/migrations/20261021000048_practice_listening.sql` (B1's precedent: new objects in a new file). `practice_stats` is extended **in place** in 047 (it is `plpgsql`, so its body may name columns added by 048). `lesson_summary_evidence` (043) and `weekly_skill_windows`, `weakness_scores`, `practice_activity` (045) are `language sql`: Postgres validates their bodies at creation, so on a fresh chain they cannot name columns that 048 adds later. They therefore **move** to 048 (definition, `revoke`, `grant`), deleted from 043/045, leaving a one-line comment where each stood. One definition each, no `create or replace` duplicate — AGENTS §6's "one home" holds. Flag for the owner's plan review.
- **P4 — navigator state `revealed`.** §3.4 lists a separate "revealed" chip, §3.6 says revealed reads as needs-review. `practice_stats` returns `state: "revealed"` for Listening; the navigator shows it with the review tone and the label "Answer shown"; every review rule treats it as review (R2).
- **P5 — Dashboard copy.** The Dashboard has no Listening empty state today (only `skills.listening` labels in the weekly and weakness cards). D20's copy change lands on that label: EN "Listening (Typing)", VI "Nghe (gõ)". Flag for the owner.
- **P6 — Summary status rows.** `LessonStatus.listening` becomes `listeningWordBank` + `listeningTyping` (two labelled rows). Reflection evidence carries both qualities; its fingerprint moves, so each cached reflection regenerates once — accepted.
- **P7 — one base string.** Chunks, `grapheme4` units, kuromoji tokens and the Typing reference are all cut over `base = normalizeJa(text_jp)` (`lib/dictation/normalize.ts`). Displayed answers keep `text_jp`. `textHash = sha256(text_jp)` hex.
- **P8 — shuffle on the client.** `GET …/chunks` returns chunks in reference order; client and server share the pure `bankOrder(n, lineId)` (`lib/dictation/shuffle.ts`). The server never needs the bank order (it scores `chunkOrder` against reference order).
- **P9 — mission copy.** Word Bank now counts toward `dictation_lines`, so "Dictate N lines" becomes "Practise listening to N sentences" / "Luyện nghe N câu". Weakness `practiceHref` for listening goes to `/listening?format=typing` (Dashboard listening is Typing-only, D20).

## Review Focus

1. **Double Check / Enter twice** on one attempt: exactly one row is written, the button stays disabled until the response. → Task 7 (panel test counts `fetch` calls).
2. **Submit fails (network or 5xx)**: the arrangement or typed text survives, an error says so, Check works again; nothing is concealed or reset. → Task 7 (Word Bank) and Task 8 (Typing).
3. **Hint while a wrong chunk sits in the hinted slot**: the wrong chunk returns to the bank (never lost, never duplicated); the hinted chunk is locked in its slot. → Task 7.
4. **Arrow keys / Space while the Typing input has focus** type characters and never move the sentence or toggle play; Enter during IME composition never submits. → Task 8.
5. **A line whose chunks have identical texts** (`はい、はい。`): identical chunks are interchangeable when scoring; the bank may look solved and that is correct. → Task 4.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20261021000048_practice_listening.sql` | columns, backfill, checks, trigger, index, privileges; moved summary/dashboard/mission read functions | 1, 2 |
| `supabase/migrations/20261015000047_practice_pronunciation.sql` | `practice_stats` gains `word_bank` / `typing` | 1 |
| `supabase/migrations/20261004000043_lesson_summary.sql`, `…045_port_dashboard.sql` | definitions moved out (P3) | 2 |
| `supabase/tests/practice-listening.sql`, `scripts/verify-listening-gate.ps1` | DB gate | 1, 2 |
| `lib/dictation/chunk.ts` (+ test) | server-only chunker registry, `lineTextHash`, `typingHintUnit`, `grammarRanges` | 3 |
| `lib/dictation/shuffle.ts` (+ test) | `bankOrder` | 3 |
| `scripts/dictation/chunk-coverage.ts` | coverage report | 3 |
| `lib/dictation/listening-score.ts` (+ test) | units, strip map, Word Bank / Typing scoring, metrics | 4 |
| `lib/validation/dictation.ts`, `lib/data/dictation.ts`, `app/api/dictation/attempt/route.ts` | submit / reveal | 5 |
| `lib/data/line-chunks.ts`, `app/api/lines/[lineId]/chunks/route.ts` | chunks API | 5 |
| `lib/data/practice-stats.ts`, `app/api/shadowing/[id]/practice-stats/route.ts` | per-format stats | 5 |
| `lib/shadowing-workspace/learning-modes.ts` | `listeningFormat`, `practiceStatsMode` | 6 |
| `components/shadowing-workspace/practice/listening-reveal-context.tsx` | shared answering/checked/revealed + video shown | 6 |
| `components/shadowing-workspace/workspace-shell.tsx`, `workspace-player.tsx`, `practice/listen-cover.tsx`, `practice/practice-stats-context.tsx`, `practice/lesson-stat-strip.tsx`, `practice/sentence-navigator.tsx` | Listening-aware shell | 6 |
| `components/shadowing-workspace/practice/use-listening-attempt.ts`, `listening-mode-body.tsx`, `word-bank-panel.tsx`, `listening-feedback.tsx`, `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/listening/page.tsx` | the mode, Word Bank | 7 |
| `components/shadowing-workspace/practice/typing-panel.tsx`, `listening-format-switch.tsx` | Typing, format switch | 8 |
| `lib/summary/*`, `components/lesson-summary/*`, `lib/data/dashboard/{mission,facts}.ts`, `messages/*/{shadowing,dashboard}.json` | Summary, Dashboard, Mission | 9 |
| `next.config.mjs`, `lib/product/screen-registry.ts`, `tests/e2e/typography/routes.ts`, `tests/e2e/practice-listening.spec.ts`, deleted legacy files | mode on, E2E, legacy retired | 10 |

---

### Task 1: Listening columns, privileges, `practice_stats` per format, DB gate

**Files:**
- Create: `supabase/migrations/20261021000048_practice_listening.sql`
- Modify: `supabase/migrations/20261015000047_practice_pronunciation.sql` (`practice_stats` only)
- Create: `supabase/tests/practice-listening.sql`, `scripts/verify-listening-gate.ps1`
- Modify: `package.json` (`"verify:db:listening": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-listening-gate.ps1"`)
- Modify: any `supabase/tests/*.sql` that inserts `dictation_attempts` as `authenticated` (grep; `lesson-summary.sql:64` and `port-dashboard.sql:701` insert as the session role at that point — verify which, move to `postgres` where needed)

**Interfaces:**
- Produces (SQL): `dictation_attempts` columns `format`, `status`, `hint_unit`, `hinted_units`, `chunk_order`, `chunker_version`, `chunk_snapshot` (spec §5.3); `practice_stats(p_video uuid, p_mode text, p_review_below numeric) returns jsonb` now accepts `p_mode ∈ pronunciation | word_bank | typing`; for Listening `lines[].state ∈ scored | needs_review | revealed | unscored`, `score` = latest `submitted` of that format (R1), state from the latest attempt of any status in that format (R2).

- [ ] **Step 0: Legacy count before migrating** (owner's local DB, Docker + `npx supabase start` running; spec §9 migration gate):

```bash
docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -Atc "select count(*), count(*) filter (where accuracy_score is null) from dictation_attempts"
docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -Atc "select id, accuracy_score, user_input from dictation_attempts order by id" > .superpowers/sdd/2026-10-21-practice-listening/legacy-before.txt
```

Record the count line in the run state (B1 measured `107|0` on 2026-10-17).

- [ ] **Step 1: Write the failing DB test** `supabase/tests/practice-listening.sql` in the harness style of `supabase/tests/practice-pronunciation.sql` (fixed uuids, prefix `listengate-`, `set local role` + `request.jwt.claims`, `raise exception 'FAIL n'` / `raise notice 'PASS n'`, cleanup on the way in and out — L-017). Fixture: users A, B; one lesson, lines l1–l3; attempt rows inserted as `postgres` with explicit `format`/`status` (the backfill itself is checked on a temp copy in case 2). Cases:
  1. **Privileges (D25):** as `authenticated` A, `insert into dictation_attempts (user_id, user_input, accuracy_score, format, status) values (A, 'x', 50, 'typing', 'submitted')` raises `insufficient_privilege` (PASS 1a); `update … set accuracy_score = 100` raises (PASS 1b); A's `select count(*)` sees only A's rows.
  2. **Backfill rule:** run the migration's backfill `update` statement against a `create temp table … (like dictation_attempts)` copy holding one scored and one unscored legacy row → `('typing','submitted')` and `('typing','unscored')`.
  3. **Checks:** (postgres) `status = 'submitted'` with null score → `check_violation`; `status = 'revealed'` with a score → `check_violation`; `format = 'word_bank', status = 'submitted', chunk_order null` → `check_violation`; `format = 'word_bank', status = 'revealed', chunk_order null` → allowed.
  4. **`unscored` trigger:** insert `status = 'unscored'` → raises; update a `submitted` row to `unscored` → raises; a legacy `unscored` row still reads and can be updated in a column other than `status` (e.g. `user_input`).
  5. **`practice_stats` per format** as A, `p_review_below = 80`, fixture (postgres): l1 typing submitted 95 (older) then typing revealed (newer); l2 typing submitted 70; l2 word_bank submitted 90 with `chunk_order '{1,0}'`; l3 typing legacy `unscored`. `typing` → `scoredLines = 2` (l1, l2), `mean = 82.5`, l1 `{state: revealed, score: 95}`, l2 `{needs_review, 70}`, l3 `{unscored, null}`. `word_bank` → `scoredLines = 1`, `mean = 90`, l2 `{scored, 90}`. B's rows never appear. `practice_stats(…, 'listening', 80)` raises `22023`. `pronunciation` unchanged (rerun `npm run verify:db:practice`).
  6. **Grants:** `has_function_privilege('anon', 'practice_stats(uuid,text,numeric)', 'execute')` false.

- [ ] **Step 2: Gate script** `scripts/verify-listening-gate.ps1` — copy `scripts/verify-practice-gate.ps1`, point it at `supabase/tests/practice-listening.sql`.

- [ ] **Step 3: Run to verify it fails**

Run: `npm run verify:db:listening`
Expected: FAIL at case 1a (the columns do not exist yet, or `authenticated` can still insert).

- [ ] **Step 4: Write 048 (table part)**

```sql
-- Practice modes B2: Listening (spec docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md §5.3, §7, §7.1).
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

- [ ] **Step 5: Extend `practice_stats` in 047 in place.** Keep the pronunciation branch byte-identical; accept `word_bank | typing`; for them read

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
```

and `state = case a.status when 'revealed' then 'revealed' when 'unscored' then 'unscored' else (case when ls.score < p_review_below then 'needs_review' else 'scored' end) end`. Any other `p_mode` raises `22023`.

- [ ] **Step 6: Apply to the owner's DB and run the gates**

Run: `npx supabase migration up`, then `psql` the edited `create or replace function practice_stats …` from 047 (B1 ruling 2026-10-17: canonical in-place definitions are applied by hand, never by reset), then `npm run verify:db:listening; npm run verify:db:practice`
Expected: every `PASS n`, exit 0 both.

- [ ] **Step 7: Compatibility.** Re-dump the legacy rows to `legacy-after.txt` (same query as Step 0) and diff: no difference in `id, accuracy_score, user_input`. Fresh chain: run the full chain on a disposable DB (B1 run state, "isolated disposable DB") or record the fresh-reset gate as unmet (L-050).

- [ ] **Step 8: Mutation.** Drop the trigger's `tg_op = 'INSERT' or` clause in a `psql` `create or replace` → case 4 FAILS; restore from `048….sql.mutbak` text → PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261021000048_practice_listening.sql supabase/migrations/20261015000047_practice_pronunciation.sql supabase/tests/practice-listening.sql scripts/verify-listening-gate.ps1 package.json supabase/tests
git commit -m "feat(db): listening formats, legacy-only unscored, score write privileges, per-format practice stats"
```

---

### Task 2: Summary, Dashboard and Mission read functions per format

**Files:**
- Modify: `supabase/migrations/20261021000048_practice_listening.sql` (append the moved functions)
- Modify: `supabase/migrations/20261004000043_lesson_summary.sql`, `supabase/migrations/20261008000045_port_dashboard.sql` (remove the moved definitions + their `revoke`/`grant`; leave `-- lesson_summary_evidence: defined in 20261021000048_practice_listening.sql (needs its columns).`)
- Modify: `supabase/tests/practice-listening.sql`, `supabase/tests/lesson-summary.sql`, `supabase/tests/port-dashboard.sql`
- Check first: `grep -rn "lesson_summary_evidence\|weekly_skill_windows\|weakness_scores\|practice_activity" supabase/migrations/*.test.ts lib scripts` — any test that reads a migration file by name moves with the definition (L-023).

**Interfaces:**
- Produces (SQL, all `security invoker`, granted `authenticated`):
  - `lesson_summary_evidence(p_video uuid, p_mastery int) returns jsonb` — `dictationMean` is replaced by `wordBankMean` and `typingMean` (mean over lines of each line's latest `submitted` attempt in that format, R1); each `lines[]` entry loses `dictation`/`dictationInput` and gains `listening: [{ format, status, score, input }]` = the latest attempt of **any** status per format (R2; `score` = that attempt's `accuracy_score`, `input` = `user_input`); a line is kept when it has any listening attempt (plus the existing conditions).
  - `weekly_skill_windows`, `weakness_scores`: the listening evidence reads `format = 'typing' and status = 'submitted'` only (D20).
  - `practice_activity`: `dictation_lines` = `count(distinct transcript_line_id)` over rows with `status = 'submitted'` (both formats); `last_at` / `last_video_id` over the same rows.

- [ ] **Step 1: Failing tests.** Add to `practice-listening.sql`:
  7. `lesson_summary_evidence` as A (fixture of Task 1 case 5): `typingMean = 82.5`, `wordBankMean = 90`; l1 `listening` contains `{format: typing, status: revealed, score: null}`; l2 contains both formats; key `dictationMean` absent.
  8. `weekly_skill_windows` listening attempts = typing submitted rows only (the word_bank 90 and the revealed row are not counted); `weakness_scores` listening likewise.
  9. `practice_activity(now() - interval '7 days')`: `dictation_lines` outcomes = **2** (l1, l2 submitted; revealed and unscored rows do not count; l2's two formats count once).
  Update `supabase/tests/lesson-summary.sql`'s `dictationMean` / `dictation` / `dictationInput` assertions to the new shape, re-deriving each expected value from its fixture rows (insert its `dictation_attempts` fixtures with `format`/`status` as `postgres`).

- [ ] **Step 2: Run to verify they fail:** `npm run verify:db:listening` → FAIL at case 7.

- [ ] **Step 3: Move and change the four functions** (P3): cut each definition with its `revoke`/`grant` from 043/045, paste into 048 after the table part as `create or replace function` (so `migration up` replaces the owner's existing copy and a fresh chain creates it), then apply the Interfaces changes. Everything not named above stays byte-identical.

- [ ] **Step 4: Apply and run every gate that reads these tables**

Run: `psql` the new 048 function section into the owner's DB (048 is already applied there, so `migration up` will not rerun it); then `npm run verify:db:listening; npm run verify:db:summary; npm run verify:db:dashboard; npm run verify:db:practice; npm run verify:db:erasure; npm run verify:db:profile`
Expected: all exit 0.

- [ ] **Step 5: Mutation.** Remove `and status = 'submitted'` from `practice_activity` → case 9 FAILS (3 outcomes); restore → PASS.

- [ ] **Step 6: Commit** — `feat(db): summary, dashboard and mission read listening per format`.

---

### Task 3: Chunker v1, shuffle, coverage report

**Files:**
- Create: `lib/dictation/chunk.ts`, `lib/dictation/chunk.test.ts`, `lib/dictation/shuffle.ts`, `lib/dictation/shuffle.test.ts`, `scripts/dictation/chunk-coverage.ts`
- Modify: `package.json` (`"kuromoji": "0.1.2"` exact, spec §5.2; installed version is 0.1.2 — `npm install` must not change the lockfile's resolved version)

**Interfaces:**
- Produces (`lib/dictation/chunk.ts`, `import "server-only"`):
  - `type ChunkReason = "mismatch" | "unknown_token" | "latin_or_digit" | "single_chunk"`
  - `interface ChunkResult { version: number; reliable: boolean; reason: ChunkReason | null; chunks: string[] }` — `chunks` is `[]` when unreliable.
  - `const CURRENT_CHUNKER = 1`; `const CHUNKERS: Readonly<Record<number, (textJp: string) => Promise<ChunkResult>>>`
  - `lineTextHash(textJp: string): string` (sha256 hex of the raw text, P7)
  - `typingHintUnit(result: ChunkResult): "chunk" | "grapheme4"` (`chunk` iff `reliable && chunks.length >= 2`)
  - `grammarRanges(textJp: string): Promise<{ start: number; end: number }[]>` — code-point ranges over `normalizeJa(textJp)` of tokens whose `pos` is `助詞` or `助動詞` (for §5.6 Grammar).
- Produces (`lib/dictation/shuffle.ts`, client-safe): `bankOrder(n: number, seed: string): number[]`.

- [ ] **Step 1: Failing tests** (`chunk.test.ts` uses the real tokenizer, like `lib/japanese/tokenizer.test.ts`):
  - `今日は雨です。` → `["今日は", "雨です。"]`, reliable.
  - `毎日日本語を勉強しました。` → `["毎日", "日本語を", "勉強しました。"]` (compound noun kept, `勉強`+`し`+`まし`+`た` one chunk, `ました` never split).
  - `注文をお願いします。` → `["注文を", "お願いします。"]` (prefix `お` binds forward).
  - `「はい」と言った。` → the opening `「` belongs to the chunk after it, every other punctuation to the chunk before it; `chunks.join("") === normalizeJa(line)`.
  - A sentence that yields > 8 raw chunks (write one with 10+ bunsetsu, e.g. `昨日私は友達と駅の近くの新しい店で美味しいラーメンをゆっくり食べました。`) → exactly 8 chunks, concatenation unchanged, and the first merge is a noun|noun or modifier|head boundary (assert the merged pair).
  - Unreliable: `ABCです` → `latin_or_digit`; `3時です` → `latin_or_digit`; `はい。` → `single_chunk`; a line with a token kuromoji marks `UNKNOWN` (find one with a test probe, e.g. a rare emoji-free symbol run, and record which) → `unknown_token`; `chunks` is `[]` in each.
  - `CHUNKERS[1]` is the same function across calls; `lineTextHash("a") !== lineTextHash("b")`, 64 hex chars.
  - `shuffle.test.ts`: `bankOrder(5, "line-1")` equals itself across calls and is a permutation of 0..4; for 200 seeds `n = 2`, never the identity; `bankOrder(1, x)` is `[0]`; `bankOrder(0, x)` is `[]`.

- [ ] **Step 2: Run to verify they fail:** `npx vitest run --minWorkers=1 --maxWorkers=2 lib/dictation/chunk.test.ts lib/dictation/shuffle.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Implement `chunkV1`** over `base = normalizeJa(textJp)` with the raw kuromoji tokens from `getTokenizer()` (`lib/japanese/tokenizer.ts` — the shared `toToken` drops `word_type`, which the UNKNOWN rule needs):
  1. Reliability checks in order: surfaces concatenate to `base` (else `mismatch`); no `word_type === "UNKNOWN"` (else `unknown_token`); `/[A-Za-z0-9]/` not in `base` (else `latin_or_digit`).
  2. A token **starts** a chunk when it is the first token, or its `pos` is `名詞` (not after another `名詞`, and `pos_detail_1` not `接尾`/`非自立`), `動詞`/`形容詞` with `pos_detail_1 = 自立` (except `する` right after a `名詞` with `pos_detail_1 = サ変接続`), `副詞`, `連体詞`, `接続詞`, `感動詞`, `フィラー`, `接頭詞` — and the previous token is not a `接頭詞` and not an opening bracket (`「『（(【`). Everything else (`助詞`, `助動詞`, `記号` except opening brackets, non-independent or suffix verbs/adjectives/nouns) attaches to the current chunk. An opening bracket starts the chunk of the token after it.
  3. More than 8 chunks: repeatedly merge the adjacent pair across the weakest boundary. Rank, weakest first: (1) noun|noun, (2) modifier|head — left chunk ends with `連体詞`, a `助詞` with `pos_detail_1 = 連体化`, or a `動詞`/`形容詞`, and the right chunk starts with `名詞`, (3) adverb|predicate — left ends with `副詞` or a `助詞` with `pos_detail_1 = 副詞化`, right starts with `動詞`/`形容詞`, (4) after a case particle (`pos_detail_1 = 格助詞`), (5) after `、`, (6) any other. Ties: the shorter merged pair (code points), then the leftmost.
  4. One chunk → `single_chunk`.
  `CHUNKERS = Object.freeze({ 1: chunkV1 })`; a version is never edited (comment says so). `bankOrder`: Fisher–Yates driven by a small seeded PRNG (FNV-1a hash of `seed` → mulberry32); identity with `n > 1` → rotate by one.

- [ ] **Step 4: Run the tests to pass**, then `npx tsc --noEmit` and `npm run lint`.

- [ ] **Step 5: Coverage report (spec §5.2 gate)** `scripts/dictation/chunk-coverage.ts` — reads every `transcript_lines.text_jp` from the local DB (service client from `.env.local`, as `scripts/seed-real-lesson.ts` does), runs `CHUNKERS[CURRENT_CHUNKER]`, prints total lines, Word Bank-usable share, fallback share per `ChunkReason` with 3 samples each, and the chunk-count histogram. Run it with `npx vite-node scripts/dictation/chunk-coverage.ts` and paste the output into the run state. **Do not loosen any rule in this task**; a surprising share is reported to the owner.

- [ ] **Step 6: Mutation.** Remove the opening-bracket rule → the `「はい」と言った。` test FAILS; restore → PASS.

- [ ] **Step 7: Commit** — `feat(dictation): versioned bunsetsu chunker, seeded bank order, coverage report`.

---

### Task 4: Units and scoring

**Files:**
- Create: `lib/dictation/listening-score.ts`, `lib/dictation/listening-score.test.ts`
- Modify: `lib/dictation/index.ts` (export the new public names)

**Interfaces:**
- Consumes: `alignSequences` (`lib/dictation/align.ts`), `normalizeJa`, `DictationDiff`.
- Produces (pure, client-safe):
  - `type Range = { start: number; end: number }` (code-point indices into `base`, end exclusive)
  - `PUNCTUATION = /[。、！？「」『』（）…・!?()\s.,]/u` — the spec's set plus the NFKC forms `normalizeJa` produces
  - `stripPunctuation(base: string): { chars: string[]; map: number[] }` — `chars[i]` is the i-th kept code point, `map[i]` its index in `Array.from(base)`
  - `chunkUnits(chunks: string[]): Range[]`; `grapheme4Units(base: string): Range[]` (4 grapheme clusters each via `Intl.Segmenter("ja", { granularity: "grapheme" })`, last unit may be shorter)
  - `type ListeningDiffOp = DictationDiff | { type: "hinted"; expected: string }`
  - `interface ListeningMetrics { recall: number; slots?: { correct: number; total: number }; kanji?: number; grammar?: number }`
  - `scoreWordBank(chunks: string[], order: number[], hinted: ReadonlySet<number>): { score: number; slots: { chunkIndex: number; correct: boolean; hinted: boolean }[]; metrics: ListeningMetrics }`
  - `scoreTyping(base: string, input: string, hintedRanges: Range[], grammar: Range[]): { score: number; diff: ListeningDiffOp[]; metrics: ListeningMetrics }`
  - Scores and metrics are 0–100 with one decimal (as `scoreDictation`).

- [ ] **Step 1: Failing tests** (`listening-score.test.ts`), each with the spec's values:
  - Word Bank: chunks `["今日は","雨です。"]`, order `[1,0]` → score 0; `[0,1]` → 100; hinted `{0}` + `[0,1]` → 50 and slot 0 `hinted: true`; all hinted → 0; `metrics.slots = { correct: 2, total: 2 }` for `[0,1]`, `metrics.kanji`/`grammar` absent.
  - Identical texts (Review Focus 5): chunks `["はい、","はい、","はい。"]`, order `[1,0,2]` → 100.
  - Typing: base `今日は雨です。`, input `今日は雨です` → 100 (punctuation ignored); input `きょうは雨です` → recall < 100 with `missing`/`wrong` ops at the kanji positions; empty input → 0.
  - Mid-sentence hint at its own position: base `注文をお願いします。`, hinted range = chunk 1 (`お願いします。`), input `注文を` → score 100·3/9 = 33.3 (`注文を` matched, 6 hinted chars excluded, 。 stripped), and the diff marks those 6 as `hinted`, not `missing`.
  - Offset typing: same base, hinted chunk 0 (`注文を`), input `お願いします` (learner skipped the hinted part) → score 66.7 (6 of 9 matched and not hinted).
  - Fully hinted typing → 0.
  - `grapheme4Units("👨‍👩‍👧家族です")` never splits the family emoji (first unit's code-point length = the emoji's code points + 3).
  - Kanji metric: base `今日は雨です。`, input perfect → `kanji = 100`; a line with no Han → `kanji` absent. Grammar metric from the given ranges; empty ranges → absent.
  - Empty stripped reference → score 0 (guard, like `scoreDictation`).

- [ ] **Step 2: Run to verify they fail** → module missing.

- [ ] **Step 3: Implement.** Typing: `ref = stripPunctuation(base)`, `hyp = stripPunctuation(normalizeJa(input)).chars`; hinted ref indices = `{ i : hintedRanges contains ref.map[i] }`; align `ref.chars` vs `hyp` with `alignSequences`; a ref index that is hinted becomes `{ type: "hinted", expected }` whatever its op; score = matched-and-not-hinted ÷ `ref.chars.length` × 100. Kanji/grammar = the same ratio over ref indices in `\p{Script=Han}` / inside a `grammar` range (via `map`); absent when the set is empty. Word Bank: slot `i` correct iff `chunks[order[i]] === chunks[i]`; score = correct and not hinted ÷ n × 100.

- [ ] **Step 4: Pass**, `tsc`, `lint`.
- [ ] **Step 5: Mutation.** Score typing hints by input position instead of `ref.map` → the offset test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(dictation): listening units, strip map, word bank and typing scoring`.

---

### Task 5: Chunks API, submit/reveal API, per-format stats API

**Files:**
- Create: `lib/data/line-chunks.ts` (+ test), `app/api/lines/[lineId]/chunks/route.ts` (+ test)
- Modify: `lib/validation/dictation.ts`, `lib/data/dictation.ts`, `app/api/dictation/attempt/route.ts`, `lib/data/missions-prewrite.integration.test.ts` (and the route/data tests beside them)
- Modify: `lib/data/practice-stats.ts`, `app/api/shadowing/[id]/practice-stats/route.ts` (+ tests)

**Interfaces:**
- Consumes: Task 3 (`CHUNKERS`, `CURRENT_CHUNKER`, `lineTextHash`, `typingHintUnit`, `grammarRanges`), Task 4 (`scoreWordBank`, `scoreTyping`, `chunkUnits`, `grapheme4Units`).
- Produces:
  - `interface LineChunks { version: number; textHash: string; reliable: boolean; reason: ChunkReason | null; chunks: string[]; typingHintUnit: "chunk" | "grapheme4" }`
  - `GET /api/lines/[lineId]/chunks` → `200 { data: LineChunks }`, `401`, `404` (line not readable under the learner's RLS — same access as `/api/lines/[lineId]/analysis`), `400` bad uuid; `private, no-store`. `loadLineChunks(lineId): Promise<{ kind: "ok"; data: LineChunks } | { kind: "unauthorized" } | { kind: "not_found" }>` with a per-process memo keyed `lineId:textHash` (`// ponytail: unbounded per-process memo, an LRU if line counts grow`).
  - `dictationAttemptSchema` = zod discriminated union of the four `.strict()` shapes in spec §5.4 (`kind`, `format`; `version` int ≥ 1; `textHash` 64 hex; `chunkOrder` int[] ≤ 8; `hintedUnits` int[] ≤ 200; `input` ≤ 2000).
  - `submitListeningAttempt(input): Promise<ListeningAttemptResult>` replacing `submitAttempt`:
    - `{ ok: true; data: ListeningSubmitData }` where `ListeningSubmitData = { kind: "submit"; score: number; slots?: ReturnType<typeof scoreWordBank>["slots"]; diff?: ListeningDiffOp[]; metrics: ListeningMetrics; answer: string }`, or `{ ok: true; data: { kind: "reveal"; answer: string; chunks: string[] } }`;
    - `{ ok: false; status: 400 | 401 }`, `{ ok: false; status: 409; error: "line_changed" | "chunker_version" }`, `{ ok: false; status: 429; retryAfter }`.
  - `loadPracticeStats(videoId, mode: "pronunciation" | "word_bank" | "typing")`; stats route accepts the three modes; for Listening the review cut is `REVIEW_DICTATION_BELOW`; `PracticeLineState` gains `"revealed"`.

- [ ] **Step 1: Failing tests.**
  - Chunks route: 400 bad id; 401 no user; 404 unreadable line; 200 shape with `private, no-store`; two calls → tokenizer run once (memo).
  - Validation (spec §5.4 list): a non-permutation `chunkOrder`, a duplicate hint, an out-of-range hint, a Word Bank body carrying `hintUnit` (strict → 400), a Typing `hintUnit` that disagrees with the line, a `grapheme4` line's out-of-range index; each → 400 and **no insert** (assert the service client's `insert` was not called).
  - `textHash` mismatch → 409 `line_changed`; `version: 99` → 409 `chunker_version`.
  - A line from another lesson (`videoId` mismatch) → 400 before any write (D25 test of §7.1).
  - Submit Word Bank → service-client insert `{ user_id: <verified>, format: "word_bank", status: "submitted", accuracy_score, hint_unit: "chunk" | null, hinted_units, chunk_order, chunker_version, chunk_snapshot }`, then `recordActivity({ source: "dictation", parts: { lineId } })` and `claimActiveMission` (keep the order `ensure → write → record → claim` pinned by `missions-prewrite.integration.test.ts`).
  - Submit Typing → `user_input`, `hint_unit` = the server's unit (or null when no hints).
  - Reveal → insert `status: "revealed", accuracy_score: null`, **no** `recordActivity`, **no** `claimActiveMission`, response carries `answer`.
  - The user-scoped client never inserts into `dictation_attempts` (assert its `from("dictation_attempts")` is not called for writes).
  - Stats route: `mode=typing` passes `p_mode: "typing", p_review_below: 80`; `mode=listening` → 400; `state: "revealed"` parses.

- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Order in `submitListeningAttempt`: user → rate limit (`dictation:attempt:<user>`, 60/min) → line under RLS joined to `transcripts.video_id = videoId` → `textHash` → `CHUNKERS[version]` → hint unit (`chunk` for Word Bank; `typingHintUnit` for Typing, compare with the body's) → validate indices against the unit count (`chunks.length` or `grapheme4Units(base).length`) → `ensureDailyMission` → score → service-client insert → activity + claim for `submit` only. `format: "word_bank"` on an unreliable line → 400 (the client never offers Word Bank there). Hinted ranges for Typing = the hinted units' ranges (`chunkUnits(chunks)` or `grapheme4Units(base)`); grammar ranges from `grammarRanges(text_jp)`. Route maps 409 to `{ error }` with status 409 and every response `private, no-store`.
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutation.** Move `recordActivity` above the `kind === "submit"` branch → the reveal test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(api): line chunks, server-scored listening submit and reveal, per-format stats`.

---

### Task 6: Listening-aware shell: format, stats, reveal context, subtitle gate, cover

**Files:**
- Modify: `lib/shadowing-workspace/learning-modes.ts` (+ test)
- Create: `components/shadowing-workspace/practice/listening-reveal-context.tsx` (+ test), `components/shadowing-workspace/practice/listen-cover.tsx`
- Modify: `components/shadowing-workspace/workspace-shell.tsx`, `workspace-player.tsx`, `practice/practice-stats-context.tsx`, `practice/lesson-stat-strip.tsx`, `practice/sentence-navigator.tsx` (+ their tests), `messages/{en,vi}/shadowing.json`

**Interfaces:**
- Produces:
  - `type ListeningFormat = "word_bank" | "typing"`; `listeningFormat(param: string | null): ListeningFormat` (anything but `"typing"` → `"word_bank"`); `type PracticeStatsMode = "pronunciation" | ListeningFormat`; `practiceStatsMode(mode: PracticeModeId, format: ListeningFormat): PracticeStatsMode | null` (`null` for Shadowing).
  - `ListeningRevealProvider` (in the shell, inside `PlaybackRoot`) and `useListeningReveal(): { lineId: string | null; phase: "answering" | "checked" | "revealed"; videoShown: boolean; set(next: { lineId: string; phase: …; videoShown: boolean }): void }`. `answerVisibleFor(lineId)` = `state.lineId === lineId && state.phase !== "answering"`; `videoVisibleFor(lineId)` = `state.lineId === lineId && state.videoShown`. Deriving visibility from `lineId` equality means a line change can never show the neighbouring line's subtitle for a frame (spec §5.8), whatever order the updates land in.
  - `PracticeStatsProvider` takes `mode: PracticeStatsMode | null` (fetches when non-null).

- [ ] **Step 1: Failing tests.**
  - `learning-modes.test.ts`: `listeningFormat(null) === "word_bank"`, `("typing") === "typing"`, `("x") === "word_bank"`; `practiceStatsMode("listening", "typing") === "typing"`; `("shadowing", …) === null`.
  - `workspace-shell.test.tsx` at `/en/shadowing/<id>/listening`: on the **first render** (no effects flushed — render with `renderToString` or assert inside the first `render` call before `act` completes, as B1's first-frame test does) there is no `workspace-subtitle`, no utility drawer slot, no Korume mascot, and the `listen-cover` is present; the CC toggle is pressed-on and still no subtitle. Pronunciation and Shadowing renders still show the drawer and subtitle (regression).
  - Changing `currentLine` while `phase = "checked"` for the old line → the next render shows no subtitle (no frame with the neighbour's text).
  - Cover: "Show video" lifts it (button gets `aria-pressed`), changing line restores it; the player's play, previous, next, rewind, speed and loop buttons are focusable and clickable with the cover on (cover sits under the control bar and centre play button; it replaces the transparent click surface's look, not its click-to-toggle).
  - `lesson-stat-strip.test.tsx` with `mode="listening"` and format `typing`: cells "Sentence n/N", "Typing · Submitted x/N", "Average y%"; never averages the two formats (fetch URL carries `mode=typing`).
  - `sentence-navigator.test.tsx`: `state: "revealed"` → accessible name "Sentence 3, answer shown", review tone.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** In `WorkspaceLayout`: `const format = listeningFormat(useSearchParams().get("format"))`; pass `practiceStatsMode(mode, format)` to the stats provider; `drawerShown` and `korumeVisible` are false in Listening (the `k` shortcut goes with `korumeVisible`). In `WorkspacePlayer`: `const listening = practiceModeFromPath(usePathname()) === "listening"`; subtitle renders when `subtitles && subtitle !== null && (!listening || answerVisibleFor(lineId))`; render `<ListenCover lineId=… />` above the iframe surface and below the control bar when `listening && !videoVisibleFor(lineId)`. Copy keys under `shadowing.workspace.practice.listening.*` (`cover.title` "Listen only" / "Chỉ nghe", `cover.show` "Show video" / "Hiện video", strip and navigator labels).
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutation.** Gate the subtitle on `phase !== "answering"` without the `lineId` equality → the line-change test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(workspace): listening conceals subtitles from the first frame, listen-only cover, per-format strip`.

---

### Task 7: Listening mode body, Word Bank, feedback

**Files:**
- Create: `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/listening/page.tsx`, `components/shadowing-workspace/practice/listening-mode-body.tsx`, `use-listening-attempt.ts`, `word-bank-panel.tsx`, `listening-feedback.tsx` (+ tests), copy in `messages/{en,vi}/shadowing.json`

**Interfaces:**
- Consumes: Tasks 5 and 6; `PracticePanel`, `SentenceNavigator`, `usePlaybackController`, `useCurrentSentence`, `useLesson`, `bankOrder`, `usePracticeStats().refresh`.
- Produces: `useListeningAttempt(lineId: string | null, format: ListeningFormat)` returning `{ chunks: LineChunks | null; chunksStatus: "loading" | "ready" | "error"; phase: "answering" | "submitting" | "checked" | "revealed"; hinted: number[]; result: ListeningSubmitData | null; answer: string | null; error: "network" | "line_changed" | "rate_limited" | null; hint(): void; submit(payload): Promise<void>; reveal(): Promise<void>; tryAgain(): void }`. It writes `phase` and `videoShown: false` to the reveal context on every line change, new attempt, check and reveal (`submitting` maps to `answering`). `inProgress` (a placed chunk or typed text) is exposed for Task 8's format switch.

- [ ] **Step 1: Failing tests** (`listening-mode-body.test.tsx`, `word-bank-panel.test.tsx`, fetch mocked):
  - Bank shows chunks in `bankOrder(n, lineId)`; clicking a bank chip places it in the first empty slot; clicking a placed chip returns it; every chip is a button reachable by keyboard (Enter/Space), slots announce "Slot 2 of 4, empty" / "Slot 2 of 4, 雨です。".
  - Check is disabled until every slot is filled; Check sends the strict Word Bank body (`chunkOrder`, `hintedUnits`, `version`, `textHash`; no `hintUnit`).
  - **Review Focus 1:** two fast Check clicks / Enter → one `fetch`.
  - **Review Focus 2:** `fetch` rejects → arrangement kept, error text shown, Check enabled again, phase stays `answering`.
  - **Review Focus 3:** with a wrong chunk in slot 0, Hint → chunk 0 locked in slot 0 tagged "Hint", the wrong chunk back in the bank once.
  - After 200: coloured slots (correct / wrong / hinted), score + label (thresholds `REVIEW_DICTATION_BELOW`/`STRONG_DICTATION_AT`), metrics Recall + Slots only (no Kanji/Grammar for Word Bank), the answer `text_jp`, the subtitle now visible (reveal context `checked`), stats `refresh()` called.
  - Show answer → `kind: "reveal"` sent with the hints so far; full answer shown; video stays covered; no score shown.
  - 409 `line_changed` → "This sentence changed, start again" and a fresh attempt after refetching chunks.
  - Try again → same bank order, empty slots, phase `answering`, cover restored.
  - Next sentence → `controller.nextSentence()`; the new line starts concealed.
  - `reliable: false` → Typing opens with the notice "This sentence can't be split reliably, so it's Typing only" (D9), never silently.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Page = `export default function ListeningModePage() { return <ListeningModeBody />; }` (mirror the pronunciation page). The body reuses Pronunciation's empty-transcript branch and initial `seekToSentence` effect; the navigator is never disabled in Listening (an in-progress attempt is simply discarded on line change, D12). Feedback renders only fields that exist (§5.6).
- [ ] **Step 4: Pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutation.** Remove the `submitting` guard → the double-click test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(listening): word bank mode with hints, show answer and live feedback`.

---

### Task 8: Typing and the format switch

**Files:**
- Create: `components/shadowing-workspace/practice/typing-panel.tsx`, `listening-format-switch.tsx` (+ tests)
- Modify: `listening-mode-body.tsx`, copy

**Interfaces:**
- Consumes: `useListeningAttempt` (Task 7), `grapheme4Units`, `chunkUnits`, `normalizeJa`, `Dialog` (`components/ui/dialog`, as `unsaved-take-guard.tsx` uses it).
- Produces: `ListeningFormatSwitch({ format, inProgress })` — a segmented control (`role="radiogroup"`) that changes only `?format=` (`router.replace`, keeps `line` state, no scroll); with `inProgress` it opens an in-app confirm ("Discard this attempt?") first; confirming starts the new format concealed.

- [ ] **Step 1: Failing tests.**
  - Typing body carries `hintUnit` = `chunks.typingHintUnit` and `input`; hint line shows the next unit's text (chunk text, or 4 graphemes on a `grapheme4` line) above the input; the learner's text is not modified by a hint.
  - **Review Focus 4:** with focus in the input, ArrowLeft/ArrowRight/Space type or move the caret and `controller.previousSentence/nextSentence/togglePlay` are not called; Enter with `isComposing: true` (and with `keyCode 229`) does not submit; Enter otherwise submits once.
  - Feedback after submit: coloured diff (match / wrong / missing / extra / hinted), Recall, Kanji only when the line has kanji, Grammar only when it has particles/auxiliaries.
  - Format switch: no attempt in progress → switches immediately; with typed text → confirm dialog; Cancel keeps text and format; Confirm switches and the new attempt is `answering` with the cover on.
  - Review Focus 2 for Typing: a failed submit keeps the typed text.
- [ ] **Step 2–4: fail, implement, pass; `tsc`; `lint`.**
- [ ] **Step 5: Mutation.** Drop the `isComposing` check → the IME test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(listening): typing format, IME-safe submit, format switch with confirm`.

---

### Task 9: Summary, Dashboard and Mission

**Files:**
- Modify: `lib/summary/snapshot.ts`, `lib/summary/thresholds.ts`, `lib/summary/reflection/evidence.ts` (+ prompt if it lists modes/reasons), `components/lesson-summary/lesson-status-card.tsx`, `components/lesson-summary/review-list.tsx`, every test fixture that builds `LessonStatus` / evidence lines (grep `listening:` and `dictationMean` — the list in this plan is a floor, L-013/L-023)
- Modify: `lib/data/dashboard/mission.ts`, `lib/data/dashboard/facts.ts` (+ tests), `messages/{en,vi}/{shadowing,dashboard}.json`

**Interfaces:**
- Consumes: Task 2's evidence shape.
- Produces: `lessonEvidenceSchema` with `wordBankMean`, `typingMean`, `lines[].listening: { format, status, score, input }[]`; `LessonStatus = { shadowing; pronunciation; listeningWordBank; listeningTyping; retention }`; `ReviewReason` gains `"revealed"`; `modeQuality` accepts `"listeningWordBank" | "listeningTyping"` (listening cuts).

- [ ] **Step 1: Failing tests.**
  - `snapshot.test.ts`: `typingMean 72.4` → `listeningTyping: { kind: "scored", score: 72 }`, `wordBankMean null` → `listeningWordBank: not_started`; a line whose latest typing attempt is `revealed` (older submitted 95) → reasons include `"revealed"` and no `"dictation"` from the 95 (spec §8 "Typing 95 then Show answer": average keeps 95, line in Review); a latest typing `submitted 70` with input → `"dictation"` + `focusSpan` from `mistakeSpan`; a Word Bank `submitted 70` → `"dictation"`, `focusSpan` from grammar (no typed input).
  - `lesson-status-card` renders five rows, "Listening · Word Bank" and "Listening · Typing" each with its own value.
  - `review-list` labels `revealed` "Answer shown" / "Đã xem đáp án".
  - Reflection evidence carries both listening qualities; `isEmptyEvidence` still true for a fresh learner.
  - `mission.test.ts`: `dictation_lines` href `/shadowing/v1/listening`; `facts.test.ts`: listening weakness `practiceHref` `/shadowing/d5/listening?format=typing` (P9).
  - Messages: `dashboard.mission.item.dictation` EN "Practise listening to {target} sentence(s)" (ICU plural as today), VI "Luyện nghe {target} câu"; `dashboard.skills.listening` EN "Listening (Typing)", VI "Nghe (gõ)" (P5).
- [ ] **Step 2–4: fail, implement, pass; `tsc`; `lint`; then `npm run verify:db:summary; npm run verify:db:dashboard` (they pin the SQL shape these adapters read).**
- [ ] **Step 5: Mutation.** Compute R2 from the latest **submitted** instead of the latest of any status → the "Typing 95 then Show answer" test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(summary): listening per format, answer-shown review reason; dashboard typing-only listening`.

---

### Task 10: Switch the mode on, E2E, retire the legacy route

**Files:**
- Modify: `lib/shadowing-workspace/learning-modes.ts` (`listening.complete = true`, D24) + its test
- Create: `tests/e2e/practice-listening.spec.ts`
- Modify: `next.config.mjs`, `next.config.test.ts`, `tests/e2e/route-rename-redirects.spec.ts`, `lib/product/screen-registry.ts` (`dictation-in-shadowing` → route `/shadowing/[id]/listening`, name per the Figma frame map), `tests/e2e/typography/routes.ts` (`(focus) shadowing/[id]/listening` replaces the dictation row)
- Delete (only after the E2E is green **and** a grep finds no caller, D22): `app/[locale]/(protected)/(focus)/shadowing/[id]/dictation/page.tsx`, `components/video-player/dictation-view.tsx` + test; then the `dictation` messages namespace if nothing else reads it (`messages/{en,vi}/dictation.json`, `messages/en/dictation.pin.test.ts`, its entry in `lib/i18n/namespaces.ts` and `types/messages.d.ts`)

- [ ] **Step 1: E2E** `practice-listening.spec.ts` (fixtures as `practice-pronunciation.spec.ts`: `registerViaUi`, `installFakeYouTube`, `seedWorkspaceData`; serial):
  1. **One player instance across three modes** (spec §3.1 B2 gate): marker on `fake-yt`, Shadowing → Pronunciation → Listening → Shadowing; marker kept, `onReady` fired once.
  2. Entering Listening: no `workspace-subtitle` at any point (poll from navigation start), cover on, drawer and mascot absent; every player control works with the cover on (play, pause, next, previous, speed 0.75×, loop on).
  3. Word Bank: place all chunks correctly → 100, subtitle appears for that line only; Next → concealed again, cover back.
  4. Hint + Show answer: one hint, Show answer → answer shown, no score; reload → navigator chip "answer shown"; stat strip unchanged average.
  5. Typing: `?format=typing`, type with one deliberate error → coloured diff, score < 100; Enter during an IME composition (dispatch `compositionstart` + keydown `isComposing`) does not submit.
  6. Legacy redirect: `GET /en/shadowing/<id>/dictation` → 308 to `/en/shadowing/<id>/listening?format=typing`; `/en/videos/<id>/dictation` → one hop to the same.
  7. Format switch with text typed → confirm; Cancel keeps the text.
  8. Same line in Word Bank and Typing → Dashboard mission `dictation_lines` progress counts 1 (spec §8).
- [ ] **Step 2: Run** (L-017: free :3000 first, fresh build in this worktree): `npx playwright test tests/e2e/practice-listening.spec.ts tests/e2e/practice-pronunciation.spec.ts tests/e2e/shadowing-workspace.spec.ts tests/e2e/summary.spec.ts tests/e2e/dashboard.spec.ts` → all green, twice.
- [ ] **Step 3: Retire the route** (P2): the two `next.config.mjs` rules, `next.config.test.ts` now expects six rules with the new destinations, registry + typography rows; grep `rg -n "dictation-view|DictationView|/dictation\b" app components lib tests` (with a positive control in the same invocation, L-019) → only the redirect rules and history; delete the files listed above; rerun Step 2 and `npx vitest run --reporter=dot`.
- [ ] **Step 4: `tsc`; `lint`; `npm run verify:protocol`.**
- [ ] **Step 5: Commit** (two commits: mode on + E2E; legacy retirement).

---

### Task 11: Gates, Chrome, review, owner look

- [ ] **Step 1: Gates after the last product edit** (L-044): `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run lint`; `npm run verify:protocol`; DB gates `listening, practice, summary, dashboard, erasure, profile, shadowing`; typography gate (G4) with the listening route; full Playwright on the owner's machine (dictionary imported) — only reds already listed in B1's run state may remain.
- [ ] **Step 2: Chrome** at 1280×529, 1440×900, 1920×1080 and nav collapsed: document never scrolls; at 1280×529 the bank, slots and Check are visible without panel scroll for an 8-chunk line, or the panel scrolls on its own (record which); no subtitle frame on entering Listening or changing line; cover keeps every control usable; type tokens only.
- [ ] **Step 3: Reviews.** `code-reviewer` per task during execution; whole-branch review from `git diff master...practice-listening`; fix wave reviewed on its own (L-012).
- [ ] **Step 4: Owner look** on the real mode bar (mode enabled in-branch, D24) with screenshots en + vi; the coverage report (Task 3) and P3/P5 are put to the owner explicitly. Merge `--no-ff` only on approval; record lessons in `docs/lessons.md`.
