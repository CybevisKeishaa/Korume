import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getModelTrainingConsent, setModelTrainingConsent } from "./model-training-consent";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("getModelTrainingConsent", () => {
  it("reports true for an opted-in user", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u1" },
        tables: {
          users: () => ({ data: { model_training_consent: true }, error: null }),
        },
      }) as ReturnType<typeof createClient>,
    );
    expect(await getModelTrainingConsent()).toEqual({ consent: true });
  });

  it("reports false for an opted-out user", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u1" },
        tables: {
          users: () => ({ data: { model_training_consent: false }, error: null }),
        },
      }) as ReturnType<typeof createClient>,
    );
    expect(await getModelTrainingConsent()).toEqual({ consent: false });
  });

  it("fails closed (false) for an anonymous caller, never throwing", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>,
    );
    await expect(getModelTrainingConsent()).resolves.toEqual({ consent: false });
  });

  it("fails closed (false) on a DB error, never throwing and never reporting true", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u1" },
        tables: {
          users: () => ({ data: null, error: { message: "connection reset" } }),
        },
      }) as ReturnType<typeof createClient>,
    );
    await expect(getModelTrainingConsent()).resolves.toEqual({ consent: false });
  });
});

describe("setModelTrainingConsent", () => {
  it("refuses an anonymous caller", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>,
    );
    expect(await setModelTrainingConsent({ consent: true })).toEqual({ ok: false, status: 401 });
  });

  it("writes the caller's own row and echoes the new value", async () => {
    let updated: Record<string, unknown> | null = null;
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u1" },
        tables: {
          users: (calls) => {
            const update = calls.find((c) => c.op === "update");
            if (update) updated = (update as { values: Record<string, unknown> }).values;
            return { data: null, error: null };
          },
        },
      }) as ReturnType<typeof createClient>,
    );
    expect(await setModelTrainingConsent({ consent: true })).toEqual({ ok: true, data: { consent: true } });
    expect(updated).toEqual({ model_training_consent: true });
  });
});
