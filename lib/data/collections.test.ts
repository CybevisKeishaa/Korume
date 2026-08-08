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

describe("collections", () => {
  it("lists collections ordered by display_order", async () => {
    useTables({
      collections: (calls) => {
        expect(calls).toContainEqual({ op: "order", column: "display_order", ascending: true });
        return {
          data: [
            { id: "c0", slug: "featured", title: "Featured", description: null, cover_image_url: null, display_order: 0 },
            { id: "c1", slug: "beginner-foundation", title: "Beginner Foundation", description: "Start…", cover_image_url: null, display_order: 1 },
          ],
          error: null,
        };
      },
    });
    const { listCollections } = await import("@/lib/data/collections");
    const result = await listCollections();
    expect(result.map((c) => c.slug)).toEqual(["featured", "beginner-foundation"]);
    expect(result[1]).toEqual({
      id: "c1", slug: "beginner-foundation", title: "Beginner Foundation",
      description: "Start…", coverImageUrl: null, displayOrder: 1,
    });
  });

  it("returns null for an unknown slug rather than throwing", async () => {
    useTables({
      collections: (calls) => {
        expect(eqValue(calls, "slug")).toBe("nope");
        return { data: null, error: null };
      },
    });
    const { getCollectionBySlug } = await import("@/lib/data/collections");
    expect(await getCollectionBySlug("nope")).toBeNull();
  });

  it("returns an empty array for a collection with no lessons", async () => {
    useTables({
      // No `videos` resolver on purpose: the mock throws for an unresolved
      // table, so this also proves the second query is skipped when there are
      // no memberships.
      lesson_collections: () => ({ data: [], error: null }),
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect(await listCollectionLessons("c1")).toEqual([]);
  });

  it("fetches only the member lessons, by id", async () => {
    useTables({
      lesson_collections: () => ({
        data: [{ lesson_id: "v1" }, { lesson_id: "v2" }],
        error: null,
      }),
      videos: (calls) => {
        expect(calls).toContainEqual({ op: "in", column: "id", values: ["v1", "v2"] });
        return { data: [{ id: "v1" }, { id: "v2" }], error: null };
      },
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect((await listCollectionLessons("c1")).map((v) => v.id)).toEqual(["v1", "v2"]);
  });
});
