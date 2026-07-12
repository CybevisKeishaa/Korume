import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  beforeEach(() => {
    yt = installYouTubeStub({ duration: 90 });
  });

  afterEach(() => {
    yt.restore();
    vi.unstubAllGlobals();
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

  it("shows a completion message once every card has been reviewed", async () => {
    mockFetch();
    render(<MiningReviewSession items={[ITEMS[0]!]} />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/session complete/i);
  });

  it("offers a Play clip control on the front of the card", () => {
    mockFetch();
    render(<MiningReviewSession items={ITEMS} />);
    expect(screen.getByRole("button", { name: /play clip/i })).toBeInTheDocument();
  });
});
