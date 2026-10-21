import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import en from "@/messages/en/shadowing.json";
import vi from "@/messages/vi/shadowing.json";
import { FEEDBACK_IDS, listeningFeedback, typingErrorCount } from "./listening-feedback";
import type { ListeningDiffOp } from "./listening-score";

const ids = (messages: { id: string }[]) => messages.map((message) => message.id);
const slot = (correct: boolean, hinted = false) => ({ correct, hinted });
const match = (c: string): ListeningDiffOp => ({ type: "match", expected: c, actual: c, display: c });
const wrong = (c: string): ListeningDiffOp => ({ type: "wrong", expected: c, actual: "x", display: c });
const missing = (c: string): ListeningDiffOp => ({ type: "missing", expected: c, display: c });
const hinted = (c: string): ListeningDiffOp => ({ type: "hinted", expected: c, display: c });
const extra: ListeningDiffOp = { type: "extra", actual: "x" };

describe("listeningFeedback (P14)", () => {
  it("counts hinted units, and says when every unit is hinted", () => {
    expect(listeningFeedback({ kind: "hint", unit: "chunk", hinted: 1, total: 5 }))
      .toEqual([{ id: "hint_used", values: { count: 1, unit: "chunk" } }]);
    expect(ids(listeningFeedback({ kind: "hint", unit: "chunk", hinted: 5, total: 5 }))).toEqual(["hint_used", "hint_all"]);
  });

  it("praises a whole Word Bank sentence only when every slot is the learner's own", () => {
    expect(listeningFeedback({ kind: "checked_word_bank", slots: [1, 2, 3, 4, 5].map(() => slot(true)), previous: null }))
      .toEqual([{ id: "wb_perfect", values: {} }]);
    const partial = listeningFeedback({ kind: "checked_word_bank", slots: [slot(true), slot(false), slot(true), slot(false), slot(true)], previous: null });
    expect(partial).toEqual([{ id: "wb_partial", values: { correct: 3, total: 5, wrong: 2 } }]);
  });

  it("never counts a hinted slot as the learner's own work", () => {
    const messages = listeningFeedback({ kind: "checked_word_bank", slots: [slot(true, true), slot(true), slot(true), slot(true), slot(false)], previous: null });
    expect(messages).toEqual([
      { id: "wb_partial", values: { correct: 3, total: 5, wrong: 1 } },
      { id: "wb_hinted", values: { hinted: 1 } },
    ]);
    const allRightOneHinted = listeningFeedback({ kind: "checked_word_bank", slots: [slot(true, true), slot(true), slot(true)], previous: null });
    expect(ids(allRightOneHinted)).not.toContain("wb_perfect");
  });

  it("reports Typing errors with the expected characters in reference order, at most 8", () => {
    const messages = listeningFeedback({
      kind: "checked_typing",
      diff: [match("今"), wrong("日"), hinted("は"), missing("雨"), extra, wrong("す")],
      metrics: { recall: 50 },
      previous: null,
    });
    expect(messages).toEqual([
      { id: "ty_errors", values: { wrong: 2, missing: 1, extra: 1, chars: "日雨す" } },
      { id: "ty_hinted", values: { hinted: 1 } },
    ]);
    const exact = listeningFeedback({ kind: "checked_typing", diff: [wrong("日"), wrong("本"), missing("語")], metrics: { recall: 0 }, previous: null });
    expect(exact[0]).toEqual({ id: "ty_errors", values: { wrong: 2, missing: 1, extra: 0, chars: "日本語" } });
    const ten = "あいうえおかきくけこ".split("").map(missing);
    expect(listeningFeedback({ kind: "checked_typing", diff: ten, metrics: { recall: 0 }, previous: null })[0]?.values.chars).toBe("あいうえおかきく…");
  });

  it("calls a Typing line perfect only without a hint", () => {
    expect(ids(listeningFeedback({ kind: "checked_typing", diff: [match("雨")], metrics: { recall: 100 }, previous: null }))).toEqual(["ty_perfect"]);
    expect(ids(listeningFeedback({ kind: "checked_typing", diff: [match("雨"), hinted("だ")], metrics: { recall: 50 }, previous: null })))
      .not.toContain("ty_perfect");
  });

  it("remarks on kanji or grammar only when the metric exists and is below recall", () => {
    const at = (metrics: { recall: number; kanji?: number; grammar?: number }) =>
      listeningFeedback({ kind: "checked_typing", diff: [wrong("雨")], metrics, previous: null });
    expect(at({ recall: 80, kanji: 50 })).toContainEqual({ id: "ty_kanji", values: { kanji: 50 } });
    expect(ids(at({ recall: 80 }))).not.toContain("ty_kanji");
    expect(ids(at({ recall: 80, grammar: 80 }))).not.toContain("ty_grammar");
    expect(ids(at({ recall: 80, grammar: 90 }))).not.toContain("ty_grammar");
    expect(at({ recall: 80, grammar: 60 })).toContainEqual({ id: "ty_grammar", values: { grammar: 60 } });
  });

  it("restarts neutrally: the previous score, never praise", () => {
    expect(listeningFeedback({ kind: "retry", previousScore: 60 })).toEqual([{ id: "retry", values: { score: 60 } }]);
    expect(listeningFeedback({ kind: "retry", previousScore: null })).toEqual([{ id: "retry_first", values: {} }]);
  });

  it("names fixed chunks only when a slot that was wrong is now the learner's own", () => {
    const now = [slot(true), slot(true), slot(true), slot(false)];
    expect(listeningFeedback({ kind: "checked_word_bank", slots: now, previous: { wrongSlots: [1, 3] } }))
      .toContainEqual({ id: "wb_fixed", values: { fixed: 1 } });
    expect(ids(listeningFeedback({ kind: "checked_word_bank", slots: now, previous: { wrongSlots: [3] } }))).not.toContain("wb_fixed");
    const hintedFix = [slot(true), slot(true, true), slot(true), slot(false)];
    expect(ids(listeningFeedback({ kind: "checked_word_bank", slots: hintedFix, previous: { wrongSlots: [1] } }))).not.toContain("wb_fixed");
  });

  it("names fewer Typing errors only when the count dropped", () => {
    const two = [wrong("日"), missing("雨")];
    expect(listeningFeedback({ kind: "checked_typing", diff: two, metrics: { recall: 50 }, previous: { errorCount: 5 } }))
      .toContainEqual({ id: "ty_fewer", values: { fewer: 3 } });
    expect(ids(listeningFeedback({ kind: "checked_typing", diff: two, metrics: { recall: 50 }, previous: { errorCount: 2 } }))).not.toContain("ty_fewer");
    expect(typingErrorCount([wrong("日"), missing("雨"), extra, hinted("は"), match("す")])).toBe(3);
  });

  it("says exactly one thing after Show answer", () => {
    expect(listeningFeedback({ kind: "revealed" })).toEqual([{ id: "revealed", values: {} }]);
  });

  it("never returns more than three messages", () => {
    const busy = listeningFeedback({
      kind: "checked_typing",
      diff: [wrong("日"), hinted("本")],
      metrics: { recall: 50, kanji: 10, grammar: 10 },
      previous: { errorCount: 9 },
    });
    expect(busy.length).toBeLessThanOrEqual(3);
    expect(ids(busy)[0]).toBe("ty_errors");
  });
});

describe("feedback copy", () => {
  const feedback = (catalog: typeof en, locale: string, id: string, values: Record<string, string | number> = {}) => {
    const source = (catalog.workspace.practice.listening.feedback as Record<string, string>)[id];
    if (source === undefined) throw new Error(`${locale} has no feedback.${id}`);
    return String(new IntlMessageFormat(source, locale).format(values));
  };

  it("has an EN and a VI string for every message id", () => {
    expect(FEEDBACK_IDS.length).toBeGreaterThan(10);
    for (const id of FEEDBACK_IDS) {
      expect(typeof (en.workspace.practice.listening.feedback as Record<string, string>)[id], `en ${id}`).toBe("string");
      expect(typeof (vi.workspace.practice.listening.feedback as Record<string, string>)[id], `vi ${id}`).toBe("string");
    }
    expect(Object.keys(en.workspace.practice.listening.feedback).sort()).toEqual([...FEEDBACK_IDS].sort());
    expect(Object.keys(vi.workspace.practice.listening.feedback).sort()).toEqual([...FEEDBACK_IDS].sort());
  });

  it("uses the owner's wording (P14)", () => {
    expect(feedback(vi, "vi", "wb_perfect")).toBe("Bạn đã tự sắp xếp đúng toàn bộ câu!");
    expect(feedback(vi, "vi", "wb_partial", { correct: 3, total: 5, wrong: 2 })).toBe("Bạn đúng 3/5 cụm. Hãy nghe lại câu và chú ý thứ tự 2 cụm còn sai.");
    expect(feedback(vi, "vi", "revealed")).toBe("Câu này được đánh dấu cần ôn lại. Lượt này không tính điểm và không tính vào nhiệm vụ.");
    expect(feedback(en, "en", "wb_perfect")).toBe("You arranged the whole sentence yourself!");
    expect(feedback(en, "en", "wb_partial", { correct: 3, total: 5, wrong: 2 })).toBe("You got 3/5 chunks right. Listen again and watch the order of the 2 chunks still wrong.");
    expect(feedback(en, "en", "revealed")).toBe("This sentence is marked for review. This attempt has no score and doesn't count toward today's mission.");
    expect(feedback(en, "en", "ty_perfect")).toBe("Every character written from memory.");
  });
});
