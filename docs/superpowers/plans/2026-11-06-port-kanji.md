# Port Kanji — inspect (modal + page) and kanji review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vietnamese learner opens any of the 13,108 dictionary kanji as a URL-addressable modal (or the
`/kanji/[literal]` page) showing Hán Việt, Thiều Chửu, stroke order, composition, words and their own lesson lines,
can favorite it or add it to SRS, and reviews it in a `(focus)` flashcard screen.

**Architecture:** Data first: two new `dict_kanji` columns filled by the importer (`vi_readings` from KANJIDIC2,
`tc_lines` resolved once at import from a pinned Thiều Chửu copy), kanji SRS re-keyed from `kanji_id` to the literal,
a favorites table, and two invoker SQL functions over transcript lines. One payload builder
(`getKanjiInspectPayload`) feeds both the API (modal) and the server page; one client component renders it. The modal
is a `?kanji=` query param read by a client component mounted in the `(protected)` layout.

**Tech Stack:** Next.js 14.2 App Router, next-intl, Supabase Postgres (RLS), zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-port-kanji-design.md` (rev `3f0e18ac`). Read it before any task.

## Global Constraints

- Work only in `.worktrees/port-kanji` (absolute paths, `Set-Location` in the same call). Never build, serve or
  `npm ci` in the main checkout. Serena's edit tools patch the MAIN checkout from a worktree — edit with the built-in
  Edit/Write tools on worktree paths.
- No Vietnamese meaning text from a model, anywhere (code, seed, messages, tests). Hán Việt = KANJIDIC2
  `r_type="vietnam"`; classical meaning = Thiều Chửu `tc` only, never the `e` field.
- Thiều Chửu license is UNVERIFIED: `tc_lines` must not reach a production database (Task 2 enforces it in the CLI).
- Frame CTAs without a destination (Open Vocabulary, Practice Writing, Find Similar Kanji) are links to `/` via one
  `PLACEHOLDER_HREF` constant — not removed, not plain text, not disabled. `/vocab` stays hidden (A10).
- Type on the shared `--text-*` tokens (L-052); layout scales to the frame (L-051); app theme, not the frame's dark.
- Every new user-owned table: FK `users on delete cascade`, RLS own-rows, listed in the erase gate and the export.
  Every new SQL function: `revoke execute … from public, anon`.
- RSC → client props are plain data (guard with a `structuredClone` test).
- Do not reopen: CTA → `/`, kanji SRS identity = literal, default review deck semantics (spec §4.3).
- Vitest: `npx vitest run <paths> --minWorkers=1 --maxWorkers=2`. E2E once per task, at the task's end.
- Lint, typecheck and the task's tests are re-run by the controller after every subagent report.

## Review Focus

1. **Non-BMP kanji** (`𠮟`, U+20B9F) in `?kanji=`, the API, favorites and the SRS key → accepted end to end
   (`char_length = 1` counts code points). Pinned in Task 3 (validation) and Task 4 (favorites route).
2. **Add to Review on a kanji already in review** (double click, two tabs) → no-op; the existing SRS state is never
   reset. Pinned in Task 4.
3. **Garbage `?kanji=`** (`abc`, `日本`, `%E0%A4`) → no modal, the page underneath unaffected, no history entry
   added. Pinned in Task 6.
4. **Kanji with missing blocks** (`畑`: no Thiều Chửu; a kanji without KanjiVG strokes; no lesson lines) → each
   block hides, empty-state line when both lesson blocks are empty. Pinned in Task 7.
5. **Due counts after the re-key** → dashboard due count and the default deck include dictionary-only literals and
   freshly added rows. Pinned in Task 3 (`user-stats` + `review_due_keys`).

---

## File map

| Path | Task | Responsibility |
|---|---|---|
| `supabase/migrations/20261106000053_port_kanji_dictionary.sql` | 1 | `dict_kanji.vi_readings`, `dict_kanji.tc_lines` |
| `lib/dictionary/import/kanjidic.ts`, `stage.ts`, `scripts/import-dictionaries.ts` | 1, 2 | parse `vi`, stage both columns, `--force`, `--thieu-chuu` |
| `lib/dictionary/import/thieu-chuu.ts` (+ test) | 2 | load shards, resolve lines for a literal |
| `lib/dictionary/import/kyujitai.json` (+ `kyujitai.test.ts`) | 2 | 常用漢字表 new → old forms |
| `supabase/migrations/20261106000054_kanji_progress_literal.sql` | 3 | re-key progress, reviews/lapses, keys rewrite, `review_due_keys` |
| `lib/validation/content.ts`, `lib/data/srs.ts`, `lib/data/kanji-review.ts` (new) | 3 | literal validation, submit, kanji queue |
| `supabase/migrations/20261106000055_kanji_favorites.sql` | 4 | `user_kanji_favorites` |
| `lib/data/kanji-learner.ts` (new), `app/api/kanji/favorites/[literal]/route.ts`, `app/api/kanji/progress/[literal]/route.ts` | 4 | favorite, add to review, learner state |
| `supabase/migrations/20261106000056_kanji_lesson_index.sql`, `lib/data/kanji-lessons.ts`, `app/api/kanji/examples/[literal]/route.ts` | 5 | examples + appears-in-lessons |
| `supabase/tests/port-kanji.sql`, `scripts/verify-port-kanji-gate.ps1`, `package.json` (`verify:db:kanji`) | 3–5 | DB gate |
| `lib/kanji/href.ts`, `lib/kanji/context.ts`, `components/kanji/use-kanji-modal-history.ts`, `components/kanji/kanji-inspect-modal.tsx` | 6 | modal routing |
| `components/kanji/kanji-inspect.tsx` (+ block files as the builder splits) | 7 | inspect content, modal + page |
| `app/[locale]/(protected)/(focus)/kanji/review/page.tsx`, `components/kanji/kanji-review-session.tsx` | 9 | review screen |
| `docs/superpowers/run-state/port-kanji.md` | 1 | run state (TEMPLATE.md shape) |

Next migration number on master is `053` (last: `20261105000052_korume_answer_schema_version.sql`).

---

### Task 1: Hán Việt readings in the dictionary

**Files:**
- Create: `supabase/migrations/20261106000053_port_kanji_dictionary.sql`, `docs/superpowers/run-state/port-kanji.md`
- Modify: `lib/dictionary/import/kanjidic.ts`, `lib/dictionary/import/stage.ts`, `scripts/import-dictionaries.ts`,
  `lib/dictionary/types.ts`, `lib/dictionary/kanji-data-service.ts`, `supabase/tests/dictionary.sql`
- Test: `lib/dictionary/import/kanjidic.test.ts`, `lib/dictionary/import/stage.test.ts`, `lib/dictionary/kanji-data-service.test.ts`

**Interfaces:**
- Produces: `KanjidicRow.vi: string[]`; columns `dict_kanji.vi_readings text[] not null default '{}'` and
  `dict_kanji.tc_lines text[] not null default '{}'` (both in this migration; Task 2 fills `tc_lines`);
  `importDictionaries(client, sources, { force?: boolean, … })` — `force: true` skips the `no-change` return;
  `KanjiData.hanViet: string[]`, `KanjiData.tcLines: string[]`, `KanjiData.oldJlpt: number | null`.

- [ ] **Step 1: Write the run-state file** from `docs/superpowers/run-state/TEMPLATE.md` (goal, spec + plan paths,
  Owner: Claude, next action = Task 1). Commit with the task.
- [ ] **Step 2: Failing tests.** `kanjidic.test.ts`: a fixture `<character>` with
  `<reading r_type="vietnam">Nhật</reading><reading r_type="vietnam">Nhựt</reading>` yields `vi: ["Nhật", "Nhựt"]`;
  a character without one yields `vi: []`. `stage.test.ts`: the `dict_kanji` insert record carries
  `vi_readings: row.vi`; with identical hashes `importDictionaries(…, { force: true })` does NOT return
  `{ status: "no-change" }`. `kanji-data-service.test.ts`: `getKanjiData` maps `vi_readings → hanViet`,
  `tc_lines → tcLines`, `jlpt_old → oldJlpt`.
- [ ] **Step 3: Run** `npx vitest run lib/dictionary --minWorkers=1 --maxWorkers=2` → the new cases FAIL.
- [ ] **Step 4: Implement.** Migration adds the two columns. Parser: `vietnam` readings push to `vi`, values as in
  the source. Stage maps `vi_readings`. CLI: `--force` → `{ force: true }`. Service selects the three columns.
- [ ] **Step 5: DB gate.** `supabase/tests/dictionary.sql` asserts both columns exist, are `text[] not null` with
  default `'{}'`. Apply locally with `npx supabase migration up`, run `npm run verify:db:dictionary` → PASS.
- [ ] **Step 6: Re-import** (local DB only):
  `npm run dict:import -- --force --jmdict … --kanjidic … --kanjivg …` with the files in
  `C:\Users\tplon\Desktop\Japan\Korume\DataKanji\` and the version/url/license values of the active `dict_imports`
  rows (read them with one `select source, source_version, source_url, license from dict_imports` first).
  Expected: `activated <id>`; then `select count(*) from dict_kanji k join dict_snapshots s on s.id = k.snapshot_id
  where s.status = 'active' and cardinality(k.vi_readings) > 0` → **11068**.
- [ ] **Step 7: Run** vitest for `lib/dictionary`, `npm run typecheck`, `npm run lint` → clean. Commit
  `feat(kanji): Han-Viet readings from KANJIDIC2 + dict import --force`.

### Task 2: Thiều Chửu lines resolved at import

**Files:**
- Create: `lib/dictionary/import/thieu-chuu.ts`, `lib/dictionary/import/thieu-chuu.test.ts`,
  `lib/dictionary/import/kyujitai.json`, `lib/dictionary/import/kyujitai.test.ts`
- Modify: `lib/dictionary/import/stage.ts`, `scripts/import-dictionaries.ts`, `lib/dictionary/import/stage.test.ts`

**Interfaces:**
- Consumes: `dict_kanji.tc_lines` (Task 1).
- Produces:
  - `THIEU_CHUU_SOURCE = { repo: "github.com/anhthommo/thonutiengtrung", sha: "7357ad9d1aa234d5e7e8514d317e83917746a80b", credit: "Thiều Chửu, Hán Việt tự điển (1942)" } as const`
  - `loadThieuChuu(dir: string): Promise<Map<string, string[]>>` — key = the character, value = `tc` lines.
  - `resolveTcLines(literal: string, index: Map<string, string[]>, oldForms: Record<string, string[]>): TcResolution`
  - `type TcResolution = { lines: string[]; via: "direct" | "kyujitai" | "none"; unresolved: null | "missing-target" | "chained" }`
  - `ImportSources.thieuChuu?: { resolve(literal: string): TcResolution }`; `importDictionaries` options gain
    `minTcCoverage?: number` (default `0.95`); `ImportResult` `activated` counts gain
    `tc: { oldJlpt: number; covered: number; unresolved: string[] }`.

Source facts (measured 2026-11-06 at the pinned SHA): 64 shards `public/dict/00.json … 3f.json`; shard =
`codePoint % 64` as two lowercase hex digits; key = code point as lowercase hex without prefix; entry
`{ e?: …, hv?: string, tc?: string[] }`; 14,024 keys, 10,717 with `tc`. Redirect first lines seen:
`Giản thể của chữ X.` (1,983), `Dị dạng của chữ X.` (47), `Một dạng của chữ X.` (10), `Một cách viết của chữ X.`,
`Một dị dạng của chữ X.`; the target may be in `[ ]`. Coverage over the 2,230 old-JLPT kanji: 2,052 direct + 144 via
kyūjitai = **98.5 %**.

- [ ] **Step 1: Download the source** (outside the repo):
  `C:\Users\tplon\Desktop\Japan\Korume\DataKanji\thieu-chuu\` ← the 64 files from
  `https://raw.githubusercontent.com/anhthommo/thonutiengtrung/<sha>/public/dict/<xx>.json`. Expected: 64 files, ~12 MB.
- [ ] **Step 2: Build `kyujitai.json`** — `{ "_source": "常用漢字表 (2010) old forms, via en.wikipedia.org/wiki/List_of_jōyō_kanji rev <revid>", "pairs": { "気": ["氣"], … } }`.
  Extract from the page wikitext (`index.php?title=List_of_j%C5%8Dy%C5%8D_kanji&action=raw`): for each row matching
  `^\|\d+\|\|style="font-size:2em"\|\[\[wikt:(.)#Japanese\|.\]\]\|\|style="font-size:2em"\|(.*?)\|\|style`, the old
  forms are every `\[\[wikt:(.)#Japanese` in group 2 that differs from group 1. Never type a pair by hand.
  Expected: 296 keys, one with two old forms. Record the revision id in `_source`.
- [ ] **Step 3: Failing tests.** `kyujitai.test.ts`: 296 keys; `気→["氣"]`, `駅→["驛"]`, `円→["圓"]`, `関→["關"]`.
  `thieu-chuu.test.ts` with an in-memory index:
  - direct: `日` → its lines, `via: "direct"`;
  - kyūjitai: `気` absent, `氣` present → `氣`'s lines, `via: "kyujitai"`;
  - redirect: `学: ["Giản thể của chữ 學.", "Bắt chước…"]`, `學: ["Bắt chước…", "Chỗ học…"]` →
    `["Bắt chước…", "Chỗ học…"]` (target lines first, then the original's remaining lines not already present; the
    redirect line itself dropped);
  - bracket target `Dị dạng của chữ [绿].` resolves `绿`;
  - missing target → original lines unchanged, `unresolved: "missing-target"`;
  - chained (target's first line is again a redirect) → original lines unchanged, `unresolved: "chained"`;
  - none: `畑` → `{ lines: [], via: "none", unresolved: null }`.
  `loadThieuChuu` on a temp dir with two tiny shards maps `"65e5"` → `日`.
  `stage.test.ts`: `tc_lines` carries `resolve(literal).lines`; with `thieuChuu` given and coverage below
  `minTcCoverage` over rows with `jlptOld !== null`, the import throws `StagingImportError` and
  `dict_activate_snapshot` is never called.
- [ ] **Step 4: Run** → FAIL.
- [ ] **Step 5: Implement.** Redirect pattern (one constant):
  `/^(?:Giản thể|Dị dạng|Một dạng|Một cách viết|Một dị dạng) của chữ \[?(\p{Script=Han})\]?\.?$/u`. One hop only.
  Coverage is counted while staging `dict_kanji` and checked before activation. CLI: `--thieu-chuu <dir>` wires
  `resolve`; **if `--thieu-chuu` and `--allow-remote` are both present, exit 1 with
  `Thiều Chửu data is not cleared for a remote database (spec §4.2 license status)`** before any write. Print the
  coverage and the unresolved literals.
- [ ] **Step 6: Run** the tests → PASS. Re-import locally with `--force --thieu-chuu <dir>`. Expected log:
  coverage ≥ 0.95 (≈ 0.985); `select tc_lines from dict_kanji … where literal = '気'` → `氣`'s lines.
- [ ] **Step 7:** typecheck, lint. Commit `feat(kanji): Thieu Chuu lines resolved at import (license-gated)`.

### Task 3: Kanji SRS keyed by literal

**Files:**
- Create: `supabase/migrations/20261106000054_kanji_progress_literal.sql`, `lib/data/kanji-review.ts`,
  `lib/data/kanji-review.test.ts`, `supabase/tests/port-kanji.sql`, `scripts/verify-port-kanji-gate.ps1`
- Modify: `package.json` (`"verify:db:kanji": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-port-kanji-gate.ps1"`),
  `lib/validation/content.ts`, `lib/data/srs.ts`, `lib/data/user-stats.ts`, `lib/data/badge-snapshot.ts`,
  `lib/data/user-export.ts`, `app/[locale]/(protected)/(app)/kanji/review/page.tsx` (switch to the new queue only),
  and every test/fixture in spec §4.3's reference list.

**Interfaces:**
- Produces:
  - `srsReviewSchema` = discriminated union on `itemType`: `{ itemType: "vocab", itemId: uuid }` |
    `{ itemType: "kanji", itemId: string refined by parseKanjiLiteral(v) === v }`; same `quality` rule.
    `SrsReviewInput` stays the inferred type.
  - `user_kanji_progress(user_id, literal text not null check (char_length(literal) = 1), srs_stage, next_review_at,
    ease_factor, last_reviewed_at, interval_days, reviews int not null default 0, lapses int not null default 0,
    primary key (user_id, literal))`.
  - `interface KanjiReviewCard { literal: string; hanViet: string[]; meaningsEn: string[]; meaningVi: string | null; on: string[]; kun: string[]; level: string | null }`
  - `getKanjiReviewQueue(opts: { level?: JlptLevel; focus?: string; limit?: number; now?: Date }): Promise<KanjiReviewCard[]>`
    (default `limit` 20).
  - `getReviewQueue` keeps its signature for `vocab`; its kanji branch is removed (callers move to the new function).

- [ ] **Step 1: Failing DB tests** in `supabase/tests/port-kanji.sql` (gate script = copy of
  `scripts/verify-listening-gate.ps1` pointed at this file):
  - seed two users with progress rows on two curated kanji, then apply the migration's logic → row count equal and
    every column (`srs_stage, next_review_at, ease_factor, last_reviewed_at, interval_days`) identical, keyed by
    `kanji.character`; `reviews = 0`, `lapses = 0`;
  - `learning_outcomes.item_key` and `daily_mission_eligible.item_key` `'kanji:<uuid>'` → `'kanji:<character>'`;
  - `review_due_keys(u, '{kanji}', now())` emits `'kanji:' || literal` and includes a non-curated literal row (`𠮟`);
  - `insert … literal = '日本'` fails the check; `'𠮟'` passes;
  - erase: deleting the `users` row removes the progress rows (`account-erasure.sql` allowlist row unchanged).
- [ ] **Step 2: Failing unit tests.**
  - `content.test.ts` (or the schema's existing test): kanji `itemId: "日"` and `"𠮟"` parse; kanji `"abc"`, `"日本"`,
    a uuid → fail; vocab uuid parses, vocab `"日"` fails.
  - `srs.test.ts`: kanji review of a literal absent from the active snapshot's `dict_kanji` → `{ ok: false, status: 400 }`
    with no upsert; a kanji review upserts on `user_id,literal`, increments `reviews`, and increments `lapses` only for
    quality 1; `recordActivity` receives `{ itemType: "kanji", itemId: "日" }`.
  - `kanji-review.test.ts`: no level → due rows of any literal (soonest first) then fresh curated (stroke order);
    `level: "N5"` → only N5 curated, due first then fresh; `focus: "𠮟"` with and without `level` → `𠮟` first, once;
    rows scheduled in the future are held back; an empty result is `[]`. Card fields come from the active
    snapshot's `dict_kanji` (`vi_readings`, `meanings_en`, `on_readings`, `kun_readings`) plus curated
    `meaning_vi`/`jlpt_level`.
  - `user-stats.test.ts`: the kanji due count uses `getKanjiReviewQueue` and counts a dictionary-only due row.
- [ ] **Step 3: Run** both → FAIL.
- [ ] **Step 4: Migration.** Add `literal`, backfill `from kanji k where k.id = kanji_id`, `set not null`, add the
  check, drop PK, add PK `(user_id, literal)`, drop `kanji_id`, add `reviews`/`lapses`. Rewrite both `item_key`
  tables with `'kanji:' || k.character` via `from kanji k where item_key = 'kanji:' || k.id`. `create or replace
  function review_due_keys` with `'kanji:' || k.literal` (keep its security, grants and revokes exactly). The index on
  `(user_id, next_review_at)` and the RLS policy stay.
- [ ] **Step 5: Code.** `PROGRESS.kanji.fk = "literal"`; `submitReview` kanji branch checks the literal in
  `dict_kanji` of `getActiveSnapshotId()` instead of `from("kanji")`, reads and writes `reviews`/`lapses`.
  `badge-snapshot.ts` selects `literal`; `user-export.ts` key columns `["user_id", "literal"]` and the history row
  labels with the `literal` column (no `kanji ( character )` join). Move every fixture/test in spec §4.3's list to
  `literal`.
- [ ] **Step 6: Run** `npx supabase migration up`, `npm run verify:db:kanji`, `npm run verify:db:dashboard`,
  `npm run verify:db:erasure`, `npm run verify:db:profile`, the mission-race test as its README/script says, and
  vitest for `lib/data lib/validation lib/gamification` → PASS. typecheck, lint.
- [ ] **Step 7: E2E** `npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/app-nav.spec.ts` → PASS.
  Commit `feat(kanji): SRS progress keyed by literal (any dictionary kanji)`.

### Task 4: Favorites and Add to Review

**Files:**
- Create: `supabase/migrations/20261106000055_kanji_favorites.sql`, `lib/data/kanji-learner.ts` (+ test),
  `app/api/kanji/favorites/[literal]/route.ts` (+ test), `app/api/kanji/progress/[literal]/route.ts` (+ test),
  `lib/kanji/learner-types.ts`
- Modify: `supabase/tests/account-erasure.sql` (allowlist `('public.user_kanji_favorites','user_id','c')`),
  `lib/user-export/tables.ts`, `lib/data/user-export.ts` (key columns `["user_id", "literal"]`),
  `supabase/tests/port-kanji.sql`, `lib/dictionary/kanji-data-service.ts`, `app/api/dictionary/kanji/[literal]/route.ts`

**Interfaces:**
- Consumes: progress keyed by literal (Task 3).
- Produces (`lib/kanji/learner-types.ts`):
  - `interface KanjiProgress { stage: number; reviews: number; lapses: number; nextReviewAt: string | null }`
  - `interface KanjiLearnerState { favorite: boolean; progress: KanjiProgress | null }`
  - `interface KanjiFavorite { literal: string; hanViet: string[] }`
  - `interface KanjiInspectPayload { data: KanjiData; learner: KanjiLearnerState }` (Tasks 5–6 add fields)
- `lib/data/kanji-learner.ts`:
  - `setKanjiFavorite(literal: string, favorite: boolean): Promise<KanjiActionResult>`
  - `addKanjiToReview(literal: string): Promise<KanjiActionResult>`
  - `getKanjiLearnerState(literal: string): Promise<KanjiLearnerState>`
  - `listKanjiFavorites(): Promise<KanjiFavorite[]>` (newest first)
  - `type KanjiActionResult = { ok: true } | { ok: false; status: 400 | 401 | 404 } | { ok: false; status: 429; retryAfter: number }`
- `lib/dictionary/kanji-data-service.ts`: `getKanjiInspectPayload(literal: string): Promise<KanjiInspectPayload | null>`;
  `getKanjiForLearner` returns `{ ok: true; data: KanjiInspectPayload }`; the API responds `{ data: KanjiInspectPayload }`.
- Routes: `PUT`/`DELETE /api/kanji/favorites/[literal]` → `{ data: { favorite: boolean } }`;
  `PUT /api/kanji/progress/[literal]` → `{ data: { inReview: true } }`. Errors and 429 `Retry-After` exactly like
  `app/api/collections/[id]/save/route.ts`. Rate limit `{ limit: 60, windowMs: 60_000 }` per user per route.

- [ ] **Step 1: Failing tests.**
  - DB (`port-kanji.sql`): own-row select/insert/delete; another user's row invisible; no update grant; cascade on user
    delete; `literal` check `char_length = 1`.
  - `kanji-learner.test.ts`: unknown literal (not in the active `dict_kanji`) → 404; signed out → 401; favorite
    toggle idempotent both ways; `addKanjiToReview` inserts `{ srs_stage: 0, next_review_at: now, reviews: 0 }` and,
    when a row exists, leaves every column untouched (upsert `ignoreDuplicates`); learner state reflects both.
  - route tests: `𠮟` URL-encoded accepted; `abc` → 400; 429 carries `Retry-After`.
  - `kanji-data-service.test.ts`: payload carries `learner`; `structuredClone(payload)` deep-equals the payload.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (migration copies `user_saved_collections` grants/policies,
  without the insert `exists` clause; literal validated by `parseKanjiLiteral` + active-snapshot lookup in the data
  layer). **Step 4: Run** tests, `npm run verify:db:kanji`, `npm run verify:db:erasure` → PASS; typecheck; lint.
- [ ] **Step 5: Commit** `feat(kanji): favorites + add to review`.

### Task 5: Lesson examples and "appears in lessons"

**Files:**
- Create: `supabase/migrations/20261106000056_kanji_lesson_index.sql`, `lib/data/kanji-lessons.ts` (+ test),
  `app/api/kanji/examples/[literal]/route.ts` (+ test)
- Modify: `lib/kanji/learner-types.ts`, `lib/dictionary/kanji-data-service.ts`, `supabase/tests/port-kanji.sql`

**Interfaces:**
- Produces:
  - SQL `kanji_lesson_lines(p_literal text, p_limit int, p_offset int) returns table (line_id uuid, video_id uuid,
    lesson_title text, text_jp text, translation text, start_time numeric)` and
    `kanji_lesson_counts(p_literal text, p_limit int) returns table (video_id uuid, lesson_title text, occurrences int)`;
    both `language sql stable security invoker`, latest transcript per video only (use `latest_transcript_ids`),
    `text_jp like '%' || p_literal || '%'` (a single Han char needs no escaping), ordered by lesson title then
    `start_time` / by `occurrences desc`; `revoke … from public, anon`, `grant … to authenticated`;
    comment `-- ponytail: seq scan; add a pg_trgm index when transcript_lines grows past ~100k`.
  - `interface KanjiExample { lineId: string; videoId: string; lessonTitle: string; textJp: string; translation: string | null }`
  - `interface KanjiLessonCount { videoId: string; title: string; count: number }`
  - `getKanjiExamples(literal: string, offset: number): Promise<KanjiExample[]>` (page size 3),
    `getKanjiLessons(literal: string): Promise<KanjiLessonCount[]>` (top 4).
  - `KanjiInspectPayload` gains `examples: KanjiExample[]` (first 3) and `lessons: KanjiLessonCount[]`.
  - `GET /api/kanji/examples/[literal]?offset=n` → `{ data: KanjiExample[] }` (offset int 0–300, else 400).
  - Lesson link = `/shadowing/<videoId>?line=<lineId>` (the existing deep-link format, `components/korume/korume-rail.tsx:88`).

- [ ] **Step 1: Failing tests.** DB: a learner sees lines of a public lesson and of their own private lesson, never
  another user's private lesson (RLS through invoker); an older transcript of the same video is not counted; anon
  cannot execute. Unit: mapping, offset paging, offset `-1`/`9999` → 400.
- [ ] **Step 2: Decide "See all lessons".** Read how `/shadowing?q=` is applied (`app/[locale]/(protected)/(app)/shadowing/page.tsx:31`
  and its data loader). Only if `q` matches transcript text does the link render (to `/shadowing?q=<literal>`);
  otherwise it is not rendered. Record the finding in the run-state.
- [ ] **Step 3: Implement. Step 4: Run** tests + `npm run verify:db:kanji` → PASS; typecheck; lint.
- [ ] **Step 5: Commit** `feat(kanji): lesson examples and appears-in-lessons`.

### Task 6: Modal routing (prove before content)

**Files:**
- Create: `lib/kanji/href.ts` (+ test), `lib/kanji/context.ts` (+ test), `components/kanji/use-kanji-modal-history.ts`
  (+ test), `components/kanji/kanji-inspect-modal.tsx` (+ test), `tests/e2e/kanji-inspect.spec.ts`
- Modify: `app/[locale]/(protected)/layout.tsx` (mount `<Suspense fallback={null}><KanjiInspectModal /></Suspense>`
  inside `AmbientProvider`), `app/[locale]/(protected)/(app)/kanji/page.tsx` (glyph links),
  `components/kanji/kanji-quick-inspect.tsx:125` ("view full details" → modal href),
  `lib/dictionary/kanji-data-service.ts` + the dictionary API route (accept `?from=`), `lib/kanji/learner-types.ts`

**Interfaces:**
- `PLACEHOLDER_HREF = "/"` exported from `lib/placeholder-href.ts` (new); `components/layout/app-footer.tsx:12`'s
  file-local `const PLACEHOLDER = "/"` is replaced by an import of it (one constant for the whole app).
- `kanjiModalHref(pathname: string, search: string, literal: string, from?: string): string` — `pathname` is
  locale-less; keeps every other param; sets `kanji`, sets or removes `from`.
- `kanjiPageHref(literal: string): string` → `/kanji/${encodeURIComponent(literal)}`.
- `type KanjiContext = { kind: "level"; level: JlptLevel } | { kind: "favorites" }`;
  `parseKanjiContext(raw: string | null): KanjiContext | null` (`level:N5`, `favorites`); `formatKanjiContext(c): string`.
- `interface KanjiNeighbors { prev: string | null; next: string | null }`; `KanjiInspectPayload` gains
  `neighbors: KanjiNeighbors | null` (null without a valid `from`); the builder becomes
  `getKanjiInspectPayload(literal: string, opts?: { from?: string | null })`, and the API reads `?from=`. Level order = `getKanjiList(level)` order;
  favorites order = `listKanjiFavorites()` order.
- `useKanjiModalHistory(): { literal: string | null; from: string | null; openedInApp: boolean; close(): void; go(literal: string): void }`.
  Rule (spec §5.1): `openedInApp` is true when the `kanji` param **appeared while the hook was already mounted**
  (link click, Forward), false when it was present on the hook's first render (shared link, refresh, new tab).
  `close()` = `router.back()` if `openedInApp`, else `router.replace(<same URL without kanji and from>, { scroll: false })`.
  `go()` = `router.replace` with the new literal, keeping `from`. Invalid literal (`parseKanjiLiteral` null) →
  `literal: null`.
- `KanjiInspectModal`: native `<dialog>` + `showModal()`; Esc (`cancel` event, default prevented), backdrop click
  and ✕ call `close()`; before opening it stores `document.activeElement`; after closing it focuses that element if
  still connected, else the page's `main h1`, else `main`. Fetches `/api/dictionary/kanji/<literal>?from=<from>`;
  this task renders only glyph + Hán Việt + a "Mở trang riêng" link to `kanjiPageHref` + `‹ ›` (hidden when
  `neighbors` is null) — the content comes in Task 7.

- [ ] **Step 1: Failing unit tests.** `href.test.ts`: `kanjiModalHref("/kanji", "level=N5", "日", "level:N5")` →
  `/kanji?level=N5&kanji=%E6%97%A5&from=level%3AN5`; existing `kanji`/`from` replaced; `from` omitted removes it.
  `context.test.ts`: `level:N5`, `favorites` parse; `level:N9`, `x` → null. `use-kanji-modal-history.test.ts`
  (mock `useRouter`/`useSearchParams` from `@/lib/i18n/navigation` / `next/navigation`): param on first render →
  `close` calls `replace` with `kanji` and `from` removed and other params kept; param appearing after mount → `close`
  calls `back`; `go("月")` calls `replace` keeping `from`; `?kanji=abc` → `literal: null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: E2E `kanji-inspect.spec.ts`** (real browser, learner fixture as in `tests/e2e/typography/learner.ts`;
  the lesson uses `tests/e2e/fixtures/fake-youtube.ts`):
  1. `/kanji?level=N5` → click a glyph → dialog open, URL has `kanji` + `from`; `›` → next literal, `history.length`
     unchanged; Esc → closed (a `back()`), URL `/kanji?level=N5`, focus on the clicked glyph link; Forward → dialog
     reopens on the `›` literal; browser Back → closed again, still on `/kanji?level=N5`.
  2. `goto('/kanji?kanji=日')` (initial URL) → dialog open; ✕ → closed, URL `/kanji`, still on `/kanji`.
  3. Refresh with `?kanji=日` → dialog open again.
  4. Lesson workspace: play the fake video, open the drawer's kanji, click "view full details" → dialog over the lesson;
     close → same `currentTime` (± 0.5 s) and play state, drawer still open on the same kanji.
  5. `?kanji=abc` → no dialog, page renders.
  6. `/kanji` "Review" button → `/kanji/review` page (not a dialog).
- [ ] **Step 6: Run** the spec → PASS. typecheck, lint, vitest for `lib/kanji components/kanji`. Commit
  `feat(kanji): inspect modal as a ?kanji= param over protected pages`.

### Task 7: Inspect content (modal + page)

**Files:**
- Create: `components/kanji/kanji-inspect.tsx` (split into block files as the builder sees fit) + tests
- Modify: `components/kanji/kanji-inspect-modal.tsx`, `app/[locale]/(protected)/(app)/kanji/[id]/page.tsx`,
  `app/[locale]/(protected)/(app)/kanji/page.tsx` ("Kanji đã lưu" strip), `components/kanji/kanji-quick-inspect.tsx`
  (Hán Việt reading added, layout kept), `lib/dictionary/types.ts`, `lib/dictionary/kanji-data-service.ts`,
  `messages/vi/kanji.json`, `messages/en/kanji.json`, `messages/en/kanji.pin.test.ts`

**Interfaces:**
- Consumes: `KanjiInspectPayload` (Tasks 4–6), `setKanjiFavorite`/`addKanjiToReview` via their routes,
  `TtsButton` (`components/speech/tts-button.tsx`), `StrokeOrder` (`components/motion/stroke-order.tsx`),
  `DictionaryAttribution`, `THIEU_CHUU_SOURCE.credit`.
- Produces: `KanjiInspect({ payload, variant }: { payload: KanjiInspectPayload; variant: "modal" | "page" })`
  ("use client"); `KanjiData.componentGlosses: Record<string, { hanViet: string[]; meaningEn: string | null }>`
  (one `in("literal", elements)` query on the active `dict_kanji`).

Blocks and data are spec §5.2's table verbatim; Study this Kanji → `/kanji/review?focus=<literal>` (no `level`);
the three other bottom CTAs → `PLACEHOLDER_HREF`. Favorite/Add to Review are optimistic and roll back on any non-2xx
(429 shows the existing rate-limit message). After Add to Review the button reads "Đang ôn tập", disabled; with no
progress row the status card is replaced by the Add-to-Review prompt; with `reviews = 0` the ring is hidden.

- [ ] **Step 1: Failing tests** (RTL): header meaning line = `HỌC · study, learning` for a fixture with
  `hanViet: ["Học"]`; Thiều Chửu block shows 2 lines + expand, credit text present, block absent when `tcLines` is
  `[]`; `N3` badge only with curated `jlpt`; `常用` badge iff `grade ≤ 8`; examples and lessons blocks absent when
  empty, the single empty-state line when both are; strokes block absent when `strokePaths` is `[]`; favorite
  rollback on a 500; the three placeholder CTAs have `href="/"`; page variant renders the same blocks.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, messages vi + en (no Vietnamese meaning text; copy only).
- [ ] **Step 4: Run** tests → PASS; `npx playwright test tests/e2e/typography` (route list unchanged) → PASS;
  extend `kanji-inspect.spec.ts`: favorite persists across reload and shows in the `/kanji` strip; Add to Review →
  `/kanji/review` shows the literal.
- [ ] **Step 5: Chrome measure** at 1280×529 and 1440×900 against `28:2041` (block order, widths ratio, type tokens);
  note deltas in the run-state. Commit `feat(kanji): inspect content from the 28:2041 frame`.

### Task 8: Post-reveal mock — owner gate

**Files:** none in the repo (mock lives in the session scratchpad; result recorded in the run-state).

- [ ] **Step 1:** Read `280:1314` (Figma file `IwFHZDZdHW7qsSFiNbWrkd`) for the card, rating row and footer.
- [ ] **Step 2:** Build one static HTML mock using the app's CSS tokens with three states side by side: pre-reveal
  (as drawn), **post-reveal** (spec §6 fields: Hán Việt large, English meaning, on/kun, curated `meaning_vi` when
  present, "Xem chi tiết", rating row enabled with SM-2 intervals), **end of deck** (reviewed count, again count,
  back to `/kanji`). Real data for `日` and `学` from the local DB; no invented text.
- [ ] **Step 3:** Screenshot at 1280×529, send to the owner, **stop**. Task 9 starts only after the owner approves;
  record the approval (and any change requested) in the run-state.

### Task 9: Kanji review in `(focus)`

**Files:**
- Create: `app/[locale]/(protected)/(focus)/kanji/review/page.tsx`, `components/kanji/kanji-review-session.tsx` (+ test)
- Delete: `app/[locale]/(protected)/(app)/kanji/review/page.tsx`
- Modify: `components/learning/review-session.tsx` (export `GRADES` only — vocab behaviour unchanged),
  `lib/product/screen-registry.ts` (`kanji-lesson-practice-flashcard`: `chrome: "focus"`,
  `specRef: "docs/superpowers/specs/2026-11-06-port-kanji-design.md"`; `kanji-inspect`: same `specRef`),
  `messages/*/kanji.json`

**Interfaces:**
- Consumes: `getKanjiReviewQueue` (Task 3), `getStreak` (`lib/data/streak.ts:14`, args as `lib/data/user-stats.ts`
  passes them), `GRADES`, `POST /api/srs/review` with `{ itemType: "kanji", itemId: literal, quality }`,
  `kanjiModalHref` for "Xem chi tiết".
- Produces: `KanjiReviewSession({ cards, deckLabel, streak, backHref }: { cards: KanjiReviewCard[]; deckLabel: string; streak: number; backHref: string })`.

Page: `?level=` → deck label `JLPT <level>`, else "Ôn tập hôm nay"; `?focus=` passed through; slim bar
`← · Korume | Kanji Practice · <deck label> n / N · ✕ Exit` (Exit → `/kanji`); footer: session % complete, cards
remaining, day streak, encouragement line; post-reveal and end-of-deck exactly as the approved mock (Task 8). Keys:
Space reveals, 1–4 rate; rating disabled until reveal.

- [ ] **Step 1: Failing tests:** rating disabled before reveal; Space reveals; `3` posts quality 4 with
  `itemId: "日"`; the post-reveal shows Hán Việt, English, on/kun; empty `cards` → end-of-deck state immediately;
  vocab `ReviewSession` tests unchanged and green.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement. Step 4: Run** → PASS; screen-registry tests; typecheck; lint.
- [ ] **Step 5: E2E** (extend `kanji-inspect.spec.ts`): `/kanji/review?focus=𠮟` → `𠮟` first; reveal, rate →
  next card; the `(focus)` rail is present and the `(app)` nav is not; `/kanji/日` still renders the page (static
  `review` vs dynamic `[id]` across groups). Run the typography gate. Commit `feat(kanji): review in focus chrome`.

### Task 10: Whole-branch gate and owner look

- [ ] **Step 1:** Full gates in the worktree: `npm run typecheck`, `npm run lint`,
  `npx vitest run --minWorkers=1 --maxWorkers=2`, every `verify:db:*` touched (`kanji`, `dictionary`, `dashboard`,
  `erasure`, `profile`), `npm run verify:protocol`, `npx playwright test` (record pre-existing master reds separately).
- [ ] **Step 2:** Whole-branch review (Opus), fix round, re-run Step 1.
- [ ] **Step 3:** Update the run-state (commits, verification numbers, open: Thiều Chửu license, the ~34 old-JLPT
  kanji with no Thiều Chửu lines, the `redirect-unresolved` list). Owner Chrome look of inspect (modal + page) and review; merge only on the owner's word.
