import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { Switch } from "./switch";

describe("Switch", () => {
  it("exposes its state through role and aria-checked", () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={vi.fn()} aria-label="Microphone" />);
    const control = screen.getByRole("switch", { name: "Microphone" });
    expect(control).toHaveAttribute("aria-checked", "false");

    rerender(<Switch checked onCheckedChange={vi.fn()} aria-label="Microphone" />);
    expect(screen.getByRole("switch", { name: "Microphone" })).toHaveAttribute("aria-checked", "true");
  });

  it("reports the opposite of the current value on click and on Space", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Camera" />);
    const control = screen.getByRole("switch", { name: "Camera" });

    await user.click(control);
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true);

    control.focus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, true);
  });

  it("reports false when it is already on", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked onCheckedChange={onCheckedChange} aria-label="Camera" />);

    await user.click(screen.getByRole("switch", { name: "Camera" }));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("does nothing when disabled, by pointer or by keyboard", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} disabled aria-label="Camera" />);
    const control = screen.getByRole("switch", { name: "Camera" });

    await user.click(control);
    control.focus();
    await user.keyboard(" ");

    expect(control).toBeDisabled();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("carries the id and description a SettingsRow label points at", () => {
    render(
      <Switch checked={false} onCheckedChange={vi.fn()} id="mic" aria-label="Microphone" aria-describedby="mic-hint" />,
    );
    const control = screen.getByRole("switch", { name: "Microphone" });
    expect(control).toHaveAttribute("id", "mic");
    expect(control).toHaveAttribute("aria-describedby", "mic-hint");
    // A submit button inside a settings form would save the page on Enter.
    expect(control).toHaveAttribute("type", "button");
  });
});
