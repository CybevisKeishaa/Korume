# Shadowing Workspace Part 1b — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Shadowing workspace its intelligence layer — Utility Drawer (Vocabulary · Grammar · Mining · Notes · AI), selection popover, ✨ nine-section AI explanation, KanjiQuickInspect — on a versioned JMdict/KANJIDIC2/KanjiVG snapshot and a Knowledge Economy core (shared cache, single-flight, reservations, cost ledger, hard USD budget), proven on Ep.729.

**Architecture:** Three server layers under the existing workspace. (1) `lib/dictionary/` reads one active dictionary snapshot that a streaming importer stages and activates atomically. (2) `lib/analysis/` derives deterministic line analysis (tokens, dictionary matches, grammar matches) cached per snapshot, joined per request with the learner's own mastery. (3) `lib/knowledge/` generates AI sections through one section registry and an orchestrator that claims a lease, reserves entitlement and budget in SQL, calls the AI port, then settles or releases — every money decision inside security-definer SQL functions. The client adds a drawer store beside the 1a stores, a selection popover and five tabs; nothing in playback can start a generation.

**Tech Stack:** Next.js 14 App Router (RSC), React 18, next-intl, Supabase/PostgREST + RLS + plpgsql, kuromoji, zod (+ `zod/v4` for the AI port), Tailwind 3.4 + CSS custom properties, Radix Popover, lucide-react, Vitest + RTL, Playwright, PowerShell gate scripts over `docker exec … psql`.

**Spec:** `docs/superpowers/specs/2026-10-02-shadowing-workspace-part-1b-design.md` (locked at `881af6c`) — read it first; it is the acceptance test. `§x` below refers to it. Part 1a's spec and plan (`2026-10-01-shadowing-workspace-part-1a-*`) define every store, file and convention this plan extends.

## Global Constraints

- Worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\shadowing-workspace-1b`, branch `shadowing-workspace-1b`. Never build, serve or run Playwright in the main checkout (it shares `.next` with the owner's dev server). Absolute paths in every command.
- Migrations: three **new** files `20261002000037_dictionary.sql`, `20261002000038_knowledge.sql`, `20261002000039_learner_notes.sql`, each with a `.test.ts` beside it in the `normalized()` style of `20261001000035_sentence_marks.test.ts`. After any migration edit: `npx supabase db reset` then every `npm run verify:db:*`.
- Every new SQL function: `security definer`, `set search_path = public`, `revoke all on function … from public, anon, authenticated`, `grant execute … to service_role`. Every service-only table: RLS on, **no** policy for `authenticated`, `revoke all on <table> from anon, authenticated`, `grant all … to service_role` (§4.2: `knowledge_entries` and the ledger have no learner access at all; dictionary tables get SELECT for `authenticated` only).
- `supabase/config.toml` `max_rows = 1000`: every multi-row read goes through `fetchAllPages` (`lib/data/query-pagination.ts`) under a **total** order, or is aggregated in SQL.
- Server → client data is a plain DTO. Task 1 adds `test/dto.ts` `assertPlainSerializableDto(value)` (recursive: primitives, arrays, plain objects only; rejects functions, class instances, `Map`, `Set`, `Date`, `BigInt`, `undefined` inside arrays); every data façade a client consumes gets a test calling it on real output (§6.6, §7).
- The client never sends text, tier, variant, credits or price. The server reads lines under RLS and derives the tier with `getActivePlanTier` (`lib/data/subscriptions.ts`).
- **No generation from playback (R11).** Only `POST /api/knowledge/sections` and `POST /api/dictionary/gloss` can start one, and the client calls them only from an explicit learner action handler — never from an effect that depends on the current sentence.
- Copy lives in `messages/{en,vi}/shadowing.json` under `workspace.drawer`, `workspace.selection`, `workspace.ai`, `workspace.notes`, and `messages/{en,vi}/kanji.json` under `quickInspect`; pin EN leaves in the existing `*.pin.test.ts`. `t()` on a template without values breaks in `next dev` — use `t.raw` there.
- Token rule (`components/ui/token-scale.test.ts`): no arbitrary px literals; every task adding a file under `components/shadowing-workspace` or `components/kanji` bumps the `sources` pin in that test.
- No dead control: nothing renders disabled-without-reason or "coming soon". The Plus CTA is text (§3).
- Model output is rendered only as structured fields in escaped text nodes; no `dangerouslySetInnerHTML`, no Markdown-to-HTML anywhere in this branch (§5.6). A grep in Task 15 proves it.
- Each task ends with `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, `npx vitest run --reporter=dot --minWorkers=1 --maxWorkers=2` all exiting 0 (judge the exit code itself; never pipe through `tail`), plus the task's own gates. Vitest never runs while Codex runs.
- Code blocks here are **drafts** written against the repo as read on 2026-10-02 and never compiled. Compile and grep them; when a draft disagrees with the repo, the repo wins and the run state records the correction.
- Every fix ships with one mutation that proves its test catches the defect (memory: `codex-tests-need-mutation`).
- Owner viewport for every layout assertion: **1280×529**.

## Corrections to the spec found while planning (recorded, not re-ruled)

1. **The `fake` AI provider cannot drive Playwright.** It is injected in-process (`setProviderForTesting`, `lib/ai/registry.ts`) and `AI_PROVIDER` accepts only `none | anthropic | gemini` (`lib/ai/env.ts:34`); adding an env-selectable fake would be a production path whose only purpose is testing, which 1a forbade. So: the single-flight "N misses → one provider call" proof is a **vitest integration test** over the orchestrator with the fake provider and an in-memory store implementing the same lease contract (Task 7), and the SQL contract is proven by the live gate (Task 4b). Playwright runs with the local `AI_PROVIDER=none` and **seeds `knowledge_entries` rows through the service-role client**, which exercises the real read path, the real Free-preview projection and the real 503 path; UI-only states (pending, 402) are produced with `page.route` stubs. §7's intent is unchanged.
2. **Stale-leader overwrite.** A leader whose lease expired can still return after another request took over. `knowledge_entries` therefore carries `lease_token uuid`; completing or failing an entry is conditional on the caller's token (Task 4). Not in the spec's column list; it is the mechanism behind §5.3 step 3's takeover.
3. **Transcript text cannot be selected today.** In `components/shadowing-workspace/transcript-row.tsx` the Japanese text is inside the row's seek `<button>`, whose `::before` covers the whole row; browsers do not drag-select button text. Task 11 moves the text out of the button (§6.3 requires selection on rows). T0 confirms in Chrome.
4. **Deleted users keep cost history.** `ai_generations.requested_by_user_id` and `ai_reservations.requested_by_user_id` are `on delete set null` (accounting survives account deletion); `ai_usage_charges` cascades with the user. Notes cascade (§4.4).

## Review Focus

1. A selection that starts inside a ruby `<rt>`, ends in the middle of a token, or contains a non-BMP kanji such as `𠮷` → the server snaps to whole tokens using UTF-16 offsets and analyses exactly the characters the learner saw (Task 9, Task 11).
2. A learner pins line 42, then the video runs 30 sentences, then they enter and leave Focus Mode, then type a note → every tab still shows line 42 and the note is saved on line 42, not on the line now playing (Task 10, Task 13).
3. A Free learner double-clicks ✨ on a new sentence while opening a second section of the same sentence in another browser tab → one daily slot charged, no 402 for that sentence's own sections, the fourth new sentence refused (Task 4b, Task 7).
4. The provider hangs past the lease; a second request takes over and succeeds; then the first returns → the entry keeps the second's content, exactly one charge exists, and the stale leader's settle/complete is a no-op (Task 4, Task 4b, Task 7).
5. The global budget is hit while the AI tab is open with cached sections → cached sections keep rendering, a new section shows "AI is resting" with no automatic retry loop, and a reload still shows the cached content (Task 7, Task 14, Task 15).

Each line has its test in the task named after it.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261002000037_dictionary.sql` (+ `.test.ts`) | `dict_imports`, `dict_snapshots`, `dict_entries`, `dict_kanji`, `dict_kanji_strokes`, `dict_kanji_words`, activation/rollback/GC functions |
| `supabase/migrations/20261002000038_knowledge.sql` (+ `.test.ts`) | `knowledge_entries`, `ai_generations`, `ai_reservations`, `ai_usage_charges`, `ai_budget_days`, lease/reserve/settle/release/complete/fail functions |
| `supabase/migrations/20261002000039_learner_notes.sql` (+ `.test.ts`) | `sentence_notes`, `lesson_notes` |
| `supabase/tests/dictionary.sql`, `scripts/verify-dictionary-gate.ps1` | `verify:db:dictionary` |
| `supabase/tests/knowledge.sql`, `supabase/tests/knowledge-race/*.sql`, `scripts/verify-knowledge-gate.ps1` | `verify:db:knowledge` incl. the multi-connection barrier |
| `lib/dictionary/types.ts`, `lib/dictionary/snapshot.ts`, `lib/dictionary/kanji-data-service.ts`, `lib/dictionary/lookup.ts` | snapshot reads, KanjiDataService, word lookup |
| `lib/dictionary/import/{jmdict,kanjidic,kanjivg,sanitize-kanjivg,kanji-words,stage}.ts`, `scripts/import-dictionaries.ts`, `scripts/dictionary-gc.ts` | streaming importer, sanitiser, activation, GC |
| `lib/knowledge/{canonical,cache-key,pricing,config,periods,entitlement,preview,backoff,types}.ts` | pure Knowledge logic |
| `lib/knowledge/registry.ts`, `lib/knowledge/sections/*.ts` | the one section registry: schema, preview schema, prompt, policies |
| `lib/knowledge/store.ts`, `lib/knowledge/orchestrator.ts`, `lib/knowledge/memory-store.ts` (test support) | SQL-backed store, single-flight orchestration |
| `lib/analysis/{spans,line-analysis,grammar-matcher,learning-state,lesson-vocabulary}.ts` | deterministic analysis |
| `lib/data/notes.ts`, `lib/validation/notes.ts`, `lib/validation/knowledge.ts`, `lib/validation/dictionary.ts` | notes data + body schemas |
| `app/api/knowledge/sections/route.ts`, `app/api/knowledge/usage/route.ts` | Knowledge API |
| `app/api/lines/[lineId]/analysis/route.ts`, `app/api/videos/[id]/vocabulary/route.ts` | analysis API |
| `app/api/dictionary/kanji/[literal]/route.ts`, `app/api/dictionary/gloss/route.ts` | dictionary API |
| `app/api/sentence-notes/route.ts`, `app/api/videos/[id]/notes/route.ts` | notes API |
| `components/motion/stroke-order.tsx`, `lib/kanji-strokes.ts` (deleted) | data-driven StrokeOrder |
| `app/[locale]/(protected)/(app)/kanji/[id]/page.tsx`, `lib/data/content.ts` | literal-canonical kanji page |
| `components/kanji/kanji-quick-inspect.tsx`, `components/kanji/dictionary-attribution.tsx` | QuickInspect |
| `lib/shadowing-workspace/drawer-state.ts`, `lib/shadowing-workspace/selection-offsets.ts`, `lib/shadowing-workspace/note-autosave.ts`, `lib/shadowing-workspace/workspace-view.ts` | pure client logic |
| `components/shadowing-workspace/drawer/*` | drawer shell, separator, tabs, word/phrase cards, AI sections |
| `components/shadowing-workspace/selection-popover.tsx`, `transcript-row.tsx`, `live-sentence.tsx`, `workspace-shell.tsx`, `workspace-context.tsx` | wiring into 1a |
| `test/dto.ts` | `assertPlainSerializableDto` |
| `tests/e2e/fixtures/knowledge-data.ts`, `tests/e2e/shadowing-intelligence.spec.ts`, `tests/e2e/knowledge.live-ai.spec.ts` | browser acceptance |
| `docs/design/screens/screen-shadowing-practice.md`, `docs/product/domain-model.md` | rulings, deviations, new concepts |

---

### Task 0: Probe (Claude, throwaway)

Nothing is committed except findings in the run state (§ T0).

- [ ] **Step 1: KanjiVG archive.** List the four zips in `C:/Users/tplon/Desktop/Japan/Korume/DataKanji/` (`unzip -l`); open one SVG of `緑` (`07dd1`) from each. Record: which archive holds one file per character with `kvg:element` grouping and stroke paths only (expected `-main`), the file-name scheme, the path count for 緑 (expect 14), total file count, and every element/attribute name present (needed for the sanitiser allow-list).
- [ ] **Step 2: JMdict.** Download `JMdict_e.gz` from EDRDG into the same folder (not the repo). Record exact URL, the `<!-- JMdict created: YYYY-MM-DD -->` version line, sha256, entry count (`zcat | grep -c '<entry>'`), the license text/URL as published, and confirm KANJIDIC2's header version and license the same way. Persist these values for Task 2 (`dict_imports.source_url/source_version/license`).
- [ ] **Step 3: Haiku price.** Use the `claude-api` skill to read the current Haiku input / output / cache-read prices per million tokens and the model id the Anthropic adapter resolves for tier `fast` (`lib/ai/providers/anthropic.ts`). Record them; Task 6 writes them into `lib/knowledge/pricing.ts`.
- [ ] **Step 4: Selection in Chrome.** On the running worktree app (built in the worktree, port 3000), Ep.729 workspace: (a) drag-select inside Live Sentence — does `window.getSelection().toString()` include `<rt>` text? (b) try drag-selecting inside a transcript row — confirm it is impossible (Correction 3). (c) set `user-select:none` on `rt` in DevTools and repeat (a). Record results.
- [ ] **Step 5: Seams.** Confirm `lib/data/account-deletion.ts` deletes the `users` row (so `on delete cascade` covers notes) and how `lib/data/user-export.ts` `EXPORT_TABLES` keys are added; record the exact insertion lines.

---

### Task 1: Dictionary migration and its live gate

**Files:**
- Create: `supabase/migrations/20261002000037_dictionary.sql`, `supabase/migrations/20261002000037_dictionary.test.ts`
- Create: `supabase/tests/dictionary.sql`, `scripts/verify-dictionary-gate.ps1`
- Modify: `package.json` (`"verify:db:dictionary": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-dictionary-gate.ps1"`)
- Create: `test/dto.ts` + `test/dto.test.ts` — `assertPlainSerializableDto(value: unknown, path?: string): void` (Global Constraints); this task owns it because every later façade test uses it. Test: rejects `() => 1`, `new Map()`, `new Set()`, `new Date()`, `1n`, a class instance, `[undefined]`; accepts nested plain data; the error message names the offending path.

**Interfaces:**
- Produces (SQL, used by Task 2 and Task 3):
  - `dict_stage_snapshot(p_jmdict uuid, p_kanjidic uuid, p_kanjivg uuid) returns uuid` — inserts a `staging` snapshot.
  - `dict_activate_snapshot(p_snapshot uuid) returns void` — validates and activates in one transaction; the previous active becomes `retired`.
  - `dict_rollback_snapshot(p_snapshot uuid) returns void` — re-activates a `retired` snapshot, retiring the current one.
  - `dict_gc_snapshots(p_keep int default 1) returns int` — deletes `retired` snapshots beyond the newest `p_keep` retired ones and their rows; returns how many.
  - `dict_active_snapshot_id() returns uuid` — `stable`, granted to `authenticated` and `service_role` (reads only).

- [ ] **Step 1: Write the failing migration test** — `20261002000037_dictionary.test.ts`, same `normalized()` helper as `20261001000035_sentence_marks.test.ts`:

```ts
describe("dictionary SQL contract", () => {
  const sql = normalized("20261002000037_dictionary.sql");
  it("versions every row by snapshot", () => {
    for (const t of ["dict_entries", "dict_kanji", "dict_kanji_strokes", "dict_kanji_words"]) {
      expect(sql).toContain(`create table ${t} ( snapshot_id uuid not null references dict_snapshots (id) on delete cascade`);
    }
    expect(sql).toContain("primary key (snapshot_id, ent_seq)");
    expect(sql).toContain("primary key (snapshot_id, literal)");
    expect(sql).toContain("primary key (snapshot_id, literal, ent_seq)");
  });
  it("allows at most one active snapshot", () => {
    expect(sql).toContain("create unique index dict_snapshots_one_active on dict_snapshots ((true)) where status = 'active'");
    expect(sql).toContain("check (status in ('staging', 'active', 'retired'))");
  });
  it("records per-source provenance", () => {
    expect(sql).toMatch(/create table dict_imports \(.*source text not null check \(source in \('jmdict', 'kanjidic2', 'kanjivg'\)\).*source_version text not null.*source_url text not null.*license text not null.*file_sha256 text not null.*entry_count int not null/);
  });
  it("is read-only for learners and invisible to anon", () => {
    for (const t of ["dict_imports", "dict_snapshots", "dict_entries", "dict_kanji", "dict_kanji_strokes", "dict_kanji_words"]) {
      expect(sql).toContain(`alter table ${t} enable row level security`);
      expect(sql).toContain(`revoke all on ${t} from anon`);
      expect(sql).toContain(`revoke insert, update, delete on ${t} from authenticated`);
    }
    for (const f of ["dict_stage_snapshot", "dict_activate_snapshot", "dict_rollback_snapshot", "dict_gc_snapshots"]) {
      expect(sql).toMatch(new RegExp(`revoke all on function ${f}\\([^)]*\\) from public, anon, authenticated`));
    }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run supabase/migrations/20261002000037_dictionary.test.ts` → FAIL (file missing).

- [ ] **Step 3: Write the migration.** Draft:

```sql
-- Versioned dictionary reference data (spec 2026-10-02 part 1b §4.1). One snapshot spans all three
-- sources so the app never mixes JMdict of one import with KanjiVG of another.
create table dict_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('jmdict', 'kanjidic2', 'kanjivg')),
  source_version text not null,
  source_url text not null,
  license text not null,
  file_sha256 text not null,
  entry_count int not null check (entry_count > 0),
  imported_at timestamptz not null default now()
);
create table dict_snapshots (
  id uuid primary key default gen_random_uuid(),
  jmdict_import_id uuid not null references dict_imports (id),
  kanjidic_import_id uuid not null references dict_imports (id),
  kanjivg_import_id uuid not null references dict_imports (id),
  status text not null default 'staging' check (status in ('staging', 'active', 'retired')),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
create unique index dict_snapshots_one_active on dict_snapshots ((true)) where status = 'active';

create table dict_entries (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  ent_seq int not null,
  kanji_forms text[] not null default '{}',
  kana_forms text[] not null,
  senses jsonb not null,           -- [{ pos: string[], gloss: string[], misc: string[] }]
  common boolean not null default false,
  jlpt smallint check (jlpt between 1 and 5),
  primary key (snapshot_id, ent_seq)
);
create index dict_entries_kanji_forms on dict_entries using gin (kanji_forms);
create index dict_entries_kana_forms on dict_entries using gin (kana_forms);

create table dict_kanji (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  literal text not null check (char_length(literal) = 1),
  on_readings text[] not null default '{}',
  kun_readings text[] not null default '{}',
  meanings_en text[] not null default '{}',
  stroke_count smallint not null check (stroke_count > 0),
  grade smallint, freq int, jlpt_old smallint,
  primary key (snapshot_id, literal)
);
create table dict_kanji_strokes (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  literal text not null,
  paths jsonb not null,            -- ordered string[] of SVG path data, sanitised (Task 2)
  components jsonb not null,       -- KanjiVG element tree, raw primitives
  primary key (snapshot_id, literal)
);
create table dict_kanji_words (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  literal text not null,
  ent_seq int not null,
  rank int not null,
  primary key (snapshot_id, literal, ent_seq)
);
create index dict_kanji_words_rank on dict_kanji_words (snapshot_id, literal, rank);
```

Then: RLS on each table; `create policy <t>_read on <t> for select to authenticated using (true)`; `revoke all on <t> from anon`; `revoke insert, update, delete on <t> from authenticated`; `grant all on <t> to service_role`. The functions:

```sql
create function dict_activate_snapshot(p_snapshot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from dict_snapshots where id = p_snapshot for update;
  if v_status is distinct from 'staging' then raise exception 'snapshot % is not staging', p_snapshot; end if;
  -- Validation happens BEFORE the flip: a failure leaves the current active snapshot untouched.
  if not exists (select 1 from dict_entries where snapshot_id = p_snapshot)
     or not exists (select 1 from dict_kanji where snapshot_id = p_snapshot)
     or not exists (select 1 from dict_kanji_strokes where snapshot_id = p_snapshot) then
    raise exception 'snapshot % is incomplete', p_snapshot;
  end if;
  if exists (select 1 from dict_kanji_words w where w.snapshot_id = p_snapshot
             and not exists (select 1 from dict_entries e where e.snapshot_id = p_snapshot and e.ent_seq = w.ent_seq)) then
    raise exception 'snapshot % has dangling kanji words', p_snapshot;
  end if;
  update dict_snapshots set status = 'retired' where status = 'active';
  update dict_snapshots set status = 'active', activated_at = now() where id = p_snapshot;
end $$;
```

`dict_rollback_snapshot` does the same flip for a `retired` target. `dict_gc_snapshots` deletes only `retired` rows outside the newest `p_keep` (ordered by `activated_at desc nulls last, created_at desc`). Every function: `revoke all … from public, anon, authenticated; grant execute … to service_role`. `dict_active_snapshot_id()` is `stable`, `security invoker`, granted to `authenticated, service_role`.

- [ ] **Step 4: Run** the migration test → PASS.
- [ ] **Step 5: Write the gate** `supabase/tests/dictionary.sql` in the shape of `supabase/tests/shadowing-workspace.sql` (`\set ON_ERROR_STOP on`, `raise exception 'FAIL …'` / `raise notice 'PASS …'`, one `do $$ … $$` block per case). As `postgres`, create three tiny imports and snapshot A (2 entries, 1 kanji, its strokes, one kanji word) and activate A. Cases:
  1. Create B with different glosses, activate → `dict_active_snapshot_id()` = B; reads of `dict_entries where snapshot_id = dict_active_snapshot_id()` return only B's glosses; A is `retired`.
  2. Create C missing `dict_kanji_strokes` → `dict_activate_snapshot(C)` raises; B is still the only active snapshot (count of `active` = 1).
  3. Create D with a `dict_kanji_words` row whose `ent_seq` has no entry → activation raises; B still active.
  4. `dict_rollback_snapshot(A)` → A active, B retired.
  5. A direct `update dict_snapshots set status='active'` of a second row → `unique_violation`.
  6. `dict_gc_snapshots(0)` → deletes only retired snapshots and their rows; the active one and its rows remain.
  7. As `authenticated` (jwt claims of a gate user): select works; insert into `dict_entries` → `insufficient_privilege`; `select dict_activate_snapshot(…)` → `insufficient_privilege`.
  8. As `anon`: select from `dict_entries` → `insufficient_privilege`.
  Clean up gate rows at the end.
- [ ] **Step 6: Gate script** — copy `scripts/verify-shadowing-gate.ps1` with `$sqlPath` → `supabase/tests/dictionary.sql` and messages "Dictionary". Run `npx supabase db reset` then `npm run verify:db:dictionary` → passes; other `verify:db:*` → 0.
- [ ] **Step 7: Mutation** — delete the incomplete-snapshot check from `dict_activate_snapshot`, reset, gate → FAIL at case 2. Restore.
- [ ] **Step 8: Commit** — `feat(db): versioned dictionary snapshots`.

---

### Task 2: Streaming importer, sanitiser, activation, GC (Codex) + real import (Claude)

**Files:**
- Create: `lib/dictionary/import/jmdict.ts`, `kanjidic.ts`, `kanjivg.ts`, `sanitize-kanjivg.ts`, `kanji-words.ts`, `stage.ts` (+ a `.test.ts` each, with small inline XML fixtures)
- Create: `scripts/import-dictionaries.ts`, `scripts/dictionary-gc.ts`
- Modify: `package.json` (`"dict:import": "vite-node --config vitest.config.ts scripts/import-dictionaries.ts --"`, `"dict:gc": "vite-node --config vitest.config.ts scripts/dictionary-gc.ts --"`; the same runner `scripts/seed-real-lesson.ts` is documented to use)

**Interfaces:**
- Consumes: Task 1 tables and functions.
- Produces:

```ts
// lib/dictionary/import/jmdict.ts
export interface JmdictEntryRow { entSeq: number; kanjiForms: string[]; kanaForms: string[];
  senses: { pos: string[]; gloss: string[]; misc: string[] }[]; common: boolean }
/** Streams `<entry>` elements; never builds the whole document. */
export async function* readJmdict(input: NodeJS.ReadableStream): AsyncGenerator<JmdictEntryRow>;
// lib/dictionary/import/kanjidic.ts
export interface KanjidicRow { literal: string; on: string[]; kun: string[]; meaningsEn: string[];
  strokeCount: number; grade: number | null; freq: number | null; jlptOld: number | null }
export async function* readKanjidic(input: NodeJS.ReadableStream): AsyncGenerator<KanjidicRow>;
// lib/dictionary/import/kanjivg.ts
export interface KanjivgRow { literal: string; paths: string[]; components: KanjiComponentNode }
export interface KanjiComponentNode { element: string | null; position: string | null; children: KanjiComponentNode[] }
export async function* readKanjivgZip(zipPath: string): AsyncGenerator<KanjivgRow>;
// lib/dictionary/import/sanitize-kanjivg.ts
export class UnsafeKanjivgError extends Error {}
/** Returns ordered path `d` strings + the element tree; throws on anything outside the allow-list. */
export function sanitizeKanjivgSvg(svg: string): { paths: string[]; components: KanjiComponentNode };
// lib/dictionary/import/kanji-words.ts
export function rankKanjiWords(literal: string, entries: Iterable<JmdictEntryRow>, limit: number): number[]; // ent_seq[]
```

- [ ] **Step 1: Pick the XML/zip readers without a new heavy dependency.** Check `package.json` for an installed streaming XML parser and zip reader. If none: add exactly `saxes` (streaming XML) and `yauzl` (streaming zip) as dependencies, with their types; record the choice in the run state. Never `readFileSync` a whole source into a DOM.
- [ ] **Step 2: Write failing parser tests** with inline fixtures: a 2-entry JMdict snippet (one with `<ke_pri>news1</ke_pri>` → `common: true`, entity-coded `<pos>&n;</pos>` → `"n"`); a KANJIDIC2 `<character>` for 緑 (`stroke_count 14`, `grade 3`, `freq 1082`, `<reading r_type="ja_on">リョク</reading>`, `<meaning>green</meaning>`, a `m_lang="fr"` meaning that must be ignored); a KanjiVG SVG for 緑 trimmed to 2 strokes.
- [ ] **Step 3: Write failing sanitiser tests** — each must throw `UnsafeKanjivgError`: an SVG containing `<script>`, an `onload=` attribute, an `href="http://…"` / `xlink:href`, a `<foreignObject>`, a `style="background:url(x)"`; a path whose `d` contains anything outside `[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]`. A clean KanjiVG file returns its paths in `kvg:` stroke order (`id="kvg:07dd1-s1"` … `-s14`) regardless of document order. The allow-list of elements/attributes comes from T0 Step 1.
- [ ] **Step 4: Run** → FAIL. **Step 5: Implement** the readers, sanitiser and `rankKanjiWords` (entries whose `kanjiForms` contain the literal; `common` first, then shorter headword, then `entSeq`; `limit` 30).
- [ ] **Step 6: `stage.ts` + script.** `scripts/import-dictionaries.ts --jmdict <gz> --kanjidic <gz> --kanjivg <zip> --jmdict-version … --jmdict-url … --jmdict-license … (same three for the other two)`. Flow: sha256 each file → if all three equal the active snapshot's imports, print `no change` and exit 0 → insert three `dict_imports` → `dict_stage_snapshot` → stream rows in batches of 1000 through the service-role client (`createServiceClient`, `lib/supabase/service.ts`) → `dict_kanji_words` from a second JMdict pass (no full-file array) → `dict_activate_snapshot`. On any error: leave the staging snapshot for diagnosis, print it, exit 1 — the active snapshot is untouched. Print counts, duration and `process.memoryUsage().rss` peak sampled every second. `scripts/dictionary-gc.ts --keep 1` calls `dict_gc_snapshots`.
- [ ] **Step 7: Run** parser/sanitiser tests → PASS; mutation: drop the `on*` attribute rule → its test FAILS; restore.
- [ ] **Step 8: Commit (Codex)** — `feat(dictionary): streaming importer, KanjiVG sanitiser, snapshot activation`.
- [ ] **Step 9: Real import (Claude).** With the local stack running: `npm run dict:import -- …` with the T0 files and metadata. Assert and record in the run state: each `entry_count` equals the count the parser produced from that file and is above a sanity floor (JMdict > 150000, KANJIDIC2 > 10000, KanjiVG > 6000); `緑` has `stroke_count = 14` and 14 `paths`; `苦手` resolves to an entry with English senses; `select count(*) from dict_kanji_strokes where paths::text ~* '(<|script|on[a-z]+=|href)'` = 0; duration; peak RSS. Run the import a second time → `no change`. If anything fails, Task 2 is **not done**: fix in the parser (new failing test first), re-run.

---

### Task 3: KanjiDataService, data-driven StrokeOrder, literal kanji URL

**Files:**
- Create: `lib/dictionary/types.ts`, `lib/dictionary/snapshot.ts`, `lib/dictionary/kanji-data-service.ts` (+ tests)
- Create: `app/api/dictionary/kanji/[literal]/route.ts` (+ test)
- Create: `components/kanji/dictionary-attribution.tsx`
- Modify: `components/motion/stroke-order.tsx` (+ test), delete `lib/kanji-strokes.ts`
- Modify: `app/[locale]/(protected)/(app)/kanji/[id]/page.tsx`, `lib/data/content.ts` (+ tests)

**Interfaces:**
- Produces:

```ts
// lib/dictionary/types.ts
export interface DictionaryAttribution { source: "jmdict" | "kanjidic2" | "kanjivg"; version: string; url: string; license: string }
export interface KanjiCommonWord { entSeq: number; headword: string; reading: string; glossEn: string }
export interface KanjiData {
  literal: string; onReadings: string[]; kunReadings: string[]; meaningsEn: string[];
  meaningVi: string | null; mnemonic: string | null;          // from the hand-written `kanji` table when present
  strokeCount: number; grade: number | null; frequency: number | null; jlpt: string | null;
  strokePaths: string[]; components: KanjiComponentNode; commonWords: KanjiCommonWord[];
  curatedKanjiId: string | null; attribution: DictionaryAttribution[];
}
// lib/dictionary/kanji-data-service.ts  ("server-only")
export async function getKanjiData(literal: string, opts?: { commonWords?: number }): Promise<KanjiData | null>;
// components/motion/stroke-order.tsx — unchanged public prop + one new optional prop
export function StrokeOrder(props: { character: string; paths?: string[]; replayKey?: number }): JSX.Element;
```

- [ ] **Step 1: Failing tests.** `kanji-data-service.test.ts` (Supabase mock like `lib/data/*.test.ts`): reads only the active snapshot (asserts the recorded `.eq("snapshot_id", …)` calls — the mock ignores filters, memory: assert the recorded query, not rows); merges `meaning_vi`/`mnemonic_text` from `kanji` when the literal exists there; returns `null` for an unknown literal; `commonWords` ordered by `rank`, capped; `assertPlainSerializableDto(result)` (from `test/dto.ts`, Task 1). `stroke-order.test.tsx`: renders `paths` when given (count of `<path>` = paths.length + 0 guide lines are `<line>`), falls back to the glyph when `paths` is empty/absent, `replayKey` change remounts the animation group (key). Kanji page test: `/kanji/緑` with no curated row renders the dictionary page; a UUID of a curated row redirects to `/kanji/<literal>` (assert `redirect` called with the encoded literal); unknown → `notFound`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** `getActiveSnapshotId()` in `snapshot.ts` calls `dict_active_snapshot_id` once per request (React `cache`). The page: if `params.id` is a UUID → `getKanjiById` → `redirect(\`/kanji/${encodeURIComponent(kanji.character)}\`)`; else decode, require exactly one code point that is a kanji, `getKanjiData`, render the existing layout with dictionary values and the `StrokeOrder paths`. The curated-only fields stay. `GET /api/dictionary/kanji/[literal]`: authenticated (401 otherwise, as sibling routes), validates one kanji code point (400), 404 when unknown, rate-limited with `rateLimit` (`lib/rate-limit.ts`) at 60/min/user, returns `{ data: KanjiData }`. `dictionary-attribution.tsx` renders the `attribution[]` it is given (never hard-coded text).
- [ ] **Step 4: Run** → PASS. Mutation: drop the active-snapshot filter → the recorded-query assertion FAILS.
- [ ] **Step 5: Commit** — `feat(kanji): KanjiDataService, data-driven stroke order, literal kanji URLs`.

---

### Task 4: Knowledge and ledger migration

**Files:**
- Create: `supabase/migrations/20261002000038_knowledge.sql`, `supabase/migrations/20261002000038_knowledge.test.ts`

**Interfaces:**
- Produces (SQL; every function service-role only):

```text
knowledge_claim_lease(p_key jsonb, p_lease_seconds int)
  returns table (entry_id uuid, outcome text, lease_token uuid, content jsonb, retry_after timestamptz)
  outcome ∈ 'ready' | 'leader' | 'follower' | 'backoff'
knowledge_complete(p_entry uuid, p_lease_token uuid, p_content jsonb, p_model text, p_provider text) returns boolean
knowledge_fail(p_entry uuid, p_lease_token uuid, p_error_code text, p_retry_after timestamptz) returns boolean
ai_reserve(p_requested_by uuid, p_billing_scope text, p_entitlement_kind text, p_fingerprint text,
           p_reserved_credits int, p_reserved_usd numeric, p_limits jsonb, p_ttl_seconds int)
  returns table (reservation_id uuid, outcome text, resets_at timestamptz)
  outcome ∈ 'reserved' | 'already_charged' | 'quota_exhausted' | 'credits_exhausted' | 'fuse_tripped' | 'budget_exhausted'
ai_record_generation(p_row jsonb) returns uuid
ai_settle(p_reservation uuid, p_generation uuid, p_actual_credits int, p_actual_usd numeric) returns boolean
ai_release(p_reservation uuid, p_spent_usd numeric default 0) returns boolean
ai_usage_snapshot(p_user uuid, p_day date, p_month date) returns jsonb
```

- [ ] **Step 1: Failing migration test** asserting (normalized SQL): the seven-column unique key on `knowledge_entries` (`unique (fingerprint, section, locale, context_key, schema_version, generator_version, content_variant)`); `status` check `('pending','ready','failed')`; `content_variant` check `('full','preview')`; `lease_token uuid`; `ai_reservations` with `billing_scope` check `('learner','system')`, `entitlement_kind` check `('free_sentence','plus_section')`, and `check ((billing_scope = 'system') = (entitlement_kind is null))`; the two partial uniques on `ai_usage_charges` exactly as §4.3 (`… where entitlement_kind = 'free_sentence'`, `unique … (generation_id) where entitlement_kind = 'plus_section'`); `requested_by_user_id uuid references users (id) on delete set null` on `ai_generations` and `ai_reservations`; `user_id … on delete cascade` on `ai_usage_charges`; for every table `revoke all on <t> from anon, authenticated`; for every function `revoke all on function … from public, anon, authenticated`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Write the migration.** Tables per §4.2–§4.3 plus `ai_budget_days (period_day date primary key, reserved_usd numeric not null default 0, spent_usd numeric not null default 0)`. Function rules (drafts; plpgsql):
  - `knowledge_claim_lease`: `insert … values (…, 'pending', now() + lease, gen_random_uuid()) on conflict do nothing returning` → `leader`. Else `select … for update` the row: `ready` → `ready` + content; `failed` with `retry_after > now()` → `backoff`; `failed` with `retry_after <= now()` or `pending` with `lease_until < now()` → `update … set status='pending', lease_until=…, lease_token=gen_random_uuid(), attempts = attempts + 1 … returning` → `leader` (the CAS); else `follower`.
  - `knowledge_complete` / `knowledge_fail`: `update … where id = p_entry and lease_token = p_lease_token and status = 'pending'`; return `found`. A stale token changes nothing (Correction 2).
  - `ai_reserve`: first release expired `held` reservations (`expires_at < now()`), returning their USD to `ai_budget_days`. Then lock in a fixed order to avoid deadlocks — `pg_advisory_xact_lock(hashtext('ai-user:' || p_requested_by))` for learner scope, then `insert … on conflict do nothing` + `select … for update` on today's `ai_budget_days` row. Checks, in order: global `reserved_usd + spent_usd + p_reserved_usd > p_limits->>'globalUsdPerDay'` → `budget_exhausted`. Learner Free: a settled charge or a `held` reservation for `(user, today, fingerprint)` exists → `already_charged` (no new reservation; the caller proceeds without a new slot); distinct fingerprints charged or held today `>= freeSentencesPerDay` → `quota_exhausted` with `resets_at` = next UTC midnight. Learner Plus: `plus_section` reservations+charges today `>= plusMaxSectionsPerDay` → `fuse_tripped`; credits charged this month + held `+ p_reserved_credits > plusCreditsPerMonth` → `credits_exhausted` (resets next UTC month). Then insert the reservation `held`, add `p_reserved_usd` to `reserved_usd`.
  - `ai_settle`: `update ai_reservations set status='settled' where id = p_reservation and status = 'held' returning …`; if none → return false (idempotent; release-after-settle and settle-after-release are no-ops). Move USD: `reserved_usd -= reserved`, `spent_usd += p_actual_usd`. Learner scope inserts the `ai_usage_charges` row (`credits = p_actual_credits` for Plus, `0` for Free) with `on conflict do nothing`.
  - `ai_release`: `held → released`; `reserved_usd -= reserved`; `spent_usd += p_spent_usd` (validation-error path: money was spent, learner not charged, §5.3 step 6).
  - `ai_usage_snapshot`: Free `{used, limit, resetsAt}`; Plus `{creditsUsed, creditsLimit, resetsAt}` (the API turns it into `remainingPercent`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `feat(db): knowledge cache and AI cost ledger`.

---

### Task 4b: `verify:db:knowledge` — the multi-connection race gate (Claude)

**Files:**
- Create: `supabase/tests/knowledge.sql` (single-session cases), `supabase/tests/knowledge-race/{setup,lease-worker,plus-worker,budget-worker,free-worker,assert}.sql`, `scripts/verify-knowledge-gate.ps1`
- Modify: `package.json` (`verify:db:knowledge`)

- [ ] **Step 1: Barrier harness.** In the PowerShell script: run `setup.sql`; start a **controller** psql process (`docker exec -i <container> psql …`) that runs `select pg_advisory_lock(7101); select pg_sleep(2); select pg_advisory_unlock(7101);`; start N = 20 worker processes with `Start-Job`, each a separate `docker exec … psql` connection whose script begins `select pg_advisory_lock_shared(7101);` (blocks until the controller releases — all workers resume together) then calls the function under test once and records its outcome into `knowledge_race_results` (created by `setup.sql`, dropped at the end). Wait for all jobs, then run `assert.sql`.
- [ ] **Step 2: Race cases** (each its own barrier round): (a) 20 × `knowledge_claim_lease` on one key → exactly 1 `leader`, 19 `follower`. (b) one Plus user, 20 × `ai_reserve` with `plusMaxSectionsPerDay = 5` → exactly 5 `reserved`. (c) Plus credits: limit 10, each reserve 3 → exactly 3 `reserved`. (d) global budget $1.00, 20 × reserve $0.30 across 20 different users → exactly 3 `reserved`; `reserved_usd <= 1.00`. (e) Free user, 20 × reserve on **one** fingerprint → 1 `reserved`, 19 `already_charged`; then 20 × reserve on 20 **different** fingerprints with limit 3 → exactly 3 `reserved` in total for that user that day.
- [ ] **Step 3: Single-session cases** in `knowledge.sql`: expired lease → CAS gives a new token, the old token's `knowledge_complete` returns false and leaves the row `pending` with the new token; provider error path → `ai_release` restores capacity (a reserve that was refused before now succeeds); validation error → `ai_release(id, 0.02)` adds 0.02 to `spent_usd`, no charge row; an expired `held` reservation is released by the next `ai_reserve` and frees its slot; `ai_settle` with actual 1 credit after reserving 3 → charge row has 1 and the month total counts 1; second `ai_settle` / `ai_release` on the same id → false, totals unchanged; `system` scope reserve touches `ai_budget_days` but creates no charge and ignores Free/Plus limits; a learner reservation with `entitlement_kind = null` → `check_violation`; as `authenticated` and as `anon`: `select … from knowledge_entries` and every ledger table → `insufficient_privilege`; `select ai_reserve(…)` → `insufficient_privilege`.
- [ ] **Step 4: Run** `npx supabase db reset && npm run verify:db:knowledge` → passes (and `verify:db:notes` once Task 5 lands). **Mutation:** remove the `for update` on the budget row in `ai_reserve` → race (d) overshoots and the gate FAILS; remove the `lease_token` condition from `knowledge_complete` → the stale-token case FAILS. Restore both.
- [ ] **Step 5: Commit** — `test(db): knowledge race gate with a multi-connection barrier`.

Task 7 does not start until this gate is green.

---

### Task 5: Learner notes

**Files:**
- Create: `supabase/migrations/20261002000039_learner_notes.sql` (+ `.test.ts`)
- Create: `lib/validation/notes.ts`, `lib/data/notes.ts`, `app/api/sentence-notes/route.ts`, `app/api/videos/[id]/notes/route.ts` (+ tests)
- Modify: `lib/data/user-export.ts` (`EXPORT_TABLES`: `sentence_notes: ["user_id", "transcript_line_id"]`, `lesson_notes: ["user_id", "video_id"]`) (+ its test)
- Create: `supabase/tests/learner-notes.sql`, `scripts/verify-notes-gate.ps1`; `package.json` `"verify:db:notes"` (copy of `scripts/verify-shadowing-gate.ps1`)

**Interfaces:**
- Produces:

```ts
export const SENTENCE_NOTE_MAX = 4000; export const LESSON_NOTE_MAX = 20000;
export const sentenceNoteBodySchema: z.ZodType<{ transcriptLineId: string; body: string }>;
export const lessonNoteBodySchema: z.ZodType<{ body: string }>;
export interface NoteDto { key: string; lineId: string | null; videoId: string; body: string; updatedAt: string }
export async function setSentenceNote(lineId: string, body: string): Promise<NoteWriteResult>;
export async function deleteSentenceNote(lineId: string): Promise<NoteWriteResult>;
export async function setLessonNote(videoId: string, body: string): Promise<NoteWriteResult>;
export async function deleteLessonNote(videoId: string): Promise<NoteWriteResult>;
export async function listMyLessonNotes(videoId: string, transcriptId: string): Promise<{ lessonNote: NoteDto | null; sentenceNotes: NoteDto[] }>;
export type NoteWriteResult = { ok: true } | { ok: false; status: 401 | 404 | 429; retryAfter?: number };
```

- [ ] **Step 1: Failing tests**: migration contract (own-row select/insert/update/delete policies; `with check (user_id = auth.uid() and exists (select 1 from transcript_lines tl where tl.id = transcript_line_id))` and the `videos` equivalent for `lesson_notes`; `check (char_length(body) between 1 and 4000)` / `20000`; cascades); routes mirror `app/api/sentence-marks/route.ts` (400 invalid, 401, generic 404 on RLS refusal, 429 with `Retry-After`); `PUT` is an upsert (`on conflict … do update set body, updated_at = now()`), an empty body is a `DELETE`; `listMyLessonNotes` pages with `fetchAllPages` ordered by `(updated_at, transcript_line_id)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: SQL gate cases** in `supabase/tests/learner-notes.sql`: B cannot read/update/delete A's notes; B's sentence note on A's PRIVATE line and lesson note on A's PRIVATE video → `insufficient_privilege`; over-length body → `check_violation`; deleting the line / video / user cascades. Mutation: drop the `exists` from the lesson-note policy → its case FAILS.
- [ ] **Step 5: Commit** — `feat(notes): sentence and lesson notes`.

---

### Task 6: Knowledge pure logic

**Files:**
- Create: `lib/knowledge/{types,canonical,cache-key,pricing,config,periods,entitlement,preview,backoff}.ts` (+ a `.test.ts` each)

**Interfaces:**
- Produces:

```ts
// types.ts
export const KNOWLEDGE_SECTIONS = ["lite", "grammar_breakdown", "culture_notes", "common_mistakes",
  "alternative_expressions", "native_nuance", "more_examples", "quiz", "conversation"] as const;
export type CascadeSection = (typeof KNOWLEDGE_SECTIONS)[number];
export type KnowledgeSection = CascadeSection | "phrase_analysis" | "word_gloss_vi";
export type ContentVariant = "full" | "preview";
export type PlanTier = "free" | "plus";               // re-export of lib/data/subscriptions
export type KnowledgeLocale = "vi" | "en";
export interface KnowledgeKey { fingerprint: string; section: KnowledgeSection; locale: KnowledgeLocale;
  contextKey: string; schemaVersion: number; generatorVersion: number; contentVariant: ContentVariant }
// canonical.ts
export function canonicalizeSentence(text: string): string;
export function fingerprint(text: string): string;   // sha256 hex of canonicalizeSentence(text)
// cache-key.ts
export function cacheKeyJson(key: KnowledgeKey): Record<string, string | number>; // the p_key for SQL
// pricing.ts
export interface ModelPrice { inputPerMTok: number; outputPerMTok: number; cacheReadPerMTok: number }
export function estimateCostUsd(model: string, usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number }): number;
export function upperBoundCostUsd(model: string, inputTokens: number, maxOutputTokens: number): number;
export function creditsFor(costUsd: number, creditUsdUnit: number): number; // ceil, min 1 for cost > 0
// config.ts
export interface KnowledgeConfig { freeSentencesPerDay: number; plusCreditsPerMonth: number;
  plusMaxSectionsPerDay: number; globalBudgetUsdPerDay: number; creditUsdUnit: number }
export function readKnowledgeConfig(env?: Record<string, string | undefined>): KnowledgeConfig;
// periods.ts
export function utcDay(now: Date): string; export function utcMonth(now: Date): string;
export function nextUtcMidnight(now: Date): Date; export function nextUtcMonth(now: Date): Date;
// entitlement.ts
export function variantFor(tier: PlanTier, section: KnowledgeSection, fullCached: boolean): { variant: ContentVariant; project: boolean };
// preview.ts
export function projectPreview(section: CascadeSection, full: unknown): unknown; // deterministic
// backoff.ts
export function retryAfterFor(attempts: number, now: Date): Date; // 30 s, 2 min, 10 min, then 10 min
```

- [ ] **Step 1: Write the failing tests** (selection):

```ts
// canonical.test.ts
it.each([
  ["今日は雨です。", "今日は雨です。"],
  ["  今日は雨です。\r\n", "今日は雨です。"],
  ["ＡＢＣ１２３", "ABC123"],                       // NFKC
  ["今日は  雨", "今日は 雨"],                       // collapse repeated ASCII spaces
])("canonicalizes %j", (input, out) => expect(canonicalizeSentence(input)).toBe(out));
it("keeps meaning-bearing punctuation and particles apart", () => {
  const base = fingerprint("行きます");
  for (const other of ["行きます？", "行きます！", "行きます…", "行きます。"]) expect(fingerprint(other)).not.toBe(base);
  expect(fingerprint("私は行く")).not.toBe(fingerprint("私が行く"));
});
// cache-key.test.ts — changing any one of the 7 dimensions changes cacheKeyJson; vi and en never collide
// entitlement.test.ts
it("free gets full lite/grammar, preview elsewhere; plus gets full", () => {
  expect(variantFor("free", "lite", false)).toEqual({ variant: "full", project: false });
  expect(variantFor("free", "native_nuance", false)).toEqual({ variant: "preview", project: false });
  expect(variantFor("free", "native_nuance", true)).toEqual({ variant: "full", project: true }); // read full, project on server
  expect(variantFor("plus", "quiz", false)).toEqual({ variant: "full", project: false });
});
// preview.test.ts — quiz preview has no `answerIndex` anywhere (JSON.stringify scan); conversation preview has
// context + at most 2 turns; projecting the same input twice is deep-equal; every preview validates against
// the section's previewSchema (Task 8a adds that assertion once the registry exists).
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Prices come from T0 Step 3 (`lib/knowledge/pricing.ts` keyed by model id; an unknown model throws — never silently zero). `readKnowledgeConfig` uses zod over `AI_FREE_SENTENCES_PER_DAY` (default 3), `AI_PLUS_CREDITS_PER_MONTH` (required when `AI_PROVIDER !== none`), `AI_PLUS_MAX_SECTIONS_PER_DAY` (200), `AI_GLOBAL_BUDGET_USD_PER_DAY` (5), `AI_CREDIT_USD_UNIT` (required when enabled); add them to `.env.example` with comments and to the env validation in `lib/ai/env.ts`'s neighbour pattern (`lib/env/validate`).
- [ ] **Step 4: Run** → PASS; mutation: make `canonicalizeSentence` strip a trailing `？` → the punctuation test FAILS.
- [ ] **Step 5: Commit** — `feat(knowledge): canonical keys, pricing, entitlement and preview logic`.

---

### Task 7: Orchestrator — single flight, reserve, settle

**Files:**
- Create: `lib/knowledge/store.ts` (SQL-backed `KnowledgeStore` over `createServiceClient().rpc(…)`), `lib/knowledge/memory-store.ts` (same contract in memory, for tests only, under `lib/knowledge/` but imported only by `*.test.ts` — a lint rule or a test asserts no non-test importer), `lib/knowledge/orchestrator.ts` (+ `orchestrator.test.ts`, `store.test.ts`)

**Interfaces:**
- Consumes: Task 4 functions, Task 6 modules, `AiProvider` (`lib/ai/port.ts`), `getProvider` (`lib/ai/registry.ts`).
- Produces:

```ts
export interface KnowledgeStore {
  claimLease(key: KnowledgeKey, leaseSeconds: number): Promise<
    | { outcome: "ready"; entryId: string; content: unknown }
    | { outcome: "leader"; entryId: string; leaseToken: string }
    | { outcome: "follower"; entryId: string }
    | { outcome: "backoff"; entryId: string; retryAfter: string }>;
  complete(entryId: string, leaseToken: string, content: unknown, model: string, provider: string): Promise<boolean>;
  fail(entryId: string, leaseToken: string, errorCode: string, retryAfter: Date): Promise<boolean>;
  reserve(input: ReserveInput): Promise<{ outcome: ReserveOutcome; reservationId: string | null; resetsAt: string | null }>;
  recordGeneration(row: GenerationRow): Promise<string>;
  settle(reservationId: string, generationId: string, actualCredits: number, actualUsd: number): Promise<boolean>;
  release(reservationId: string, spentUsd: number): Promise<boolean>;
  readFull(keyWithoutVariant: Omit<KnowledgeKey, "contentVariant">): Promise<unknown | null>; // for Free projection
}
export type GenerateOutcome =
  | { status: "ready"; content: unknown; access: "full" | "preview"; model: string | null }
  | { status: "pending"; retryAfterMs: number }
  | { status: "quota_exhausted"; resetsAt: string }
  | { status: "ai_unavailable"; reason: "disabled" | "budget" | "provider" | "backoff" };
export async function getOrGenerateSection(input: {
  section: KnowledgeSection; locale: KnowledgeLocale; targetText: string; contextKey: string;
  parentFingerprint: string; tier: PlanTier; billing: { scope: "learner"; userId: string } | { scope: "system"; userId: string | null };
  promptInput: SectionPromptInput; now?: Date;
}, deps?: { store?: KnowledgeStore; provider?: AiProvider; config?: KnowledgeConfig; aiEnabled?: boolean }): Promise<GenerateOutcome>;
```

- [ ] **Step 1: Failing tests** (`orchestrator.test.ts`, fake provider from `lib/ai/providers/fake.ts` + `memory-store.ts`):
  - cache hit → `ready`, zero provider calls, zero reservations;
  - **N = 10 concurrent `getOrGenerateSection` on one miss → `fake.requests.length === 1`**, one settle, nine `pending` or `ready` results (Review Focus 3/4);
  - Free, nine sections of one new sentence → one reservation/charge; a fourth new sentence → `quota_exhausted` with `resetsAt` = next UTC midnight;
  - provider error → `release` called, entry `failed` with `retryAfterFor(1)`, outcome `ai_unavailable/provider`; a second call inside the backoff → `ai_unavailable/backoff` with **no** provider call (Review Focus 5);
  - validation error (fake queues an object failing the schema) → generation recorded with `validation_error` and cost, `release(id, cost)`, learner not charged;
  - stale leader: lease expires (memory store clock), a second caller becomes leader and completes; then the first completes → `complete` returns false, stored content is the second's, exactly one charge (Review Focus 4);
  - `aiEnabled: false` → `ai_unavailable/disabled` before any reserve; cached `ready` entries still return `ready`;
  - budget refusal → lease released (entry back to retryable), `ai_unavailable/budget`;
  - Free + locked section + full cached → returns the **projection** (`access: "preview"`), never the full object; Free + locked + nothing cached → generates the `preview` variant with the section's preview max tokens;
  - `system` scope (`word_gloss_vi`) → reserve called with `billingScope: "system"` and `entitlementKind: null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the flow of §5.3: claim → (ready → project) / (follower → `pending`, `retryAfterMs` 1500) / (backoff → unavailable) / leader → `aiEnabled` check → reserve (upper bound from `upperBoundCostUsd` with the registry's max tokens) → `provider.generateStructured` with the registry's schema → `recordGeneration` (always, with real usage/cost; on throw, usage unknown → cost 0 and `outcome: provider_error`) → `complete` + `settle` or `fail` + `release`. Map `AiError` kinds to `provider_error`; zod failure to `validation_error`.
- [ ] **Step 4: `store.test.ts`** asserts each `KnowledgeStore` method calls the right `rpc` name with the right parameter names (recorded calls), and that the module imports `server-only`.
- [ ] **Step 5: Run** → PASS; mutation: skip the lease check (always generate) → the N-concurrent test FAILS.
- [ ] **Step 6: Commit** — `feat(knowledge): single-flight orchestration with reservations`.

---

### Task 8a: Section registry, first sections, Knowledge API

**Files:**
- Create: `lib/knowledge/registry.ts`, `lib/knowledge/sections/{lite,grammar-breakdown,common-mistakes,more-examples,phrase-analysis,word-gloss-vi}.ts` (+ `registry.test.ts`, one test per section)
- Create: `lib/validation/knowledge.ts`, `app/api/knowledge/sections/route.ts`, `app/api/knowledge/usage/route.ts` (+ route tests)
- Create: `lib/data/knowledge.ts` (reads the line under RLS, resolves tier, calls the orchestrator)

**Interfaces:**
- Produces:

```ts
// registry.ts
export interface SectionDefinition<Full, Preview> {
  section: KnowledgeSection;
  schema: z.ZodType<Full>; previewSchema: z.ZodType<Preview> | null;   // null = no preview (Free full / system)
  schemaVersion: number; generatorVersion: number;
  contextPolicy: "none" | "video" | "parent_sentence" | "dictionary_sense";
  access: "free_full" | "free_preview" | "system";
  maxOutputTokens: { full: number; preview: number | null };
  buildPrompt(input: SectionPromptInput, variant: ContentVariant): { system: SystemBlock[]; user: string };
  projectPreview(full: Full): Preview | null;
}
export const SECTION_REGISTRY: Record<KnowledgeSection, SectionDefinition<unknown, unknown>>;
export interface SectionPromptInput { sentence: string; phrase?: string; locale: KnowledgeLocale;
  videoTitle?: string; jlpt?: string | null; headword?: string; reading?: string; senseGlossesEn?: string[] }
// lib/validation/knowledge.ts
export const knowledgeSectionRequestSchema: z.ZodType<{ transcriptLineId: string; section: KnowledgeSection;
  locale: KnowledgeLocale; span?: { start: number; end: number } }>; // .strict(): unknown fields (tier, variant…) → 400
```

Section schemas (8a): `lite { summary: string; literal: string; keyPoints: string[] (1–4) }` · `grammar_breakdown { items: { pattern; meaning; explanation; span?: [number, number] }[] }` · `common_mistakes { items: { mistake; correction; why }[] }` · `more_examples { examples: { jp; reading; translation }[] (3–5) }` · `phrase_analysis { phrase; breakdown: { part; role; meaning }[]; nuance }` · `word_gloss_vi { glosses: string[] (1–3); note?: string }`. Preview schemas: the same shape with `items/examples` `max(1)` and strings capped (lite/grammar have none: Free full).

- [ ] **Step 1: Failing tests.** `registry.test.ts`: every `KnowledgeSection` has exactly one definition; `free_preview` sections have a `previewSchema` and `projectPreview(full)` validates against it; `system` only for `word_gloss_vi`; prompts put the sentence inside a delimited data block (`<sentence>…</sentence>`) and never interpolate it into the instruction text; nothing outside `lib/knowledge/` switches on section names (a grep test over `app/` and `components/` for `"culture_notes"` etc. outside `messages` and the registry consumers). Route tests (`sections/route.test.ts`): 401 unauthenticated; 400 on unknown body fields (`tier`, `variant`, `credits`) — the strict schema; 404 generic for a line the learner cannot read (mock `getLineForLearner` → null) with **no** orchestrator call; span on another line / `start >= end` / beyond `text_jp.length` → 400; Free + full cached → body has `access: "preview"` and `JSON.stringify(body)` contains **no** full-only field values (seed the memory store with a full object carrying a sentinel string; assert absent); `202` carries both `retryAfterMs` and a `Retry-After` header; `402` carries `resetsAt`; `503` for `ai_unavailable`; `vi` and `en` requests produce distinct keys. Usage route: Free `{used, limit, resetsAt}`, Plus `{remainingPercent, resetsAt}` and never a token or USD field.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** `lib/data/knowledge.ts`: `getLineForLearner(lineId)` via the RLS client (`createClient` from `lib/supabase/server.ts`, as `lib/data/sentence-marks.ts`), returns `{ id, textJp, videoId, videoTitle }`; span → `snapSpanToTokens` (Task 9 exports it from `lib/analysis/spans.ts`; until Task 9 lands, 8a ships a UTF-16 bounds check only and Task 9 replaces it — record in run state); tier via `getActivePlanTier(user.id)`; rate limit 30/min/user on POST, 60/min on usage.
- [ ] **Step 4: Run** → PASS; mutation: remove the server projection (return full to Free) → the sentinel test FAILS.
- [ ] **Step 5: Commit** — `feat(knowledge): section registry and knowledge API`.

### Task 8b: Remaining five sections

**Files:** `lib/knowledge/sections/{culture-notes,native-nuance,alternative-expressions,quiz,conversation}.ts` (+ tests); `lib/knowledge/registry.ts` (register only).

Schemas: `culture_notes { notes: { title; body }[] }` and `native_nuance { register; nuance; whenToUse; whenNotTo }` with `contextPolicy: "video"` · `alternative_expressions { items: { jp; reading; translation; difference }[] }` · `quiz { questions: { prompt; choices: string[] (3–4); answerIndex: number; explanation }[] (3–5) }`, preview `{ questions: { prompt; choices }[] (max 1) }` — no `answerIndex`, no `explanation` · `conversation { context; roles: [string, string]; turns: { role: 0 | 1; jp; reading; translation }[] (4–6) }`, preview `{ context; roles; turns (max 2) }`.

- [ ] **Step 1: Failing tests**: each schema accepts a valid sample and rejects one malformed sample; quiz preview projection contains no `answerIndex`/`explanation` key at any depth; conversation preview ≤ 2 turns; `culture_notes`/`native_nuance` keys include the `video_id` context while `alternative_expressions` does not; the registry completeness test from 8a now passes for all nine.
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS; mutation: give `native_nuance` `contextPolicy: "none"` → the context-key test FAILS.
- [ ] **Step 5: Commit** — `feat(knowledge): culture, nuance, alternatives, quiz and dialogue sections`.

---

### Task 9: Deterministic analysis, lesson vocabulary, glosses

**First deliverable (publish before the rest, commit separately if needed):** the DTO contract in `lib/analysis/types.ts` — Task 10 builds on it.

**Files:**
- Create: `lib/analysis/{types,spans,line-analysis,grammar-matcher,learning-state,lesson-vocabulary}.ts` (+ tests)
- Create: `app/api/lines/[lineId]/analysis/route.ts`, `app/api/videos/[id]/vocabulary/route.ts`, `app/api/dictionary/gloss/route.ts`, `lib/validation/dictionary.ts`, `lib/dictionary/lookup.ts` (+ tests)

**Interfaces:**
- Produces:

```ts
// lib/analysis/types.ts
export interface Utf16Span { start: number; end: number }   // code-unit offsets into transcript_lines.text_jp
export interface AnalysisToken { index: number; surface: string; base: string; reading: string | null; pos: string;
  span: Utf16Span; entries: { entSeq: number; headword: string; reading: string; glossEn: string; jlpt: number | null }[];
  vocabId: string | null }
export interface GrammarMatch { grammarPointId: string; title: string; structure: string | null; span: Utf16Span }
export interface StaticLineAnalysis { lineId: string; snapshotId: string; tokens: AnalysisToken[]; grammar: GrammarMatch[] }
export interface LineAnalysisDto extends StaticLineAnalysis { mastery: Record<string, number> } // vocabId → stage, per request
export interface LessonVocabularyItem { entSeq: number; headword: string; reading: string; glossEn: string;
  occurrences: number; jlpt: number | null; vocabId: string | null; mastery: number | null; exampleLineIds: string[] }
export interface LessonVocabularyPage { items: LessonVocabularyItem[]; nextCursor: string | null }
export interface GlossDto { entSeq: number; status: "ready" | "missing" | "pending"; glossesVi: string[]; source: "vocab" | "ai" | null }
// lib/analysis/spans.ts
export function snapSpanToTokens(text: string, tokens: { span: Utf16Span }[], span: Utf16Span): Utf16Span | null;
export function tokenSpans(text: string, surfaces: string[]): Utf16Span[];
```

- [ ] **Step 1: Failing tests.** `spans.test.ts`: `tokenSpans("𠮷野家に行く", ["𠮷野家", "に", "行く"])` → `[{0,4},{4,5},{5,7}]` (𠮷 is two code units); a span `{1,5}` snaps to `{0,5}`; a span crossing no token or out of bounds → `null`. `line-analysis.test.ts`: static analysis memoised per `(lineId, snapshotId, grammarRevision)` (second call → no tokenizer call); **mastery is never stored in the memo** (call twice for two users with different mastery → each sees their own; the memo object has no `mastery` key). `grammar-matcher.test.ts`: `structure_pattern` matching over tokens on 3 seeded patterns (`〜てしまう`, `〜ように`, `〜なければならない`), no false match inside a longer word. `lesson-vocabulary.test.ts`: aggregation runs over lines read with `fetchAllPages` (a 1500-line mock returns all 1500 to the aggregator — assert the recorded `range` calls cover 0–1499), cursor pagination stable, content words only (particles/aux excluded by POS). Gloss route: `GET` never calls the orchestrator (spy); `POST` calls it with `billing.scope = "system"` and the requester id; per-user limit 20/min.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Tokens via `tokenize` (`lib/japanese/tokenizer.ts`, server-only); JMdict match by `base` then `surface` against `kanji_forms`/`kana_forms` of the active snapshot, one batched query per line (`in` filters chunked by `ID_CHUNK_SIZE`); `grammarRevision` = `max(created_at)` of `grammar_points` read once per process minute (short TTL, §5.1). Routes: 404 generic when the line/video is not readable.
- [ ] **Step 4: Run** → PASS; mutation: memoise `LineAnalysisDto` including mastery → the two-user test FAILS.
- [ ] **Step 5: Commit** — `feat(analysis): deterministic line analysis, lesson vocabulary and glosses`.

---

### Task 10: Drawer shell and target model

**Files:**
- Create: `lib/shadowing-workspace/drawer-state.ts` (+ test)
- Modify: `lib/shadowing-workspace/workspace-view.ts` (+ test) — `escapeAction` gains `drawerOpen`
- Create: `components/shadowing-workspace/drawer/{drawer-context.tsx,utility-drawer.tsx,drawer-separator.tsx,drawer-header.tsx}` (+ tests)
- Modify: `components/shadowing-workspace/workspace-shell.tsx`, `live-sentence.tsx`, `transcript-row.tsx` (new actions + note indicator), `components/ui/token-scale.test.ts`

**Interfaces:**
- Produces:

```ts
// drawer-state.ts
export type DrawerLevel = "collapsed" | "peek" | "expanded" | "maximized";
export type DrawerTab = "vocabulary" | "grammar" | "mining" | "notes" | "ai";
export interface DrawerTarget { lineId: string; span: Utf16Span | null }
export interface DrawerState { level: DrawerLevel; tab: DrawerTab; tracking: "follow" | "pinned";
  pinned: DrawerTarget | null; kanji: string | null; wordEntSeq: number | null }
export type DrawerAction =
  | { type: "open"; tab: DrawerTab; target?: DrawerTarget }        // target → pinned; collapsed → peek
  | { type: "set-level"; level: DrawerLevel } | { type: "step"; delta: 1 | -1 }
  | { type: "select-tab"; tab: DrawerTab } | { type: "follow" } | { type: "collapse" }
  | { type: "open-kanji"; literal: string; target: DrawerTarget } | { type: "open-word"; entSeq: number; target: DrawerTarget }
  | { type: "back" };
export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState;
export function effectiveTarget(state: DrawerState, current: { lineId: string } | null): DrawerTarget | null;
// workspace-view.ts
export type EscapeAction = "close-popover" | "collapse-drawer" | "exit-fullscreen" | "exit-view" | "none";
export function escapeAction(state: { popoverOpen: boolean; drawerOpen: boolean; fullscreen: FullscreenTarget; view: WorkspaceView }): EscapeAction;
// drawer-context.tsx
export function DrawerProvider(props: { children: ReactNode }): JSX.Element;
export function useDrawer(): { state: DrawerState; dispatch: Dispatch<DrawerAction>; target: DrawerTarget | null };
```

- [ ] **Step 1: Failing tests.** Reducer: `open` with target pins and opens peek from collapsed, keeps level otherwise; `follow` clears `pinned`; `step` walks the four levels and clamps; `collapse` keeps tab and target; `effectiveTarget` in `follow` returns the current line, in `pinned` the pinned one **regardless of `current`** (Review Focus 2). `escapeAction`: popover → drawer (level ≠ collapsed) → fullscreen → view. `drawer-separator.test.tsx`: `role="separator"`, `aria-orientation="horizontal"`, `aria-valuemin=0 aria-valuemax=3 aria-valuenow`=level index; ArrowUp/ArrowDown step, Home → collapsed, End → maximized; pointer drag snaps to the nearest level. `utility-drawer.test.tsx`: `role="region"` + `tablist` with arrow-key roving focus; hidden (not unmounted state — the provider stays above it) in Focus view and restored with the same tab/level/target after leaving Focus; workspace-shell test: the drawer shares the shell grid as a bottom row spanning all columns and the **player element is the same DOM node** before and after every level change (ref identity). Transcript row: new actions Vocabulary · Grammar · ✨ AI · Note dispatch `open` with that row's line; a note indicator renders when `hasNote(lineId)`. Live Sentence: ✨ dispatches `open` `{ tab: "ai", target: current line }` — **and no effect anywhere fetches on `current` change** (unit test: render the AI-less drawer in follow mode, change the current sentence 10 times, assert `fetch` was never called with a POST).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Heights: `collapsed` 36 px via a token (add `--drawer-collapsed-height` in `app/globals.css`), `peek` `max(160px, 40%)`, `expanded` 70 %, `maximized` the full row below the header — as grid-row sizes on the shell, so the columns get shorter, never narrower. Reduce Motion → no transition class.
- [ ] **Step 4: Run** → PASS; mutation: make `effectiveTarget` return `current` when pinned → its test FAILS.
- [ ] **Step 5: Commit** — `feat(shadowing): utility drawer shell and target model`.

---

### Task 11: Selection popover

**Files:**
- Create: `lib/shadowing-workspace/selection-offsets.ts` (+ test), `components/shadowing-workspace/selection-popover.tsx`, `components/shadowing-workspace/drawer/word-card.tsx`, `phrase-card.tsx` (+ tests)
- Modify: `components/shadowing-workspace/ruby-sentence.tsx` (base-text spans carry `data-offset`; `rt` gets `select-none`), `transcript-row.tsx` (text outside the seek button — Correction 3), `live-sentence.tsx`

**Interfaces:**
- Produces:

```ts
export function selectionToSpan(selection: Selection, container: HTMLElement): { lineId: string; span: Utf16Span } | null;
// null when the range crosses elements of two different [data-line-id] containers or touches only <rt>
```

- [ ] **Step 1: Failing tests.** `selection-offsets.test.ts` (jsdom, real `Range`s over rendered `RubySentence`): a selection over base text returns the UTF-16 span; one starting inside an `<rt>` maps to the base offset after it; a selection across two rows → `null`; `𠮷` inside the selection counts two units (Review Focus 1). `selection-popover.test.tsx`: one token → word card (headword, reading, POS, senses) and its Vietnamese gloss is `POST`ed **only** when the card opens and `GET` said `missing`, exactly once per card (double open → one POST); kanji in the headword are buttons dispatching `open-kanji`; several tokens → phrase card with ✨ Analyze dispatching `open { tab: "ai", target: { lineId, span } }`; action names **Play sentence**, **Bookmark sentence**, **Add to Mining** (disabled with a visible reason when the selection is > 50 characters, `lib/validation/mining.ts`); `role="dialog"` non-modal, no focus trap (Tab leaves it), Escape closes and returns focus to the text container. Transcript row: click on the text without a selection still seeks (existing row tests stay green); a drag selection does not seek. Live Sentence: a plain click on a word opens the word card.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** The row: the seek `<button>` keeps the sr-only number and becomes a compact control; the Japanese text sits in a sibling `div[data-line-id]` whose `onClick` seeks only when `getSelection().isCollapsed`. Word data comes from `/api/lines/[lineId]/analysis` (fetched when a popover or the Vocabulary tab needs it — never on sentence change). Mining uses the existing `POST /api/mining` with `targetWord` = the selected text.
- [ ] **Step 4: Run** → PASS; mutation: drop the cross-container check → the two-row test FAILS.
- [ ] **Step 5: Commit** — `feat(shadowing): selection popover with word and phrase cards`.

---

### Task 12: Vocabulary tab and KanjiQuickInspect

**Files:**
- Create: `components/shadowing-workspace/drawer/vocabulary-tab.tsx`, `components/kanji/kanji-quick-inspect.tsx` (+ tests); `messages/{en,vi}/kanji.json` `quickInspect`

- [ ] **Step 1: Failing tests.** Tokens of the effective target as buttons (keyboard path to the word card), short gloss from existing data with English fallback — **no gloss POST while rendering the list** (spy); mastery badge; Whole lesson switch loads `/api/videos/[id]/vocabulary` page by page ("Show more"), opening a word lists its sentences, a sentence seeks. QuickInspect: glyph, On/Kun, English meanings (+ Vietnamese and mnemonic only when present), stroke/frequency/grade/JLPT, `StrokeOrder paths` + Replay (bumps `replayKey`), ≤ 5 common words that open their word card **without** posting glosses, TTS buttons for On/Kun using the pattern of `components/jlpt/jlpt-listening-play-button.tsx` (`POST /api/speech/tts`), **View full details** linking to `/kanji/<literal>`, attribution from `KanjiData.attribution`; back returns to the word card.
- [ ] **Step 2–4:** FAIL → implement → PASS; mutation: post glosses for the common-words list → the spy test FAILS.
- [ ] **Step 5: Commit** — `feat(shadowing): vocabulary tab and kanji quick inspect`.

### Task 13: Grammar, Mining and Notes tabs

**Files:**
- Create: `components/shadowing-workspace/drawer/{grammar-tab,mining-tab,notes-tab}.tsx`, `lib/shadowing-workspace/note-autosave.ts` (+ tests)
- Modify: `lib/data/mining.ts` (add `listMyMiningCardsForVideo(videoId)` paged with `fetchAllPages` ordered `(start_time, id)`), bootstrap in `lib/data/shadowing-workspace.ts` (lesson notes + note line ids)

**Interfaces:**
- Produces:

```ts
export function createNoteAutosave(send: (key: string, body: string) => Promise<void>, opts?: { debounceMs?: number }): {
  change(key: string, body: string): void; flush(key: string): Promise<void>;
  status(key: string): "saved" | "saving" | "failed" | "idle"; subscribe(listener: () => void): () => void };
```

- [ ] **Step 1: Failing tests.** Autosave (fake timers): typing for 3 s sends once 800 ms after the last change; blur flushes; with a request in flight, two further changes produce **one** follow-up request carrying the latest body after the first settles (never two in flight); a failure shows `failed` and retry resends the latest body. Notes tab: pinned to line 42 while `current` moves → the editor still targets 42 and saves to 42 (Review Focus 2); lesson note editor; list of notes sorted by line order, a note seeks. Grammar tab: matches with structure/explanation/examples and link to the grammar page; "AI Grammar Breakdown →" dispatches `open { tab: "ai" }` with the same target and requests `grammar_breakdown` (explicit action); empty state. Mining tab: cards of this lesson by time, the target's cards highlighted, a card seeks.
- [ ] **Step 2–4:** FAIL → implement → PASS; mutation: allow a second request while one is in flight → its test FAILS.
- [ ] **Step 5: Commit** — `feat(shadowing): grammar, mining and notes tabs`.

### Task 14: AI tab

**Files:**
- Create: `components/shadowing-workspace/drawer/{ai-tab,ai-section,ai-usage,section-renderers}.tsx` (+ tests)

- [ ] **Step 1: Failing tests.** Opening the tab from ✨ requests `lite` once for the pinned target; switching to follow mode and advancing 10 sentences → **zero** new `POST /api/knowledge/sections` (Review Focus 5's sibling, R11); expanding an accordion item requests that section once (re-expanding uses the cached result in component state); states: skeleton, `202` → polls after `retryAfterMs` with a live-region announcement on completion, `402` shows the reset time, `503` shows "AI is resting" and **does not auto-retry**, previously loaded sections stay visible, error shows retry; locked sections show 🔒 + preview + explanatory Plus text and **no button**; quiz grades on click, session-only; conversation renders turns with per-turn TTS; a `phrase_analysis` block heads the tab for a span target; usage line Free `1/3 … resets in 5 h` / Plus percentage; every section carries "AI-generated". Renderers render text nodes only (a test feeds `<img src=x onerror=alert(1)>` as a field value and asserts it appears as text).
- [ ] **Step 2–4:** FAIL → implement → PASS; mutation: request `lite` in an effect keyed on the effective target → the zero-POST test FAILS.
- [ ] **Step 5: Commit** — `feat(shadowing): AI tab with nine sections`.

---

### Task 15: Browser acceptance, contrast, live gates (Claude)

**Files:**
- Create: `tests/e2e/fixtures/knowledge-data.ts` (seeds `knowledge_entries` `ready` rows through the service-role client for a workspace-data line — a `full` lite, a `full` native_nuance with a sentinel string, a `preview` culture_notes — plus a Plus subscription row for a Plus user), `tests/e2e/shadowing-intelligence.spec.ts`, `tests/e2e/knowledge.live-ai.spec.ts`
- Modify: `lib/shadowing-workspace/reading-theme.contrast.test.ts` (drawer/popover surfaces × 4 presets × 7 atmospheres)

- [ ] **Step 1: Deterministic spec** (1a's fake `YT.Player`, `AI_PROVIDER=none`): select → popover → kanji → QuickInspect; ✨ → pinned → AI tab shows the seeded `lite`; Free user opening `native_nuance` receives `access: "preview"` and the **network response body** (`page.waitForResponse`) never contains the sentinel (seeded full) — the transport-boundary proof; a request body edited to add `"tier":"plus","variant":"full"` (via `page.request.post`) → 400; an uncached section → 503 "AI is resting" (AI disabled) while seeded sections stay visible (Review Focus 5); `page.route` stubs produce 202-then-200 and 402 for the UI states; play 10 sentences with the AI tab open and count `POST /api/knowledge/sections` → 0; note typed → reload → present; separator keys + drag; Escape order popover → drawer → fullscreen → view; Focus hides and restores the drawer; the player element's identity survives every drawer level (`elementHandle` equality + the 1a "no remount" counter).
- [ ] **Step 2: No raw HTML** — `rg -n "dangerouslySetInnerHTML" components/shadowing-workspace components/kanji lib/knowledge` → no hits.
- [ ] **Step 3: Contrast** — extend the harness; run.
- [ ] **Step 4: Live Ep.729** — the 1a live gate (`EP729_VIDEO_ID=<uuid> npm run test:e2e:live`) stays green.
- [ ] **Step 5: Live AI — ask the owner first (real money).** With approval and `AI_PROVIDER=anthropic`: a dedicated test sentence line (seeded by the spec, unique text with a run id), `testStartedAt = now()`, Plus fixture; request all nine sections; for each assert a **new** `ai_generations` row with `created_at >= testStartedAt`, matching `knowledge_entry_id`, `provider = 'anthropic'`, `outcome = 'success'`, `input_tokens > 0`, `output_tokens > 0`, `estimated_cost_usd > 0`, and a `ready` entry validating against its schema. Record real tokens and cost per section in the run state.
- [ ] **Step 6: Chrome** — 1280×529, vi and en: collapsed bar does not overflow; peek leaves the Japanese line of Live Sentence visible; wrapping and hierarchy of cards and tabs; screenshots into the scratchpad; then hand to the owner.
- [ ] **Step 7: Commit** — `test(shadowing): intelligence layer acceptance`.

### Task 16a: Documentation (Claude, may start early)

- [ ] Update `docs/design/screens/screen-shadowing-practice.md` (§ Analysis, § Utility Drawer, § Sentence Actions: rulings R3, R6, R11 and the §3 deviation register of the 1b spec) and `docs/product/domain-model.md` (Dictionary Snapshot, Knowledge Entry, AI Reservation / Generation / Charge, Sentence Note, Lesson Note). Attribution wording from T0's verified license text. Run state. Commit `docs: part 1b rulings and domain model`.

### Task 16b: Independent whole-branch review (Claude)

- [ ] **Step 1:** `npx supabase db reset`; every `verify:db:*`; `tsc`, `lint`, `vitest`, `verify:protocol`; deterministic e2e + existing shadowing specs; live Ep.729; live AI evidence present. All exit 0, judged by exit code.
- [ ] **Step 2:** Dispatch an independent `code-reviewer` on `git diff master...shadowing-workspace-1b` with the spec and this plan. Fix findings (each with a mutation), re-run Step 1, re-review until APPROVE.
- [ ] **Step 3:** Owner's Chrome look → merge decision. Only then is 1b complete.

---

## Self-review (2026-10-02)

- **Spec coverage:** §2 R1–R11 → Tasks 4–8 (R1, R7, R8), 1–3 (R2, R9), 10–14 (R3–R6, R10, R11). §3 deviations → Tasks 11, 12, 14, 16a. §4.1 → 1–2; §4.2–4.3 → 4, 4b; §4.4 → 5; §5.1 → 9; §5.2 → 3, 9; §5.3–5.4 → 6–8b; §5.5 → 5, 13; §5.6 → 8a (delimited prompts), 14 (text-only renderers), 15 (grep); §6.1–6.2 → 10; §6.3 → 11; §6.4 → 12–14; §6.5 → 3, 12; §6.6 → constraints + 15; §7 → every task's tests + 4b + 15; §8 order kept, T7 after T4b, T9 after T8a.
- **Placeholders:** none; values that depend on measurement (prices, KanjiVG allow-list, license text) are produced by named T0 steps.
- **Type consistency:** `KnowledgeKey`, `KnowledgeSection`, `ContentVariant`, `Utf16Span`, `DrawerTarget`, `KanjiData` are defined once (Tasks 6, 9, 10, 3) and used with the same names downstream.
- **Spec deviations found:** recorded in "Corrections" 1–4; none changes a product ruling.
