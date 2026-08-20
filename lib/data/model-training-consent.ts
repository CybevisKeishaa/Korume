import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import type { ModelTrainingConsentInput } from "@/lib/validation/model-training-consent";

const CONSENT_LIMIT = { limit: 10, windowMs: 60_000 };

export type SetModelTrainingConsentResult =
  | { ok: true; data: { consent: boolean } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * CLAUDE.md §2 rule 2 consent: using this user's data, including voice
 * recordings, to TRAIN models. Off by default, opt-in.
 *
 * ⚠️ Personalising the Companion from memory is NOT covered by this flag and
 * needs no consent — it is not model training. Do not gate personalisation on
 * it, and do not widen this comment to imply it does more than it does: no
 * training pipeline exists yet, so this is a stored preference and the gate a
 * future one must read, not a live switch.
 */
export async function setModelTrainingConsent(
  input: ModelTrainingConsentInput,
  now: Date = new Date(),
): Promise<SetModelTrainingConsentResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`consent:model-training:${user.id}`, CONSENT_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { error } = await supabase
    .from("users")
    .update({ model_training_consent: input.consent })
    .eq("id", user.id);
  if (error) throw error;

  return { ok: true, data: { consent: input.consent } };
}
