import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioPicker } from "./scenario-picker";

describe("ScenarioPicker", () => {
  it("lists all five scenarios with a label and description each", () => {
    render(<ScenarioPicker onStart={vi.fn()} />);
    for (const name of [/restaurant/i, /interview/i, /shopping/i, /directions/i, /free talk/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
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
