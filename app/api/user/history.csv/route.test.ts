import { beforeEach, describe, expect, it, vi } from "vitest";
import { myLearningHistoryCsv } from "@/lib/data/user-export";
import { GET } from "./route";

vi.mock("@/lib/data/user-export", () => ({ myLearningHistoryCsv: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("GET /api/user/history.csv", () => {
  it("answers 401 for an anonymous caller", async () => {
    vi.mocked(myLearningHistoryCsv).mockResolvedValue({ ok: false, status: 401 });
    expect((await GET()).status).toBe(401);
  });

  it("answers 429 with Retry-After in seconds", async () => {
    vi.mocked(myLearningHistoryCsv).mockResolvedValue({ ok: false, status: 429, retryAfter: 1_500 });
    const response = await GET();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
  });

  it("serves the CSV as a dated utf-8 attachment, body unchanged", async () => {
    const csv = "date,kind,item,detail\r\n2026-09-23,badge,First week,";
    vi.mocked(myLearningHistoryCsv).mockResolvedValue({ ok: true, csv });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="korume-history-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    await expect(response.text()).resolves.toBe(csv);
  });

  it("turns a thrown error into an opaque 500", async () => {
    vi.mocked(myLearningHistoryCsv).mockRejectedValue(new Error("select * from users failed at db:5432"));

    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).not.toContain("db:5432");
    expect(body).toContain("Something went wrong");
  });
});
