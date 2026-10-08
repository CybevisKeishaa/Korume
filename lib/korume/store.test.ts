import { describe, expect, it, vi } from "vitest";
import { sqlKorumeStore } from "./store";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ME = "a0000000-0000-4000-8000-000000000001";

/** A client whose `users` read answers `row` and records what it selected and for whom. */
function client(row: Record<string, unknown> | null, error: Error | null = null) {
  const seen: { table?: string; columns?: string; id?: unknown } = {};
  const chain = {
    select(columns: string) { seen.columns = columns; return chain; },
    eq(_col: string, id: unknown) { seen.id = id; return chain; },
    maybeSingle: async () => ({ data: row, error }),
  };
  return { seen, supabase: { from(table: string) { seen.table = table; return chain; } } as never };
}
const row = (over: Record<string, unknown> = {}) =>
  ({ native_language: null, target_jlpt_level: null, learning_goal: null, preferred_practices: [], ...over });

describe("readLearnerProfile", () => {
  it("reads the four profile columns of the caller's own row", async () => {
    const { seen, supabase } = client(row({ native_language: "vi", target_jlpt_level: "N2", learning_goal: "Trip", preferred_practices: ["shadowing"] }));
    await expect(sqlKorumeStore.readLearnerProfile(supabase, ME)).resolves.toEqual({
      nativeLanguage: "vi", targetJlptLevel: "N2", learningGoal: "Trip", preferredPractices: ["shadowing"],
    });
    expect(seen).toEqual({ table: "users", columns: "native_language, target_jlpt_level, learning_goal, preferred_practices", id: ME });
  });

  it("is null when every field is empty, a blank goal included", async () => {
    await expect(sqlKorumeStore.readLearnerProfile(client(row()).supabase, ME)).resolves.toBeNull();
    await expect(sqlKorumeStore.readLearnerProfile(client(row({ learning_goal: "   " })).supabase, ME)).resolves.toBeNull();
  });

  it("is null when there is no row, and throws a read error", async () => {
    await expect(sqlKorumeStore.readLearnerProfile(client(null).supabase, ME)).resolves.toBeNull();
    await expect(sqlKorumeStore.readLearnerProfile(client(null, new Error("boom")).supabase, ME)).rejects.toThrow("boom");
  });

  it("keeps a profile with only a practice", async () => {
    const profile = await sqlKorumeStore.readLearnerProfile(client(row({ preferred_practices: ["reading"] })).supabase, ME);
    expect(profile).toEqual({ nativeLanguage: null, targetJlptLevel: null, learningGoal: null, preferredPractices: ["reading"] });
  });

  it("drops what the app never allows: an unknown language and unknown or oversized practices", async () => {
    const profile = await sqlKorumeStore.readLearnerProfile(
      client(row({ native_language: "xx", preferred_practices: ["kanji", "x".repeat(30_000), "dancing"] })).supabase, ME);
    expect(profile).toEqual({ nativeLanguage: null, targetJlptLevel: null, learningGoal: null, preferredPractices: ["kanji"] });
    await expect(sqlKorumeStore.readLearnerProfile(client(row({ native_language: "xx", preferred_practices: ["dancing"] })).supabase, ME)).resolves.toBeNull();
  });
});
