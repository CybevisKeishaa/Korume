import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnreadIncreasePulse } from "./use-unread-increase-pulse";

describe("useUnreadIncreasePulse", () => {
  it("does not pulse for the initial observed value, even if positive", () => {
    const { result } = renderHook(() => useUnreadIncreasePulse(3));
    expect(result.current).toBe(0);
  });

  it("pulses (increments the key) when the value rises after being observed", () => {
    const { result, rerender } = renderHook(({ value }) => useUnreadIncreasePulse(value), {
      initialProps: { value: 1 },
    });
    expect(result.current).toBe(0);

    rerender({ value: 2 });
    expect(result.current).toBe(1);
  });

  it("does not pulse when the value falls", () => {
    const { result, rerender } = renderHook(({ value }) => useUnreadIncreasePulse(value), {
      initialProps: { value: 5 },
    });

    rerender({ value: 2 });
    expect(result.current).toBe(0);
  });

  it("does not pulse when the value is unchanged", () => {
    const { result, rerender } = renderHook(({ value }) => useUnreadIncreasePulse(value), {
      initialProps: { value: 2 },
    });

    rerender({ value: 2 });
    expect(result.current).toBe(0);
  });

  it("pulses again (a distinct key) on a second increase, not a repeating loop", () => {
    const { result, rerender } = renderHook(({ value }) => useUnreadIncreasePulse(value), {
      initialProps: { value: 0 },
    });

    rerender({ value: 1 });
    expect(result.current).toBe(1);

    rerender({ value: 1 }); // unchanged — no extra pulse
    expect(result.current).toBe(1);

    rerender({ value: 3 });
    expect(result.current).toBe(2);
  });

  it("pulses again after dropping back to zero and rising once more", () => {
    const { result, rerender } = renderHook(({ value }) => useUnreadIncreasePulse(value), {
      initialProps: { value: 2 },
    });

    rerender({ value: 0 });
    expect(result.current).toBe(0);

    rerender({ value: 1 });
    expect(result.current).toBe(1);
  });
});
