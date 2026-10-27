import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import en from "@/messages/en/shadowing.json";
import vi from "@/messages/vi/shadowing.json";
import { FEEDBACK_IDS, feedbackMood, listeningFeedback, typingErrorCount } from "./listening-feedback";
import type { ListeningDiffOp } from "./listening-score";

const ids = (messages: { id: string }[]) => messages.map((message) => message.id);
/** One answer position's verdict; the piece placed there is the position's own unless `chunkIndex` says otherwise. */
type Slot = { correct: boolean; hinted: boolean; chunkIndex?: number };
const slot = (correct: boolean, hinted = false, chunkIndex?: number): Slot => ({ correct, hinted, chunkIndex });
const DISPLAY = ["お", "店", "を", "検索", "する", "と", "思う", "ん", "です", "けど。"];
const wb = (slots: Slot[], previous: { wrongPieces: number[] } | null = null) => listeningFeedback({
  kind: "checked_word_bank", display: DISPLAY, previous, slots: slots.map((s, i) => ({ ...s, chunkIndex: s.chunkIndex ?? i })),
});
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
    expect(wb([1, 2, 3, 4, 5].map(() => slot(true))))
      .toEqual([{ id: "wb_perfect", values: {} }]);
    const partial = wb([slot(true), slot(false), slot(true), slot(false), slot(true)]);
    expect(partial).toEqual([{ id: "wb_partial", values: { correct: 3, total: 5, wrong: 2, pieces: "店 検索" } }]);
  });

  it("never counts a hinted slot as the learner's own work", () => {
    const messages = wb([slot(true, true), slot(true), slot(true), slot(true), slot(false)]);
    expect(messages).toEqual([
      { id: "wb_partial", values: { correct: 3, total: 5, wrong: 1, pieces: "する" } },
      { id: "wb_hinted", values: { hinted: 1 } },
    ]);
    const allRightOneHinted = wb([slot(true, true), slot(true), slot(true)]);
    expect(ids(allRightOneHinted)).not.toContain("wb_perfect");
  });

  it("wb_partial names the wrong pieces in answer order, at most 8 characters", () => {
    // v2: answer お 検索 店 を — 検索 and 店 are outside the LCS.
    expect(wb([slot(true, false, 0), slot(false, false, 3), slot(false, false, 1), slot(true, false, 2)]))
      .toEqual([{ id: "wb_partial", values: { correct: 2, total: 4, wrong: 2, pieces: "検索 店" } }]);
    const long = wb([slot(false, false, 3), slot(false, false, 4), slot(false, false, 6), slot(false, false, 9)]);
    expect(long[0]?.values.pieces).toBe("検索 する 思う…");
    // The 8-character cut lands on a space: no "… …" gap before the ellipsis.
    const onSpace = wb([slot(false, false, 1), slot(false, false, 3), slot(false, false, 4), slot(false, false, 0)]);
    expect(onSpace[0]?.values.pieces).toBe("店 検索 する…");
  });

  it("v2: a hinted piece is never wrong, never named and never perfect", () => {
    // v2 marks the hinted prefix `correct: false, hinted: true`.
    expect(wb([slot(false, true, 0), slot(true, false, 2), slot(false, false, 1)])).toEqual([
      { id: "wb_partial", values: { correct: 1, total: 3, wrong: 1, pieces: "店" } },
      { id: "wb_hinted", values: { hinted: 1 } },
    ]);
    expect(ids(wb([slot(false, true, 0), slot(true, false, 1), slot(true, false, 2)]))).not.toContain("wb_perfect");
  });

  it("wb_fixed counts previous wrong pieces, by piece index, now correct and not hinted", () => {
    // Previously wrong: pieces 1 and 3. Now piece 3 is correct (moved to position 1), piece 1 still wrong.
    const now = [slot(true, false, 0), slot(true, false, 3), slot(false, false, 1), slot(true, false, 2)];
    expect(wb(now, { wrongPieces: [1, 3] })).toContainEqual({ id: "wb_fixed", values: { fixed: 1 } });
    expect(ids(wb(now, { wrongPieces: [1] }))).not.toContain("wb_fixed");
    const hintedNow = [slot(false, true, 0), slot(true, false, 1), slot(true, false, 2)];
    expect(ids(wb(hintedNow, { wrongPieces: [0] }))).not.toContain("wb_fixed");
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

describe("feedbackMood (P15)", () => {
  const mood = (slots: Slot[], previous: { wrongPieces: number[] } | null = null) => feedbackMood(wb(slots, previous));
  const ty = (diff: ListeningDiffOp[], previous: { errorCount: number } | null = null) =>
    feedbackMood(listeningFeedback({ kind: "checked_typing", diff, metrics: { recall: 100 }, previous }));

  it("is joy only for a perfect result with no hint", () => {
    expect(mood([slot(true), slot(true), slot(true)])).toBe("joy");
    expect(ty([match("今"), match("日")])).toBe("joy");
  });

  it("never gives joy to an attempt with a hint, even when every part is right", () => {
    expect(mood([slot(true, true), slot(true), slot(true)])).toBe("encourage");
    expect(ty([hinted("今"), match("日")])).toBe("encourage");
  });

  it("encourages a partial result and real progress between two submitted results", () => {
    expect(mood([slot(true), slot(false), slot(true)])).toBe("encourage");
    expect(ty([match("今"), wrong("日")])).toBe("encourage");
    expect(ty([match("今"), extra])).toBe("encourage");
    expect(mood([slot(true), slot(false), slot(true)], { wrongPieces: [0, 1] })).toBe("encourage");
    expect(ty([match("今"), missing("日")], { errorCount: 3 })).toBe("encourage");
  });

  it("is review after Show answer", () => {
    expect(feedbackMood(listeningFeedback({ kind: "revealed" }))).toBe("review");
  });

  it("is null before a successful Check or Show answer: hints, a restart, or a failed request", () => {
    expect(feedbackMood(listeningFeedback({ kind: "hint", unit: "chunk", hinted: 1, total: 3 }))).toBeNull();
    expect(feedbackMood(listeningFeedback({ kind: "hint", unit: "chunk", hinted: 3, total: 3 }))).toBeNull();
    expect(feedbackMood(listeningFeedback({ kind: "retry", previousScore: 40 }))).toBeNull();
    expect(feedbackMood([])).toBeNull();
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
    // The owner's sentence, then the drafted wrong-piece names (WP §3.8).
    expect(feedback(vi, "vi", "wb_partial", { correct: 3, total: 5, wrong: 2, pieces: "検索 店" })).toBe("Bạn đúng 3/5 cụm. Hãy nghe lại câu và chú ý thứ tự 2 cụm còn sai. Mảnh sai: 検索 店");
    expect(feedback(vi, "vi", "wb_partial", { correct: 5, total: 5, wrong: 0, pieces: "" })).toBe("Bạn đúng 5/5 cụm.");
    expect(feedback(vi, "vi", "revealed")).toBe("Câu này được đánh dấu cần ôn lại. Lượt này không tính điểm và không tính vào nhiệm vụ.");
    expect(feedback(en, "en", "wb_perfect")).toBe("You arranged the whole sentence yourself!");
    expect(feedback(en, "en", "wb_partial", { correct: 3, total: 5, wrong: 2, pieces: "検索 店" })).toBe("You got 3/5 chunks right. Listen again and watch the order of the 2 chunks still wrong. Wrong pieces: 検索 店");
    expect(feedback(en, "en", "wb_partial", { correct: 2, total: 3, wrong: 1, pieces: "店" })).toBe("You got 2/3 chunks right. Listen again and watch the order of the 1 chunk still wrong. Wrong pieces: 店");
    expect(feedback(en, "en", "revealed")).toBe("This sentence is marked for review. This attempt has no score and doesn't count toward today's mission.");
    expect(feedback(en, "en", "ty_perfect")).toBe("Every character written from memory.");
  });
});
