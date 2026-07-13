import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageBubble } from "./message-bubble";
import type { ConversationMessageRow } from "@/lib/conversation-types";

function aiMessage(overrides: Partial<ConversationMessageRow> = {}): ConversationMessageRow {
  return {
    id: "m-1",
    role: "ai",
    content: "いらっしゃいませ",
    pronunciation_score: null,
    created_at: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

function userMessage(overrides: Partial<ConversationMessageRow> = {}): ConversationMessageRow {
  return {
    id: "m-2",
    role: "user",
    content: "こんにちは",
    pronunciation_score: null,
    created_at: "2026-07-12T00:00:01.000Z",
    ...overrides,
  };
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("MessageBubble", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-audio-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("shows the message content and role", () => {
    render(<MessageBubble message={userMessage()} />);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
  });

  it("shows a pronunciation score chip on a user message when present", () => {
    render(<MessageBubble message={userMessage({ pronunciation_score: 87 })} />);
    expect(screen.getByText(/87/)).toBeInTheDocument();
  });

  it("plays synthesized audio for an AI message via a play button", async () => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "audio/mpeg" } as unknown as Headers,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    render(<MessageBubble message={aiMessage()} />);
    await userEvent.click(screen.getByRole("button", { name: /play/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/speech/tts");
    expect(JSON.parse(init.body as string)).toMatchObject({ text: "いらっしゃいませ" });

    // Second click reuses the cached blob instead of re-fetching.
    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to a disabled play button with a tooltip when speech isn't configured (503)", async () => {
    fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      headers: { get: () => null } as unknown as Headers,
      json: async () => ({ error: "Speech synthesis is not configured" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MessageBubble message={aiMessage()} />);
    await userEvent.click(screen.getByRole("button", { name: /play/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /play/i })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: /play/i })).toHaveAttribute(
      "title",
      expect.stringMatching(/isn't set up yet/i),
    );
  });
});
