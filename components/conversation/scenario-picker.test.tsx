import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ScenarioPicker } from "./scenario-picker";

/** Each scenario's own label paired with its own description — swap-proof
 * (Task 15 audit convention #3): asserts e.g. restaurant's card carries
 * restaurant's description, not any other scenario's, which a plain
 * "does this text exist somewhere" assertion would miss if two `t()` keys
 * were swapped. */
const SCENARIOS_IN_ORDER: { name: RegExp; description: string }[] = [
  { name: /restaurant/i, description: "Order food, ask about the menu, and pay the bill." },
  { name: /interview/i, description: "Answer common interview questions in polite Japanese." },
  { name: /shopping/i, description: "Ask about sizes, prices, and try things on at a store." },
  { name: /directions/i, description: "Ask how to get somewhere and understand the reply." },
  { name: /free talk/i, description: "An open-ended chat about anything you like." },
];

describe("ScenarioPicker", () => {
  it("lists the five scenarios in display order, each paired with its own description", () => {
    render(<ScenarioPicker onStart={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(SCENARIOS_IN_ORDER.length);

    // Display order: the button at each position has that position's scenario
    // name (swap-proof — a reordering would fail this even though every name
    // still appears somewhere in the list).
    SCENARIOS_IN_ORDER.forEach((scenario, index) => {
      expect(buttons[index]).toHaveAccessibleName(scenario.name);
    });

    // Pairing: each scenario's own card carries its own description, not any
    // other scenario's.
    for (const { name, description } of SCENARIOS_IN_ORDER) {
      const button = screen.getByRole("button", { name });
      expect(within(button).getByText(description)).toBeInTheDocument();
    }
  });

  it("starts the default level's session when a scenario is picked", async () => {
    const onStart = vi.fn();
    render(<ScenarioPicker onStart={onStart} />);

    await userEvent.click(screen.getByRole("button", { name: /restaurant/i }));

    expect(onStart).toHaveBeenCalledWith("restaurant", undefined);
  });

  it("allows overriding the level before starting", async () => {
    const onStart = vi.fn();
    render(<ScenarioPicker onStart={onStart} />);

    await userEvent.selectOptions(screen.getByLabelText(/level/i), "N3");
    await userEvent.click(screen.getByRole("button", { name: /shopping/i }));

    expect(onStart).toHaveBeenCalledWith("shopping", "N3");
  });

  it("is keyboard operable (tab + enter)", async () => {
    const onStart = vi.fn();
    render(<ScenarioPicker onStart={onStart} />);

    const directionsButton = screen.getByRole("button", { name: /directions/i });
    directionsButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(onStart).toHaveBeenCalledWith("directions", undefined);
  });
});
