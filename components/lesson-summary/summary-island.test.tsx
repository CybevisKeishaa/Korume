import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResponse, LessonAnalysisView } from "@/lib/summary/analysis/view";
import type { ReflectionResponse, ReflectionView } from "@/lib/summary/reflection/view";
import { render } from "@/test/render";
import { SummaryIsland, type SummaryIslandProps } from "./summary-island";

vi.mock("@/lib/i18n/navigation", () => ({ Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));

const ANALYSIS = "/api/videos/v-1/lesson-analysis";
const REFLECTION = "/api/videos/v-1/lesson-reflection";
const line = { lineId: "11111111-1111-4111-8111-111111111111", textJp: "コーヒーを注文します。", startTime: 1, endTime: 3 };
const view: LessonAnalysisView = {
  overview: "",
  words: [
    { entSeq: 1, surface: "注文", written: "注文", reading: "ちゅうもん", meaning: "order", meaningLocale: "en", meaningSource: "jmdict", posKey: "noun", jlpt: "N4", common: true, whyItMatters: "", usageNote: "", source: line },
    { entSeq: 2, surface: "温かい", written: "温かい", reading: "あたたかい", meaning: "warm", meaningLocale: "en", meaningSource: "jmdict", posKey: "adjective", jlpt: null, common: false, whyItMatters: "", usageNote: "", source: line },
  ],
  expressions: [{ expression: "失礼します", commonness: "very_common", meaningUse: "Excuse me", nuance: "humble", source: line }],
  grammar: [{ grammarId: "g-1", title: "〜てもいいですか", jlpt: "N4", meaningShort: "May I", explanation: "Asks permission", tryIt: "写真を撮ってもいいですか。", span: "てもいい", source: line }],
  culture: [],
};
const reflection: ReflectionView = { text: "You said it naturally today.", highlight: { lineId: line.lineId, span: "ありがとうございます" }, generatedAt: "2026-10-05T00:00:00Z" };

const props: SummaryIslandProps = {
  videoId: "v-1", youtubeVideoId: "yt", locale: "en", hasTranscript: true, reviewTargets: [], reviewTargetTotal: 1,
  fallback: { kind: "best_line", line: "いらっしゃいませ" }, savedCards: [],
};

type Script = Record<string, Array<AnalysisResponse | ReflectionResponse>>;
/** Answers `METHOD path` from a queue; the last answer repeats. Records every request. */
function stubFetch(script: Script) {
  const requests: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
    requests.push(key);
    const queue = script[key];
    if (!queue?.length) throw new Error(`unscripted ${key}`);
    const body = queue.length > 1 ? queue.shift() : queue[0];
    return { ok: true, status: 200, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return requests;
}
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const area = (name: string) => document.querySelector(`[data-summary-area="${name}"]`) as HTMLElement;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SummaryIsland", () => {
  it("places Hear in lesson on each word card and nowhere else", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(within(area("words")).getAllByRole("button", { name: "Hear in lesson" })).toHaveLength(view.words.length);
    for (const name of ["reflection", "expressions", "grammar", "culture", "review"]) {
      expect(within(area(name)).queryAllByRole("button", { name: "Hear in lesson" })).toHaveLength(0);
    }
  });

  it("pending: aria-busy skeletons in the four AI areas, the review list is visible at once", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "pending", retryAfterMs: 1000 }] });
    render(<SummaryIsland {...props} />);
    await flush();
    for (const name of ["words", "expressions", "grammar", "culture"]) {
      expect(area(name).querySelector('[aria-busy="true"]'), name).not.toBeNull();
    }
    expect(screen.getByRole("heading", { name: "Things You Should Review" })).toBeInTheDocument();
  });

  it("ready: renders the words and announces 'Lesson analysis ready' once", async () => {
    stubFetch({
      [`GET ${ANALYSIS}`]: [{ status: "pending", retryAfterMs: 1000 }, { status: "ready", data: view }],
      [`GET ${REFLECTION}`]: [{ state: "fallback", reason: "no_evidence" }],
    });
    const { rerender } = render(<SummaryIsland {...props} />);
    await flush();
    const status = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(status).toHaveTextContent("");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const words = within(area("words"));
    expect(words.getByText("注文")).toBeInTheDocument();
    expect(words.getByText("ちゅうもん")).toBeInTheDocument();
    expect(words.getByText("order")).toBeInTheDocument();
    expect(words.getByText("Noun")).toBeInTheDocument();
    expect(words.getAllByText("Common")).toHaveLength(1); // only the `common` word carries the tag
    expect(status).toHaveTextContent("Lesson analysis ready");
    rerender(<SummaryIsland {...props} />);
    await flush();
    expect(screen.getAllByText("Lesson analysis ready")).toHaveLength(1);
  });

  it("unavailable: 'Not available right now' in each AI area and no Retry button", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "unavailable" }], [`GET ${REFLECTION}`]: [{ state: "fallback", reason: "unavailable" }] });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(screen.getAllByText("Not available right now")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("retryable_error: Retry is aria-disabled until retryAfter passes, then a click POSTs", async () => {
    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
    const requests = stubFetch({
      [`GET ${ANALYSIS}`]: [{ status: "retryable_error", retryAfter: "2026-10-05T00:00:30Z" }],
      [`POST ${ANALYSIS}`]: [{ status: "pending", retryAfterMs: 1000 }],
      [`GET ${REFLECTION}`]: [{ state: "fallback", reason: "analysis_unusable" }],
    });
    render(<SummaryIsland {...props} />);
    await flush();
    const retry = within(area("words")).getByRole("button", { name: "Retry" });
    expect(screen.getAllByText("Could not prepare the analysis.")).toHaveLength(4);
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(retry).not.toHaveAttribute("disabled");
    fireEvent.click(retry);
    await flush();
    expect(requests).not.toContain(`POST ${ANALYSIS}`);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(within(area("words")).getByRole("button", { name: "Retry" })).not.toHaveAttribute("aria-disabled");
    fireEvent.click(within(area("words")).getByRole("button", { name: "Retry" }));
    await flush();
    expect(requests).toContain(`POST ${ANALYSIS}`);
  });

  it("no transcript: 'Needs a transcript' and no request at all", async () => {
    const requests = stubFetch({});
    render(<SummaryIsland {...props} hasTranscript={false} />);
    await flush();
    expect(screen.getAllByText("Needs a transcript")).toHaveLength(4);
    expect(requests).toEqual([]);
  });

  it("an empty culture list says 'Nothing stood out in this lesson'", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(within(area("culture")).getByText("Nothing stood out in this lesson")).toBeInTheDocument();
  });

  it("reflection ready: AI text, eyebrow 'AI Korume' and the highlight quoted by the UI in Japanese", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    const card = within(area("reflection"));
    expect(card.getByText("AI Korume")).toBeInTheDocument();
    expect(card.getByText(/You said it naturally today\./)).toBeInTheDocument();
    expect(card.getByText("「ありがとうございます」")).toHaveAttribute("lang", "ja");
  });

  it("reflection stale: the stale text is shown AND a POST asks for a fresh one; a later fallback keeps the text", async () => {
    const requests = stubFetch({
      [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }],
      [`GET ${REFLECTION}`]: [{ state: "stale", stale: true, reflection }],
      [`POST ${REFLECTION}`]: [{ state: "fallback", reason: "backoff" }],
    });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(requests).toContain(`POST ${REFLECTION}`);
    const card = within(area("reflection"));
    expect(card.getByText(/You said it naturally today\./)).toBeInTheDocument();
    expect(card.getByText("AI Korume")).toBeInTheDocument();
  });

  it("reflection fallback: the best_line template with eyebrow 'Korume'", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "fallback", reason: "no_evidence" }] });
    render(<SummaryIsland {...props} />);
    await flush();
    const card = within(area("reflection"));
    expect(card.getByText("Korume")).toBeInTheDocument();
    expect(card.getByText("You said 「いらっしゃいませ」 well in this lesson. Come back tomorrow to keep it.")).toBeInTheDocument();
  });

  it("grammar shows the From-lesson line and a Try it example labelled as practice", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    const grammar = within(area("grammar"));
    expect(grammar.getByText("From lesson")).toBeInTheDocument();
    expect(grammar.getByText("コーヒーを注文します。")).toBeInTheDocument();
    expect(grammar.getByText(/Practice example — not from the lesson/)).toBeInTheDocument();
    expect(grammar.getByText("写真を撮ってもいいですか。")).toBeInTheDocument();
  });

  it("View as list: the AI words, then the lesson's frequent words it did not pick, 8 per page; View as cards returns", async () => {
    const lessonWords = Array.from({ length: 12 }, (_, index) => ({
      entSeq: index + 1, headword: `語${index + 1}`, reading: `ご${index + 1}`, glossEn: `gloss ${index + 1}`, occurrences: 12 - index,
      jlpt: null, vocabId: null, curatedVi: null, mastery: null, exampleLineIds: [line.lineId], exampleSurface: `語${index + 1}`,
    }));
    const requests = stubFetch({
      [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }],
      [`GET ${REFLECTION}`]: [{ state: "ready", reflection }],
      ["GET /api/videos/v-1/vocabulary"]: [{ data: { items: lessonWords, nextCursor: null, total: 12 } } as unknown as AnalysisResponse],
    });
    render(<SummaryIsland {...props} />);
    await flush();
    fireEvent.click(within(area("words")).getByRole("button", { name: "View as list" }));
    await flush();
    expect(requests).toContain("GET /api/videos/v-1/vocabulary");
    const list = within(area("words")).getByRole("list", { name: "Words from this lesson" });
    const words = () => within(list).getAllByRole("listitem").map((item) => item.querySelector("[lang='ja']")?.textContent);
    // 2 AI words + 10 lesson words (entSeq 1 and 2 are the AI's) = 12 rows → pages of 8 and 4.
    expect(words()).toEqual(["注文", "温かい", "語3", "語4", "語5", "語6", "語7", "語8"]);
    expect(within(area("words")).getByText("Page 1 of 2")).toBeInTheDocument();
    expect(within(area("words")).getByRole("button", { name: "Previous page" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(area("words")).getByRole("button", { name: "Next page" }));
    expect(words()).toEqual(["語9", "語10", "語11", "語12"]);
    expect(within(area("words")).getByRole("button", { name: "Next page" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(area("words")).getByRole("button", { name: "View as cards" }));
    expect(within(area("words")).getAllByRole("button", { name: "Hear in lesson" })).toHaveLength(view.words.length);
    fireEvent.click(within(area("words")).getByRole("button", { name: "View as list" }));
    await flush();
    expect(requests.filter((request) => request === "GET /api/videos/v-1/vocabulary")).toHaveLength(1);
  });

  it("View as list still lists the AI words when the lesson words fail to load", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    fireEvent.click(within(area("words")).getByRole("button", { name: "View as list" }));
    await flush();
    expect(within(area("words")).getByRole("status")).toHaveTextContent("Could not load more words from the lesson.");
    expect(within(within(area("words")).getByRole("list")).getAllByRole("listitem")).toHaveLength(view.words.length);
  });

  it("puts a save toggle on each word and each Natural Japanese card", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(within(area("words")).getByRole("button", { name: "Save 注文" })).toBeInTheDocument();
    expect(within(area("expressions")).getByRole("button", { name: "Save 失礼します" })).toBeInTheDocument();
  });
  it("asks for no reflection when the analysis settles unusable (no endless pending poll)", async () => {
    const requests = stubFetch({
      [`GET ${ANALYSIS}`]: [{ status: "unavailable" }],
      [`GET ${REFLECTION}`]: [{ state: "pending", retryAfterMs: 1500, reflection: null }],
    });
    render(<SummaryIsland {...props} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(requests.filter((key) => key.includes("lesson-reflection"))).toEqual([]);
    expect(within(area("reflection")).getByText("Korume")).toBeInTheDocument();
  });
});
