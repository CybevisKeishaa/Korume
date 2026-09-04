import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { REVEAL_FAILSAFE_ATTR, REVEAL_MOUNTED_FLAG } from "./reveal-failsafe";
import { RevealScope } from "./reveal-scope";

/**
 * jsdom does not implement IntersectionObserver, so the suite supplies one and
 * keeps the observed elements and the callback reachable. Asserting against a
 * stub we wrote is only meaningful because every assertion below is about what
 * RevealScope DOES to the DOM, never about the observer itself.
 */
let observed: Element[] = [];
let fire: (entries: { target: Element; isIntersecting: boolean }[]) => void;
const unobserve = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  observed = [];
  unobserve.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { target: Element; isIntersecting: boolean }[]) => void) {
        fire = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute(REVEAL_FAILSAFE_ATTR);
  Reflect.deleteProperty(window, REVEAL_MOUNTED_FLAG);
});

describe("RevealScope", () => {
  it("observes every pending target inside its scope, and no more", () => {
    document.body.innerHTML = `
      <div data-reveal-scope>
        <section data-reveal="pending" id="a"></section>
        <section data-reveal="pending" id="b"></section>
      </div>
      <section data-reveal="pending" id="outside"></section>`;

    render(<RevealScope />);

    expect(observed).toHaveLength(2);
    expect(observed.map((el) => el.id)).toEqual(["a", "b"]);
  });

  it("flips a target to `in` when it intersects, and stops watching it", () => {
    document.body.innerHTML = `
      <div data-reveal-scope><section data-reveal="pending" id="a"></section></div>`;

    render(<RevealScope />);
    const target = document.getElementById("a");
    if (!target) throw new Error("the fixture rendered no #a");
    fire([{ target, isIntersecting: true }]);

    expect(target.getAttribute("data-reveal")).toBe("in");
    expect(unobserve).toHaveBeenCalledWith(target);
  });

  it("leaves a target alone until it intersects", () => {
    document.body.innerHTML = `
      <div data-reveal-scope><section data-reveal="pending" id="a"></section></div>`;

    render(<RevealScope />);
    const target = document.getElementById("a");
    if (!target) throw new Error("the fixture rendered no #a");
    fire([{ target, isIntersecting: false }]);

    expect(target.getAttribute("data-reveal")).toBe("pending");
    expect(unobserve).not.toHaveBeenCalled();
  });

  it("renders no DOM of its own", () => {
    const { container } = render(<RevealScope />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reports that it mounted, so the failsafe stands down", () => {
    document.body.innerHTML = `
      <div data-reveal-scope><section data-reveal="pending" id="a"></section></div>`;

    expect(Reflect.get(window, REVEAL_MOUNTED_FLAG)).toBeUndefined();

    render(<RevealScope />);

    // The inline failsafe script reads this. Without it the page would reveal
    // itself 3s in and then animate a second time on scroll.
    expect(Reflect.get(window, REVEAL_MOUNTED_FLAG)).toBe(true);
  });

  it("does not report in when the observer cannot be constructed", () => {
    // The case the failsafe's docblock enumerates: `IntersectionObserver`
    // throwing. A flag set on the way INTO the effect would stand the failsafe
    // down for an observer that never existed, and the page would stay at
    // opacity 0 for good — a presence signal standing in for a behavioural one,
    // which is the substitution the failsafe exists to correct.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor() {
          throw new Error("blocked");
        }
      },
    );
    document.body.innerHTML = `
      <div data-reveal-scope><section data-reveal="pending" id="a"></section></div>`;

    try {
      render(<RevealScope />);
    } catch {
      // Expected: React surfaces the effect's throw through render(). Whether
      // it does is React's business; the flag is this test's subject.
    }

    expect(Reflect.get(window, REVEAL_MOUNTED_FLAG)).toBeUndefined();
  });

  it("leaves the page alone when the failsafe already released it", () => {
    document.documentElement.setAttribute(REVEAL_FAILSAFE_ATTR, "");
    document.body.innerHTML = `
      <div data-reveal-scope><section data-reveal="pending" id="a"></section></div>`;

    render(<RevealScope />);

    // Hydration lost the race: everything is visible. Flipping targets to `in`
    // now would run `reveal-rise` from opacity 0 and flash content that the
    // reader is already looking at.
    expect(observed).toHaveLength(0);
    expect(document.getElementById("a")?.getAttribute("data-reveal")).toBe("pending");
  });

  it("disconnects the observer on unmount", () => {
    document.body.innerHTML = `
      <div data-reveal-scope><section data-reveal="pending" id="a"></section></div>`;

    const { unmount } = render(<RevealScope />);
    expect(disconnect).not.toHaveBeenCalled();

    unmount();

    // A locale switch replaces this tree; an observer left holding the old
    // sections would keep them alive.
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
