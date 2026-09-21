import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("is hidden until the trigger is focused, then describes it", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Plays the reference audio">
        <button>play</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab(); // keyboard focus opens instantly — a11y path, no hover needed
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Plays the reference audio");
    expect(screen.getByRole("button", { name: /play/ })).toHaveAttribute(
      "aria-describedby",
    );
  });

  it("hides again on blur", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="tip">
        <button>trigger</button>
      </Tooltip>,
    );
    await user.tab();
    await screen.findByRole("tooltip");
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("carries the density scope it was opened from onto its portaled content", async () => {
    // Radix portals to document.body, outside every route-group subtree, so
    // content opened from a data-density="reference" group would inherit the
    // app's fluid density. The scope is copied onto the portaled content,
    // where the [data-density] block re-declares the tokens (spec §5.3).
    const user = userEvent.setup();
    render(
      <div data-density="reference">
        <Tooltip content="scoped tip">
          <button>trigger</button>
        </Tooltip>
      </div>,
    );
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    // role="tooltip" is Radix's visually-hidden copy INSIDE the bubble, so
    // closest() reaches the bubble, which is the node that carries the tokens.
    expect(tooltip.closest("[data-density]")).toHaveAttribute("data-density", "reference");
  });

  it("carries no density scope when opened outside one", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="unscoped tip">
        <button>trigger</button>
      </Tooltip>,
    );
    await user.tab();
    expect((await screen.findByRole("tooltip")).closest("[data-density]")).toBeNull();
  });
});
