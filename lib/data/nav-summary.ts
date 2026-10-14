import "server-only";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getReviewSummary } from "@/lib/data/dashboard/review";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_FALLBACK_HREF, type NavSummary } from "@/lib/nav/nav-state";

/** The sidebar's personal data (spec §3.3). Each read falls back on its own: a failed plan read hides the chip
 * (never guesses FREE), a failed review read hides the badge and points at the library. */
export async function getNavSummary(): Promise<NavSummary | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [profile, plan, review] = await Promise.allSettled([
    createClient().from("users").select("name, avatar_path, avatar_url").eq("id", user.id).maybeSingle(),
    getActivePlanTier(user.id),
    getReviewSummary(),
  ]);
  const row = profile.status === "fulfilled" && !profile.value.error
    ? (profile.value.data as { name: string | null; avatar_path: string | null; avatar_url: string | null } | null)
    : null;
  return {
    name: row?.name?.trim() || (user.email ?? "").split("@")[0] || "",
    // An upload outranks the OAuth picture, as on Dashboard and Profile; the resolver never throws.
    avatarUrl: await resolveAvatarUrl({ avatarPath: row?.avatar_path ?? null, avatarUrl: row?.avatar_url ?? null }),
    plan: plan.status === "fulfilled" ? plan.value : null,
    reviewDue: review.status === "fulfilled" ? review.value.due : null,
    reviewHref: review.status === "fulfilled" ? review.value.href : REVIEW_FALLBACK_HREF,
  };
}
