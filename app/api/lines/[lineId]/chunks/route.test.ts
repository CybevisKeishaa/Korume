// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLineChunks } from "@/lib/data/line-chunks";
import { GET } from "./route";

vi.mock("@/lib/data/line-chunks", () => ({ loadLineChunks: vi.fn() }));

const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const get = (lineId = LINE_ID) => GET(new Request(`http://localhost/api/lines/${lineId}/chunks`), { params: { lineId } });
async function expectPrivate(response: Response, status: number, json: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  await expect(response.json()).resolves.toEqual(json);
}

beforeEach(() => vi.resetAllMocks());

describe("GET /api/lines/[lineId]/chunks", () => {
  it("rejects a malformed id without reading", async () => {
    await expectPrivate(await get("nope"), 400, { error: "Invalid id" });
    expect(loadLineChunks).not.toHaveBeenCalled();
  });

  it("returns the chunks privately and uncached", async () => {
    const data = {
      version: 1, textHash: "a".repeat(64), reliable: true, reason: null,
      chunks: ["今日は", "雨です。"], typingHintUnit: "chunk" as const,
    };
    vi.mocked(loadLineChunks).mockResolvedValue({ kind: "ok", data });
    await expectPrivate(await get(), 200, { data });
    expect(loadLineChunks).toHaveBeenCalledWith(LINE_ID);
  });

  it("maps refusals to a private 401 and a generic 404 with no chunks", async () => {
    vi.mocked(loadLineChunks).mockResolvedValueOnce({ kind: "unauthorized" });
    await expectPrivate(await get(), 401, { error: "Unauthorized" });
    vi.mocked(loadLineChunks).mockResolvedValueOnce({ kind: "not_found" });
    await expectPrivate(await get(), 404, { error: "Not found" });
  });

  it("returns a private generic 500 when the loader throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(loadLineChunks).mockRejectedValue(new Error("private database detail"));
    await expectPrivate(await get(), 500, { error: "Something went wrong. Please try again." });
  });
});
