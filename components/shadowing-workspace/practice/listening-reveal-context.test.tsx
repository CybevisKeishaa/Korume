import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ListeningFormat } from "@/lib/shadowing-workspace/learning-modes";
import { ListeningRevealProvider, useListeningReveal } from "./listening-reveal-context";

type Reveal = ReturnType<typeof useListeningReveal>;
let renders: { answerVisible: boolean; videoVisible: boolean; attempt: number; phase: Reveal["phase"] }[] = [];
let api: Reveal;

/** Records every render, so a frame that showed the answer for one render and was then corrected cannot hide. */
function Probe() {
  api = useListeningReveal();
  renders.push({ answerVisible: api.answerVisible, videoVisible: api.videoVisible, attempt: api.attempt, phase: api.phase });
  return <button type="button" onClick={() => api.newAttempt()}>Try again</button>;
}
const tree = (lineId: string, format: ListeningFormat) => <ListeningRevealProvider lineId={lineId} format={format}><Probe /></ListeningRevealProvider>;
const current = () => {
  const frame = renders.at(-1);
  if (!frame) throw new Error("no render recorded");
  return frame;
};

/** Every render recorded from `from` on is concealed and already carries the next attempt (no corrective frame). */
function expectConcealedSince(from: number, attempt: number) {
  const after = renders.slice(from);
  expect(after.length).toBeGreaterThan(0);
  expect(after.map((frame) => frame.answerVisible || frame.videoVisible)).toEqual(after.map(() => false));
  expect(after.map((frame) => frame.attempt)).toEqual(after.map(() => attempt));
  expect(after.map((frame) => frame.phase)).toEqual(after.map(() => "answering"));
}

/** A stale call must change nothing: any render it causes is concealed, and the current frame still is. */
function expectStillConcealed(from: number, attempt: number) {
  expect(renders.slice(from).every((frame) => !frame.answerVisible && !frame.videoVisible)).toBe(true);
  expect(current()).toMatchObject({ answerVisible: false, videoVisible: false, attempt, phase: "answering" });
}

function reveal() {
  act(() => { api.markChecked(api.attempt); api.showVideo(api.attempt); });
  expect(current()).toMatchObject({ answerVisible: true, videoVisible: true, phase: "checked" });
}

describe("ListeningRevealProvider (P11)", () => {
  beforeEach(() => { renders = []; });

  it("starts concealed, and a check or a shown answer of the current attempt reveals it", () => {
    render(tree("A", "word_bank"));
    expect(current()).toMatchObject({ answerVisible: false, videoVisible: false, phase: "answering" });
    act(() => api.markRevealed(api.attempt));
    expect(current()).toMatchObject({ answerVisible: true, videoVisible: false, phase: "revealed" });
    act(() => api.showVideo(api.attempt));
    expect(current().videoVisible).toBe(true);
  });

  it.each([
    ["a format change", "A", "typing"],
    ["a line change", "B", "word_bank"],
  ] as const)("conceals from the first render after %s, with no effect flush", (_, lineId, format) => {
    const view = render(tree("A", "word_bank"));
    reveal();
    const attempt = api.attempt;
    const from = renders.length;
    view.rerender(tree(lineId, format));
    expectConcealedSince(from, attempt + 1);
  });

  it("never re-shows A's old answer on returning from B to A", () => {
    const view = render(tree("A", "word_bank"));
    reveal();
    view.rerender(tree("B", "word_bank"));
    const attempt = api.attempt;
    const from = renders.length;
    view.rerender(tree("A", "word_bank"));
    expectConcealedSince(from, attempt + 1);
  });

  it("conceals in the same commit when Try again starts a new attempt", () => {
    render(tree("A", "typing"));
    reveal();
    const attempt = api.attempt;
    const from = renders.length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expectConcealedSince(from, attempt + 1);
  });

  it("ignores a late check, shown answer or Show video from a stale attempt", () => {
    const view = render(tree("A", "word_bank"));
    const stale = api.attempt;
    view.rerender(tree("B", "word_bank"));
    const from = renders.length;
    act(() => { api.markChecked(stale); api.markRevealed(stale); api.showVideo(stale); });
    expectStillConcealed(from, stale + 1);
    // Positive control: the same calls with the current attempt do reveal.
    reveal();
  });

  it("ignores a stale call after Try again too", () => {
    render(tree("A", "word_bank"));
    const stale = api.attempt;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const from = renders.length;
    act(() => { api.markChecked(stale); api.showVideo(stale); });
    expectStillConcealed(from, stale + 1);
  });

  it("throws outside its provider", () => {
    expect(() => render(<Probe />)).toThrow(/ListeningRevealProvider/);
  });
});
