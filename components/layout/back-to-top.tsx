"use client";

import { motionEnabled } from "@/lib/motion/motion-enabled";
import { AppFooterIcon } from "./app-footer-icon";

/**
 * App-footer spec F3. The `(app)` layout has no scroll container, so the WINDOW scrolls. Focus then moves to
 * `<main id="main-content">` (tabIndex -1) so keyboard and screen-reader users land at the top too.
 */
export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="app-footer__top"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: motionEnabled() ? "smooth" : "auto" });
        document.getElementById("main-content")?.focus({ preventScroll: true });
      }}
    >
      {label}
      <AppFooterIcon name="arrowUpRight" className="app-footer__top-icon" />
    </button>
  );
}
