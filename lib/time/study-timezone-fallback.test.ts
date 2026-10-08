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

  it("lets Next control-flow errors through instead of logging them as a failed read", async () => {
    const dynamic = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(getStudyTimezoneOrFallback(async () => { throw dynamic; })).rejects.toBe(dynamic);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
