import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { TranscriptLineRow } from "@/lib/video-types";
import { MineLineControl } from "./mine-line-control";

const LINE_WITH_KANJI: TranscriptLineRow = {
  id: "line-1",
  start_time: 0,
  end_time: 3,
  text_jp: "私は学校に行きます",
  text_translation: "I go to school",
  furigana_json: [
    { text: "私", reading: "わたし" },
    { text: "は" },
    { text: "学校", reading: "がっこう" },
    { text: "に行きます", reading: "にいきます" },
  ],
};

const LINE_WITHOUT_KANJI: TranscriptLineRow = {
  id: "line-2",
  start_time: 3,
  end_time: 6,
  text_jp: "さようなら",
  text_translation: "Goodbye",
  furigana_json: [{ text: "さようなら" }],
};

function mockFetchOnce(response: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  json?: () => Promise<unknown>;
}): ReturnType<typeof vi.fn> {
  const headers = new Headers(response.headers ?? {});
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    headers,
    json: response.json ?? (async () => ({})),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MineLineControl", () => {
  it("lists the line's kanji-bearing segments once opened", async () => {
    mockFetchOnce({ ok: true, status: 201, json: async () => ({ data: { id: "card-1" } }) });
    render(<MineLineControl line={LINE_WITH_KANJI} />);

    await userEvent.click(screen.getByRole("button", { name: /mine/i }));

    expect(screen.getByRole("group", { name: "Pick a word to mine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /私/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /学校/ })).toBeInTheDocument();
  });

  it("posts the chosen segment's word and reading to /api/mining and shows a success message", async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "card-1" } }),
    });
    render(<MineLineControl line={LINE_WITH_KANJI} />);

    await userEvent.click(screen.getByRole("button", { name: /mine/i }));
    await userEvent.click(screen.getByRole("button", { name: /^学校/ }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/mining",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lineId: "line-1", targetWord: "学校", reading: "がっこう" }),
      }),
    );
    expect(await screen.findByText(/added.*学校.*mining deck/i)).toBeInTheDocument();
  });

  it("shows a fallback text field when the line has no kanji-bearing segments", async () => {
    mockFetchOnce({ ok: true, status: 201, json: async () => ({ data: { id: "card-1" } }) });
    render(<MineLineControl line={LINE_WITHOUT_KANJI} />);

    await userEvent.click(screen.getByRole("button", { name: /mine/i }));

    const input = screen.getByRole("textbox", { name: /word to mine/i });
    await userEvent.type(input, "さようなら");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/mining",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lineId: "line-2", targetWord: "さようなら" }),
      }),
    );
  });

  it("shows a retry-after wait message on 429", async () => {
    mockFetchOnce({ ok: false, status: 429, headers: { "Retry-After": "30" } });
    render(<MineLineControl line={LINE_WITH_KANJI} />);

    await userEvent.click(screen.getByRole("button", { name: /mine/i }));
    await userEvent.click(screen.getByRole("button", { name: /^学校/ }));

    expect(await screen.findByText(/wait 30s/i)).toBeInTheDocument();
  });

  it("is keyboard operable: Escape closes the popover and returns focus to the Mine button", async () => {
    mockFetchOnce({ ok: true, status: 201, json: async () => ({ data: { id: "card-1" } }) });
    render(<MineLineControl line={LINE_WITH_KANJI} />);

    const mineButton = screen.getByRole("button", { name: /mine/i });
    await userEvent.click(mineButton);
    expect(screen.getByRole("button", { name: /^学校/ })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: /^学校/ })).not.toBeInTheDocument();
    expect(mineButton).toHaveFocus();
  });
});
