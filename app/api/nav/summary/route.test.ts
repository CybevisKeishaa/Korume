import { describe, expect, it, vi } from "vitest";
import { getNavSummary } from "@/lib/data/nav-summary";

vi.mock("@/lib/data/nav-summary", () => ({ getNavSummary: vi.fn() }));
import { GET, dynamic } from "./route";

describe("GET /api/nav/summary", () => {
  it("is never statically cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });
  it("401s when signed out, private no-store", async () => {
    vi.mocked(getNavSummary).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("returns the summary, private no-store", async () => {
    const data = { name: "Yuki", avatarUrl: null, plan: "free", reviewDue: 3, reviewHref: "/mining/review" } as const;
    vi.mocked(getNavSummary).mockResolvedValue(data);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(res.json()).resolves.toEqual({ data });
  });
});
