import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { DeleteDataDialog } from "./delete-data-dialog";

describe("DeleteDataDialog", () => {
  it("keeps confirm disabled until the word is typed AND the box is ticked", async () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Delete all my data" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });

  it("rejects a lowercase confirmation", async () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "delete");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeDisabled();
  });

  it("lists all six categories the frame draws", () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    const items = screen.getAllByTestId("delete-category");
    expect(items).toHaveLength(6);
  });

  it("never tells the user the action is irreversible", () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    expect(screen.getByText(/7 days to change your mind/i)).toBeInTheDocument();
  });

  it("treats Escape as Keep my data", async () => {
    const onClose = vi.fn();
    render(<DeleteDataDialog open tier="erase_all" onClose={onClose} onConfirmed={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a translated error and never the server's own message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "pg: duplicate key value violates ..." }), { status: 409 }),
    );
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("duplicate key");
  });
});
