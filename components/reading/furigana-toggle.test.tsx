import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FuriganaToggle } from "./furigana-toggle";

describe("FuriganaToggle", () => {
  it("is a real button carrying aria-pressed, and its label changes with state (not color alone)", () => {
    const { rerender } = render(<FuriganaToggle pressed={false} onToggle={vi.fn()} />);
    const onButton = screen.getByRole("button", { name: /show furigana/i });
    expect(onButton).toHaveAttribute("aria-pressed", "false");

    rerender(<FuriganaToggle pressed={true} onToggle={vi.fn()} />);
    const offButton = screen.getByRole("button", { name: /hide furigana/i });
    expect(offButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle when clicked and when activated via keyboard", async () => {
    const onToggle = vi.fn();
    render(<FuriganaToggle pressed={false} onToggle={onToggle} />);

    const button = screen.getByRole("button");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("renders disabled with an explanatory label when there is no furigana data", () => {
    render(<FuriganaToggle pressed={false} onToggle={vi.fn()} disabled />);
    const button = screen.getByRole("button", { name: /unavailable/i });
    expect(button).toBeDisabled();
  });
});
