# Companion Core (Layer 9b, Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data + logic core of the Companion System — the `companion_memories` table, the `relationship_phase = f(xp)` function, the capture gate that records milestone memories, the Journal read layer, and the gifted-pin API — with none of it depending on the (not-yet-built) L9a i18n / design system or on AI.

**Architecture:** Follows the repo's established **pure / IO split**: pure logic in `lib/companion/*` (phase function, memory classification, dedupe keys), server IO in `lib/data/companion.ts` (reads/writes `companion_memories`, mirrors `lib/data/gamification.ts`). The capture gate hooks into the existing `recordActivity` hot path (`lib/data/gamification.ts`) exactly where `xp_events` is written — best-effort, never throwing into the learning request (spec §6.5 Failure isolation). Discovered memories are written by the service-role client (capture gate); gifted memories are written by the authenticated user through an API route. Immutability and privacy are enforced at the DB level (no UPDATE grant; owner-only RLS).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase Postgres (SQL migrations + RLS), Zod, Vitest + `@/test/supabase-mock`. Everything here is server-side; there is no React in this plan.

## Global Constraints

Copied verbatim from the spec and `CLAUDE.md`; every task inherits these.

- **No media, ever** (`CLAUDE.md` §2.1, spec §4.2): `companion_memories` stores only pointers (`video_id`, `transcript_line_id`, `timestamp_seconds`) + `line_text_jp` (study text). Never a screenshot or audio clip.
- **P3 — reads data, does not own logic** (spec §2): the capture gate observes existing writes; it never scores, awards XP, or mutates learning tables.
- **P4 / capture gate is idempotent** (spec §4.3): a qualifying event records a memory at most once; frequent events (every review/shadow/XP tick) never auto-create a memory.
- **Memory immutability** (spec §4.3): a recorded memory is never mutated at runtime — enforced by granting no UPDATE. Corrections only via migration.
- **Relationship monotonicity** (spec §4.1): `relationship_phase` never decreases; thresholds live in code config and are **never surfaced to the user**.
- **Timeline order** (spec §4.2): the Journal always sorts by `occurred_at`, never `created_at`.
- **Private by design** (spec §12.4): owner-only RLS; no endpoint returns another user's memories.
- **Titles are never AI** (spec §4.4): discovered titles come from a template; gifted titles are the learner's own text or blank.
- **Failure isolation** (spec §6.5): a capture-gate error must never fail the learning request that triggered it — best-effort, log and continue, mirroring `recordActivity`.
- **TypeScript strict, files kebab-case, DB snake_case** (`CLAUDE.md` §6). TDD: failing test first (`CLAUDE.md` §7).
- **Migrations**: enable RLS on every new table and `grant` explicitly (repo gotcha — see `20260712000006_grants.sql`); follow `20260712000008_sentence_mining_cards.sql` as the closest analog.

---

## File Structure

- `supabase/migrations/20260716000015_companion_memories.sql` — **create**: the table, RLS, grants, indexes.
- `lib/companion/types.ts` — **create**: `RelationshipPhase`, `MemoryKind`, `MemoryType`, `CompanionMemory`.
- `lib/companion/phase.ts` — **create**: pure `relationshipPhaseForXp(xp)` + hidden `PHASE_THRESHOLDS`.
- `lib/companion/phase.test.ts` — **create**: phase-function + monotonicity tests.
- `lib/companion/dedupe.ts` — **create**: pure `dedupeKeyFor(...)` + `titleFor(...)` (template titles).
- `lib/companion/dedupe.test.ts` — **create**.
- `lib/companion/index.ts` — **create**: barrel re-export (mirrors `lib/gamification/index.ts`).
- `lib/data/companion.ts` — **create**: `recordDiscoveredMemory`, `listJournal`, `getAnchorMemories`, `captureCompanionMemories`, `pinMemory`, `getJournal`.
- `lib/data/companion.test.ts` — **create**: IO/integration tests via `@/test/supabase-mock`.
- `lib/data/gamification.ts` — **modify**: call `captureCompanionMemories(...)` best-effort inside `recordActivityInner`.
- `app/api/companion/journal/route.ts` — **create**: `GET` the learner's Journal.
- `app/api/companion/memories/route.ts` — **create**: `POST` a gifted pin.
- `lib/validation/companion.ts` — **create**: Zod schema for the gifted-pin body.
- `lib/validation/companion.test.ts` — **create**.

---

## Task 1: Migration — `companion_memories` table

**Files:**
- Create: `supabase/migrations/20260716000015_companion_memories.sql`

**Interfaces:**
- Produces: table `companion_memories` with columns `id, user_id, kind, memory_type, title, video_id, transcript_line_id, timestamp_seconds, line_text_jp, note, is_anchor, dedupe_key, occurred_at, created_at`; unique `(user_id, dedupe_key)`; RLS owner-only; **no UPDATE grant**.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260716000015_companion_memories.sql`:

```sql
-- Companion memories / Journal (docs/superpowers/specs/2026-07-16-companion-system-design.md §4).
-- Compliant by design: NO media (CLAUDE.md §2.1) — only pointers into the
-- existing transcript_line + the line's own text. Same no-media posture as
-- sentence_mining_cards (20260712000008). Immutability (§4.3) is enforced by
-- granting no UPDATE; privacy (§12.4) by owner-only RLS. Discovered memories
-- are written by the service role (the capture gate); gifted memories are
-- written by the authenticated learner (an explicit pin).

create table companion_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('discovered', 'gifted')),
  memory_type text not null check (memory_type in (
    'first_shadow', 'line_mastered', 'mining_saved', 'first_video_completed',
    'jlpt_passed', 'companion_grew', 'pinned_line'
  )),
  title text,
  -- Pointer to the moment (NO media): replay = seek the YouTube IFrame to
  -- timestamp_seconds; line_text_jp is study text, not a scene image.
  video_id uuid references videos (id) on delete set null,
  transcript_line_id uuid references transcript_lines (id) on delete set null,
  timestamp_seconds numeric(10, 3),
  line_text_jp text,
  note text,                       -- learner's own words (gifted only)
  is_anchor boolean not null default false,
  -- Natural idempotency key (§4.3): a qualifying event records at most once.
  -- e.g. 'first_shadow', 'companion_grew:2', 'line_mastered:<lineId>',
  -- 'mining_saved:<cardId>', 'jlpt_passed:N4', 'pinned_line:<lineId>'.
  dedupe_key text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- Journal timeline query (§4.2: always ordered by occurred_at).
create index companion_memories_timeline_idx
  on companion_memories (user_id, occurred_at desc);
-- Anchor lookup for bounded reflection (§6.4) — partial index, anchors are few.
create index companion_memories_anchor_idx
  on companion_memories (user_id) where is_anchor;

alter table companion_memories enable row level security;

-- Owner reads own Journal (§12.4 private by design).
create policy companion_memories_select_own on companion_memories
  for select to authenticated using (user_id = auth.uid());

-- Learner may insert ONLY their own GIFTED memories (a pin). Discovered
-- memories are the capture gate's job and come through the service role, so a
-- learner can never forge one.
create policy companion_memories_insert_gifted on companion_memories
  for insert to authenticated with check (user_id = auth.uid() and kind = 'gifted');

-- Owner may remove their own memory (un-pin / retract). No UPDATE policy or
-- grant exists anywhere: recorded memories are immutable at runtime (§4.3).
create policy companion_memories_delete_own on companion_memories
  for delete to authenticated using (user_id = auth.uid());

-- Explicit grants (see 20260712000006_grants.sql header for the 42501 gotcha
-- this guards against). Deliberately NO `update` grant → immutability.
grant select, insert, delete on companion_memories to authenticated;
grant all on companion_memories to service_role;
```

- [ ] **Step 2: Apply the migration to the local DB**

Run: `npx supabase db reset`
Expected: all migrations re-apply with no error; the output lists `20260716000015_companion_memories.sql` applying.

- [ ] **Step 3: Verify the table and the no-UPDATE guarantee**

Run:
```bash
npx supabase db reset >/dev/null 2>&1 && \
psql "$DATABASE_URL" -c "\d companion_memories" && \
psql "$DATABASE_URL" -c "select grantee, privilege_type from information_schema.role_table_grants where table_name='companion_memories' and grantee='authenticated' order by privilege_type;"
```
Expected: the `\d` output shows the columns, the `unique (user_id, dedupe_key)` constraint, and both indexes; the grants list for `authenticated` shows **DELETE, INSERT, SELECT** and **no UPDATE**.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716000015_companion_memories.sql
git commit -m "feat(companion): companion_memories table (migration)"
```

---

## Task 2: Pure `relationshipPhaseForXp` + types

**Files:**
- Create: `lib/companion/types.ts`
- Create: `lib/companion/phase.ts`
- Test: `lib/companion/phase.test.ts`

**Interfaces:**
- Produces: `type RelationshipPhase = 1 | 2 | 3 | 4`; `relationshipPhaseForXp(xp: number): RelationshipPhase` (monotonic non-decreasing); `PHASE_THRESHOLDS: readonly number[]`.

- [ ] **Step 1: Write the types**

Create `lib/companion/types.ts`:

```ts
/** Chapters of the relationship (spec §4.1). Never called "stage" — that
 * imports a game/levelling mindset P12 rejects. Names are working names;
 * the visible name/look is Character Identity (Spec 2). */
export type RelationshipPhase = 1 | 2 | 3 | 4;

export type MemoryKind = "discovered" | "gifted";

export type MemoryType =
  | "first_shadow"
  | "line_mastered"
  | "mining_saved"
  | "first_video_completed"
  | "jlpt_passed"
  | "companion_grew"
  | "pinned_line";

export interface CompanionMemory {
  id: string;
  kind: MemoryKind;
  memoryType: MemoryType;
  title: string | null;
  videoId: string | null;
  transcriptLineId: string | null;
  timestampSeconds: number | null;
  lineTextJp: string | null;
  note: string | null;
  isAnchor: boolean;
  occurredAt: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/companion/phase.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PHASE_THRESHOLDS, relationshipPhaseForXp } from "./phase";

describe("relationshipPhaseForXp", () => {
  it("starts at phase 1 at zero XP", () => {
    expect(relationshipPhaseForXp(0)).toBe(1);
  });

  it("returns each phase at its threshold boundary", () => {
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[1] - 1)).toBe(1);
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[1])).toBe(2);
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[2])).toBe(3);
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[3])).toBe(4);
  });

  it("never decreases as XP increases (monotonicity, §4.1)", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1_000_000 }), fc.nat({ max: 1_000_000 }), (a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return relationshipPhaseForXp(lo) <= relationshipPhaseForXp(hi);
      }),
    );
  });

  it("clamps negative XP to phase 1", () => {
    expect(relationshipPhaseForXp(-5)).toBe(1);
  });
});
```

> If `fast-check` is not already a devDependency, install it: `npm i -D fast-check`. (Check first: `node -e "require('fast-check')"` — no error means it's present.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- lib/companion/phase.test.ts`
Expected: FAIL — `Cannot find module './phase'`.

- [ ] **Step 4: Write the implementation**

Create `lib/companion/phase.ts`:

```ts
import type { RelationshipPhase } from "./types";

/** XP thresholds for each relationship phase (spec §4.1). Hidden tuning
 * constants — NEVER surfaced to the user. Index i is the minimum XP for
 * phase (i + 1). Must be strictly increasing so the function is monotonic. */
export const PHASE_THRESHOLDS = [0, 500, 2500, 10000] as const;

/** Pure, deterministic map from lifetime XP to relationship phase. Monotonic
 * non-decreasing by construction (thresholds increase, XP never decreases). */
export function relationshipPhaseForXp(xp: number): RelationshipPhase {
  let phase: RelationshipPhase = 1;
  for (let i = PHASE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= PHASE_THRESHOLDS[i]) {
      phase = (i + 1) as RelationshipPhase;
      break;
    }
  }
  return phase;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/companion/phase.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/companion/types.ts lib/companion/phase.ts lib/companion/phase.test.ts
git commit -m "feat(companion): relationshipPhaseForXp phase function"
```

---

## Task 3: Pure dedupe keys + template titles

**Files:**
- Create: `lib/companion/dedupe.ts`
- Test: `lib/companion/dedupe.test.ts`
- Create: `lib/companion/index.ts`

**Interfaces:**
- Consumes: `MemoryType`, `RelationshipPhase` from `./types`.
- Produces:
  - `dedupeKeyFor(type: MemoryType, ref?: { lineId?: string; cardId?: string; videoId?: string; jlptLevel?: string; phase?: RelationshipPhase }): string`
  - `titleFor(type: MemoryType, ref?: { jlptLevel?: string; phase?: RelationshipPhase }): string | null`

- [ ] **Step 1: Write the failing test**

Create `lib/companion/dedupe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dedupeKeyFor, titleFor } from "./dedupe";

describe("dedupeKeyFor", () => {
  it("is constant for once-in-a-lifetime types", () => {
    expect(dedupeKeyFor("first_shadow")).toBe("first_shadow");
  });
  it("scopes companion_grew per target phase", () => {
    expect(dedupeKeyFor("companion_grew", { phase: 2 })).toBe("companion_grew:2");
    expect(dedupeKeyFor("companion_grew", { phase: 3 })).toBe("companion_grew:3");
  });
  it("scopes line/card/video/jlpt types by their ref", () => {
    expect(dedupeKeyFor("line_mastered", { lineId: "L1" })).toBe("line_mastered:L1");
    expect(dedupeKeyFor("mining_saved", { cardId: "C1" })).toBe("mining_saved:C1");
    expect(dedupeKeyFor("first_video_completed", { videoId: "V1" })).toBe("first_video_completed:V1");
    expect(dedupeKeyFor("jlpt_passed", { jlptLevel: "N4" })).toBe("jlpt_passed:N4");
    expect(dedupeKeyFor("pinned_line", { lineId: "L9" })).toBe("pinned_line:L9");
  });
  it("throws when a required ref is missing", () => {
    expect(() => dedupeKeyFor("line_mastered")).toThrow();
  });
});

describe("titleFor", () => {
  it("returns a non-AI template string for discovered types", () => {
    expect(titleFor("first_shadow")).toBeTruthy();
    expect(titleFor("companion_grew", { phase: 2 })).toContain("2");
  });
  it("returns null for gifted pins (learner supplies their own)", () => {
    expect(titleFor("pinned_line")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/companion/dedupe.test.ts`
Expected: FAIL — `Cannot find module './dedupe'`.

- [ ] **Step 3: Write the implementation**

Create `lib/companion/dedupe.ts`:

```ts
import type { MemoryType, RelationshipPhase } from "./types";

export interface MemoryRef {
  lineId?: string;
  cardId?: string;
  videoId?: string;
  jlptLevel?: string;
  phase?: RelationshipPhase;
}

function need<T>(value: T | undefined, type: MemoryType, field: string): T {
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`dedupeKeyFor(${type}): missing required ref "${field}"`);
  }
  return value;
}

/** Natural idempotency key for `companion_memories.dedupe_key` (§4.3). */
export function dedupeKeyFor(type: MemoryType, ref: MemoryRef = {}): string {
  switch (type) {
    case "first_shadow":
      return "first_shadow";
    case "companion_grew":
      return `companion_grew:${need(ref.phase, type, "phase")}`;
    case "line_mastered":
      return `line_mastered:${need(ref.lineId, type, "lineId")}`;
    case "mining_saved":
      return `mining_saved:${need(ref.cardId, type, "cardId")}`;
    case "first_video_completed":
      return `first_video_completed:${need(ref.videoId, type, "videoId")}`;
    case "jlpt_passed":
      return `jlpt_passed:${need(ref.jlptLevel, type, "jlptLevel")}`;
    case "pinned_line":
      return `pinned_line:${need(ref.lineId, type, "lineId")}`;
  }
}

/** Template title (spec §4.4) — NEVER AI-generated. Gifted pins return null;
 * the learner supplies their own title. Copy is intentionally VN-first but
 * these strings move to the i18n layer in Plan 3 (L9a) — keep them here for
 * now so Plan 1 has no L9a dependency. */
export function titleFor(type: MemoryType, ref: MemoryRef = {}): string | null {
  switch (type) {
    case "first_shadow":
      return "Câu thoại đầu tiên bạn shadowing thành công.";
    case "line_mastered":
      return "Câu bạn luyện mãi rồi cuối cùng cũng nói được.";
    case "mining_saved":
      return "Câu bạn quyết định lưu lại.";
    case "first_video_completed":
      return "Video đầu tiên bạn hoàn thành.";
    case "jlpt_passed":
      return `Cột mốc JLPT ${ref.jlptLevel ?? ""}`.trim();
    case "companion_grew":
      return `Ngày người bạn đồng hành của bạn bước sang giai đoạn ${ref.phase ?? ""}`.trim();
    case "pinned_line":
      return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/companion/dedupe.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the barrel and verify typecheck**

Create `lib/companion/index.ts`:

```ts
export * from "./types";
export * from "./phase";
export * from "./dedupe";
```

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add lib/companion/dedupe.ts lib/companion/dedupe.test.ts lib/companion/index.ts
git commit -m "feat(companion): dedupe keys + template titles"
```

---

## Task 4: Journal IO layer — insert + read

**Files:**
- Create: `lib/data/companion.ts`
- Test: `lib/data/companion.test.ts`

**Interfaces:**
- Consumes: `dedupeKeyFor`, `titleFor` from `@/lib/companion`; `createServiceClient` from `@/lib/supabase/service`; `@/test/supabase-mock` in tests.
- Produces:
  - `recordDiscoveredMemory(supabase, input: DiscoveredMemoryInput): Promise<boolean>` — inserts-or-ignores on `dedupe_key`, returns `true` iff a row was newly created.
  - `listJournal(supabase, userId: string): Promise<CompanionMemory[]>` — ordered by `occurred_at desc`.
  - `getAnchorMemories(supabase, userId: string): Promise<CompanionMemory[]>`.
  - `interface DiscoveredMemoryInput { userId; memoryType; ref?; isAnchor?; videoId?; transcriptLineId?; timestampSeconds?; lineTextJp?; occurredAt? }`

- [ ] **Step 1: Write the failing test**

Create `lib/data/companion.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { getAnchorMemories, listJournal, recordDiscoveredMemory } from "./companion";

const USER_ID = "u1";

function hasOp(calls: QueryCall[], op: QueryCall["op"]) {
  return calls.some((c) => c.op === op);
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
});

describe("recordDiscoveredMemory", () => {
  it("returns true when a new row is inserted", async () => {
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) =>
          hasOp(calls, "upsert") ? { data: { id: "m1" }, error: null } : { data: [], error: null },
      },
    });
    const created = await recordDiscoveredMemory(supabase as never, {
      userId: USER_ID,
      memoryType: "first_shadow",
      transcriptLineId: "L1",
      lineTextJp: "逃げろ",
      isAnchor: true,
    });
    expect(created).toBe(true);
  });

  it("returns false when the dedupe key already exists", async () => {
    const supabase = createMockSupabase({
      tables: { companion_memories: () => ({ data: null, error: null }) },
    });
    const created = await recordDiscoveredMemory(supabase as never, {
      userId: USER_ID,
      memoryType: "first_shadow",
    });
    expect(created).toBe(false);
  });
});

describe("listJournal", () => {
  it("maps rows to CompanionMemory and is ordered by occurred_at", async () => {
    let orderCall: QueryCall | undefined;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          orderCall = calls.find((c) => c.op === "order");
          return {
            data: [
              {
                id: "m1",
                kind: "discovered",
                memory_type: "first_shadow",
                title: "t",
                video_id: null,
                transcript_line_id: "L1",
                timestamp_seconds: null,
                line_text_jp: "逃げろ",
                note: null,
                is_anchor: true,
                occurred_at: "2026-07-16T00:00:00Z",
              },
            ],
            error: null,
          };
        },
      },
    });
    const journal = await listJournal(supabase as never, USER_ID);
    expect(journal[0]).toMatchObject({ id: "m1", memoryType: "first_shadow", isAnchor: true });
    expect(orderCall).toMatchObject({ column: "occurred_at", ascending: false });
  });
});

describe("getAnchorMemories", () => {
  it("filters to anchors only", async () => {
    let filtered = false;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          filtered = calls.some((c) => c.op === "eq" && c.column === "is_anchor" && c.value === true);
          return { data: [], error: null };
        },
      },
    });
    await getAnchorMemories(supabase as never, USER_ID);
    expect(filtered).toBe(true);
  });
});
```

> `QueryCall` (in `test/supabase-mock.ts`) is a discriminated union with **named** fields per op — `eq` has `{ column, value }`, `order` has `{ column, ascending }`, `upsert` has `{ values, options }`. There is no `.args`. The assertions above already use these names; keep them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/data/companion.test.ts`
Expected: FAIL — `Cannot find module './companion'`.

- [ ] **Step 3: Write the implementation**

Create `lib/data/companion.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeKeyFor, titleFor, type CompanionMemory, type MemoryType } from "@/lib/companion";
import type { MemoryRef } from "@/lib/companion/dedupe";

export interface DiscoveredMemoryInput {
  userId: string;
  memoryType: MemoryType;
  ref?: MemoryRef;
  isAnchor?: boolean;
  videoId?: string | null;
  transcriptLineId?: string | null;
  timestampSeconds?: number | null;
  lineTextJp?: string | null;
  occurredAt?: string;
}

interface MemoryRow {
  id: string;
  kind: CompanionMemory["kind"];
  memory_type: MemoryType;
  title: string | null;
  video_id: string | null;
  transcript_line_id: string | null;
  timestamp_seconds: number | null;
  line_text_jp: string | null;
  note: string | null;
  is_anchor: boolean;
  occurred_at: string;
}

function toMemory(row: MemoryRow): CompanionMemory {
  return {
    id: row.id,
    kind: row.kind,
    memoryType: row.memory_type,
    title: row.title,
    videoId: row.video_id,
    transcriptLineId: row.transcript_line_id,
    timestampSeconds: row.timestamp_seconds,
    lineTextJp: row.line_text_jp,
    note: row.note,
    isAnchor: row.is_anchor,
    occurredAt: row.occurred_at,
  };
}

/** Insert-or-ignore a DISCOVERED memory on its natural dedupe key (§4.3). Returns
 * true iff a row was newly created — same idempotency pattern as xp_events. The
 * caller passes a SERVICE-ROLE client (the capture gate); a learner can never
 * forge a discovered memory (RLS insert policy is gifted-only). */
export async function recordDiscoveredMemory(
  supabase: SupabaseClient,
  input: DiscoveredMemoryInput,
): Promise<boolean> {
  const dedupeKey = dedupeKeyFor(input.memoryType, input.ref);
  const { data, error } = await supabase
    .from("companion_memories")
    .upsert(
      {
        user_id: input.userId,
        kind: "discovered",
        memory_type: input.memoryType,
        title: titleFor(input.memoryType, input.ref),
        video_id: input.videoId ?? null,
        transcript_line_id: input.transcriptLineId ?? null,
        timestamp_seconds: input.timestampSeconds ?? null,
        line_text_jp: input.lineTextJp ?? null,
        is_anchor: input.isAnchor ?? false,
        dedupe_key: dedupeKey,
        ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
      },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

const MEMORY_COLUMNS =
  "id, kind, memory_type, title, video_id, transcript_line_id, timestamp_seconds, line_text_jp, note, is_anchor, occurred_at";

/** The learner's Journal, newest moment first. ALWAYS ordered by occurred_at,
 * never created_at (§4.2). Pass an owner-scoped client so RLS returns only the
 * learner's rows (§12.4). */
export async function listJournal(supabase: SupabaseClient, userId: string): Promise<CompanionMemory[]> {
  const { data, error } = await supabase
    .from("companion_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MemoryRow[]).map(toMemory);
}

/** The Companion's own anchor memories (§6.4) — the bounded set reflection reads. */
export async function getAnchorMemories(supabase: SupabaseClient, userId: string): Promise<CompanionMemory[]> {
  const { data, error } = await supabase
    .from("companion_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", userId)
    .eq("is_anchor", true)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MemoryRow[]).map(toMemory);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/data/companion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/companion.ts lib/data/companion.test.ts
git commit -m "feat(companion): journal IO layer (insert-or-ignore + read)"
```

---

## Task 5: Capture gate — `captureCompanionMemories` + wire into `recordActivity`

**Files:**
- Modify: `lib/data/companion.ts` (add `captureCompanionMemories`)
- Modify: `lib/data/gamification.ts:130-163` (call it best-effort after the stats update)
- Test: `lib/data/companion.test.ts` (add capture cases)

**Interfaces:**
- Consumes: `relationshipPhaseForXp` from `@/lib/companion`; `recordDiscoveredMemory` from Task 4.
- Produces: `captureCompanionMemories(supabase, input: CaptureInput): Promise<void>` where `interface CaptureInput { userId; source; parts; prevXp; nextXp; now? }`. `source` is `LearningOutcomeSource`, `parts` is `SourceIdParts` (both from `@/lib/gamification`). Never throws.

- [ ] **Step 1: Write the failing test (companion_grew on a phase crossing)**

Add to `lib/data/companion.test.ts`:

```ts
import { captureCompanionMemories } from "./companion";
import { PHASE_THRESHOLDS } from "@/lib/companion";

describe("captureCompanionMemories", () => {
  it("records companion_grew as an anchor when XP crosses a phase threshold", async () => {
    let inserted: Record<string, unknown> | undefined;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          const upsert = calls.find((c) => c.op === "upsert");
          if (upsert) {
            inserted = upsert.values as Record<string, unknown>;
            return { data: { id: "m1" }, error: null };
          }
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      prevXp: PHASE_THRESHOLDS[1] - 10,
      nextXp: PHASE_THRESHOLDS[1] + 10, // crosses into phase 2
    });
    expect(inserted).toMatchObject({
      memory_type: "companion_grew",
      dedupe_key: "companion_grew:2",
      is_anchor: true,
      kind: "discovered",
    });
  });

  it("records nothing when XP stays inside the same phase", async () => {
    let touched = false;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          if (calls.some((c) => c.op === "upsert")) touched = true;
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      prevXp: 10,
      nextXp: 20,
    });
    expect(touched).toBe(false);
  });

  it("never throws — a DB error is swallowed (failure isolation §6.5)", async () => {
    const supabase = createMockSupabase({
      tables: { companion_memories: () => ({ data: null, error: { message: "boom" } }) },
    });
    await expect(
      captureCompanionMemories(supabase as never, {
        userId: USER_ID,
        source: "srs_review",
        parts: {},
        prevXp: PHASE_THRESHOLDS[1] - 1,
        nextXp: PHASE_THRESHOLDS[1] + 1,
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/data/companion.test.ts`
Expected: FAIL — `captureCompanionMemories is not a function`.

- [ ] **Step 3: Implement `captureCompanionMemories`**

Add to `lib/data/companion.ts`:

```ts
import { relationshipPhaseForXp } from "@/lib/companion";
import type { LearningOutcomeSource, SourceIdParts } from "@/lib/gamification";

export interface CaptureInput {
  userId: string;
  source: LearningOutcomeSource;
  parts: SourceIdParts;
  prevXp: number;
  nextXp: number;
  now?: Date;
}

/** The capture gate (spec §4.3). Observes a completed learning outcome and
 * records any milestone memory it produces. MUST NEVER throw into the caller —
 * it runs on the learning hot path and a memory hiccup must never fail study
 * (§6.5). Best-effort, mirroring recordActivity. This task wires the
 * self-contained `companion_grew` producer (needs only prevXp/nextXp);
 * source-specific producers are added in Task 8. */
export async function captureCompanionMemories(supabase: SupabaseClient, input: CaptureInput): Promise<void> {
  try {
    const prevPhase = relationshipPhaseForXp(input.prevXp);
    const nextPhase = relationshipPhaseForXp(input.nextXp);
    if (nextPhase > prevPhase) {
      // Record one anchor memory per phase actually crossed (a big single
      // award could cross more than one). Idempotent on dedupe_key.
      for (let phase = prevPhase + 1; phase <= nextPhase; phase++) {
        await recordDiscoveredMemory(supabase, {
          userId: input.userId,
          memoryType: "companion_grew",
          ref: { phase: phase as 1 | 2 | 3 | 4 },
          isAnchor: true,
        });
      }
    }
  } catch (err) {
    console.error("[companion] captureCompanionMemories failed:", err);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/data/companion.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the gate into `recordActivity`**

In `lib/data/gamification.ts`, inside `recordActivityInner`, immediately after the `user_stats` upsert error check (the block ending at `if (statsUpdateError) throw statsUpdateError;`, around line 140) and before the `if (leveledUp)` block, add:

```ts
  // Companion capture gate (spec §4.3) — best-effort, never throws (§6.5).
  await captureCompanionMemories(supabase, {
    userId: input.userId,
    source: input.source,
    parts,
    prevXp,
    nextXp,
    now,
  });
```

Add the import at the top of `lib/data/gamification.ts` (near the other `@/lib/data` import on line 16):

```ts
import { captureCompanionMemories } from "@/lib/data/companion";
```

- [ ] **Step 6: Run the gamification tests to confirm no regression**

Run: `npm test -- lib/data/gamification.test.ts`
Expected: PASS. If a test now sees an unexpected `companion_memories` query, its `createMockSupabase` `tables` map needs a `companion_memories: () => ({ data: [], error: null })` entry — add it; the capture call is best-effort so this keeps existing behavior identical.

- [ ] **Step 7: Commit**

```bash
git add lib/data/companion.ts lib/data/companion.test.ts lib/data/gamification.ts
git commit -m "feat(companion): capture gate — companion_grew wired into recordActivity"
```

---

## Task 6: Gifted-pin validation + API routes

**Files:**
- Create: `lib/validation/companion.ts`
- Test: `lib/validation/companion.test.ts`
- Create: `app/api/companion/memories/route.ts`
- Create: `app/api/companion/journal/route.ts`

**Interfaces:**
- Consumes: `listJournal` from `@/lib/data/companion`; `createClient` from `@/lib/supabase/server`; `requireUser` from `@/lib/data/videos`; `rateLimit(key, { limit, windowMs }, nowMs)` from `@/lib/rate-limit`; `dedupeKeyFor` from `@/lib/companion`.
- Produces:
  - data layer: `pinMemory(input: PinMemoryInput, now?: Date): Promise<PinMemoryResult>` and `getJournal(): Promise<GetJournalResult>` — both own auth + rate-limit and return result objects, exactly like `lib/data/mining.ts`.
  - routes: `POST /api/companion/memories`, `GET /api/companion/journal` — thin, map the result to `NextResponse`.
  - `pinMemorySchema` in `lib/validation/companion.ts`.

- [ ] **Step 1: Confirm the repo's route + data-layer convention**

Read `lib/data/mining.ts` (the closest analog) and `app/api/mining/route.ts`:

Run: `sed -n '1,120p' lib/data/mining.ts && echo '--- route ---' && sed -n '1,60p' app/api/mining/route.ts`
Confirm the pattern the tasks below follow: **auth + rate-limit + DB work live in `lib/data/*` and return `{ ok, status, ... }`**; the route is thin and only maps that result to `NextResponse`. Auth is `requireUser(supabase)` (from `@/lib/data/videos`), rate-limit is `rateLimit(key, { limit, windowMs }, now.getTime())` returning `{ ok, retryAfter }`.

- [ ] **Step 2: Write the failing validation test**

Create `lib/validation/companion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pinMemorySchema } from "./companion";

describe("pinMemorySchema", () => {
  it("accepts a valid pin", () => {
    const r = pinMemorySchema.safeParse({
      transcriptLineId: "11111111-1111-1111-1111-111111111111",
      videoId: "22222222-2222-2222-2222-222222222222",
      lineTextJp: "逃げろ",
      timestampSeconds: 12.5,
      note: "This gave me chills",
    });
    expect(r.success).toBe(true);
  });
  it("requires transcriptLineId", () => {
    expect(pinMemorySchema.safeParse({ lineTextJp: "x" }).success).toBe(false);
  });
  it("rejects a note longer than 500 chars (anti-abuse)", () => {
    const r = pinMemorySchema.safeParse({
      transcriptLineId: "11111111-1111-1111-1111-111111111111",
      note: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- lib/validation/companion.test.ts`
Expected: FAIL — `Cannot find module './companion'`.

- [ ] **Step 4: Write the schema**

Create `lib/validation/companion.ts`:

```ts
import { z } from "zod";

/** Body for POST /api/companion/memories — pinning a transcript line as a
 * GIFTED memory (spec §4.3). Only pointers + the line's own text + the
 * learner's note; NO media (§2.1). */
export const pinMemorySchema = z.object({
  transcriptLineId: z.string().uuid(),
  videoId: z.string().uuid().optional(),
  lineTextJp: z.string().max(1000).optional(),
  timestampSeconds: z.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
});

export type PinMemoryInput = z.infer<typeof pinMemorySchema>;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- lib/validation/companion.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the `pinMemory` + `getJournal` data-layer wrappers**

Append to `lib/data/companion.ts` (mirrors `createMiningCard` / `listMiningCards` in `lib/data/mining.ts`):

```ts
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/data/videos";
import { dedupeKeyFor } from "@/lib/companion";
import type { PinMemoryInput } from "@/lib/validation/companion";

const PIN_LIMIT = { limit: 60, windowMs: 60_000 };

export type PinMemoryResult =
  | { ok: true }
  | { ok: false; status: 401 | 500 }
  | { ok: false; status: 429; retryAfter: number };

export type GetJournalResult = { ok: true; data: CompanionMemory[] } | { ok: false; status: 401 };

/** Pin a transcript line as a GIFTED memory. Goes through the USER's client so
 * RLS enforces ownership and kind='gifted' (a learner can only ever create
 * their own gifted memories). A duplicate pin (unique violation) is a no-op
 * success, not an error. */
export async function pinMemory(input: PinMemoryInput, now: Date = new Date()): Promise<PinMemoryResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`companion:pin:${user.id}`, PIN_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { error } = await supabase.from("companion_memories").insert({
    user_id: user.id,
    kind: "gifted",
    memory_type: "pinned_line",
    title: null, // learner-supplied or blank (§4.4) — never AI
    video_id: input.videoId ?? null,
    transcript_line_id: input.transcriptLineId,
    timestamp_seconds: input.timestampSeconds ?? null,
    line_text_jp: input.lineTextJp ?? null,
    note: input.note ?? null,
    dedupe_key: dedupeKeyFor("pinned_line", { lineId: input.transcriptLineId }),
  });
  if (error && error.code !== "23505") return { ok: false, status: 500 };
  return { ok: true };
}

/** The authed learner's Journal (owner-scoped, RLS → only their rows, §12.4). */
export async function getJournal(): Promise<GetJournalResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const data = await listJournal(supabase, user.id);
  return { ok: true, data };
}
```

> `requireUser`'s exact return type (user object vs `{ user }`) is whatever `lib/data/mining.ts` uses — you confirmed it in Step 1; call it the same way. `rateLimit`'s real signature is `rateLimit(key, { limit, windowMs }, nowMs)` returning `{ ok, retryAfter }` — confirmed in Task 6 Step 1.

- [ ] **Step 7: Write the two thin routes**

Create `app/api/companion/memories/route.ts`:

```ts
import { NextResponse } from "next/server";
import { pinMemory } from "@/lib/data/companion";
import { pinMemorySchema } from "@/lib/validation/companion";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = pinMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pin", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const result = await pinMemory(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many pins, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : "Could not pin";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

Create `app/api/companion/journal/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getJournal } from "@/lib/data/companion";

export async function GET() {
  const result = await getJournal();
  if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
```

- [ ] **Step 8: Verify typecheck, lint, and the full suite**

Run: `npm run typecheck && npm run lint && npm test -- lib/companion lib/data/companion.test.ts lib/validation/companion.test.ts`
Expected: typecheck clean, lint clean, all listed tests PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/validation/companion.ts lib/validation/companion.test.ts app/api/companion
git commit -m "feat(companion): gifted-pin + journal API routes"
```

---

## Task 7: Remaining discovered producers (first_shadow, mining_saved, line_mastered, jlpt_passed, first_video_completed)

**Files:**
- Modify: `lib/data/companion.ts` (extend `captureCompanionMemories`)
- Test: `lib/data/companion.test.ts`

**Interfaces:**
- Consumes: existing tables `shadowing_sessions (video_id, transcript_line_id)`, `transcript_lines (text_jp, start_time, transcript_id)`, `transcripts (video_id)`, `sentence_mining_cards (transcript_line_id, sentence_jp, start_time, video_id)`, `videos`, `user_test_attempts`, `jlpt_tests (level)`. The `parts` passed to the gate carries `lineId` for `shadowing`, `cardId` for `mining_review`, `testId` for `jlpt_submit` (see `lib/gamification/source-id.ts`).
- Produces: `captureCompanionMemories` additionally records `first_shadow`, `mining_saved`, `line_mastered`, `jlpt_passed`, `first_video_completed` — each idempotent, each an anchor where it is a relationship milestone.

- [ ] **Step 1: Write the failing test for first_shadow**

Add to `lib/data/companion.test.ts` a case: `source: "shadowing"`, `parts: { lineId: "L1" }`, mock `transcript_lines` to return `{ text_jp: "逃げろ", start_time: 3.2, transcript_id: "T1" }` and `transcripts` to return `{ video_id: "V1" }`; assert a `companion_memories` upsert fires with `memory_type: "first_shadow"`, `dedupe_key: "first_shadow"`, `is_anchor: true`, `transcript_line_id: "L1"`, `line_text_jp: "逃げろ"`.

```ts
it("records first_shadow with the line pointer on a shadowing outcome", async () => {
  let inserted: Record<string, unknown> | undefined;
  const supabase = createMockSupabase({
    tables: {
      transcript_lines: () => ({ data: { text_jp: "逃げろ", start_time: 3.2, transcript_id: "T1" }, error: null }),
      transcripts: () => ({ data: { video_id: "V1" }, error: null }),
      companion_memories: (calls) => {
        const upsert = calls.find((c) => c.op === "upsert");
        if (upsert) {
          inserted = upsert.values as Record<string, unknown>;
          return { data: { id: "m1" }, error: null };
        }
        return { data: [], error: null };
      },
    },
  });
  await captureCompanionMemories(supabase as never, {
    userId: USER_ID,
    source: "shadowing",
    parts: { lineId: "L1" },
    prevXp: 10,
    nextXp: 20,
  });
  expect(inserted).toMatchObject({
    memory_type: "first_shadow",
    dedupe_key: "first_shadow",
    is_anchor: true,
    transcript_line_id: "L1",
    line_text_jp: "逃げろ",
    video_id: "V1",
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/data/companion.test.ts`
Expected: FAIL — no `first_shadow` upsert (only the phase check runs).

- [ ] **Step 3: Extend `captureCompanionMemories` with the source producers**

Add a private helper `resolveLinePointer(supabase, lineId)` that reads `transcript_lines` then `transcripts` to return `{ videoId, lineTextJp, timestampSeconds }`, and extend the function body (after the `companion_grew` block) with per-source producers. Full code:

```ts
async function resolveLinePointer(
  supabase: SupabaseClient,
  lineId: string,
): Promise<{ videoId: string | null; lineTextJp: string | null; timestampSeconds: number | null }> {
  const { data: line } = await supabase
    .from("transcript_lines")
    .select("text_jp, start_time, transcript_id")
    .eq("id", lineId)
    .maybeSingle();
  const row = line as { text_jp: string | null; start_time: number | null; transcript_id: string | null } | null;
  let videoId: string | null = null;
  if (row?.transcript_id) {
    const { data: t } = await supabase.from("transcripts").select("video_id").eq("id", row.transcript_id).maybeSingle();
    videoId = (t as { video_id: string | null } | null)?.video_id ?? null;
  }
  return { videoId, lineTextJp: row?.text_jp ?? null, timestampSeconds: row?.start_time ?? null };
}
```

Inside `captureCompanionMemories`, after the `companion_grew` loop and still inside the `try`, add:

```ts
    // Source-specific milestone producers. Each is idempotent on its dedupe
    // key; the first time it fires becomes a memory, repeats are no-ops.
    if (input.source === "shadowing" && input.parts.lineId) {
      const p = await resolveLinePointer(supabase, input.parts.lineId);
      await recordDiscoveredMemory(supabase, {
        userId: input.userId,
        memoryType: "first_shadow",
        isAnchor: true,
        transcriptLineId: input.parts.lineId,
        videoId: p.videoId,
        lineTextJp: p.lineTextJp,
        timestampSeconds: p.timestampSeconds,
      });
    }

    if (input.source === "mining_review" && input.parts.cardId) {
      const { data: card } = await supabase
        .from("sentence_mining_cards")
        .select("transcript_line_id, sentence_jp, start_time, video_id")
        .eq("id", input.parts.cardId)
        .maybeSingle();
      const c = card as
        | { transcript_line_id: string | null; sentence_jp: string | null; start_time: number | null; video_id: string | null }
        | null;
      await recordDiscoveredMemory(supabase, {
        userId: input.userId,
        memoryType: "mining_saved",
        ref: { cardId: input.parts.cardId },
        transcriptLineId: c?.transcript_line_id ?? null,
        videoId: c?.video_id ?? null,
        lineTextJp: c?.sentence_jp ?? null,
        timestampSeconds: c?.start_time ?? null,
      });
    }

    if (input.source === "jlpt_submit" && input.parts.testId) {
      const { data: test } = await supabase.from("jlpt_tests").select("level").eq("id", input.parts.testId).maybeSingle();
      const level = (test as { level: string | null } | null)?.level;
      if (level) {
        await recordDiscoveredMemory(supabase, {
          userId: input.userId,
          memoryType: "jlpt_passed",
          ref: { jlptLevel: level },
          isAnchor: true,
        });
      }
    }
```

> `line_mastered` and `first_video_completed` need a "was this the Nth time / is this the first completion" read that the current `parts` do not carry (they require querying `shadowing_sessions` score history and `user_video_progress.completed_at`). Those two producers are deferred to Plan 2's data work where the completion/score-history reads are already loaded; leave a one-line `// TODO(plan-2): line_mastered, first_video_completed` is NOT allowed — instead, this task ships the three producers above (first_shadow, mining_saved, jlpt_passed) and the plan's scope note (below) records the remaining two as an explicit Plan-2 task. Do not add a TODO comment in code.

- [ ] **Step 4: Run to verify the first_shadow test passes**

Run: `npm test -- lib/data/companion.test.ts`
Expected: PASS.

- [ ] **Step 5: Add and run mining_saved + jlpt_passed tests**

Add two tests mirroring Step 1 for `source: "mining_review"` (mock `sentence_mining_cards`) and `source: "jlpt_submit"` (mock `jlpt_tests` → `{ level: "N4" }`, assert `dedupe_key: "jlpt_passed:N4"`, `is_anchor: true`). Run:
`npm test -- lib/data/companion.test.ts`
Expected: PASS (all capture cases).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint clean, the **entire** suite green (confirms no regression in gamification or elsewhere).

- [ ] **Step 7: Commit**

```bash
git add lib/data/companion.ts lib/data/companion.test.ts
git commit -m "feat(companion): first_shadow, mining_saved, jlpt_passed producers"
```

---

## Scope note — what Plan 1 deliberately leaves to Plans 2 & 3

- **`line_mastered` and `first_video_completed` producers** — need score-history / completion reads not on the gate's current hot path; implemented in **Plan 2** alongside the shadowing-replay and progress data work.
- **`first_shadow` producer** — moved to Plan 2 in final review of Task 7: the capture gate writes immutable memories, and recording `first_shadow` from `parts.lineId` alone (a session existing, not a target score being met) risked memorializing an attempt that wasn't a genuine shadowing success. It needs the same target-score signal that isn't available at recording-upload time — Plan 2 loads the score history alongside `line_mastered`, so `first_shadow` is implemented there against that same read.
- **Ambient Layer, anchors, context bus, state machine, arbitration/cooldown, Companion API, idle life, placeholder sprite, Journal UI** — **Plan 2** (needs L9a design system).
- **Adaptive modular-sentence voice** and **AI reflection endpoint** (bounded Anchor+Recent+Current-Session context, degradation, model independence) — **Plan 3** (needs L9a i18n + `lib/ai` port). The template titles in `lib/companion/dedupe.ts` move into the i18n layer there.

---

## Self-Review

**Spec coverage (Plan 1's slice):** §4.1 phase function + monotonicity → Task 2 ✓. §4.2 table, no-media, timeline order, anchor flag, ownership, persistence (per-account via FK+RLS) → Tasks 1, 4 ✓. §4.3 capture gate, idempotency, "memorable not frequent", immutability (no UPDATE grant) → Tasks 1, 5, 7 ✓. §4.4 template (non-AI) titles → Task 3 ✓. §6.5 failure isolation (best-effort, never throws) → Task 5 ✓. §12.4 private by design (owner-only RLS) → Tasks 1, 6 ✓. Deferred spec areas (presence, voice, reflection, API surface, arbitration) are explicitly assigned to Plans 2/3 in the scope note.

**Placeholder scan:** no TBD/TODO in shipped code (the Task 7 note explicitly forbids a code TODO); every code step carries full code.

**Type consistency:** `RelationshipPhase` (Task 2) is reused by `dedupeKeyFor`/`titleFor` (Task 3) and the `companion_grew` producer (Task 5). `recordDiscoveredMemory`'s `DiscoveredMemoryInput` (Task 4) is the single insert path used by every producer (Tasks 5, 7). `CompanionMemory` (Task 2) is the return type of `listJournal`/`getAnchorMemories` (Task 4) and the shape the Journal route returns (Task 6). Column names match the migration (Task 1) exactly.
