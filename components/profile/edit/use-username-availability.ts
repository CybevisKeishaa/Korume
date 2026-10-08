"use client";

import { useEffect, useState } from "react";
import { normalizeUsername, validateUsername } from "@/lib/profile/username";

export type UsernameStatus = "idle" | "checking" | "available" | "taken";

const DEBOUNCE_MS = 400;

/**
 * Early feedback only (spec §8.4): the unique index decides at Save. Silent for a value the local validator
 * rejects, an empty one, the learner's own saved name, and any network failure.
 */
export function useUsernameAvailability(raw: string, saved: string | null): UsernameStatus {
  const value = normalizeUsername(raw);
  const askable = value !== "" && value !== saved && validateUsername(value).ok;
  const [result, setResult] = useState<{ value: string; status: Exclude<UsernameStatus, "checking"> } | null>(null);

  useEffect(() => {
    if (!askable) return;
    let stale = false;
    const timer = setTimeout(() => {
      void fetch(`/api/profile/username?value=${encodeURIComponent(value)}`)
        .then(async (response) => {
          const body = response.ok ? ((await response.json()) as { data?: { available?: boolean } }) : null;
          const available = body?.data?.available;
          if (!stale) setResult({ value, status: typeof available !== "boolean" ? "idle" : available ? "available" : "taken" });
        })
        .catch(() => { if (!stale) setResult({ value, status: "idle" }); });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [askable, value]);

  if (!askable) return "idle";
  return result?.value === value ? result.status : "checking";
}
