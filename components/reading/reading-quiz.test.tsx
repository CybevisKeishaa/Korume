import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReadingQuestionPublic } from "@/lib/reading-types";
import { ReadingQuiz } from "./reading-quiz";

const QUESTIONS: ReadingQuestionPublic[] = [
  { id: "q1", question: "主人公は誰ですか？", options: ["太郎", "花子", "次郎", "三郎"], order_index: 0 },
  { id: "q2", question: "季節はいつですか？", options: ["春", "夏", "秋", "冬"], order_index: 1 },
];

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name] ?? null } as Headers,
    json: async () => body,
  } as unknown as Response;
}

describe("ReadingQuiz", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders one radiogroup per question, ordered, with 4 choices each", () => {
    render(<ReadingQuiz passageId="p1" questions={QUESTIONS} />);

    expect(screen.getByText(/question 1\..*主人公は誰ですか/i)).toBeInTheDocument();
    expect(screen.getByText(/question 2\..*季節はいつですか/i)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
  });

  it("lets the user pick an answer per question and submits to POST /api/reading/[id]/submit", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, {
        data: {
          result: { correct: 1, total: 2, percent: 50 },
          perQuestion: [
            { id: "q1", correct: true, correctAnswer: "1", explanation: "花子が主人公です。" },
            { id: "q2", correct: false, correctAnswer: "0", explanation: "物語は春に始まります。" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReadingQuiz passageId="p1" questions={QUESTIONS} />);

    await userEvent.click(screen.getByLabelText("花子"));
    await userEvent.click(screen.getByLabelText("冬"));
    expect(screen.getByText("Answered 2/2 questions")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /submit answers/i }));

    await waitFor(() =>
      expect(screen.getByText(/1 \/ 2 correct \(50%\)/i)).toBeInTheDocument(),
    );

    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText(/花子が主人公です/)).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/reading/p1/submit");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ answers: { q1: "1", q2: "3" } });
  });

  it("shows a friendly retry message on 429", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { error: "Too many submissions" }, { "Retry-After": "30" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReadingQuiz passageId="p1" questions={QUESTIONS} />);
    await userEvent.click(screen.getByRole("button", { name: /submit answers/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/try again in 30s/i),
    );
  });

  it("shows a network-error message when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    render(<ReadingQuiz passageId="p1" questions={QUESTIONS} />);
    await userEvent.click(screen.getByRole("button", { name: /submit answers/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/network error/i));
  });
});
