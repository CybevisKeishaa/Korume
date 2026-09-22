import { fireEvent, render, screen } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "./back-button";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("BackButton", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("goes back when browser history exists", () => {
    const length = Object.getOwnPropertyDescriptor(window.history, "length");
    Object.defineProperty(window.history, "length", { configurable: true, value: 2 });
    const back = vi.spyOn(window.history, "back");
    render(<BackButton>Go Back</BackButton>);

    fireEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    back.mockRestore();
    if (length) Object.defineProperty(window.history, "length", length);
  });

  it("goes home when there is no browser history", () => {
    const length = Object.getOwnPropertyDescriptor(window.history, "length");
    Object.defineProperty(window.history, "length", { configurable: true, value: 1 });
    render(<BackButton>Go Back</BackButton>);

    fireEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(push).toHaveBeenCalledWith("/");
    if (length) Object.defineProperty(window.history, "length", length);
  });
});
