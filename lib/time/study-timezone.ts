import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { canonicalTimeZone, FALLBACK_STUDY_TIMEZONE } from "./study-day";

export interface StudyTimezone {
  timeZone: string;
  needsDetection: boolean;
}

/** Resolve once per request. Only a null column invites browser detection. */
export const getStudyTimezone = cache(async (): Promise<StudyTimezone> => {
  if (!hasPublicSupabaseEnv()) return { timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: false };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: false };
  const { data, error } = await supabase.from("users").select("study_timezone").eq("id", user.id).maybeSingle();
  if (error) throw error;
  const stored = (data as { study_timezone: string | null } | null)?.study_timezone ?? null;
  if (stored === null) return { timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: true };
  return { timeZone: canonicalTimeZone(stored) ?? FALLBACK_STUDY_TIMEZONE, needsDetection: false };
});

/** Atomic first write wins across tabs. */
export async function detectStudyTimezone(input: string): Promise<"saved" | "already_set" | "invalid" | "unauthorized"> {
  const timeZone = canonicalTimeZone(input);
  if (timeZone === null) return "invalid";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "unauthorized";
  const { data, error } = await supabase.from("users")
    .update({ study_timezone: timeZone }).eq("id", user.id).is("study_timezone", null).select("id");
  if (error) throw error;
  return (data ?? []).length === 1 ? "saved" : "already_set";
}
