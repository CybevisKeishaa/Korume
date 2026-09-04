import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REVEAL_FAILSAFE_ATTR,
  REVEAL_FAILSAFE_MS,
  REVEAL_MOUNTED_FLAG,
  revealFailsafeScript,
} from "./reveal-failsafe";

/**
 * The script is a STRING because it must survive the client bundle failing —
 * that is the entire point of it. So it is exercised the way the browser will
 * run it, by evaluating the string, rather than by importing a function the
 * bundle would have had to deliver.
 */
const run = () => new Function(revealFailsafeScript)();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute(REVEAL_FAILSAFE_ATTR);
  Reflect.deleteProperty(window, REVEAL_MOUNTED_FLAG);
});

describe("the reveal failsafe", () => {
  it("releases the hidden state when RevealScope never reports in", () => {
    run();

    // Before the window closes it must do nothing at all, or it would race the
    // observer and skip the entrance on every ordinary page load.
    vi.advanceTimersByTime(REVEAL_FAILSAFE_MS - 1);
    expect(document.documentElement.hasAttribute(REVEAL_FAILSAFE_ATTR)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(document.documentElement.hasAttribute(REVEAL_FAILSAFE_ATTR)).toBe(true);
  });

  it("stays out of the way once RevealScope has mounted", () => {
    run();
    Reflect.set(window, REVEAL_MOUNTED_FLAG, true);

    vi.advanceTimersByTime(REVEAL_FAILSAFE_MS * 2);

    // The observer is alive, so sections below the fold are legitimately still
    // `pending`. Releasing here would reveal the whole page at once.
    expect(document.documentElement.hasAttribute(REVEAL_FAILSAFE_ATTR)).toBe(false);
  });

  it("waits long enough for a slow hydration to win the race", () => {
    // A number small enough to fire before an ordinary mount would turn the
    // entrance off for everyone; this pins the intent, not the literal.
    expect(REVEAL_FAILSAFE_MS).toBeGreaterThanOrEqual(2000);
  });

  it("is actually injected by the marketing layout", () => {
    // A failsafe that never reaches the page is worth nothing, and the layout
    // that mounts it is a server component whose render would pull in the whole
    // marketing shell. So the wiring is asserted at the source, the way
    // design-tokens.test.ts asserts globals.css (L-010): without this, deleting
    // the <script> leaves the entire unit suite green and the only guard is one
    // e2e case that needs a browser and a production build.
    const layout = readFileSync(
      path.join(process.cwd(), "app/[locale]/(marketing)/layout.tsx"),
      "utf8",
    );

    expect(layout).toContain('from "@/components/motion/reveal-failsafe"');
    expect(layout).toMatch(
      /dangerouslySetInnerHTML=\{\{\s*__html:\s*revealFailsafeScript\s*\}\}/,
    );
  });
});
