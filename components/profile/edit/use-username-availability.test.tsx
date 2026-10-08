import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUsernameAvailability } from "./use-username-availability";

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (data: unknown) => fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data }) });

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useUsernameAvailability", () => {
  it("waits 400 ms, then asks once with the normalised value", async () => {
    answer({ available: false, reason: "taken" });
    const { result } = renderHook(() => useUsernameAvailability("  Mika_1 ", "keishaa"));
    expect(result.current).toBe("checking");
    await act(async () => { await vi.advanceTimersByTimeAsync(399); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/profile/username?value=mika_1");
    expect(result.current).toBe("taken");
  });

  it("reports available", async () => {
    answer({ available: true });
    const { result } = renderHook(() => useUsernameAvailability("mika_1", null));
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(result.current).toBe("available");
  });

  it("does not call while the local validator already fails, is empty, or equals the saved name", async () => {
    const { result, rerender } = renderHook(({ v }) => useUsernameAvailability(v, "keishaa"), { initialProps: { v: "ab" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    rerender({ v: "admin" });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    rerender({ v: "" });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    rerender({ v: "Keishaa" });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });

  it("a network failure is silent (Save and the database stay the authority)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useUsernameAvailability("mika_1", null));
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(result.current).toBe("idle");
  });
});
