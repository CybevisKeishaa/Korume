"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { REDUCE_MOTION_QUERY } from "@/lib/motion/motion-enabled";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  /** App-level reduce-motion toggle (in addition to the OS setting). */
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "nc-theme";
const MOTION_KEY = "nc-reduce-motion";

/**
 * Inline script that runs before hydration to set the initial theme +
 * reduce-motion attributes on <html>, preventing a flash of the wrong theme.
 * Injected verbatim in the root layout <head>.
 */
export const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem("${THEME_KEY}");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    // The stored value is the ACCOUNT's own choice; the attribute is the
    // effective one. Deriving it here rather than trusting a non-null stored
    // value is what lets an account's own "false" survive the OS setting
    // being turned off later.
    var m = localStorage.getItem("${MOTION_KEY}") === "true";
    var os = window.matchMedia("${REDUCE_MOTION_QUERY}").matches;
    document.documentElement.setAttribute("data-reduce-motion", (m || os) ? "true" : "false");
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [reduceMotion, setReduceMotionState] = useState(false);

  // Sync from the DOM attributes the init script already set.
  useEffect(() => {
    const root = document.documentElement;
    setTheme((root.getAttribute("data-theme") as Theme) ?? "light");
    setReduceMotionState(root.getAttribute("data-reduce-motion") === "true");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  /**
   * `value` is the ACCOUNT's own choice, and that is what gets STORED. The
   * attribute and the exposed state carry the EFFECTIVE value, `account || OS`
   * — the same truth table `appearanceScript` writes before paint.
   *
   * ⚠️ The OR used to happen before this call, so the OR'd value was what
   * reached `localStorage`. A reader whose OS asked for reduced motion and who
   * then switched Korume off stored `"true"`; once they turned the OS setting
   * off, `themeInitScript` found a non-null `"true"`, never consulted
   * `matchMedia` again, and every public page kept reducing motion forever.
   * The account's own `false` was unrecoverable. Spec §4.5 lets Korume ADD
   * reduction, not remember one that is no longer asked for.
   */
  const setReduceMotion = useCallback((value: boolean) => {
    try {
      localStorage.setItem(MOTION_KEY, String(value));
    } catch {}
    // Optional-call: jsdom provides no `matchMedia` unless a test stubs one,
    // and `reduce-motion-toggle.test.tsx` deliberately does not.
    const effective = value || (window.matchMedia?.(REDUCE_MOTION_QUERY).matches ?? false);
    setReduceMotionState(effective);
    document.documentElement.setAttribute("data-reduce-motion", String(effective));
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, reduceMotion, setReduceMotion }),
    [theme, toggleTheme, reduceMotion, setReduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
