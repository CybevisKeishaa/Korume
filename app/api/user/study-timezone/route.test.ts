import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ detectStudyTimezone: vi.fn() }));
vi.mock("@/lib/time/study-timezone", () => ({ detectStudyTimezone: mocks.detectStudyTimezone }));
import { POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/api/user/study-timezone", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));
beforeEach(() => vi.clearAllMocks());

describe("POST /api/user/study-timezone", () => {
  it("accepts saved and already-set detection as idempotent success", async () => {
    for (const result of ["saved", "already_set"]) {
      mocks.detectStudyTimezone.mockResolvedValueOnce(result);
      expect((await post({ timeZone: "US/Pacific" })).status).toBe(204);
    }
    expect(mocks.detectStudyTimezone).toHaveBeenCalledWith("US/Pacific");
  });
  it("rejects malformed JSON, empty, long, and extra fields", async () => {
    const malformed = await POST(new Request("http://localhost/x", { method: "POST", body: "{" }));
    expect(malformed.status).toBe(400);
    for (const body of [{}, { timeZone: "" }, { timeZone: "x".repeat(65) }, { timeZone: "UTC", extra: true }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(mocks.detectStudyTimezone).not.toHaveBeenCalled();
  });
  it.each([["invalid", 400], ["unauthorized", 401]] as const)("maps %s to %i", async (result, status) => {
    mocks.detectStudyTimezone.mockResolvedValue(result);
    expect((await post({ timeZone: "Not/AZone" })).status).toBe(status);
  });
  it("hides server errors", async () => {
    mocks.detectStudyTimezone.mockRejectedValue(new Error("database"));
    const response = await post({ timeZone: "UTC" });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
