import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test/render";
import { HubPathCard, type HubPathCardData } from "./hub-path-card";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const path: HubPathCardData = {
  id: "path-1",
  title: "Business Japanese",
  description: "Meetings, emails and confident introductions.",
  icon: "💼",
  total: 120,
  completed: 80,
  started: true,
  saved: false,
  meta: "120 lessons · 8h",
  nextLessonId: "lesson-81",
  saveLabel: "Save Business Japanese",
  progressLabel: "67% complete",
};

// Plain strings only: these cross the Server -> Client boundary (a function here broke the page).
const labels = { start: "Start", continue: "Continue", saveFailed: "Could not update your saved paths." };

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((settle) => { resolve = settle; });
  return { promise, resolve };
}

const toggle = () => screen.getByRole("button", { name: "Save Business Japanese" });

beforeEach(() => refresh.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("HubPathCard", () => {
  it("shows the frame's card content and continues a started path at its next lesson", () => {
    render(<HubPathCard path={path} labels={labels} />);

    expect(screen.getByRole("heading", { level: 3, name: "Business Japanese" })).toBeInTheDocument();
    expect(screen.getByText("120 lessons · 8h")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "67% complete" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue: Business Japanese" })).toHaveAttribute("href", "/en/shadowing/lesson-81");
  });

  it("starts an untouched path, and offers no action when no lesson is visible", () => {
    const { rerender } = render(<HubPathCard path={{ ...path, started: false, completed: 0 }} labels={labels} />);
    expect(screen.getByRole("link", { name: "Start: Business Japanese" })).toBeInTheDocument();

    rerender(<HubPathCard path={{ ...path, nextLessonId: null }} labels={labels} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a goal as the same card without a save toggle, with its optional badge", () => {
    render(<HubPathCard path={{ ...path, saveable: false, badgeLabel: "Recommended for you" }} labels={labels} />);

    expect(screen.queryByRole("button", { name: "Save Business Japanese" })).not.toBeInTheDocument();
    expect(screen.getByText("Recommended for you")).toBeInTheDocument();
  });

  it("keeps ONE name and lets aria-pressed carry the state; PUT saves, DELETE unsaves, then it refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HubPathCard path={path} labels={labels} />);

    await user.click(toggle());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/collections/path-1/save", { method: "PUT" });
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(toggle()).toHaveFocus();
    expect(refresh).toHaveBeenCalledTimes(1);

    await user.click(toggle());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/collections/path-1/save", { method: "DELETE" });
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("rolls a failed save back to what the server last accepted, and says so", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    const user = userEvent.setup();
    render(<HubPathCard path={path} labels={labels} />);

    await user.click(toggle());

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.saveFailed);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sends one write at a time and skips a write the server already agrees with", async () => {
    const first = deferred();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HubPathCard path={path} labels={labels} />);

    // save (slow) -> unsave -> save again, all before the first answer.
    await user.click(toggle());
    await user.click(toggle());
    await user.click(toggle());
    // While the first PUT is pending nothing else may be on the wire.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(new Response(null, { status: 200 }));
      await first.promise;
    });

    // The server holds "saved" and the learner's last word is "saved": no second write.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("follows a queued change through, in order, once the in-flight write settles", async () => {
    const first = deferred();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HubPathCard path={path} labels={labels} />);

    await user.click(toggle()); // PUT, pending
    await user.click(toggle()); // wants unsaved: must wait for the PUT, then DELETE
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(new Response(null, { status: 200 }));
      await first.promise;
    });

    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual(["PUT", "DELETE"]);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("adopts the server's state when a refresh hands down new props", () => {
    const { rerender } = render(<HubPathCard path={path} labels={labels} />);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");

    rerender(<HubPathCard path={{ ...path, saved: true }} labels={labels} />);
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });
});
