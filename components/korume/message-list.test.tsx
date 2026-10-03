import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { KorumeMessageView } from "@/lib/korume/types";
import { MessageList } from "./message-list";

const user = (i: number): KorumeMessageView => ({ id: `u${i}`, turnId: `t${i}`, role: "user", text: `question ${i}`, answer: null, grounding: null, createdAt: "2026-10-03T08:00:00.000Z" });

describe("MessageList", () => {
  it("keeps the newest turn in view by scrolling its marked container to the bottom", () => {
    const list = (messages: KorumeMessageView[], pending: Parameters<typeof MessageList>[0]["pending"] = null) => (
      <div data-korume-scroll data-testid="scroller"><MessageList messages={messages} pending={pending} onRetry={vi.fn()} /></div>
    );
    const { getByTestId, rerender } = render(list([user(1)]));
    const scroller = getByTestId("scroller");
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 900 });
    scroller.scrollTop = 0;
    rerender(list([user(1), user(2)]));
    expect(scroller.scrollTop).toBe(900);
    scroller.scrollTop = 0;
    rerender(list([user(1), user(2)], { turnId: "t3", text: "question 3", status: "sending" }));
    expect(scroller.scrollTop).toBe(900);
  });
});
