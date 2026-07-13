import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./deliver-in-app", () => ({ deliverInApp: vi.fn() }));

import { emitNotification } from "./emit";
import { deliverInApp } from "./deliver-in-app";
import type { NotificationEvent } from "./types";

beforeEach(() => {
  vi.mocked(deliverInApp).mockReset();
});

describe("emitNotification", () => {
  it("runs the deliverer list with the given client and event", async () => {
    vi.mocked(deliverInApp).mockResolvedValue(undefined);
    const client = {} as SupabaseClient;
    const event: NotificationEvent = { type: "level_up", userId: "u1", payload: { level: 3 } };

    await emitNotification(client, event);

    expect(deliverInApp).toHaveBeenCalledTimes(1);
    expect(deliverInApp).toHaveBeenCalledWith(client, event);
  });

  it("propagates a deliverer error to the caller rather than swallowing it", async () => {
    vi.mocked(deliverInApp).mockRejectedValue(new Error("insert failed"));
    const client = {} as SupabaseClient;

    await expect(
      emitNotification(client, { type: "srs_due", userId: "u1", payload: { dueCount: 1 } }),
    ).rejects.toThrow("insert failed");
  });
});
