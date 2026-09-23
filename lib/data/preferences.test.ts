import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, hasCall, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { readPreferences, updateMyPreferences } from "./preferences";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const row = {
  learning_schedule: "custom" as const,
  schedule_days: [1, 3, 5],
  review_frequency: "relaxed" as const,
  difficulty: "challenge" as const,
  display_scale: "large" as const,
  reduce_motion: true,
  microphone_enabled: false,
  camera_enabled: true,
};

beforeEach(() => vi.clearAllMocks());

describe("readPreferences", () => {
  it("uses defaults for a missing preferences row but reads daily minutes from users", async () => {
    const supabase = createMockSupabase({
      user: { id: "u1" },
      tables: {
        user_preferences: () => ({ data: null, error: null }),
        users: () => ({ data: { daily_minutes: 30 }, error: null }),
      },
    });
    await expect(readPreferences(supabase as ReturnType<typeof createClient>, "u1")).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      dailyMinutes: 30,
    });
  });

  it("maps database columns into the preferences shape", async () => {
    const supabase = createMockSupabase({
      user: { id: "u1" },
      tables: {
        user_preferences: () => ({ data: row, error: null }),
        users: () => ({ data: { daily_minutes: 20 }, error: null }),
      },
    });
    await expect(readPreferences(supabase as ReturnType<typeof createClient>, "u1")).resolves.toEqual({
      learningSchedule: "custom",
      scheduleDays: [1, 3, 5],
      reviewFrequency: "relaxed",
      difficulty: "challenge",
      displayScale: "large",
      reduceMotion: true,
      microphoneEnabled: false,
      cameraEnabled: true,
      dailyMinutes: 20,
    });
  });

  it.each(["user_preferences", "users"])("never throws when %s fails", async (failingTable) => {
    const supabase = createMockSupabase({
      user: { id: "u1" },
      tables: {
        user_preferences: () => ({ data: null, error: failingTable === "user_preferences" ? { message: "nope" } : null }),
        users: () => ({ data: null, error: failingTable === "users" ? { message: "nope" } : null }),
      },
    });
    await expect(readPreferences(supabase as ReturnType<typeof createClient>, "u1")).resolves.toEqual(DEFAULT_PREFERENCES);
  });
});

describe("updateMyPreferences", () => {
  it("returns 401 when signed out", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>,
    );
    await expect(updateMyPreferences({ reduceMotion: true })).resolves.toEqual({ ok: false, status: 401 });
  });

  it("limits a user to 30 writes per minute", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "rate-limit" },
        tables: {
          user_preferences: () => ({ data: null, error: null }),
          users: () => ({ data: { daily_minutes: 15 }, error: null }),
        },
      }) as ReturnType<typeof createClient>,
    );
    const now = new Date("2026-09-23T00:00:00.000Z");
    for (let write = 0; write < 30; write += 1) {
      await expect(updateMyPreferences({ reduceMotion: true }, now)).resolves.toMatchObject({ ok: true });
    }
    await expect(updateMyPreferences({ reduceMotion: true }, now)).resolves.toEqual({
      ok: false,
      status: 429,
      retryAfter: 60_000,
    });
  });

  it("writes daily minutes only to users and returns merged preferences", async () => {
    const calls: { users: QueryCall[][]; user_preferences: QueryCall[][] } = { users: [], user_preferences: [] };
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "daily-minutes" },
        tables: {
          users: (tableCalls) => {
            calls.users.push(tableCalls);
            return { data: { daily_minutes: 20 }, error: null };
          },
          user_preferences: (tableCalls) => {
            calls.user_preferences.push(tableCalls);
            return { data: row, error: null };
          },
        },
      }) as ReturnType<typeof createClient>,
    );
    await expect(updateMyPreferences({ dailyMinutes: 20 })).resolves.toEqual({
      ok: true,
      data: { ...DEFAULT_PREFERENCES, ...{
        learningSchedule: "custom", scheduleDays: [1, 3, 5], reviewFrequency: "relaxed", difficulty: "challenge",
        displayScale: "large", reduceMotion: true, microphoneEnabled: false, cameraEnabled: true, dailyMinutes: 20,
      } },
    });
    expect(calls.users.some((tableCalls) => hasCall(tableCalls, "update"))).toBe(true);
    expect(calls.user_preferences.some((tableCalls) => hasCall(tableCalls, "upsert"))).toBe(false);
  });

  it("upserts a preference row only and returns merged preferences", async () => {
    const calls: { users: QueryCall[][]; user_preferences: QueryCall[][] } = { users: [], user_preferences: [] };
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "preference" },
        tables: {
          users: (tableCalls) => {
            calls.users.push(tableCalls);
            return { data: { daily_minutes: 15 }, error: null };
          },
          user_preferences: (tableCalls) => {
            calls.user_preferences.push(tableCalls);
            return { data: { ...row, reduce_motion: false }, error: null };
          },
        },
      }) as ReturnType<typeof createClient>,
    );
    await expect(updateMyPreferences({ reduceMotion: false }, new Date("2026-09-23T00:00:00.000Z"))).resolves.toMatchObject({
      ok: true,
      data: { reduceMotion: false, dailyMinutes: 15 },
    });
    const upsert = calls.user_preferences.flat().find((call) => call.op === "upsert");
    expect(upsert).toMatchObject({
      values: { user_id: "preference", reduce_motion: false, updated_at: "2026-09-23T00:00:00.000Z" },
      options: { onConflict: "user_id" },
    });
    expect(calls.users.some((tableCalls) => hasCall(tableCalls, "update"))).toBe(false);
  });
});
