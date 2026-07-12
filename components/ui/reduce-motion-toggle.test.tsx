import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ReduceMotionToggle } from "./reduce-motion-toggle";

describe("ReduceMotionToggle", () => {
  beforeEach(() => {
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
});
