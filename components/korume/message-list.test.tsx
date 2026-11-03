import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { KorumeMessageView } from "@/lib/korume/types";
import { ConversationHeader, MessageList } from "./message-list";

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

  describe("ConversationHeader", () => {
    const answer = (seenCount: number | undefined): KorumeMessageView => ({
      id: "a1", turnId: "t1", role: "assistant", text: "x", answer: null, createdAt: new Date().toISOString(),
      grounding: [{ id: "ent:1", label: "猫", seenCount } as never],
    });
    const first = { ...user(1), createdAt: new Date().toISOString() };

    it("labels a thread created now as Today", async () => {
      const { findByText } = render(<ConversationHeader messages={[first]} />);
      expect(await findByText(/today/i)).toBeTruthy();
    });

    it("shows the grounding line only for seenCount > 0", () => {
      const seen = render(<ConversationHeader messages={[first, answer(3)]} />);
      expect(seen.container.textContent).toContain("猫");
      const unseen = render(<ConversationHeader messages={[first, answer(0)]} />);
      expect(unseen.container.textContent).not.toContain("猫");
    });
  });
});
