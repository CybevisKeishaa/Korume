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

  it("lists memberships by position then lesson id", async () => {
    useTables({
      lesson_collections: (calls) => {
        expect(calls).toEqual([
          { op: "select", columns: "lesson_id, position" },
          { op: "eq", column: "collection_id", value: "c1" },
          { op: "order", column: "position", ascending: true },
          { op: "order", column: "lesson_id", ascending: true },
        ]);
        return { data: [{ lesson_id: "v2", position: 0 }, { lesson_id: "v1", position: 1 }], error: null };
      },
    });
    const { listMemberships } = await import("@/lib/data/collections");
    await expect(listMemberships("c1")).resolves.toEqual([
      { lessonId: "v2", position: 0 },
      { lessonId: "v1", position: 1 },
    ]);
  });

  it("returns lessons in editorial order", async () => {
    useTables({
      lesson_collections: () => ({
        data: [{ lesson_id: "v2", position: 0 }, { lesson_id: "v1", position: 1 }],
        error: null,
      }),
      videos: (calls) => {
        expect(calls).toContainEqual({ op: "in", column: "id", values: ["v2", "v1"] });
        expect(calls).toContainEqual({ op: "order", column: "created_at", ascending: false });
        expect(calls).toContainEqual({ op: "order", column: "id", ascending: true });
        return { data: [{ id: "v1" }, { id: "v2" }], error: null };
      },
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect((await listCollectionLessons("c1")).map((v) => v.id)).toEqual(["v2", "v1"]);
  });

  it("keeps the videos query order for an unordered collection", async () => {
    useTables({
      lesson_collections: () => ({
        data: [{ lesson_id: "v1", position: 0 }, { lesson_id: "v2", position: 0 }],
        error: null,
      }),
      videos: () => ({ data: [{ id: "v2" }, { id: "v1" }], error: null }),
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect((await listCollectionLessons("c1")).map((video) => video.id)).toEqual(["v2", "v1"]);
  });

  it("applies the limit after editorial ordering", async () => {
    useTables({
      lesson_collections: () => ({
        data: [
          { lesson_id: "v2", position: 0 },
          { lesson_id: "v1", position: 1 },
          { lesson_id: "v3", position: 2 },
        ],
        error: null,
      }),
      videos: (calls) => {
        expect(calls).not.toContainEqual({ op: "limit", count: 2 });
        return { data: [{ id: "v3" }, { id: "v1" }, { id: "v2" }], error: null };
      },
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");
    expect((await listCollectionLessons("c1", { limit: 2 })).map((video) => video.id)).toEqual(["v2", "v1"]);
  });

  it("applies Explore's selected situation and search term to the RLS-visible member query", async () => {
    useTables({
      lesson_collections: () => ({ data: [{ lesson_id: "v1", position: 0 }], error: null }),
      videos: (calls) => {
        expect(calls).toEqual(expect.arrayContaining([
          { op: "eq", column: "situation_id", value: "s-restaurant" },
          { op: "ilike", column: "title", pattern: "%ramen%" },
        ]));
        expect(calls.some((call) => call.op === "limit")).toBe(false);
        return { data: [{ id: "v1" }], error: null };
      },
    });
    const { listCollectionLessons } = await import("@/lib/data/collections");

    await expect(listCollectionLessons("c1", { situationId: "s-restaurant", query: "ramen", limit: 8 })).resolves.toEqual([{ id: "v1" }]);
  });

  it("counts memberships and only completed progress rows", async () => {
    useTables({
      lesson_collections: () => ({
        data: [
          { lesson_id: "v1", position: 0 },
          { lesson_id: "v2", position: 1 },
          { lesson_id: "v3", position: 2 },
        ],
        error: null,
      }),
      user_video_progress: (calls) => {
        expect(calls).toContainEqual({ op: "select", columns: "video_id, completed_at" });
        expect(calls).toContainEqual({ op: "in", column: "video_id", values: ["v1", "v2", "v3"] });
        return {
          data: [
            { video_id: "v1", completed_at: "2026-09-25T00:00:00Z" },
            { video_id: "v2", completed_at: null },
            { video_id: "v3", completed_at: null },
          ],
          error: null,
        };
      },
    });
    const { getCollectionProgress } = await import("@/lib/data/collections");
    await expect(getCollectionProgress("c1")).resolves.toEqual({ total: 3, completed: 1 });
  });

  it("skips progress lookup for an empty collection", async () => {
    useTables({
      lesson_collections: () => ({ data: [], error: null }),
    });
    const { getCollectionProgress } = await import("@/lib/data/collections");
    await expect(getCollectionProgress("c1")).resolves.toEqual({ total: 0, completed: 0 });
  });
});
