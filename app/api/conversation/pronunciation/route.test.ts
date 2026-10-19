// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreConversationPronunciation } from "@/lib/data/pronunciation";
import { POST } from "./route";
vi.mock("@/lib/data/pronunciation", () => ({ scoreConversationPronunciation: vi.fn() }));
function request(extras: Record<string, string> = {}, audio: Blob | string | null = new Blob(["wav"])) {
  const body = new FormData(); body.set("referenceText", "今日は");
  for (const [key, value] of Object.entries(extras)) body.set(key, value);
  if (audio !== null) body.set("audio", audio);
  return new Request("http://localhost/api/conversation/pronunciation", { method: "POST", body });
}
function privateResponse(response: Response, status: number) { expect(response.status).toBe(status); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(scoreConversationPronunciation).mockResolvedValue({ ok: true, data: { recognizedText: "今日は", pronunciationScore: 88, fluencyScore: 76, accuracyScore: 91, completenessScore: 100, words: [] } }); });
describe("conversation pronunciation", () => {
  it("scores only ephemeral audio and reference text", async () => {
    const response = await POST(request()); privateResponse(response, 200); expect(await response.json()).toMatchObject({ data: { pronunciationScore: 88 } });
    expect(scoreConversationPronunciation).toHaveBeenCalledTimes(1); expect(scoreConversationPronunciation).toHaveBeenCalledWith({ audio: expect.any(Blob), referenceText: "今日は" });
  });
  it.each<Record<string, string>>([{ shadowingSessionId: "forged" }, { sessionId: "forged" }, { arbitrary: "extra" }, { referenceText: "" }, { referenceText: "あ".repeat(501) }])("rejects forged or invalid fields %j", async (fields) => {
    privateResponse(await POST(request(fields)), 400); expect(scoreConversationPronunciation).not.toHaveBeenCalled();
  });
  it.each([null, "not a file", new Blob([])])("rejects invalid audio %s", async (audio) => { privateResponse(await POST(request({}, audio)), 400); expect(scoreConversationPronunciation).not.toHaveBeenCalled(); });
  it("rejects prototype-named unknown fields", async () => {
    const req = request(); const body = await req.formData(); body.set("__proto__", new Blob(["forged"]));
    privateResponse(await POST(new Request(req.url, { method: "POST", body })), 400); expect(scoreConversationPronunciation).not.toHaveBeenCalled();
  });
  it("rejects duplicate reference fields", async () => {
    const req = request(); const body = await req.formData(); body.append("referenceText", "override");
    privateResponse(await POST(new Request(req.url, { method: "POST", body })), 400); expect(scoreConversationPronunciation).not.toHaveBeenCalled();
  });
  it("rejects malformed multipart", async () => { privateResponse(await POST(new Request("http://localhost", { method: "POST", body: "oops" })), 400); });
  it.each([401, 422, 502, 503] as const)("returns private %s", async (status) => { vi.mocked(scoreConversationPronunciation).mockResolvedValue({ ok: false, status }); privateResponse(await POST(request()), status); });
  it.each([[12000, "12"], [null, null]] as const)("only sends supplied retry timing %s", async (retryAfter, header) => {
    vi.mocked(scoreConversationPronunciation).mockResolvedValue({ ok: false, status: 429, retryAfter });
    const response = await POST(request()); privateResponse(response, 429); expect(response.headers.get("Retry-After")).toBe(header);
  });
  it("returns a private generic 500 on failure", async () => { vi.mocked(scoreConversationPronunciation).mockRejectedValue(new Error("private")); privateResponse(await POST(request()), 500); });
});
