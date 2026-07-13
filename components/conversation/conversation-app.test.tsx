import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mockGetUserMedia,
  mockMediaRecorder,
  type GetUserMediaMockHandle,
  type MediaRecorderMockHandle,
} from "@/test/media-mocks";
import { mockAudioContext, type AudioContextMockHandle } from "@/test/audio-context-mock";
import { readBlobBytes } from "@/test/blob-utils";
import { ConversationApp } from "./conversation-app";

interface Route {
  match: (url: string, init: RequestInit | undefined) => boolean;
  handle: (url: string, init: RequestInit | undefined) => Response | Promise<Response>;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name] ?? null } as Headers,
    json: async () => body,
  } as unknown as Response;
}

function makeRouter(routes: Route[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) throw new Error(`ConversationApp test: no route matched fetch to "${url}"`);
    return route.handle(url, init);
  });
  return { fn, calls };
}

function methodOf(init?: RequestInit): string {
  return init?.method ?? "GET";
}

describe("ConversationApp", () => {
  let gum: GetUserMediaMockHandle;
  let mr: MediaRecorderMockHandle;
  let audio: AudioContextMockHandle;

  beforeEach(() => {
    gum = mockGetUserMedia();
    mr = mockMediaRecorder([new Uint8Array([1, 2, 3])]);
    audio = mockAudioContext({
      channelData: [new Float32Array([0, 0.5, -0.5, 1])],
      sampleRate: 48000,
    });
  });

  afterEach(() => {
    gum.restore();
    mr.restore();
    audio.restore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("lists sessions, starts a new one from the scenario picker, and shows an empty chat", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: (_url, init) => {
          const body = JSON.parse(init!.body as string);
          expect(body).toEqual({ scenario: "restaurant" });
          return jsonResponse(201, {
            data: { id: "sess-1", scenario_type: "restaurant", started_at: "2026-07-12T00:00:00Z", ended_at: null },
          });
        },
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);

    await waitFor(() => expect(screen.getByText(/no past sessions yet/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /restaurant/i }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /message/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /end session/i })).toBeInTheDocument();
  });

  it("sends a message and renders the AI reply, including a truncated notice", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(201, {
            data: { id: "sess-1", scenario_type: "free-talk", started_at: "t", ended_at: null },
          }),
      },
      {
        match: (url, init) => url === "/api/conversation/message" && methodOf(init) === "POST",
        handle: (_url, init) => {
          const body = JSON.parse(init!.body as string);
          expect(body).toMatchObject({ sessionId: "sess-1", message: "こんにちは" });
          return jsonResponse(200, { data: { reply: "いらっしゃいませ", truncated: true, model: "m" } });
        },
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    await waitFor(() => screen.getByText(/no past sessions yet/i));
    await userEvent.click(screen.getByRole("button", { name: /free talk/i }));

    const input = await screen.findByRole("textbox", { name: /message/i });
    await userEvent.type(input, "こんにちは");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(screen.getByText("いらっしゃいませ")).toBeInTheDocument());
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText(/shortened/i)).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("shows a live retry-after countdown on 429 and re-enables sending once it reaches zero", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(201, { data: { id: "sess-1", scenario_type: "free-talk", started_at: "t", ended_at: null } }),
      },
      {
        match: (url, init) => url === "/api/conversation/message" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(429, { error: "Too many messages, slow down" }, { "Retry-After": "3" }),
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    await waitFor(() => screen.getByText(/no past sessions yet/i));
    await userEvent.click(screen.getByRole("button", { name: /free talk/i }));

    const input = await screen.findByRole("textbox", { name: /message/i });
    await userEvent.type(input, "hi");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/try again in 3s/i));
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/try again in 2s/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled());
  });

  it("shows a friendly message and no crash when the conversation API is not configured (503)", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(201, { data: { id: "sess-1", scenario_type: "free-talk", started_at: "t", ended_at: null } }),
      },
      {
        match: (url, init) => url === "/api/conversation/message" && methodOf(init) === "POST",
        handle: () => jsonResponse(503, { error: "Conversation is not configured" }),
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    await waitFor(() => screen.getByText(/no past sessions yet/i));
    await userEvent.click(screen.getByRole("button", { name: /free talk/i }));

    const input = await screen.findByRole("textbox", { name: /message/i });
    await userEvent.type(input, "hi");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/not configured/i),
    );
    // Text chat input itself remains usable, not crashed/removed.
    expect(screen.getByRole("textbox", { name: /message/i })).toBeEnabled();
  });

  it("ends the session and shows the AI-generated corrections panel", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(201, { data: { id: "sess-1", scenario_type: "free-talk", started_at: "t", ended_at: null } }),
      },
      {
        match: (url, init) => url === "/api/conversation/session/sess-1/end" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(200, {
            data: {
              corrections: [{ original: "a", corrected: "b", explanation: "why" }],
              encouragement: "Well done!",
              model: "m",
            },
          }),
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    await waitFor(() => screen.getByText(/no past sessions yet/i));
    await userEvent.click(screen.getByRole("button", { name: /free talk/i }));
    await screen.findByRole("button", { name: /end session/i });

    await userEvent.click(screen.getByRole("button", { name: /end session/i }));

    await waitFor(() => expect(screen.getByText(/well done/i)).toBeInTheDocument());
    expect(screen.getByText(/ai-generated/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /message/i })).not.toBeInTheDocument();
  });

  it("opens a past session as a read-only transcript from history", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () =>
          jsonResponse(200, {
            data: [{ id: "sess-old", scenario_type: "shopping", started_at: "2026-07-01T00:00:00Z", ended_at: "2026-07-01T00:10:00Z" }],
          }),
      },
      {
        match: (url, init) => url === "/api/conversation/session/sess-old" && methodOf(init) === "GET",
        handle: () =>
          jsonResponse(200, {
            data: [
              { id: "m-1", role: "user", content: "いくらですか", pronunciation_score: null, created_at: "t1" },
              { id: "m-2", role: "ai", content: "1000円です", pronunciation_score: null, created_at: "t2" },
            ],
          }),
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    const historyRegion = await screen.findByRole("region", { name: /past sessions/i });
    await waitFor(() => within(historyRegion).getByRole("button", { name: /shopping/i }));
    await userEvent.click(within(historyRegion).getByRole("button", { name: /shopping/i }));

    await waitFor(() => expect(screen.getByText("いくらですか")).toBeInTheDocument());
    expect(screen.getByText("1000円です")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /message/i })).not.toBeInTheDocument();
  });

  it("voice mode: transcribes speech into the input for confirmation before sending", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(201, { data: { id: "sess-1", scenario_type: "free-talk", started_at: "t", ended_at: null } }),
      },
      {
        match: (url) => url === "/api/speech/stt",
        handle: () => jsonResponse(200, { data: { text: "すみません", confidence: 0.9 } }),
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    await waitFor(() => screen.getByText(/no past sessions yet/i));
    await userEvent.click(screen.getByRole("button", { name: /free talk/i }));
    await screen.findByRole("textbox", { name: /message/i });

    await userEvent.click(screen.getByRole("button", { name: /record voice message/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /stop recording/i }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: /message/i })).toHaveValue("すみません"));
    expect(screen.getByText(/check before sending/i)).toBeInTheDocument();
  });

  it("voice mode: scores the sent voice message with a 16kHz mono WAV upload", async () => {
    const router = makeRouter([
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "GET",
        handle: () => jsonResponse(200, { data: [] }),
      },
      {
        match: (url, init) => url === "/api/conversation/session" && methodOf(init) === "POST",
        handle: () =>
          jsonResponse(201, { data: { id: "sess-1", scenario_type: "free-talk", started_at: "t", ended_at: null } }),
      },
      {
        match: (url) => url === "/api/speech/stt",
        handle: () => jsonResponse(200, { data: { text: "すみません", confidence: 0.9 } }),
      },
      {
        match: (url, init) => url === "/api/conversation/message" && methodOf(init) === "POST",
        handle: () => jsonResponse(200, { data: { reply: "はい", truncated: false, model: "m" } }),
      },
      {
        match: (url) => url === "/api/pronunciation/score",
        handle: () => jsonResponse(200, { data: { pronunciationScore: 88 } }),
      },
    ]);
    vi.stubGlobal("fetch", router.fn);

    render(<ConversationApp />);
    await waitFor(() => screen.getByText(/no past sessions yet/i));
    await userEvent.click(screen.getByRole("button", { name: /free talk/i }));
    await screen.findByRole("textbox", { name: /message/i });

    await userEvent.click(screen.getByRole("button", { name: /record voice message/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /message/i })).toHaveValue("すみません"));

    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() =>
      expect(router.calls.some((c) => c.url === "/api/pronunciation/score")).toBe(true),
    );
    const scoreCall = router.calls.find((c) => c.url === "/api/pronunciation/score")!;
    const body = scoreCall.init!.body as FormData;
    expect(body.get("referenceText")).toBe("すみません");

    const uploaded = body.get("audio") as File;
    expect(uploaded.type).toBe("audio/wav");
    expect(uploaded.name).toBe("voice-message.wav");

    const bytes = await readBlobBytes(uploaded);
    const view = new DataView(bytes);
    expect(String.fromCharCode(...new Uint8Array(bytes, 0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16000); // resampled to 16kHz
    expect(view.getUint16(22, true)).toBe(1); // mono
  });
});
