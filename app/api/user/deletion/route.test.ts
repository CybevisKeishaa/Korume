import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";
import { cancelDeletion, getPendingDeletion, requestDeletion } from "@/lib/data/account-deletion";

vi.mock("@/lib/data/account-deletion", () => ({
  requestDeletion: vi.fn(),
  cancelDeletion: vi.fn(),
  getPendingDeletion: vi.fn(),
}));

const post = (body: unknown) =>
  new Request("http://localhost/api/user/deletion", { method: "POST", body: JSON.stringify(body) });

const postRaw = (body: string) =>
  new Request("http://localhost/api/user/deletion", { method: "POST", body });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/user/deletion", () => {
  it("rejects a body whose confirmation text is wrong, without calling the data layer", async () => {
    const res = await POST(post({ tier: "erase_all", confirmation: "delete", acknowledged: true }));
    expect(res.status).toBe(400);
    expect(requestDeletion).not.toHaveBeenCalled();
  });

  it("rejects an unacknowledged request", async () => {
    const res = await POST(post({ tier: "erase_all", confirmation: "DELETE", acknowledged: false }));
    expect(res.status).toBe(400);
    expect(requestDeletion).not.toHaveBeenCalled();
  });

  it("rejects a body that is not valid JSON at all, without calling the data layer", async () => {
    const res = await POST(postRaw("not json{"));
    expect(res.status).toBe(400);
    expect(requestDeletion).not.toHaveBeenCalled();
  });

  it("rejects an unknown tier, without calling the data layer", async () => {
    const res = await POST(post({ tier: "wipe_everything", confirmation: "DELETE", acknowledged: true }));
    expect(res.status).toBe(400);
    expect(requestDeletion).not.toHaveBeenCalled();
  });

  it("returns 409 when a request is already live", async () => {
    vi.mocked(requestDeletion).mockResolvedValue({ ok: false, status: 409 });
    const res = await POST(post({ tier: "erase_all", confirmation: "DELETE", acknowledged: true }));
    expect(res.status).toBe(409);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requestDeletion).mockResolvedValue({ ok: false, status: 401 });
    const res = await POST(post({ tier: "erase_all", confirmation: "DELETE", acknowledged: true }));
    expect(res.status).toBe(401);
  });

  it("passes a valid body through and echoes the schedule", async () => {
    vi.mocked(requestDeletion).mockResolvedValue({
      ok: true,
      data: { id: "req1", tier: "erase_all", requestedAt: "2026-08-20T10:00:00.000Z", executeAfter: "2026-08-27T10:00:00.000Z" },
    });
    const res = await POST(post({ tier: "erase_all", confirmation: "DELETE", acknowledged: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { executeAfter: "2026-08-27T10:00:00.000Z" } });
  });

  it("sets Retry-After on 429", async () => {
    vi.mocked(requestDeletion).mockResolvedValue({ ok: false, status: 429, retryAfter: 30_000 });
    const res = await POST(post({ tier: "erase_all", confirmation: "DELETE", acknowledged: true }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("turns a thrown data-layer error into an opaque 500 and never leaks its message", async () => {
    vi.mocked(requestDeletion).mockRejectedValue(new Error("relation account_deletion_requests: connection refused at 10.0.0.4"));
    const res = await POST(post({ tier: "erase_all", confirmation: "DELETE", acknowledged: true }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain("connection refused");
    expect(JSON.stringify(json)).not.toContain("10.0.0.4");
  });
});

describe("DELETE /api/user/deletion", () => {
  it("returns 404 when nothing is pending", async () => {
    vi.mocked(cancelDeletion).mockResolvedValue({ ok: false, status: 404 });
    expect((await DELETE()).status).toBe(404);
  });

  it("returns 200 with cancelled:true on success", async () => {
    vi.mocked(cancelDeletion).mockResolvedValue({ ok: true });
    const res = await DELETE();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { cancelled: true } });
  });

  it("sets Retry-After on 429", async () => {
    vi.mocked(cancelDeletion).mockResolvedValue({ ok: false, status: 429, retryAfter: 15_000 });
    const res = await DELETE();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("15");
  });

  it("turns a thrown data-layer error into an opaque 500 and never leaks its message", async () => {
    vi.mocked(cancelDeletion).mockRejectedValue(new Error("duplicate key value violates unique constraint deletion_pkey"));
    const res = await DELETE();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain("duplicate key");
  });
});

describe("GET /api/user/deletion", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getPendingDeletion).mockResolvedValue({ ok: false, status: 401 });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns null data when nothing is pending", async () => {
    vi.mocked(getPendingDeletion).mockResolvedValue({ ok: true, data: null });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: null });
  });

  it("returns the caller's own pending request", async () => {
    const pending = { id: "req1", tier: "erase_all" as const, requestedAt: "2026-08-20T10:00:00.000Z", executeAfter: "2026-08-27T10:00:00.000Z" };
    vi.mocked(getPendingDeletion).mockResolvedValue({ ok: true, data: pending });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: pending });
  });

  it("turns a thrown data-layer error into an opaque 500 and never leaks its message", async () => {
    vi.mocked(getPendingDeletion).mockRejectedValue(new Error("permission denied for table account_deletion_requests"));
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain("permission denied");
  });
});
