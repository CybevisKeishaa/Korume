import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { REDUCE_MOTION_ATTR } from "@/lib/motion/motion-enabled";
import { DEFAULT_PREFERENCES, DISPLAY_SCALE_FACTOR } from "@/lib/preferences/options";
import { PreferencesProvider, usePreferences } from "./preferences-provider";

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

function mount(initial = DEFAULT_PREFERENCES) {
  return renderHook(() => usePreferences(), {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <PreferencesProvider initial={initial}>{children}</PreferencesProvider>
      </ThemeProvider>
    ),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute(REDUCE_MOTION_ATTR);
});

describe("usePreferences", () => {
  it("throws outside the provider", () => {
    expect(() => renderHook(() => usePreferences())).toThrow(/PreferencesProvider/);
  });

  it("serves the server-read preferences it was seeded with", () => {
    stubOsReduces(false);
    const { result } = mount({ ...DEFAULT_PREFERENCES, difficulty: "challenge", dailyMinutes: 30 });
    expect(result.current.preferences.difficulty).toBe("challenge");
    expect(result.current.preferences.dailyMinutes).toBe(30);
  });

  it("merges a patch instead of replacing the row", () => {
    stubOsReduces(false);
    const { result } = mount({ ...DEFAULT_PREFERENCES, dailyMinutes: 30 });

    act(() => result.current.setLocal({ difficulty: "easy" }));

    expect(result.current.preferences.difficulty).toBe("easy");
    expect(result.current.preferences.dailyMinutes).toBe(30);
  });

  it("writes --display-scale on <html> so the change is visible before any save", () => {
    stubOsReduces(false);
    const { result } = mount();

    act(() => result.current.setLocal({ displayScale: "extra_large" }));

    expect(document.documentElement.style.getPropertyValue("--display-scale")).toBe(
      String(DISPLAY_SCALE_FACTOR.extra_large),
    );
  });

  it("leaves --display-scale alone for a patch that does not mention it", () => {
    stubOsReduces(false);
    const { result } = mount();

    act(() => result.current.setLocal({ reviewFrequency: "more" }));

    expect(document.documentElement.style.getPropertyValue("--display-scale")).toBe("");
  });

  it("turns reduced motion on through the theme provider", () => {
    stubOsReduces(false);
    const { result } = mount();

    act(() => result.current.setLocal({ reduceMotion: true }));

    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe("true");
  });

  // Spec §4.5: Korume may add reduction, never remove the OS's.
  it("cannot turn reduced motion off while the OS asks for it", () => {
    stubOsReduces(true);
    const { result } = mount({ ...DEFAULT_PREFERENCES, reduceMotion: true });

    act(() => result.current.setLocal({ reduceMotion: false }));

    expect(result.current.preferences.reduceMotion).toBe(false); // the account value is what it says
    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe("true"); // the effect is not
  });

  /**
   * ⚠️ What is STORED must be the account's answer, never the OR'd one.
   *
   * `setLocal` used to hand `setReduceMotion` the value already ORed with the
   * live media query, and `theme-provider` writes its argument to
   * `localStorage`. So a reader whose OS asked for reduced motion and who then
   * switched Korume off stored `"true"` — and once they turned the OS setting
   * off, `themeInitScript` saw a non-null `"true"` and kept every public page
   * reduced forever, with no way to recover the `false` they had chosen.
   *
   * The effect is still `account || OS`; that OR just belongs at the read.
   * This asserts storage rather than the attribute because the attribute is
   * the effective value and cannot tell the two implementations apart — the
   * mutation that restored the bug left every other test in this file green.
   */
  it("stores the account's own answer, not the one ORed with the OS", () => {
    stubOsReduces(true);
    const { result } = mount({ ...DEFAULT_PREFERENCES, reduceMotion: true });

    act(() => result.current.setLocal({ reduceMotion: false }));

    expect(localStorage.getItem("nc-reduce-motion")).toBe("false");
  });
});
