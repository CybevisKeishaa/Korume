import { useRef } from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { Attempt, AttemptPhase, AttemptsState } from "@/lib/pronunciation/attempts";
import { UnsavedTakeGuard } from "./unsaved-take-guard";

const state = vi.hoisted(() => ({ attempts: {} as AttemptsState, dispatch: vi.fn(), push: vi.fn() }));
vi.mock("./pronunciation-attempts-context", () => ({
  usePronunciationAttempts: () => ({ attempts: state.attempts, dispatch: state.dispatch }),
}));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push: state.push }) }));

function attempt(lineId: string, phase: AttemptPhase): Attempt {
  return { lineId, phase, original: null, wav: null, pitch: null, sessionId: null, signedUrl: null, result: null, retryAfter: null };
}

function Harness() {
  const rootRef = useRef<HTMLDivElement>(null);
  return <>
    <div ref={rootRef}>
      <a href="/en/shadowing/v1">Shadowing</a>
      <a href="/en/shadowing/v1/pronunciation" target="_blank">New tab</a>
      <UnsavedTakeGuard rootRef={rootRef} />
    </div>
    <a href="/en/dashboard">Outside</a>
  </>;
}

function beforeUnloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  state.attempts = {};
  state.dispatch.mockReset();
  state.push.mockReset();
});

describe("UnsavedTakeGuard", () => {
  it.each(["recording", "converting", "convert-failed", "saving", "save-failed"] as const)("warns on unload while a take is %s", (phase) => {
    state.attempts = { l1: attempt("l1", phase) };
    render(<Harness />);
    expect(beforeUnloadPrevented()).toBe(true);
  });

  it.each(["scoring", "scored", "unscored-error"] as const)("lets the page unload once the take is saved (%s)", (phase) => {
    state.attempts = { l1: attempt("l1", phase) };
    render(<Harness />);
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it("confirms an in-workspace link, and Stay keeps the page", async () => {
    state.attempts = { l1: attempt("l1", "save-failed") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("link", { name: "Shadowing" }));
    expect(screen.getByRole("dialog", { name: "Leave this take unsaved?" })).toBeInTheDocument();
    // The dialog's × is also labelled "Stay"; this is the visible button.
    await userEvent.click(screen.getByText("Stay", { selector: "button" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.dispatch).not.toHaveBeenCalled();
  });

  it("Leave and discard drops every unsaved take and navigates to the locale-less path", async () => {
    state.attempts = { l1: attempt("l1", "save-failed"), l2: attempt("l2", "scored"), l3: attempt("l3", "converting") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("link", { name: "Shadowing" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave and discard" }));
    expect(state.dispatch.mock.calls).toEqual([[{ type: "discard", lineId: "l1" }], [{ type: "discard", lineId: "l3" }]]);
    expect(state.push).toHaveBeenCalledWith("/shadowing/v1");
  });

  it("leaves modifier clicks, new-tab links and links outside the workspace alone", () => {
    state.attempts = { l1: attempt("l1", "saving") };
    render(<Harness />);
    const shadowing = screen.getByRole("link", { name: "Shadowing" });
    shadowing.addEventListener("click", (event) => event.preventDefault());
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      expect(fireEvent.click(shadowing, init)).toBe(false); // prevented only by the test's own listener
    }
    const newTab = screen.getByRole("link", { name: "New tab" });
    newTab.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(newTab);
    const outside = screen.getByRole("link", { name: "Outside" });
    outside.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(outside);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does nothing to links when every take is saved", async () => {
    state.attempts = { l1: attempt("l1", "scored") };
    render(<Harness />);
    const link = screen.getByRole("link", { name: "Shadowing" });
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
