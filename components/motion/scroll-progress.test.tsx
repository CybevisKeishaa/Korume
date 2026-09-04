import { render } from "@/test/render";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ScrollProgress,
  sectionProgress,
  SCROLL_PROGRESS_ATTR,
  SCROLL_PROGRESS_VAR,
} from "./scroll-progress";

function rect(top: number, height: number): DOMRect {
  return { top, height, bottom: top + height } as DOMRect;
}

// matchMedia is stubbed globally in vitest.setup.ts (matches: false) — every
// test here relies on that shared default, not a local override.
afterEach(() => vi.unstubAllGlobals());

describe("sectionProgress", () => {
  it("is 0 when the section's top is exactly at the viewport bottom", () => {
    expect(sectionProgress(rect(800, 600), 800)).toBe(0);
  });

  it("is 1 when the section's bottom has reached the viewport top", () => {
    expect(sectionProgress(rect(-600, 600), 800)).toBe(1);
  });

  it("is 0.5 at the midpoint of its travel", () => {
    // total travel = height + viewport = 1400; halfway = top at 800 - 700 = 100
    expect(sectionProgress(rect(100, 600), 800)).toBeCloseTo(0.5, 5);
  });

  it("clamps below 0 and above 1 rather than reporting out-of-range values", () => {
    expect(sectionProgress(rect(2000, 600), 800)).toBe(0);
    expect(sectionProgress(rect(-5000, 600), 800)).toBe(1);
  });
});

describe("<ScrollProgress />", () => {
  // ⚠️ 0, not 1. See the settle() docblock: a static transform driven by this
  // property is reachable by NEITHER kill-switch block, so settling to the
  // "finished" value would leave a reduce-motion reader looking at a hero card
  // permanently at scale(0.94).
  it("settles to the undistorted state once and starts no loop when motion is off", () => {
    document.documentElement.setAttribute("data-reduce-motion", "true");
    const section = document.createElement("section");
    section.setAttribute(SCROLL_PROGRESS_ATTR, "");
    document.body.append(section);
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(<ScrollProgress />);

    expect(section.style.getPropertyValue(SCROLL_PROGRESS_VAR)).toBe("0");
    expect(raf).not.toHaveBeenCalled();

    section.remove();
    document.documentElement.removeAttribute("data-reduce-motion");
  });

  it("disconnects its observer and cancels a REAL frame on unmount", () => {
    document.documentElement.setAttribute("data-reduce-motion", "false");

    // ⚠️ The section must exist. ScrollProgress returns early when it finds no
    // `[data-scroll-progress]`, so without this the effect never builds an
    // observer, `disconnect` is never called, and the test fails for a reason
    // that has nothing to do with teardown.
    const section = document.createElement("section");
    section.setAttribute(SCROLL_PROGRESS_ATTR, "");
    document.body.append(section);

    const disconnect = vi.fn();
    // Capture the callback so the test can drive an intersection. Without one,
    // `active` stays empty, no frame is ever scheduled, and the cancel
    // assertion below would be satisfied by a no-op `cancelAnimationFrame(0)`
    // — green while proving nothing.
    let fire: ((entries: unknown[]) => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          fire = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = render(<ScrollProgress />);
    fire?.([{ target: section, isIntersecting: true }]);

    unmount();

    expect(disconnect).toHaveBeenCalled();
    // A real frame id, not 0: the loop was genuinely running when we unmounted.
    const cancelled = cancel.mock.calls.at(-1)?.[0];
    expect(cancelled).toBeGreaterThan(0);

    section.remove();
    document.documentElement.removeAttribute("data-reduce-motion");
  });

  // Round-1 review finding: pausing the loop must not stay paused only by
  // accident of `active` being empty. A stale re-intersect (scroll the
  // section out and back, or a resize) must NOT resume live writes for a
  // reader who is currently asking for no motion.
  it("does not resume the loop from a stale re-intersect after motion is turned off mid-session", async () => {
    document.documentElement.setAttribute("data-reduce-motion", "false");
    const section = document.createElement("section");
    section.setAttribute(SCROLL_PROGRESS_ATTR, "");
    document.body.append(section);

    let fire: ((entries: unknown[]) => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          fire = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );

    render(<ScrollProgress />);
    fire?.([{ target: section, isIntersecting: true }]);

    // Reader turns reduce-motion on mid-session.
    document.documentElement.setAttribute("data-reduce-motion", "true");
    await vi.waitFor(() =>
      expect(section.style.getPropertyValue(SCROLL_PROGRESS_VAR)).toBe("0"),
    );

    const raf = vi.spyOn(window, "requestAnimationFrame");
    raf.mockClear();

    // Scroll the section out of view and back in while motion is still off.
    fire?.([{ target: section, isIntersecting: false }]);
    fire?.([{ target: section, isIntersecting: true }]);

    expect(raf).not.toHaveBeenCalled();

    section.remove();
    document.documentElement.removeAttribute("data-reduce-motion");
  });

  it("restarts the loop when motion is turned back on while a section is still intersecting", async () => {
    document.documentElement.setAttribute("data-reduce-motion", "false");
    const section = document.createElement("section");
    section.setAttribute(SCROLL_PROGRESS_ATTR, "");
    document.body.append(section);

    let fire: ((entries: unknown[]) => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          fire = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );

    render(<ScrollProgress />);
    fire?.([{ target: section, isIntersecting: true }]);

    document.documentElement.setAttribute("data-reduce-motion", "true");
    await vi.waitFor(() =>
      expect(section.style.getPropertyValue(SCROLL_PROGRESS_VAR)).toBe("0"),
    );

    const raf = vi.spyOn(window, "requestAnimationFrame");
    raf.mockClear();

    // Reader turns motion back on; the section never left the DOM or the
    // observer, so the loop must resume without needing a fresh intersection.
    document.documentElement.setAttribute("data-reduce-motion", "false");
    await vi.waitFor(() => expect(raf).toHaveBeenCalled());

    section.remove();
    document.documentElement.removeAttribute("data-reduce-motion");
  });
});
