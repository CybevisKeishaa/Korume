import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestLessonAnalysis } from "@/lib/summary/analysis/service";
import { GET, POST } from "./route";

vi.mock("@/lib/summary/analysis/service", () => ({ requestLessonAnalysis: vi.fn() }));

const VIDEO = "c0000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-04T09:00:00Z");
const ctx = (id = VIDEO) => ({ params: { id } });
const get = (query: string, id = VIDEO) => GET(new Request(`http://localhost/api/videos/${id}/lesson-analysis${query}`), ctx(id));
const post = (body: unknown, id = VIDEO) => POST(new Request(`http://localhost/api/videos/${id}/lesson-analysis`, {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
}), ctx(id));
const VIEW = { overview: "o", words: [], expressions: [], grammar: [], culture: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

describe("/api/videos/[id]/lesson-analysis", () => {
  it("GET reads and POST generates, with the locale of the request", async () => {
    vi.mocked(requestLessonAnalysis).mockResolvedValue({ kind: "ok", body: { status: "ready", data: VIEW } });
    const read = await get("?locale=vi");
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toEqual({ status: "ready", data: VIEW });
    expect(read.headers.get("Cache-Control")).toBe("private, no-store");
    await post({ locale: "en" });
    expect(vi.mocked(requestLessonAnalysis).mock.calls).toEqual([[VIDEO, "vi", "read"], [VIDEO, "en", "generate"]]);
  });

  it("rejects a bad id, a bad locale, an extra field and malformed JSON without calling the service", async () => {
    expect((await get("?locale=vi", "nope")).status).toBe(400);
    expect((await get("?locale=ja")).status).toBe(400);
    expect((await get("")).status).toBe(400);
    expect((await post({ locale: "vi", tier: "plus" })).status).toBe(400);
    expect((await post({ locale: "fr" })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    expect((await post({ locale: "vi" }, "nope")).status).toBe(400);
    expect(requestLessonAnalysis).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "pending", retryAfterMs: 1500 }, 202, "2"],
    [{ status: "not_ready" }, 404, null],
    [{ status: "no_transcript" }, 422, null],
    [{ status: "unavailable" }, 503, null],
    [{ status: "retryable_error", retryAfter: "2026-10-04T09:00:30.200Z" }, 503, "31"],
    [{ status: "retryable_error", retryAfter: "2026-10-04T08:59:00.000Z" }, 503, "1"],
  ] as const)("maps %j", async (body, status, retryAfter) => {
    vi.mocked(requestLessonAnalysis).mockResolvedValue({ kind: "ok", body });
    const response = await get("?locale=vi");
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe(retryAfter);
    await expect(response.json()).resolves.toEqual(body);
  });

  it.each([
    [{ kind: "unauthorized" }, 401, null],
    [{ kind: "not_found" }, 404, null],
    [{ kind: "rate_limited", retryAfter: 4200 }, 429, "5"],
  ] as const)("maps refusal %j", async (result, status, retryAfter) => {
    vi.mocked(requestLessonAnalysis).mockResolvedValue(result);
    const response = await post({ locale: "vi" });
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe(retryAfter);
    expect(await response.json()).toHaveProperty("error");
  });

  it("hides a thrown error behind an opaque 500", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(requestLessonAnalysis).mockRejectedValue(new Error("db down: secret"));
    const response = await get("?locale=vi");
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    error.mockRestore();
  });
});
