import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MascotPose } from "./mascot-pose";

describe("MascotPose", () => {
  it("renders the mapped file as a decorative image", () => {
    const { container } = render(<MascotPose pose="not-found" size="md" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/mascot/poses/curious-question-mark.png");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks the element so size variants are testable", () => {
    const { container } = render(<MascotPose pose="login" size="lg" />);
    expect(container.querySelector("[data-mascot-pose='login'][data-size='lg']")).not.toBeNull();
  });
});
