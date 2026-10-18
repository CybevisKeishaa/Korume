// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPracticeStats } from "@/lib/data/practice-stats";
import { GET } from "./route";

vi.mock("@/lib/data/practice-stats", () => ({ loadPracticeStats: vi.fn() }));
const ID = "11111111-1111-4111-8111-111111111111";
const STATS = { lineCount: 194, scoredLines: 12, mean: 84, lines: { line: { state: "scored" as const, score: 84 } } };
function request(query = "?mode=pronunciation") {
  return new Request(`http://localhost/api/shadowing/${ID}/practice-stats${query}`);
}
function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadPracticeStats).mockResolvedValue({ ok: true, data: STATS });
});

describe("GET practice-stats", () => {
  it.each(["?mode=listening", "?mode=word_bank", "?mode=typing", "?mode=shadowing", ""])(
    "rejects unsupported or missing mode %s with a private 400", async (query) => {
      const response = await GET(request(query), { params: { id: ID } });
      privateResponse(response, 400);
      expect(await response.json()).toMatchObject({ error: expect.any(String) });
      expect(loadPracticeStats).not.toHaveBeenCalled();
    },
  );

  it("rejects a non-UUID lesson with a private 400", async () => {
    const response = await GET(request(), { params: { id: "bad-id" } });
    privateResponse(response, 400);
    expect(loadPracticeStats).not.toHaveBeenCalled();
  });

  it("returns a private 401 for a missing session", async () => {
    vi.mocked(loadPracticeStats).mockResolvedValue({ ok: false, status: 401 });
    const response = await GET(request(), { params: { id: ID } });
    privateResponse(response, 401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns private stats and forwards the validated video and mode", async () => {
    const response = await GET(request(), { params: { id: ID } });
    privateResponse(response, 200);
    expect(await response.json()).toEqual({ data: STATS });
    expect(loadPracticeStats).toHaveBeenCalledTimes(1);
    expect(loadPracticeStats).toHaveBeenCalledWith(ID, "pronunciation");
  });

  it("returns a private generic 500 when the loader throws", async () => {
    vi.mocked(loadPracticeStats).mockRejectedValue(new Error("private database detail"));
    const response = await GET(request(), { params: { id: ID } });
    privateResponse(response, 500);
    expect(await response.json()).toEqual({ error: "Could not load practice stats" });
  });
});
