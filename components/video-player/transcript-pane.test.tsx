import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/providers/theme-provider";
import type { TranscriptLineRow } from "@/lib/video-types";
import { TranscriptPane } from "./transcript-pane";

const LINES: TranscriptLineRow[] = [
  {
    id: "line-1",
    start_time: 0,
    end_time: 3,
    text_jp: "こんにちは",
    text_translation: "Hello",
    furigana_json: [{ text: "こんにちは" }],
  },
  {
    id: "line-2",
    start_time: 3,
    end_time: 6,
    text_jp: "学校",
    text_translation: "School",
    furigana_json: [{ text: "学校", reading: "がっこう" }],
  },
];

function renderPane(overrides: Partial<ComponentProps<typeof TranscriptPane>> = {}) {
  const onLineSelect = vi.fn();
  const utils = render(
    <ThemeProvider>
      <TranscriptPane
        lines={LINES}
        activeLineId={null}
        onLineSelect={onLineSelect}
        furiganaMode="all"
        masteryMap={{}}
        showTranslation
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { onLineSelect, ...utils };
}

function mockFetchOnce(response: { ok: boolean; status: number }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      headers: new Headers(),
      json: async () => ({ data: { id: "card-1" } }),
    } as Response),
  );
}

beforeEach(() => {
  // jsdom has no scrollIntoView implementation.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TranscriptPane", () => {
  it("shows an empty-state message when there are no lines yet", () => {
    renderPane({ lines: [] });
    expect(screen.getByText("This transcript has no lines yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("labels the transcript list for assistive tech", () => {
    renderPane();
    expect(screen.getByRole("list", { name: "Transcript" })).toBeInTheDocument();
  });

  it("marks only the active line with aria-current", () => {
    renderPane({ activeLineId: "line-2" });
    expect(screen.getByRole("button", { name: /こんにちは/ })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: /学校/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("calls onLineSelect with the clicked line", async () => {
    const { onLineSelect } = renderPane();
    await userEvent.click(screen.getByRole("button", { name: /こんにちは/ }));
    expect(onLineSelect).toHaveBeenCalledWith(LINES[0]);
  });

  it("is keyboard operable — Enter on a focused line activates it", async () => {
    const { onLineSelect } = renderPane();
    screen.getByRole("button", { name: /学校/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onLineSelect).toHaveBeenCalledWith(LINES[1]);
  });

  it("shows a furigana reading for every kanji word in mode='all'", () => {
    renderPane({ furiganaMode: "all" });
    expect(screen.getByRole("button", { name: /学校/ }).textContent).toContain("がっこう");
  });

  it("hides every furigana reading in mode='off'", () => {
    renderPane({ furiganaMode: "off" });
    const button = screen.getByRole("button", { name: /学校/ });
    expect(button.textContent).toContain("学校");
    expect(button.textContent).not.toContain("がっこう");
  });

  it("adaptive mode hides the reading for a word already in the mastery map", () => {
    renderPane({ furiganaMode: "adaptive", masteryMap: { 学校: 2 } });
    const button = screen.getByRole("button", { name: /学校/ });
    expect(button.textContent).toContain("学校");
    expect(button.textContent).not.toContain("がっこう");
  });

  it("adaptive mode shows the reading for a word not yet in the mastery map", () => {
    renderPane({ furiganaMode: "adaptive", masteryMap: {} });
    expect(screen.getByRole("button", { name: /学校/ }).textContent).toContain("がっこう");
  });

  it("shows the translation when showTranslation is true", () => {
    renderPane({ showTranslation: true });
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("hides the translation when showTranslation is false", () => {
    renderPane({ showTranslation: false });
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  it("mounts a Mine control per line, scoped to that line only", () => {
    renderPane();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(LINES.length);
    for (const item of items) {
      expect(within(item).getByRole("button", { name: /mine/i })).toBeInTheDocument();
    }
  });

  it("mounts a Pin control beside the Mine control on every line when videoId is supplied", () => {
    renderPane({ videoId: "video-1" });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(LINES.length);
    for (const item of items) {
      expect(within(item).getByRole("button", { name: /mine/i })).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: /pin to journal/i })).toBeInTheDocument();
    }
  });

  it("still mounts the Pin control without a videoId — the id is merely optional in the payload", () => {
    renderPane();
    for (const item of screen.getAllByRole("listitem")) {
      expect(within(item).getByRole("button", { name: /pin to journal/i })).toBeInTheDocument();
    }
  });

  it("mining a word from a line posts that line's id to /api/mining", async () => {
    mockFetchOnce({ ok: true, status: 201 });
    renderPane();
    const secondLine = screen.getAllByRole("listitem")[1]!;

    await userEvent.click(within(secondLine).getByRole("button", { name: /mine/i }));
    const popover = within(secondLine).getByRole("group", { name: /pick a word to mine/i });
    await userEvent.click(within(popover).getByRole("button", { name: /^学校/ }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/mining",
      expect.objectContaining({
        body: JSON.stringify({ lineId: "line-2", targetWord: "学校", reading: "がっこう" }),
      }),
    );
  });
});
