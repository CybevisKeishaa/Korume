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
});
