import { REDUCE_MOTION_ATTR, REDUCE_MOTION_QUERY } from "@/lib/motion/motion-enabled";
import { DISPLAY_SCALE_FACTOR, type UserPreferences } from "./options";

/**
 * The inline script the `(protected)` layout emits so appearance is correct
 * before paint, the same pattern `themeInitScript` already uses for theme.
 *
 * `--display-scale` goes on `<html>`, which IS `:root`, so `globals.css`'s
 * `--density-unit` substitutes it on the element that declares it and every
 * `[data-density]` subtree inherits the number. Portals scale too.
 *
 * `effectiveReduceMotion = account || OS` (settings spec §4.5): Korume may add
 * reduction, never remove the OS's. For a signed-in reader the account is the
 * source and this runs after `themeInitScript`, which seeded the attribute
 * from `localStorage` — the logged-out fallback.
 *
 * Every interpolated value is a server-derived enum or boolean, never user
 * text, so inlining is safe. The whole body is wrapped in try/catch: a browser
 * that throws on `matchMedia` must not block paint.
 */
export function appearanceScript(prefs: Pick<UserPreferences, "displayScale" | "reduceMotion">): string {
  const scale = DISPLAY_SCALE_FACTOR[prefs.displayScale];
  const account = prefs.reduceMotion ? "true" : "false";
  return `(function(){try{var d=document.documentElement;d.style.setProperty("--display-scale","${scale}");var os=window.matchMedia("${REDUCE_MOTION_QUERY}").matches;d.setAttribute("${REDUCE_MOTION_ATTR}",(${account}||os)?"true":"false");}catch(e){}})();`;
}
