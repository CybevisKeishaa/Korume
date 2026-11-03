import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { PlayerWiringContext } from "../playback-root";
import { ReplayRates } from "./replay-row";

describe("ReplayRates", () => {
  it("renders the two rates and no Loop button (spec 2026-10-31 D3)", () => {
    const setRate = vi.fn();
    const toggleLoop = vi.fn();
    render(
      <PlayerWiringContext.Provider value={{ adapterRef: { current: null }, onReady: vi.fn(), onStateChange: vi.fn(), ready: true, playing: false, loop: { enabled: false, count: 1, autoPause: true }, setLoop: vi.fn(), toggleLoop, rate: 1, setRate }}>
        <ReplayRates />
      </PlayerWiringContext.Provider>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Loop" })).toBeNull();
    expect(screen.getByRole("button", { name: "1× speed" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "0.75× speed" }));
    expect(setRate).toHaveBeenCalledWith(0.75);
    expect(toggleLoop).not.toHaveBeenCalled();
  });
});
