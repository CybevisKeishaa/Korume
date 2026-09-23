import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { DIFFICULTY_BANDS, scoreComprehension } from "@/lib/difficulty";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/data/videos", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "u1" }) }));
vi.mock("@/lib/data/transcripts", () => ({ getTranscript: vi.fn().mockResolvedValue({ ok: true, data: { lines: [] } }) }));
// Spread the real module so DIFFICULTY_BANDS stays the one in score.ts. Restating
// the bands here would make this assert that the mock equals itself, and a change
// to a real band would leave it green.
vi.mock("@/lib/difficulty", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/difficulty")>()),
  contentLemmas: vi.fn(),
  scoreComprehension: vi.fn(() => ({ totalWords: 0, knownWords: 0, knownRatio: 0, band: "insufficient-data" })),
}));

import { getVideoDifficulty } from "./difficulty";

beforeEach(() => {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({ user: { id: "u1" }, tables: {} }) as unknown as ReturnType<typeof createClient>);
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, difficulty: "challenge" });
  vi.mocked(scoreComprehension).mockClear();
});

describe("getVideoDifficulty preferences", () => {
  it("passes the challenge band even when the transcript is empty", async () => {
    await getVideoDifficulty("video-1");
    expect(scoreComprehension).toHaveBeenCalledWith([], expect.any(Set), DIFFICULTY_BANDS.challenge);
  });
});
