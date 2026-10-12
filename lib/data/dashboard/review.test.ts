import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: (fn: unknown) => fn }));

import { getReviewSummary } from "./review";

beforeEach(() => vi.clearAllMocks());

describe("getReviewSummary", () => {
  it("asks for the exposed decks in one RPC and maps rows to the destination", async () => {
    const calls: unknown[] = [];
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      tables: {},
      rpcs: {
        review_deck_summary: (args) => {
          calls.push(args);
          return { data: [
            { deck: "mining", due: 2, last_reviewed_at: null },
            { deck: "kanji", due: 5, last_reviewed_at: "2026-10-01T00:00:00Z" },
          ], error: null };
        },
      },
    }) as unknown as ReturnType<typeof createClient>);

    await expect(getReviewSummary()).resolves.toEqual({ href: "/kanji/review", due: 7 });
    expect(calls).toEqual([{ p_decks: ["mining", "kanji"] }]);
  });
});
