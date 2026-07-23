import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog open={false} title="Reject video" description="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus into the dialog when opened and traps Escape to cancel", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Reject video" description="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);

    const dialog = screen.getByRole("dialog", { name: "Reject video" });
    expect(dialog).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Reject video" description="Sure?" confirmLabel="Reject" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked or the close (x) button is clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Reject video" description="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("disables both buttons while busy and shows a busy label", () => {
    render(<ConfirmDialog open title="Reject video" description="Sure?" confirmLabel="Reject" busy onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /working/i })).toBeDisabled();
  });

  it("shows an error message with role=alert when provided", () => {
    render(<ConfirmDialog open title="Reject video" description="Sure?" error="Could not reject." onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reject.");
  });

  it("renders extra content (e.g. a reason field) via children", () => {
    render(
      <ConfirmDialog open title="Reject video" description="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()}>
        <label htmlFor="reason">Reason</label>
        <textarea id="reason" />
      </ConfirmDialog>,
    );
    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
  });
});
