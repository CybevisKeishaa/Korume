import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PracticeStats } from "@/lib/data/practice-stats";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { LessonStatStrip } from "./lesson-stat-strip";
import en from "@/messages/en/shadowing.json";
import viMessages from "@/messages/vi/shadowing.json";

const state = vi.hoisted(() => ({ stats: null as PracticeStats | null, index: 50 as number | null }));
const lines = Array.from({ length: 194 }, (_, index) => ({ id: `line-${index}` })) as WorkspaceLine[];
vi.mock("../workspace-context", () => ({ useLesson: () => ({ video: { title: "Ep.729" }, lines }), useCurrentSentence: () => ({ index: state.index }) }));
vi.mock("./practice-stats-context", () => ({ usePracticeStats: () => ({ stats: state.stats, refresh: vi.fn() }) }));
let resize: (width: number) => void = () => undefined;
const disconnect = vi.fn();

describe("LessonStatStrip", () => {
  beforeEach(() => {
    state.stats = { lineCount: 194, scoredLines: 12, mean: 83.6, lines: {} };
    state.index = 50;
    disconnect.mockClear();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resize = (width) => callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      observe() { /* Tests deliver container sizes through resize. */ }
      disconnect = disconnect;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pins the approved English and Vietnamese strip copy", () => {
    expect(en.workspace.practice.strip).toEqual({ sentence: "Sentence {current}/{total}", scored: "Scored {count}/{total}", average: "Avg {value}", noScore: "No score yet" });
    expect(viMessages.workspace.practice.strip).toEqual({ sentence: "Câu {current}/{total}", scored: "Đã chấm {count}/{total}", average: "TB {value}", noScore: "Chưa có điểm" });
  });
  it("renders the real title, current sentence, scored lines and rounded mean in a wide container", () => {
    render(<LessonStatStrip mode="pronunciation" />);
    act(() => resize(1280));
    expect(screen.getByTestId("lesson-stat-strip")).toHaveTextContent("Ep.729 · Sentence 51/194 · Scored 12/194 · Avg 84");
  });

  it("uses no-score copy for a null mean instead of fabricating a score", () => {
    state.stats = { lineCount: 194, lines: {}, mean: null, scoredLines: 0 };
    render(<LessonStatStrip mode="pronunciation" />);
    expect(screen.getByText("No score yet")).toBeInTheDocument();
    expect(screen.getByText("Scored 0/194")).toBeInTheDocument();
    expect(screen.queryByText(/^Avg/)).not.toBeInTheDocument();
  });

  it("shows only sentence position while stats are unavailable", () => {
    state.stats = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(screen.getByTestId("lesson-stat-strip")).toHaveTextContent(/^Sentence 51\/194$/);
  });

  it("uses an em dash when no sentence is current", () => {
    state.index = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(screen.getByText("Sentence —/194")).toBeInTheDocument();
  });

  it("drops title and average below 420px, keeps sentence and scored metric, then restores them", () => {
    const view = render(<LessonStatStrip mode="pronunciation" />);
    act(() => resize(419));
    const strip = screen.getByTestId("lesson-stat-strip");
    expect(strip).toHaveAttribute("data-compact");
    expect(strip).toHaveTextContent(/^Sentence 51\/194 · Scored 12\/194$/);
    expect(screen.queryByText("Ep.729")).not.toBeInTheDocument();
    expect(screen.queryByText("Avg 84")).not.toBeInTheDocument();
    act(() => resize(420));
    expect(strip).not.toHaveAttribute("data-compact");
    expect(screen.getByText("Ep.729")).toBeInTheDocument();
    expect(screen.getByText("Avg 84")).toBeInTheDocument();
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
