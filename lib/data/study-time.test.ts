import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { getStudyTime, getTrackedSince, heartbeat, type HeartbeatInput } from "./study-time";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/time/study-timezone", () => ({ getStudyTimezone: vi.fn() }));

const INPUT: HeartbeatInput = {
  clientPresenceId: "11111111-1111-4111-8111-111111111111",
  sessionId: null,
  surface: "shadowing",
  contextId: "123e4567-e89b-12d3-a456-426614174000",
  seq: 0,
  kind: "start",
};

function mount(user: { id: string } | null, rpcResult: { data: unknown; error: unknown } = { data: [], error: null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  vi.mocked(createClient).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
  } as unknown as ReturnType<typeof createClient>);
  return rpc;
}

function mountStudyRows(rows: { day: string; seconds: number }[], error: unknown = null) {
  const rpc = mount({ id: "u1" });
  const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error }));
  const order = vi.fn(() => ({ range }));
  rpc.mockReturnValue({ order });
  return { rpc, range, order };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(getStudyTimezone).mockResolvedValue({ timeZone: "Asia/Ho_Chi_Minh", needsDetection: false });
});

describe("study-time reads", () => {
  it("pages more than 1000 study days before summing lifetime time", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      day: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10), seconds: 60,
    }));
    const { rpc, range, order } = mountStudyRows(rows);
    const result = await getStudyTime(new Date("2020-01-01Z"), new Date("2023-01-01Z"));
    expect(result.totalSeconds).toBe(60060);
    expect(result.days).toHaveLength(1001);
    expect(order).toHaveBeenCalledWith("day", { ascending: true });
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("passes the study zone and ISO bounds, and sums returned daily seconds", async () => {
    const { rpc } = mountStudyRows([
      { day: "2026-10-01", seconds: 600 },
      { day: "2026-10-02", seconds: 1200 },
    ]);
    const from = new Date("2026-10-01T16:00:00.000Z");
    const to = new Date("2026-10-02T16:00:00.000Z");
    expect(await getStudyTime(from, to)).toEqual({ totalSeconds: 1800, days: [
      { day: "2026-10-01", seconds: 600 },
      { day: "2026-10-02", seconds: 1200 },
    ] });
    expect(rpc).toHaveBeenCalledWith("study_time", {
      p_tz: "Asia/Ho_Chi_Minh", p_from: from.toISOString(), p_to: to.toISOString(),
    });
  });

  it("returns an empty total when no sessions exist", async () => {
    mountStudyRows([]);
    expect(await getStudyTime(new Date("2026-10-01Z"), new Date("2026-10-02Z"))).toEqual({ totalSeconds: 0, days: [] });
  });

  it("returns trackedSince or null from the RPC", async () => {
    const rpc = mount({ id: "u1" }, { data: "2026-09-01T10:00:00+00:00", error: null });
    expect(await getTrackedSince()).toBe("2026-09-01T10:00:00.000Z");
    expect(rpc).toHaveBeenCalledWith("study_tracked_since");
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await getTrackedSince()).toBeNull();
  });

  it("propagates trackedSince RPC errors", async () => {
    mount({ id: "u1" }, { data: null, error: { code: "XX000", message: "tracked since failed" } });
    await expect(getTrackedSince()).rejects.toMatchObject({ code: "XX000" });
  });

  it("propagates study-time RPC errors", async () => {
    mountStudyRows([], { code: "XX000", message: "boom" });
    await expect(getStudyTime(new Date("2026-10-01Z"), new Date("2026-10-02Z"))).rejects.toMatchObject({ code: "XX000" });
  });
});

describe("heartbeat", () => {
  it("is unauthorized without a user and never calls the RPC", async () => {
    const rpc = mount(null);
    expect(await heartbeat(INPUT)).toEqual({ kind: "unauthorized" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports rate limiting before the RPC", async () => {
    const rpc = mount({ id: "u1" });
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 4000 });
    expect(await heartbeat(INPUT)).toEqual({ kind: "rate_limited", retryAfter: 4000 });
    expect(rpc).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith("study:heartbeat:u1", { limit: 12, windowMs: 60_000 }, expect.any(Number));
  });

  it("maps P0002 to not_found", async () => {
    mount({ id: "u1" }, { data: null, error: { code: "P0002", message: "unknown session" } });
    expect(await heartbeat({ ...INPUT, kind: "beat", sessionId: INPUT.clientPresenceId, seq: 1 })).toEqual({
      kind: "not_found",
    });
  });

  it("rethrows other RPC errors", async () => {
    mount({ id: "u1" }, { data: null, error: { code: "XX000", message: "boom" } });
    await expect(heartbeat(INPUT)).rejects.toMatchObject({ code: "XX000" });
  });

  it("maps the row and sends the exact arguments (null session on start)", async () => {
    const rpc = mount({ id: "u1" }, { data: [{ session_id: "s1", accepted_seq: 0, segmented: false }], error: null });
    expect(await heartbeat(INPUT)).toEqual({ kind: "ok", sessionId: "s1", acceptedSeq: 0, segmented: false });
    expect(rpc).toHaveBeenCalledWith("study_heartbeat", {
      p_client_presence: INPUT.clientPresenceId,
      p_session: null,
      p_surface: "shadowing",
      p_context: INPUT.contextId,
      p_seq: 0,
      p_kind: "start",
    });
  });

  it("throws when the RPC returns no row", async () => {
    mount({ id: "u1" }, { data: [], error: null });
    await expect(heartbeat(INPUT)).rejects.toThrow("no row");
  });
});
