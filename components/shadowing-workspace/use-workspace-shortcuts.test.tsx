import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceShortcuts } from "./use-workspace-shortcuts";

function Probe({ actions }: { actions: ReturnType<typeof createActions> }) {
  useWorkspaceShortcuts(actions);
  return <>
    <div aria-label="Seek" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} role="slider" tabIndex={0} />
    <div aria-label="Resize workspace panes" role="separator" tabIndex={0} />
  </>;
}

function createActions() {
  return {
    togglePlay: vi.fn(), previousSentence: vi.fn(), nextSentence: vi.fn(), rewind: vi.fn(),
    toggleLoop: vi.fn(), toggleFocus: vi.fn(),
  };
}

function keydown(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => target.dispatchEvent(event));
  return event;
}

describe("useWorkspaceShortcuts", () => {
  it("plays from the document body, prevents Space scrolling, and leaves a focused slider alone", () => {
    const actions = createActions();
    const view = render(<Probe actions={actions} />);

    expect(keydown(document.body, " ").defaultPrevented).toBe(true);
    expect(actions.togglePlay).toHaveBeenCalledOnce();

    const slider = view.getByRole("slider");
    slider.focus();
    expect(keydown(slider, " ").defaultPrevented).toBe(false);
    expect(actions.togglePlay).toHaveBeenCalledOnce();
  });

  it("routes the workspace navigation, loop, and focus keys through their shared actions", () => {
    const actions = createActions();
    render(<Probe actions={actions} />);

    keydown(document.body, "ArrowLeft");
    keydown(document.body, "ArrowRight");
    keydown(document.body, "L");
    keydown(document.body, "F");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true })));

    expect(actions.previousSentence).toHaveBeenCalledOnce();
    expect(actions.nextSentence).toHaveBeenCalledOnce();
    expect(actions.rewind).toHaveBeenCalledWith(5);
    expect(actions.toggleLoop).toHaveBeenCalledOnce();
    expect(actions.toggleFocus).toHaveBeenCalledOnce();
  });

  it("leaves a focused divider's keyboard contract alone", () => {
    const actions = createActions();
    const view = render(<Probe actions={actions} />);
    const divider = view.getByRole("separator");
    divider.focus();

    expect(keydown(divider, "ArrowLeft").defaultPrevented).toBe(false);
    expect(keydown(divider, " ").defaultPrevented).toBe(false);
    expect(actions.previousSentence).not.toHaveBeenCalled();
    expect(actions.togglePlay).not.toHaveBeenCalled();
  });

  it("does not handle a key already claimed by another control and ignores repeats for toggles", () => {
    const actions = createActions();
    render(<Probe actions={actions} />);
    const claim = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener("keydown", claim, { once: true });
    keydown(document.body, "l");
    act(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true, repeat: true })));
    act(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true, cancelable: true, repeat: true })));
    act(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true, cancelable: true, repeat: true })));

    expect(actions.toggleLoop).not.toHaveBeenCalled();
    expect(actions.togglePlay).not.toHaveBeenCalled();
    expect(actions.toggleFocus).not.toHaveBeenCalled();
  });
});
