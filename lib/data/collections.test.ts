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
      description: "Start…", coverImageUrl: null, displayOrder: 1, kind: "shelf", skillFocus: null,
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
            { video_id: "v3", completed_at: "2026-09-26T00:00:00Z" },
          ],
          error: null,
        };
      },
    });
    const { getCollectionProgress } = await import("@/lib/data/collections");
    await expect(getCollectionProgress("c1")).resolves.toEqual({ total: 3, completed: 2 });
  });

  it("skips progress lookup for an empty collection", async () => {
    useTables({
      lesson_collections: () => ({ data: [], error: null }),
    });
    const { getCollectionProgress } = await import("@/lib/data/collections");
    await expect(getCollectionProgress("c1")).resolves.toEqual({ total: 0, completed: 0 });
  });

  it("selects only path collections for the featured course and derives its visible progress", async () => {
    useTables({
      collections: (calls) => {
        expect(calls).toContainEqual({ op: "eq", column: "kind", value: "path" });
        return { data: [{ id: "path", slug: "everyday", title: "Everyday", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null }], error: null };
      },
      lesson_collections: () => ({ data: [{ collection_id: "path", lesson_id: "v1", position: 0 }, { collection_id: "path", lesson_id: "v2", position: 1 }], error: null }),
      videos: () => ({ data: [
        { id: "v1", youtube_video_id: "yt1", title: "First", duration_seconds: 1800, thumbnail_url: "https://example.com/one.jpg", jlpt_level_estimate: "N4", created_at: "2026-01-01" },
        { id: "v2", youtube_video_id: "yt2", title: "Second", duration_seconds: 1800, thumbnail_url: null, jlpt_level_estimate: "N3", created_at: "2026-01-02" },
      ], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "v1", last_watched_position: 900, completed_at: "2026-09-01" }, { video_id: "v2", last_watched_position: 300, completed_at: null }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toMatchObject({
      collection: { slug: "everyday", kind: "path" }, total: 2, completed: 1,
      next: { id: "v2" }, durationMinutes: 60, jlptRange: "N4–N3", levelBand: { from: "beginner", to: "intermediate" },
      resume: { lesson: { id: "v2" }, index: 2, percent: 17 },
    });
  });

  it("orders featured-course lessons exactly as listCollectionLessons does: equal positions keep the videos query order", async () => {
    useTables({
      collections: () => ({ data: [{ id: "path", slug: "path", title: "Path", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null }], error: null }),
      lesson_collections: () => ({ data: [{ collection_id: "path", lesson_id: "a-old", position: 0 }, { collection_id: "path", lesson_id: "b-new", position: 0 }], error: null }),
      videos: () => ({ data: [
        { id: "b-new", duration_seconds: 60, jlpt_level_estimate: null, created_at: "2026-02-01" },
        { id: "a-old", duration_seconds: 60, jlpt_level_estimate: null, created_at: "2026-01-01" },
      ], error: null }),
      user_video_progress: () => ({ data: [], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    const course = await getFeaturedCourse();
    expect(course?.lessons.map((lesson) => lesson.id)).toEqual(["b-new", "a-old"]);
    expect(course?.next?.id).toBe("b-new");
  });

  it("prefers an in-progress course over an earlier untouched one when there is no recent activity (rule 2 over rule 3)", async () => {
    useTables({
      collections: () => ({ data: [
        { id: "untouched", slug: "untouched", title: "Untouched", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null },
        { id: "begun", slug: "begun", title: "Begun", description: null, cover_image_url: null, display_order: 2, kind: "path", skill_focus: null },
      ], error: null }),
      lesson_collections: () => ({ data: [
        { collection_id: "untouched", lesson_id: "v1", position: 0 },
        { collection_id: "begun", lesson_id: "v2", position: 0 },
        { collection_id: "begun", lesson_id: "v3", position: 1 },
      ], error: null }),
      videos: () => ({ data: [
        { id: "v1", duration_seconds: 60, jlpt_level_estimate: null },
        { id: "v2", duration_seconds: 60, jlpt_level_estimate: null },
        { id: "v3", duration_seconds: 60, jlpt_level_estimate: null },
      ], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "v2", last_watched_position: 60, completed_at: "2026-09-28T00:00:00Z", last_watched_at: null }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toMatchObject({ collection: { slug: "begun" }, completed: 1, selectedByRecentActivity: false });
  });

  it("resumes in editorial order when every started lesson predates last_watched_at (all null)", async () => {
    useTables({
      collections: () => ({ data: [{ id: "path", slug: "path", title: "Path", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null }], error: null }),
      lesson_collections: () => ({ data: [{ collection_id: "path", lesson_id: "v1", position: 0 }, { collection_id: "path", lesson_id: "v2", position: 1 }], error: null }),
      videos: () => ({ data: [{ id: "v1", duration_seconds: 100, jlpt_level_estimate: null }, { id: "v2", duration_seconds: 100, jlpt_level_estimate: null }], error: null }),
      user_video_progress: () => ({ data: [
        { video_id: "v2", last_watched_position: 80, completed_at: null, last_watched_at: null },
        { video_id: "v1", last_watched_position: 10, completed_at: null, last_watched_at: null },
      ], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toMatchObject({ resume: { lesson: { id: "v1" }, index: 1, percent: 10 } });
  });

  it("covers the course with the first member, in editorial order, that has a thumbnail", async () => {
    useTables({
      collections: () => ({ data: [{ id: "path", slug: "path", title: "Path", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null }], error: null }),
      lesson_collections: () => ({ data: [{ collection_id: "path", lesson_id: "v1", position: 0 }, { collection_id: "path", lesson_id: "v2", position: 1 }, { collection_id: "path", lesson_id: "v3", position: 2 }], error: null }),
      videos: () => ({ data: [
        { id: "v3", thumbnail_url: "https://example.com/three.jpg", duration_seconds: 60, jlpt_level_estimate: null },
        { id: "v2", thumbnail_url: "https://example.com/two.jpg", duration_seconds: 60, jlpt_level_estimate: null },
        { id: "v1", thumbnail_url: null, duration_seconds: 60, jlpt_level_estimate: null },
      ], error: null }),
      user_video_progress: () => ({ data: [], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toMatchObject({ coverUrl: "https://example.com/two.jpg" });
  });

  it("returns null when no path has a visible lesson", async () => {
    useTables({
      collections: () => ({ data: [{ id: "path", slug: "empty", title: "Empty", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null }], error: null }),
      lesson_collections: () => ({ data: [], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toBeNull();
  });

  it("derives a null level band when no lesson has a JLPT level", async () => {
    const { collectionMeta } = await import("@/lib/data/collections");
    expect(collectionMeta([{ duration_seconds: null, jlpt_level_estimate: null }])).toEqual({ durationMinutes: null, jlptRange: null, levelBand: null });
  });

  it("sums every available duration instead of discarding a collection with one missing duration", async () => {
    const { collectionMeta } = await import("@/lib/data/collections");
    expect(collectionMeta([
      { duration_seconds: 1200, jlpt_level_estimate: null },
      { duration_seconds: null, jlpt_level_estimate: null },
    ]).durationMinutes).toBe(20);
  });

  it("chooses the most recently active course before an in-progress course and marks it as such", async () => {
    useTables({
      collections: () => ({ data: [
        { id: "recent", slug: "recent", title: "Recent", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null },
        { id: "progress", slug: "progress", title: "Progress", description: null, cover_image_url: null, display_order: 2, kind: "path", skill_focus: null },
      ], error: null }),
      lesson_collections: () => ({ data: [
        { collection_id: "recent", lesson_id: "v1", position: 0 },
        { collection_id: "progress", lesson_id: "v2", position: 0 },
        { collection_id: "progress", lesson_id: "v3", position: 1 },
      ], error: null }),
      videos: () => ({ data: [
        { id: "v1", duration_seconds: 60, jlpt_level_estimate: null },
        { id: "v2", duration_seconds: 60, jlpt_level_estimate: null },
        { id: "v3", duration_seconds: 60, jlpt_level_estimate: null },
      ], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "v2", last_watched_position: 30, completed_at: "2026-09-29T00:00:00Z", last_watched_at: "2026-09-29T00:00:00Z" }], error: null }),
      shadowing_sessions: () => ({ data: [{ video_id: "v1", created_at: "2026-09-29T01:00:00Z" }], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toMatchObject({
      collection: { slug: "recent" },
      completed: 0,
      selectedByRecentActivity: true,
    });
  });

  it("chooses the most recently watched unfinished lesson, then editorial order for legacy null timestamps", async () => {
    useTables({
      collections: () => ({ data: [{ id: "path", slug: "path", title: "Path", description: null, cover_image_url: null, display_order: 1, kind: "path", skill_focus: null }], error: null }),
      lesson_collections: () => ({ data: [{ collection_id: "path", lesson_id: "v1", position: 0 }, { collection_id: "path", lesson_id: "v2", position: 1 }], error: null }),
      videos: () => ({ data: [{ id: "v1", duration_seconds: 100, jlpt_level_estimate: null }, { id: "v2", duration_seconds: 100, jlpt_level_estimate: null }], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "v1", last_watched_position: 90, completed_at: null, last_watched_at: null }, { video_id: "v2", last_watched_position: 10, completed_at: null, last_watched_at: "2026-09-29T10:00:00Z" }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
    });
    const { getFeaturedCourse } = await import("@/lib/data/collections");
    await expect(getFeaturedCourse()).resolves.toMatchObject({ resume: { lesson: { id: "v2" }, index: 2 } });
  });
});
