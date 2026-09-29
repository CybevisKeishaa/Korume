import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type RpcResolver, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));

function useTables(tables: Record<string, TableResolver>, rpcs?: Record<string, RpcResolver>) {
  // Saved paths default to none; a test that cares supplies its own rows.
  const supabase = createMockSupabase({ user: { id: "u1" }, tables: { user_saved_collections: () => ({ data: [], error: null }), ...tables }, rpcs });
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
      description: "Start…", coverImageUrl: null, displayOrder: 1, kind: "shelf", skillFocus: null, icon: null,
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
    expect(collectionMeta([{ duration_seconds: null, jlpt_level_estimate: null }])).toEqual({ lessonCount: 1, durationMinutes: null, jlptRange: null, levelBand: null });
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

describe("learning paths", () => {
  const path = (id: string, order: number) => ({ id, slug: id, title: id, description: null, cover_image_url: null, display_order: order, kind: "path", skill_focus: null, icon: null });
  const lesson = (id: string, duration: number | null = 600) => ({ id, duration_seconds: duration, jlpt_level_estimate: null, thumbnail_url: null });

  it("summarises every path with a visible lesson, and drops a path whose lessons the viewer cannot see", async () => {
    useTables({
      collections: () => ({ data: [path("started", 1), path("fresh", 2), path("hidden", 3)], error: null }),
      lesson_collections: () => ({ data: [
        { collection_id: "started", lesson_id: "a1", position: 0 },
        { collection_id: "started", lesson_id: "a2", position: 1 },
        { collection_id: "fresh", lesson_id: "b1", position: 0 },
        { collection_id: "hidden", lesson_id: "plus-only", position: 0 },
      ], error: null }),
      // RLS hides `plus-only`, so the videos read never returns it.
      videos: () => ({ data: [lesson("a1", 1200), lesson("a2", null), lesson("b1", 600)], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "a1", last_watched_position: 30, completed_at: null, last_watched_at: null }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
      user_saved_collections: () => ({ data: [{ collection_id: "fresh" }], error: null }),
    });
    const { getLearningPaths } = await import("@/lib/data/collections");
    const { paths } = await getLearningPaths();

    expect(paths.map((summary) => summary.collection.slug)).toEqual(["started", "fresh"]);
    expect(paths[0]).toMatchObject({ total: 2, completed: 0, started: true, saved: false, next: { id: "a1" }, durationMinutes: 20 });
    expect(paths[1]).toMatchObject({ total: 1, completed: 0, started: false, saved: true, next: { id: "b1" } });
  });

  it("features a saved unfinished path over one merely in progress (saved beats rule 3)", async () => {
    useTables({
      collections: () => ({ data: [path("in-progress", 1), path("saved", 2)], error: null }),
      lesson_collections: () => ({ data: [
        { collection_id: "in-progress", lesson_id: "a1", position: 0 },
        { collection_id: "in-progress", lesson_id: "a2", position: 1 },
        { collection_id: "saved", lesson_id: "b1", position: 0 },
      ], error: null }),
      videos: () => ({ data: [lesson("a1"), lesson("a2"), lesson("b1")], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "a1", last_watched_position: 600, completed_at: "2026-09-28T00:00:00Z", last_watched_at: null }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
      user_saved_collections: () => ({ data: [{ collection_id: "saved" }], error: null }),
    });
    const { getLearningPaths } = await import("@/lib/data/collections");
    await expect(getLearningPaths()).resolves.toMatchObject({ featured: { collection: { slug: "saved" }, selectedByRecentActivity: false } });
  });

  it("does not feature a saved path the learner has finished", async () => {
    useTables({
      collections: () => ({ data: [path("first", 1), path("done", 2)], error: null }),
      lesson_collections: () => ({ data: [
        { collection_id: "first", lesson_id: "a1", position: 0 },
        { collection_id: "done", lesson_id: "b1", position: 0 },
      ], error: null }),
      videos: () => ({ data: [lesson("a1"), lesson("b1")], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "b1", last_watched_position: 600, completed_at: "2026-09-28T00:00:00Z", last_watched_at: null }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
      user_saved_collections: () => ({ data: [{ collection_id: "done" }], error: null }),
    });
    const { getLearningPaths } = await import("@/lib/data/collections");
    await expect(getLearningPaths()).resolves.toMatchObject({ featured: { collection: { slug: "first" } } });
  });
});

describe("practice goals", () => {
  const goal = (id: string, order: number, skillFocus: "accuracy" | "pitch" | "rhythm") => ({ id, slug: id, title: id, description: null, cover_image_url: null, display_order: order, kind: "goal", skill_focus: skillFocus, icon: "â—Œ" });
  const lesson = (id: string, duration: number | null = 600) => ({ id, duration_seconds: duration, jlpt_level_estimate: null, thumbnail_url: null });

  it("uses the path derivation for goals: visible lessons are ordered, progressed, and timed", async () => {
    useTables({
      collections: (calls) => {
        expect(calls).toContainEqual({ op: "eq", column: "kind", value: "goal" });
        return { data: [goal("pitch", 1, "pitch"), goal("rhythm", 2, "rhythm"), goal("empty", 3, "accuracy")], error: null };
      },
      lesson_collections: () => ({ data: [
        { collection_id: "pitch", lesson_id: "pitch-next", position: 1 },
        { collection_id: "pitch", lesson_id: "pitch-done", position: 0 },
        { collection_id: "rhythm", lesson_id: "rhythm-first", position: 0 },
        { collection_id: "empty", lesson_id: "hidden", position: 0 },
      ], error: null }),
      videos: () => ({ data: [lesson("pitch-next", 1200), lesson("pitch-done", 600), lesson("rhythm-first", 300)], error: null }),
      user_video_progress: () => ({ data: [{ video_id: "pitch-done", last_watched_position: 600, completed_at: "2026-09-29T00:00:00Z", last_watched_at: null }], error: null }),
    });
    const { getPracticeGoals } = await import("@/lib/data/collections");

    await expect(getPracticeGoals()).resolves.toMatchObject([
      { collection: { slug: "pitch" }, total: 2, completed: 1, started: true, next: { id: "pitch-next" }, lessonCount: 2, durationMinutes: 30 },
      { collection: { slug: "rhythm" }, total: 1, completed: 0, started: false, next: { id: "rhythm-first" }, lessonCount: 1, durationMinutes: 5 },
    ]);
  });

  it("recommends only the first displayed goal matching the weakest metric", async () => {
    const { recommendedPracticeGoalId } = await import("@/lib/data/collections");
    const goals = [
      { collection: { id: "pitch", skillFocus: "pitch" } },
      { collection: { id: "rhythm-first", skillFocus: "rhythm" } },
      { collection: { id: "rhythm-second", skillFocus: "rhythm" } },
    ] as Awaited<ReturnType<typeof import("@/lib/data/collections")["getPracticeGoals"]>>;

    expect(recommendedPracticeGoalId(goals, "rhythm")).toBe("rhythm-first");
    expect(recommendedPracticeGoalId(goals, null)).toBeNull();
    expect(recommendedPracticeGoalId(goals, "accuracy")).toBeNull();
  });
});

describe("setCollectionSaved", () => {
  const COLLECTION = "0b9c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3";

  it("refuses an anonymous caller without touching the table", async () => {
    const supabase = createMockSupabase({ user: null, tables: {} });
    vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
    const { setCollectionSaved } = await import("@/lib/data/collections");
    await expect(setCollectionSaved(COLLECTION, true)).resolves.toEqual({ ok: false, status: 401 });
  });

  it("saves the path for the caller, and treats an existing save as success", async () => {
    let attempt = 0;
    useTables({
      user_saved_collections: (calls) => {
        expect(calls).toContainEqual({ op: "insert", values: { user_id: "u1", collection_id: COLLECTION } });
        attempt += 1;
        return attempt === 1 ? { data: null, error: null } : { data: null, error: { code: "23505", message: "duplicate" } };
      },
    });
    const { setCollectionSaved } = await import("@/lib/data/collections");
    await expect(setCollectionSaved(COLLECTION, true)).resolves.toEqual({ ok: true });
    await expect(setCollectionSaved(COLLECTION, true)).resolves.toEqual({ ok: true });
  });

  it.each([
    ["42501", "the insert policy refused it (not a path)"],
    ["23503", "no such collection"],
  ])("reads %s (%s) as 404", async (code) => {
    useTables({ user_saved_collections: () => ({ data: null, error: { code, message: "refused" } }) });
    const { setCollectionSaved } = await import("@/lib/data/collections");
    await expect(setCollectionSaved(COLLECTION, true)).resolves.toEqual({ ok: false, status: 404 });
  });

  it("unsaves only the caller's own row", async () => {
    useTables({
      user_saved_collections: (calls) => {
        expect(calls).toContainEqual({ op: "delete" });
        expect(eqValue(calls, "user_id")).toBe("u1");
        expect(eqValue(calls, "collection_id")).toBe(COLLECTION);
        return { data: null, error: null };
      },
    });
    const { setCollectionSaved } = await import("@/lib/data/collections");
    await expect(setCollectionSaved(COLLECTION, false)).resolves.toEqual({ ok: true });
  });

  it("rate-limits a caller before any write", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 5_000 });
    useTables({ user_saved_collections: () => { throw new Error("must not write while rate-limited"); } });
    const { setCollectionSaved } = await import("@/lib/data/collections");
    await expect(setCollectionSaved(COLLECTION, true)).resolves.toEqual({ ok: false, status: 429, retryAfter: 5_000 });
  });
});

describe("shadowing collections", () => {
  const shelf = (slug: string) => ({ id: slug, slug, title: slug, description: null, cover_image_url: null, display_order: 0, kind: "shelf", skill_focus: null, icon: null });
  const lesson = (id: string, duration: number | null, jlpt: string | null) => ({ id, duration_seconds: duration, jlpt_level_estimate: jlpt, thumbnail_url: null });

  it("summarises the explore collections in their authored order, and drops one with no visible lesson", async () => {
    useTables({
      collections: (calls) => {
        expect(calls).toContainEqual({ op: "in", column: "slug", values: ["beginner-foundation", "daily-conversation", "natural-japanese", "advanced-expression", "native-fluency"] });
        // Returned out of order: the authored sequence, not the read, decides the shelf.
        return { data: [shelf("native-fluency"), shelf("daily-conversation"), shelf("beginner-foundation")], error: null };
      },
      lesson_collections: () => ({ data: [
        { collection_id: "beginner-foundation", lesson_id: "a1" },
        { collection_id: "beginner-foundation", lesson_id: "a2" },
        { collection_id: "daily-conversation", lesson_id: "plus-only" },
        { collection_id: "native-fluency", lesson_id: "a2" },
        { collection_id: "native-fluency", lesson_id: "c1" },
      ], error: null }),
      // RLS hides `plus-only`, so the videos read never returns it.
      videos: () => ({ data: [lesson("a1", 1200, "N5"), lesson("a2", null, "N4"), lesson("c1", 600, "N1")], error: null }),
    }, {
      video_sentence_counts: (args) => {
        expect(args).toEqual({ p_video_ids: ["a1", "a2", "c1"] });
        // `a2` has no readable transcript, so the function returns no row for it.
        return { data: [{ video_id: "a1", sentence_count: 38 }, { video_id: "c1", sentence_count: 4 }], error: null };
      },
    });
    const { getShadowingCollections } = await import("@/lib/data/collections");
    const summaries = await getShadowingCollections();

    expect(summaries.map((summary) => summary.collection.slug)).toEqual(["beginner-foundation", "native-fluency"]);
    expect(summaries[0]).toMatchObject({ lessonCount: 2, durationMinutes: 20, sentenceCount: 38, levelBand: { from: "beginner", to: "beginner" } });
    expect(summaries[1]).toMatchObject({ lessonCount: 2, durationMinutes: 10, sentenceCount: 4, levelBand: { from: "beginner", to: "advanced" } });
  });

  it("reads no lessons when no collection has members", async () => {
    // No `videos` resolver and no RPC on purpose: the mock throws for either.
    useTables({
      collections: () => ({ data: [shelf("beginner-foundation")], error: null }),
      lesson_collections: () => ({ data: [], error: null }),
    });
    const { getShadowingCollections } = await import("@/lib/data/collections");
    expect(await getShadowingCollections()).toEqual([]);
  });
});
