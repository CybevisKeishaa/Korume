import { afterEach, describe, expect, it, vi } from "vitest";
import { motionEnabled, subscribeMotionEnabled, REDUCE_MOTION_ATTR } from "./motion-enabled";

/** Drives the OS query independently of the attribute, so the OR is testable. */
function mockOsReduce(matches: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    })),
  );
  return listeners;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(REDUCE_MOTION_ATTR);
});

describe("motionEnabled", () => {
  it("is true only when NEITHER the OS nor the app asks for reduced motion", () => {
    mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    expect(motionEnabled()).toBe(true);
  });

  // The OR, one row per combination. This is the whole point of the module:
  // globals.css disables motion from two independent blocks, so either input
  // alone must disable it here too.
  it.each([
    { os: true, app: "false", name: "OS alone" },
    { os: false, app: "true", name: "app toggle alone" },
    { os: true, app: "true", name: "both" },
  ])("is false when $name asks for reduced motion", ({ os, app }) => {
    mockOsReduce(os);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, app);
    expect(motionEnabled()).toBe(false);
  });

  it("treats a missing attribute as 'not reduced' and defers to the OS", () => {
    mockOsReduce(false);
    expect(motionEnabled()).toBe(true);
  });

  it("notifies subscribers when the app toggle mutates after subscribing", async () => {
    mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    const seen: boolean[] = [];
    const unsubscribe = subscribeMotionEnabled((enabled) => seen.push(enabled));

    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "true");
    await vi.waitFor(() => expect(seen).toContain(false));

    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    const seen: boolean[] = [];
    subscribeMotionEnabled((enabled) => seen.push(enabled))();

    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "true");
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([]);
  });
});
