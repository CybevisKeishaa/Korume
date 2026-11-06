import { act } from "@testing-library/react";
import { renderHook } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKanjiModalHistory } from "./use-kanji-modal-history";

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }));
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router, usePathname: () => "/kanji" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(url.search) }));

beforeEach(() => {
  vi.clearAllMocks();
  url.search = "";
});

describe("useKanjiModalHistory", () => {
  it("a param present on first render (shared link, refresh) closes with replace, kanji and from removed", () => {
    url.search = "level=N5&kanji=%E6%97%A5&from=level%3AN5";
    const { result } = renderHook(() => useKanjiModalHistory());
    expect(result.current).toMatchObject({ literal: "日", from: "level:N5", openedInApp: false });
    act(() => result.current.close());
    expect(router.replace).toHaveBeenCalledWith("/kanji?level=N5", { scroll: false });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("a param that appears after mount (link click, Forward) closes with back", () => {
    url.search = "level=N5";
    const { result, rerender } = renderHook(() => useKanjiModalHistory());
    expect(result.current).toMatchObject({ literal: null, openedInApp: false });
    url.search = "level=N5&kanji=%E6%97%A5";
    rerender();
    expect(result.current).toMatchObject({ literal: "日", openedInApp: true });
    act(() => result.current.close());
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("after a shared link is closed, the next in-app open closes with back", () => {
    url.search = "kanji=%E6%97%A5";
    const { result, rerender } = renderHook(() => useKanjiModalHistory());
    url.search = "";
    rerender();
    url.search = "kanji=%E6%9C%88";
    rerender();
    expect(result.current.openedInApp).toBe(true);
  });

  it("go() replaces the literal and keeps from", () => {
    url.search = "level=N5&kanji=%E6%97%A5&from=level%3AN5";
    const { result } = renderHook(() => useKanjiModalHistory());
    act(() => result.current.go("月"));
    expect(router.replace).toHaveBeenCalledWith("/kanji?level=N5&kanji=%E6%9C%88&from=level%3AN5", { scroll: false });
  });

  it.each(["abc", "日本", "%E0%A4"])("?kanji=%s is no literal", (raw) => {
    url.search = `kanji=${raw}`;
    const { result } = renderHook(() => useKanjiModalHistory());
    expect(result.current.literal).toBeNull();
  });

  it("accepts a non-BMP kanji", () => {
    url.search = `kanji=${encodeURIComponent("𠮟")}`;
    const { result } = renderHook(() => useKanjiModalHistory());
    expect(result.current.literal).toBe("𠮟");
  });
});
