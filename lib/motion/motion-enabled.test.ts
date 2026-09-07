import { afterEach, describe, expect, it, vi } from "vitest";
import { motionEnabled, subscribeMotionEnabled, REDUCE_MOTION_ATTR } from "./motion-enabled";

/**
 * Drives the OS query independently of the attribute, so the OR is testable.
 *
 * `matches` is exposed as a getter over a variable captured in this closure
 * (not a fixed value baked into the returned object), so a caller can flip it
 * after subscribing and have every `matchMedia()` call — including the one
 * inside `subscribeMotionEnabled`'s own listener re-checks — see the new
 * value. `setMatches` mutates it; `listeners` is the set of `"change"`
 * listeners registered against this mock, so a test can invoke them directly
 * to simulate the OS firing a change event (jsdom does not fire one itself).
 */
function mockOsReduce(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    })),
  );
  return { listeners, setMatches: (next: boolean) => { matches = next; } };
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

  it("notifies subscribers when the OS query changes after subscribing", async () => {
    const { listeners, setMatches } = mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    const seen: boolean[] = [];
    const unsubscribe = subscribeMotionEnabled((enabled) => seen.push(enabled));

    setMatches(true);
    // jsdom's mock doesn't fire "change" on its own; invoke the listener(s)
    // subscribeMotionEnabled registered, the way a real MediaQueryList would.
    expect(listeners.size).toBeGreaterThan(0);
    listeners.forEach((l) => l());
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
