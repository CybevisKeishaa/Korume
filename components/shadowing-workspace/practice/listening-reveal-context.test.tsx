import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ListeningExercise } from "@/lib/shadowing-workspace/learning-modes";
import { ListeningRevealProvider, useListeningReveal } from "./listening-reveal-context";

type Reveal = ReturnType<typeof useListeningReveal>;
let renders: { answerVisible: boolean; attempt: number; phase: Reveal["phase"] }[] = [];
let api: Reveal;

/** Records every render, so a frame that showed the answer for one render and was then corrected cannot hide. */
function Probe() {
  api = useListeningReveal();
  renders.push({ answerVisible: api.answerVisible, attempt: api.attempt, phase: api.phase });
  return <button type="button" onClick={() => api.newAttempt()}>Try again</button>;
}
const tree = (lineId: string, exercise: ListeningExercise | null) => <ListeningRevealProvider lineId={lineId} exercise={exercise}><Probe /></ListeningRevealProvider>;
const current = () => {
  const frame = renders.at(-1);
  if (!frame) throw new Error("no render recorded");
  return frame;
};

/** Every render recorded from `from` on is concealed and already carries the next attempt (no corrective frame). */
function expectConcealedSince(from: number, attempt: number) {
  const after = renders.slice(from);
  expect(after.length).toBeGreaterThan(0);
  expect(after.map((frame) => frame.answerVisible)).toEqual(after.map(() => false));
  expect(after.map((frame) => frame.attempt)).toEqual(after.map(() => attempt));
  expect(after.map((frame) => frame.phase)).toEqual(after.map(() => "answering"));
}

/** A stale call must change nothing: any render it causes is concealed, and the current frame still is. */
function expectStillConcealed(from: number, attempt: number) {
  expect(renders.slice(from).every((frame) => !frame.answerVisible)).toBe(true);
  expect(current()).toMatchObject({ answerVisible: false, attempt, phase: "answering" });
}

function reveal() {
  act(() => api.markChecked(api.attempt));
  expect(current()).toMatchObject({ answerVisible: true, phase: "checked" });
}

describe("ListeningRevealProvider (P11)", () => {
  beforeEach(() => { renders = []; });

  it("starts concealed, and a check or a shown answer of the current attempt reveals it", () => {
    render(tree("A", "dictation"));
    expect(current()).toMatchObject({ answerVisible: false, phase: "answering" });
    act(() => api.markRevealed(api.attempt));
    expect(current()).toMatchObject({ answerVisible: true, phase: "revealed" });
  });

  it.each([
    ["an exercise change", "A", "cloze"],
    ["a line change", "B", "dictation"],
    ["going back to the picker", "A", null],
  ] as const)("conceals from the first render after %s, with no effect flush", (_, lineId, exercise) => {
    const view = render(tree("A", "dictation"));
    reveal();
    const attempt = api.attempt;
    const from = renders.length;
    view.rerender(tree(lineId, exercise));
    expectConcealedSince(from, attempt + 1);
  });

  it("conceals in the same commit when Chế độ dễ changes the dictation format, and not in cloze", () => {
    const view = render(tree("A", "dictation"));
    reveal();
    const attempt = api.attempt;
    const from = renders.length;
    act(() => api.setEasy(true));
    expectConcealedSince(from, attempt + 1);
    // Cloze keeps one stored format whatever Chế độ dễ says: a toggle there starts no new attempt.
    view.rerender(tree("A", "cloze"));
    reveal();
    const clozeAttempt = api.attempt;
    act(() => api.setEasy(false));
    expect(current()).toMatchObject({ answerVisible: true, attempt: clozeAttempt });
  });

  it("never re-shows A's old answer on returning from B to A", () => {
    const view = render(tree("A", "dictation"));
    reveal();
    view.rerender(tree("B", "dictation"));
    const attempt = api.attempt;
    const from = renders.length;
    view.rerender(tree("A", "dictation"));
    expectConcealedSince(from, attempt + 1);
  });

  it("conceals in the same commit when Try again starts a new attempt", () => {
    render(tree("A", "dictation"));
    reveal();
    const attempt = api.attempt;
    const from = renders.length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expectConcealedSince(from, attempt + 1);
  });

  it("ignores a late check or shown answer from a stale attempt", () => {
    const view = render(tree("A", "dictation"));
    const stale = api.attempt;
    view.rerender(tree("B", "dictation"));
    const from = renders.length;
    act(() => { api.markChecked(stale); api.markRevealed(stale); });
    expectStillConcealed(from, stale + 1);
    // Positive control: the same calls with the current attempt do reveal.
    reveal();
  });

  it("ignores a stale call after Try again too", () => {
    render(tree("A", "dictation"));
    const stale = api.attempt;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const from = renders.length;
    act(() => api.markChecked(stale));
    expectStillConcealed(from, stale + 1);
  });

  it("listenOnly and easy start false and survive a line change, an exercise change, Try again and the picker (spec §3.2)", () => {
    const view = render(tree("A", "dictation"));
    expect(api).toMatchObject({ listenOnly: false, easy: false });
    act(() => { api.setListenOnly(true); api.setEasy(true); });
    expect(api).toMatchObject({ listenOnly: true, easy: true });
    view.rerender(tree("B", "dictation"));
    expect(api).toMatchObject({ listenOnly: true, easy: true });
    view.rerender(tree("B", "cloze"));
    expect(api).toMatchObject({ listenOnly: true, easy: true });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(api).toMatchObject({ listenOnly: true, easy: true });
    view.rerender(tree("B", null));
    expect(api).toMatchObject({ listenOnly: true, easy: true });
    act(() => { api.setListenOnly(false); api.setEasy(false); });
    view.rerender(tree("C", "dictation"));
    expect(api).toMatchObject({ listenOnly: false, easy: false });
  });

  it("throws outside its provider", () => {
    expect(() => render(<Probe />)).toThrow(/ListeningRevealProvider/);
  });
});
