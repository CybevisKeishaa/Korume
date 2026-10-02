import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import type { FullscreenTarget } from "@/lib/shadowing-workspace/workspace-view";
import { useFullscreen } from "./use-fullscreen";

let fullscreenElement: Element | null = null;
let originalRequestFullscreen: typeof HTMLElement.prototype.requestFullscreen;
let originalFullscreenElement: PropertyDescriptor | undefined;
let originalExitFullscreen: typeof document.exitFullscreen;

function Probe() {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<FullscreenTarget>("none");
  const { requestFullscreen } = useFullscreen(rootRef, playerRef, setTarget);
  return (
    <div ref={rootRef} data-testid="fullscreen-root">
      <output>{target}</output>
      <button type="button" onClick={(event) => requestFullscreen("workspace", event.currentTarget)}>Workspace fullscreen</button>
      <button type="button" onClick={(event) => requestFullscreen("player", event.currentTarget)}>Player fullscreen</button>
      <div ref={playerRef} data-testid="fullscreen-player" />
    </div>
  );
}

describe("useFullscreen", () => {
  afterEach(() => {
    HTMLElement.prototype.requestFullscreen = originalRequestFullscreen;
    if (originalFullscreenElement) Object.defineProperty(document, "fullscreenElement", originalFullscreenElement);
    else delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
    fullscreenElement = null;
    document.exitFullscreen = originalExitFullscreen;
  });

  it("requests the selected element and restores the triggering button after browser exit", () => {
    originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    originalFullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    const requestFullscreen = vi.fn(() => {
      fullscreenElement = screen.getByTestId("fullscreen-player");
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    HTMLElement.prototype.requestFullscreen = requestFullscreen;

    render(<Probe />);
    const trigger = screen.getByRole("button", { name: "Player fullscreen" });
    fireEvent.click(trigger);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("player")).toBeInTheDocument();

    act(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(screen.getByText("none")).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("returns focus level by level when the player is fullscreened from inside the fullscreen workspace", () => {
    originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    originalFullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    HTMLElement.prototype.requestFullscreen = vi.fn(function (this: HTMLElement) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- the shim records which element went fullscreen
      fullscreenElement = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    render(<Probe />);
    const workspaceButton = screen.getByRole("button", { name: "Workspace fullscreen" });
    const playerButton = screen.getByRole("button", { name: "Player fullscreen" });
    const browserExitTo = (element: Element | null) => act(() => {
      fullscreenElement = element;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    fireEvent.click(workspaceButton);
    fireEvent.click(playerButton);
    expect(screen.getByText("player")).toBeInTheDocument();

    browserExitTo(screen.getByTestId("fullscreen-root"));
    expect(screen.getByText("workspace")).toBeInTheDocument();
    expect(document.activeElement).toBe(playerButton);

    browserExitTo(null);
    expect(screen.getByText("none")).toBeInTheDocument();
    expect(document.activeElement).toBe(workspaceButton);
  });

  it("exits when its requested target is already fullscreen and clears a rejected request", async () => {
    originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    originalExitFullscreen = document.exitFullscreen;
    originalFullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    const exitFullscreen = vi.fn(() => Promise.resolve());
    document.exitFullscreen = exitFullscreen;
    HTMLElement.prototype.requestFullscreen = vi.fn(() => Promise.reject(new Error("blocked")));
    render(<Probe />);
    const trigger = screen.getByRole("button", { name: "Player fullscreen" });
    const player = screen.getByTestId("fullscreen-player");

    fullscreenElement = player;
    fireEvent.click(trigger);
    expect(exitFullscreen).toHaveBeenCalledOnce();

    fullscreenElement = null;
    fireEvent.click(trigger);
    await act(() => Promise.resolve());
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
