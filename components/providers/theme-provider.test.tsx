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

  // Settings spec §4.5: Korume may add reduction, never remove the OS's.
  // Turning the app toggle off writes "false" — and motion must still be off,
  // because `motionEnabled()` ORs the attribute with the live media query.
  it("cannot re-enable motion the OS has asked to reduce", () => {
    stubOsReduces(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setReduceMotion(false));

    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe("false");
    expect(motionEnabled()).toBe(false);
  });

  it("allows motion only when neither input asks to reduce it", () => {
    stubOsReduces(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setReduceMotion(false));

    expect(motionEnabled()).toBe(true);
  });
});
