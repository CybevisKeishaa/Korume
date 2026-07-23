import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import type { MiningQueueItem } from "@/lib/mining-types";
import { MiningReviewSession } from "./mining-review-session";

const ITEMS: MiningQueueItem[] = [
  {
    id: "card-1",
    sentenceJp: "私は学校に行きます",
    targetWord: "学校",
    reading: "がっこう",
    translation: "I go to school",
    videoId: "abc123",
    startTime: 10,
    endTime: 15,
  },
  {
    id: "card-2",
    sentenceJp: "猫が好きです",
    targetWord: "猫",
    reading: "ねこ",
    translation: "I like cats",
    videoId: "xyz789",
    startTime: 0,
    endTime: 4,
  },
];

interface FetchCall {
  url: string;
  method: string | undefined;
  body: unknown;
}

function mockFetch(): FetchCall[] {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return { ok: true, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

describe("MiningReviewSession", () => {
  let yt: YouTubeStubHandle;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    yt = installYouTubeStub({ duration: 90 });
  });

  afterEach(() => {
    yt.restore();
    vi.unstubAllGlobals();
    // A failing assertion inside a test body would skip an inline
    // `spy.mockRestore()`, leaving console.error mocked for the rest of the
    // file — restore unconditionally here instead (mirrors review-session.test.tsx).
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
  });

  it("shows an empty-queue message when there is nothing due", () => {
    mockFetch();
    render(<MiningReviewSession items={[]} />);
    expect(screen.getByText(/nothing due/i)).toBeInTheDocument();
  });

  it("shows the sentence with the target word emphasized on the front, hides reading/translation until revealed", () => {
    mockFetch();
    render(<MiningReviewSession items={ITEMS} />);

    expect(screen.getByText("学校", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("がっこう")).not.toBeInTheDocument();
    expect(screen.queryByText("I go to school")).not.toBeInTheDocument();
  });

  it("reveals the reading and translation after Show answer", async () => {
    mockFetch();
    render(<MiningReviewSession items={ITEMS} />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));

    expect(screen.getByText("がっこう")).toBeInTheDocument();
    expect(screen.getByText("I go to school")).toBeInTheDocument();
  });

  it("grading posts the card id and quality, then advances to the next card", async () => {
    const calls = mockFetch();
    render(<MiningReviewSession items={ITEMS} />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    await waitFor(() =>
      expect(calls.find((c) => c.url === "/api/mining/review")).toBeDefined(),
    );
    const call = calls.find((c) => c.url === "/api/mining/review")!;
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({ cardId: "card-1", quality: 4 });

    await waitFor(() => expect(screen.getByText("猫", { selector: "strong" })).toBeInTheDocument());
  });

  it("shows a completion message (singular) once every card has been reviewed", async () => {
    mockFetch();
    render(<MiningReviewSession items={[ITEMS[0]!]} />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/session complete/i);
    // Mining's copy ("sentence(s)") is distinct from
    // `common.srs.reviewedCount`'s "item(s)" wording (Task 12 brief) — pin
    // that this component renders ITS OWN key, not the shared one.
    expect(status).toHaveTextContent("You reviewed 1 sentence.");
  });

  it("shows a completion message (plural) after reviewing more than one card", async () => {
    mockFetch();
    render(<MiningReviewSession items={ITEMS} />);

    for (let i = 0; i < ITEMS.length; i++) {
      await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
      await userEvent.click(screen.getByRole("button", { name: /^good/i }));
    }

    expect(await screen.findByRole("status")).toHaveTextContent("You reviewed 2 sentences.");
  });

  it("offers a Play clip control on the front of the card", () => {
    mockFetch();
    render(<MiningReviewSession items={ITEMS} />);
    expect(screen.getByRole("button", { name: /play clip/i })).toBeInTheDocument();
  });

  /**
   * Binding convention #3 (Task 12 brief): the grade buttons render
   * `{t(srs.label)}` next to the shortcut `{g.key}` from the SAME `GRADES`
   * entry. Asserting each button's own accessible name pairs with its own
   * number — not merely that all four labels and all four numbers exist
   * somewhere on the page — is what makes swapping two `labelKey`s (e.g.
   * "again" and "hard" trade places while their `key`s stay put) turn this
   * test RED instead of green.
   */
  it("pairs each grade label with its own keyboard-shortcut number", async () => {
    mockFetch();
    render(<MiningReviewSession items={ITEMS} />);
    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));

    expect(screen.getByRole("button", { name: /^again/i })).toHaveTextContent("Again1");
    expect(screen.getByRole("button", { name: /^hard/i })).toHaveTextContent("Hard2");
    expect(screen.getByRole("button", { name: /^good/i })).toHaveTextContent("Good3");
    expect(screen.getByRole("button", { name: /^easy/i })).toHaveTextContent("Easy4");
  });

  /**
   * Reviewer-identified wiring gap (Task 12 fix wave): the catch block routes
   * server-diagnostic text through `t("states.error")` so only translated,
   * generic copy reaches the DOM (CLAUDE.md §5 differentiator note on the
   * mirrored `review-session.tsx` fix). A mutation that reintroduces
   * `setError(e.message)` — or points the key elsewhere — must turn this RED.
   */
  it("shows the translated generic error message when the review POST throws a network error (never the raw exception text)", async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    render(<MiningReviewSession items={ITEMS} />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong.");
    expect(alert).not.toHaveTextContent("boom");
  });

  it("shows the translated generic error message when the review POST resolves not-ok (never the raw status text)", async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response),
    );
    render(<MiningReviewSession items={ITEMS} />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong.");
    expect(alert).not.toHaveTextContent("Review failed (500)");
  });
});
