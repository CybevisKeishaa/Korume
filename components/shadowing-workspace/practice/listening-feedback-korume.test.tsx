import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { korume as figure, LINES, probe, serve, server, shell, stubListeningFetch, type AttemptBody } from "@/test/listening-body";
import { resetTabWritesForTests } from "../workspace-context";

vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: vi.fn() }));
const router = { refresh: vi.fn(), replace: vi.fn() };
let searchParams = new URLSearchParams("line=line-1");
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
  usePathname: () => "/shadowing/video-1/listening",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1/listening", useSearchParams: () => searchParams }));

/** Holds the next attempt request until the test releases it with the server's real answer. */
function holdAttempt() {
  let held: { body: AttemptBody; done: (response: Response) => void } | null = null;
  server.attempt = (body) => new Promise((done) => { held = { body, done }; });
  return async () => { await act(async () => { const request = held as unknown as NonNullable<typeof held>; request.done(serve(request.body)); }); };
}

const { frames } = probe;
const bank = () => screen.getByRole("list", { name: "Word bank" });
const place = (text: string) => fireEvent.click(within(bank()).getByRole("button", { name: text }));
const check = () => screen.getByRole("button", { name: /^(Check|Checking…)$/ });
const feedback = () => screen.getByTestId("listening-feedback");
const nextSentence = () => within(screen.getByTestId("practice-panel")).getByRole("button", { name: /^Next sentence/ });
const LINE = LINES["line-1"].display;

async function open() {
  searchParams = new URLSearchParams("line=line-1&format=word_bank");
  const view = render(shell());
  await screen.findByRole("list", { name: "Your sentence" });
  return view;
}
async function checkPerfect() {
  LINE.forEach(place);
  fireEvent.click(check());
  await screen.findByTestId("listening-score");
}

let yt: YouTubeStubHandle;
beforeEach(() => {
  yt = installYouTubeStub();
  sessionStorage.clear();
  resetTabWritesForTests();
  router.replace.mockReset();
  frames.length = 0;
  stubListeningFetch();
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

describe("ListeningFeedbackKorume inside the Listening body (P15)", () => {
  it("shows no figure in the first render, while answering, or while a Check is pending", async () => {
    const release = holdAttempt();
    await open();
    expect(figure()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    LINE.slice(1).forEach(place);
    expect(figure()).toBeNull();
    fireEvent.click(check());
    expect(check()).toBeDisabled();
    expect(figure()).toBeNull();
    await release();
    await screen.findByTestId("listening-score");
    expect(figure()).not.toBeNull();
  });

  it.each([
    ["a 4xx", () => Promise.resolve(Response.json({ error: "invalid" }, { status: 400 }))],
    ["a 5xx", () => Promise.resolve(new Response(null, { status: 500 }))],
    ["a 429", () => Promise.resolve(new Response(null, { status: 429 }))],
    ["a network failure", () => Promise.reject(new TypeError("offline"))],
  ])("shows no figure after %s", async (_name, failure) => {
    await open();
    server.attempt = failure;
    LINE.forEach(place);
    fireEvent.click(check());
    await screen.findByRole("alert");
    expect(figure()).toBeNull();
  });

  it("shows joy after a perfect Check, encourage after a perfect but hinted one, and review after Show answer", async () => {
    await open();
    await checkPerfect();
    expect(figure()).toHaveAttribute("data-mascot-pose", "listening-joy");
    expect(figure()?.getAttribute("src")).toContain("happy.png");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    LINE.slice(1).forEach(place);
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(figure()).toHaveAttribute("data-mascot-pose", "listening-encourage");
    expect(figure()?.getAttribute("src")).toContain("neutral.png");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByTestId("listening-answer");
    expect(figure()).toHaveAttribute("data-mascot-pose", "listening-review");
    expect(figure()?.getAttribute("src")).toContain("thinking.png");
  });

  it("is decorative: no accessible name, outside the live region, and the P14 text is still read", async () => {
    await open();
    await checkPerfect();
    const korume = figure();
    expect(korume).toHaveAttribute("alt", "");
    expect(korume).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
    expect(feedback()).toHaveAttribute("aria-live", "polite");
    expect(feedback().textContent).toBe("You arranged the whole sentence yourself!");
    expect(feedback().contains(korume)).toBe(false);
  });

  it("is gone in the same commit as the concealment on Try again", async () => {
    await open();
    await checkPerfect();
    const before = probe.reveal?.attempt ?? -1;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(frames.find((frame) => frame.attempt === before + 1)).toMatchObject({ answer: false, korume: null });
    expect(figure()).toBeNull();
  });

  it("is gone in the same commit as the concealment on Next", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    await checkPerfect();
    const before = probe.reveal?.attempt ?? -1;
    fireEvent.click(nextSentence());
    await waitFor(() => expect(within(bank()).getAllByRole("button").map((chip) => chip.textContent).sort()).toEqual([...LINES["line-2"].display].sort()));
    expect(frames.find((frame) => frame.attempt === before + 1)).toMatchObject({ answer: false, korume: null });
    expect(figure()).toBeNull();
  });

  it("is gone in the same commit as the concealment on a format switch", async () => {
    const view = await open();
    await checkPerfect();
    const before = probe.reveal?.attempt ?? -1;
    searchParams = new URLSearchParams("line=line-1&format=typing");
    view.rerender(shell());
    expect(frames.find((frame) => frame.attempt === before + 1)).toMatchObject({ answer: false, korume: null });
    expect(figure()).toBeNull();
  });

  // A stale response leaves the reveal context untouched, so CommitProbe records no frame for it: the settled DOM is the check.
  it("never shows the figure for a stale attempt's response resolving after a new attempt started", async () => {
    const release = holdAttempt();
    await open();
    LINE.forEach(place);
    fireEvent.click(check());
    // Try again's own reset (P11): the held response now belongs to a discarded attempt.
    act(() => probe.reveal?.newAttempt());
    await release();
    expect(figure()).toBeNull();
    expect(screen.queryByTestId("listening-score")).toBeNull();
  });

  it("never shows the figure for a stale response resolving after Next", async () => {
    const release = holdAttempt();
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    LINE.forEach(place);
    fireEvent.click(check());
    fireEvent.click(nextSentence());
    await waitFor(() => expect(within(bank()).getAllByRole("button").map((chip) => chip.textContent).sort()).toEqual([...LINES["line-2"].display].sort()));
    await release();
    expect(figure()).toBeNull();
  });
});
