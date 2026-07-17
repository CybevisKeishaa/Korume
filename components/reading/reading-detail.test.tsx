import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { ReadingDetail } from "./reading-detail";

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null } as unknown as Headers,
    json: async () => body,
  } as unknown as Response;
}

const PASSAGE = {
  id: "r1",
  title: "はじめての日本",
  jlpt_level: "N5",
  body_jp: "今日は晴れです。",
  body_translation: "It is sunny today.",
  furigana_json: [{ text: "今日", reading: "きょう" }, { text: "は" }, { text: "晴れ", reading: "はれ" }, { text: "です" }, { text: "。" }],
  word_count: 42,
  created_at: "2026-01-01",
  questions: [{ id: "q1", question: "天気は？", options: ["晴れ", "雨", "雪", "曇り"], order_index: 0 }],
};

describe("ReadingDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state, then the passage header, body, and quiz once fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { data: PASSAGE })));

    render(<ReadingDetail passageId="r1" />);
    expect(screen.getByText(/loading passage/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("heading", { name: "はじめての日本" })).toBeInTheDocument());

    expect(screen.getByText("42 words")).toBeInTheDocument();
    expect(screen.getByText("Show translation")).toBeInTheDocument();
    expect(screen.getByText(/天気は/)).toBeInTheDocument();
  });

  it("shows a not-found message on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { error: "Not found" })));

    render(<ReadingDetail passageId="missing" />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/passage not found/i),
    );
  });

  it("shows a friendly error message on a failed request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { error: "boom" })));

    render(<ReadingDetail passageId="r1" />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load this passage/i));
  });
});
