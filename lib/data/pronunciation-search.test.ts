import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

const hub = vi.hoisted(() => ({ getHubDiscovery: vi.fn(), getHubDiscoveryCount: vi.fn() }));
const collections = vi.hoisted(() => ({
  getCollectionViews: vi.fn(), getShadowingCollections: vi.fn(), savedCollectionIds: vi.fn(), toCollectionProgressSummary: vi.fn(),
}));
const taxonomy = vi.hoisted(() => ({ listPracticeSituations: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/shadowing-hub", () => hub);
vi.mock("@/lib/data/collections", () => collections);
vi.mock("@/lib/data/lesson-taxonomy", () => taxonomy);

describe("pronunciation search data facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collections.toCollectionProgressSummary.mockImplementation((view: { collection: { id: string } }) => ({ collection: view.collection, total: 1, completed: 0, next: null, started: false, lessonCount: 1, durationMinutes: 5, lessonIds: [view.collection.id] }));
    collections.getShadowingCollections.mockResolvedValue([]);
    taxonomy.listPracticeSituations.mockResolvedValue([]);
    hub.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { lessons: [], total: 0 } });
    hub.getHubDiscoveryCount.mockResolvedValue(0);
  });

  it("builds saved path summaries in the RPC's authored result order", async () => {
    const supabase = createMockSupabase({
      tables: {},
      rpcs: { search_learning_collections: () => ({ data: [{ collection_id: "b", total: 3 }, { collection_id: "a", total: 3 }], error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(supabase as never);
    collections.getCollectionViews.mockResolvedValue([{ collection: { id: "b" } }, { collection: { id: "a" } }]);
    collections.savedCollectionIds.mockResolvedValue(new Set(["a"]));
    const { searchLearningCollections } = await import("./pronunciation-search");

    await expect(searchLearningCollections("path", "ra%", 4)).resolves.toMatchObject({
      total: 3,
      items: [{ collection: { id: "b" }, saved: false }, { collection: { id: "a" }, saved: true }],
    });
    expect(supabase.rpcCalls).toEqual([{ name: "search_learning_collections", args: { p_kind: "path", p_pattern: "%ra\\%%", p_limit: 4, p_offset: 0 } }]);
    expect(collections.getCollectionViews).toHaveBeenCalledWith("path", { ids: ["b", "a"] });
  });

  it("merges and slices every library match in locale collation order", async () => {
    collections.getShadowingCollections.mockResolvedValue([
      { collection: { id: "c-ramen", title: "Ramen Talk" } },
      { collection: { id: "c-tie", title: "Café" } },
      { collection: { id: "c-zebra", title: "Zebra" } },
    ]);
    taxonomy.listPracticeSituations.mockResolvedValue([{ slug: "restaurant", icon: "🍜" }, { slug: "airport", icon: "✈️" }, { slug: "tie", icon: null }]);
    const { searchLibrary } = await import("./pronunciation-search");

    const result = await searchLibrary("", { restaurant: "Nhà hàng", airport: "Sân bay", tie: "Café" }, "vi", 3);

    expect(result.total).toBe(6);
    expect(result.items.map(({ kind, id }) => `${kind}:${id}`)).toEqual(["collection:c-tie", "situation:tie", "situation:restaurant"]);
  });

  it("matches a library situation by translated label or slug and collections by title", async () => {
    collections.getShadowingCollections.mockResolvedValue([{ collection: { id: "c1", title: "Daily Conversation" } }]);
    taxonomy.listPracticeSituations.mockResolvedValue([{ slug: "restaurant", icon: "🍜" }]);
    const { searchLibrary } = await import("./pronunciation-search");

    await expect(searchLibrary("NHÀ HÀNG", { restaurant: "Nhà hàng" }, "vi", 4)).resolves.toMatchObject({ items: [{ kind: "situation", id: "restaurant" }] });
    await expect(searchLibrary("RESTAURANT", { restaurant: "Khác" }, "en", 4)).resolves.toMatchObject({ items: [{ kind: "situation", id: "restaurant" }] });
    await expect(searchLibrary("conversation", { restaurant: "Khác" }, "en", 4)).resolves.toMatchObject({ items: [{ kind: "collection", id: "c1" }] });
  });

  it("gets filter-aware lesson totals and lightweight counts for every other group", async () => {
    const supabase = createMockSupabase({
      tables: {},
      rpcs: { search_learning_collections: ({ p_kind }) => ({ data: [{ collection_id: `${p_kind}-1`, total: p_kind === "path" ? 2 : 3 }], error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(supabase as never);
    hub.getHubDiscoveryCount.mockResolvedValue(7);
    collections.getShadowingCollections.mockResolvedValue([{ collection: { id: "c1", title: "Ramen" } }]);
    taxonomy.listPracticeSituations.mockResolvedValue([{ slug: "ramen", icon: "🍜" }]);
    const { getSearchCounts } = await import("./pronunciation-search");

    await expect(getSearchCounts("ramen", { filter: "level:n4", duration: "under_10", hideCompleted: true }, { ramen: "Ramen" }, "en")).resolves.toEqual({ lessons: 7, paths: 2, goals: 3, library: 2 });
    expect(hub.getHubDiscoveryCount).toHaveBeenCalledWith({ filter: "level:n4", duration: "under_10", hideCompleted: true, query: "ramen" });
    expect(supabase.rpcCalls).toEqual(expect.arrayContaining([
      { name: "search_learning_collections", args: { p_kind: "path", p_pattern: "%ramen%", p_limit: 1, p_offset: 0 } },
      { name: "search_learning_collections", args: { p_kind: "goal", p_pattern: "%ramen%", p_limit: 1, p_offset: 0 } },
    ]));
  });

  it("loads only the active group's rows while All loads every preview", async () => {
    const supabase = createMockSupabase({
      tables: {},
      rpcs: { search_learning_collections: ({ p_kind, p_limit }) => ({ data: [{ collection_id: `${p_kind}-1`, total: 1, limit: p_limit }], error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(supabase as never);
    collections.getCollectionViews.mockResolvedValue([{ collection: { id: "path-1" } }]);
    collections.savedCollectionIds.mockResolvedValue(new Set());
    const { SEARCH_PREVIEW_LIMIT, getPronunciationSearch } = await import("./pronunciation-search");

    await getPronunciationSearch({ q: "ramen", type: "paths", settings: {}, limit: 48, situationLabels: {}, locale: "en" });
    expect(collections.getCollectionViews).toHaveBeenCalledTimes(1);
    expect(collections.getCollectionViews).toHaveBeenCalledWith("path", { ids: ["path-1"] });
    expect(hub.getHubDiscovery).not.toHaveBeenCalled();
    // Paths is read once, and its rows' total is its count: no second, count-only call.
    expect((supabase.rpcCalls ?? []).filter(({ args }) => args.p_kind === "path")).toEqual([
      { name: "search_learning_collections", args: { p_kind: "path", p_pattern: "%ramen%", p_limit: 48, p_offset: 0 } },
    ]);
    expect(hub.getHubDiscoveryCount).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    hub.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { lessons: [], total: 0 } });
    hub.getHubDiscoveryCount.mockResolvedValue(0);
    collections.getShadowingCollections.mockResolvedValue([]);
    taxonomy.listPracticeSituations.mockResolvedValue([]);
    collections.getCollectionViews.mockResolvedValue([]);
    collections.savedCollectionIds.mockResolvedValue(new Set());
    await getPronunciationSearch({ q: "ramen", type: null, settings: {}, limit: 48, situationLabels: {}, locale: "en" });
    expect(hub.getHubDiscovery).toHaveBeenCalledWith(expect.objectContaining({ limit: SEARCH_PREVIEW_LIMIT, withTotal: true }));
    expect(supabase.rpcCalls).toEqual(expect.arrayContaining([
      { name: "search_learning_collections", args: { p_kind: "path", p_pattern: "%ramen%", p_limit: SEARCH_PREVIEW_LIMIT, p_offset: 0 } },
      { name: "search_learning_collections", args: { p_kind: "goal", p_pattern: "%ramen%", p_limit: SEARCH_PREVIEW_LIMIT, p_offset: 0 } },
    ]));
  });

  it("reports each shown group's own total as its count, and never counts it twice", async () => {
    const supabase = createMockSupabase({
      tables: {},
      rpcs: { search_learning_collections: ({ p_kind }) => ({ data: [{ collection_id: `${p_kind}-1`, total: p_kind === "path" ? 5 : 6 }], error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(supabase as never);
    hub.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { lessons: [], total: 9 } });
    collections.getCollectionViews.mockResolvedValue([]);
    collections.savedCollectionIds.mockResolvedValue(new Set());
    collections.getShadowingCollections.mockResolvedValue([{ collection: { id: "c1", title: "Ramen" } }, { collection: { id: "c2", title: "Ramen bar" } }]);
    const { getPronunciationSearch } = await import("./pronunciation-search");

    const all = await getPronunciationSearch({ q: "ramen", type: null, settings: {}, limit: 48, situationLabels: {}, locale: "en" });

    expect(all.counts).toEqual({ lessons: 9, paths: 5, goals: 6, library: 2 });
    expect(all.library?.total).toBe(2);
    expect(hub.getHubDiscoveryCount).not.toHaveBeenCalled();
    expect(supabase.rpcCalls).toHaveLength(2);
    expect(collections.getShadowingCollections).toHaveBeenCalledTimes(1);
  });

  it("drops * in the library as containsPattern drops it on every other tab", async () => {
    collections.getShadowingCollections.mockResolvedValue([{ collection: { id: "c1", title: "Ramen" } }]);
    const { searchLibrary } = await import("./pronunciation-search");

    await expect(searchLibrary("ra*men", {}, "en", 4)).resolves.toMatchObject({ total: 1 });
  });
});
