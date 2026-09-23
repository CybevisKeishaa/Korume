import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportMyData } from "@/lib/data/user-export";
import { GET } from "./route";

vi.mock("@/lib/data/user-export", () => ({ exportMyData: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("GET /api/user/export", () => {
  it("answers 401 for an anonymous caller", async () => {
    vi.mocked(exportMyData).mockResolvedValue({ ok: false, status: 401 });
    expect((await GET()).status).toBe(401);
  });

  it("answers 429 with Retry-After in seconds", async () => {
    vi.mocked(exportMyData).mockResolvedValue({ ok: false, status: 429, retryAfter: 90_000 });
    const response = await GET();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
  });

  it("returns the export as a dated JSON attachment", async () => {
    vi.mocked(exportMyData).mockResolvedValue({
      ok: true,
      data: { exportedAt: "2026-09-23T10:00:00.000Z", userId: "u1", tables: { user_preferences: [{}] } },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="korume-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    await expect(response.json()).resolves.toMatchObject({ userId: "u1" });
  });

  it("turns a thrown error into an opaque 500 that leaks neither message nor stack", async () => {
    vi.mocked(exportMyData).mockRejectedValue(new Error("connection string user:hunter2@db"));

    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("connection string");
    expect(body).toContain("Something went wrong");
  });
});
