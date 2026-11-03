import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { ListeningRevealProvider, useListeningReveal } from "./listening-reveal-context";
import { ListeningToolbar } from "./listening-toolbar";

let api: ReturnType<typeof useListeningReveal> | undefined;
function Probe() { api = useListeningReveal(); return null; }
const toolbar = (easyDisabled = false) => render(
  <ListeningRevealProvider lineId="line-1" exercise="dictation"><ListeningToolbar easyDisabled={easyDisabled} /><Probe /></ListeningRevealProvider>,
);
const tool = (name: string) => screen.getByRole("button", { name });

describe("ListeningToolbar (spec §3.2)", () => {
  it("Hide video toggles listenOnly and its aria-pressed", () => {
    toolbar();
    expect(tool("Hide video")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(tool("Hide video"));
    expect(tool("Hide video")).toHaveAttribute("aria-pressed", "true");
    expect(api?.listenOnly).toBe(true);
    fireEvent.click(tool("Hide video"));
    expect(api?.listenOnly).toBe(false);
  });

  it("Easy mode toggles easy and its aria-pressed", () => {
    toolbar();
    expect(tool("Easy mode")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(tool("Easy mode"));
    expect(tool("Easy mode")).toHaveAttribute("aria-pressed", "true");
    expect(api?.easy).toBe(true);
  });

  it("Shortcuts opens a popover listing Alt+H and closes on Escape with focus back on the button", async () => {
    const user = userEvent.setup();
    toolbar();
    expect(tool("Shortcuts")).not.toHaveAttribute("aria-pressed");
    await user.click(tool("Shortcuts"));
    const sheet = await screen.findByRole("dialog", { name: "Shortcuts" });
    expect(sheet).toHaveTextContent("Alt + H");
    expect(sheet).toHaveTextContent("Space");
    expect(sheet).toHaveTextContent("Alt + ← / →");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Shortcuts" })).toBeNull();
    expect(document.activeElement).toBe(tool("Shortcuts"));
  });

  it("on an unreliable dictation line Easy mode is unavailable, says why in a tooltip, and a press changes nothing", async () => {
    const user = userEvent.setup();
    toolbar(true);
    const easy = tool("Easy mode");
    // aria-disabled, not disabled: a disabled button takes no focus or hover, so its reason could never be read.
    expect(easy).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(easy);
    expect(api?.easy).toBe(false);
    expect(easy).toHaveAttribute("aria-pressed", "false");
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(easy);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("This sentence can't be split reliably, so it's Typing only");
  });
});
