"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { REDUCE_MOTION_QUERY } from "@/lib/motion/motion-enabled";
import { DEFAULT_PREFERENCES, DISPLAY_SCALE_FACTOR, type UserPreferences } from "@/lib/preferences/options";

interface PreferencesContextValue {
  preferences: UserPreferences;
  /**
   * Apply a change locally, before (or without) a save. Task 8's save hook
   * calls this optimistically and again with the server's answer, so it merges
   * a patch and never replaces the row — another control may have saved in
   * between.
   */
  setLocal: (patch: Partial<UserPreferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Session-scoped preferences, seeded by the `(protected)` layout from the
 * server read. It owns no persistence: the API is the store, and reduced
 * motion stays the theme provider's to apply so `<html>` has exactly one
 * runtime writer.
 */
export function PreferencesProvider({
  initial,
  children,
}: {
  initial: UserPreferences;
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(initial);
  const { setReduceMotion } = useTheme();

  const setLocal = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...patch }));

      if (patch.displayScale !== undefined) {
        document.documentElement.style.setProperty(
          "--display-scale",
          String(DISPLAY_SCALE_FACTOR[patch.displayScale]),
        );
      }

      if (patch.reduceMotion !== undefined) {
        // Spec §4.5 — Korume may add reduction, never remove the OS's — is
        // still the rule, but the OR now lives in `setReduceMotion` and in
        // `themeInitScript`, at the READ. Passing the OR'd value here stored
        // it, and an account's own `false` could then never be recovered on a
        // public page once the OS setting changed.
        setReduceMotion(patch.reduceMotion);
      }
    },
    [setReduceMotion],
  );

  const value = useMemo(() => ({ preferences, setLocal }), [preferences, setLocal]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within <PreferencesProvider>");
  return ctx;
}

/**
 * The preferences, or the defaults when there is no provider.
 *
 * For shared hooks that a surface outside the session shell may mount —
 * `useRecorder` is one, and it is rendered in tests and stories without the
 * `(protected)` layout. Defaulting matches `readPreferences`, which also never
 * throws: a missing provider must not break recording, and the defaults are
 * the behaviour every reader had before preferences existed.
 *
 * A component that genuinely needs the session's own values, or `setLocal`,
 * uses `usePreferences` and gets a loud failure instead.
 */
export function useOptionalPreferences(): UserPreferences {
  return useContext(PreferencesContext)?.preferences ?? DEFAULT_PREFERENCES;
}
