import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Plan-tier resolution, mirroring the exact predicate `videos_read`'s RLS
 * policy uses for the PLUS branch (migration 20260731000021): plan must be
 * non-free AND status must be 'active'. Kept as one function so this
 * definition of "is Plus" never drifts from the DB's own check.
 */
export type PlanTier = "free" | "plus";

interface SubscriptionRow {
  plan: string;
  status: string;
}

export async function getActivePlanTier(userId: string): Promise<PlanTier> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const row = data as SubscriptionRow | null;
  if (!row) return "free";
  return row.plan !== "free" && row.status === "active" ? "plus" : "free";
}
