import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmButton } from "./confirm-button";

describe("ConfirmButton", () => {
  it("does not call onConfirm on the first click — it asks for confirmation inline", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Delete" confirmLabel="Really delete?" onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Really delete?")).toBeInTheDocument();
  });

  it("calls onConfirm only after the confirm step's Yes button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Delete" confirmLabel="Really delete?" onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: /yes/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels back to the plain button when Cancel is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Delete" confirmLabel="Really delete?" onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText("Really delete?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });

  it("is keyboard operable: Escape cancels the confirm step and returns focus to the trigger", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Delete" confirmLabel="Really delete?" onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.keyboard("{Escape}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText("Really delete?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });

  it("disables the trigger while disabled is set", () => {
    render(<ConfirmButton label="Delete" confirmLabel="Really delete?" onConfirm={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
