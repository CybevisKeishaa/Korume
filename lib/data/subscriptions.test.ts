import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { getActivePlanTier } from "./subscriptions";

const USER_ID = "u-sub-1";

function mockService(row: { plan: string; status: string } | null) {
  const supabase = createMockSupabase({
    tables: { subscriptions: () => ({ data: row, error: null }) },
  });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
});

describe("getActivePlanTier", () => {
  it("returns 'free' when the user has no subscriptions row", async () => {
    mockService(null);
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("free");
  });

  it("returns 'free' when plan is 'free' even if status is 'active'", async () => {
    mockService({ plan: "free", status: "active" });
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("free");
  });

  it("returns 'free' when plan is premium but status is not 'active'", async () => {
    mockService({ plan: "premium_monthly", status: "past_due" });
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("free");
  });

  it("returns 'plus' when plan is premium and status is 'active'", async () => {
    mockService({ plan: "premium_yearly", status: "active" });
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("plus");
  });
});
