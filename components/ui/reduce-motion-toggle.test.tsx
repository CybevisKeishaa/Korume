import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ReduceMotionToggle } from "./reduce-motion-toggle";

describe("ReduceMotionToggle", () => {
  beforeEach(() => {
    // ⚠️ `localStorage` survives between tests in the same file, and the
    // toggle now seeds its checked state from it. Without this, one test's
    // click decides the next one's starting position.
    localStorage.clear();
    document.documentElement.setAttribute("data-reduce-motion", "false");
  });

  it("flips the global data-reduce-motion attribute when toggled", async () => {
    render(
      <ThemeProvider>
        <ReduceMotionToggle />
      </ThemeProvider>,
    );

    const checkbox = screen.getByRole("checkbox", { name: /reduce motion/i });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe(
      "true",
    );
  });

  /**
   * ⚠️ The box must show the ACCOUNT's answer, not the effective one.
   *
   * With the OS asking for reduced motion, `account || OS` is `true` whatever
   * the person does — so binding `checked` to the effective value made this
   * checkbox snap back the instant it was unticked, permanently, with nothing
   * on screen explaining why. Motion stays reduced either way, which is
   * correct and is asserted here too; what must not happen is a control that
   * refuses to move.
   *
   * `matchMedia` is stubbed only in this case: the rest of the file relies on
   * jsdom having none, which is also what proves `setReduceMotion` guards its
   * call.
   */
  it("keeps following the user when the OS is the one asking for reduced motion", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    render(
      <ThemeProvider>
        <ReduceMotionToggle />
      </ThemeProvider>,
    );
    const checkbox = screen.getByRole("checkbox", { name: /reduce motion/i });

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    // The account said no; the OS still says yes, so motion stays reduced.
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe("true");
    vi.unstubAllGlobals();
  });
});
