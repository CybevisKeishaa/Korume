import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getThread } from "@/lib/data/korume";

vi.mock("@/lib/data/korume", () => ({ getThread: vi.fn() }));

const THREAD = "b0000000-0000-4000-8000-000000000001";
const get = (id: string) => GET(new Request(`http://localhost/api/korume/threads/${id}`), { params: { id } });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/korume/threads/[id]", () => {
  it("answers the same 404 for a malformed id without touching the data layer", async () => {
    const response = await get("not-a-uuid");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(getThread).not.toHaveBeenCalled();
  });

  it("returns the detail and maps refusals", async () => {
    const detail = { thread: { id: THREAD, title: null, anchor: null, originRoute: null, updatedAt: "x" }, messages: [], pendingTurns: [] };
    vi.mocked(getThread).mockResolvedValueOnce({ kind: "ok", detail });
    await expect((await get(THREAD)).json()).resolves.toEqual(detail);
    vi.mocked(getThread).mockResolvedValueOnce({ kind: "not_found" });
    expect((await get(THREAD)).status).toBe(404);
    vi.mocked(getThread).mockResolvedValueOnce({ kind: "disabled" });
    expect((await get(THREAD)).status).toBe(403);
  });
});
