import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { JlptSubmitResult, JlptTestDetail } from "@/lib/jlpt-ui";
import { JlptTestRunner } from "./jlpt-test-runner";

const TEST: JlptTestDetail = {
  id: "11111111-1111-1111-1111-111111111111",
  level: "N5",
  title: "Đề luyện N5 #1",
  section_config: { sections: [{ section: "vocab", question_count: 2, time_limit_minutes: 1 }] },
  questions: [
    {
      id: "q-1",
      section: "vocab",
      question_type: "kanji-reading",
      order_index: 0,
      question_data: { stem: "Question one stem", choices: ["Choice A", "Choice B", "Choice C", "Choice D"] },
    },
    {
      id: "q-2",
      section: "vocab",
      question_type: "kanji-reading",
      order_index: 1,
      question_data: { stem: "Question two stem", choices: ["Choice E", "Choice F", "Choice G", "Choice H"] },
    },
  ],
};

function submitResponseBody(overrides: Partial<JlptSubmitResult> = {}): JlptSubmitResult {
  return {
    result: {
      mode: "full",
      level: "N5",
      sections: [{ section: "vocab", correct: 1, total: 2, percent: 50 }],
      totalCorrect: 1,
      totalQuestions: 2,
      totalPercent: 50,
      pillars: null,
      scaledTotal: null,
      scaledTotalMax: null,
      passThreshold: null,
      passed: null,
      passUnavailableReason: "No questions in this attempt.",
    },
    weakness: [],
    perQuestion: [
      { id: "q-1", correct: true, correctAnswer: "0", explanation: null },
      { id: "q-2", correct: false, correctAnswer: "1", explanation: null },
    ],
    attemptId: "attempt-1",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("JlptTestRunner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows a pre-start screen with test info, then begins the timed attempt", async () => {
    render(<JlptTestRunner test={TEST} />);
    expect(screen.getByRole("heading", { name: "Đề luyện N5 #1" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // question count
    expect(screen.getByText("1 min")).toBeInTheDocument(); // time limit

    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Question 1 / 2")).toBeInTheDocument();
  });

  it("navigates between questions via Next/Previous and the navigator, tracking answered state", async () => {
    render(<JlptTestRunner test={TEST} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByText("Question 1 / 2")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Choice A"));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Question 2 / 2")).toBeInTheDocument();

    // Now that question 1 isn't "current", its navigator button reads as answered only.
    expect(screen.getByRole("button", { name: "Question 1, answered" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 2, current, not answered" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Question 1 / 2")).toBeInTheDocument();

    // Jump directly via the navigator.
    await userEvent.click(screen.getByRole("button", { name: "Question 2, not answered" }));
    expect(screen.getByText("Question 2 / 2")).toBeInTheDocument();
  });

  it("warns once before submitting with unanswered questions, then submits on the second click", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, { data: submitResponseBody() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JlptTestRunner test={TEST} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByText("Choice A")); // answers only question 1

    await userEvent.click(screen.getByRole("button", { name: /submit test/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/1 unanswered question/i);
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /submit test/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/jlpt/tests/${TEST.id}/submit`);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ answers: { "q-1": "0" }, mode: "full" });
    expect(body.started_at).toEqual(expect.any(String));

    await waitFor(() => expect(screen.getByText("Results")).toBeInTheDocument());
  });

  it("submits without a warning once every question is answered", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, { data: submitResponseBody() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JlptTestRunner test={TEST} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByText("Choice A"));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByText("Choice E"));

    await userEvent.click(screen.getByRole("button", { name: /submit test/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Results")).toBeInTheDocument());
  });

  it("shows a friendly error and stays in-progress when submission fails", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(400, { error: "Invalid submission" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JlptTestRunner test={TEST} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByText("Choice A"));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByText("Choice E"));

    await userEvent.click(screen.getByRole("button", { name: /submit test/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid submission/i));
    // Still in-progress, not results — the Submit button is still there to retry.
    expect(screen.getByRole("button", { name: /submit test/i })).toBeInTheDocument();
  });

  it("auto-submits when the timer expires, with no confirmation required", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, { data: submitResponseBody() }));
    vi.stubGlobal("fetch", fetchMock);

    vi.useFakeTimers();
    try {
      render(<JlptTestRunner test={TEST} />);
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      expect(screen.getByText("Question 1 / 2")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(61_000); // past the 1-minute section time limit
      });
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Results")).toBeInTheDocument());
  });
});
