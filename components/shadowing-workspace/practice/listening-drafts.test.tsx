import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { draftKey, isEmptyDraft, ListeningDraftsProvider, useDraftLineIds, useListeningDraft } from "./listening-drafts";

const wrapper = ({ children }: { children: React.ReactNode }) => <ListeningDraftsProvider>{children}</ListeningDraftsProvider>;

describe("listening drafts (plan Task 14)", () => {
  it("keys word pieces by cut version (A3) and the other formats by line + format", () => {
    expect(draftKey("l1", "typing")).toBe("l1|typing");
    expect(draftKey("l1", "cloze")).toBe("l1|cloze");
    expect(draftKey("l1", "word_bank", 3)).toBe("l1|word_bank|3");
    expect(draftKey("l1", "word_bank", 4)).not.toBe(draftKey("l1", "word_bank", 3));
  });

  it("an empty draft is no draft", () => {
    expect(isEmptyDraft({ hinted: [] })).toBe(true);
    expect(isEmptyDraft({ hinted: [], input: "  ", answer: [], answers: ["", " "] })).toBe(true);
    for (const draft of [{ hinted: [1] }, { hinted: [], input: "a" }, { hinted: [], answer: [0] }, { hinted: [], answers: ["", "x"] }, { hinted: [], easyUsed: true }]) {
      expect(isEmptyDraft(draft)).toBe(false);
    }
  });

  it("saves, reads and clears a draft; an empty save deletes it; the dots follow by format", () => {
    const { result } = renderHook(() => ({
      typing: useListeningDraft("l1|typing"),
      pieces: useListeningDraft("l2|word_bank|3"),
      dictationDots: useDraftLineIds(["typing", "word_bank"]),
      clozeDots: useDraftLineIds(["cloze"]),
    }), { wrapper });
    expect(result.current.typing.draft).toBeUndefined();
    act(() => { result.current.typing.save({ hinted: [], input: "毎日" }); result.current.pieces.save({ hinted: [0], answer: [0, 2] }); });
    expect(result.current.typing.draft).toEqual({ hinted: [], input: "毎日" });
    expect([...result.current.dictationDots].sort()).toEqual(["l1", "l2"]);
    expect(result.current.clozeDots.size).toBe(0);
    act(() => result.current.typing.save({ hinted: [], input: "" }));
    expect(result.current.typing.draft).toBeUndefined();
    expect([...result.current.dictationDots]).toEqual(["l2"]);
    act(() => result.current.pieces.clear());
    expect(result.current.dictationDots.size).toBe(0);
  });

  it("a remounted provider (a reload) starts with no drafts", () => {
    const first = renderHook(() => useListeningDraft("l1|typing"), { wrapper });
    act(() => first.result.current.save({ hinted: [], input: "毎日" }));
    first.unmount();
    const second = renderHook(() => useListeningDraft("l1|typing"), { wrapper });
    expect(second.result.current.draft).toBeUndefined();
  });
});
