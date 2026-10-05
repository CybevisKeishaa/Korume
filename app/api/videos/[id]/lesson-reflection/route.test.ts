import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestLessonReflection } from "@/lib/summary/reflection/service";
import { GET, POST } from "./route";

vi.mock("@/lib/summary/reflection/service", () => ({ requestLessonReflection: vi.fn() }));

const VIDEO = "c0000000-0000-4000-8000-000000000001";
const ctx = (id = VIDEO) => ({ params: { id } });
const get = (query: string, id = VIDEO) => GET(new Request(`http://localhost/api/videos/${id}/lesson-reflection${query}`), ctx(id));
const post = (body: unknown, id = VIDEO) => POST(new Request(`http://localhost/api/videos/${id}/lesson-reflection`, {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
}), ctx(id));
const REFLECTION = { text: "Well done.", highlight: null, generatedAt: "2026-10-04T09:00:00.000Z" };

beforeEach(() => vi.clearAllMocks());

describe("/api/videos/[id]/lesson-reflection", () => {
  it("GET reads and POST generates, with the locale of the request", async () => {
    vi.mocked(requestLessonReflection).mockResolvedValue({ kind: "ok", body: { state: "ready", reflection: REFLECTION } });
    const read = await get("?locale=en");
    expect(read.status).toBe(200);
    expect(read.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(read.json()).resolves.toEqual({ state: "ready", reflection: REFLECTION });
    await post({ locale: "vi" });
    expect(vi.mocked(requestLessonReflection).mock.calls).toEqual([[VIDEO, "en", "read"], [VIDEO, "vi", "generate"]]);
  });

  it("rejects a bad id, a bad locale, an extra field and malformed JSON without calling the service", async () => {
    expect((await get("?locale=en", "nope")).status).toBe(400);
    expect((await get("?locale=de")).status).toBe(400);
    expect((await post({ locale: "en", evidence: {} })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    expect(requestLessonReflection).not.toHaveBeenCalled();
  });

  it.each([
    [{ state: "ready", reflection: REFLECTION }, 200, null],
    [{ state: "stale", stale: true, reflection: REFLECTION }, 200, null],
    [{ state: "fallback", reason: "no_evidence" }, 200, null],
    [{ state: "fallback", reason: "backoff", retryAfter: "2026-10-04T09:05:00.000Z" }, 200, null],
    [{ state: "not_found" }, 200, null],
    [{ state: "pending", retryAfterMs: 1500, reflection: null }, 202, "2"],
  ] as const)("maps %j", async (body, status, retryAfter) => {
    vi.mocked(requestLessonReflection).mockResolvedValue({ kind: "ok", body });
    const response = await get("?locale=en");
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe(retryAfter);
    await expect(response.json()).resolves.toEqual(body);
  });

  it.each([
    [{ kind: "unauthorized" }, 401, null],
    [{ kind: "not_found" }, 404, null],
    [{ kind: "rate_limited", retryAfter: 2500 }, 429, "3"],
  ] as const)("maps refusal %j", async (result, status, retryAfter) => {
    vi.mocked(requestLessonReflection).mockResolvedValue(result);
    const response = await post({ locale: "en" });
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe(retryAfter);
    expect(await response.json()).toHaveProperty("error");
  });

  it("hides a thrown error behind an opaque 500", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(requestLessonReflection).mockRejectedValue(new Error("secret"));
    const response = await post({ locale: "en" });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    error.mockRestore();
  });
});
