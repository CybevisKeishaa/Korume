import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// --- Radix primitives under jsdom -------------------------------------------
// Radix (and the floating-ui positioning inside Select/Tooltip/Popover) calls
// DOM APIs jsdom doesn't implement. Guarded: node-environment test files
// (middleware tests) have no window; existing jsdom globals are never replaced.
if (typeof window !== "undefined") {
  if (!window.ResizeObserver) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  // jsdom does not implement matchMedia. lib/motion/motion-enabled.ts's
  // motionEnabled()/subscribeMotionEnabled() call it unconditionally, so any
  // component that consumes the reduce-motion gate needs it defined just to
  // mount under test. `matches: false` means a consumer test's outcome is
  // governed by the `data-reduce-motion` attribute it sets, not by this
  // default. Guarded like ResizeObserver above: a test that needs to *drive*
  // OS-query changes (lib/motion/motion-enabled.test.ts) installs its own
  // `vi.stubGlobal("matchMedia", ...)`, which wins for that file the same way
  // Radix tests can override this ResizeObserver stub.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
