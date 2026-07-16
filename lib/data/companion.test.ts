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
