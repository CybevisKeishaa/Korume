import { afterEach, describe, expect, it, vi } from "vitest";
import { REDUCE_MOTION_ATTR } from "@/lib/motion/motion-enabled";
import { DISPLAY_SCALE_FACTOR, type DisplayScale } from "./options";
import { appearanceScript } from "./appearance-script";

/** Run the emitted script the way the browser would, against this JSDOM. */
function runScript(displayScale: DisplayScale, reduceMotion: boolean, osReduces: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("reduced-motion") && osReduces })),
  );
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute(REDUCE_MOTION_ATTR);
  new Function(appearanceScript({ displayScale, reduceMotion }))();
  return {
    scale: document.documentElement.style.getPropertyValue("--display-scale"),
    reduce: document.documentElement.getAttribute(REDUCE_MOTION_ATTR),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appearanceScript", () => {
  it.each(["normal", "large", "extra_large"] as const)(
    "sets --display-scale to the %s factor from its one home",
    (displayScale) => {
      expect(runScript(displayScale, false, false).scale).toBe(String(DISPLAY_SCALE_FACTOR[displayScale]));
    },
  );

  // Spec §4.5: effectiveReduceMotion = account || OS. Korume may add
  // reduction, never remove the OS's. All four combinations.
  it.each([
    [false, false, "false"],
    [true, false, "true"],
    [false, true, "true"],
    [true, true, "true"],
  ])("account %s with OS %s gives data-reduce-motion %s", (account, os, expected) => {
    expect(runScript("normal", account, os).reduce).toBe(expected);
  });

  it("survives a browser that throws on matchMedia rather than blocking paint", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("no matchMedia");
    });
    document.documentElement.removeAttribute(REDUCE_MOTION_ATTR);
    expect(() => new Function(appearanceScript({ displayScale: "large", reduceMotion: false }))()).not.toThrow();
  });

  it("inlines no user-controlled text", () => {
    // Every value is a server-derived enum or boolean, so the emitted source
    // must contain nothing but digits, `true`/`false` and the fixed literals.
    const script = appearanceScript({ displayScale: "extra_large", reduceMotion: true });
    expect(script).not.toMatch(/<\/script/i);
    expect(script).toContain(String(DISPLAY_SCALE_FACTOR.extra_large));
  });
});
