import { useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { Select } from "./select";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={vi.fn()} title="Hidden">
        <p>secret</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible modal with title and content when open", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Attach transcript" description="Paste SRT or VTT.">
        <p>body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Attach transcript" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Paste SRT or VTT.")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("focuses the close button on open and traps Tab inside", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={vi.fn()} title="Trap">
        <button>first</button>
        <button>last</button>
      </Dialog>,
    );
    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(close).toHaveFocus();
    await user.tab(); // close → first
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
    await user.tab(); // first → last
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
    await user.tab(); // last → WRAPS to close (the trap — the L7 debt)
    expect(close).toHaveFocus();
  });

  it("honours initialFocusRef", () => {
    function Harness() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Dialog open onClose={vi.fn()} title="Focus" initialFocusRef={ref}>
          <button ref={ref}>target</button>
        </Dialog>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("button", { name: "target" })).toHaveFocus();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Esc">
        <p>body</p>
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns focus to the trigger after closing", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open dialog</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Cycle">
            <p>body</p>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("carries the density scope it was opened from onto its portaled content", () => {
    // Radix portals to document.body, outside every route-group subtree, so
    // content opened from a data-density="reference" group would inherit the
    // app's fluid density. The scope is copied onto the portaled content,
    // where the [data-density] block re-declares the tokens (spec §5.3).
    render(
      <div data-density="reference">
        <Dialog open onClose={vi.fn()} title="Scoped">
          <p>body</p>
        </Dialog>
      </div>,
    );
    const dialog = screen.getByRole("dialog", { name: "Scoped" });
    expect(dialog).toHaveAttribute("data-density", "reference");
  });

  it("carries no density scope when opened outside one", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Unscoped">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "Unscoped" })).not.toHaveAttribute("data-density");
  });

  it("hands its scope to a primitive nested inside it when opened on mount", async () => {
    // Review I1: a hook that read the scope once at mount ran the nested
    // Select's read before the Dialog content carried the attribute, so the
    // Select resolved at fluid density inside a reference scope, for good.
    const user = userEvent.setup();
    render(
      <div data-density="reference">
        <Dialog open onClose={vi.fn()} title="Nested">
          <Select options={[{ value: "a", label: "A" }]} aria-label="Nested select" />
        </Dialog>
      </div>,
    );
    await user.click(screen.getByRole("combobox", { name: "Nested select" }));
    const listbox = await screen.findByRole("listbox");
    expect(listbox.closest("[data-density]")).toHaveAttribute("data-density", "reference");
  });
});
