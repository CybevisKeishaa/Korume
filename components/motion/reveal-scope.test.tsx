import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
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
