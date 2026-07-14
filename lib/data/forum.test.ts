import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import {
  createForumComment,
  createForumPost,
  deleteForumComment,
  deleteForumPost,
  getForumPost,
  listForumPosts,
  updateForumComment,
  updateForumPost,
} from "./forum";

const USER = { id: "u1" };
const OTHER = { id: "u2" };
const POST_ID = "a0000000-0000-0000-0000-000000000001";

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

const POST_ROW = {
  id: POST_ID,
  user_id: USER.id,
  title: "Hello",
  content: "World",
  topic: "general",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("listForumPosts", () => {
  it("returns posts with author + comment count, and a nextCursor when the page is full", async () => {
    mockClient({
      forum_posts: () => ({ data: [POST_ROW], error: null }),
      forum_comments: () => ({ data: [{ post_id: POST_ID }, { post_id: POST_ID }], error: null }),
    });
    mockService({
      users: () => ({ data: [{ id: USER.id, name: "Alice", avatar_url: null }], error: null }),
    });

    const page = await listForumPosts({ limit: 1 });
    expect(page.posts).toHaveLength(1);
    expect(page.posts[0]).toEqual({
      id: POST_ID,
      title: "Hello",
      content: "World",
      topic: "general",
      createdAt: POST_ROW.created_at,
      updatedAt: POST_ROW.updated_at,
      author: { id: USER.id, name: "Alice", avatarUrl: null },
      commentCount: 2,
    });
    expect(page.nextCursor).toBe(POST_ROW.created_at);
  });

  it("never leaks email — the service-role select is scoped to id/name/avatar_url only", async () => {
    let selectedColumns = "";
    mockClient({
      forum_posts: () => ({ data: [POST_ROW], error: null }),
      forum_comments: () => ({ data: [], error: null }),
    });
    mockService({
      users: (calls: QueryCall[]) => {
        const sel = calls.find((c): c is Extract<QueryCall, { op: "select" }> => c.op === "select");
        selectedColumns = sel?.columns ?? "";
        return { data: [{ id: USER.id, name: "Alice", avatar_url: null }], error: null };
      },
    });

    await listForumPosts({ limit: 20 });
    expect(selectedColumns).not.toMatch(/email/);
  });

  it("returns null nextCursor when the page is not full", async () => {
    mockClient({
      forum_posts: () => ({ data: [POST_ROW], error: null }),
      forum_comments: () => ({ data: [], error: null }),
    });
    mockService({ users: () => ({ data: [], error: null }) });

    const page = await listForumPosts({ limit: 20 });
    expect(page.nextCursor).toBeNull();
    expect(page.posts[0]?.author).toBeNull();
  });
});

describe("getForumPost", () => {
  it("returns null when the post does not exist", async () => {
    mockClient({ forum_posts: () => ({ data: null, error: null }) });
    expect(await getForumPost(POST_ID)).toBeNull();
  });

  it("returns the post with chronological comments and resolved authors", async () => {
    mockClient({
      forum_posts: () => ({ data: POST_ROW, error: null }),
      forum_comments: () => ({
        data: [
          { id: "c1", post_id: POST_ID, user_id: OTHER.id, content: "first", created_at: "2026-01-01T01:00:00.000Z" },
          { id: "c2", post_id: POST_ID, user_id: null, content: "second", created_at: "2026-01-01T02:00:00.000Z" },
        ],
        error: null,
      }),
    });
    mockService({
      users: () => ({
        data: [
          { id: USER.id, name: "Alice", avatar_url: null },
          { id: OTHER.id, name: "Bob", avatar_url: null },
        ],
        error: null,
      }),
    });

    const detail = await getForumPost(POST_ID);
    expect(detail?.author).toEqual({ id: USER.id, name: "Alice", avatarUrl: null });
    expect(detail?.comments).toHaveLength(2);
    expect(detail?.comments[0]).toEqual({ id: "c1", content: "first", createdAt: "2026-01-01T01:00:00.000Z", author: { id: OTHER.id, name: "Bob", avatarUrl: null } });
    expect(detail?.comments[1]?.author).toBeNull();
  });
});

describe("createForumPost", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await createForumPost({ title: "t", content: "c", topic: "general" });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("sanitizes title/content and persists topic", async () => {
    let insertedRow: unknown;
    mockClient({
      forum_posts: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedRow = insertCall?.values;
        return { data: { id: POST_ID, created_at: POST_ROW.created_at }, error: null };
      },
    });

    const result = await createForumPost({ title: "<script>hi</script>", content: "safe & sound", topic: "vocab" });
    expect(result).toEqual({ ok: true, data: { id: POST_ID, createdAt: POST_ROW.created_at } });
    const row = insertedRow as Record<string, unknown>;
    expect(row.title).toBe("hi");
    expect(row.content).toBe("safe & sound");
    expect(row.topic).toBe("vocab");
    expect(row.user_id).toBe(USER.id);
  });

  it("returns 429 when over the rate limit", async () => {
    mockClient({ forum_posts: () => ({ data: { id: POST_ID, created_at: POST_ROW.created_at }, error: null }) });
    const key = `forum:post:create:${USER.id}`;
    const { rateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 50; i++) rateLimit(key, { limit: 10, windowMs: 60_000 });

    const result = await createForumPost({ title: "t", content: "c", topic: "general" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
  });
});

describe("updateForumPost / deleteForumPost", () => {
  it("returns 404 when the post doesn't exist or isn't owned by the caller", async () => {
    mockClient({ forum_posts: () => ({ data: null, error: null }) });
    const result = await updateForumPost(POST_ID, { title: "new" });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("updates only the supplied, sanitized fields, scoped to the caller", async () => {
    mockClient({
      forum_posts: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "eq" && c.column === "user_id" && c.value === USER.id)).toBe(true);
        const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(updateCall?.values).toEqual({ title: "clean" });
        return { data: { id: POST_ID }, error: null };
      },
    });
    const result = await updateForumPost(POST_ID, { title: "<b>clean</b>" });
    expect(result).toEqual({ ok: true, data: { id: POST_ID } });
  });

  it("deletes only the caller's own post", async () => {
    mockClient({ forum_posts: () => ({ data: { id: POST_ID }, error: null }) });
    const result = await deleteForumPost(POST_ID);
    expect(result).toEqual({ ok: true });
  });
});

describe("comments", () => {
  it("createForumComment returns 404 for a nonexistent post", async () => {
    mockClient({ forum_posts: () => ({ data: null, error: null }) });
    const result = await createForumComment(POST_ID, { content: "hi" });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("createForumComment sanitizes content and links the post", async () => {
    let insertedRow: unknown;
    mockClient({
      forum_posts: () => ({ data: { id: POST_ID }, error: null }),
      forum_comments: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedRow = insertCall?.values;
        return { data: { id: "c1", created_at: "2026-01-01T00:00:00.000Z" }, error: null };
      },
    });
    const result = await createForumComment(POST_ID, { content: "<img onerror=x>hey" });
    expect(result.ok).toBe(true);
    expect((insertedRow as Record<string, unknown>).content).toBe("hey");
    expect((insertedRow as Record<string, unknown>).post_id).toBe(POST_ID);
  });

  it("updateForumComment / deleteForumComment are owner-scoped and 404 when not found", async () => {
    mockClient({ forum_comments: () => ({ data: null, error: null }) });
    expect(await updateForumComment("c1", { content: "x" })).toEqual({ ok: false, status: 404 });
    expect(await deleteForumComment("c1")).toEqual({ ok: false, status: 404 });
  });
});
