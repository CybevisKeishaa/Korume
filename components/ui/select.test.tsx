import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { Select } from "./select";

const options = [
  { value: "n5", label: "JLPT N5" },
  { value: "n4", label: "JLPT N4" },
  { value: "n3", label: "JLPT N3", disabled: true },
];

describe("Select", () => {
  it("renders a combobox showing the placeholder until a value is chosen", () => {
    render(
      <Select options={options} placeholder="Choose a level" aria-label="Level" />,
    );
    const trigger = screen.getByRole("combobox", { name: "Level" });
    expect(trigger).toHaveTextContent("Choose a level");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click and lists the options", async () => {
    const user = userEvent.setup();
    render(<Select options={options} aria-label="Level" />);
    await user.click(screen.getByRole("combobox", { name: "Level" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JLPT N5" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JLPT N3" })).toHaveAttribute(
      "data-disabled",
    );
  });

  it("reports the chosen value and closes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select options={options} onValueChange={onValueChange} aria-label="Level" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Level" }));
    await user.click(await screen.findByRole("option", { name: "JLPT N4" }));
    expect(onValueChange).toHaveBeenCalledWith("n4");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the selected option's label when controlled", () => {
    render(<Select options={options} value="n5" aria-label="Level" />);
    expect(screen.getByRole("combobox", { name: "Level" })).toHaveTextContent(
      "JLPT N5",
    );
  });

  it("carries the density scope it was opened from onto its portaled content", async () => {
    // Radix portals to document.body, outside every route-group subtree, so
    // content opened from a data-density="reference" group would inherit the
    // app's fluid density. The scope is copied onto the portaled content,
    // where the [data-density] block re-declares the tokens (spec §5.3).
    const user = userEvent.setup();
    render(
      <div data-density="reference">
        <Select options={options} aria-label="Level" />
      </div>,
    );
    await user.click(screen.getByRole("combobox", { name: "Level" }));
    const listbox = await screen.findByRole("listbox");
    expect(listbox.closest("[data-density]")).toHaveAttribute("data-density", "reference");
  });
});
