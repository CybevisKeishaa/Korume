import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Popover } from "./popover";

describe("Popover", () => {
  it("opens on trigger click and renders content", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>save to playlist</button>}>
        <p>playlist list</p>
      </Popover>,
    );
    expect(screen.queryByText("playlist list")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "save to playlist" }));
    expect(await screen.findByText("playlist list")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "save to playlist" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>open</button>}>
        <p>content</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "open" });
    await user.click(trigger);
    await screen.findByText("content");
    await user.keyboard("{Escape}");
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("supports controlled open state", async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const handleOpenChange = () => {};
    render(
      <Popover trigger={<button>anchor</button>} open onOpenChange={handleOpenChange}>
        <p>controlled content</p>
      </Popover>,
    );
    expect(await screen.findByText("controlled content")).toBeInTheDocument();
  });

  it("carries the density scope it was opened from onto its portaled content", async () => {
    // Radix portals to document.body, outside every route-group subtree, so
    // content opened from a data-density="reference" group would inherit the
    // app's fluid density. The scope is copied onto the portaled content,
    // where the [data-density] block re-declares the tokens (spec §5.3).
    const user = userEvent.setup();
    render(
      <div data-density="reference">
        <Popover trigger={<button>scoped</button>}>
          <p>scoped content</p>
        </Popover>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "scoped" }));
    const content = (await screen.findByText("scoped content")).closest("[data-density]");
    expect(content).toHaveAttribute("data-density", "reference");
    expect(content).toHaveAttribute("role", "dialog");
  });
});
