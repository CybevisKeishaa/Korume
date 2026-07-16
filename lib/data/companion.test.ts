import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { captureCompanionMemories, getAnchorMemories, listJournal, recordDiscoveredMemory } from "./companion";
import { PHASE_THRESHOLDS } from "@/lib/companion";

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

  it("records mining_saved with the card pointer on a mining_review outcome", async () => {
    let inserted: Record<string, unknown> | undefined;
    const supabase = createMockSupabase({
      tables: {
        sentence_mining_cards: () => ({
          data: { transcript_line_id: "L2", sentence_jp: "待って", start_time: 12.5, video_id: "V2" },
          error: null,
        }),
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
      source: "mining_review",
      parts: { cardId: "C1" },
      prevXp: 10,
      nextXp: 20,
    });
    expect(inserted).toMatchObject({
      memory_type: "mining_saved",
      dedupe_key: "mining_saved:C1",
      transcript_line_id: "L2",
      line_text_jp: "待って",
      video_id: "V2",
    });
  });

  it("records jlpt_passed as an anchor on a jlpt_submit outcome", async () => {
    let inserted: Record<string, unknown> | undefined;
    const supabase = createMockSupabase({
      tables: {
        jlpt_tests: () => ({ data: { level: "N4" }, error: null }),
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
      source: "jlpt_submit",
      parts: { testId: "T9" },
      prevXp: 10,
      nextXp: 20,
    });
    expect(inserted).toMatchObject({
      memory_type: "jlpt_passed",
      dedupe_key: "jlpt_passed:N4",
      is_anchor: true,
    });
  });
});
