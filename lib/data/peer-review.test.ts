import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import {
  createReview,
  createShare,
  deleteShare,
  getShareAudioUrl,
  listMine,
  listQueue,
} from "./peer-review";

const USER = { id: "u1" };
const OTHER = { id: "u2" };
const SESSION_ID = "c0000000-0000-0000-0000-000000000001";
const SHARE_ID = "c0000000-0000-0000-0000-000000000002";
const LINE_ID = "c0000000-0000-0000-0000-000000000003";

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(
  tables: Parameters<typeof createMockSupabase>[0]["tables"],
  storage?: Parameters<typeof createMockSupabase>[0]["storage"],
) {
  const supabase = createMockSupabase({ tables, storage });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

describe("createShare", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    expect(await createShare({ sessionId: SESSION_ID })).toEqual({ ok: false, status: 401 });
  });

  it("returns 404 when the session doesn't exist or isn't owned by the caller", async () => {
    mockClient({ shadowing_sessions: () => ({ data: null, error: null }) });
    expect(await createShare({ sessionId: SESSION_ID })).toEqual({ ok: false, status: 404 });
  });

  it("returns 400 when the session has no recording or no linked line", async () => {
    mockClient({ shadowing_sessions: () => ({ data: { id: SESSION_ID, recording_url: null, transcript_line_id: LINE_ID }, error: null }) });
    expect(await createShare({ sessionId: SESSION_ID })).toEqual({ ok: false, status: 400 });
  });

  it("denormalizes line_text from the transcript line and sanitizes the note", async () => {
    let insertedRow: unknown;
    mockClient({
      shadowing_sessions: () => ({ data: { id: SESSION_ID, recording_url: "u1/shadowing/x.webm", transcript_line_id: LINE_ID }, error: null }),
      transcript_lines: () => ({ data: { text_jp: "こんにちは" }, error: null }),
      peer_review_shares: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedRow = insertCall?.values;
        return { data: { id: SHARE_ID, created_at: "2026-01-01T00:00:00.000Z" }, error: null };
      },
    });

    const result = await createShare({ sessionId: SESSION_ID, note: "<b>good</b>" });
    expect(result).toEqual({ ok: true, data: { id: SHARE_ID, createdAt: "2026-01-01T00:00:00.000Z" } });
    const row = insertedRow as Record<string, unknown>;
    expect(row.line_text).toBe("こんにちは");
    expect(row.note).toBe("good");
    expect(row.user_id).toBe(USER.id);
    expect(row.session_id).toBe(SESSION_ID);
  });

  it("maps a duplicate share (unique session_id) to 409", async () => {
    mockClient({
      shadowing_sessions: () => ({ data: { id: SESSION_ID, recording_url: "u1/x.webm", transcript_line_id: LINE_ID }, error: null }),
      transcript_lines: () => ({ data: { text_jp: "line" }, error: null }),
      peer_review_shares: () => ({ data: null, error: { message: "dup", code: "23505" } }),
    });
    const result = await createShare({ sessionId: SESSION_ID });
    expect(result).toEqual({ ok: false, status: 409 });
  });
});

describe("deleteShare", () => {
  it("returns 404 when not owned", async () => {
    mockClient({ peer_review_shares: () => ({ data: null, error: null }) });
    expect(await deleteShare(SHARE_ID)).toEqual({ ok: false, status: 404 });
  });

  it("deletes the caller's own share", async () => {
    mockClient({ peer_review_shares: () => ({ data: { id: SHARE_ID }, error: null }) });
    expect(await deleteShare(SHARE_ID)).toEqual({ ok: true });
  });
});

describe("listQueue", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    expect(await listQueue({ limit: 20 })).toEqual({ ok: false, status: 401 });
  });

  it("excludes the caller's own shares and includes review stats + author", async () => {
    mockClient({
      peer_review_shares: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "neq" && c.column === "user_id" && c.value === USER.id)).toBe(true);
        return {
          data: [{ id: SHARE_ID, session_id: SESSION_ID, user_id: OTHER.id, line_text: "line", note: null, created_at: "2026-01-01T00:00:00.000Z" }],
          error: null,
        };
      },
      peer_reviews: () => ({ data: [{ share_id: SHARE_ID, reviewer_id: USER.id }], error: null }),
    });
    mockService({ users: () => ({ data: [{ id: OTHER.id, name: "Bob", avatar_url: null }], error: null }) });

    const result = await listQueue({ limit: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.shares[0]).toEqual({
      id: SHARE_ID,
      sessionId: SESSION_ID,
      lineText: "line",
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      sharedBy: { id: OTHER.id, name: "Bob", avatarUrl: null },
      reviewCount: 1,
      alreadyReviewed: true,
    });
    expect(result.data.nextCursor).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("getShareAudioUrl", () => {
  it("returns 404 when no share exists for that id", async () => {
    mockClient({ peer_review_shares: () => ({ data: null, error: null }) });
    expect(await getShareAudioUrl(SHARE_ID)).toEqual({ ok: false, status: 404 });
  });

  it("returns 404 when the session has no recording", async () => {
    mockClient({ peer_review_shares: () => ({ data: { id: SHARE_ID, session_id: SESSION_ID }, error: null }) });
    mockService({ shadowing_sessions: () => ({ data: { recording_url: null }, error: null }) });
    expect(await getShareAudioUrl(SHARE_ID)).toEqual({ ok: false, status: 404 });
  });

  it("mints a short-lived signed URL via the service-role storage client", async () => {
    mockClient({ peer_review_shares: () => ({ data: { id: SHARE_ID, session_id: SESSION_ID }, error: null }) });
    mockService(
      { shadowing_sessions: () => ({ data: { recording_url: "u2/shadowing/y.webm" }, error: null }) },
      { recordings: (path, ttl) => ({ data: { signedUrl: `https://signed/${path}?ttl=${ttl}` }, error: null }) },
    );

    const result = await getShareAudioUrl(SHARE_ID);
    expect(result).toEqual({
      ok: true,
      data: { signedUrl: "https://signed/u2/shadowing/y.webm?ttl=300", expiresInSeconds: 300 },
    });
  });
});

describe("createReview", () => {
  it("returns 404 when the share doesn't exist", async () => {
    mockClient({ peer_review_shares: () => ({ data: null, error: null }) });
    expect(await createReview(SHARE_ID, { rating: 5, comment: "great" })).toEqual({ ok: false, status: 404 });
  });

  it("rejects self-review with 403", async () => {
    mockClient({ peer_review_shares: () => ({ data: { id: SHARE_ID, user_id: USER.id }, error: null }) });
    expect(await createReview(SHARE_ID, { rating: 5, comment: "great" })).toEqual({ ok: false, status: 403 });
  });

  it("sanitizes the comment and inserts, keyed to the reviewer", async () => {
    let insertedRow: unknown;
    mockClient({
      peer_review_shares: () => ({ data: { id: SHARE_ID, user_id: OTHER.id }, error: null }),
      peer_reviews: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedRow = insertCall?.values;
        return { data: { id: "r1", created_at: "2026-01-01T00:00:00.000Z" }, error: null };
      },
    });
    const result = await createReview(SHARE_ID, { rating: 4, comment: "<b>nice</b>" });
    expect(result).toEqual({ ok: true, data: { id: "r1", createdAt: "2026-01-01T00:00:00.000Z" } });
    expect((insertedRow as Record<string, unknown>).comment).toBe("nice");
    expect((insertedRow as Record<string, unknown>).reviewer_id).toBe(USER.id);
    expect((insertedRow as Record<string, unknown>).rating).toBe(4);
  });

  it("maps a duplicate review (unique share_id/reviewer_id) to 409", async () => {
    mockClient({
      peer_review_shares: () => ({ data: { id: SHARE_ID, user_id: OTHER.id }, error: null }),
      peer_reviews: () => ({ data: null, error: { message: "dup", code: "23505" } }),
    });
    const result = await createReview(SHARE_ID, { rating: 3, comment: "ok" });
    expect(result).toEqual({ ok: false, status: 409 });
  });
});

describe("listMine", () => {
  it("returns the caller's shares with their received reviews", async () => {
    mockClient({
      peer_review_shares: () => ({
        data: [{ id: SHARE_ID, session_id: SESSION_ID, user_id: USER.id, line_text: "line", note: null, created_at: "2026-01-01T00:00:00.000Z" }],
        error: null,
      }),
      peer_reviews: () => ({
        data: [{ id: "r1", share_id: SHARE_ID, reviewer_id: OTHER.id, rating: 5, comment: "nice", created_at: "2026-01-01T01:00:00.000Z" }],
        error: null,
      }),
    });
    mockService({ users: () => ({ data: [{ id: OTHER.id, name: "Bob", avatar_url: null }], error: null }) });

    const result = await listMine();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.reviews).toEqual([
      { id: "r1", rating: 5, comment: "nice", createdAt: "2026-01-01T01:00:00.000Z", reviewer: { id: OTHER.id, name: "Bob", avatarUrl: null } },
    ]);
  });
});
