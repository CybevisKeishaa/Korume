import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";
import { getMyPreferences, updateMyPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

vi.mock("@/lib/data/preferences", () => ({
  getMyPreferences: vi.fn(),
  updateMyPreferences: vi.fn(),
}));

const patch = (body: unknown) =>
  new Request("http://localhost/api/user/preferences", { method: "PATCH", body: JSON.stringify(body) });

const patchRaw = (body: string) =>
  new Request("http://localhost/api/user/preferences", { method: "PATCH", body });

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/user/preferences", () => {
  it("rejects invalid JSON without calling the data layer", async () => {
    const response = await PATCH(patchRaw("not json{"));
    expect(response.status).toBe(400);
    expect(updateMyPreferences).not.toHaveBeenCalled();
  });

  it("rejects schema failures, including mixed controls, without calling the data layer", async () => {
    for (const body of [{ theme: "light" }, { dailyMinutes: 20, reduceMotion: true }]) {
      const response = await PATCH(patch(body));
      expect(response.status).toBe(400);
    }
    expect(updateMyPreferences).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(updateMyPreferences).mockResolvedValue({ ok: false, status: 401 });
    expect((await PATCH(patch({ reduceMotion: true }))).status).toBe(401);
  });

  it("sets Retry-After on 429", async () => {
    vi.mocked(updateMyPreferences).mockResolvedValue({ ok: false, status: 429, retryAfter: 30_000 });
    const response = await PATCH(patch({ reduceMotion: true }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("echoes the full preferences after a successful update", async () => {
    vi.mocked(updateMyPreferences).mockResolvedValue({ ok: true, data: DEFAULT_PREFERENCES });
    const response = await PATCH(patch({ reduceMotion: true }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: DEFAULT_PREFERENCES });
  });

  it("turns thrown errors into opaque 500 responses", async () => {
    vi.mocked(updateMyPreferences).mockRejectedValue(new Error("permission denied for user_preferences"));
    const response = await PATCH(patch({ reduceMotion: true }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("permission denied");
  });
});

describe("GET /api/user/preferences", () => {
  it("returns 401 when signed out", async () => {
    vi.mocked(getMyPreferences).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the caller preferences", async () => {
    vi.mocked(getMyPreferences).mockResolvedValue(DEFAULT_PREFERENCES);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: DEFAULT_PREFERENCES });
  });

  it("turns thrown errors into opaque 500 responses", async () => {
    vi.mocked(getMyPreferences).mockRejectedValue(new Error("secret database stack"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret database stack");
  });
});
