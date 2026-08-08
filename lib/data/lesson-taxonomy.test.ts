import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useTables(tables: Record<string, TableResolver>) {
  const supabase = createMockSupabase({ user: { id: "u1" }, tables });
  vi.mocked(createClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createClient>,
  );
}

describe("lesson taxonomy", () => {
  it("lists situations ordered by display_order", async () => {
    useTables({
      lesson_situations: (calls) => {
        expect(calls).toContainEqual({ op: "order", column: "display_order", ascending: true });
        return {
          data: [
            { id: "s1", slug: "conversation", display_order: 1 },
            { id: "s2", slug: "restaurant", display_order: 2 },
          ],
          error: null,
        };
      },
    });
    const { listSituations } = await import("@/lib/data/lesson-taxonomy");
    expect(await listSituations()).toEqual([
      { id: "s1", slug: "conversation", displayOrder: 1 },
      { id: "s2", slug: "restaurant", displayOrder: 2 },
    ]);
  });

  it("returns a lesson's situations as an array even though the column is single-valued", async () => {
    // Spec D11: cardinality is provisional. Consumers must not learn that a
    // lesson has exactly one situation, so going many-to-many later changes
    // this query body and nothing else.
    useTables({
      videos: (calls) => {
        expect(eqValue(calls, "id")).toBe("lesson-1");
        return { data: { situation_id: "s2" }, error: null };
      },
      lesson_situations: () => ({
        data: [{ id: "s2", slug: "restaurant", display_order: 2 }],
        error: null,
      }),
    });
    const { getLessonSituations } = await import("@/lib/data/lesson-taxonomy");
    const result = await getLessonSituations("lesson-1");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([{ id: "s2", slug: "restaurant", displayOrder: 2 }]);
  });

  it("returns an empty array for a lesson with no situation", async () => {
    useTables({
      videos: () => ({ data: { situation_id: null }, error: null }),
      // No lesson_situations resolver on purpose: the mock throws for an
      // unresolved table, so this also proves the second query is skipped.
    });
    const { getLessonSituations } = await import("@/lib/data/lesson-taxonomy");
    expect(await getLessonSituations("lesson-1")).toEqual([]);
  });
});
