import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { BackToTop } from "./back-to-top";
import { motionEnabled } from "@/lib/motion/motion-enabled";

vi.mock("@/lib/motion/motion-enabled", () => ({ motionEnabled: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

function mountMain() {
  const main = document.createElement("main");
  main.id = "main-content";
  main.tabIndex = -1;
  document.body.appendChild(main);
  return main;
}

describe("BackToTop (spec F3)", () => {
  it("scrolls the window to the top smoothly and focuses <main>", () => {
    vi.mocked(motionEnabled).mockReturnValue(true);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const main = mountMain();
    render(<BackToTop label="Back to the beginning" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to the beginning" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(document.activeElement).toBe(main);
    main.remove();
  });

  it("jumps without animation when motion is reduced", () => {
    vi.mocked(motionEnabled).mockReturnValue(false);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<BackToTop label="Back to the beginning" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to the beginning" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
