import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive tech and pulses", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const skeleton = container.firstElementChild as HTMLElement;
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    // animate-pulse is collapsed to a single 0.001ms iteration by the global
    // reduce-motion kill-switch — no extra handling needed here.
    expect(skeleton.className).toContain("animate-pulse");
    expect(skeleton.className).toContain("w-32");
  });
});
