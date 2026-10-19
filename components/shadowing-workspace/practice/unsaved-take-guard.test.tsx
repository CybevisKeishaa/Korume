import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { Attempt, AttemptPhase, AttemptsState } from "@/lib/pronunciation/attempts";
import { UnsavedTakeGuard, useGuardedNavigation } from "./unsaved-take-guard";

const state = vi.hoisted(() => ({ attempts: {} as AttemptsState, dispatch: vi.fn(), push: vi.fn() }));
vi.mock("./pronunciation-attempts-context", () => ({
  usePronunciationAttempts: () => ({ attempts: state.attempts, dispatch: state.dispatch }),
}));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push: state.push }) }));

function attempt(lineId: string, phase: AttemptPhase): Attempt {
  return { lineId, phase, original: null, wav: null, pitch: null, sessionId: null, signedUrl: null, result: null, retryAfter: null };
}

function OpenChat() {
  const navigate = useGuardedNavigation();
  return <button type="button" onClick={() => navigate("/korume/chat?thread=t1")}>Open full chat</button>;
}

// The nav rail renders outside the workspace root (the focus layout's <AppNav>), so the guard listens on the document.
function Harness() {
  return <>
    <nav><a href="/en/dashboard">Dashboard</a></nav>
    <UnsavedTakeGuard>
      <a href="/en/shadowing/v1">Shadowing</a>
      <a href="/en/shadowing/v1/pronunciation" target="_blank">New tab</a>
      <a href="#transcript">Same page</a>
      <a href="https://www.youtube.com/watch?v=x">External</a>
      <a href={window.location.pathname}>Current mode</a>
      <OpenChat />
    </UnsavedTakeGuard>
  </>;
}

function beforeUnloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Clicks with a test-side preventDefault, so jsdom never navigates; reports whether the guard opened its dialog. */
function clickLeavesAlone(name: string, init: MouseEventInit = {}): boolean {
  const link = screen.getByRole("link", { name });
  link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  fireEvent.click(link, init);
  return screen.queryByRole("dialog") === null;
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

  it("confirms a nav-rail link outside the workspace root (review I-1)", async () => {
    state.attempts = { l1: attempt("l1", "save-failed") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave and discard" }));
    expect(state.push).toHaveBeenCalledWith("/dashboard");
  });

  it("routes a programmatic navigation through the same confirm (review I-1, Open full chat)", async () => {
    state.attempts = { l1: attempt("l1", "converting") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open full chat" }));
    expect(state.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Leave and discard" }));
    expect(state.push).toHaveBeenCalledWith("/korume/chat?thread=t1");
  });

  it("navigates at once when nothing is unsaved", async () => {
    state.attempts = { l1: attempt("l1", "scored") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open full chat" }));
    expect(state.push).toHaveBeenCalledWith("/korume/chat?thread=t1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Leave and discard drops every unsaved take and navigates to the locale-less path", async () => {
    state.attempts = { l1: attempt("l1", "save-failed"), l2: attempt("l2", "scored"), l3: attempt("l3", "converting") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("link", { name: "Shadowing" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave and discard" }));
    expect(state.dispatch.mock.calls).toEqual([[{ type: "discard", lineId: "l1" }], [{ type: "discard", lineId: "l3" }]]);
    expect(state.push).toHaveBeenCalledWith("/shadowing/v1");
  });

  it("leaves modifier clicks and new-tab links alone", () => {
    state.attempts = { l1: attempt("l1", "save-failed") };
    render(<Harness />);
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) expect(clickLeavesAlone("Shadowing", init)).toBe(true);
    expect(clickLeavesAlone("New tab")).toBe(true);
  });

  it("leaves same-page hashes, other origins and the current page to the browser (review I-2)", () => {
    state.attempts = { l1: attempt("l1", "recording") };
    render(<Harness />);
    for (const name of ["Same page", "External", "Current mode"]) expect(clickLeavesAlone(name)).toBe(true);
    expect(state.dispatch).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();
  });

  it("leaves a download alone, such as the transcript export's blob link on <body> (review R-1)", () => {
    state.attempts = { l1: attempt("l1", "save-failed") };
    render(<Harness />);
    const anchor = document.createElement("a");
    anchor.href = `blob:${window.location.origin}/abc-123`;
    anchor.download = "transcript.txt";
    anchor.textContent = "Export";
    anchor.addEventListener("click", (event) => event.preventDefault(), { once: true });
    document.body.append(anchor);
    expect(fireEvent.click(anchor)).toBe(false); // prevented only by this test's own listener
    anchor.remove();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets a link through while the only unsaved take is still saving: that save finishes on its own (review R-2)", () => {
    state.attempts = { l1: attempt("l1", "saving") };
    render(<Harness />);
    expect(clickLeavesAlone("Shadowing")).toBe(true);
    expect(state.dispatch).not.toHaveBeenCalled();
    expect(beforeUnloadPrevented()).toBe(true); // closing the tab would still abort the upload
  });

  it("Leave and discard keeps a take that is saving, so its 201 never lands on a newer take (review R-2)", async () => {
    state.attempts = { l1: attempt("l1", "saving"), l2: attempt("l2", "save-failed") };
    render(<Harness />);
    await userEvent.click(screen.getByRole("link", { name: "Shadowing" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave and discard" }));
    expect(state.dispatch.mock.calls).toEqual([[{ type: "discard", lineId: "l2" }]]);
  });

  it("does nothing to links when every take is saved", () => {
    state.attempts = { l1: attempt("l1", "scored") };
    render(<Harness />);
    expect(clickLeavesAlone("Dashboard")).toBe(true);
    expect(clickLeavesAlone("Shadowing")).toBe(true);
  });
});
