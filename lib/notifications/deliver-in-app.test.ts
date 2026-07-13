import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverInApp } from "./deliver-in-app";
import type { NotificationEvent } from "./types";

interface Capture {
  table?: string;
  values?: unknown;
}

function fakeClient(capture: Capture, error: { message: string } | null = null): SupabaseClient {
  return {
    from(table: string) {
      capture.table = table;
      return {
        insert: async (values: unknown) => {
          capture.values = values;
          return { data: null, error };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("deliverInApp", () => {
  it("inserts a notifications row shaped from a badge_earned event", async () => {
    const capture: Capture = {};
    const client = fakeClient(capture);
    const event: NotificationEvent = {
      type: "badge_earned",
      userId: "u1",
      payload: { badgeId: "b1", badgeName: "First Steps" },
    };

    await deliverInApp(client, event);

    expect(capture.table).toBe("notifications");
    expect(capture.values).toEqual({
      user_id: "u1",
      type: "badge_earned",
      payload: { badgeId: "b1", badgeName: "First Steps" },
    });
  });

  it("inserts a notifications row shaped from a level_up event", async () => {
    const capture: Capture = {};
    const client = fakeClient(capture);

    await deliverInApp(client, { type: "level_up", userId: "u2", payload: { level: 5 } });

    expect(capture.values).toEqual({ user_id: "u2", type: "level_up", payload: { level: 5 } });
  });

  it("inserts a notifications row shaped from an srs_due event", async () => {
    const capture: Capture = {};
    const client = fakeClient(capture);

    await deliverInApp(client, { type: "srs_due", userId: "u3", payload: { dueCount: 4 } });

    expect(capture.values).toEqual({ user_id: "u3", type: "srs_due", payload: { dueCount: 4 } });
  });

  it("throws when the insert errors", async () => {
    const capture: Capture = {};
    const client = fakeClient(capture, { message: "boom" });

    await expect(
      deliverInApp(client, { type: "srs_due", userId: "u3", payload: { dueCount: 4 } }),
    ).rejects.toBeTruthy();
  });
});
