import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import type { NewsletterInput, NewsletterState } from "@/lib/validation/newsletter";

const NEWSLETTER_LIMIT = { limit: 10, windowMs: 60_000 };

export type SetNewsletterOptInResult =
  | { ok: true; data: { optedIn: boolean } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * App-footer spec N1/N3b: the footer and the Settings row both render from this. Null only for a signed-out
 * caller. A failed read fails CLOSED (`optedIn: false`): showing the form to a subscriber is harmless because
 * `set_newsletter_opt_in(true)` keeps the first consent instant; showing "saved" to a non-subscriber is not.
 * The email is the session's account address (plan P6).
 */
export async function getNewsletterState(): Promise<NewsletterState | null> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return null;
  const email = user.email ?? "";
  try {
    const { data, error } = await supabase
      .from("users")
      .select("newsletter_opt_in_at")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return { email, optedIn: (data as { newsletter_opt_in_at: string | null }).newsletter_opt_in_at !== null };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; a failed read must not crash the page.
    console.error("[data/newsletter] getNewsletterState failed:", error);
    return { email, optedIn: false };
  }
}

/** Writes through the definer RPC only (N2); the client never sends an email or an instant. */
export async function setNewsletterOptIn(
  input: NewsletterInput,
  now: Date = new Date(),
): Promise<SetNewsletterOptInResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`newsletter:${user.id}`, NEWSLETTER_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase.rpc("set_newsletter_opt_in", { p_opt_in: input.optIn });
  if (error) throw error;
  return { ok: true, data: { optedIn: data !== null } };
}
