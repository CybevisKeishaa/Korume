import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test/render";
import { JlptTimer } from "./jlpt-timer";

describe("JlptTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the remaining time as visible text (not color-only)", () => {
    const deadline = Date.now() + 10 * 60_000;
    render(<JlptTimer deadline={deadline} onExpire={vi.fn()} />);
    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(screen.getByRole("timer", { name: /time remaining/i })).toBeInTheDocument();
  });

  it("counts down as time advances", () => {
    const deadline = Date.now() + 90_000;
    render(<JlptTimer deadline={deadline} onExpire={vi.fn()} />);
    expect(screen.getByText("1:30")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });

  it("announces a 5-minute warning via the live region", () => {
    const deadline = Date.now() + 5 * 60_000 + 500;
    render(<JlptTimer deadline={deadline} onExpire={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/5 minutes remaining/i);
  });

  it("announces a 1-minute warning and shows a visible low-time label", () => {
    const deadline = Date.now() + 60_500;
    render(<JlptTimer deadline={deadline} onExpire={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/1 minute remaining/i);
    expect(screen.getByText(/under 1 minute left/i)).toBeInTheDocument();
  });

  it("calls onExpire exactly once when the deadline passes", () => {
    const onExpire = vi.fn();
    const deadline = Date.now() + 2000;
    render(<JlptTimer deadline={deadline} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
