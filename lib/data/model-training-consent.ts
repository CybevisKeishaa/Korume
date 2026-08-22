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
export interface ModelTrainingConsentSnapshot {
  consent: boolean;
}

/**
 * Best-effort READ of the persisted flag, for seeding the settings toggle's
 * initial state server-side (no `GET` route — `page.tsx` reads the DB
 * directly, same as any other server component).
 *
 * This governs whether the caller's voice recordings may train models
 * (CLAUDE.md §2 rule 2), so a UI that misreports it is not a polish gap: an
 * opted-in user who saw a stale "off" toggle could click it believing they
 * were turning consent ON when they were actually turning it OFF. Unlike
 * `setModelTrainingConsent`, this function therefore never throws and never
 * reports `true` on anything less than a confirmed read — an unauthenticated
 * caller, a missing row, or an unexpected DB failure all fail CLOSED
 * (`consent: false`), and a DB failure must not crash the whole
 * `/settings/privacy` page over one ancillary toggle default.
 */
export async function getModelTrainingConsent(): Promise<ModelTrainingConsentSnapshot> {
  try {
    const supabase = createClient();
    const user = await requireUser(supabase);
    if (!user) return { consent: false };

    const { data, error } = await supabase
      .from("users")
      .select("model_training_consent")
      .eq("id", user.id)
      .single();
    if (error) throw error;

    return { consent: (data as { model_training_consent: boolean }).model_training_consent === true };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; a failed read
    // must never crash the page and must never be mistaken for consent.
    console.error("[data/model-training-consent] getModelTrainingConsent failed:", error);
    return { consent: false };
  }
}

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
