# Practice modes B1 — Pronunciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared practice frame and the Pronunciation mode inside the Shadowing workspace, with server-owned scoring, versioned assessment detail, honest Summary/Mission data and learner-proof score rows.

**Architecture:** The mode page lives under the existing `(workspace)` route group, so the one player instance in `WorkspaceLayout` survives mode switches. Recording → WAV → save (service-role insert) → score-by-session (lease token, server reads the stored file and the line's own text) → `assessment` jsonb. A shell-level attempt store keyed by line id keeps late results on their own line; one SQL function feeds the stat strip and navigator.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase (Postgres + Storage), zod, Vitest + Testing Library, Playwright, Azure Speech REST.

**Spec:** `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` (B1 = §3, §4, §6.1, B1 rows of §7–§9). Read it before any task.

## Global Constraints

- Desktop-only; review viewports 1280×529, 1440×900, 1920×1080, plus nav collapsed (spec §9).
- Type uses the shared `--text-*` tokens only (L-052); layout may scale (L-051). No hardcoded colour or font where a token exists.
- No fabricated data: no Figma numbers, no time metrics ("Speaking 18 min", "Remaining 18 min") (spec §3.5).
- One player instance: no `template.tsx`, no pathname-derived `key` between `(workspace)/layout.tsx` and mode pages (spec §3.1).
- Recording max `min(lineDuration × 2 + 3 s, 30 s)`; WAV PCM 16 kHz mono 16-bit, ≤ 31 s, ≤ 1.1 MB (spec §4.2, §4.3).
- Score lease 90 s; Azure request timeout 30 s (spec §4.5).
- `authenticated`/`anon` have no INSERT/UPDATE on `shadowing_sessions`; app writes use `createServiceClient()` after the user-scoped client verified the user (spec D25, §7.1).
- Every new read function: `security invoker`, `set search_path = public`, `revoke … from public, anon`, grant `authenticated`. Score-write functions: `security definer`, revoke from `public, anon, authenticated`, grant `service_role` only.
- Every new API response that carries learner data: `Cache-Control: private, no-store`.
- Copy in both `messages/en/*.json` and `messages/vi/*.json`; Pitch is "Intonation (reference, compared with a synthesized voice)" / "Ngữ điệu (tham khảo, so với giọng máy)" (D14).
- Build and serve only inside `.worktrees/practice-pronunciation` (memory: never build in the main checkout). Vitest: `npx vitest run --minWorkers=1 --maxWorkers=2 <files>`.
- Each fix or behaviour gets one mutation proving its test fails without it; restore from a `<file>.mutbak` beside the file, never `git checkout --`.

Verified at plan time and needing no task: spec §3.8 "shortcuts ignore inputs" already holds — `lib/shadowing-workspace/shortcuts.ts` skips `input, textarea, [contenteditable], [role="textbox"]` and more. The IME rule of §3.8 belongs to B2 (B1 has no text entry).

## Review Focus

1. **Browser Back/Forward while a take is unsaved** (client navigation that `beforeunload` and link interception cannot see): a `save-failed` take must survive the mode switch and still offer "Save again" on return; a `recording` take stops and releases the mic. → pinned in Task 9 (store lives in the shell) and Task 11 (E2E).
2. **Second tab or stale UI presses "Score again" on a session another request is scoring:** the 409 must refetch and show "Scoring…" or the score, never an error loop. → Task 5 (route 409 body) and Task 10 (panel test).
3. **A request that died mid-scoring** leaves `scoring_claim` set: history shows `scoring` for 90 s, then `unscored` with a working "Score again". → Task 1 (SQL) and Task 4 (list state).
4. **Last line with `endTime = null`:** auto-stop limit uses `effectiveEnd`, never `NaN`; falls back to 30 s. → Task 10.
5. **Mic pressed while the player is playing:** the player pauses before `getUserMedia`; the native audio never records into the take. → Task 10.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20261015000047_practice_pronunciation.sql` | columns, privileges, lease functions, `practice_stats`, replaced `lesson_summary_evidence` + `practice_activity` | 1 |
| `supabase/tests/practice-pronunciation.sql`, `scripts/verify-practice-gate.ps1` | DB gate | 1 |
| `lib/audio/wav-header.ts` | `inspectWav` | 2 |
| `lib/dictation/align.ts` | generic Levenshtein alignment with indices (extracted from `score.ts`) | 3 |
| `lib/pronunciation/assessment.ts` | versioned `assessment` schema | 3 |
| `lib/pronunciation/align-words.ts` | Azure words → spans on the line text, ≥ 90 % coverage | 3 |
| `lib/data/shadowing.ts`, `app/api/shadowing/session/route.ts` | WAV save, service-role insert, extended history | 4 |
| `lib/data/pronunciation.ts`, `app/api/pronunciation/score/route.ts`, `lib/speech-scoring/recognition-client.ts` | score by session with lease | 5 |
| `lib/shadowing-workspace/learning-modes.ts`, `components/shadowing-workspace/use-practice-playback.ts`, `workspace-shell.tsx` | mode-aware shell, sentence-bound playback | 6 |
| `lib/data/practice-stats.ts`, `app/api/shadowing/[id]/practice-stats/route.ts`, `components/shadowing-workspace/practice/practice-stats-context.tsx`, `lesson-stat-strip.tsx` | stats | 7 |
| `components/shadowing-workspace/practice/practice-panel.tsx`, `sentence-navigator.tsx` | shared right column | 8 |
| `lib/pronunciation/attempts.ts`, `components/shadowing-workspace/practice/pronunciation-attempts-context.tsx` | race-safe attempt store | 9 |
| `components/shadowing-workspace/practice/pronunciation-panel.tsx` (+ `pronunciation-details.tsx`), `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/pronunciation/page.tsx` | the mode | 10 |
| `components/shadowing-workspace/practice/unsaved-take-guard.tsx` | beforeunload + link interception + confirm | 11 |
| `components/shadowing-workspace/transcript-row.tsx`, `transcript-panel.tsx` | "Practice this sentence" | 12 |
| `lib/summary/*`, `components/lesson-summary/lesson-status-card.tsx`, `lib/data/dashboard/mission.ts`, `messages/*/dashboard.json` | Summary + Mission | 13 |
| `tests/e2e/practice-pronunciation.spec.ts`, `tests/e2e/fixtures/speech-stub.mjs`, `playwright.config.ts` | E2E, orphan deletion, mode switch-on | 14 |
| `scripts/smoke/practice-pronunciation-live.ts` | live Azure smoke | 15 |

---

### Task 1: Migration and DB gate

**Files:**
- Create: `supabase/migrations/20261015000047_practice_pronunciation.sql`
- Create: `supabase/tests/practice-pronunciation.sql`
- Create: `scripts/verify-practice-gate.ps1`
- Modify: `package.json` (script `verify:db:practice`)
- Modify: `supabase/tests/lesson-summary.sql` (every assertion on `shadowedLines`; per-line pronunciation now = latest **scored**)

**Interfaces:**
- Produces (SQL): `claim_pronunciation_scoring(p_user uuid, p_session uuid) returns table (claim uuid, video_id uuid, transcript_line_id uuid, recording_url text)`; `finish_pronunciation_scoring(p_session uuid, p_claim uuid, p_pronunciation numeric, p_rhythm numeric, p_assessment jsonb) returns boolean`; `release_pronunciation_scoring(p_session uuid, p_claim uuid) returns boolean`; `practice_stats(p_video uuid, p_mode text, p_review_below numeric) returns jsonb` = `{ lineCount, scoredLines, mean, lines: [{ lineId, state, score }] }`, `state ∈ none | scored | needs_review | unscored`; `lesson_summary_evidence` gains `reachedLine` and loses `shadowedLines`.

- [ ] **Step 0: Legacy data count (spec §4.7, §9 migration-compatibility gate).** With Docker Desktop and `npx supabase start` running, on the owner's local DB **before** applying the migration:

```bash
docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -Atc "select count(*), count(*) filter (where recording_url like '%.webm'), count(*) filter (where pronunciation_score is null) from shadowing_sessions"
docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -Atc "select count(*), count(*) filter (where accuracy_score is null) from dictation_attempts"
```

Record both lines in the run state under Verification. Then dump those rows for the compatibility check in Step 6:

```bash
docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -Atc "select id, pronunciation_score, pitch_score from shadowing_sessions order by id" > .tmp/practice-legacy-before.txt
```

- [ ] **Step 1: Write the failing DB test** `supabase/tests/practice-pronunciation.sql` (same harness style as `supabase/tests/lesson-summary.sql`: `\set ON_ERROR_STOP on`, fixed uuids, `set local role` + `request.jwt.claims`, `raise exception 'FAIL n: …'` / `raise notice 'PASS n …'`). Fixture prefix `practicegate-`. Cases:

```sql
\set ON_ERROR_STOP on
\set uid_a 'ba5eba11-0000-4000-8000-00000000000a'
\set uid_b 'ba5eba11-0000-4000-8000-00000000000b'
\set vid 'ba5eba11-0000-4000-8000-0000000000f1'
\set tid 'ba5eba11-0000-4000-8000-0000000000e1'
\set l1 'ba5eba11-0000-4000-8000-0000000000d1'
\set l2 'ba5eba11-0000-4000-8000-0000000000d2'
\set l3 'ba5eba11-0000-4000-8000-0000000000d3'

delete from videos where youtube_video_id like 'practicegate-%';
delete from auth.users where email like 'practicegate-%@example.invalid';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'practicegate-' || name || '@example.invalid',
  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values (:'uid_a', 'a'), (:'uid_b', 'b')) as u(id, name);
insert into videos (id, youtube_video_id, title, library_access) values (:'vid', 'practicegate-1', 'Practice gate lesson', 'FREE');
insert into transcripts (id, video_id, source) values (:'tid', :'vid', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp) values
  (:'l1', :'tid', 0, 2, '今日は雨です。'), (:'l2', :'tid', 2, 4, '注文をお願いします。'), (:'l3', :'tid', 4, 6, 'ありがとうございました。');

-- Legacy rows exactly as pre-B1 code wrote them (postgres role: fixtures, not the learner).
insert into shadowing_sessions (id, user_id, video_id, transcript_line_id, recording_url, pronunciation_score, pitch_score, created_at) values
  ('ba5eba11-0000-4000-8000-000000000101', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/x.webm', 70, 60, now() - interval '3 days'),
  ('ba5eba11-0000-4000-8000-000000000102', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/y.wav', 90, null, now() - interval '2 days'),
  ('ba5eba11-0000-4000-8000-000000000103', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/z.wav', null, 55, now() - interval '1 day'),
  ('ba5eba11-0000-4000-8000-000000000104', :'uid_a', :'vid', :'l2', :'uid_a' || '/shadowing/w.wav', 40, null, now()),
  ('ba5eba11-0000-4000-8000-000000000105', :'uid_b', :'vid', :'l2', :'uid_b' || '/shadowing/v.wav', 99, null, now());
```

Then these blocks (each in `begin; … commit;` or `rollback;`):

1. **Privileges (D25):** as `authenticated` uid_a, `insert into shadowing_sessions (user_id, transcript_line_id) values (uid_a, l3)` raises `insufficient_privilege` (catch `when insufficient_privilege then raise notice 'PASS 1a'`, any other outcome `raise exception 'FAIL 1a'`); same for `update shadowing_sessions set pronunciation_score = 100 where id = '…104'` (PASS 1b); `select count(*)` as uid_a returns 4 (SELECT still allowed, RLS hides B).
2. **Score functions are service-role only:** as `authenticated`, `select claim_pronunciation_scoring(:'uid_a', '…103')` raises `insufficient_privilege` (PASS 2).
3. **Lease token (spec §4.5, §8 row 2):** as `service_role`:
   - `claim(uid_a, '…103')` returns one row with a non-null claim → store in a temp table `c1`;
   - second `claim(uid_a, '…103')` returns zero rows (still leased);
   - `update shadowing_sessions set scoring_started_at = now() - interval '91 seconds' where id = '…103'` (postgres);
   - `claim(uid_a, '…103')` returns a new claim `c2 <> c1`;
   - `finish('…103', c1, 50, 50, '{"v":1}')` returns `false` and the row's score is still null;
   - `release('…103', c1)` returns `false` and `scoring_claim` still equals `c2`;
   - `finish('…103', c2, 80, 70, '{"v":1,"accuracy":81,"completeness":90,"recognizedText":"x","words":null}')` returns `true`; score 80, claim null;
   - `claim(uid_a, '…103')` returns zero rows (scored is immutable);
   - `claim(uid_b, '…104')` returns zero rows (not B's session).
4. **`practice_stats`** as uid_a (`authenticated`), `p_review_below = 60`: `lineCount = 3`; `scoredLines = 2` (l1, l2); `mean = 60` = avg(latest scored l1 = 80 after case 3, l2 = 40); l1 state `scored` score 80; l2 state `needs_review` score 40; l3 absent or `none`. Then insert (postgres) an **unscored** newer session on l1 → l1 state `unscored`, score still 80 (latest valid scored). B's 99 never appears.
5. **Assessment check constraint:** (postgres) `update … set assessment = '[]'` raises `check_violation`; `'{"x":1}'` raises (`v` missing).
6. **`lesson_summary_evidence`** as uid_a: no progress row → `reachedLine = 0`; upsert `user_video_progress(uid_a, vid, last_watched_position = 2.5)` → `reachedLine = 2`; position 0 → `0`; `pronunciationMean` = mean of latest scored per line; key `shadowedLines` absent; per-line `pitch` for l1 = 55 (latest session with a pitch).
7. **`practice_activity`** as uid_a with `p_since = now() - interval '7 days'`: `shadow_lines` outcomes = **2** (distinct lines l1, l2), not 5.
8. **Grants:** `has_function_privilege('anon', 'practice_stats(uuid,text,numeric)', 'execute')` is false; `has_function_privilege('authenticated', …)` true; for the three score functions `authenticated` false and `service_role` true.

Cleanup at the end: the two `delete` statements from the top.

- [ ] **Step 2: Gate script** `scripts/verify-practice-gate.ps1` — copy `scripts/verify-lesson-summary-gate.ps1` and keep only its single-session part (container discovery, UTF-8 pipe of the `.sql` into `psql -v ON_ERROR_STOP=1 -q`, exit codes). Add to `package.json`: `"verify:db:practice": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-practice-gate.ps1"`.

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run verify:db:practice`
Expected: FAIL at case 1a (`authenticated` can still insert) — the migration does not exist yet.

- [ ] **Step 4: Write the migration** `supabase/migrations/20261015000047_practice_pronunciation.sql`:

```sql
-- Practice modes B1: Pronunciation (spec docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md §4, §6.1, §7).

alter table shadowing_sessions
  add column assessment jsonb check (assessment is null or (jsonb_typeof(assessment) = 'object' and assessment ? 'v')),
  add column scoring_claim uuid,
  add column scoring_started_at timestamptz;

-- D25: learners read their rows (RLS shadowing_own) but only the server writes them.
revoke insert, update on shadowing_sessions from authenticated, anon;

-- §4.5 lease: a claim is a fresh token; only its holder can finish or release.
create function claim_pronunciation_scoring(p_user uuid, p_session uuid)
  returns table (claim uuid, video_id uuid, transcript_line_id uuid, recording_url text)
  language sql security definer set search_path = public
as $$
  update shadowing_sessions s
     set scoring_claim = gen_random_uuid(), scoring_started_at = now()
   where s.id = p_session and s.user_id = p_user and s.pronunciation_score is null
     and (s.scoring_claim is null or s.scoring_started_at < now() - interval '90 seconds')
  returning s.scoring_claim, s.video_id, s.transcript_line_id, s.recording_url;
$$;

create function finish_pronunciation_scoring(p_session uuid, p_claim uuid, p_pronunciation numeric, p_rhythm numeric, p_assessment jsonb)
  returns boolean language plpgsql security definer set search_path = public
as $$
declare v_rows int;
begin
  update shadowing_sessions
     set pronunciation_score = p_pronunciation, rhythm_score = p_rhythm, assessment = p_assessment,
         scoring_claim = null, scoring_started_at = null
   where id = p_session and scoring_claim = p_claim and pronunciation_score is null;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create function release_pronunciation_scoring(p_session uuid, p_claim uuid)
  returns boolean language plpgsql security definer set search_path = public
as $$
declare v_rows int;
begin
  update shadowing_sessions set scoring_claim = null, scoring_started_at = null
   where id = p_session and scoring_claim = p_claim;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

revoke all on function claim_pronunciation_scoring(uuid, uuid) from public, anon, authenticated;
revoke all on function finish_pronunciation_scoring(uuid, uuid, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function release_pronunciation_scoring(uuid, uuid) from public, anon, authenticated;
grant execute on function claim_pronunciation_scoring(uuid, uuid) to service_role;
grant execute on function finish_pronunciation_scoring(uuid, uuid, numeric, numeric, jsonb) to service_role;
grant execute on function release_pronunciation_scoring(uuid, uuid) to service_role;

-- §3.6: one aggregate for the stat strip and the navigator. score = latest valid scored; state = latest of any kind.
create function practice_stats(p_video uuid, p_mode text, p_review_below numeric) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
begin
  if p_mode <> 'pronunciation' then raise exception 'practice_stats: unknown mode %', p_mode using errcode = '22023'; end if;
  return (
    with lesson_transcript as (
      select t.id from transcripts t where t.video_id = p_video order by t.created_at desc, t.id limit 1
    ), lines as (
      select tl.id from transcript_lines tl
      where tl.transcript_id = (select id from lesson_transcript) and btrim(coalesce(tl.text_jp, '')) <> ''
    ), sessions as (
      select s.transcript_line_id as line_id, s.pronunciation_score, s.created_at, s.id
      from shadowing_sessions s where s.user_id = auth.uid() and s.transcript_line_id in (select id from lines)
    ), latest_scored as (
      select distinct on (line_id) line_id, pronunciation_score as score
      from sessions where pronunciation_score is not null order by line_id, created_at desc, id desc
    ), latest_any as (
      select distinct on (line_id) line_id, pronunciation_score is null as unscored
      from sessions order by line_id, created_at desc, id desc
    )
    select jsonb_build_object(
      'lineCount', (select count(*) from lines),
      'scoredLines', (select count(*) from latest_scored),
      'mean', (select avg(score) from latest_scored),
      'lines', coalesce((select jsonb_agg(jsonb_build_object(
          'lineId', a.line_id,
          'state', case when a.unscored then 'unscored'
                        when ls.score < p_review_below then 'needs_review' else 'scored' end,
          'score', ls.score) order by a.line_id)
        from latest_any a left join latest_scored ls on ls.line_id = a.line_id), '[]'::jsonb))
  );
end $$;
revoke all on function practice_stats(uuid, text, numeric) from public, anon;
grant execute on function practice_stats(uuid, text, numeric) to authenticated;
```

Then `create or replace function lesson_summary_evidence(p_video uuid, p_mastery int)` — copy the body from `supabase/migrations/20261004000043_lesson_summary.sql` verbatim and change only:
- `lines` also selects `tl.start_time`;
- replace `latest_session` with two CTEs:

```sql
  ), latest_scored as (
    select distinct on (line_id) line_id, pronunciation_score
    from sessions where pronunciation_score is not null order by line_id, created_at desc, id desc
  ), latest_pitch as (
    select distinct on (line_id) line_id, pitch_score
    from sessions where pitch_score is not null order by line_id, created_at desc, id desc
  ), progress as (
    select p.last_watched_position as watched from user_video_progress p
    where p.user_id = auth.uid() and p.video_id = p_video
```

- `per_line` joins `latest_scored ls` and `latest_pitch lp` (select `ls.pronunciation_score, lp.pitch_score`) and its `where` keeps a line when `ls`, `lp`, `la` or a difficult mark exists;
- in the final object replace `'shadowedLines', (select count(distinct line_id) from sessions)` with
  `'reachedLine', (select count(*) from lines where (select watched from progress) > 0 and start_time <= (select watched from progress))`
  and `'pronunciationMean'` with `(select avg(pronunciation_score) from latest_scored)`.

Keep its `revoke`/`grant` lines. Finally `create or replace function practice_activity(p_since timestamptz)` — copy from `supabase/migrations/20261008000045_port_dashboard.sql` (lines 285–297) and change only the first branch to `count(distinct transcript_line_id)::int`.

- [ ] **Step 5: Apply and run the gate**

Run: `npx supabase migration up` then `npm run verify:db:practice`
Expected: every `PASS n` notice, exit 0.

- [ ] **Step 6: Compatibility checks** (spec §9 migration gate): update `supabase/tests/lesson-summary.sql` (replace each `shadowedLines` assertion with the `reachedLine` meaning; per-line pronunciation is now the latest **scored** value — re-derive each expected number from its fixture rows) and run every existing gate that reads these tables:

Run: `npm run verify:db:summary; npm run verify:db:dashboard; npm run verify:db:erasure; npm run verify:db:shadowing`
Expected: all exit 0. Then re-dump the legacy rows and diff:

```bash
docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -Atc "select id, pronunciation_score, pitch_score from shadowing_sessions order by id" > .tmp/practice-legacy-after.txt
diff .tmp/practice-legacy-before.txt .tmp/practice-legacy-after.txt
```

Expected: no difference (no legacy row rewritten).

- [ ] **Step 7: Mutation.** Copy the migration to `…047_practice_pronunciation.sql.mutbak`, change `scoring_claim = p_claim` in `finish_pronunciation_scoring` to `true`, `npx supabase db reset` is NOT allowed here (owner data) — instead `psql` the mutated `create or replace` of that one function, run the gate: case 3 must FAIL. Restore the function from the `.mutbak` text the same way, rerun: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261015000047_practice_pronunciation.sql supabase/tests/practice-pronunciation.sql supabase/tests/lesson-summary.sql scripts/verify-practice-gate.ps1 package.json
git commit -m "feat(db): pronunciation scoring lease, assessment, score write privileges, practice_stats, reached line"
```

---

### Task 2: WAV header inspection

**Files:**
- Create: `lib/audio/wav-header.ts`
- Test: `lib/audio/wav-header.test.ts`

**Interfaces:**
- Produces: `inspectWav(bytes: Uint8Array): WavCheck`; `type WavCheck = { ok: true; durationSeconds: number } | { ok: false; reason: "empty" | "too_large" | "not_wav" | "bad_format" | "too_long" }`; `WAV_MAX_BYTES = 1_100_000`; `WAV_MAX_SECONDS = 31`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { encodeWavPCM16, floatTo16BitPCM } from "./pcm-encode";
import { inspectWav, WAV_MAX_BYTES } from "./wav-header";

const wav = (seconds: number, rate = 16000, channels = 1) =>
  new Uint8Array(encodeWavPCM16(floatTo16BitPCM(new Float32Array(Math.round(seconds * rate) * channels)), rate, channels));

describe("inspectWav", () => {
  it("accepts 16 kHz mono 16-bit PCM and reports its duration", () => {
    expect(inspectWav(wav(2))).toEqual({ ok: true, durationSeconds: 2 });
  });
  it("rejects empty, non-RIFF and non-WAVE bytes", () => {
    expect(inspectWav(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
    expect(inspectWav(new TextEncoder().encode("OggS not a wav file at all"))).toEqual({ ok: false, reason: "not_wav" });
    const bytes = wav(1); bytes.set(new TextEncoder().encode("AVI "), 8);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });
  it("rejects stereo, 44.1 kHz and non-PCM", () => {
    expect(inspectWav(wav(1, 16000, 2))).toEqual({ ok: false, reason: "bad_format" });
    expect(inspectWav(wav(1, 44100))).toEqual({ ok: false, reason: "bad_format" });
    const bytes = wav(1); bytes[20] = 3; // fmt audioFormat = IEEE float
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "bad_format" });
  });
  it("rejects more than 31 s and more than the byte cap", () => {
    // 31.5 s of 16-bit mono 16 kHz is 1 008 044 bytes: under the byte cap, over the duration cap.
    expect(inspectWav(wav(31.5))).toEqual({ ok: false, reason: "too_long" });
    expect(inspectWav(new Uint8Array(WAV_MAX_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
  });
  it("rejects a data chunk that claims more audio than 31 s", () => {
    const bytes = wav(1);
    new DataView(bytes.buffer).setUint32(40, 16000 * 2 * 40, true); // data size = 40 s
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "too_long" });
  });
  it("rejects a truncated header", () => {
    expect(inspectWav(wav(1).slice(0, 30))).toEqual({ ok: false, reason: "not_wav" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/audio/wav-header.test.ts`
Expected: FAIL, cannot resolve `./wav-header`.

- [ ] **Step 3: Write minimal implementation**

```ts
/** Spec 2026-10-15 §4.3: the server checks the real RIFF header, never the Content-Type. Pure, so unit-tested. */
export const WAV_MAX_BYTES = 1_100_000;
export const WAV_MAX_SECONDS = 31;
const RATE = 16000;
const BYTES_PER_SECOND = RATE * 2;

export type WavCheck =
  | { ok: true; durationSeconds: number }
  | { ok: false; reason: "empty" | "too_large" | "not_wav" | "bad_format" | "too_long" };

const tag = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

export function inspectWav(bytes: Uint8Array): WavCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > WAV_MAX_BYTES) return { ok: false, reason: "too_large" };
  if (bytes.length < 12 || tag(bytes, 0) !== "RIFF" || tag(bytes, 8) !== "WAVE") return { ok: false, reason: "not_wav" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let formatOk: boolean | null = null;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = tag(bytes, at);
    const size = view.getUint32(at + 4, true);
    if (id === "fmt ") {
      if (at + 8 + 16 > bytes.length) return { ok: false, reason: "not_wav" };
      formatOk = view.getUint16(at + 8, true) === 1 && view.getUint16(at + 10, true) === 1
        && view.getUint32(at + 12, true) === RATE && view.getUint16(at + 22, true) === 16;
    } else if (id === "data") {
      if (formatOk === null) return { ok: false, reason: "not_wav" };
      if (!formatOk) return { ok: false, reason: "bad_format" };
      const durationSeconds = size / BYTES_PER_SECOND;
      if (durationSeconds > WAV_MAX_SECONDS) return { ok: false, reason: "too_long" };
      return { ok: true, durationSeconds };
    }
    at += 8 + size + (size % 2);
  }
  return { ok: false, reason: "not_wav" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/audio/wav-header.test.ts`
Expected: PASS. Mutation: change `=== RATE` to `> 0` → the 44.1 kHz case fails; restore.

- [ ] **Step 5: Commit**

```bash
git add lib/audio/wav-header.ts lib/audio/wav-header.test.ts
git commit -m "feat(audio): inspect WAV headers server-side"
```

---

### Task 3: Alignment, assessment schema, word spans

**Files:**
- Create: `lib/dictation/align.ts` (+ `align.test.ts`)
- Modify: `lib/dictation/score.ts` (use `alignSequences`; behaviour unchanged — existing `score.test.ts` must stay green untouched)
- Create: `lib/pronunciation/assessment.ts` (+ test)
- Create: `lib/pronunciation/align-words.ts` (+ test)

**Interfaces:**
- Produces: `alignSequences(ref: readonly string[], hyp: readonly string[]): AlignOp[]` with `AlignOp = { type: "match" | "wrong"; refIndex: number; hypIndex: number } | { type: "missing"; refIndex: number } | { type: "extra"; hypIndex: number }` in reference order (same tie preference as today: match > substitution > deletion > insertion).
- Produces: `assessmentSchema`, `type Assessment = { v: 1; accuracy: number | null; completeness: number | null; recognizedText: string | null; words: AssessmentWord[] | null }`, `type AssessmentWord = { word: string; accuracy: number | null; errorType: "None" | "Omission" | "Insertion" | "Mispronunciation" }`, `toAssessment(result: PronunciationAssessmentResult): Assessment`, `readAssessment(value: unknown): Assessment | null`.
- Produces: `ALIGN_MIN_COVERAGE = 0.9`; `alignWords(lineText: string, words: readonly AssessmentWord[]): WordSpan[] | null`; `type WordSpan = { start: number; end: number; accuracy: number | null; errorType: AssessmentWord["errorType"] }` where `start`/`end` index `Array.from(lineText)` (end exclusive).

- [ ] **Step 1: Write the failing tests**

`lib/dictation/align.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { alignSequences } from "./align";

describe("alignSequences", () => {
  it("keeps indices for every op in reference order", () => {
    expect(alignSequences([..."abc"], [..."axcd"])).toEqual([
      { type: "match", refIndex: 0, hypIndex: 0 },
      { type: "wrong", refIndex: 1, hypIndex: 1 },
      { type: "match", refIndex: 2, hypIndex: 2 },
      { type: "extra", hypIndex: 3 },
    ]);
    expect(alignSequences([..."abc"], [..."ac"])).toEqual([
      { type: "match", refIndex: 0, hypIndex: 0 },
      { type: "missing", refIndex: 1 },
      { type: "match", refIndex: 2, hypIndex: 1 },
    ]);
  });
  it("handles empty sides", () => {
    expect(alignSequences([], [..."ab"])).toEqual([{ type: "extra", hypIndex: 0 }, { type: "extra", hypIndex: 1 }]);
    expect(alignSequences([..."a"], [])).toEqual([{ type: "missing", refIndex: 0 }]);
  });
});
```

`lib/pronunciation/assessment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readAssessment, toAssessment } from "./assessment";

describe("assessment", () => {
  it("maps an Azure result to v1", () => {
    expect(toAssessment({ recognizedText: "今日は", pronunciationScore: 80, fluencyScore: 70, accuracyScore: 81, completenessScore: 90,
      words: [{ word: "今日", accuracyScore: 85, errorType: "None" }] })).toEqual({
      v: 1, accuracy: 81, completeness: 90, recognizedText: "今日は", words: [{ word: "今日", accuracy: 85, errorType: "None" }],
    });
  });
  it("reads null for unknown versions, junk and partial-invalid objects", () => {
    expect(readAssessment(null)).toBeNull();
    expect(readAssessment({ v: 2, accuracy: 1 })).toBeNull();
    expect(readAssessment({ v: 1, accuracy: "high" })).toBeNull();
    expect(readAssessment([])).toBeNull();
  });
  it("keeps nullable fields null", () => {
    expect(readAssessment({ v: 1, accuracy: null, completeness: null, recognizedText: null, words: null }))
      .toEqual({ v: 1, accuracy: null, completeness: null, recognizedText: null, words: null });
  });
});
```

`lib/pronunciation/align-words.test.ts` — real sentences (spec §4.6):

```ts
import { describe, expect, it } from "vitest";
import { alignWords } from "./align-words";

const w = (word: string, accuracy = 90, errorType: "None" | "Omission" | "Insertion" | "Mispronunciation" = "None") => ({ word, accuracy, errorType });

describe("alignWords", () => {
  it("maps Azure words onto the line, punctuation uncoloured", () => {
    expect(alignWords("今日は雨です。", [w("今日"), w("は"), w("雨", 40, "Mispronunciation"), w("です")])).toEqual([
      { start: 0, end: 2, accuracy: 90, errorType: "None" },
      { start: 2, end: 3, accuracy: 90, errorType: "None" },
      { start: 3, end: 4, accuracy: 40, errorType: "Mispronunciation" },
      { start: 4, end: 6, accuracy: 90, errorType: "None" },
    ]);
  });
  it("tolerates a different word split", () => {
    const spans = alignWords("注文をお願いします。", [w("注文を"), w("お願い"), w("します")]);
    expect(spans?.map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 6], [6, 9]]);
  });
  it("colours an omitted word (it is still reference text) and ignores insertions", () => {
    const spans = alignWords("ありがとうございました。", [w("ありがとう"), w("ございました", 0, "Omission"), w("ね", 0, "Insertion")]);
    expect(spans?.[1]).toEqual({ start: 5, end: 11, accuracy: 0, errorType: "Omission" });
    expect(spans).toHaveLength(2);
  });
  it("returns null under 90 % coverage", () => {
    expect(alignWords("今日は雨です。", [w("明日"), w("晴れ")])).toBeNull();
  });
  it("normalises full-width/half-width differences per character", () => {
    expect(alignWords("ＡＢＣです", [w("ABC"), w("です")])).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/dictation/align.test.ts lib/pronunciation`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`lib/dictation/align.ts`:

```ts
export type AlignOp =
  | { type: "match" | "wrong"; refIndex: number; hypIndex: number }
  | { type: "missing"; refIndex: number }
  | { type: "extra"; hypIndex: number };

/**
 * Levenshtein alignment with a deterministic backtrace (match > substitution > deletion > insertion), returning
 * the index of every character on both sides. Shared by dictation scoring and pronunciation word colouring.
 */
export function alignSequences(ref: readonly string[], hyp: readonly string[]): AlignOp[] {
  const n = ref.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const at = (i: number, j: number) => dp[i]![j]!;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] = ref[i - 1] === hyp[j - 1] ? at(i - 1, j - 1) : 1 + Math.min(at(i - 1, j - 1), at(i - 1, j), at(i, j - 1));
    }
  }
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1] && at(i, j) === at(i - 1, j - 1)) { ops.push({ type: "match", refIndex: i - 1, hypIndex: j - 1 }); i--; j--; }
    else if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + 1) { ops.push({ type: "wrong", refIndex: i - 1, hypIndex: j - 1 }); i--; j--; }
    else if (i > 0 && at(i, j) === at(i - 1, j) + 1) { ops.push({ type: "missing", refIndex: i - 1 }); i--; }
    else { ops.push({ type: "extra", hypIndex: j - 1 }); j--; }
  }
  return ops.reverse();
}
```

In `lib/dictation/score.ts` replace the DP + backtrace (from `const dp` through `diffRev.reverse();`) with:

```ts
  const ops = alignSequences(ref, usr);
  let matched = 0;
  const diff: DictationDiff[] = ops.map((op) => {
    if (op.type === "match") { matched++; return { type: "match", expected: ref[op.refIndex]!, actual: usr[op.hypIndex]! }; }
    if (op.type === "wrong") return { type: "wrong", expected: ref[op.refIndex]!, actual: usr[op.hypIndex]! };
    if (op.type === "missing") return { type: "missing", expected: ref[op.refIndex]! };
    return { type: "extra", actual: usr[op.hypIndex]! };
  });
```

and return `{ accuracy, diff }` (keep the empty-reference guard and the rounding line). Run `npx vitest run lib/dictation` — the existing `score.test.ts` must pass unchanged.

`lib/pronunciation/assessment.ts`:

```ts
import { z } from "zod";
import type { PronunciationAssessmentResult } from "@/lib/speech-types";

const score = z.number().min(0).max(100).nullable();
const wordSchema = z.object({
  word: z.string().max(100),
  accuracy: score,
  errorType: z.enum(["None", "Omission", "Insertion", "Mispronunciation"]),
});
/** Spec 2026-10-15 §4.4: versioned; an unknown version or an invalid object reads as null. */
export const assessmentSchema = z.object({
  v: z.literal(1),
  accuracy: score,
  completeness: score,
  recognizedText: z.string().max(1000).nullable(),
  words: z.array(wordSchema).max(200).nullable(),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export type AssessmentWord = z.infer<typeof wordSchema>;

export function toAssessment(result: PronunciationAssessmentResult): Assessment {
  return assessmentSchema.parse({
    v: 1,
    accuracy: result.accuracyScore ?? null,
    completeness: result.completenessScore ?? null,
    recognizedText: result.recognizedText || null,
    words: result.words.map((word) => ({ word: word.word, accuracy: word.accuracyScore ?? null, errorType: word.errorType })),
  });
}

export function readAssessment(value: unknown): Assessment | null {
  const parsed = assessmentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
```

`lib/pronunciation/align-words.ts`:

```ts
import { alignSequences } from "@/lib/dictation/align";
import type { AssessmentWord } from "./assessment";

export const ALIGN_MIN_COVERAGE = 0.9;
export interface WordSpan { start: number; end: number; accuracy: number | null; errorType: AssessmentWord["errorType"] }

const IGNORED = /[\s\p{P}\p{S}]/u;
const norm = (char: string) => char.normalize("NFKC");

/**
 * Spec §4.6: colour Azure words on the line text only when ≥ 90 % of its non-punctuation characters align.
 * Positions index `Array.from(lineText)`; insertions are not reference text and are skipped.
 */
export function alignWords(lineText: string, words: readonly AssessmentWord[]): WordSpan[] | null {
  const chars = Array.from(lineText);
  const ref: string[] = [];
  const refOrigin: number[] = [];
  chars.forEach((char, index) => {
    if (IGNORED.test(char)) return;
    for (const piece of Array.from(norm(char))) { ref.push(piece); refOrigin.push(index); }
  });
  const kept = words.filter((word) => word.errorType !== "Insertion");
  const hyp: string[] = [];
  const hypOwner: number[] = [];
  kept.forEach((word, owner) => {
    for (const piece of Array.from(norm(word.word))) {
      if (IGNORED.test(piece)) continue;
      hyp.push(piece); hypOwner.push(owner);
    }
  });
  if (ref.length === 0) return null;
  const ranges = new Map<number, { start: number; end: number }>();
  let aligned = 0;
  for (const op of alignSequences(ref, hyp)) {
    if (op.type !== "match" && op.type !== "wrong") continue;
    if (op.type === "match") aligned++;
    const owner = hypOwner[op.hypIndex]!;
    const origin = refOrigin[op.refIndex]!;
    const range = ranges.get(owner);
    ranges.set(owner, range ? { start: Math.min(range.start, origin), end: Math.max(range.end, origin + 1) } : { start: origin, end: origin + 1 });
  }
  if (aligned / ref.length < ALIGN_MIN_COVERAGE) return null;
  return [...ranges.entries()].sort(([a], [b]) => a - b).map(([owner, range]) => ({
    ...range, accuracy: kept[owner]!.accuracy, errorType: kept[owner]!.errorType,
  }));
}
```

The omitted-word test: Azure returns omitted words as reference words, so their characters match the line and the span is coloured with `errorType: "Omission"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/dictation lib/pronunciation`
Expected: PASS (including the untouched `lib/dictation/score.test.ts`). Mutation: change `ALIGN_MIN_COVERAGE` to `0` → the "null under 90 %" test fails; restore.

- [ ] **Step 5: Commit**

```bash
git add lib/dictation/align.ts lib/dictation/align.test.ts lib/dictation/score.ts lib/pronunciation
git commit -m "feat(pronunciation): shared alignment, versioned assessment, word spans with coverage floor"
```

---

### Task 4: Save as WAV, service-role insert, extended history

**Files:**
- Modify: `lib/data/shadowing.ts` (`createSession`, `listSessions`, `SessionListItem`)
- Modify: `app/api/shadowing/session/route.ts` (headers; `audio` must be a Blob)
- Modify: `lib/validation/shadowing.ts` (delete `validateAudioFile`, `ALLOWED_AUDIO_MIME_TYPES`, `MAX_AUDIO_BYTES`, `AudioFileLike` once grep shows no other caller — today the only caller is `createSession`)
- Test: `lib/data/shadowing.test.ts` (create if absent; mock `@/lib/supabase/server` and `@/lib/supabase/service` the way `lib/data/pronunciation.test.ts` mocks Supabase), `app/api/shadowing/session/route.test.ts`

**Interfaces:**
- Consumes: `inspectWav` (Task 2), `readAssessment`, `Assessment` (Task 3), `createServiceClient()` from `@/lib/supabase/service`.
- Produces: `createSession(input: { videoId: string; lineId: string; audio: Blob; pitchScore?: number })` → `{ ok: true; data: { id; recordingPath; signedUrl; createdAt } } | { ok: false; status: 400 | 401 | 422 } | { ok: false; status: 429; retryAfter }`; `SessionListItem = { id: string; createdAt: string; signedUrl: string | null; pronunciationScore: number | null; rhythmScore: number | null; pitchScore: number | null; assessment: Assessment | null; state: "scored" | "scoring" | "unscored" | "legacy"; format: "wav" | "webm" }`.
- Verified at plan time: the `recordings` bucket (`supabase/migrations/20260712000007_recordings_bucket.sql`) sets no `allowed_mime_types`, so `audio/wav` needs no bucket migration (spec §4.3).

- [ ] **Step 1: Write the failing tests** (data layer, Supabase mocked):
  1. a WAV from `encodeWavPCM16` → upload path `${userId}/shadowing/<uuid>.wav`, `contentType: "audio/wav"`, insert through the **service** client with `user_id` = the verified user and `pitch_score` when given; user-scoped client never receives `.insert`;
  2. a webm blob (`new Blob(["x"], { type: "audio/webm" })`) → 422, nothing uploaded;
  3. a 40 s WAV → 422;
  4. line not in lesson (`maybeSingle` → null) → 400, nothing uploaded;
  5. insert error → the file is removed; when `remove` also errors, `console.error` is called with the path and the result is 400;
  6. `listSessions` maps rows: `pronunciation_score` 80 → `state: "scored"`; null score + `scoring_claim` set + `scoring_started_at` 10 s ago → `"scoring"`; null score + claim 2 min old → `"unscored"`; `recording_url` ending `.webm` with null score → `"legacy"`, `format: "webm"`; `assessment: { v: 9 }` → `assessment: null`.

  Route test: GET and POST responses carry `Cache-Control: private, no-store`; POST with a non-file `audio` → 400.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/shadowing.test.ts app/api/shadowing/session/route.test.ts`
Expected: FAIL (webm still accepted; insert on the user client; no `state`).

- [ ] **Step 3: Implement.** In `createSession` replace the `validateAudioFile` block with:

```ts
  const bytes = new Uint8Array(await input.audio.arrayBuffer());
  if (!inspectWav(bytes).ok) return { ok: false, status: 422 };
```

(after the auth + rate-limit lines, before the line lookup), change the path to `` `${user.id}/shadowing/${sessionId}.wav` ``, upload `bytes` with `{ contentType: "audio/wav", upsert: false }` on the user-scoped client (its storage RLS path policy proves ownership), and insert through `createServiceClient()`:

```ts
  const { data: inserted, error: insertError } = await createServiceClient()
    .from("shadowing_sessions")
    .insert({ id: sessionId, user_id: user.id, video_id: input.videoId, transcript_line_id: input.lineId, recording_url: recordingPath,
      ...(input.pitchScore !== undefined ? { pitch_score: input.pitchScore } : {}) })
    .select("id, created_at")
    .single();
  if (insertError) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([recordingPath]);
    if (removeError) console.error("[shadowing] orphaned recording after a failed insert:", recordingPath, removeError);
    return { ok: false, status: 400 };
  }
```

Update the doc comment (WAV, service-role insert, spec D25). `listSessions` selects `id, recording_url, created_at, pronunciation_score, rhythm_score, pitch_score, assessment, scoring_claim, scoring_started_at` and maps:

```ts
const LEASE_MS = 90_000;
function sessionState(row: SessionRow, now: number): SessionListItem["state"] {
  if (row.pronunciation_score !== null) return "scored";
  if (row.recording_url?.endsWith(".webm")) return "legacy";
  const started = row.scoring_started_at === null ? Number.NaN : Date.parse(row.scoring_started_at);
  return row.scoring_claim !== null && now - started < LEASE_MS ? "scoring" : "unscored";
}
```

`signedUrl` is `null` when signing fails (the row still lists; the UI disables "Play"). `assessment: readAssessment(row.assessment)`, `format: row.recording_url?.endsWith(".webm") ? "webm" : "wav"`. Both route handlers add `headers: { "Cache-Control": "private, no-store" }` to every `NextResponse.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/shadowing.test.ts app/api/shadowing/session lib/validation`
Expected: PASS. Mutation: insert through the user-scoped client again → test 1 fails; restore.

- [ ] **Step 5: Commit**

```bash
git add lib/data/shadowing.ts lib/data/shadowing.test.ts app/api/shadowing/session lib/validation/shadowing.ts lib/validation/shadowing.test.ts
git commit -m "feat(shadowing): WAV-only takes, service-role insert, history with scoring state"
```

---

### Task 5: Score by session with a lease token

**Files:**
- Modify: `lib/data/pronunciation.ts` (replace `scorePronunciation` with `scoreSession`)
- Modify: `app/api/pronunciation/score/route.ts` (JSON body `{ sessionId }`)
- Modify: `lib/validation/pronunciation.ts` (replace the multipart schema with `scoreSessionSchema = z.object({ sessionId: z.string().uuid() }).strict()`)
- Modify: `lib/speech-scoring/recognition-client.ts` (`signal: AbortSignal.timeout(SPEECH_REQUEST_TIMEOUT_MS)`, `export const SPEECH_REQUEST_TIMEOUT_MS = 30_000`)
- Test: `lib/data/pronunciation.test.ts`, `app/api/pronunciation/score/route.test.ts`

**Interfaces:**
- Consumes: SQL functions from Task 1, `toAssessment` (Task 3), `captureShadowScoreMemories` (existing, `lib/data/companion.ts`).
- Produces: `scoreSession(sessionId: string): Promise<ScoreSessionResult>`; `ScoreSessionResult = { ok: true; data: { sessionId: string; lineId: string; pronunciationScore: number; rhythmScore: number; assessment: Assessment } } | { ok: false; status: 401 | 502 | 503 | 422 } | { ok: false; status: 409; reason: "not_claimable" | "legacy_format" | "superseded" } | { ok: false; status: 429; retryAfter: number }`. Route JSON: success `{ data }`; 409 `{ error, reason }`; 429 with `Retry-After`.

- [ ] **Step 1: Write the failing tests** (mock `@/lib/supabase/server`, `@/lib/supabase/service`, `@/lib/speech-scoring`, `@/lib/data/companion`):
  1. happy path: `rpc("claim_pronunciation_scoring", { p_user, p_session })` → one row; line lookup returns `text_jp`; storage `download` returns a WAV Blob; `assessPronunciation` is called with `referenceText` = that `text_jp` (the client sent none); `rpc("finish_pronunciation_scoring", …)` → `true`; `captureShadowScoreMemories` called once; result ok;
  2. claim returns no rows → `{ status: 409, reason: "not_claimable" }`, Azure never called;
  3. `recording_url` ends `.webm` → `release` called with the same claim, `{ 409, legacy_format }`, Azure never called;
  4. Azure throws `throttled` → `release` called with the claim, `{ 429, retryAfter }`; throws `request` (timeout) → release, `502`;
  5. `finish` returns `false` (lease lost) → `{ 409, superseded }`, **no** Companion call;
  6. speech not configured → 503 before any claim;
  7. route: body `{ sessionId: "x" }` → 400; `{ sessionId, referenceText }` → 400 (strict); 409 body carries `reason`; every response `Cache-Control: private, no-store`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/pronunciation.test.ts app/api/pronunciation/score`
Expected: FAIL (`scoreSession` not exported).

- [ ] **Step 3: Implement** `scoreSession`:

```ts
export async function scoreSession(sessionId: string): Promise<ScoreSessionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const limited = rateLimit(`pronunciation:score:${user.id}`, SCORE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };
  if (!isSpeechConfigured()) return { ok: false, status: 503 };

  const service = createServiceClient();
  const { data: claimed, error: claimError } = await service.rpc("claim_pronunciation_scoring", { p_user: user.id, p_session: sessionId });
  if (claimError) throw claimError;
  const lease = (claimed as ClaimRow[] | null)?.[0];
  if (!lease) return { ok: false, status: 409, reason: "not_claimable" };
  const release = () => service.rpc("release_pronunciation_scoring", { p_session: sessionId, p_claim: lease.claim });

  try {
    if (!lease.recording_url || lease.recording_url.endsWith(".webm")) { await release(); return { ok: false, status: 409, reason: "legacy_format" }; }
    const { data: line } = await supabase.from("transcript_lines").select("text_jp, transcripts!inner(video_id)")
      .eq("id", lease.transcript_line_id ?? "").eq("transcripts.video_id", lease.video_id ?? "").maybeSingle();
    const { data: file } = await supabase.storage.from("recordings").download(lease.recording_url);
    if (!line?.text_jp || !file) { await release(); return { ok: false, status: 422 }; }

    const result = await assessPronunciation({ audio: await file.arrayBuffer(), referenceText: line.text_jp });
    const assessment = toAssessment(result);
    const { data: finished, error: finishError } = await service.rpc("finish_pronunciation_scoring", {
      p_session: sessionId, p_claim: lease.claim, p_pronunciation: result.pronunciationScore, p_rhythm: result.fluencyScore, p_assessment: assessment,
    });
    if (finishError) throw finishError;
    if (finished !== true) return { ok: false, status: 409, reason: "superseded" };
    await captureShadowScoreMemories({ userId: user.id, sessionId, videoId: lease.video_id, transcriptLineId: lease.transcript_line_id, pronunciationScore: result.pronunciationScore });
    return { ok: true, data: { sessionId, lineId: lease.transcript_line_id!, pronunciationScore: result.pronunciationScore, rhythmScore: result.fluencyScore, assessment } };
  } catch (err) {
    await release();
    if (err instanceof SpeechError) {
      if (err.kind === "throttled") return { ok: false, status: 429, retryAfter: SPEECH_THROTTLE_RETRY_AFTER_MS };
      return { ok: false, status: speechErrorStatus(err.kind) as 422 | 502 | 503 };
    }
    throw err;
  }
}
```

(`ClaimRow = { claim: string; video_id: string | null; transcript_line_id: string | null; recording_url: string | null }`.) Note: a `superseded` finish does not release — the claim belongs to the newer request. In `postRecognition` add `signal: AbortSignal.timeout(SPEECH_REQUEST_TIMEOUT_MS)` to the `fetch` init; the existing `catch` already turns the abort into `SpeechRequestError` (502). The route parses JSON with `scoreSessionSchema`, maps results, and sets `Retry-After` from `retryAfter` only when present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/pronunciation.test.ts app/api/pronunciation lib/speech-scoring`
Expected: PASS. Mutation: drop the `finished !== true` check → test 5 fails (Companion called); restore.

- [ ] **Step 5: Commit**

```bash
git add lib/data/pronunciation.ts lib/data/pronunciation.test.ts app/api/pronunciation lib/validation/pronunciation.ts lib/speech-scoring/recognition-client.ts
git commit -m "feat(pronunciation): score a stored take by session with a lease token"
```

---

### Task 6: Mode-aware shell and sentence-bound playback

**Files:**
- Modify: `lib/shadowing-workspace/learning-modes.ts` (+ its test)
- Create: `components/shadowing-workspace/use-practice-playback.ts` (+ test)
- Modify: `components/shadowing-workspace/workspace-shell.tsx` (+ `workspace-shell.test.tsx`)

**Interfaces:**
- Produces: `type PracticeModeId = "shadowing" | "pronunciation" | "listening"`; `practiceModeFromPath(pathname: string): PracticeModeId` (`/shadowing/<id>` → shadowing, `/shadowing/<id>/pronunciation` → pronunciation, `/shadowing/<id>/listening` → listening, anything else → shadowing); `usePracticePlayback(mode: PracticeModeId): void`.
- Consumes: `usePlayerWiring().loop`, `.setLoop` (`components/shadowing-workspace/playback-root.tsx`).

- [ ] **Step 1: Write the failing tests**
  - `practiceModeFromPath` table test including a trailing slash and `/shadowing/abc/summary` → `"shadowing"` (summary is not a practice mode).
  - `usePracticePlayback` (render inside a fake `PlayerWiringContext` — export a `PlayerWiringContext` test provider from `playback-root.tsx` if one does not exist): entering `pronunciation` calls `setLoop({ enabled: false, autoPause: true })`; returning to `shadowing` calls `setLoop(<the config held before entering>)`; `pronunciation → listening` does not overwrite the saved config.
  - Shell: at `/en/shadowing/v1/pronunciation` (mock `usePathname` from `@/lib/i18n/navigation`) the left column renders `data-testid="lesson-stat-strip"` and no Live Sentence region; at `/en/shadowing/v1` it renders Live Sentence (existing behaviour).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/shadowing-workspace/learning-modes.test.ts components/shadowing-workspace/use-practice-playback.test.tsx components/shadowing-workspace/workspace-shell.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// learning-modes.ts
export type PracticeModeId = "shadowing" | "pronunciation" | "listening";
/** Spec §3.2: derived during render so the first frame of a mode is already right. */
export function practiceModeFromPath(pathname: string): PracticeModeId {
  const segment = pathname.replace(/\/+$/, "").match(/\/shadowing\/[^/]+\/([^/]+)$/)?.[1];
  return segment === "pronunciation" || segment === "listening" ? segment : "shadowing";
}
```

```ts
// use-practice-playback.ts
"use client";
import { useEffect, useRef } from "react";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";
import { usePlayerWiring } from "./playback-root";

/** Spec §3.3 / D17: practice modes play one sentence and stop; leaving them restores the Shadowing loop. */
export function usePracticePlayback(mode: PracticeModeId): void {
  const { loop, setLoop } = usePlayerWiring();
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const saved = useRef<LoopConfig | null>(null);
  useEffect(() => {
    if (mode === "shadowing") {
      if (saved.current) setLoop(saved.current);
      saved.current = null;
      return;
    }
    if (saved.current === null) saved.current = loopRef.current;
    setLoop({ enabled: false, autoPause: true });
  }, [mode, setLoop]);
}
```

In `workspace-shell.tsx` (`WorkspaceLayout`): `const mode = practiceModeFromPath(usePathname());` (import `usePathname` from `@/lib/i18n/navigation`), call `usePracticePlayback(mode)`, and replace `{!fullTranscript && <LiveSentence />}` with `{!fullTranscript && (mode === "shadowing" ? <LiveSentence /> : <LessonStatStrip mode={mode} />)}`. `LessonStatStrip` comes from Task 7; until then create the file with a placeholder-free minimal component that renders `<div data-testid="lesson-stat-strip" />` and is completed in Task 7 (the test only checks presence).

- [ ] **Step 4: Run tests to verify they pass**, plus the existing workspace suite:

Run: `npx vitest run lib/shadowing-workspace components/shadowing-workspace`
Expected: PASS, no existing test changed. Mutation: make `usePracticePlayback` skip the restore branch → the "returning to shadowing" test fails; restore.

- [ ] **Step 5: Commit**

```bash
git add lib/shadowing-workspace/learning-modes.ts lib/shadowing-workspace/learning-modes.test.ts components/shadowing-workspace
git commit -m "feat(workspace): mode-aware left column and sentence-bound practice playback"
```

---

### Task 7: Practice stats API, context and stat strip

**Files:**
- Create: `lib/data/practice-stats.ts` (+ test)
- Create: `app/api/shadowing/[id]/practice-stats/route.ts` (+ test)
- Create: `components/shadowing-workspace/practice/practice-stats-context.tsx` (+ test)
- Modify: `components/shadowing-workspace/practice/lesson-stat-strip.tsx` (+ test)
- Modify: `components/shadowing-workspace/workspace-shell.tsx` (wrap the grid in `PracticeStatsProvider`)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`workspace.practice.strip.*`)

**Interfaces:**
- Consumes: SQL `practice_stats` (Task 1), `REVIEW_PRONUNCIATION_BELOW` (`lib/summary/thresholds.ts`), `PracticeModeId` (Task 6).
- Produces: `type PracticeLineState = "none" | "scored" | "needs_review" | "unscored"`; `type PracticeStats = { lineCount: number; scoredLines: number; mean: number | null; lines: Record<string, { state: PracticeLineState; score: number | null }> }`; `loadPracticeStats(videoId: string, mode: "pronunciation"): Promise<{ ok: true; data: PracticeStats } | { ok: false; status: 401 }>` (an unknown or inaccessible lesson returns `lineCount: 0` through RLS, not an error); `usePracticeStats(): { stats: PracticeStats | null; refresh(): void }`; `<PracticeStatsProvider videoId mode>`; `<LessonStatStrip mode />`.

- [ ] **Step 1: Write the failing tests**
  - data: `rpc("practice_stats", { p_video, p_mode: "pronunciation", p_review_below: REVIEW_PRONUNCIATION_BELOW })`; numeric strings coerce; `lines` array → record; mean `null` stays null; unauthenticated → 401.
  - route: `?mode=listening` → 400 in B1; missing session → 401; success has `Cache-Control: private, no-store`.
  - provider: does not fetch in `shadowing`; fetches once on entering `pronunciation`; `refresh()` refetches; a response for an older mode is dropped (AbortController).
  - strip (1280 wide container): `Ep.729 · Sentence 51/194 · Scored 12/194 · Avg 84`; mean null → "No score yet"; `stats === null` → shows only `Sentence X/Y`; when the container is narrow (`data-compact`, set by a `ResizeObserver` below 420 px — mock it) the title and the average are dropped.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/practice-stats.test.ts app/api/shadowing components/shadowing-workspace/practice`
Expected: FAIL.

- [ ] **Step 3: Implement.** Data layer:

```ts
import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_PRONUNCIATION_BELOW } from "@/lib/summary/thresholds";

const numeric = z.coerce.number();
const statsSchema = z.object({
  lineCount: numeric, scoredLines: numeric, mean: numeric.nullable(),
  lines: z.array(z.object({ lineId: z.string(), state: z.enum(["scored", "needs_review", "unscored"]), score: numeric.nullable() })),
});
export type PracticeLineState = "none" | "scored" | "needs_review" | "unscored";
export interface PracticeStats { lineCount: number; scoredLines: number; mean: number | null; lines: Record<string, { state: PracticeLineState; score: number | null }> }

export async function loadPracticeStats(videoId: string, mode: "pronunciation"):
  Promise<{ ok: true; data: PracticeStats } | { ok: false; status: 401 }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };
  const { data, error } = await supabase.rpc("practice_stats", { p_video: videoId, p_mode: mode, p_review_below: REVIEW_PRONUNCIATION_BELOW });
  if (error) throw error;
  const parsed = statsSchema.parse(data);
  return { ok: true, data: { ...parsed, mean: parsed.mean === null ? null : Math.round(parsed.mean),
    lines: Object.fromEntries(parsed.lines.map((line) => [line.lineId, { state: line.state, score: line.score === null ? null : Math.round(line.score) }])) } };
}
```

Route `GET` validates `params.id` as uuid and `mode` with `z.literal("pronunciation")` (B2 widens it), returns `{ data }` with `Cache-Control: private, no-store`. Provider fetches `/api/shadowing/${videoId}/practice-stats?mode=${mode}` with an `AbortController` per mode and exposes `refresh`. Strip copy keys (en / vi):

```json
"practice": { "strip": {
  "sentence": "Sentence {current}/{total}", "scored": "Scored {count}/{total}", "average": "Avg {value}", "noScore": "No score yet"
} }
```
```json
"practice": { "strip": {
  "sentence": "Câu {current}/{total}", "scored": "Đã chấm {count}/{total}", "average": "TB {value}", "noScore": "Chưa có điểm"
} }
```

`current` = `useCurrentSentence().index + 1` (or `—` when null), `total` = `useLesson().lines.length`; the title is `useLesson().video.title`. Type uses `text-caption`/`text-body` tokens only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/practice-stats.test.ts app/api/shadowing components/shadowing-workspace messages`
Expected: PASS (message parity tests included).

- [ ] **Step 5: Commit**

```bash
git add lib/data/practice-stats.ts lib/data/practice-stats.test.ts app/api/shadowing components/shadowing-workspace messages
git commit -m "feat(practice): stats API, shared stats context and the lesson stat strip"
```

---

### Task 8: Practice panel and sentence navigator

**Files:**
- Create: `components/shadowing-workspace/practice/practice-panel.tsx` (+ test)
- Create: `components/shadowing-workspace/practice/sentence-navigator.tsx` (+ test)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`workspace.practice.navigator.*`)

**Interfaces:**
- Consumes: `useCurrentSentence`, `useLesson`, `usePlaybackController` (`workspace-context.tsx`); `usePracticeStats` (Task 7).
- Produces: `<PracticePanel label navigator feedback>{practice}</PracticePanel>` (a `section` with `overflow-y-auto min-h-0 h-full`); `<SentenceNavigator disabled={boolean} disabledHint={string} />` — chips for a window of 8 lines around the current one, ←/→ move the window by 8, a chip click calls `controller.seekToSentence(index)` (no play), `aria-current="true"` on the current line, accessible name `t("navigator.chip", { number, state })`.

- [ ] **Step 1: Write the failing tests**: window math (current 50 of 194 → chips 47–54 in 1-based numbering, clamped at both ends); clicking chip 52 calls `seekToSentence(51)` and not `play`; `disabled` → chips and arrows `aria-disabled`, clicking does nothing, the hint is the tooltip/`title`; chip state from stats (`scored 86` → "Sentence 51, scored 86"; `unscored` → "Sentence 51, not scored yet"; `needs_review` → "Sentence 51, needs review"); `PracticePanel` is the only scroll container (`overflow-y-auto`) and the workspace root keeps `overflow-hidden`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/shadowing-workspace/practice/sentence-navigator.test.tsx components/shadowing-workspace/practice/practice-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { usePracticeStats } from "./practice-stats-context";

const WINDOW = 8;
export function navigatorWindow(current: number, total: number): number[] {
  const start = Math.max(0, Math.min(current - 3, total - WINDOW));
  return Array.from({ length: Math.min(WINDOW, total) }, (_, i) => start + i);
}

export function SentenceNavigator({ disabled = false, disabledHint }: { disabled?: boolean; disabledHint?: string }) {
  const t = useTranslations("shadowing.workspace.practice");
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const controller = usePlaybackController();
  const { stats } = usePracticeStats();
  const [anchor, setAnchor] = useState(index ?? 0);
  useEffect(() => { if (index !== null) setAnchor(index); }, [index]);
  const chips = navigatorWindow(anchor, lines.length);
  const go = (target: number) => { if (!disabled) controller.seekToSentence(target); };
  const stateLabel = (lineId: string) => {
    const entry = stats?.lines[lineId];
    if (!entry || entry.state === "none") return t("navigator.state.none");
    return entry.state === "scored" ? t("navigator.state.scored", { score: entry.score ?? 0 }) : t(`navigator.state.${entry.state}`);
  };
  return (
    <nav aria-label={t("navigator.label")} title={disabled ? disabledHint : undefined} className="flex items-center gap-2xs">
      <button type="button" aria-label={t("navigator.earlier")} aria-disabled={disabled || chips[0] === 0} onClick={() => !disabled && setAnchor(Math.max(0, anchor - WINDOW))}>‹</button>
      <ol className="flex gap-2xs">
        {chips.map((i) => {
          const line = lines[i]!;
          const entry = stats?.lines[line.id];
          return (
            <li key={line.id}>
              <button type="button" aria-current={i === index ? "true" : undefined} aria-disabled={disabled}
                aria-label={t("navigator.chip", { number: i + 1, state: stateLabel(line.id) })} onClick={() => go(i)}
                data-state={entry?.state ?? "none"}
                className={cn("size-control-sm rounded-full text-caption tabular-nums", i === index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" aria-label={t("navigator.later")} aria-disabled={disabled || chips.at(-1) === lines.length - 1} onClick={() => !disabled && setAnchor(Math.min(lines.length - 1, anchor + WINDOW))}>›</button>
    </nav>
  );
}
```

Chip colours for `data-state` use existing tokens (`scored` → success tone, `needs_review` → warning tone, `unscored` → muted ring); the Chrome look in Task 15 judges the finish. `PracticePanel`:

```tsx
export function PracticePanel({ label, navigator, feedback, children }: { label: string; navigator: React.ReactNode; feedback: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex h-full min-h-0 flex-col gap-md overflow-y-auto p-md" data-testid="practice-panel">
      <div>{navigator}</div>
      <div className="flex flex-col gap-md">{children}</div>
      <div>{feedback}</div>
    </section>
  );
}
```

Copy (en): `"navigator": { "label": "Sentence navigator", "earlier": "Earlier sentences", "later": "Later sentences", "chip": "Sentence {number}, {state}", "state": { "none": "not practised", "scored": "scored {score}", "needs_review": "needs review", "unscored": "not scored yet" } }`; vi: `"Điều hướng câu"`, `"Các câu trước"`, `"Các câu sau"`, `"Câu {number}, {state}"`, `{ "none": "chưa luyện", "scored": "{score} điểm", "needs_review": "cần ôn lại", "unscored": "chưa chấm" }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/shadowing-workspace/practice messages`
Expected: PASS. Mutation: `go` without the `disabled` check → the disabled test fails; restore.

- [ ] **Step 5: Commit**

```bash
git add components/shadowing-workspace/practice messages
git commit -m "feat(practice): scrolling practice panel and sentence navigator"
```

---

### Task 9: Race-safe pronunciation attempt store

**Files:**
- Create: `lib/pronunciation/attempts.ts` (+ test)
- Create: `components/shadowing-workspace/practice/pronunciation-attempts-context.tsx` (+ test)
- Modify: `components/shadowing-workspace/workspace-shell.tsx` (mount the provider above `{children}` so the store survives a mode switch — Review Focus 1; wire the lock below)
- Modify: `components/shadowing-workspace/use-playback-controller.ts` (+ `use-playback-controller.test.tsx`): `setLock(lock: { navigation: boolean; play: boolean })`

**Why the lock lives in the controller:** the sentence can change from the navigator, the player's Previous/Next buttons, the progress bar, ←/→ shortcuts and transcript rows. Spec §4.6 disables sentence changes in every unsaved phase; guarding each caller would miss one, so the one choke point every caller routes through (`seekTo`) refuses while locked. `play` is refused only while `recording`, so native audio never enters the take.

**Interfaces:**
- Produces:

```ts
export type AttemptPhase = "recording" | "converting" | "convert-failed" | "saving" | "save-failed" | "scoring" | "scored"
  | "unscored-unavailable" | "unscored-throttled" | "unscored-error";
export interface Attempt { lineId: string; phase: AttemptPhase; original: Blob | null; wav: Blob | null; pitch: PitchAccentScore | null;
  sessionId: string | null; signedUrl: string | null; result: { pronunciationScore: number; rhythmScore: number; assessment: Assessment } | null;
  retryAfter: number | null }
export type AttemptAction =
  | { type: "start"; lineId: string } | { type: "recorded"; lineId: string; original: Blob }
  | { type: "converted"; lineId: string; wav: Blob; pitch: PitchAccentScore | null } | { type: "convert-failed"; lineId: string }
  | { type: "saving"; lineId: string } | { type: "saved"; lineId: string; sessionId: string; signedUrl: string }
  | { type: "save-failed"; lineId: string } | { type: "scoring"; sessionId: string }
  | { type: "scored"; sessionId: string; result: Attempt["result"] & {} }
  | { type: "score-failed"; sessionId: string; kind: "unavailable" | "throttled" | "error"; retryAfter: number | null }
  | { type: "discard"; lineId: string };
export type AttemptsState = Record<string, Attempt>;
export function attemptsReducer(state: AttemptsState, action: AttemptAction): AttemptsState;
export const UNSAVED_PHASES: ReadonlySet<AttemptPhase>; // recording, converting, convert-failed, saving, save-failed
export function hasUnsaved(state: AttemptsState): boolean;
```

Context: `usePronunciationAttempts(): { attempts: AttemptsState; dispatch(action: AttemptAction): void }`.

- [ ] **Step 1: Write the failing test** (`lib/pronunciation/attempts.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { attemptsReducer, hasUnsaved } from "./attempts";

const blob = new Blob(["a"]);
const run = (...actions: Parameters<typeof attemptsReducer>[1][]) => actions.reduce(attemptsReducer, {});

describe("attemptsReducer", () => {
  it("routes a late score to the line that owns the session (spec §4.6 race)", () => {
    const state = run(
      { type: "start", lineId: "L51" }, { type: "recorded", lineId: "L51", original: blob },
      { type: "converted", lineId: "L51", wav: blob, pitch: null }, { type: "saving", lineId: "L51" },
      { type: "saved", lineId: "L51", sessionId: "S1", signedUrl: "u" }, { type: "scoring", sessionId: "S1" },
      { type: "start", lineId: "L52" },
      { type: "scored", sessionId: "S1", result: { pronunciationScore: 86, rhythmScore: 80, assessment: { v: 1, accuracy: 1, completeness: 1, recognizedText: null, words: null } } },
    );
    expect(state.L51?.phase).toBe("scored");
    expect(state.L51?.result?.pronunciationScore).toBe(86);
    expect(state.L52?.phase).toBe("recording");
    expect(state.L52?.result).toBeNull();
  });
  it("ignores a result for an unknown or discarded session", () => {
    const state = run({ type: "start", lineId: "L1" }, { type: "discard", lineId: "L1" },
      { type: "scored", sessionId: "S9", result: { pronunciationScore: 1, rhythmScore: 1, assessment: { v: 1, accuracy: null, completeness: null, recognizedText: null, words: null } } });
    expect(state).toEqual({});
  });
  it("keeps the WAV after a failed save and reports unsaved for every pre-201 phase", () => {
    const state = run({ type: "start", lineId: "L1" }, { type: "recorded", lineId: "L1", original: blob },
      { type: "converted", lineId: "L1", wav: blob, pitch: null }, { type: "saving", lineId: "L1" }, { type: "save-failed", lineId: "L1" });
    expect(state.L1?.wav).toBe(blob);
    expect(hasUnsaved(state)).toBe(true);
    for (const phase of ["recording", "converting", "convert-failed", "saving", "save-failed"] as const) {
      expect(hasUnsaved({ L1: { ...state.L1!, phase } })).toBe(true);
    }
    for (const phase of ["scoring", "scored", "unscored-error"] as const) {
      expect(hasUnsaved({ L1: { ...state.L1!, phase } })).toBe(false);
    }
  });
  it("maps score failures to unscored phases with the retry-after only when given", () => {
    const base = run({ type: "start", lineId: "L1" }, { type: "saved", lineId: "L1", sessionId: "S1", signedUrl: "u" });
    expect(attemptsReducer(base, { type: "score-failed", sessionId: "S1", kind: "throttled", retryAfter: null }).L1)
      .toMatchObject({ phase: "unscored-throttled", retryAfter: null });
    expect(attemptsReducer(base, { type: "score-failed", sessionId: "S1", kind: "unavailable", retryAfter: null }).L1?.phase)
      .toBe("unscored-unavailable");
  });
});
```

Controller test (`components/shadowing-workspace/use-playback-controller.test.tsx`, existing harness): after `controller.setLock({ navigation: true, play: false })`, `seekTo`/`seekToSentence`/`previousSentence`/`nextSentence`/`rewind` that would land on **another** sentence call no adapter `seekTo` and publish no sentence change, while `seekToSentence(<current index>)` still seeks; `play`/`togglePlay` still work; after `setLock({ navigation: true, play: true })` `play` and `togglePlay` call nothing; after `setLock({ navigation: false, play: false })` everything works again. The sentence-end auto-pause (`decideAtSentenceEnd` → `pause`) still runs while locked (it is not a navigation).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pronunciation/attempts.test.ts components/shadowing-workspace/use-playback-controller.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the lock: in `usePlaybackControllerState` add `const lockRef = useRef({ navigation: false, play: false });`; the internal loop replay inside `onTick`/`onStateChange` must still seek, so split `seekTo`: rename the current body to `seekInternal` (used by the loop replay) and make the public `seekTo` refuse only a seek that would **change the sentence**, so "Replay native" (a seek to the current line's start) keeps working while a take is unsaved:

```ts
const seekTo = useCallback((seconds: number, explicitIndex?: number) => {
  if (lockRef.current.navigation) {
    const target = explicitIndex ?? positionAt(seconds).index;
    if (target !== activeRef.current.index) return;
  }
  seekInternal(seconds, explicitIndex);
}, [positionAt, seekInternal]);
```

(add a test: locked, `seekToSentence(current)` seeks; `seekToSentence(current + 1)` does not); `play` and `togglePlay` return early when `lockRef.current.play`; add `setLock: (lock) => { lockRef.current = lock; }` to the controller object and to the `PlaybackController` interface. In the shell: `useEffect(() => controller.setLock({ navigation: hasUnsaved(attempts), play: Object.values(attempts).some((a) => a.phase === "recording") }), [attempts, controller]);` — and clear it (`{ navigation: false, play: false }`) on unmount.

Then implement the reducer: every `lineId` action replaces or updates `state[lineId]` (`start` creates a fresh attempt in `recording`, dropping the previous attempt of that line); every `sessionId` action finds the attempt whose `sessionId` matches (`Object.values(state).find`) and updates only it, returning `state` unchanged when none matches; `discard` deletes the key. The context is a `useReducer` wrapper; the shell mounts `<PronunciationAttemptsProvider>` around the grid content (above `{children}`), so it survives mode switches; the WAV blobs are released when the provider unmounts (leaving the lesson).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pronunciation components/shadowing-workspace`
Expected: PASS (every existing controller test unchanged). Mutations: (a) route `scored` to the *last started* attempt instead of the session owner → the race test fails; (b) make the loop replay call the public `seekTo` → a locked controller stops looping and the auto-pause/loop test fails; restore both.

- [ ] **Step 5: Commit**

```bash
git add lib/pronunciation/attempts.ts lib/pronunciation/attempts.test.ts components/shadowing-workspace
git commit -m "feat(pronunciation): attempt store keyed by line, results routed by session"
```

---

### Task 10: Pronunciation mode body and panel

**Files:**
- Create: `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/pronunciation/page.tsx`
- Create: `components/shadowing-workspace/practice/pronunciation-mode-body.tsx`
- Create: `components/shadowing-workspace/practice/pronunciation-panel.tsx` (+ test)
- Create: `components/shadowing-workspace/practice/pronunciation-details.tsx` (+ test)
- Create: `components/shadowing-workspace/practice/scored-sentence.tsx` (+ test)
- Create: `lib/pronunciation/take-limit.ts` (+ test)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`workspace.practice.pronunciation.*`)

**Interfaces:**
- Consumes: `useRecorder` (`components/video-player/recorder.tsx`: `state`, `blob`, `start`, `stop`, `reset`), `Waveform`, `PitchContourOverlay`, `comparePitchToReference`, `blobToWav16kMono`; attempts store (Task 9); stats (Task 7); navigator/panel (Task 8); `alignWords` (Task 3); `SessionListItem` (Task 4); `usePlaybackController`, `useCurrentSentence`, `useLesson`, `useStartPosition`.
- Produces: `takeLimitSeconds(lines: WorkspaceLine[], index: number, duration: number | null): number`.

- [ ] **Step 1: Write the failing tests**
  - `takeLimitSeconds`: line 2 s → 7 s; line 20 s → 30 s (cap); last line with `endTime: null` and `duration: null` → 30 s; `NaN` never returned (Review Focus 4).
  - `ScoredSentence`: with spans renders one `<mark data-error-type>` per span over the right characters; `spans === null` renders plain text plus the overall remark.
  - Panel (mock `fetch`, `useRecorder`, `blobToWav16kMono`, `comparePitchToReference`):
    1. mic press calls `controller.pause()` **before** `recorder.start()` (Review Focus 5);
    2. recorded → converting → POST `/api/shadowing/session` FormData with `audio` type `audio/wav` and `pitchScore` → POST `/api/pronunciation/score` JSON `{ sessionId }` → stats `refresh()` called → score, label and coloured sentence shown;
    3. save 500 → "Save again" keeps the same WAV (no second recording) and the navigator is disabled;
    4. score 503 → "Pronunciation scoring is unavailable"; the recording plays; no score shown; "Score again" visible;
    5. score 429 with `Retry-After: 12` → "Try again in 12 s"; without the header → "Busy, try again shortly";
    6. score 409 `not_claimable` → refetch `GET /api/shadowing/session?lineId=` and show its state (`scoring` → "Scoring…") (Review Focus 2);
    7. on reload, history item `unscored` shows "Score again" which POSTs `{ sessionId }` of that item; `legacy` shows it disabled with "Older recording format, cannot be rescored";
    8. auto-stop fires at `takeLimitSeconds` (fake timers);
    9. details: hidden by default; expanded shows Accuracy/Rhythm/Completeness, "Intonation (reference, compared with a synthesized voice)" with the overlay when `pitch` exists, `recognizedText`, history; progress line only when ≥ 2 scored items of this line, e.g. "Rhythm 72 → 80"; never with one;
    10. mic denied → the recorder's error copy with the settings hint; no `MediaRecorder` → mic hidden and explained.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/pronunciation/take-limit.test.ts components/shadowing-workspace/practice`
Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
// lib/pronunciation/take-limit.ts
import { effectiveEnd } from "@/lib/shadowing-workspace/sentence-lookup";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
export const MAX_TAKE_SECONDS = 30;
/** Spec §4.2: min(line × 2 + 3 s, 30 s); an open-ended or unknown line gets the cap. */
export function takeLimitSeconds(lines: readonly WorkspaceLine[], index: number, duration: number | null): number {
  const line = lines[index];
  if (!line) return MAX_TAKE_SECONDS;
  const length = effectiveEnd(lines, index, duration) - line.startTime;
  return Number.isFinite(length) && length > 0 ? Math.min(length * 2 + 3, MAX_TAKE_SECONDS) : MAX_TAKE_SECONDS;
}
```

Page:

```tsx
import { PronunciationModeBody } from "@/components/shadowing-workspace/practice/pronunciation-mode-body";
export default function PronunciationModePage() { return <PronunciationModeBody />; }
```

`PronunciationModeBody` renders the empty-transcript state exactly like `ShadowingModeBody` when `transcriptId === null`, otherwise `<PracticePanel label={t("pronunciation.region")} navigator={<SentenceNavigator disabled={unsaved} disabledHint={t("pronunciation.finishSaving")} />} feedback={<PronunciationDetails … />}><PronunciationPanel /></PracticePanel>`, where `unsaved = hasUnsaved(attempts)`.

`PronunciationPanel` flow (the only network sequence):

```ts
async function finishTake(lineId: string, original: Blob) {
  dispatch({ type: "recorded", lineId, original });
  let wav: Blob;
  try { wav = await blobToWav16kMono(original); } catch { dispatch({ type: "convert-failed", lineId }); return; }
  const pitch = await Promise.race([comparePitchToReference(original, lineText), sleep(3000).then(() => null)]);
  dispatch({ type: "converted", lineId, wav, pitch });
  await save(lineId);
}
async function save(lineId: string) {
  const attempt = attemptsRef.current[lineId];
  if (!attempt?.wav) return;
  dispatch({ type: "saving", lineId });
  const form = new FormData();
  form.append("videoId", video.id); form.append("lineId", lineId); form.append("audio", attempt.wav, "take.wav");
  if (attempt.pitch) form.append("pitchScore", String(Math.round(attempt.pitch.score)));
  const response = await fetch("/api/shadowing/session", { method: "POST", body: form }).catch(() => null);
  if (!response || response.status !== 201) { dispatch({ type: "save-failed", lineId }); return; }
  const { data } = (await response.json()) as { data: { id: string; signedUrl: string } };
  dispatch({ type: "saved", lineId, sessionId: data.id, signedUrl: data.signedUrl });
  await score(data.id, lineId);
}
async function score(sessionId: string, lineId: string) {
  dispatch({ type: "scoring", sessionId });
  const response = await fetch("/api/pronunciation/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => null);
  if (response?.ok) { const { data } = await response.json(); dispatch({ type: "scored", sessionId, result: data }); refreshStats(); void reloadHistory(lineId); return; }
  if (response?.status === 409) { void reloadHistory(lineId); return; }
  const retry = response?.headers.get("Retry-After");
  dispatch({ type: "score-failed", sessionId, kind: response?.status === 503 ? "unavailable" : response?.status === 429 ? "throttled" : "error",
    retryAfter: retry && Number.isFinite(Number(retry)) ? Number(retry) : null });
}
```

`attemptsRef` mirrors the store; `lineText` and `lineId` are captured when recording starts (never read from the current sentence after that). Mic press: `controller.pause(); dispatch({ type: "start", lineId }); await recorder.start();` with a `setTimeout(recorder.stop, takeLimitSeconds(...) * 1000)` cleared on stop/unmount; when `recorder.state` becomes `"recorded"` call `finishTake(capturedLineId, recorder.blob)`. Unmount: `useRecorder` already stops tracks; the panel additionally `recorder.stop()`s in a cleanup if recording. History: `GET /api/shadowing/session?lineId=` on line change and after each score; "Score again" on an `unscored` item calls `score(item.id, lineId)`. Replay Native: `controller.seekToSentence(index, { play: true })`. Play my take: an `<audio>` with the attempt's `signedUrl` (or the history item's). Score label thresholds from `lib/summary/thresholds.ts` (`STRONG_PRONUNCIATION_AT` → "Excellent", `REVIEW_PRONUNCIATION_BELOW` → below it "Keep practising", otherwise "Good").

`PronunciationDetails`: a disclosure button (`aria-expanded`) over Accuracy · Rhythm · Completeness (from `assessment`, each hidden when null), the intonation block (label per D14) with `PitchContourOverlay score={pitch}` when the current attempt has one, `recognizedText`, the history list, and the progress line:

```ts
export function progressLine(items: SessionListItem[]): { metric: "pronunciation" | "rhythm"; from: number; to: number } | null {
  const scored = items.filter((item) => item.state === "scored" && item.pronunciationScore !== null); // newest first
  if (scored.length < 2) return null;
  const [latest, previous] = scored as [SessionListItem, SessionListItem];
  if (latest.rhythmScore !== null && previous.rhythmScore !== null && latest.rhythmScore !== previous.rhythmScore)
    return { metric: "rhythm", from: previous.rhythmScore, to: latest.rhythmScore };
  return { metric: "pronunciation", from: previous.pronunciationScore!, to: latest.pronunciationScore! };
}
```

Copy keys (en, vi in the same shape): `region` "Pronunciation practice" / "Luyện phát âm"; `record` "Record" / "Thu âm"; `stop` "Stop" / "Dừng"; `replayNative` "Replay native" / "Nghe giọng mẫu"; `playMine` "Play my take" / "Nghe bản thu của tôi"; `saving` "Saving your take…" / "Đang lưu bản thu…"; `saveAgain` "Save again" / "Lưu lại"; `convertAgain` "Try again" / "Thử lại"; `scoring` "Scoring…" / "Đang chấm…"; `scoreAgain` "Score again" / "Chấm lại"; `unavailable` "Pronunciation scoring is unavailable right now. Your recording is saved." / "Chấm phát âm hiện chưa khả dụng. Bản thu đã được lưu."; `throttledIn` "Try again in {seconds} s" / "Thử lại sau {seconds} giây"; `throttled` "Busy, try again shortly" / "Đang quá tải, thử lại sau"; `legacy` "Older recording format, cannot be rescored" / "Bản ghi định dạng cũ, không chấm lại được"; `noDetail` "No detail recorded for this attempt" / "Không có dữ liệu chi tiết cho lượt này"; `finishSaving` "Finish saving this take first" / "Hãy lưu xong bản thu này trước"; `label.excellent|good|keepPractising` "Excellent|Good|Keep practising" / "Rất tốt|Tốt|Luyện thêm nhé"; `details` "Details" / "Chi tiết"; `accuracy` "Accuracy" / "Độ chính xác"; `rhythm` "Rhythm" / "Nhịp điệu"; `completeness` "Completeness" / "Độ đầy đủ"; `intonation` "Intonation (reference, compared with a synthesized voice)" / "Ngữ điệu (tham khảo, so với giọng máy)"; `heard` "What the scorer heard" / "Máy nghe được"; `history` "This sentence's takes" / "Các lượt thu của câu này"; `progress.rhythm` "Rhythm {from} → {to}" / "Nhịp điệu {from} → {to}"; `progress.pronunciation` "Pronunciation {from} → {to}" / "Phát âm {from} → {to}"; `remarkUnaligned` "Overall score only: the words could not be matched to this sentence reliably." / "Chỉ có điểm tổng: không khớp được từng từ với câu một cách đáng tin."

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/pronunciation components/shadowing-workspace messages`
Expected: PASS. Mutations: (a) drop `controller.pause()` before `start` → test 1 fails; (b) read `lineId` from the current sentence in `save` → the race variant of test 2 (line changes during save) fails; restore both.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/pronunciation" components/shadowing-workspace/practice lib/pronunciation messages
git commit -m "feat(pronunciation): pronunciation mode - record, save, score, details, history"
```

---

### Task 11: Unsaved-take guard

**Files:**
- Create: `components/shadowing-workspace/practice/unsaved-take-guard.tsx` (+ test)
- Modify: `components/shadowing-workspace/workspace-shell.tsx` (mount the guard inside the attempts provider, with `rootRef`)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`workspace.practice.leave.*`)

**Interfaces:**
- Consumes: `hasUnsaved`, `usePronunciationAttempts` (Task 9), `Dialog` (`components/ui/dialog.tsx`: `open`, `onClose`, `title`, `description`, `children`, `closeLabel`), `useRouter` from `@/lib/i18n/navigation`.
- Produces: `<UnsavedTakeGuard rootRef />`.

- [ ] **Step 1: Write the failing test**: with an attempt in each of the five unsaved phases, `window` gets a `beforeunload` listener whose event has `preventDefault` called; with `scoring` none is attached; a click on any `a[href]` inside `rootRef` (mode bar link, header back link) is prevented and opens the dialog; "Leave and discard" dispatches `discard` for the unsaved lines and `router.push(href)`; "Stay" closes and does not navigate; a modifier-click (`ctrlKey`/`metaKey`) or `target="_blank"` link is left alone.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shadowing-workspace/practice/unsaved-take-guard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/i18n/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hasUnsaved, UNSAVED_PHASES } from "@/lib/pronunciation/attempts";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";

/** Spec §4.6: every state before the server's 201 warns on reload/close and confirms any in-workspace link. */
export function UnsavedTakeGuard({ rootRef }: { rootRef: React.RefObject<HTMLElement> }) {
  const t = useTranslations("shadowing.workspace.practice.leave");
  const router = useRouter();
  const { attempts, dispatch } = usePronunciationAttempts();
  const blocking = hasUnsaved(attempts);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!blocking) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocking]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !blocking) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || !root.contains(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(anchor.getAttribute("href"));
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [blocking, rootRef]);

  const leave = () => {
    for (const attempt of Object.values(attempts)) if (UNSAVED_PHASES.has(attempt.phase)) dispatch({ type: "discard", lineId: attempt.lineId });
    const href = pending;
    setPending(null);
    if (href) router.push(href);
  };
  return (
    <Dialog open={pending !== null} onClose={() => setPending(null)} title={t("title")} description={t("body")} closeLabel={t("stay")}>
      <div className="flex justify-end gap-sm">
        <Button variant="ghost" onClick={() => setPending(null)}>{t("stay")}</Button>
        <Button onClick={leave}>{t("discard")}</Button>
      </div>
    </Dialog>
  );
}
```

`href` from a next-intl `Link` already carries the locale prefix; `router.push` from `@/lib/i18n/navigation` expects a locale-less path — strip a leading `/${locale}` with `usePathname`-free logic: `href.replace(/^\/(en|vi)(?=\/|$)/, "") || "/"` (the locales from `lib/i18n/routing`). Check the `Button` variant names in `components/ui/button.tsx` before using `ghost`. Copy (en/vi): `title` "Leave this take unsaved?" / "Bỏ bản thu chưa lưu?"; `body` "This recording has not been saved yet. If you leave, it will be discarded." / "Bản thu này chưa được lưu. Nếu rời đi, nó sẽ bị bỏ."; `stay` "Stay" / "Ở lại"; `discard` "Leave and discard" / "Rời đi và bỏ bản thu".

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shadowing-workspace messages`
Expected: PASS. Mutation: remove `"saving"` from `UNSAVED_PHASES` → the guard test for `saving` fails; restore.

- [ ] **Step 5: Commit**

```bash
git add components/shadowing-workspace messages
git commit -m "feat(pronunciation): guard unsaved takes on reload and in-workspace navigation"
```

---

### Task 12: "Practice this sentence"

**Files:**
- Modify: `components/shadowing-workspace/transcript-row.tsx` (optional `onPractice?(position: number): void`, a button in the actions toolbar after Replay)
- Modify: `components/shadowing-workspace/transcript-panel.tsx` (pass the handler only when the `pronunciation` mode is complete)
- Modify: `components/shadowing-workspace/player-glyphs.tsx` (a `MicGlyph` if none exists — reuse an existing mic glyph first: `grep -rn "Mic" components/shadowing-workspace/player-glyphs.tsx components/ui`)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`workspace.transcript.practice`: "Practice this sentence" / "Luyện câu này")
- Test: `components/shadowing-workspace/transcript-panel.test.tsx`

**Interfaces:**
- Consumes: `LEARNING_MODES` (`lib/shadowing-workspace/learning-modes.ts`), `usePlaybackController().seekToSentence`, `useRouter` from `@/lib/i18n/navigation`, `useLesson().video.id`.

- [ ] **Step 1: Write the failing test**: with `pronunciation.complete` true (inject `modes` like `mode-nav.test.tsx` does, or mock the module), clicking row 7's "Practice this sentence" calls `seekToSentence(6)` and then `router.push("/shadowing/<videoId>/pronunciation")`, in that order; with the mode incomplete the button is absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shadowing-workspace/transcript-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**: in the panel

```ts
const practiceAvailable = LEARNING_MODES.some((mode) => mode.id === "pronunciation" && mode.complete);
const onPractice = useCallback((position: number) => {
  controller.seekToSentence(position);
  router.push(`/shadowing/${video.id}/pronunciation`);
}, [controller, router, video.id]);
```

pass `onPractice={practiceAvailable ? onPractice : undefined}`; the row renders the button only when `onPractice` is defined (memoisation unchanged: the callback is stable).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shadowing-workspace messages`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/shadowing-workspace messages
git commit -m "feat(workspace): practice this sentence opens Pronunciation on that line"
```

---

### Task 13: Summary adapters and Mission copy

**Files:**
- Modify: `lib/summary/snapshot.ts` (+ `snapshot.test.ts`, `load-snapshot.test.ts`)
- Modify: `lib/summary/thresholds.ts` (+ test), `lib/summary/reflection/fallback.ts` (+ test), `lib/summary/reflection/evidence.ts` (only if it switches on kinds — read it)
- Modify: `components/lesson-summary/lesson-status-card.tsx` (+ test if present)
- Modify: `lib/data/dashboard/mission.ts` (`shadow_lines` href)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`lessonSummary.status.reached`), `messages/en/dashboard.json`, `messages/vi/dashboard.json` (`mission.item.shadow`)

**Interfaces:**
- Consumes: evidence key `reachedLine` (Task 1).
- Produces: `ModeState` gains `{ kind: "reached"; line: number; total: number }`; `lessonEvidenceSchema` replaces `shadowedLines` with `reachedLine: numeric`.

- [ ] **Step 1: Write the failing tests**
  - snapshot: `reachedLine 0` → `not_started`; `reachedLine 51, lineCount 194` → `{ kind: "reached", line: 51, total: 194 }`; `reachedLine === lineCount` → still `reached` (never `complete`, D7).
  - `modeQuality("shadowing", reached)` → `"practiced"` (never `"strong"`).
  - fallback: `reached` → `{ kind: "state", state: "in_progress" }`.
  - status card renders "Watched to sentence 51/194" / "Đã xem đến câu 51/194".
  - mission: `shadow_lines` href is `/shadowing/<id>/pronunciation`; copy en "{target, plural, one {Practise speaking {target} sentence} other {Practise speaking {target} sentences}}", vi "{target, plural, other {Luyện nói {target} câu}}".

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/summary components/lesson-summary lib/data/dashboard components/dashboard`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
function shadowingState(evidence: LessonEvidence): ModeState {
  if (evidence.lineCount === 0 || evidence.reachedLine === 0) return { kind: "not_started" };
  return { kind: "reached", line: Math.min(evidence.reachedLine, evidence.lineCount), total: evidence.lineCount };
}
```

`thresholds.ts` shadowing branch: `state.kind === "complete" ? "strong" : state.kind === "in_progress" || state.kind === "reached" ? "practiced" : "not_started"`. Fallback: `shadowing === "in_progress" || shadowing === "reached" ? "in_progress" : …`. Status card switch adds `case "reached": return t("reached", { line: state.line, total: state.total });` with copy "Watched to sentence {line}/{total}" / "Đã xem đến câu {line}/{total}". Mission href: in `lib/data/dashboard/mission.ts` the `row.type === "shadow_lines"` branch becomes `` `/shadowing/${row.video_id}/pronunciation` ``.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/summary components/lesson-summary lib/data/dashboard components/dashboard messages`
Expected: PASS. Mutation: return `complete` when `reachedLine >= lineCount` → the "never complete" test fails; restore.

- [ ] **Step 5: Commit**

```bash
git add lib/summary components/lesson-summary lib/data/dashboard messages
git commit -m "feat(summary): watched-to-sentence shadowing state, speaking mission copy and link"
```

---

### Task 14: Switch the mode on, delete the orphan, E2E

**Files:**
- Modify: `lib/shadowing-workspace/learning-modes.ts` (`pronunciation.complete: true`, D24) and `lib/shadowing-workspace/learning-modes.test.ts` / `components/shadowing-workspace/mode-nav.test.tsx` if they pin the old value
- Delete: `components/video-player/shadowing-recorder-panel.tsx` and its test — only after `grep -rn "ShadowingRecorderPanel\|shadowing-recorder-panel" app components lib tests` shows no importer
- Create: `tests/e2e/fixtures/speech-stub.mjs`
- Modify: `playwright.config.ts` (`webServer` becomes an array: the stub on port 3999, and the app with `AZURE_SPEECH_RECOGNITION_URL=http://127.0.0.1:3999/recognize`)
- Modify: `lib/speech-scoring/config.ts` (`recognitionEndpoint` returns `process.env.AZURE_SPEECH_RECOGNITION_URL` when set — a generic override, documented as test/dev only)
- Create: `tests/e2e/practice-pronunciation.spec.ts`

**Interfaces:**
- Consumes: `seedWorkspaceData`, `installFakeYouTube`, `fakeYt` (`tests/e2e/fixtures/*`), everything above.

- [ ] **Step 1: Speech stub** `tests/e2e/fixtures/speech-stub.mjs`: a `node:http` server on 3999. `POST /recognize` answers according to a mode set by `POST /__mode` (`{ "mode": "success" | "429" | "429-no-header" | "503" | "slow" }`, default `success`): success returns `{ RecognitionStatus: "Success", DisplayText: "今日は雨です。", NBest: [{ Display: "今日は雨です。", PronunciationAssessment: { PronScore: 86, FluencyScore: 80, AccuracyScore: 88, CompletenessScore: 100 }, Words: [{ Word: "今日", PronunciationAssessment: { AccuracyScore: 90, ErrorType: "None" } }, { Word: "は", PronunciationAssessment: { AccuracyScore: 90, ErrorType: "None" } }, { Word: "雨", PronunciationAssessment: { AccuracyScore: 40, ErrorType: "Mispronunciation" } }, { Word: "です", PronunciationAssessment: { AccuracyScore: 90, ErrorType: "None" } }] }] }`; `429` sets `Retry-After: 12`; `slow` waits 35 s (beyond the 30 s timeout). `GET /__calls` returns the count of `/recognize` calls.

- [ ] **Step 2: Write the E2E spec** (`test.use({ viewport: { width: 1280, height: 529 }, permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } })`; reuse `registerLearner`/`openLesson` patterns from `tests/e2e/shadowing-workspace.spec.ts`; block the pitch TTS request with `page.route(/\/api\/speech\/tts/, (r) => r.abort())`):
  1. **One player instance (B1 gate):** open Shadowing, `fakeYt(page).mounts === 1`; set `data-instance-marker` on `[data-testid="fake-yt"]` via `evaluate`; click the mode bar "Pronunciation"; the marker is still present and `mounts` is still 1; back to "Shadowing": same.
  2. **Record → save → score:** on line 1, press Record, wait 1.5 s, Stop; expect "Scoring…" then the score 86 and a `mark[data-error-type="Mispronunciation"]` over 雨; the navigator chip for sentence 1 reads "scored 86"; the stat strip reads "Scored 1/…".
  3. **Reload keeps history:** reload; open Details; the take is listed as scored with Accuracy 88 and Completeness 100.
  4. **503 then rescore:** `/__mode 503`; record a take; "Pronunciation scoring is unavailable…" and the take plays (audio element has a `src`); `/__mode success`; "Score again" → 86.
  5. **429 with and without header:** shows "Try again in 12 s", then "Busy, try again shortly".
  6. **Unsaved guard:** route `/api/shadowing/session` to a 500; record; the mode bar click opens "Leave this take unsaved?"; "Stay" keeps the URL; "Leave and discard" navigates. Then browser Back during `save-failed` (Review Focus 1): unroute, record with the 500 route, `page.goBack()` to Shadowing, `page.goForward()` → "Save again" is still offered and saves on click.
  7. **Practice this sentence:** in Shadowing, hover row 3, click "Practice this sentence" → URL ends `/pronunciation` and the current sentence is 3 (stat strip "Sentence 3/…").
  8. **Sentence-bound playback:** in Pronunciation press "Replay native" → the fake player plays from line start and pauses at line end (`fakeYt` state PAUSED after `advance` past the end); back in Shadowing the loop pill shows the learner's previous loop setting.
  9. **Navigation lock while unsaved:** with the session route returning 500 after a take, ArrowRight, the player's Next button and a navigator chip leave the current sentence unchanged; after "Save again" succeeds (unroute) they move it.

  The D25 privilege refusal is proven in the DB gate (Task 1 case 1), which exercises the same `authenticated` role PostgREST uses; it is not repeated here.

- [ ] **Step 3: Run E2E**

Run: `npx playwright test tests/e2e/practice-pronunciation.spec.ts tests/e2e/shadowing-workspace.spec.ts tests/e2e/summary.spec.ts`
Expected: PASS (Shadowing workspace and Summary specs unchanged and green). Then the full suite `npx playwright test`; only the known master reds may fail (landing-page :287/:608/:700, summary :29) — list them in the run state.

- [ ] **Step 4: Commit**

```bash
git add lib/shadowing-workspace components tests/e2e playwright.config.ts lib/speech-scoring/config.ts
git commit -m "feat(pronunciation): switch the mode on, retire the orphaned recorder panel, E2E"
```

---

### Task 15: Gates, live smoke, Chrome, review, owner look

**Files:**
- Create: `scripts/smoke/practice-pronunciation-live.ts`
- Modify: `docs/superpowers/run-state/practice-pronunciation.md`

- [ ] **Step 1: Full gates after the last edit**

Run: `npx tsc --noEmit; npm run lint; npx vitest run --minWorkers=1 --maxWorkers=2; npm run verify:protocol; npm run verify:db:practice; npm run verify:db:summary; npm run verify:db:dashboard; npm run verify:db:erasure; npm run verify:db:shadowing`
Expected: all exit 0. Then the typography gate (`tests/e2e/typography.spec.ts`, G4) with the new route included in `tests/e2e/typography/learner.ts` (`/shadowing/<id>/pronunciation`).

- [ ] **Step 2: Live Azure smoke** `scripts/smoke/practice-pronunciation-live.ts` (vite-node, like the dashboard demo seed): creates a dedicated learner `smoke.practice+<timestamp>@korume.local` with the service client, logs in through the Supabase client, posts a real WAV of a spoken Ep.729 line (fixture path passed as an argument, not committed) to the running worktree server (`next dev -p 3100`), scores it against real Azure, reads the history back, asserts `state: "scored"` and a non-null `assessment`, then deletes the learner (cascade + storage object). Run it; paste its output in the run state. No real learner row is touched.

- [ ] **Step 3: Chrome measure** (worktree server only): 1280×529, 1440×900, 1920×1080, nav collapsed: the sentence, mic, score and Replay/Play-mine buttons are above the fold at 1280×529; the panel scrolls, the workspace does not (`document.scrollingElement.scrollHeight === innerHeight`); the stat strip compacts when the divider is dragged left; no horizontal scroll. Record the numbers.

- [ ] **Step 4: Whole-branch review**: dispatch `code-reviewer` on `git diff master...practice-pronunciation` with the spec, this plan and the Review Focus list; fix findings in a fix wave; a separate review of the fix wave; full vitest after the last fix.

- [ ] **Step 5: Run state + owner look**: update `docs/superpowers/run-state/practice-pronunciation.md` (accepted commits, verification, legacy counts from Task 1 Step 0, coverage numbers, known reds), commit, and ask the owner for the Chrome look (Docker + `npx supabase start`, `npx next dev -p 3100` in the worktree; the owner signs in). Merge only after the owner approves.

```bash
git add docs/superpowers/run-state/practice-pronunciation.md scripts/smoke
git commit -m "docs(practice-pronunciation): run state - gates, smoke, measurements, ready for the owner's look"
```
