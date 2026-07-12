"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
    var m = localStorage.getItem("${MOTION_KEY}");
    if (m === null) m = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "true" : "false";
    document.documentElement.setAttribute("data-reduce-motion", m);
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

  const setReduceMotion = useCallback((value: boolean) => {
    setReduceMotionState(value);
    document.documentElement.setAttribute("data-reduce-motion", String(value));
    try {
      localStorage.setItem(MOTION_KEY, String(value));
    } catch {}
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
