import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/summary/load-snapshot", () => ({ authenticateSummary: vi.fn() }));
vi.mock("@/lib/vocabulary/print/lesson-source", () => ({ resolveLessonSource: vi.fn() }));
vi.mock("@/lib/vocabulary/print/resources", () => ({ loadPrintResources: vi.fn(async () => ({ strokeGuides: {}, credits: { jmdict: null, kanjivg: null } })) }));
vi.mock("@/lib/vocabulary/print/pdf/renderer", async (original) => ({ ...(await original<object>()), renderPdf: vi.fn(async () => Buffer.from("%PDF-1.7")) }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: vi.fn(async () => (key: string) => ({ docPractice: "Luyện viết từ vựng", docSelfTest: "Tự kiểm tra từ vựng" })[key] ?? key) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));

import { errors } from "playwright";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateSummary } from "@/lib/summary/load-snapshot";
import { resolveLessonSource } from "@/lib/vocabulary/print/lesson-source";
import { QueueFullError } from "@/lib/vocabulary/print/pdf/queue";
import { PdfLayoutError, PdfUnavailableError, renderPdf } from "@/lib/vocabulary/print/pdf/renderer";
import { DEFAULT_WORKSHEET_SETTINGS } from "@/lib/vocabulary/print/settings";
import { POST } from "./route";

const lessonId = "00000000-0000-4000-8000-000000000000";
const body = { lessonId, set: "all", locale: "vi", settings: DEFAULT_WORKSHEET_SETTINGS, pages: [{ kind: "items", ids: ["a"] }] };
const post = (data: unknown) => POST(new Request("http://x/api/vocab/print/pdf", { method: "POST", body: JSON.stringify(data) }));

beforeEach(() => {
  vi.mocked(authenticateSummary).mockResolvedValue({ userId: "u1", supabase: {} } as never);
  vi.mocked(resolveLessonSource).mockResolvedValue({ kind: "ok", doc: { title: "Ep.729", backHref: "/b", backLabel: "b", items: [
    { id: "a", surface: "苦手", entSeq: 1, resolution: "resolved", meaning: "kém", meaningLocale: "vi" },
  ] } });
});

describe("POST /api/vocab/print/pdf (spec W §6.3)", () => {
  it("returns the PDF as an attachment named after the document and the lesson", async () => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''Korume%20-%20Luy%E1%BB%87n");
    expect(vi.mocked(renderPdf).mock.calls[0]![0]).toMatch(/^\/vi\/print-render\/[A-Za-z0-9_-]{43}$/);
    expect(resolveLessonSource).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", source: { kind: "lesson", lessonId, set: "all" } }));
  });
  it("401 without a session, 429 over the rate limit, 400 on a bad body or a foreign id, 404 for an unreadable lesson", async () => {
    vi.mocked(authenticateSummary).mockResolvedValueOnce(null);
    expect((await post(body)).status).toBe(401);
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 12_000 });
    const limited = await post(body);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("12");
    expect((await post({ ...body, pages: "x" })).status).toBe(400);
    expect((await post({ ...body, pages: [{ kind: "items", ids: ["forged"] }] })).status).toBe(400);
    vi.mocked(resolveLessonSource).mockResolvedValueOnce({ kind: "not_found" });
    expect((await post(body)).status).toBe(404);
  });
  it("maps renderer failures: layout 409, Chromium missing 503, a full queue 503 with Retry-After, timeout 504", async () => {
    vi.mocked(renderPdf).mockRejectedValueOnce(new PdfLayoutError("x"));
    expect((await post(body)).status).toBe(409);
    vi.mocked(renderPdf).mockRejectedValueOnce(new PdfUnavailableError("x"));
    expect((await post(body)).status).toBe(503);
    vi.mocked(renderPdf).mockRejectedValueOnce(new QueueFullError("x"));
    const full = await post(body);
    expect(full.status).toBe(503);
    expect(full.headers.get("retry-after")).toBe("10");
    vi.mocked(renderPdf).mockRejectedValueOnce(new errors.TimeoutError("slow"));
    expect((await post(body)).status).toBe(504);
  });
});
