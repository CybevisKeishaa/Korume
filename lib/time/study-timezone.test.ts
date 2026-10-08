import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { canonicalTimeZone, FALLBACK_STUDY_TIMEZONE } from "./study-day";
import { detectStudyTimezone, getStudyTimezone } from "./study-timezone";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ hasPublicSupabaseEnv: vi.fn(() => true) }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: (fn: unknown) => fn }));
beforeEach(() => vi.clearAllMocks());

function client(user: { id: string } | null, stored: string | null, updated: unknown[] = [{ id: "u1" }]) {
  const calls: QueryCall[][] = [];
  const supabase = createMockSupabase({ user, tables: {
    users: (query) => { calls.push(query); return query.some((c) => c.op === "update")
      ? { data: updated, error: null } : { data: { study_timezone: stored }, error: null }; },
  } });
  vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>);
  return calls;
}

describe("study timezone", () => {
  it("uses fallback without browser detection when signed out", async () => {
    client(null, null);
    await expect(getStudyTimezone()).resolves.toEqual({ timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: false });
  });
  it("uses fallback on public pages before Supabase is configured", async () => {
    vi.mocked(hasPublicSupabaseEnv).mockReturnValueOnce(false);
    await expect(getStudyTimezone()).resolves.toEqual({ timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: false });
    expect(createClient).not.toHaveBeenCalled();
  });
  it("requests detection only for a null stored zone", async () => {
    client({ id: "u1" }, null);
    await expect(getStudyTimezone()).resolves.toEqual({ timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: true });
  });
  it("uses a stored zone and never overwrites invalid existing data", async () => {
    client({ id: "u1" }, "America/Los_Angeles");
    await expect(getStudyTimezone()).resolves.toEqual({ timeZone: canonicalTimeZone("America/Los_Angeles"), needsDetection: false });
    client({ id: "u1" }, "Not/AZone");
    await expect(getStudyTimezone()).resolves.toEqual({ timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: false });
  });
  it("rejects invalid input before writing", async () => {
    const calls = client({ id: "u1" }, null);
    await expect(detectStudyTimezone("Not/AZone")).resolves.toBe("invalid");
    expect(calls).toHaveLength(0);
  });
  it("writes a canonical zone only when the user's column is null", async () => {
    const calls = client({ id: "u1" }, null);
    await expect(detectStudyTimezone("US/Pacific")).resolves.toBe("saved");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContainEqual({ op: "update", values: { study_timezone: canonicalTimeZone("US/Pacific") } });
    expect(calls[0]).toContainEqual({ op: "eq", column: "id", value: "u1" });
    expect(calls[0]).toContainEqual({ op: "is", column: "study_timezone", value: null });
  });
  it("treats a second detector and signed-out detector as no-ops", async () => {
    client({ id: "u1" }, null, []);
    await expect(detectStudyTimezone("America/Los_Angeles")).resolves.toBe("already_set");
    client(null, null);
    await expect(detectStudyTimezone("America/Los_Angeles")).resolves.toBe("unauthorized");
  });
});
