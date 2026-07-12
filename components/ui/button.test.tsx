import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonStyles } from "./button";

describe("Button", () => {
  it("renders its children and defaults to type=button", () => {
    render(<Button>Shadow</Button>);
    const btn = screen.getByRole("button", { name: "Shadow" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "button");
  });

  it("fires onClick when activated", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("buttonStyles reflects the chosen variant", () => {
    expect(buttonStyles({ variant: "outline" })).toContain("border");
    expect(buttonStyles({ variant: "primary" })).toContain("bg-primary");
  });
});
