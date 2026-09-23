import { beforeEach, describe, expect, it, vi } from "vitest";
import { eraseMyMemory } from "@/lib/data/memory-erase";
import { POST } from "./route";

vi.mock("@/lib/data/memory-erase", () => ({ eraseMyMemory: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/user/memory-erase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/user/memory-erase", () => {
  it.each([
    ["an empty body", {}],
    ["the untranslated word the user typed", { confirm: "erase" }],
    ["a localised confirmation", { confirm: "XOA" }],
  ])("answers 400 for %s, and erases nothing", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(eraseMyMemory).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON at all", async () => {
    const response = await POST(
      new Request("http://localhost/api/user/memory-erase", { method: "POST", body: "{" }),
    );

    expect(response.status).toBe(400);
    expect(eraseMyMemory).not.toHaveBeenCalled();
  });

  it("answers 401 for an anonymous caller", async () => {
    vi.mocked(eraseMyMemory).mockResolvedValue({ ok: false, status: 401 });
    expect((await post({ confirm: "ERASE" })).status).toBe(401);
  });

  it("answers 429 with Retry-After in seconds", async () => {
    vi.mocked(eraseMyMemory).mockResolvedValue({ ok: false, status: 429, retryAfter: 90_000 });

    const response = await post({ confirm: "ERASE" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
  });

  it("answers 200 once the memory is erased", async () => {
    vi.mocked(eraseMyMemory).mockResolvedValue({ ok: true, data: { erased: true } });

    const response = await post({ confirm: "ERASE" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { erased: true } });
  });

  it("turns a thrown error into an opaque 500 that leaks neither message nor stack", async () => {
    vi.mocked(eraseMyMemory).mockRejectedValue(new Error("connection string user:hunter2@db"));

    const response = await post({ confirm: "ERASE" });
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("connection string");
    expect(body).toContain("Something went wrong");
  });
});
