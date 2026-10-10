import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { readPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/time/study-timezone", () => ({ getStudyTimezone: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/profile/avatar-url", () => ({ resolveAvatarUrl: vi.fn() }));

import { getDashboardContext } from "./context";

beforeEach(() => {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user: { id: "u1" },
    tables: { users: () => ({ data: { name: "Keishaa", avatar_path: "u1/avatar.webp", avatar_url: "https://example.test/avatar", created_at: "2026-01-02T03:04:05Z" }, error: null }) },
  }) as unknown as ReturnType<typeof createClient>);
  vi.mocked(getStudyTimezone).mockResolvedValue({ timeZone: "Asia/Tokyo", needsDetection: false });
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, scheduleDays: [1, 3], companionEnabled: false });
  vi.mocked(resolveAvatarUrl).mockResolvedValue("https://signed.example/avatar");
});

describe("getDashboardContext", () => {
  it("maps the signed-in learner and shared dashboard settings once", async () => {
    const now = new Date("2026-10-10T00:00:00Z");
    await expect(getDashboardContext(now)).resolves.toEqual({
      userId: "u1", name: "Keishaa", avatarUrl: "https://signed.example/avatar", timeZone: "Asia/Tokyo",
      now, today: "2026-10-10", createdAt: "2026-01-02T03:04:05.000Z", scheduleDays: [1, 3], companionEnabled: false,
    });
    expect(readPreferences).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(resolveAvatarUrl).toHaveBeenCalledWith({ avatarPath: "u1/avatar.webp", avatarUrl: "https://example.test/avatar" });
  });

  it("returns null without an authenticated learner", async () => {
    vi.mocked(createClient).mockReturnValue(createMockSupabase({ user: null, tables: {} }) as unknown as ReturnType<typeof createClient>);
    await expect(getDashboardContext(new Date())).resolves.toBeNull();
  });
});
