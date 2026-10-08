import { describe, expect, it, vi } from "vitest";
import { FALLBACK_STUDY_TIMEZONE } from "@/lib/time/study-day";

vi.mock("next-intl/server", () => ({ getRequestConfig: (config: unknown) => config }));
vi.mock("@/lib/time/study-timezone", () => ({
  getStudyTimezone: vi.fn().mockRejectedValue({ message: "users read failed" }),
}));

import requestConfig from "./request";

describe("request config", () => {
  it("serves messages and the fallback zone when the learner timezone read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const config = requestConfig as unknown as (input: { requestLocale: Promise<string> }) => Promise<{
      locale: string; messages: Record<string, unknown>; timeZone: string;
    }>;
    const result = await config({ requestLocale: Promise.resolve("en") });
    expect(result.locale).toBe("en");
    expect(Object.keys(result.messages).length).toBeGreaterThan(0);
    expect(result.timeZone).toBe(FALLBACK_STUDY_TIMEZONE);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
