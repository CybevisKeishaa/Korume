import { useLayoutEffect, useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./count-up";

let frames: FrameRequestCallback[] = [];
// The text of the first committed frame: a layout effect runs before any passive effect could correct it.
let firstFrame: string | null = null;
function Probe({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => { firstFrame = ref.current?.textContent ?? null; }, []);
  return <p data-testid="n" ref={ref}>{children}</p>;
}
const runFrame = (now: number) => act(() => { const due = frames; frames = []; due.forEach((cb) => cb(now)); });

beforeEach(() => {
  frames = [];
  firstFrame = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(performance, "now").mockReturnValue(0);
  document.documentElement.style.setProperty("--duration-slow", "600ms");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-reduce-motion");
  document.documentElement.style.removeProperty("--duration-slow");
});

describe("CountUp", () => {
  it("counts from 0 up to the value over --duration-slow", () => {
    render(<p data-testid="n"><CountUp value={20} /></p>);
    const n = screen.getByTestId("n");
    expect(n).toHaveTextContent(/^0$/);
    runFrame(150);
    const mid = Number(n.textContent);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(20);
    runFrame(600);
    expect(n).toHaveTextContent(/^20$/);
    expect(frames).toHaveLength(0); // it stops once landed
  });

  it("the app's reduce-motion switch shows the value at once, with no frame of 0 and no animation frame", () => {
    document.documentElement.setAttribute("data-reduce-motion", "true");
    render(<Probe><CountUp value={20} /></Probe>);
    expect(firstFrame).toBe("20");
    expect(screen.getByTestId("n")).toHaveTextContent(/^20$/);
    expect(frames).toHaveLength(0);
  });

  it("the OS prefers-reduced-motion does the same", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<Probe><CountUp value={7} /></Probe>);
    expect(firstFrame).toBe("7");
    expect(screen.getByTestId("n")).toHaveTextContent(/^7$/);
    expect(frames).toHaveLength(0);
  });
});
