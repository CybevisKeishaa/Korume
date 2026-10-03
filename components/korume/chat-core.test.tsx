import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import type { AnswerV1 } from "@/lib/korume/answer";
import type { GroundedEntity } from "@/lib/korume/types";
import { AnswerBlocks, exampleSegments } from "./answer-blocks";
import { Composer } from "./composer";
import { ListenButton } from "./listen-button";
import { MessageList } from "./message-list";
import { TurnNotice } from "./turn-notice";

// ---- speechSynthesis double -------------------------------------------------------------------------------
type Voice = { lang: string; name: string };
function installSpeech(voices: Voice[]) {
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const spoken: { text: string; lang: string }[] = [];
  const synth = {
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    cancel: () => calls.push("cancel"),
    speak: (u: { text: string; lang: string }) => { calls.push("speak"); spoken.push({ text: u.text, lang: u.lang }); },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  class Utterance { lang = ""; voice: unknown = null; constructor(public text: string) {} }
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return { calls, spoken, setVoices(next: Voice[]) { voices = next; act(() => listeners.forEach((fn) => fn())); } };
}
afterEach(() => {
  delete (window as { speechSynthesis?: unknown }).speechSynthesis;
  vi.unstubAllGlobals();
});

describe("ListenButton (spec §6.1, §7.3)", () => {
  it("shows with a Japanese voice and cancels before it speaks, in ja-JP", async () => {
    const speech = installSpeech([{ lang: "en-US", name: "e" }, { lang: "ja-JP", name: "j" }]);
    render(<ListenButton text="私は学生です" />);
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    expect(speech.calls).toEqual(["cancel", "speak"]);
    expect(speech.spoken).toEqual([{ text: "私は学生です", lang: "ja-JP" }]);
  });

  it("appears when voiceschanged brings a Japanese voice", () => {
    const speech = installSpeech([]);
    render(<ListenButton text="x" />);
    expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
    speech.setVoices([{ lang: "ja", name: "j" }]);
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });

  it("is absent with only non-Japanese voices or no speechSynthesis at all", () => {
    installSpeech([{ lang: "en-US", name: "e" }]);
    const { unmount } = render(<ListenButton text="x" />);
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    delete (window as { speechSynthesis?: unknown }).speechSynthesis;
    render(<ListenButton text="x" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ---- AnswerBlocks ------------------------------------------------------------------------------------------
const grounding: GroundedEntity[] = [
  { id: "tok:は:助詞", label: "は", kind: "particle", jlpt: "N5", seenCount: 31, seenCapped: false },
  { id: "ent:1", label: "今日", reading: "きょう", kind: "vocabulary", seenCount: 3000, seenCapped: true },
];

describe("AnswerBlocks", () => {
  it("renders every block type as text, never markup", async () => {
    const onFollowup = vi.fn();
    const answer: AnswerV1 = { blocks: [
      { type: "paragraph", runs: [{ text: "<script>alert(1)</script> is " }, { text: "bold", strong: true }, { jp: "今日は" }] },
      { type: "example", jp: "私は学生です", ruby: [{ base: "私", reading: "わたし" }, { base: "は学生です" }], translation: "I am a student" },
      { type: "context_card", entityRef: "tok:は:助詞", note: "topic marker" },
      { type: "context_card", entityRef: "ent:1" },
      { type: "context_card", entityRef: "ent:404" },
      { type: "followups", chips: ["Compare に / で"] },
    ] };
    const { container } = render(<AnswerBlocks answer={answer} grounding={grounding} onFollowup={onFollowup} />);
    expect(screen.getByText(/<script>alert\(1\)<\/script> is/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(container.querySelector("rt")?.textContent).toBe("わたし");
    expect(screen.getByText("I am a student")).toBeInTheDocument();
    expect(screen.getByText("N5 · Seen 31 times")).toBeInTheDocument();
    expect(screen.getByText("Seen 3000+ times")).toBeInTheDocument();
    expect(container.querySelectorAll("aside")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Compare に / で" }));
    expect(onFollowup).toHaveBeenCalledWith("Compare に / で");
  });

  it("uses ruby only when it spells the sentence", () => {
    expect(exampleSegments({ type: "example", jp: "私は", ruby: [{ base: "私", reading: "わたし" }], translation: "" })).toEqual([{ text: "私は" }]);
    expect(exampleSegments({ type: "example", jp: "私は", ruby: [{ base: "私", reading: "わたし" }, { base: "は" }], translation: "" }))
      .toEqual([{ text: "私", reading: "わたし" }, { text: "は" }]);
  });
});

// ---- Composer ----------------------------------------------------------------------------------------------
describe("Composer", () => {
  it("sends on Enter, breaks the line on Shift+Enter and never sends blank text", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} placeholder="Ask" />);
    const box = screen.getByRole("textbox", { name: "Message Korume" });
    await userEvent.type(box, "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.clear(box);
    await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(box).toHaveValue("line one\nline two");
    await userEvent.type(box, "{Enter}");
    expect(onSend).toHaveBeenCalledWith("line one\nline two");
    expect(box).toHaveValue("");
    expect(screen.getByText("Enter to send · Shift+Enter for a new line")).toBeInTheDocument();
  });

  it("does not send the Enter that confirms an IME conversion", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} placeholder="Ask" />);
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "にほんご" } });
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("locks while disabled", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} placeholder="Ask" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});

// ---- TurnNotice and MessageList ----------------------------------------------------------------------------
describe("TurnNotice", () => {
  it("names the configured Free limit and counts a slow-down down", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<TurnNotice notice={{ kind: "free_daily_limit", limit: 10, resetsAt: "2026-10-04T00:00:00.000Z" }} />);
      expect(screen.getByRole("status").textContent).toMatch(/^You've asked 10 questions today · back at /);
      rerender(<TurnNotice notice={{ kind: "slow_down", retryAfterSeconds: 3 }} />);
      expect(screen.getByRole("status")).toHaveTextContent("Slow down a little · 3s");
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.getByRole("status")).toHaveTextContent("Slow down a little · 1s");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MessageList", () => {
  it("shows the question at once, thinking while it runs, and Try again when it can be retried", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<MessageList messages={[]} pending={{ turnId: "t", text: "Why は?", status: "running" }} onRetry={onRetry} />);
    expect(screen.getByText("Why は?")).toBeInTheDocument();
    expect(screen.getByText("Korume is thinking…")).toBeInTheDocument();
    rerender(<MessageList messages={[]} pending={{ turnId: "t", text: "Why は?", status: "retryable" }} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("offers follow-ups only on the latest answer", () => {
    const answer = (chip: string): AnswerV1 => ({ blocks: [{ type: "paragraph", runs: [{ text: chip }] }, { type: "followups", chips: [chip] }] });
    const m = (id: string, chip: string) => ({ id, turnId: id, role: "assistant" as const, text: chip, answer: answer(chip), grounding: [], createdAt: "x" });
    render(<MessageList messages={[m("a", "old"), m("b", "new")]} pending={null} onRetry={vi.fn()} onFollowup={vi.fn()} />);
    expect(screen.getByRole("button", { name: "old" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "new" })).toBeEnabled();
  });
});

