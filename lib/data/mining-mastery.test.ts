import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/data/videos", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "u1" }) }));
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }));

import { reviewMiningCard } from "./mining";

const now = new Date("2026-10-08T10:00:00.000Z");
let calls: QueryCall[][];

function install(existing: Record<string, unknown>): void {
  calls = [];
  const responses = [{ data: existing, error: null }, { data: null, error: null }];
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    tables: { sentence_mining_cards: (c) => { calls.push(c); return responses.shift() ?? { data: null, error: null }; } },
  }) as unknown as ReturnType<typeof createClient>);
}

function writtenMasteredAt(): unknown {
  const update = calls[1]?.find((call) => call.op === "update") as { values: { mastered_at?: unknown } } | undefined;
  expect(update, "the review wrote the card").toBeDefined();
  return update!.values.mastered_at;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
});

describe("reviewMiningCard mastery timestamp (port-dashboard S2)", () => {
  it("stamps mastered_at when a card crosses from stage 1 to 2", async () => {
    install({ srs_stage: 1, interval_days: 1, ease_factor: 2.5, mastered_at: null });
    await expect(reviewMiningCard({ cardId: "card-1", quality: 4 }, now)).resolves.toMatchObject({ ok: true });
    expect(writtenMasteredAt()).toBe(now.toISOString());
  });

  it("keeps the first mastery timestamp through a later lapse", async () => {
    install({ srs_stage: 3, interval_days: 10, ease_factor: 2.5, mastered_at: "2026-09-01T00:00:00.000Z" });
    await expect(reviewMiningCard({ cardId: "card-1", quality: 0 }, now)).resolves.toMatchObject({ ok: true });
    expect(writtenMasteredAt()).toBe("2026-09-01T00:00:00.000Z");
  });
});
