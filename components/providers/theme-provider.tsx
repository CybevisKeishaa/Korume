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
  /**
   * EFFECTIVE reduced motion, `account || OS`. This is what gates animation —
   * `companion-sprite`, `smooth-scroll`, `stroke-order` and `transcript-pane`
   * all read it, and under-reducing is an accessibility defect (`AGENTS.md`
   * §2.4), so the OS must be folded in here.
   */
  reduceMotion: boolean;
  /**
   * The ACCOUNT's own answer, which is a different question and has exactly
   * one consumer: `ReduceMotionToggle`'s `checked`.
   *
   * ⚠️ Binding that checkbox to `reduceMotion` looks right and is not: on a
   * machine whose OS asks for reduced motion, unchecking it recomputes to
   * `true` and the box snaps back, for ever, with no explanation. A control
   * that does not follow the person operating it is broken even when the
   * behaviour behind it is correct.
   */
  accountReduceMotion: boolean;
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
  const [accountReduceMotion, setAccountReduceMotion] = useState(false);

  // Sync from what the init script already wrote. The attribute is the
  // EFFECTIVE value, storage is the ACCOUNT's own — the two are different
  // questions, so they come from different places.
  useEffect(() => {
    const root = document.documentElement;
    setTheme((root.getAttribute("data-theme") as Theme) ?? "light");
    setReduceMotionState(root.getAttribute("data-reduce-motion") === "true");
    try {
      setAccountReduceMotion(localStorage.getItem(MOTION_KEY) === "true");
    } catch {}
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
   * Three destinations, and they deliberately do NOT all get the same value.
   *
   * - **`localStorage` and `accountReduceMotion` get the ACCOUNT's own
   *   choice.** That state drives `ReduceMotionToggle`'s `checked`, and a
   *   control that does not follow the person operating it is broken: handing
   *   it the OR'd value made the box snap straight back to checked, for ever,
   *   with no explanation, on any machine whose OS asks for reduced motion.
   * - **`data-reduce-motion` and `reduceMotion` get the EFFECTIVE value**,
   *   `account || OS` — the same truth table `appearanceScript` writes before
   *   paint, so the two pre-paint writers cannot disagree about what `<html>`
   *   says, and the four components that gate animation on `reduceMotion`
   *   cannot under-reduce.
   *
   * ⚠️ The OR used to happen before this call, so the OR'd value was what
   * reached `localStorage`. A reader whose OS asked for reduced motion and who
   * then switched Korume off stored `"true"`; once they turned the OS setting
   * off, `themeInitScript` found a non-null `"true"`, never consulted
   * `matchMedia` again, and every public page kept reducing motion forever.
   * The account's own `false` was unrecoverable. Spec §4.5 lets Korume ADD
   * reduction, not remember one that is no longer asked for.
   *
   * Motion is never wrongly ENABLED by any of this: `motionEnabled()` and
   * `globals.css` each OR the attribute with the live media query themselves.
   */
  const setReduceMotion = useCallback((value: boolean) => {
    try {
      localStorage.setItem(MOTION_KEY, String(value));
    } catch {}
    setAccountReduceMotion(value);
    // Optional-call: jsdom provides no `matchMedia` unless a test stubs one,
    // and `reduce-motion-toggle.test.tsx` deliberately does not.
    const effective = value || (window.matchMedia?.(REDUCE_MOTION_QUERY).matches ?? false);
    setReduceMotionState(effective);
    document.documentElement.setAttribute("data-reduce-motion", String(effective));
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, reduceMotion, accountReduceMotion, setReduceMotion }),
    [theme, toggleTheme, reduceMotion, accountReduceMotion, setReduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
