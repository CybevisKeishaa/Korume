"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useToast } from "@/components/ui/toast";
import type { UserPreferences } from "@/lib/preferences/options";

/**
 * What became of one save.
 *
 * ⚠️ `"failed"` and `"superseded"` must stay distinguishable, and this used to
 * be a single `false` for both. A caller that keeps its own copy of the value
 * — AI Training does, because `consent` is a `users` column — rolls back on
 * `"failed"`, and must NOT roll back on `"superseded"`: that save's value is
 * already stale, and restoring the value it saw would undo the newer save that
 * replaced it. This file's own test is named for that promise; the boolean
 * made it impossible to keep.
 */
export type PreferenceSaveOutcome = "saved" | "failed" | "superseded";

export interface PreferenceSave {
  /**
   * `body` is the PATCH body (one logical control, per `preferencesPatchSchema`).
   * `optimistic` is what to show immediately, and doubles as the key set this
   * save owns — nothing outside it is ever written or rolled back.
   *
   * It never REJECTS: a caller that only cares about `preferences` can ignore
   * the result entirely, because the hook has already rolled back and toasted
   * by the time it resolves. A `.catch()` there would never fire.
   */
  save: (
    body: Record<string, unknown>,
    optimistic: Partial<UserPreferences>,
  ) => Promise<PreferenceSaveOutcome>;
  saving: boolean;
}

/**
 * Per-control optimistic saving with a stale-response guard (spec §5).
 *
 * Three rules, each one a test in this file's suite:
 *
 * 1. **A response is applied only if it belongs to this control's latest
 *    request.** Settings controls are clicked faster than a round trip: toggle
 *    Difficulty twice and two PATCHes are in flight, whose responses may land
 *    in either order. Without the sequence number the older answer wins and
 *    the UI settles on the value the user moved AWAY from — while the database
 *    holds the newer one, so a refresh silently changes it back.
 *
 * 2. **Only the keys in `optimistic` are written, on success and on rollback.**
 *    The response carries the whole preferences row, and another control may
 *    have a newer optimistic value sitting in it. Applying the row would undo
 *    that control's change with data that was already stale when it was sent.
 *
 * 3. **Rollback goes to the last CONFIRMED value, not the value on screen.**
 *    What is on screen may itself be an unconfirmed optimistic value, so
 *    rolling back to it would keep showing a change the server rejected.
 *
 * The sequence counter and the confirmed snapshot are refs, not state: they
 * must be read and written inside an in-flight promise without re-rendering,
 * and a stale closure over either is exactly the bug this hook exists to
 * prevent.
 *
 * `control` names the logical control, and `endpoint` lets one live elsewhere
 * — AI Training is a `users` column behind `/api/user/model-training-consent`,
 * not a `user_preferences` one, and it still needs this sequencing.
 */
export function usePreferenceSave(
  control: string,
  endpoint = "/api/user/preferences",
): PreferenceSave {
  const { preferences, setLocal } = usePreferences();
  const { toast } = useToast();
  const t = useTranslations("settings");
  const [saving, setSaving] = useState(false);

  const sequence = useRef(0);
  const confirmed = useRef<Partial<UserPreferences>>({});
  // Refs over the render values, so `save` never closes over a stale snapshot.
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const save = useCallback(
    async (
      body: Record<string, unknown>,
      optimistic: Partial<UserPreferences>,
    ): Promise<PreferenceSaveOutcome> => {
      const keys = Object.keys(optimistic) as (keyof UserPreferences)[];

      // Seed the confirmed snapshot from what is on screen the FIRST time this
      // control saves a key — at that point the two are the same, because no
      // unconfirmed value for it can exist yet.
      for (const key of keys) {
        if (!(key in confirmed.current)) {
          confirmed.current[key] = preferencesRef.current[key] as never;
        }
      }

      const seq = (sequence.current += 1);
      setSaving(true);
      setLocal(optimistic);

      const rollback = () => {
        const restored: Partial<UserPreferences> = {};
        for (const key of keys) restored[key] = confirmed.current[key] as never;
        setLocal(restored);
        toast({ title: t("save.failed"), variant: "danger" });
      };

      try {
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        // A superseded request's outcome is not this control's business any
        // more — neither its success nor its failure. Checked before the body
        // is read so a stale failure cannot raise a toast about a value the
        // user has already moved past.
        if (seq !== sequence.current) return "superseded";

        if (!response.ok) {
          rollback();
          return "failed";
        }

        // The server canonicalises (`every_day` rewrites `scheduleDays`), so
        // the confirmed value is ITS answer, not the optimistic guess. Only
        // this save's own keys are taken from it — see rule 2 above.
        const json = (await response.json()) as { data?: Partial<UserPreferences> };
        const applied: Partial<UserPreferences> = {};
        for (const key of keys) {
          const value = json.data?.[key];
          applied[key] = (value === undefined ? optimistic[key] : value) as never;
        }
        Object.assign(confirmed.current, applied);
        setLocal(applied);
        return "saved";
      } catch {
        if (seq !== sequence.current) return "superseded";
        rollback();
        return "failed";
      } finally {
        if (seq === sequence.current) setSaving(false);
      }
    },
    [endpoint, setLocal, t, toast],
  );

  return { save, saving };
}
