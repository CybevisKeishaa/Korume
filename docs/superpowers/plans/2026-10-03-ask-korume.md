# Ask Korume — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Ask Korume — one Korume conversation shown in two viewports (a floating-mascot side sheet in Shadowing and the full page `/korume/chat`) — answering through a two-stage retrieval planner over the Knowledge core, with per-turn economics, idempotency and grounding, and remove "Sensei" from every user-facing surface.

**Architecture:** Threads and messages reuse `conversation_sessions` / `conversation_messages` behind a `kind` discriminator. A turn runs auth → `companion_enabled` → rate limit → idempotency → one `ai_reserve` per turn → fast planner (`generateStructured`) → server-validated allowlisted retrieval in parallel → deep answer (`AnswerV1`, `generateStructured`) → one SQL function that persists the answer with its grounding and settles. Money decisions stay in security-definer SQL; the AI port is unchanged. The client is a shared chat core (`components/korume/*`) mounted by the workspace sheet and by the page.

**Tech Stack:** Next.js 14 App Router (RSC), React 18, next-intl, Supabase/PostgREST + RLS + plpgsql, kuromoji (via `lib/analysis`), zod (+ `zod/v4` for the AI port), Tailwind 3.4 + CSS custom properties, Vitest + RTL, Playwright, PowerShell gate scripts over `docker exec … psql`.

**Spec:** `docs/superpowers/specs/2026-10-03-ask-korume-design.md` (locked at `bafeea6`) — read it first; it is the acceptance test. `§x` below refers to it.

## Global Constraints

- Worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\ask-korume`, branch `ask-korume`. Never build, serve or run Playwright in the main checkout (it shares `.next` with the owner's dev server). Absolute paths in every command. Serena's edit tools write to the main checkout — do not use them here.
- One user-facing persona: **Korume**. No user-visible string, heading, aria-label, page title or nav label says "Sensei" (§0, §6.5). Full chat route: `/korume/chat`. `/sensei` is a `next.config.mjs` redirect only.
- `/companion` is out of scope: nothing in this branch renders chat there or writes `companion_memories`.
- Migrations, one per DB task: `20261003000041_ask_korume_threads.sql` (Task 1), `20261003000042_ask_korume_entitlement.sql` (Task 2), `20261003000043_companion_enabled.sql` (Task 3), each with a `.test.ts` beside it in the `normalized()` style of `20261002000038_knowledge.test.ts`. After any migration edit: `npx supabase db reset` (standing approval does NOT extend to this branch — ask the owner the first time) then every `npm run verify:db:*`.
- Every new or replaced SQL function: `security definer`, `set search_path = public`, `revoke all on function … from public, anon, authenticated`, `grant execute … to service_role` (memory `supabase-anon-execute-default`). Trigger functions: `revoke all … from public, anon, authenticated` and no grant.
- `supabase/config.toml` `max_rows = 1000`: every multi-row read goes through `fetchAllPages` (`lib/data/query-pagination.ts`) under a total order, or is aggregated in SQL.
- Server → client data is a plain DTO; every façade a client consumes gets a test calling `assertPlainSerializableDto` (`test/dto.ts`) on real output. A `"use client"` component receives strings and plain data, never formatter functions (memory `rsc-client-props-strings-only`).
- The client never sends `originRoute`, tier, credits, price, or an assistant message. The server derives the tier with `getActivePlanTier` (`lib/data/subscriptions.ts`) and builds the route.
- AI only through `lib/ai` (`getProvider()`, `generateStructured`); no SDK import outside `lib/ai/providers`. No streaming, no typewriter effect, no native tool calling.
- Model output renders only as `AnswerV1` blocks in escaped text nodes; no `dangerouslySetInnerHTML`, no Markdown-to-HTML in this branch. Task 11 greps it.
- Copy lives in `messages/{en,vi}/companion.json` under `ask.*` (namespace `companion`, already registered in `lib/i18n/namespaces.ts`); pin EN leaves in `messages/en/companion.pin.test.ts`. `t()` on a template without values breaks in `next dev` — use `t.raw` there.
- Token rule (`components/ui/token-scale.test.ts`): no arbitrary px literals; a task adding a file under a scanned directory bumps that test's `sources` pin. Layout widths use tokens: add `--korume-sheet-width: min(400px, 40vw)` and `--korume-sheet-min: 340px` in `app/globals.css` (Task 9).
- No dead control: no disabled mic, no "coming soon", no disabled correction mode (§6.3).
- Each task ends with `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, `npx vitest run --reporter=dot --minWorkers=1 --maxWorkers=2` all exiting 0 (judge the exit code itself; never pipe through `tail`), plus the task's own gates. Vitest never runs while Codex runs (memory `machine-memory-pressure`).
- Code blocks here are **drafts** written against the repo as read on 2026-10-03 and never compiled. Compile and grep them; when a draft disagrees with the repo, the repo wins and the run state records the correction (memory `plan-snippets-are-unverified`).
- Every fix ships with one mutation that proves its test catches the defect (memory `codex-tests-need-mutation`).
- Owner viewport for every layout assertion: **1280×529**.
- Live Gemini spends real money: **ask the owner before every live run** (§7.7).
- Codex never runs Playwright (memory `codex-sandbox-cannot-commit`): Codex writes the e2e specs, Claude runs them on the worktree server and commits. Codex leaves changes uncommitted; Claude reviews and commits each task.

## Corrections to the spec found while planning (recorded, not re-ruled)

1. **One `korume_turn` kind cannot tell Free from Plus at settle time.** `ai_settle` writes credits only `when entitlement_kind = 'plus_section'` and a reservation stores no tier. So the kind is split like the existing pair: **`korume_free_turn`** (counted against `askKorumeFreeTurnsPerDay`) and **`korume_plus_turn`** (Plus fuse + shared credits). §3's semantics are unchanged; every "`korume_turn`" in the spec means "either of the two".
2. **The success transaction needs one SQL function.** An assistant-message insert and `ai_settle` issued as two PostgREST calls are two transactions. Task 2 adds `korume_complete_turn(...)` (service-only, security definer) that inserts the assistant message with `content`, `content_json`, `grounding_json`, settles, bumps `updated_at` and sets the title in one statement. If `ai_settle` finds no `held` row (an expired hold — impossible while TTL > lifetime, but defended) the answer is still persisted and `ai_settle`'s own late-spend path records the money; the learner is not charged.
3. **The fake provider cannot drive Playwright** (same finding as 1b's plan, Correction 1): `AI_PROVIDER` accepts only `none | anthropic | gemini` and the fake is injected in-process. So §7.6 runs with the local `AI_PROVIDER=none`; answers that must already exist are **seeded through the service-role client** (exercising the real read path, rail and reload), and `POST /turns` outcomes (200, 202, 402×2, 409, 429, 502, 503) are produced with `page.route` stubs. The pipeline's own matrix is proven in vitest with the fake provider and an in-memory store (Task 7). §7.5's **turn** concurrency is proven at three layers — the SQL race gate (20 connections, one `turn_id`), a vitest `Promise.all` over the route handler with the in-memory store, and an HTTP double-POST inside the owner-approved live smoke (Task 11). Thread-create concurrency needs no AI and is a real HTTP Playwright test (Task 4).
4. **`scenario_type` is nullable in practice.** `supabase/tests/settings-page.sql:86` inserts scenario sessions without it and `lib/data/conversation.ts:212` falls back to `'free-talk'`. Requiring it would turn `verify:db:settings` red and could reject production rows. The `kind = 'scenario'` CHECK therefore keeps the existing invariant (nullable `scenario_type`) and only forbids the Ask Korume columns.
5. **The deep tier has no price.** `lib/knowledge/pricing.ts` knows only `FAST_TIER_PRICE`, and the Anthropic adapter's deep model is `claude-opus-4-8` (`lib/ai/providers/anthropic.ts:17`). Task 2 adds `DEEP_TIER_PRICE` and `upperBoundCostUsdForTier(provider, tier, inputTokens, maxOutput)`; the Opus price comes from the `claude-api` skill in Task 0, never from memory.
6. **The server gate must fail closed.** `readPreferences` swallows errors and returns `DEFAULT_PREFERENCES` (where `companionEnabled` is `true`). The Korume gate uses `readPreferencesOrThrow`; a read error is a 503, never "enabled".
7. **`getLineAnalysisForLearner` spends the learner's analysis rate limit** and re-reads the line. The `line_analysis` tool calls `staticAnalyses(supabase, [line], undefined, "lexical")` directly on the already-authorized anchor line.
8. **`ai_reserve` gains a parameter.** `p_turn_id uuid default null` cannot be added with `create or replace` (it would create an overload). Task 2 `drop function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int)` and recreates it with the ninth parameter, re-issuing its revoke/grant; the Knowledge store's named-argument RPC keeps working because the new parameter defaults to null.

9. **The Free 402 carries its limit.** The copy "You've asked 10 questions today" needs the number, and the client
   must not hard-code it (owner, Part 4 correction 1). The Free 402 body is
   `{ error: "quota_exhausted", reason: "free_daily_limit", limit, resetsAt }`; the Plus body is unchanged.

10. **Ask Korume rows are service-written (found in Task 1).** Migration 041 adds restrictive RLS policies: an
    `authenticated` learner may not insert/update `ask_korume` sessions or insert/update/delete their messages
    directly (no forged assistant answers or `origin_route` through PostgREST); deleting a whole thread and
    `erase_companion_memory()` still work. Therefore Task 4's `insertThread` / `insertUserMessage` use the
    **service client with an explicit `user_id`** (after the gate has authenticated the caller); reads
    (`readThreadRow`, messages) stay on the learner's client under RLS. `ai_generations.turn_id` and
    `ai_record_generation` were edited in place in migration 038 (AGENTS.md §6), not in 041.
11. **Task 4 as built (Claude, 2026-10-03).** `lib/korume/store.ts` `KorumeStore` has only what Task 4 uses:
    `insertThread(row)` (service, no `supabase` param), `readThreadRow`, `listThreadRows(supabase, limit, before)`,
    `readMessages`, `readAnchorLines`, `reservationStates`. **Task 7 adds** `insertUserMessage(sessionId, userId,
    turnId, text)` (service), `readTurn`, `completeTurn`, and creates `lib/korume/memory-store.ts` (deferred from
    Task 4 — nothing needed it yet; Task 4's tests use an inline fake). `getThread` returns `answer: null,
    grounding: null` until Task 7 validates `content_json` / `grounding_json` and fills them. Shared refusal bodies
    live in `lib/korume/http.ts` (`korumeRefusal`); a gate `unavailable` is 503
    `{ error: "ai_unavailable", reason: "preferences_unavailable" }`. Ask Korume migrations are 041 + 042 only;
    `companion_enabled` went in place into 033 (its contract pins one migration for `user_preferences`).

## Review Focus

1. A learner opens Korume on line 12, the video plays on to line 40, they send — the thread, the first turn's prompt and the chip all name line 12; a reload of `/korume/chat?thread=…` still names line 12 (Task 9, Task 10).
2. A flaky network makes the browser resend a first turn: the thread POST and the turn POST both repeat with the same ids → one thread row, one user message, at most one reservation, and the answer the learner finally sees is the one persisted (Task 4, Task 7).
3. The preferences read fails (DB hiccup) while the learner has Korume turned **off** → the turn route answers 503 and spends nothing; it never treats the failure as "enabled" (Task 3).
4. A planner returns `dictionary_lookup` for `"<script>"`, a 5-step plan, or the same term three times → the server keeps at most four distinct valid steps, drops the rest, and the answer still runs (Task 5).
5. A video the learner had a thread about is deleted by its owner → the thread and its messages remain readable, the anchor chip disappears, Back falls back safely, and no CHECK fires (Task 1, Task 10).

Each line has its test in the task named after it.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261003000041_ask_korume_threads.sql` (+ `.test.ts`) | `kind`, anchor columns + CHECKs, message columns, anchor-cleanup triggers, `ai_generations.turn_id`, `ai_record_generation` |
| `supabase/migrations/20261003000042_ask_korume_entitlement.sql` (+ `.test.ts`) | `korume_free_turn` / `korume_plus_turn`, `ai_reservations.turn_id`, `ai_reserve` v2, `ai_settle`, `ai_usage_snapshot`, `korume_complete_turn` |
| `supabase/migrations/20261003000043_companion_enabled.sql` (+ `.test.ts`) | `user_preferences.companion_enabled` |
| `supabase/tests/korume.sql`, `supabase/tests/korume-race/*`, `scripts/verify-korume-gate.ps1` | `verify:db:korume` |
| `lib/korume/types.ts` | thread / message / anchor / grounding / plan DTO types |
| `lib/korume/answer.ts` | `AnswerV1` zod schema, `answerToPlainText`, `dropUngroundedCards` |
| `lib/korume/plan.ts` | planner schema, `validatePlan`, `fallbackPlan` |
| `lib/korume/text.ts` | `normalizeTurnText`, `threadTitle` |
| `lib/korume/route.ts` | `originRouteFor` |
| `lib/korume/gate.ts` | `korumeGate()` — auth, `companion_enabled`, fail-closed |
| `lib/korume/limits.ts` | turn TTL, deadlines, the TTL invariant |
| `lib/korume/prompts.ts` | planner and answer prompts (persona, delimited data) |
| `lib/korume/tools/{line-analysis,dictionary,memory,knowledge,exposure}.ts` | the five allowlisted tools |
| `lib/korume/retrieval.ts` | `runRetrieval` — parallel, bounded, `ToolResult` |
| `lib/korume/grounding.ts` | `buildGroundedEntities` |
| `lib/korume/store.ts`, `lib/korume/memory-store.ts` (test support) | SQL-backed turn store, in-memory twin |
| `lib/korume/turn.ts` | `runTurn` — the pipeline |
| `lib/data/korume.ts`, `lib/validation/korume.ts` | façades + request schemas |
| `app/api/korume/threads/route.ts`, `app/api/korume/threads/[id]/route.ts`, `app/api/korume/threads/[id]/turns/route.ts` | API |
| `components/korume/{answer-blocks,listen-button,use-japanese-voice,message-list,composer,turn-notice,use-korume-thread}.tsx/.ts` | shared chat core |
| `components/shadowing-workspace/korume-mascot.tsx`, `components/shadowing-workspace/korume-sheet.tsx` | viewport A |
| `app/[locale]/(protected)/(app)/korume/chat/page.tsx`, `components/korume/{korume-chat-page,korume-rail,thread-menu}.tsx` | viewport B |
| `next.config.mjs`, `lib/supabase/route-protection.ts` | `/sensei` redirect, `/korume` protected |
| `docs/product/{capability-map,ia-proposal,screen-inventory}.md`, `docs/product/domain-model.md` | route + persona rulings |

---

### Task 0: Probe (Claude, throwaway)

Nothing is committed except findings in the run state.

- [ ] **Step 1: Opus price.** Use the `claude-api` skill to read the current input / output / cache-read price per million tokens for the model id the Anthropic adapter resolves for tier `deep` (`claude-opus-4-8`, `lib/ai/providers/anthropic.ts:17`). If the skill shows that id retired or renamed, record that and stop for the owner — do not change the adapter in this branch. Task 2 writes the numbers into `lib/knowledge/pricing.ts`.
- [ ] **Step 2: Route param.** Confirm `app/[locale]/(protected)/(focus)/shadowing/[id]` takes a **video** id and honours `?line=<lineId>` (`workspace-shell.tsx` `requestedLineId`). Record the exact URL shape Task 4's `originRouteFor` must produce.
- [ ] **Step 3: Gemini models.** Read `.env.local` names only (never print values): `AI_PROVIDER`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_DEEP`. Record whether a live smoke is possible without owner setup.
- [ ] **Step 4: Baseline.** In the worktree, after `npm ci`: `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, vitest (constraints above), every `npm run verify:db:*`. Record counts; a red baseline stops the branch.

---

### Task 1: Thread / message migration and its live gate

**Files:**
- Create: `supabase/migrations/20261003000041_ask_korume_threads.sql`, `supabase/migrations/20261003000041_ask_korume_threads.test.ts`
- Create: `supabase/tests/korume.sql`, `scripts/verify-korume-gate.ps1` (copy the structure of `scripts/verify-knowledge-gate.ps1`; the race directory is added in Task 2)
- Modify: `package.json` — `"verify:db:korume": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-korume-gate.ps1"`
- Modify: `lib/knowledge/types.ts` — `GenerationRow.knowledgeEntryId: string | null`, `GenerationRow.section: KnowledgeSection | "korume_plan" | "korume_answer"`, `GenerationRow.turnId?: string`
- Create: `lib/korume/types.ts`

**Interfaces:**
- Produces (SQL): columns of §2.1/§2.2; triggers `korume_clear_line_anchor()` on `transcript_lines` and `korume_clear_video_anchor()` on `videos` (both `before delete`); `ai_record_generation(p_row jsonb)` reading `p_row->>'turnId'`.
- Produces (TS, `lib/korume/types.ts`):

```ts
import type { Utf16Span } from "@/lib/analysis/types";

export interface KorumeAnchorInput { videoId: string; lineId: string; span: Utf16Span | null }
export interface KorumeAnchorView {
  videoId: string; videoTitle: string; lineId: string; lineText: string;
  translation: string | null; startTime: number; span: Utf16Span | null;
}
export interface KorumeThreadView {
  id: string; title: string | null; anchor: KorumeAnchorView | null;
  originRoute: string | null; updatedAt: string;
}
export type GroundedEntityKind = "vocabulary" | "grammar" | "particle";
export interface GroundedEntity {
  id: string;                 // "ent:<entSeq>" | "tok:<base>:<pos>"
  label: string; reading?: string; kind: GroundedEntityKind;
  jlpt?: "N5" | "N4" | "N3" | "N2" | "N1"; gloss?: string;
  seenCount?: number; seenCapped?: boolean;
  lessonLink?: { videoId: string; lineId?: string };
}
export interface KorumeMessageView {
  id: string; turnId: string; role: "user" | "assistant"; text: string;
  answer: import("./answer").AnswerV1 | null;      // assistant only
  grounding: GroundedEntity[] | null;              // assistant only
  createdAt: string;
}
export interface PendingTurn { turnId: string; status: "running" | "retryable" }
export interface KorumeThreadDetail { thread: KorumeThreadView; messages: KorumeMessageView[]; pendingTurns: PendingTurn[] }
```

- [ ] **Step 1: Write the failing migration test** — `20261003000041_ask_korume_threads.test.ts`, the `normalized()` helper copied from `20261002000038_knowledge.test.ts`:

```ts
describe("ask korume threads SQL contract", () => {
  const sql = normalized("20261003000041_ask_korume_threads.sql");
  it("discriminates sessions by kind without breaking scenario rows", () => {
    expect(sql).toContain("add column kind text not null default 'scenario'");
    expect(sql).toContain("check (kind in ('scenario', 'ask_korume'))");
    // Correction 4: scenario_type stays nullable for scenario rows.
    expect(sql).not.toMatch(/kind = 'scenario' and scenario_type is not null/);
    expect(sql).toMatch(/kind = 'scenario' and origin_video_id is null and origin_line_id is null and origin_span is null and origin_route is null and title is null/);
    expect(sql).toMatch(/kind = 'ask_korume' and scenario_type is null/);
  });
  it("shapes the anchor", () => {
    expect(sql).toContain("check (origin_span is null or origin_line_id is not null)");
    expect(sql).toContain("check (origin_line_id is null or origin_video_id is not null)");
    expect(sql).toMatch(/jsonb_typeof\(origin_span->'start'\) = 'number'/);
    expect(sql).toMatch(/\(origin_span - 'start' - 'end'\) = '\{\}'::jsonb/);
    expect(sql).toContain("origin_route like '/%' and origin_route not like '//%' and position(':' in origin_route) = 0");
  });
  it("versions structured content and grounding and keys turns", () => {
    expect(sql).toContain("add column content_json jsonb");
    expect(sql).toContain("add column grounding_json jsonb");
    expect(sql).toContain("check ((content_json is null) = (content_schema_version is null))");
    expect(sql).toContain("check ((grounding_json is null) = (grounding_schema_version is null))");
    expect(sql).toContain("check (role <> 'user' or (content_json is null and grounding_json is null))");
    expect(sql).toContain("create unique index conversation_messages_turn_role on conversation_messages (session_id, turn_id, role) where turn_id is not null");
    expect(sql).not.toMatch(/rename column content/);
  });
  it("clears anchors before their sources are deleted", () => {
    expect(sql).toContain("before delete on transcript_lines for each row execute function korume_clear_line_anchor()");
    expect(sql).toContain("before delete on videos for each row execute function korume_clear_video_anchor()");
    for (const f of ["korume_clear_line_anchor", "korume_clear_video_anchor"]) {
      expect(sql).toContain(`revoke all on function ${f}() from public, anon, authenticated`);
    }
  });
  it("correlates generations with a turn", () => {
    expect(sql).toContain("alter table ai_generations add column turn_id uuid");
    expect(sql).toContain("(p_row->>'turnid')::uuid"); // normalized() lowercases
    expect(sql).toContain("create index conversation_sessions_user_kind_updated on conversation_sessions (user_id, kind, updated_at desc)");
  });
});
```

- [ ] **Step 2: Run it — FAIL** (`npx vitest run supabase/migrations/20261003000041_ask_korume_threads.test.ts`, file missing).

- [ ] **Step 3: Write the migration.**

```sql
-- Ask Korume threads (spec 2026-10-03 §2.1, §2.2). Reuses the conversation tables behind `kind`.

alter table conversation_sessions
  add column kind text not null default 'scenario',
  add column origin_video_id uuid references videos (id) on delete set null,
  add column origin_line_id uuid references transcript_lines (id) on delete set null,
  add column origin_span jsonb,
  add column origin_route text,
  add column title text,
  add column updated_at timestamptz not null default now();

alter table conversation_sessions
  add constraint conversation_sessions_kind check (kind in ('scenario', 'ask_korume')),
  add constraint conversation_sessions_kind_shape check (
    (kind = 'scenario' and origin_video_id is null and origin_line_id is null and origin_span is null
       and origin_route is null and title is null)
    or (kind = 'ask_korume' and scenario_type is null)),
  add constraint conversation_sessions_span_needs_line check (origin_span is null or origin_line_id is not null),
  add constraint conversation_sessions_line_needs_video check (origin_line_id is null or origin_video_id is not null),
  add constraint conversation_sessions_span_shape check (origin_span is null or (
    jsonb_typeof(origin_span) = 'object'
    and jsonb_typeof(origin_span->'start') = 'number' and jsonb_typeof(origin_span->'end') = 'number'
    and (origin_span - 'start' - 'end') = '{}'::jsonb
    and (origin_span->>'start')::numeric = floor((origin_span->>'start')::numeric)
    and (origin_span->>'end')::numeric = floor((origin_span->>'end')::numeric)
    and (origin_span->>'start')::int >= 0 and (origin_span->>'end')::int > (origin_span->>'start')::int)),
  add constraint conversation_sessions_route_shape check (origin_route is null or (
    origin_route like '/%' and origin_route not like '//%' and position(':' in origin_route) = 0));

create index conversation_sessions_user_kind_updated on conversation_sessions (user_id, kind, updated_at desc);

alter table conversation_messages
  add column content_json jsonb,
  add column content_schema_version smallint,
  add column grounding_json jsonb,
  add column grounding_schema_version smallint,
  add column turn_id uuid;

alter table conversation_messages
  add constraint conversation_messages_content_version check ((content_json is null) = (content_schema_version is null)),
  add constraint conversation_messages_grounding_version check ((grounding_json is null) = (grounding_schema_version is null)),
  add constraint conversation_messages_user_plain check (role <> 'user' or (content_json is null and grounding_json is null));

create unique index conversation_messages_turn_role on conversation_messages (session_id, turn_id, role) where turn_id is not null;

-- Source deletion keeps the chat and clears the anchor in one step (spec §2.1). Runs before the FK action, so the
-- CHECK chain span → line → video never sees a half-cleared row.
create function korume_clear_line_anchor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversation_sessions set origin_line_id = null, origin_span = null where origin_line_id = old.id;
  return old;
end $$;

create function korume_clear_video_anchor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversation_sessions
    set origin_video_id = null, origin_line_id = null, origin_span = null, origin_route = null
    where origin_video_id = old.id;
  return old;
end $$;

create trigger korume_clear_line_anchor before delete on transcript_lines for each row execute function korume_clear_line_anchor();
create trigger korume_clear_video_anchor before delete on videos for each row execute function korume_clear_video_anchor();
revoke all on function korume_clear_line_anchor() from public, anon, authenticated;
revoke all on function korume_clear_video_anchor() from public, anon, authenticated;

alter table ai_generations add column turn_id uuid;
create index ai_generations_turn on ai_generations (turn_id) where turn_id is not null;

create or replace function ai_record_generation(p_row jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into ai_generations (requested_by_user_id, billing_scope, knowledge_entry_id, reservation_id, section,
    provider, model, input_tokens, output_tokens, cache_read_tokens, latency_ms, estimated_cost_usd, outcome, turn_id)
  values ((p_row->>'requestedByUserId')::uuid, p_row->>'billingScope', (p_row->>'knowledgeEntryId')::uuid,
    (p_row->>'reservationId')::uuid, p_row->>'section', p_row->>'provider', p_row->>'model',
    coalesce((p_row->>'inputTokens')::int, 0), coalesce((p_row->>'outputTokens')::int, 0),
    coalesce((p_row->>'cacheReadTokens')::int, 0), (p_row->>'latencyMs')::int,
    coalesce((p_row->>'estimatedCostUsd')::numeric, 0), p_row->>'outcome', (p_row->>'turnId')::uuid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function ai_record_generation(jsonb) from public, anon, authenticated;
grant execute on function ai_record_generation(jsonb) to service_role;
```

Check before committing: the video cascade (`videos` → `transcripts` → `transcript_lines`) — the video trigger fires first and already clears `origin_line_id`, so the line trigger then matches nothing. Prove it in Step 5, case 4; do not reason about it.

- [ ] **Step 4: Run Step 1's test — PASS.**

- [ ] **Step 5: Live gate** — `supabase/tests/korume.sql` (style of `supabase/tests/knowledge.sql`; gate rows: users `korumegate-*@example.invalid`, video titles `korumegate-*`; delete them first and at the end). Cases, each `raise exception 'FAIL n: …'` on violation:
  1. Every pre-existing `conversation_sessions` row has `kind = 'scenario'` and satisfies every constraint (`select count(*) … where kind <> 'scenario'` = 0 before any gate insert).
  2. A `scenario` row with `scenario_type` null inserts (Correction 4); one with `title` set is rejected (`check_violation`).
  3. `ask_korume` rows: `origin_span` `{"start":0,"end":3}` with a line → ok; `{"start":3,"end":3}`, `{"start":-1,"end":2}`, `{"start":0.5,"end":2}`, `{"start":0,"end":2,"x":1}`, a span without a line, a line without a video, `origin_route` `//evil`, `https://x`, `/a:b` → each rejected.
  4. **Source deletion:** create a gate video + transcript + line, a thread anchored to it with two messages. `delete from transcript_lines where id = …` → thread exists, `origin_line_id` and `origin_span` null, `origin_video_id` kept, both messages kept. Re-anchor a second thread, then `delete from videos where id = …` → thread exists with all four `origin_*` null, messages kept.
  5. Messages: a `user` row with `content_json` is rejected; an `assistant` row with `content_json` but no version is rejected; a second `(session, turn, 'user')` row is a `unique_violation`; two scenario messages with null `turn_id` in one session are fine.
  6. `ai_record_generation` with `turnId` stores it; without it stores null.
  7. `erase_companion_memory()` run as a gate learner (set `request.jwt.claims`) removes that learner's `ask_korume` sessions and their messages and no one else's.

Run: `npx supabase db reset` (ask the owner first, Global Constraints), then `npm run verify:db:korume`, then every other `verify:db:*` (the scenario gate `verify:db:settings` must stay green unchanged).

- [ ] **Step 6: Regression.** `npx vitest run lib/data/conversation app/api/conversation` exits 0 **with no test file edited** (§7.4).

- [ ] **Step 7: Commit** — `feat(korume): thread and message schema on the conversation tables`.

---

### Task 2: Entitlement migration, pricing and config

**Files:**
- Create: `supabase/migrations/20261003000042_ask_korume_entitlement.sql` (+ `.test.ts`)
- Create: `supabase/tests/korume-race/{setup.sql,turn-worker.sql,controller.sql,assert.sql,run.sh}` (copy the barrier pattern of `supabase/tests/knowledge-race/`)
- Modify: `scripts/verify-korume-gate.ps1` (run the race directory after `korume.sql`), `supabase/tests/korume.sql` (cases 8–13)
- Modify: `lib/knowledge/types.ts` (`ReserveInput.entitlementKind` adds `"korume_free_turn" | "korume_plus_turn"`, `ReserveInput.turnId?: string`, `ReserveLimits` adds `askKorumeFreeTurnsPerDay`, `askKorumePlusTurnsPerDay`; `ReserveOutcome` adds `"turn_exists"`)
- Modify: `lib/knowledge/store.ts` (`reserve` passes `p_turn_id: input.turnId ?? null`), `lib/knowledge/orchestrator.ts` (its `limits` object gains the two new keys from config — the Knowledge branch ignores them)
- Modify: `lib/knowledge/config.ts` (+ test): `AI_ASK_KORUME_FREE_TURNS_PER_DAY: count.default(10)`, `AI_ASK_KORUME_PLUS_TURNS_PER_DAY: count.default(100)` → `askKorumeFreeTurnsPerDay`, `askKorumePlusTurnsPerDay`
- Modify: `lib/knowledge/pricing.ts` (+ test): `DEEP_TIER_PRICE`, the Task 0 Opus price in `MODEL_PRICES`, `upperBoundCostUsdForTier`
- Modify: `.env.example` — the two new variables with their defaults

**Interfaces:**
- Consumes: Task 1 columns.
- Produces (SQL):
  - `ai_reserve(p_requested_by uuid, p_billing_scope text, p_entitlement_kind text, p_fingerprint text, p_reserved_credits int, p_reserved_usd numeric, p_limits jsonb, p_ttl_seconds int, p_turn_id uuid default null) returns table (reservation_id uuid, outcome text, resets_at timestamptz)` — new outcome `'turn_exists'` when a `held`/`settled` reservation already carries `p_turn_id`.
  - `korume_complete_turn(p_session uuid, p_turn uuid, p_reservation uuid, p_generation uuid, p_credits int, p_usd numeric, p_content text, p_content_json jsonb, p_grounding_json jsonb, p_title text) returns table (message_id uuid, charged boolean)`.
- Produces (TS): `upperBoundCostUsdForTier(provider: AiProviderName, tier: Tier, inputTokens: number, maxOutputTokens: number): number`; `KnowledgeConfig.askKorumeFreeTurnsPerDay`, `.askKorumePlusTurnsPerDay`.

- [ ] **Step 1: Failing migration test** (`normalized()` again):

```ts
describe("ask korume entitlement SQL contract", () => {
  const sql = normalized("20261003000042_ask_korume_entitlement.sql");
  it("adds two turn kinds to both ledgers", () => {
    for (const t of ["ai_reservations", "ai_usage_charges"]) {
      expect(sql).toMatch(new RegExp(`alter table ${t} .*check \\(entitlement_kind in \\('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn'\\)\\)`));
    }
  });
  it("keys one active reservation per turn", () => {
    expect(sql).toContain("alter table ai_reservations add column turn_id uuid");
    expect(sql).toContain("create unique index ai_reservations_turn_active on ai_reservations (turn_id) where turn_id is not null and status in ('held', 'settled')");
  });
  it("recreates ai_reserve with a turn id and reclaims expired holds first", () => {
    expect(sql).toContain("drop function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int)");
    expect(sql).toContain("p_turn_id uuid default null");
    expect(sql.indexOf("perform ai_release_expired()")).toBeLessThan(sql.indexOf("'korume_free_turn'"));
    expect(sql).toContain("'turn_exists'");
    expect(sql).toContain("revoke all on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) from public, anon, authenticated");
  });
  it("shares the Plus credit pool in reserve, settle and the usage snapshot", () => {
    const pool = "entitlement_kind in ('plus_section', 'korume_plus_turn')";
    expect(sql.split(pool).length - 1).toBeGreaterThanOrEqual(4);
  });
  it("completes a turn in one function", () => {
    expect(sql).toContain("create function korume_complete_turn(");
    expect(sql).toContain("v_charged := ai_settle(p_reservation, p_generation, p_credits, p_usd)");
    expect(sql).toContain("revoke all on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) from public, anon, authenticated");
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Write the migration.** Key parts (copy every unchanged line of `ai_reserve` from migration 038 verbatim; only the marked parts change):

```sql
alter table ai_reservations drop constraint ai_reservations_entitlement_kind_check;
alter table ai_reservations add constraint ai_reservations_entitlement_kind_check
  check (entitlement_kind in ('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn'));
alter table ai_usage_charges drop constraint ai_usage_charges_entitlement_kind_check;
alter table ai_usage_charges add constraint ai_usage_charges_entitlement_kind_check
  check (entitlement_kind in ('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn'));
-- The constraint names above are Postgres's defaults for 038's inline checks; confirm with \d before relying on them.

alter table ai_reservations add column turn_id uuid;
create unique index ai_reservations_turn_active on ai_reservations (turn_id)
  where turn_id is not null and status in ('held', 'settled');

drop function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int);
create function ai_reserve(p_requested_by uuid, p_billing_scope text, p_entitlement_kind text, p_fingerprint text,
  p_reserved_credits int, p_reserved_usd numeric, p_limits jsonb, p_ttl_seconds int, p_turn_id uuid default null)
returns table (reservation_id uuid, outcome text, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  -- (038's declarations, unchanged)
begin
  -- (038's learner check + per-user advisory lock, unchanged)
  perform ai_release_expired();

  -- NEW: one logical turn holds at most one active reservation. Checked under the user lock, before any count.
  if p_turn_id is not null and exists (
    select 1 from ai_reservations r where r.turn_id = p_turn_id and r.status in ('held', 'settled')) then
    return query select null::uuid, 'turn_exists'::text, null::timestamptz;
    return;
  end if;

  -- (038's budget row lock and global check, unchanged)

  if p_billing_scope = 'learner' and p_entitlement_kind = 'free_sentence' then
    -- (unchanged)
  elsif p_billing_scope = 'learner' and p_entitlement_kind = 'korume_free_turn' then
    select count(*) into v_count from ai_reservations r
    where r.requested_by_user_id = p_requested_by and r.period_day = v_day and r.entitlement_kind = 'korume_free_turn'
      and r.status in ('held', 'settled');
    if v_count >= (p_limits->>'askKorumeFreeTurnsPerDay')::int then
      return query select null::uuid, 'quota_exhausted'::text, v_next_day;
      return;
    end if;
  elsif p_billing_scope = 'learner' and p_entitlement_kind in ('plus_section', 'korume_plus_turn') then
    select count(*) into v_count from ai_reservations r
    where r.requested_by_user_id = p_requested_by and r.period_day = v_day and r.entitlement_kind = p_entitlement_kind
      and r.status in ('held', 'settled');
    if v_count >= (case when p_entitlement_kind = 'plus_section'
                        then (p_limits->>'plusMaxSectionsPerDay')::int
                        else (p_limits->>'askKorumePlusTurnsPerDay')::int end) then
      return query select null::uuid, 'fuse_tripped'::text, v_next_day;
      return;
    end if;
    select coalesce((select sum(c.credits) from ai_usage_charges c
                     where c.user_id = p_requested_by and c.period_month = v_month
                       and c.entitlement_kind in ('plus_section', 'korume_plus_turn')), 0)
         + coalesce((select sum(r.reserved_credits) from ai_reservations r
                     where r.requested_by_user_id = p_requested_by and r.period_month = v_month
                       and r.entitlement_kind in ('plus_section', 'korume_plus_turn') and r.status = 'held'), 0)
      into v_credits;
    if v_credits + p_reserved_credits > (p_limits->>'plusCreditsPerMonth')::int then
      return query select null::uuid, 'credits_exhausted'::text, v_next_month;
      return;
    end if;
  end if;

  insert into ai_reservations (requested_by_user_id, billing_scope, entitlement_kind, fingerprint, reserved_credits,
    reserved_usd, expires_at, period_day, period_month, turn_id)
  values (p_requested_by, p_billing_scope, p_entitlement_kind, p_fingerprint,
    case when p_entitlement_kind in ('plus_section', 'korume_plus_turn') then p_reserved_credits else 0 end,
    p_reserved_usd, now() + make_interval(secs => p_ttl_seconds), v_day, v_month, p_turn_id)
  returning id into v_id;
  -- (038's budget update and return, unchanged)
end $$;
revoke all on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) from public, anon, authenticated;
grant execute on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) to service_role;
```

`ai_settle`: `create or replace` from **migration 040's** body (it carries the late-spend path), changing only the credits `case` to `when v_res.entitlement_kind in ('plus_section', 'korume_plus_turn')`. `ai_usage_snapshot`: `create or replace`, both `plusCreditsUsed` sums widened to `in ('plus_section', 'korume_plus_turn')`, and a new key `askKorumeTurnsUsed` (count of today's `korume_free_turn` + `korume_plus_turn` reservations in `held`/`settled`). Re-issue both functions' revoke/grant.

```sql
-- The success transaction of one turn (spec §3.3, plan Correction 2): persist the answer, settle, title, touch.
create function korume_complete_turn(p_session uuid, p_turn uuid, p_reservation uuid, p_generation uuid,
  p_credits int, p_usd numeric, p_content text, p_content_json jsonb, p_grounding_json jsonb, p_title text)
returns table (message_id uuid, charged boolean)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_charged boolean;
begin
  insert into conversation_messages (session_id, role, content, content_json, content_schema_version,
    grounding_json, grounding_schema_version, turn_id)
  values (p_session, 'ai', p_content, p_content_json, 1, p_grounding_json, 1, p_turn)
  on conflict (session_id, turn_id, role) where turn_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    -- Already completed: never settle twice. ai_settle is idempotent too; this keeps the answer single.
    select m.id into v_id from conversation_messages m
      where m.session_id = p_session and m.turn_id = p_turn and m.role = 'ai';
    return query select v_id, false;
    return;
  end if;
  v_charged := ai_settle(p_reservation, p_generation, p_credits, p_usd);
  update conversation_sessions
    set updated_at = now(), title = coalesce(title, p_title)
    where id = p_session and kind = 'ask_korume';
  return query select v_id, v_charged;
end $$;
revoke all on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) to service_role;
```

The role enum is `conversation_role ('user', 'ai')` — the assistant row is `'ai'`. The TS layer maps `'ai'` ↔ `"assistant"`.

- [ ] **Step 4: Pricing + config, TDD.** Tests first:

```ts
// lib/knowledge/pricing.test.ts (additions)
it("bounds the deep tier with the deep model's price", () => {
  expect(upperBoundCostUsdForTier("anthropic", "deep", 1_000_000, 0)).toBe(OPUS_INPUT_PER_MTOK);   // Task 0 value
  expect(upperBoundCostUsdForTier("anthropic", "fast", 1_000_000, 0)).toBe(1);                    // Haiku, unchanged
  expect(upperBoundCostUsdForTier("gemini", "deep", 1_000_000, 1_000_000)).toBe(0);
});
it("prices the deep model's actual usage", () => {
  expect(estimateCostUsd("claude-opus-4-8", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 })).toBe(OPUS_INPUT_PER_MTOK);
});
// lib/knowledge/config.test.ts (additions)
it("defaults Ask Korume to 10 Free turns and a 100-turn Plus fuse", () => {
  const c = readKnowledgeConfig({});
  expect([c.askKorumeFreeTurnsPerDay, c.askKorumePlusTurnsPerDay]).toEqual([10, 100]);
  expect(readKnowledgeConfig({ AI_ASK_KORUME_FREE_TURNS_PER_DAY: "3" }).askKorumeFreeTurnsPerDay).toBe(3);
});
```

`upperBoundCostUsd(provider, …)` stays as the fast-tier alias (`upperBoundCostUsdForTier(provider, "fast", …)`) so the orchestrator is untouched.

- [ ] **Step 5: Live gate cases** appended to `supabase/tests/korume.sql`:
  8. Free: ten `korume_free_turn` reservations → the eleventh `quota_exhausted` with `resets_at` = next UTC midnight; release one → the next reserves.
  9. **Expired holds do not eat the day:** ten `held` rows with `expires_at` in the past → the eleventh reserves (`ai_release_expired` ran first).
  10. Plus fuse: `askKorumePlusTurnsPerDay = 2` in the limits → third `fuse_tripped`; a `plus_section` reservation is not counted against it.
  11. Shared pool both ways: `plusCreditsPerMonth = 10`; settle a `plus_section` for 6 credits → a `korume_plus_turn` asking 5 is `credits_exhausted`; and the mirror case. `ai_usage_snapshot.plusCreditsUsed` includes both.
  12. `turn_exists`: two reserves with one `p_turn_id` → second is `turn_exists`, budget `reserved_usd` grew once; release the first → a new reserve with that `turn_id` succeeds.
  13. `korume_complete_turn`: success → one `'ai'` message with versions 1, reservation `settled`, one charge (credits for `korume_plus_turn`, 0 for `korume_free_turn`), `title` set only when null, `updated_at` moved; a second call → same `message_id`, `charged = false`, still one charge.
  14. The Knowledge cases of `verify:db:knowledge` still pass unchanged (run it).
- [ ] **Step 6: Race gate** — `supabase/tests/korume-race/`: 20 connections released together call `ai_reserve(..., p_turn_id => <one uuid>)` for one Free learner → exactly one `reserved`, 19 `turn_exists`, one row in `ai_reservations`, budget incremented once.
- [ ] **Step 7:** `npx supabase db reset`, `npm run verify:db:korume`, `npm run verify:db:knowledge`, all gates. Commit — `feat(korume): per-turn entitlement on the AI ledger`.

---

### Task 3: `companion_enabled` and the server gate

**Files:**
- Create: `supabase/migrations/20261003000043_companion_enabled.sql` (+ `.test.ts`)
- Modify: `lib/preferences/options.ts` (`companionEnabled: boolean`, default `true`), `lib/data/preferences.ts` (row type, `COLUMNS`, `fromRow`, `TO_COLUMN`), `lib/validation/preferences.ts` (`z.object({ companionEnabled: z.boolean() }).strict()`), their tests
- Modify: `components/settings/privacy-data-section.tsx` (+ test), `components/settings/settings-icon.tsx` (`"companion"` glyph), `messages/{en,vi}/settings.json` (`page.companion.label`, `page.companion.description`), `messages/en/settings.pin.test.ts` if it pins that group
- Create: `lib/korume/gate.ts` (+ test)

**Interfaces:**
- Produces:

```ts
// lib/korume/gate.ts
import "server-only";
export type KorumeGate =
  | { kind: "unauthorized" }
  | { kind: "disabled" }
  | { kind: "unavailable" }          // preferences could not be read — fail closed (Correction 6)
  | { kind: "ok"; supabase: ReturnType<typeof createClient>; userId: string };
export async function korumeGate(): Promise<KorumeGate>;
```

- [ ] **Step 1: Failing tests.**

```ts
// lib/korume/gate.test.ts
it("refuses before the preference read when signed out", async () => { /* requireUser → null ⇒ unauthorized; readPreferencesOrThrow not called */ });
it("refuses a learner who turned Korume off", async () => { /* companionEnabled false ⇒ disabled */ });
it("fails closed when preferences cannot be read", async () => {
  /* readPreferencesOrThrow rejects ⇒ { kind: "unavailable" } — never "ok" (Review Focus 3) */
});
it("lets an enabled learner through with their client", async () => { /* ⇒ ok, userId */ });
```

Mutation: swap `readPreferencesOrThrow` for `readPreferences` in `gate.ts` → the fail-closed test must go red.

Migration test: `add column companion_enabled boolean not null default true` on `user_preferences`; no new grant needed (the table's grants cover columns). Preferences tests: the patch `{ companionEnabled: false }` validates and maps to `companion_enabled`; `fromRow(null)` gives `true`.

Settings row test (`privacy-data-section.test.tsx`): a switch labelled by `page.companion.label`, checked from `preferences.companionEnabled`, `save({ companionEnabled: false })` on toggle.

- [ ] **Step 2: Run — FAIL. Step 3: implement** (`korumeGate` = `createClient()` → `requireUser` → `readPreferencesOrThrow(supabase, user.id)` in `try`; catch → `unavailable`). The Settings row sits after Camera in `PrivacyDataSection`, `icon="companion"`. EN copy: label "Korume", description "Show Korume in your lessons and let it answer your questions. Turning it off keeps your conversations." VI: label "Korume", description "Hiện Korume trong bài học và để Korume trả lời câu hỏi của bạn. Tắt đi vẫn giữ lại các cuộc trò chuyện."
- [ ] **Step 4: PASS; gates; `verify:db:settings` green. Commit** — `feat(korume): companion_enabled preference and fail-closed gate`.

---

### Task 4: Threads — validation, idempotent create, read, pending projection

**Files:**
- Create: `lib/korume/route.ts`, `lib/korume/text.ts`, `lib/validation/korume.ts`, `lib/korume/store.ts`, `lib/korume/memory-store.ts`, `lib/data/korume.ts` (+ tests for each)
- Create: `app/api/korume/threads/route.ts`, `app/api/korume/threads/[id]/route.ts` (+ tests)
- Create: `tests/e2e/korume-threads.spec.ts` (the HTTP thread-create race; owns its seed through the service-role client like `tests/e2e/fixtures/knowledge-data.ts`)
- Modify: `lib/supabase/route-protection.ts` (`"/korume"`), `lib/analysis/line-analysis.ts` (none — anchor validation uses `getLineForLearner` from `lib/data/knowledge.ts`)

**Interfaces:**
- Consumes: `korumeGate()` (Task 3); `getLineForLearner(supabase, lineId)` (`lib/data/knowledge.ts`); Task 1 types.
- Produces:

```ts
// lib/korume/route.ts
export function originRouteFor(videoId: string, lineId: string): string; // "/shadowing/<videoId>?line=<lineId>" (shape from Task 0)
// lib/korume/text.ts
export function normalizeTurnText(text: string): string;  // NFC, trim, collapse \s+ to " "
export function threadTitle(firstQuestion: string): string; // normalize, 40 code points, "…" when cut
// lib/validation/korume.ts
export const createThreadSchema: z.ZodType<{ threadId: string; videoId?: string; lineId?: string; span?: { start: number; end: number } }>; // .strict()
export const postTurnSchema: z.ZodType<{ turnId: string; text: string }>; // text 1..2000 after trim, .strict()
// lib/korume/store.ts — everything the pipeline needs from the DB, so Task 7 can swap in memory-store
export interface ThreadRow { id: string; userId: string; kind: "scenario" | "ask_korume"; title: string | null;
  originVideoId: string | null; originLineId: string | null; originSpan: Utf16Span | null; originRoute: string | null; updatedAt: string }
export interface CompleteTurnArgs { sessionId: string; turnId: string; reservationId: string; generationId: string;
  credits: number; usd: number; content: string; contentJson: AnswerV1; groundingJson: GroundedEntity[]; title: string }
export interface KorumeStore {
  insertThread(supabase: Supabase, row: { id: string; userId: string; anchor: { videoId: string; lineId: string; span: Utf16Span | null; route: string } | null }): Promise<"created" | "conflict">;
  readThreadRow(supabase: Supabase, id: string): Promise<ThreadRow | null>;      // RLS: null when not the caller's
  insertUserMessage(supabase: Supabase, sessionId: string, turnId: string, text: string): Promise<"created" | "exists">;
  readTurn(supabase: Supabase, sessionId: string, turnId: string): Promise<{ user: { text: string } | null; assistant: KorumeMessageView | null }>;
  reservationStates(turnIds: string[]): Promise<Map<string, "held" | "settled" | "released">>; // service client; newest per turn
  completeTurn(args: CompleteTurnArgs): Promise<{ messageId: string; charged: boolean }>;   // korume_complete_turn
}
// lib/data/korume.ts
export type CreateThreadResult = { kind: "unauthorized" | "disabled" | "unavailable" | "not_found" | "invalid" | "conflict" | "rate_limited"; retryAfter?: number } | { kind: "ok"; created: boolean; thread: KorumeThreadView };
export async function createThread(body: CreateThreadBody, deps?: { store?: KorumeStore }): Promise<CreateThreadResult>;
export async function listThreads(cursor: string | null): Promise<…{ threads: KorumeThreadView[]; nextCursor: string | null }>;
export async function getThread(id: string, deps?: { store?: KorumeStore }): Promise<…KorumeThreadDetail>;
export function pendingTurnsFor(userTurnIds: string[], answered: Set<string>, states: Map<string, "held" | "settled" | "released">): PendingTurn[];
```

- [ ] **Step 1: Failing unit tests.**

```ts
// lib/korume/text.test.ts
expect(normalizeTurnText("  は\n\n は  ")).toBe("は は");
expect(threadTitle("Why is は pronounced wa?")).toBe("Why is は pronounced wa?");
expect(threadTitle("x".repeat(41))).toBe("x".repeat(40) + "…");
expect(threadTitle("𠮷".repeat(41))).toBe("𠮷".repeat(40) + "…");   // code points, not UTF-16 units
// lib/korume/route.test.ts
expect(originRouteFor(V, L)).toBe(`/shadowing/${V}?line=${L}`);
// lib/validation/korume.test.ts
expect(createThreadSchema.safeParse({ threadId: U, originRoute: "/x" }).success).toBe(false);   // §7.2
expect(createThreadSchema.safeParse({ threadId: U, span: { start: 0, end: 2 } }).success).toBe(false); // span needs a line
// lib/data/korume.test.ts (pendingTurnsFor)
expect(pendingTurnsFor(["a", "b", "c"], new Set(["c"]), new Map([["a", "held"], ["b", "released"]])))
  .toEqual([{ turnId: "a", status: "running" }, { turnId: "b", status: "retryable" }]);
expect(pendingTurnsFor(["d"], new Set(), new Map())).toEqual([{ turnId: "d", status: "retryable" }]); // no hold left
```

`createThread` tests (memory store + mocked `getLineForLearner`): line not readable → `not_found`; line of another video → `not_found`; span `{0, len+1}` (UTF-16 length) → `invalid`; replay with the same id and anchor → `ok, created: false`; same id, different anchor → `conflict`; id of another learner's thread (store returns `conflict`, `readThreadRow` returns null) → `not_found`; id of a `scenario` session → `not_found`; `disabled` gate → `disabled` and **no store call** (assert on the recorded calls — the Supabase mock ignores filters).

- [ ] **Step 2: FAIL. Step 3: implement.**
  - `createThread`: gate → `rateLimit("korume:thread:" + userId, { limit: 20, windowMs: 60_000 })` → when `lineId`: `getLineForLearner` must return a line whose `videoId === body.videoId`; span checked with `0 <= start < end <= line.textJp.length` (JS string length is UTF-16) → `insertThread` with the **client `threadId` as the primary key** → on `conflict`, `readThreadRow`: null or `kind <> 'ask_korume'` → `not_found`; anchor differs → `conflict`; else `ok, created: false`.
  - `insertThread` uses the learner's client (RLS `conversation_sessions_own` checks `user_id = auth.uid()`); a `23505` is `"conflict"`.
  - `getThread`: `readThreadRow` (RLS) → messages under a total order (`created_at, id`) via `fetchAllPages` → map role `'ai'` → `"assistant"`, parse `content_json` with `AnswerV1` only when `content_schema_version === 1` (Task 7 owns the schema; until it lands, Task 4 keeps `answer: null` and its test asserts the raw passthrough is NOT exposed) → `pendingTurns` from `reservationStates` (service client, `select turn_id, status … in turn_ids … order by created_at desc`).
  - Anchor view joins `transcript_lines` (text, translation, start time) and `videos.title` under RLS; a source deleted since → `anchor: null`.
  - Routes: `POST /api/korume/threads` → 201 created / 200 replay / 400 / 401 / 403 `companion_disabled` / 404 `not_found` / 409 `thread_conflict` / 429 / 503 (`unavailable`). `GET /api/korume/threads?cursor=` and `GET /api/korume/threads/[id]` → 200 / 401 / 403 / 404. Every 404 body is `{ "error": "not_found" }` whatever the reason.
- [ ] **Step 4: E2E race** (`tests/e2e/korume-threads.spec.ts`): sign in a fresh learner (`registerViaUi`), seed a readable video+line; fire two `page.request.post("/api/korume/threads", { data: { threadId, videoId, lineId } })` with `Promise.all` → statuses `{201, 200}` in either order, both bodies name `threadId`; the service client counts **one** row. A second learner GETs it → 404. Run with the worktree's own server (constraints).
- [ ] **Step 5:** `assertPlainSerializableDto(await getThread(...))` on real output. Gates. Commit — `feat(korume): idempotent threads with anchor validation`.

---

### Task 5: Planner, plan validation and the four simple tools

**Files:**
- Create: `lib/korume/plan.ts`, `lib/korume/prompts.ts`, `lib/korume/retrieval.ts`, `lib/korume/limits.ts`, `lib/korume/tools/{line-analysis,dictionary,memory,knowledge}.ts` (+ tests)
- Modify: `lib/analysis/line-analysis.ts` — `export` `lookupForms` and `entriesFor` (no behaviour change; its tests stay green)

**Interfaces:**
- Consumes: `staticAnalyses` (`lib/analysis/line-analysis.ts`), `readCachedSection` (`lib/knowledge/orchestrator.ts`), `sectionDefinition`, `contextKeyFor` (`lib/knowledge/registry.ts`), `fingerprint` (`lib/knowledge/canonical.ts`), `KNOWLEDGE_SECTIONS` (`lib/knowledge/types.ts`), `getActivePlanTier`.
- Produces:

```ts
// lib/korume/plan.ts
export type PlanStep =
  | { tool: "line_analysis" }
  | { tool: "dictionary_lookup"; term: string }
  | { tool: "memory_lookup"; topic: string }
  | { tool: "learner_exposure"; term: string }
  | { tool: "knowledge_lookup"; section: CascadeSection };
export const planSchema: z.ZodType<{ steps: PlanStep[] }>;   // zod/v4, steps max 8 at parse, discriminated on tool
export const MAX_PLAN_STEPS = 4;
export function validatePlan(raw: { steps: PlanStep[] }, ctx: { hasAnchor: boolean }): PlanStep[];
export function fallbackPlan(ctx: { hasAnchor: boolean }): PlanStep[];   // anchor → [{tool:"line_analysis"}], else []
// lib/korume/retrieval.ts
export type ToolName = PlanStep["tool"];
export interface ToolResult<T = unknown> { tool: ToolName; key: string; status: "ok" | "not_found" | "error"; data?: T; errorCode?: "timeout" | "unavailable" }
export interface RetrievalContext { supabase: Supabase; userId: string; tier: PlanTier; locale: KnowledgeLocale; anchor: { lineId: string; videoId: string; lineText: string; videoTitle: string } | null }
export type Tool = (step: PlanStep, ctx: RetrievalContext) => Promise<Omit<ToolResult, "tool" | "key">>;
export async function runRetrieval(steps: PlanStep[], ctx: RetrievalContext, tools?: Partial<Record<ToolName, Tool>>, clock?: { toolMs: number; stageMs: number }): Promise<ToolResult[]>;
// lib/korume/limits.ts
export const TOOL_DEADLINE_MS = 3_000;
export const RETRIEVAL_DEADLINE_MS = 4_000;
export const TURN_RESERVATION_TTL_SECONDS = 180;
export const MAX_RECENT_TURNS = 6;
```

- [ ] **Step 1: Failing tests** (`lib/korume/plan.test.ts`):

```ts
const anchor = { hasAnchor: true }, free = { hasAnchor: false };
it("keeps at most four distinct steps", () => {
  const raw = { steps: [
    { tool: "dictionary_lookup", term: "は" }, { tool: "dictionary_lookup", term: " は " },
    { tool: "dictionary_lookup", term: "ｈａ" }, { tool: "line_analysis" }, { tool: "memory_lookup", topic: "particles" },
    { tool: "learner_exposure", term: "は" }, { tool: "knowledge_lookup", section: "grammar_breakdown" } ] } as const;
  const out = validatePlan(raw as never, anchor);
  expect(out).toHaveLength(4);
  expect(out.filter((s) => s.tool === "dictionary_lookup")).toHaveLength(2); // "は" and NFKC("ｈａ") = "ha"
});
it("drops anchor-only tools on free chat", () => {
  expect(validatePlan({ steps: [{ tool: "line_analysis" }, { tool: "knowledge_lookup", section: "lite" }] }, free)).toEqual([]);
});
it("rejects terms with no Japanese or Latin letter", () => {
  expect(validatePlan({ steps: [{ tool: "dictionary_lookup", term: "<>" }, { tool: "dictionary_lookup", term: "123" }] }, free)).toEqual([]);
});
it("refuses an unknown tool at parse time", () => {
  expect(planSchema.safeParse({ steps: [{ tool: "write_memory", topic: "x" }] }).success).toBe(false);
});
it("falls back to the anchor", () => {
  expect(fallbackPlan(anchor)).toEqual([{ tool: "line_analysis" }]);
  expect(fallbackPlan(free)).toEqual([]);
});
```

(Review Focus 4.) Retrieval tests with fake tools: a tool that never resolves → `{status:"error", errorCode:"timeout"}` after `toolMs`; a tool that throws `new Error("db down")` → `{status:"error", errorCode:"unavailable"}` and the message never appears in the result (`JSON.stringify(result)` does not contain `"db down"`); a stage deadline cuts every unfinished tool; one tool's failure leaves the others `ok`. Use injected `clock` values (e.g. 20 ms / 30 ms), never real 3 s waits.

Tool tests:
- `knowledge` tool calls `readCachedSection` and **never** `getOrGenerateSection` (spy on both; the latter must have zero calls — mutation: call it on a miss → red); a miss → `not_found`.
- `dictionary` tool: term → `lookupForms` on the active snapshot (`dict_active_snapshot_id` RPC), ranked with `entriesFor`, at most 3 matches; no snapshot → `not_found`.
- `line_analysis`: `staticAnalyses(supabase, [anchorLine], undefined, "lexical")` — never `getLineAnalysisForLearner` (Correction 7).
- `memory`: reads `companion_memories` for `userId`, `or(line_text_jp.ilike.%topic%,title.ilike.%topic%)` with `%`/`_` escaped, `order(occurred_at desc).limit(3)`; asserts on the recorded query that only `select` was issued (no insert/update/delete — §7.2).

- [ ] **Step 2: FAIL. Step 3: implement.** `normalizeTerm = (s) => s.normalize("NFKC").trim()`; a term passes when `/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z]/u` matches and its length is 1..32 (topic 1..64). Dedupe key `${tool}:${arg}`. Order: as the planner gave them.
  - `prompts.ts` `plannerPrompt({ question, anchor, recent })` → `{ system: SystemBlock[]; user: string }`. System (cacheable): the tool list with one line each and the rule "return only steps that help answer; at most 4". User: `<question>…</question>`, `<anchor>…</anchor>`, `<recent>…</recent>` — the learner's text and transcript text only inside these delimited blocks, with `<`/`>` inside them escaped to `‹`/`›` so a block cannot be closed early.
- [ ] **Step 4: PASS. Gates. Commit** — `feat(korume): planner validation and allowlisted retrieval`.

---

### Task 6: Progress-aware exposure and grounded entities

**Files:**
- Create: `lib/korume/tools/exposure.ts`, `lib/korume/grounding.ts` (+ tests)
- Create: `supabase/migrations/…` — **none**: exposure reads existing tables.

**Interfaces:**
- Consumes: `staticAnalyses`, `fetchAllPages`, the `latest_transcript_ids(p_video_ids uuid[])` SQL function, `ToolResult`.
- Produces:

```ts
// lib/korume/tools/exposure.ts
export const EXPOSURE_MAX_VIDEOS = 20;
export const EXPOSURE_MAX_LINES = 3_000;
export interface ExposureData { term: string; identity: string; seenCount: number; capped: boolean; label: string; reading?: string; pos?: string; firstSeen?: { videoId: string; lineId: string } }
export function tokenIdentity(token: AnalysisToken): string;   // entries[0] ? `ent:${entSeq}` : `tok:${base}:${pos}`
export function countExposure(term: string, termEntSeqs: Set<number>, lines: { videoId: string; lineId: string; tokens: AnalysisToken[] }[]): Omit<ExposureData, "capped">;
export const exposureTool: Tool;
// lib/korume/grounding.ts
export function buildGroundedEntities(results: ToolResult[], readableVideoIds: Set<string>): GroundedEntity[];
```

- [ ] **Step 1: Failing tests** (`exposure.test.ts`, pure `countExposure` + a seen-lines selector):

```ts
it("counts a particle by base and part of speech", () => {
  const lines = [line(["は/助詞", "日本/名詞"]), line(["は/助詞"]), line(["歯/名詞:ent:1"])];
  expect(countExposure("は", new Set(), lines)).toMatchObject({ identity: "tok:は:助詞", seenCount: 2 });
});
it("counts a word by JMdict entry, not by substring", () => {
  const lines = [line(["日本/名詞:ent:7"]), line(["日本語/名詞:ent:8"])];
  expect(countExposure("日本", new Set([7]), lines).seenCount).toBe(1);
});
it("counts only lines the learner reached", () => {
  // video A: completed ⇒ all 3 lines; video B: last_watched_position 10 ⇒ lines starting ≤ 10; line in shadowing_sessions counts even when beyond
  expect(seenLineIds(progressFixture).sort()).toEqual(["a1", "a2", "a3", "b1", "b2", "b9"].sort());
});
it("labels a capped count as a floor", () => { /* > EXPOSURE_MAX_LINES seen lines ⇒ capped true */ });
it("undercounts after a rewind instead of overclaiming", () => { /* last_watched_position moved back ⇒ fewer lines, no high-water mark */ });
```

`grounding.test.ts`: dictionary matches → `ent:<entSeq>` entities with label/reading/gloss/jlpt (`jlpt` number 5 → `"N5"`); line-analysis tokens with entries → entities; particles from exposure → `tok:` entities with `kind: "particle"`; duplicates merged (one id), `seenCount` attached from exposure; a `lessonLink` survives only when its `videoId` ∈ `readableVideoIds`; `status !== "ok"` results contribute nothing.

- [ ] **Step 2: FAIL. Step 3: implement** `exposureTool`: `user_video_progress` for `userId` `order(last_watched_at desc nulls last, video_id).limit(EXPOSURE_MAX_VIDEOS)` → `latest_transcript_ids` → lines of those transcripts (`fetchAllPages`, order `start_time, id`) filtered by `completed_at ?? start_time <= last_watched_position` → union `shadowing_sessions.transcript_line_id` for those videos → cap at `EXPOSURE_MAX_LINES` (`capped = true` when cut) → `staticAnalyses(…, "lexical")` → `countExposure`. The term's ent_seqs come from `lookupForms` + `entriesFor` (Task 5). The whole tool runs inside `TOOL_DEADLINE_MS` through `runRetrieval`.
- [ ] **Step 4: PASS. Gates. Commit** — `feat(korume): progress-aware exposure and grounding`.

---

### Task 7: The answer, the turn pipeline, `POST /turns`

**Files:**
- Create: `lib/korume/answer.ts`, `lib/korume/turn.ts` (+ tests); `app/api/korume/threads/[id]/turns/route.ts` (+ test)
- Modify: `lib/korume/prompts.ts` (`answerPrompt`), `lib/korume/memory-store.ts` (turn + reservation semantics identical to Task 2's SQL), `lib/data/korume.ts` (`postTurn`, and `getThread` now parses `AnswerV1`)

**Interfaces:**
- Consumes: everything above; `getProvider`, `isAiEnabled` (`lib/ai/registry.ts`); `KnowledgeStore.reserve/recordGeneration/release` (`lib/knowledge/store.ts`); `estimateCostUsd`, `upperBoundCostUsdForTier`, `creditsFor`; `readKnowledgeConfig`.
- Produces:

```ts
// lib/korume/answer.ts (zod/v4)
export type Run = { text: string; strong?: boolean } | { jp: string };
export type Block =
  | { type: "paragraph"; runs: Run[] }
  | { type: "example"; jp: string; ruby: { base: string; reading?: string }[]; translation: string }
  | { type: "context_card"; entityRef: string; note?: string }
  | { type: "followups"; chips: string[] };
export interface AnswerV1 { blocks: Block[] }
export const answerV1Schema: z.ZodType<AnswerV1>;   // 1..12 blocks, chips ≤4 × ≤40, text fields bounded
export function dropUngroundedCards(answer: AnswerV1, grounding: GroundedEntity[]): AnswerV1;
export function answerToPlainText(answer: AnswerV1, grounding: GroundedEntity[]): string;
// lib/korume/turn.ts
export type TurnOutcome =
  | { status: "answered"; message: KorumeMessageView }
  | { status: "pending" }
  | { status: "conflict" }
  | { status: "quota_exhausted"; reason: "free_daily_limit"; limit: number; resetsAt: string }
  | { status: "quota_exhausted"; reason: "plus_credits_exhausted"; resetsAt: string }
  | { status: "fuse_tripped"; resetsAt: string }
  | { status: "ai_unavailable"; reason: "disabled" | "budget" }
  | { status: "answer_failed" };
export interface TurnDeps { korume?: KorumeStore; knowledge?: KnowledgeStore; provider?: AiProvider; config?: KnowledgeConfig; aiEnabled?: boolean; tools?: Partial<Record<ToolName, Tool>> }
export async function runTurn(input: { supabase: Supabase; userId: string; threadId: string; turnId: string; text: string }, deps?: TurnDeps): Promise<TurnOutcome | { status: "not_found" }>;
```

- [ ] **Step 1: Failing tests — the matrices** (`lib/korume/turn.test.ts`, fake provider from `lib/ai/providers/fake.ts`, `memory-store.ts`, an in-memory `KnowledgeStore` from `lib/knowledge/memory-store.ts`):

| Case | Expect |
|---|---|
| fresh turn, planner ok, answer ok | `answered`; 2 generation rows with this `turnId` (`korume_plan`, `korume_answer`, both `success`); reservation `settled`; one charge; message has `content`, `content_json`, `grounding_json` |
| same `turnId` replayed after success | `answered` with the same message id; **0** provider calls; no new reservation |
| same `turnId`, different text | `conflict`; 0 provider calls; 0 reservations (§5.1) |
| same `turnId`, reservation `held` | `pending`; 0 provider calls |
| same `turnId`, previous reservation `released` | runs again; the existing user message reused (one user row) |
| planner throws | turn `answered`; `korume_plan` row `provider_error`; retrieval used `fallbackPlan`; one charge |
| planner returns invalid JSON | `korume_plan` row `validation_error` with the planner upper bound as cost; fallback plan |
| answer provider error | `answer_failed`; `release(reservation, planUsd + 0)`; no charge; user message kept |
| answer fails `answerV1Schema` | `answer_failed`; `release(reservation, planUsd + answerUpperUsd)`; no charge |
| `quota_exhausted` (free) | `{ reason: "free_daily_limit", limit: 10 }` (the configured value), 0 provider calls |
| thread not the caller's (RLS returns null) | `not_found`, 0 store writes, 0 provider calls (§7.2) |
| `credits_exhausted` (plus) | `{ reason: "plus_credits_exhausted" }` with the month reset |
| `fuse_tripped` | `fuse_tripped` |
| `budget_exhausted` / `aiEnabled: false` | `ai_unavailable` (`budget` / `disabled`), 0 provider calls, and with `aiEnabled: false` **no reservation** |
| a `context_card` naming an entity outside grounding | the card is absent from the persisted `content_json` |
| `knowledge_lookup` miss | 0 calls to `getOrGenerateSection`; the answer still runs |

And the concurrency case (Correction 3): `await Promise.all([runTurn(x), runTurn(x)])` on one memory store → one `answered` and one `pending`, or two `answered` with the same message id; exactly one planner+answer pipeline (2 provider calls total); one reservation; one user message; one assistant message. The memory store must implement `turn_exists` and the `(session, turn, role)` uniqueness exactly as Task 2's SQL does — its own test asserts that parity.

TTL invariant test (`lib/korume/limits.test.ts`):

```ts
it("never lets a running turn outlive its reservation", () => {
  expect(TURN_RESERVATION_TTL_SECONDS * 1000).toBeGreaterThan(2 * PROVIDER_TIMEOUT_MS + RETRIEVAL_DEADLINE_MS);
});
```

`answer.test.ts`: the schema rejects `{ type: "html" }`, 13 blocks, a fifth chip, a 41-char chip; `answerToPlainText` joins paragraphs, examples (`jp — translation`) and cards (entity label from grounding) with blank lines and never emits markup.

- [ ] **Step 2: FAIL. Step 3: implement `runTurn`** in the §5 order:
  1. `readThreadRow` (RLS) → `not_found` unless `kind = 'ask_korume'`.
  2. `readTurn(threadId, turnId)`: user text exists and `normalizeTurnText` differs → `conflict`; assistant exists → `answered` (replay).
  3. `if (!aiEnabled) → ai_unavailable/disabled` (before any reservation).
  4. tier = `getActivePlanTier(userId)`; kind = tier `free` ? `korume_free_turn` : `korume_plus_turn`; build both prompts' upper bounds (`inputTokenUpperBound` copied from the orchestrator — byte length; planner `fast` + answer `deep` via `upperBoundCostUsdForTier`); `knowledge.reserve({ …, entitlementKind: kind, fingerprint: "korume:" + turnId, turnId, reservedCredits: tier === "plus" ? creditsFor(upperUsd, unit) : 0, ttlSeconds: TURN_RESERVATION_TTL_SECONDS, limits })`. `turn_exists` → re-read: assistant → `answered`, else `pending`. Map refusals per the table.
  5. `insertUserMessage` (`exists` is fine — a retry after a release).
  6. Planner → `validatePlan` / `fallbackPlan`; record `korume_plan` with `turnId`.
  7. `runRetrieval`; `buildGroundedEntities` (readable video ids = the anchor's video plus lessonLink videos confirmed by an RLS `select id from videos where id in (…)`).
  8. Answer → `answerV1Schema` → `dropUngroundedCards`; record `korume_answer`.
  9. `completeTurn({ …, credits: tier === "plus" ? creditsFor(planUsd + answerUsd, unit) : 0, usd: planUsd + answerUsd, title: threadTitle(text) })`.
  - `answerPrompt` system: the Korume persona (cacheable; warm, concise, explains in the learner's locale, Japanese in examples, never invents facts about the learner, refers to entities only by the ids given) + the data block (uncacheable): `<anchor>`, `<retrieval>` (each `ToolResult` as compact JSON, statuses included), `<entities>` (id, label, kind), `<recent>`.
- [ ] **Step 4: Route** `POST /api/korume/threads/[id]/turns`: parse (`postTurnSchema`) → `korumeGate` (`unauthorized` 401, `disabled` 403 `companion_disabled`, `unavailable` 503) → `rateLimit("korume:turn:" + userId, { limit: 20, windowMs: 60_000 })` 429 `rate_limited` → `runTurn` → status table of §4.4 (`fuse_tripped` → 429 with `Retry-After` until `resetsAt`). Route test: every status and body; the order "gate before rate limit before store" asserted on recorded calls; 500 bodies are opaque.
- [ ] **Step 5: PASS. Gates. Commit** — `feat(korume): two-stage turn pipeline with per-turn settlement`.

---

### Task 8: Shared chat core

**Files:**
- Create: `components/korume/answer-blocks.tsx`, `components/korume/listen-button.tsx`, `components/korume/use-japanese-voice.ts`, `components/korume/message-list.tsx`, `components/korume/composer.tsx`, `components/korume/turn-notice.tsx`, `components/korume/use-korume-thread.ts` (+ tests)
- Modify: `messages/{en,vi}/companion.json` (`ask.*`), `messages/en/companion.pin.test.ts`, `components/ui/token-scale.test.ts` (`sources` pin)

**Interfaces:**
- Consumes: Task 1 / Task 7 types (`KorumeMessageView`, `AnswerV1`, `GroundedEntity`, `PendingTurn`); `RubySentence` (`components/shadowing-workspace/ruby-sentence.tsx`) — check its props and adapt `ruby` pairs to them; the API of Tasks 4 and 7.
- Produces:

```ts
// components/korume/use-korume-thread.ts
export interface DraftAnchor { videoId: string; lineId: string; span: { start: number; end: number } | null }
export interface KorumeThreadState {
  threadId: string;                // draftThreadId until created
  created: boolean;
  messages: KorumeMessageView[];
  pending: { turnId: string; text: string; status: "sending" | "running" | "retryable" | "failed" } | null;
  notice: TurnNotice | null;       // 402 / 429 / 503 / 409 / 403
}
export type TurnNotice =
  | { kind: "free_daily_limit"; limit: number; resetsAt: string } | { kind: "plus_credits_exhausted"; resetsAt: string }
  | { kind: "slow_down"; retryAfterSeconds: number } | { kind: "resting" } | { kind: "conflict" } | { kind: "disabled" };
export function useKorumeThread(init: { threadId?: string; anchor: DraftAnchor | null; initial?: KorumeThreadDetail }): KorumeThreadState & {
  send(text: string): Promise<void>;   // creates the thread on first send, then the turn; new turnId per logical turn
  retry(): Promise<void>;              // the SAME turnId
};
```

- [ ] **Step 1: Failing tests.**
  - `answer-blocks.test.tsx`: renders each block type; a `<script>` inside `text` is shown as text (query by text; `container.querySelector("script")` is null); a `context_card` resolves its label/reading/JLPT/"Seen N times"/"Seen N+ times" from the grounding passed in, and an unknown `entityRef` renders nothing; followup chips are buttons calling `onFollowup(chip)`.
  - `use-japanese-voice.test.ts` / `listen-button.test.tsx` with a mocked `speechSynthesis` (§7.3): a `ja-JP` voice → button present; empty list then `voiceschanged` adds `ja` → button appears; only `en-US` → no button in the DOM; clicking calls `cancel()` **before** `speak()` (assert call order) with `utterance.lang === "ja-JP"`; no `speechSynthesis` on `window` → no button.
  - `use-korume-thread.test.ts` (mocked `fetch`): first send POSTs `/api/korume/threads` with `threadId` then `/turns`; a lost response on the thread POST retried → the same `threadId`; `retry()` reuses the failed `turnId`; a new `send` makes a new `turnId`; 202 → polls `GET /threads/[id]` every 2000 ms (fake timers) and stops when the message appears, when `pendingTurns` says `retryable` (→ "Try again" shown), or after 180 s; each status maps to its notice.
  - `composer.test.tsx`: Enter sends, Shift+Enter inserts a newline, IME composition (`isComposing`) Enter does not send, empty/whitespace-only does not send, `disabled` while a notice locks it, the hint text renders.
- [ ] **Step 2: FAIL. Step 3: implement.** Copy (EN; VI alongside): `ask.thinking` "Korume is thinking…", `ask.tryAgain` "Try again", `ask.limitFree` "You've asked {limit} questions today · back at {time}" (`limit` from the 402 body), `ask.limitPlus` "This month's AI credits are used up · renews on {date}", `ask.slowDown` "Slow down a little · {seconds}s", `ask.resting` "Korume is resting", `ask.conflict` "That question changed — send it again as a new one", `ask.composerPlaceholder` "Ask Korume about this sentence…", `ask.composerPlaceholderFree` "Ask Korume anything about Japanese…", `ask.hint` "Enter to send · Shift+Enter for a new line", `ask.listen` "Listen", `ask.seen` "Seen {count} times", `ask.seenCapped` "Seen {count}+ times", `ask.signature` "KORUME". Times are formatted on the client from the ISO string (`Intl.DateTimeFormat`), never passed as a function from a server component.
- [ ] **Step 4: PASS. Gates. Commit** — `feat(korume): shared chat core with structured answers`.

---

### Task 9: Viewport A — the Shadowing overlay

**Files:**
- Create: `components/shadowing-workspace/korume-mascot.tsx`, `components/shadowing-workspace/korume-sheet.tsx` (+ tests)
- Modify: `components/shadowing-workspace/workspace-shell.tsx` (mount, Escape), `lib/shadowing-workspace/workspace-view.ts` (+ test: `"close-korume"`), `lib/shadowing-workspace/shortcuts.ts` (+ test: `"ask-korume"` on `k`), `components/shadowing-workspace/use-workspace-shortcuts.ts` (optional `askKorume`), `app/globals.css` (the two tokens), `components/ui/token-scale.test.ts`, `messages/{en,vi}/companion.json` (`ask.sheet.*`)

**Interfaces:**
- Consumes: `useKorumeThread`, `MessageList`, `Composer`, `TurnNotice` (Task 8); `usePreferences()` (workspace context — `bootstrap.preferences` carries `companionEnabled` once Task 3 lands); `useLesson()`, `useCurrentSentence()`, `usePlaybackController()`, `useSession()`; `selectionToSpan` (`lib/shadowing-workspace/selection-offsets.ts`).
- Produces: `escapeAction(state & { korumeOpen: boolean })` order **popover → korume → inspector → drawer → fullscreen → view**; `WorkspaceShortcut` adds `"ask-korume"`.

- [ ] **Step 1: Failing tests.**

```ts
// lib/shadowing-workspace/workspace-view.test.ts (additions)
it("closes the Korume sheet after a popover and before the Inspector", () => {
  const base = { popoverOpen: false, korumeOpen: true, inspectorOpen: true, drawerOpen: true, fullscreen: "none" as const, view: "normal" as const };
  expect(escapeAction({ ...base, popoverOpen: true })).toBe("close-popover");
  expect(escapeAction(base)).toBe("close-korume");
  expect(escapeAction({ ...base, korumeOpen: false })).toBe("close-inspector");
});
// lib/shadowing-workspace/shortcuts.test.ts (additions)
it("maps k to Ask Korume only outside editable targets", () => {
  expect(shortcutFor(key("k"))).toBe("ask-korume");
  expect(shortcutFor(key("k", textarea()))).toBeNull();   // isInteractiveTarget already covers textarea / contenteditable
});
```

Component tests (`korume-mascot.test.tsx`, `korume-sheet.test.tsx`): with `companionEnabled: false` the mascot renders nothing, the `k` shortcut is not registered (a `keydown` `k` does nothing) and **`fetch` is never called**; the mascot is absent in `focus` view and when `fullscreen !== "none"`; opening captures `{ videoId, lineId: activeLine.id, span: null }`, or the span from `selectionToSpan` read on `pointerdown` when a selection exists; after "playback" moves (change `useCurrentSentence`), the chip still shows the captured line and offers "Ask about the current line", which resets to a **new** `draftThreadId` with the new anchor; close then reopen in the same mount → the same `threadId`; a fresh mount → a new draft (no network read); Expand is disabled until `created`, then links `/korume/chat?thread=<id>`.

- [ ] **Step 2: FAIL. Step 3: implement.**
  - Mascot: `CompanionSprite` (`pose="sitting"`, `onActivate`) inside a `button`-free wrapper (the sprite owns activation; check its markup for an accessible name and add `aria-label={t("ask.open")}` "Ask Korume" where the sprite exposes it), absolutely positioned at the bottom-right of the transcript column (`WorkspaceLayout`'s children wrapper gains `relative`).
  - Sheet: `position: fixed; right: 0; top: <header bottom>; bottom: var(--workspace-drawer-height)`; `width: var(--korume-sheet-width); min-width: var(--korume-sheet-min); max-width: 100vw`; `role="dialog" aria-modal="false" aria-labelledby` its heading; focus moves to the composer on open and back to the mascot on close. It never wraps or re-parents `WorkspacePlayer`.
  - `WorkspaceLayout` holds `korumeOpen` in local state; the Escape handler gets `korumeOpen` and the new action closes it. The shell's Escape handler ignores events from `[role='dialog']` — the sheet is a dialog, so the sheet handles its own Escape (close) and the shell's order still holds for events outside it; test both paths.
- [ ] **Step 4: PASS. Gates. Commit** — `feat(korume): anchored Korume sheet in the Shadowing workspace`.

---

### Task 10: Viewport B — `/korume/chat`, the redirect and the persona sweep

**Files:**
- Create: `app/[locale]/(protected)/(app)/korume/chat/page.tsx`, `components/korume/korume-chat-page.tsx`, `components/korume/korume-rail.tsx`, `components/korume/thread-menu.tsx` (+ tests)
- Delete: `app/[locale]/(protected)/(app)/sensei/page.tsx`; `upcoming.sensei` from `messages/{en,vi}/upcoming.json` and its pin in `messages/en/upcoming.pin.test.ts`
- Modify: `next.config.mjs` (+ `next.config.test.ts`), `tests/e2e/route-rename-redirects.spec.ts`, `lib/supabase/route-protection.ts` (drop `/sensei` — a redirect is not a protected page; `route-protection.test.ts`'s filesystem coverage will demand it), `app/[locale]/(protected)/(app)/upcoming-routes.test.tsx`, `components/layout/app-nav.test.tsx`, `components/settings/settings-page.tsx` (+ test: `/korume/chat`), `messages/{en,vi}/pronunciation.json` (`hub.rail.sensei.*` values), the tests pinning those values (`components/shadowing/hub-speaking-rail.test.tsx`, `app/[locale]/(protected)/(app)/pronunciation/page.test.tsx`, `tests/e2e/pronunciation.spec.ts`), `docs/product/{capability-map,ia-proposal,screen-inventory}.md`, `docs/product/domain-model.md`
- Create: `messages/no-sensei.test.ts`

**Interfaces:**
- Consumes: `getThread`, `listThreads` (Task 4), the chat core (Task 8), `GroundedEntity`.
- Produces: the page; `KorumeRail({ anchor, entities, memory })` with `memory: { title: string | null; lineTextJp: string | null; occurredAt: string } | null`; a server helper `smallMemoryFor(userId, entities)` in `lib/data/korume.ts` (read-only `companion_memories`, the newest row whose `line_text_jp` contains an entity label, else null).

- [ ] **Step 1: Failing tests.**
  - `messages/no-sensei.test.ts`: walks every leaf value of every `messages/{en,vi}/*.json` and fails on `/sensei/i`, naming the key path.
  - `next.config.test.ts`: `/:locale(vi|en)/sensei` → `/:locale/korume/chat`, `permanent: false`.
  - `korume-chat-page.test.tsx`: with `?thread` → renders that thread's messages from the server-fetched detail (no client fetch on mount); without → free chat, composer placeholder `ask.composerPlaceholderFree`; header shows "Korume" and a "Korume Memory" link to `/companion` — no text "Sensei", no "Conversation Memory"; `companionEnabled: false` → the disabled state with a Settings link and **no composer**.
  - Back (`korume-chat-page.test.tsx`): `originRoute` present → that href; absent and `document.referrer` same-origin with an in-app history entry → `router.back()`; otherwise → `/dashboard`.
  - `korume-rail.test.tsx`: anchor block; entities from **persisted** grounding with "Seen N" / "Seen N+"; memory block absent when `memory === null`; no strategy sentence.
  - Pronunciation hub copy: EN `hub.rail.sensei.title` "Korume's Recommendation", `empty` "Review a few words and Korume will match a lesson to your level."; VI "Đề xuất từ Korume", "Hãy ôn vài từ để Korume ghép bài học phù hợp với trình độ của bạn." The existing tests that pin the old strings change to the new values (they pin copy, they are not behaviour regressions).
- [ ] **Step 2: FAIL. Step 3: implement.** Page is a server component: `korumeGate`-equivalent read for the disabled state, `getThread(searchParams.thread)` when given (404 → free chat with a quiet "conversation not found" line, never an error page), passes plain DTOs to `KorumeChatPage` (client). Layout per `215:15164`: header row, chat column centred (max width token), rail on the right at ≥1024 px and below the chat under it. The grounding line ("You've already met … in N Shadowing lessons") renders only from an exposure-backed entity of the latest answer.
- [ ] **Step 4: Docs.** In the three product docs replace the `/sensei` route for `215:15164` with `/korume/chat` and add "superseded by `docs/superpowers/specs/2026-10-03-ask-korume-design.md` §0 (single persona Korume)". `domain-model.md`: add Ask Korume thread (kind, anchor ownership, turn), and the two entitlement kinds.
- [ ] **Step 5: PASS. Gates. Commit** — `feat(korume): Korume Chat page, /sensei redirect, single-persona copy`.

---

### Task 11: Browser acceptance, live smoke, whole-branch review

**Files:**
- Create: `tests/e2e/fixtures/korume-data.ts`, `tests/e2e/korume.spec.ts`, `tests/e2e/korume.live-ai.spec.ts` (skipped unless `KORUME_LIVE=1`)

- [ ] **Step 1: Fixture.** `seedKorumeData(admin, { userId, videoId, lineIds })`: one `ask_korume` thread anchored to line 3 with one completed turn (user + `'ai'` message with a valid `AnswerV1` and `grounding_json` containing one `ent:` and one `tok:` entity with `seenCount`), plus a second thread with a `released` reservation and only a user message (for the retryable projection).
- [ ] **Step 2: `korume.spec.ts`** (§7.6), worktree server, `AI_PROVIDER=none`, viewport 1280×529:
  - mascot → sheet → send (stub `POST /turns` → 200 with a canned message) → answer rendered; the video keeps playing (player state from the fake YouTube stub) and the chip keeps line 3 after seeking to line 10; "Ask about the current line" → the next send POSTs a **new** `threadId` with line 10.
  - Expand → `/korume/chat?thread=<id>`; the seeded answer and rail render from persisted grounding; a reload issues **zero** `/api/korume/*` requests (the page is server-rendered — assert with `page.on("request")`); Back → the Shadowing URL with `?line=` of the anchor.
  - The retryable seeded thread shows "Try again" immediately (no 180 s wait).
  - `/en/sensei` and `/vi/sensei` → 307 to `/…/korume/chat` (`request`, `maxRedirects: 0`).
  - No visible text or accessible name matching `/sensei/i` on: workspace with the sheet open, `/korume/chat`, `/settings`, `/pronunciation`.
  - `/companion` renders no composer (`getByRole("textbox")` count 0) and `/korume/chat` links "Korume Memory" → `/companion`.
  - Escape order with the sheet and the drawer Inspector open; `k` in the composer types `k`.
  - Geometry: sheet `getBoundingClientRect().width` is `min(400, 0.4 × 1280) = 400` and ≥ 340; the player iframe element handle is the **same** before and after opening (no remount — compare a `data-mount-id` stamped on mount, or `elementHandle` identity).
  - `companionEnabled` off (PATCH via the settings API) → no mascot, and **zero** `/api/korume/` requests during a 5 s session.
  - Stubbed 402 (both reasons), 429, 503, 502 (+ "Try again" resends the same `turnId` — assert the second request body), 409.
- [ ] **Step 3: Grep gates.** `rg -n "dangerouslySetInnerHTML|marked\(|remark|rehype" components/korume app/api/korume lib/korume` → no hits. `rg -n -i "sensei" messages components app --glob '!**/*.test.*'` → only code identifiers (e.g. `getSenseiRecommendation`), no user-visible copy.
- [ ] **Step 4: Live smoke — ask the owner first.** With `AI_PROVIDER=gemini` in the worktree server and `KORUME_LIVE=1`, on Ep.729 after clearing gate rows: set predetermined progress (complete one fixture video, `last_watched_position` on another); compute the oracle "seen" count for `は` with an independent SQL + tokenizer script written for this test (not `countExposure`); two turns; per turn assert exactly one successful `korume_plan` and one successful `korume_answer` with that `turn_id` and no third row, one `settled` reservation, one charge; the rail's "Seen N" equals the oracle. Then the HTTP double-POST: two concurrent `POST /turns` with one new `turnId` → one assistant message, two generation rows for that turn in total, one reservation (§7.5).
- [ ] **Step 5: Whole-branch review** (`review-changes` / `code-reviewer`) from `git diff master...ask-korume`; fix findings with a mutation each; re-review. Owner Chrome look on a worktree build (§7.8). Merge is the owner's decision.
