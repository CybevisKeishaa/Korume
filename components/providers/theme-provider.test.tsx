import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { motionEnabled, REDUCE_MOTION_ATTR } from "@/lib/motion/motion-enabled";
import { ThemeProvider, useTheme } from "./theme-provider";

function stubOsReduces(osReduces: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion") && osReduces,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(REDUCE_MOTION_ATTR);
});

describe("ThemeProvider reduced motion", () => {
  it("writes the attribute so CSS and JS read the same answer", () => {
    stubOsReduces(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setReduceMotion(true));

    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe("true");
    expect(motionEnabled()).toBe(false);
  });

  /**
   * Settings spec §4.5: Korume may add reduction, never remove the OS's.
   *
   * ⚠️ The attribute is the EFFECTIVE value, `account || OS` — the same truth
   * table `appearance-script.test.ts` pins for the before-paint script, so the
   * two paths cannot disagree about what `<html>` says. This assertion used to
   * read `"false"`, i.e. the account value, and that reading is what made it
   * safe to store the OR'd value; storing it is the bug this branch fixed.
   *
   * What is stored stays the account's own choice — asserted below, and the
   * only reason an account `false` can survive the OS setting being turned
   * off later.
   */
  it("cannot re-enable motion the OS has asked to reduce", () => {
    stubOsReduces(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setReduceMotion(false));

    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe("true");
    expect(motionEnabled()).toBe(false);
    expect(localStorage.getItem("nc-reduce-motion")).toBe("false");
  });

  /**
   * The regression this branch exists for, stated as a sequence rather than a
   * state: an account that says "do not reduce" must come back once the OS
   * stops asking. While the OR'd value was persisted, the stored `"true"`
   * outlived the OS setting and there was no way to recover the account's own
   * answer on any page that only reads storage.
   */
  it("stores the account's own choice, so it survives the OS setting going away", () => {
    stubOsReduces(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setReduceMotion(false));
    expect(localStorage.getItem("nc-reduce-motion")).toBe("false");

    stubOsReduces(false);
    act(() => result.current.setReduceMotion(false));

    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe("false");
    expect(motionEnabled()).toBe(true);
  });

  it("allows motion only when neither input asks to reduce it", () => {
    stubOsReduces(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setReduceMotion(false));

    expect(motionEnabled()).toBe(true);
  });
});
