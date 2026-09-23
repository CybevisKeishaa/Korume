import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { SegmentedControl } from "./segmented-control";

const OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "extra_large", label: "Extra large" },
] as const;

function renderControl(
  value: (typeof OPTIONS)[number]["value"],
  onValueChange = vi.fn(),
  disabled = false,
) {
  render(
    <SegmentedControl
      value={value}
      onValueChange={onValueChange}
      options={[...OPTIONS]}
      aria-label="Display scale"
      disabled={disabled}
    />,
  );
  return onValueChange;
}

describe("SegmentedControl", () => {
  it("is a radiogroup with one radio per option", () => {
    renderControl("normal");
    const group = screen.getByRole("radiogroup", { name: "Display scale" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(OPTIONS.length);
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Normal",
      "Large",
      "Extra large",
    ]);
  });

  it("checks only the selected option and gives it the only reachable tab stop", () => {
    renderControl("large");
    const [normal, large, extraLarge] = screen.getAllByRole("radio");

    expect([normal, large, extraLarge].map((radio) => radio?.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect([normal, large, extraLarge].map((radio) => radio?.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("selects on click", async () => {
    const user = userEvent.setup();
    const onValueChange = renderControl("normal");

    await user.click(screen.getByRole("radio", { name: "Extra large" }));

    expect(onValueChange).toHaveBeenCalledWith("extra_large");
  });

  it.each([
    ["{ArrowRight}", "large"],
    ["{ArrowDown}", "large"],
    ["{ArrowLeft}", "extra_large"],
    ["{ArrowUp}", "extra_large"],
  ])("%s from the first option selects %s, wrapping", async (key, expected) => {
    const user = userEvent.setup();
    const onValueChange = renderControl("normal");
    screen.getByRole("radio", { name: "Normal" }).focus();

    await user.keyboard(key);

    expect(onValueChange).toHaveBeenCalledWith(expected);
  });

  it("moves focus with the arrow key, not only the selection", async () => {
    const user = userEvent.setup();
    renderControl("normal");
    screen.getByRole("radio", { name: "Normal" }).focus();

    await user.keyboard("{ArrowRight}");

    // The parent owns `value`, so the rendered selection has not moved yet —
    // focus must follow the key anyway, or the next arrow starts over.
    expect(screen.getByRole("radio", { name: "Large" })).toHaveFocus();
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = renderControl("normal", vi.fn(), true);

    await user.click(screen.getByRole("radio", { name: "Large" }));
    screen.getByRole("radio", { name: "Normal" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onValueChange).not.toHaveBeenCalled();
    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());
  });
});
