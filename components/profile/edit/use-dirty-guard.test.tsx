import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { useDirtyGuard } from "./use-dirty-guard";

afterEach(() => vi.restoreAllMocks());

function Harness({ dirty }: { dirty: boolean }) {
  const guard = useDirtyGuard(dirty);
  return (
    <>
      <a href="#settings" data-testid="link">settings</a>
      <a href="https://elsewhere.example/x" data-testid="external">out</a>
      <output data-testid="pending">{guard.pendingHref ?? ""}</output>
    </>
  );
}

/** Dispatches a click and reports whether the guard prevented it; jsdom never navigates (the target phase cancels it). */
function click(el: Element, init: MouseEventInit = {}): boolean {
  let guarded = false;
  const seen = (event: Event) => { guarded = event.defaultPrevented; event.preventDefault(); };
  el.addEventListener("click", seen);
  act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init })); });
  el.removeEventListener("click", seen);
  return guarded;
}

describe("useDirtyGuard", () => {
  it("intercepts nothing while the form is clean", () => {
    const { getByTestId } = render(<Harness dirty={false} />);
    expect(click(getByTestId("link"))).toBe(false);
    expect(getByTestId("pending").textContent).toBe("");
  });

  it("prevents a same-origin link click while dirty and records the href", () => {
    const { getByTestId } = render(<Harness dirty />);
    expect(click(getByTestId("link"))).toBe(true);
    expect(getByTestId("pending").textContent).toBe("/#settings");
  });

  it("lets modified clicks and other origins through", () => {
    const { getByTestId } = render(<Harness dirty />);
    expect(click(getByTestId("link"), { ctrlKey: true })).toBe(false);
    expect(click(getByTestId("external"))).toBe(false);
  });

  it("Back (popstate) while dirty re-pushes the current URL and asks", () => {
    const push = vi.spyOn(window.history, "pushState");
    const { getByTestId } = render(<Harness dirty />);
    expect(push).toHaveBeenCalledTimes(1); // the sentinel
    act(() => { fireEvent(window, new PopStateEvent("popstate")); });
    expect(push).toHaveBeenCalledTimes(2);
    expect(getByTestId("pending").textContent).toBe("__back__");
  });

  it("registers beforeunload only while dirty and removes it after", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { rerender } = render(<Harness dirty />);
    expect(add.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
    rerender(<Harness dirty={false} />);
    expect(remove.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("is silent again once dirty turns false", () => {
    const { getByTestId, rerender } = render(<Harness dirty />);
    rerender(<Harness dirty={false} />);
    expect(click(getByTestId("link"))).toBe(false);
  });

  it("requestLeave opens the dialog only when dirty", () => {
    const { result, rerender } = renderHook(({ dirty }) => useDirtyGuard(dirty), { initialProps: { dirty: true } });
    act(() => result.current.requestLeave("/en/profile"));
    expect(result.current.pendingHref).toBe("/en/profile");
    act(() => result.current.setPendingHref(null));
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, origin: window.location.origin, href: window.location.href });
    rerender({ dirty: false });
    act(() => result.current.requestLeave("/en/profile"));
    expect(assign).toHaveBeenCalledWith("/en/profile");
    expect(result.current.pendingHref).toBeNull();
    vi.unstubAllGlobals();
  });
});
