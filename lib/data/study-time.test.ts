import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { heartbeat, type HeartbeatInput } from "./study-time";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
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
