import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_SUBMITTED_EVENT, type NavSummary } from "@/lib/nav/nav-state";

let pathname = "/dashboard";
vi.mock("@/lib/i18n/navigation", () => ({ usePathname: () => pathname }));
import { pageReload, reloadForSignIn, useNavSummary } from "./use-nav-summary";

const first: NavSummary = { name: "Yuki", avatarUrl: null, plan: "free", reviewDue: 32, reviewHref: "/kanji/review" };
const next: NavSummary = { ...first, reviewDue: 31 };
const ok = (data: NavSummary) => new Response(JSON.stringify({ data }), { status: 200 });
let reload: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pathname = "/dashboard";
  sessionStorage.clear();
  reload = vi.spyOn(pageReload, "run").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useNavSummary", () => {
  it("starts from the server value and replaces it with the fetched one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(next)));
    const { result } = renderHook(() => useNavSummary(first));
    expect(result.current).toEqual(first);
    await waitFor(() => expect(result.current?.reviewDue).toBe(31));
  });
  it("keeps the last good value on a network error or a 5xx", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => useNavSummary(first));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    pathname = "/kanji"; rerender();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual(first);
  });
  it("on 401 clears every personal field before reloading once", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { result } = renderHook(() => useNavSummary(first));
    await waitFor(() => expect(result.current).toBeNull());
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("refetches when a review is saved, without a route change", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(first)).mockResolvedValueOnce(ok(next));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNavSummary(first));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => { window.dispatchEvent(new Event(REVIEW_SUBMITTED_EVENT)); });
    await waitFor(() => expect(result.current?.reviewDue).toBe(31));
  });
  it("aborts the stale request so a late response cannot win", async () => {
    let resolveSlow!: (r: Response) => void;
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return signals.length === 1 ? new Promise<Response>((r) => { resolveSlow = r; }) : Promise.resolve(ok(next));
    }));
    const { result, rerender } = renderHook(() => useNavSummary(first));
    pathname = "/kanji"; rerender();
    await waitFor(() => expect(result.current?.reviewDue).toBe(31));
    expect(signals[0]?.aborted).toBe(true);
    resolveSlow(ok({ ...first, reviewDue: 99 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current?.reviewDue).toBe(31);
  });
});

describe("reloadForSignIn", () => {
  it("reloads once, then not again within 10s", () => {
    expect(reloadForSignIn(1_000)).toBe(true);
    expect(reloadForSignIn(5_000)).toBe(false);
    expect(reloadForSignIn(12_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
