import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getLessonVocabulary } from "@/lib/analysis/lesson-vocabulary";

vi.mock("@/lib/analysis/lesson-vocabulary", () => ({ getLessonVocabulary: vi.fn(), VOCABULARY_PAGE_MAX: 100 }));

const VIDEO_ID = "c0000000-0000-0000-0000-000000000001";
const get = (query = "", id = VIDEO_ID) => GET(new Request(`http://localhost/api/videos/${id}/vocabulary${query}`), { params: { id } });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/videos/[id]/vocabulary", () => {
  it("validates the id, cursor and limit", async () => {
    for (const [query, id] of [["", "nope"], ["?cursor=-1", VIDEO_ID], ["?limit=101", VIDEO_ID], ["?limit=0", VIDEO_ID], ["?other=1", VIDEO_ID]] as const) {
      expect((await get(query, id)).status, query + id).toBe(400);
    }
    expect(getLessonVocabulary).not.toHaveBeenCalled();
  });

  it("passes the cursor and limit through and returns the page privately", async () => {
    const page = { items: [], nextCursor: null, total: 0 };
    vi.mocked(getLessonVocabulary).mockResolvedValue({ kind: "ok", page });
    const response = await get("?cursor=50&limit=25");
    expect(getLessonVocabulary).toHaveBeenCalledWith(VIDEO_ID, { cursor: "50", limit: 25 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ data: page });
  });

  it("maps refusals", async () => {
    vi.mocked(getLessonVocabulary).mockResolvedValueOnce({ kind: "not_found" });
    expect((await get()).status).toBe(404);
    vi.mocked(getLessonVocabulary).mockResolvedValueOnce({ kind: "unauthorized" });
    expect((await get()).status).toBe(401);
    vi.mocked(getLessonVocabulary).mockResolvedValueOnce({ kind: "invalid_cursor" });
    expect((await get()).status).toBe(400);
  });
});
