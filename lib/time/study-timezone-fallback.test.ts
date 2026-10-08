import { describe, expect, it, vi } from "vitest";
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: (fn: unknown) => fn }));

import { FALLBACK_STUDY_TIMEZONE } from "./study-day";
import { getStudyTimezoneOrFallback } from "./study-timezone-fallback";

describe("getStudyTimezoneOrFallback", () => {
  it("preserves a successful read", async () => {
    await expect(getStudyTimezoneOrFallback(async () => ({ timeZone: "Asia/Tokyo", needsDetection: true })))
      .resolves.toEqual({ timeZone: "Asia/Tokyo", needsDetection: true });
  });

  it("logs a failed read and disables detection while rendering", async () => {
    const error = { message: "users read failed" };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await getStudyTimezoneOrFallback(async () => { throw error; });
    expect(result.timeZone).toBe(FALLBACK_STUDY_TIMEZONE);
    expect(result.needsDetection).toBe(false);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
