import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { readPreferences, readPreferencesOrThrow } from "@/lib/data/preferences";
import { korumeGate } from "./gate";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(() => ({ marker: "learner-client" })) }));
vi.mock("@/lib/data/videos", () => ({ requireUser: vi.fn() }));
// The swallowing reader answers "enabled" on any error — the gate must never be able to reach it.
vi.mock("@/lib/data/preferences", () => ({
  readPreferences: vi.fn(async () => ({ ...DEFAULT_PREFERENCES })),
  readPreferencesOrThrow: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("korumeGate", () => {
  it("refuses before the preference read when signed out", async () => {
    vi.mocked(requireUser).mockResolvedValue(null);
    await expect(korumeGate()).resolves.toEqual({ kind: "unauthorized" });
    expect(readPreferencesOrThrow).not.toHaveBeenCalled();
    expect(readPreferences).not.toHaveBeenCalled();
  });

  it("refuses a learner who turned Korume off", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "u1" } as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(readPreferencesOrThrow).mockResolvedValue({ ...DEFAULT_PREFERENCES, companionEnabled: false });
    await expect(korumeGate()).resolves.toEqual({ kind: "disabled" });
  });

  it("fails closed when preferences cannot be read", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "u1" } as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(readPreferencesOrThrow).mockRejectedValue(new Error("db hiccup"));
    await expect(korumeGate()).resolves.toEqual({ kind: "unavailable" });
  });

  it("lets an enabled learner through with their own client", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "u1" } as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(readPreferencesOrThrow).mockResolvedValue({ ...DEFAULT_PREFERENCES });
    const gate = await korumeGate();
    expect(gate).toEqual({ kind: "ok", supabase: { marker: "learner-client" }, userId: "u1" });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(readPreferencesOrThrow).toHaveBeenCalledWith({ marker: "learner-client" }, "u1");
  });
});
