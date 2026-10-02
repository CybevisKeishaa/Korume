import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRAMMATIC_SCROLL_MAX_MS, PROGRAMMATIC_SCROLL_MS, useAutoFollow } from "./use-auto-follow";

let follow: ReturnType<typeof useAutoFollow> | undefined;
const scrollTo = vi.fn();

function Harness({ index, enabled = true, layout }: { index: number | null; enabled?: boolean; layout?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  follow = useAutoFollow(ref, index, enabled, layout);
  return (
    <div ref={ref} data-testid="scroller">
      {[0, 1, 2, 3].map((i) => <div key={i} data-index={i} />)}
    </div>
  );
}

// jsdom has no layout: give the scroller overflow and each row a top, so following has somewhere to go.
let scrollHeight = 1000;
const geometry = {
  scrollHeight: Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight")!,
  clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!,
  rect: Element.prototype.getBoundingClientRect,
};

const scroller = () => document.querySelector<HTMLElement>("[data-testid='scroller']")!;
const lastBehavior = () => scrollTo.mock.calls.at(-1)?.[0].behavior;

describe("useAutoFollow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scrollTo.mockClear();
    HTMLElement.prototype.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"];
    scrollHeight = 1000;
    Object.defineProperty(Element.prototype, "scrollHeight", { configurable: true, get: () => scrollHeight });
    Object.defineProperty(Element.prototype, "clientHeight", { configurable: true, get: () => 100 });
    Element.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const index = this.dataset.index;
      return { top: index === undefined ? 0 : 200 + Number(index) * 100 } as DOMRect;
    };
  });
  afterEach(() => {
    Object.defineProperty(Element.prototype, "scrollHeight", geometry.scrollHeight);
    Object.defineProperty(Element.prototype, "clientHeight", geometry.clientHeight);
    Element.prototype.getBoundingClientRect = geometry.rect;
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-reduce-motion");
  });

  it("places the current row instantly on mount, then follows it smoothly", () => {
    const view = render(<Harness index={1} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(lastBehavior()).toBe("instant");
    view.rerender(<Harness index={2} />);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(lastBehavior()).toBe("smooth");
  });

  it("does not mistake its own scroll for the learner's", () => {
    const view = render(<Harness index={0} />);
    view.rerender(<Harness index={1} />);
    fireEvent.scroll(scroller());
    expect(follow?.suspended).toBe(false);
    view.rerender(<Harness index={2} />);
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it("treats a scroll after the programmatic window as the learner's", () => {
    render(<Harness index={0} />);
    act(() => { vi.advanceTimersByTime(PROGRAMMATIC_SCROLL_MAX_MS + 1); });
    fireEvent.scroll(scroller());
    expect(follow?.suspended).toBe(true);
  });

  it("keeps the window open past 600 ms until scrollend (a long smooth scroll)", () => {
    expect("onscrollend" in window).toBe(true);
    render(<Harness index={0} />);
    act(() => { vi.advanceTimersByTime(PROGRAMMATIC_SCROLL_MS + 1); });
    fireEvent.scroll(scroller());
    expect(follow?.suspended).toBe(false);
  });

  it("closes the window early on scrollend", () => {
    render(<Harness index={0} />);
    fireEvent(scroller(), new Event("scrollend"));
    fireEvent.scroll(scroller());
    expect(follow?.suspended).toBe(true);
  });

  it("skips a scroll that cannot move, without blinding the learner's next scroll", () => {
    scrollHeight = 100; // no overflow: the clamped target is the current scrollTop
    render(<Harness index={2} />);
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.scroll(scroller());
    expect(follow?.suspended).toBe(true);
  });

  it("suspends on a learner wheel, stops following, and resume() scrolls back", () => {
    const view = render(<Harness index={0} />);
    fireEvent.wheel(scroller());
    expect(follow?.suspended).toBe(true);
    view.rerender(<Harness index={3} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => follow?.resume());
    expect(follow?.suspended).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("suspends on touchmove and the paging keys, not on other keys", () => {
    render(<Harness index={0} />);
    fireEvent.keyDown(scroller(), { key: "a" });
    expect(follow?.suspended).toBe(false);
    fireEvent.keyDown(scroller(), { key: "PageDown" });
    expect(follow?.suspended).toBe(true);
    act(() => follow?.resume());
    fireEvent.touchMove(scroller());
    expect(follow?.suspended).toBe(true);
  });

  it("re-centres the same row when the layout changes", () => {
    const view = render(<Harness index={1} layout="normal" />);
    view.rerender(<Harness index={1} layout="full-transcript" />);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("scrolls instantly under reduce motion", () => {
    document.documentElement.setAttribute("data-reduce-motion", "true");
    const view = render(<Harness index={0} />);
    view.rerender(<Harness index={1} />);
    expect(lastBehavior()).toBe("instant");
  });

  it("neither scrolls nor suspends while disabled (a search is active)", () => {
    render(<Harness index={1} enabled={false} />);
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.wheel(scroller());
    expect(follow?.suspended).toBe(false);
  });
});
