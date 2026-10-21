// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitListeningAttempt } from "@/lib/data/dictation";
import { POST } from "./route";

vi.mock("@/lib/data/dictation", () => ({ submitListeningAttempt: vi.fn() }));

const BODY = {
  kind: "submit", format: "word_bank",
  videoId: "11111111-1111-4111-8111-111111111111", lineId: "22222222-2222-4222-8222-222222222222",
  version: 1, textHash: "a".repeat(64), chunkOrder: [1, 0], hintedUnits: [],
};
const post = (body: unknown) => POST(new Request("http://localhost/api/dictation/attempt", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
}));
async function expectPrivate(response: Response, status: number, json: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  await expect(response.json()).resolves.toEqual(json);
}

beforeEach(() => vi.resetAllMocks());

describe("POST /api/dictation/attempt", () => {
  it("rejects invalid JSON and a body outside the four strict shapes without calling the server path", async () => {
    await expectPrivate(await post("{"), 400, { error: "Invalid JSON" });
    const response = await post({ ...BODY, hintUnit: "chunk" });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(submitListeningAttempt).not.toHaveBeenCalled();
  });

  it("forwards the parsed body and returns the result privately", async () => {
    const data = { kind: "reveal", answer: "今日は雨です。", chunks: ["今日は", "雨です。"] };
    vi.mocked(submitListeningAttempt).mockResolvedValue({ ok: true, data } as Awaited<ReturnType<typeof submitListeningAttempt>>);
    await expectPrivate(await post(BODY), 200, { data });
    expect(submitListeningAttempt).toHaveBeenCalledWith(BODY);
  });

  it("maps 401, 400, both 409s and 429 privately", async () => {
    vi.mocked(submitListeningAttempt).mockResolvedValueOnce({ ok: false, status: 401 });
    await expectPrivate(await post(BODY), 401, { error: "Unauthorized" });
    vi.mocked(submitListeningAttempt).mockResolvedValueOnce({ ok: false, status: 400 });
    await expectPrivate(await post(BODY), 400, { error: "Invalid attempt" });
    vi.mocked(submitListeningAttempt).mockResolvedValueOnce({ ok: false, status: 409, error: "line_changed" });
    await expectPrivate(await post(BODY), 409, { error: "line_changed" });
    vi.mocked(submitListeningAttempt).mockResolvedValueOnce({ ok: false, status: 409, error: "chunker_version" });
    await expectPrivate(await post(BODY), 409, { error: "chunker_version" });
    vi.mocked(submitListeningAttempt).mockResolvedValueOnce({ ok: false, status: 429, retryAfter: 1_500 });
    const limited = await post(BODY);
    expect(limited.headers.get("Retry-After")).toBe("2");
    await expectPrivate(limited, 429, { error: "Too many attempts, slow down" });
  });

  it("returns a private generic 500 when the server path throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitListeningAttempt).mockRejectedValue(new Error("private database detail"));
    await expectPrivate(await post(BODY), 500, { error: "Something went wrong. Please try again." });
  });
});
