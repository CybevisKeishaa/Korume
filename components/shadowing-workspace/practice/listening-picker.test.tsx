import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { lesson } from "@/test/listening-body";
import { WorkspaceProviders } from "../workspace-context";
import { ListeningPicker } from "./listening-picker";

vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/shadowing/video-1/listening" }));

/** `stats` per exercise, as GET …/practice-stats?mode= answers it; an absent exercise answers 500. */
function stubStats(stats: Partial<Record<"dictation" | "cloze", { scoredLines: number; lineCount: number }>>) {
  const fetchMock = vi.fn((url: string) => {
    const mode = new URL(url, "http://x").searchParams.get("mode") as "dictation" | "cloze";
    const found = stats[mode];
    return Promise.resolve(found
      ? Response.json({ data: { ...found, mean: null, helpedLines: 0, lines: {} } })
      : new Response(null, { status: 500 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const picker = (onChoose = vi.fn(), locale?: "vi") => {
  render(<WorkspaceProviders bootstrap={lesson}><ListeningPicker onChoose={onChoose} /></WorkspaceProviders>, locale ? { locale } : undefined);
  return onChoose;
};
const card = (name: RegExp) => screen.getByRole("button", { name });
afterEach(() => vi.unstubAllGlobals());

describe("ListeningPicker (spec §3.0)", () => {
  it("shows the owner's heading and two cards, copy verbatim", () => {
    stubStats({});
    picker(vi.fn(), "vi");
    expect(screen.getByRole("heading", { name: "Bạn muốn luyện nghe theo cách nào?" })).toBeInTheDocument();
    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Chép chính tả");
    expect(cards[0]).toHaveTextContent("Nghe rồi tự viết lại câu tiếng Nhật. Có thể sử dụng gợi ý hoặc bật chế độ dễ.");
    expect(cards[0]).toHaveTextContent("Tập trung vào nghe hiểu toàn câu");
    expect(cards[1]).toHaveTextContent("Điền từ");
    expect(cards[1]).toHaveTextContent("Nghe rồi điền những từ còn thiếu trong câu. Luyện nhận biết từ vựng trong ngữ cảnh.");
    expect(cards[1]).toHaveTextContent("Tập trung vào từ vựng");
  });

  it("choosing a card reports its exercise", () => {
    stubStats({});
    const onChoose = picker();
    fireEvent.click(card(/^Dictation/));
    expect(onChoose).toHaveBeenLastCalledWith("dictation");
    fireEvent.click(card(/^Fill in the blanks/));
    expect(onChoose).toHaveBeenLastCalledWith("cloze");
  });

  it("picker progress only from real stats: each exercise's own done/total, nothing without data", async () => {
    const fetchMock = stubStats({ dictation: { scoredLines: 12, lineCount: 194 }, cloze: { scoredLines: 0, lineCount: 194 } });
    picker();
    await waitFor(() => expect(within(card(/^Dictation/)).getByTestId("listening-picker-progress")).toHaveTextContent("12/194 sentences done"));
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      "/api/shadowing/video-1/practice-stats?mode=cloze", "/api/shadowing/video-1/practice-stats?mode=dictation",
    ]);
    // Cloze has stats but nothing done: no "0/194".
    expect(within(card(/^Fill in the blanks/)).queryByTestId("listening-picker-progress")).toBeNull();
  });

  it("shows no progress when the stats cannot be loaded", async () => {
    const fetchMock = stubStats({});
    picker();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("listening-picker-progress")).toBeNull();
  });
});
