"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { REDUCE_MOTION_QUERY } from "@/lib/motion/motion-enabled";
import { DISPLAY_SCALE_FACTOR, type UserPreferences } from "@/lib/preferences/options";

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
        // Spec §4.5: Korume may add reduction, never remove the OS's, so the
        // account value is ORed with the live media query rather than trusted.
        const osReduces = window.matchMedia(REDUCE_MOTION_QUERY).matches;
        setReduceMotion(patch.reduceMotion || osReduces);
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
