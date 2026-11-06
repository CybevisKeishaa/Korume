import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KanjiInspectPayload } from "@/lib/kanji/learner-types";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { KanjiInspect } from "./kanji-inspect";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, scroll, ...props }: React.ComponentProps<"a"> & { scroll?: boolean }) => <a data-scroll={scroll} {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/kanji",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("level=N5") }));

function payload(overrides: { data?: Partial<KanjiInspectPayload["data"]> } & Partial<Omit<KanjiInspectPayload, "data">> = {}): KanjiInspectPayload {
  const { data, ...rest } = overrides;
  return {
    data: {
      literal: "学", onReadings: ["ガク"], kunReadings: ["まな.ぶ"], meaningsEn: ["study", "learning"], meaningVi: null, mnemonic: null,
      strokeCount: 8, grade: 1, frequency: 63, jlpt: null, hanViet: ["Học"],
      tcLines: ["Học, bắt chước.", "Chỗ học.", "Môn học."], oldJlpt: 4,
      strokePaths: ["M1 1L2 2", "M3 3L4 4"],
      components: { element: "学", position: null, children: [
        { element: null, position: "top", children: [{ element: "⺍", position: null, children: [] }, { element: "冖", position: null, children: [] }] },
        { element: "子", position: "bottom", children: [] },
      ] },
      componentGlosses: { 子: { hanViet: ["Tử"], meaningEn: "child" } },
      commonWords: [{ entSeq: 1, headword: "学生", reading: "がくせい", glossEn: "student" }],
      curatedKanjiId: null,
      attribution: [{ source: "kanjivg", version: "main", url: "https://kanjivg.tagaini.net", license: "CC BY-SA 3.0" }],
      ...data,
    },
    learner: { favorite: false, progress: null },
    examples: [{ lineId: "l1", videoId: "v1", lessonTitle: "Lesson one", textJp: "学校に行く", translation: "Go to school" }],
    lessons: [{ videoId: "v1", title: "Lesson one", count: 3 }],
    neighbors: null,
    ...rest,
  };
}

const show = (p: KanjiInspectPayload, variant: "modal" | "page" = "modal") =>
  render(<ThemeProvider><KanjiInspect payload={p} variant={variant} /></ThemeProvider>);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("KanjiInspect", () => {
  it("header meaning line is Hán Việt uppercase · English", () => {
    show(payload());
    expect(screen.getByText("HỌC · study, learning")).toBeInTheDocument();
  });

  it("Thiều Chửu: first 2 lines, expand to all, credit; absent when tcLines is []", () => {
    const { unmount } = show(payload());
    const block = screen.getByRole("region", { name: "Classical meaning (Thiều Chửu)" });
    expect(within(block).getByText("Học, bắt chước.")).toBeInTheDocument();
    expect(within(block).getByText("Chỗ học.")).toBeInTheDocument();
    expect(within(block).queryByText("Môn học.")).toBeNull();
    expect(within(block).getByText("Thiều Chửu, Hán Việt tự điển (1942)")).toBeInTheDocument();
    fireEvent.click(within(block).getByRole("button", { name: "Show all 3 lines" }));
    expect(within(block).getByText("Môn học.")).toBeInTheDocument();
    unmount();
    show(payload({ data: { tcLines: [] } }));
    expect(screen.queryByRole("region", { name: "Classical meaning (Thiều Chửu)" })).toBeNull();
  });

  it("N3 badge only with a curated jlpt; 常用 iff grade ≤ 8; old JLPT n級", () => {
    const { unmount } = show(payload());
    expect(screen.queryByText("N3")).toBeNull();
    expect(screen.getByText("常用")).toBeInTheDocument();
    expect(screen.getByText("4級")).toBeInTheDocument();
    unmount();
    const second = show(payload({ data: { jlpt: "N3", grade: 8 } }));
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText("常用")).toBeInTheDocument();
    second.unmount();
    show(payload({ data: { grade: 9 } }));
    expect(screen.queryByText("常用")).toBeNull();
  });

  it("composition chips: elements with their glosses, a glyph link, then the kanji", () => {
    show(payload());
    const block = screen.getByRole("region", { name: "Composition" });
    expect(within(block).getByText("⺍")).toBeInTheDocument();
    expect(within(block).getByText("冖")).toBeInTheDocument();
    expect(within(block).getByRole("link", { name: /子/ })).toHaveAttribute("href", "/kanji?level=N5&kanji=%E5%AD%90");
    expect(within(block).getByText("TỬ · child")).toBeInTheDocument();
  });

  it("examples and lessons are absent when empty, and one empty-state line when both are", () => {
    const { unmount } = show(payload({ lessons: [] }));
    expect(screen.getByRole("tab", { name: "Examples" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "In lessons" })).toBeNull();
    expect(screen.queryByText("This kanji is not in any of your lessons yet.")).toBeNull();
    unmount();
    const second = show(payload({ examples: [] }));
    expect(screen.queryByRole("tab", { name: "Examples" })).toBeNull();
    expect(screen.getByRole("tab", { name: "In lessons" })).toBeInTheDocument();
    second.unmount();
    show(payload({ examples: [], lessons: [] }));
    expect(screen.queryByRole("tab", { name: "Examples" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "In lessons" })).toBeNull();
    expect(screen.getAllByText("This kanji is not in any of your lessons yet.")).toHaveLength(1);
  });

  it("an example links to its lesson line; View more swaps in the next 3 in place", async () => {
    const more = [{ lineId: "l2", videoId: "v2", lessonTitle: "Lesson two", textJp: "大学", translation: null }];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: more }), { status: 200 }));
    const first = payload().examples[0] as KanjiInspectPayload["examples"][number];
    show(payload({ examples: [first, { ...first, lineId: "l1b", textJp: "学ぶ" }, { ...first, lineId: "l1c", textJp: "学者" }] }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Examples" }));
    expect(screen.getByRole("link", { name: /学校に行く/ })).toHaveAttribute("href", "/shadowing/v1?line=l1");
    fireEvent.click(screen.getByRole("button", { name: "View more examples" }));
    expect(await screen.findByText("大学")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/kanji/examples/%E5%AD%A6?offset=3");
    expect(screen.queryByText("学校に行く")).toBeNull();
    expect(screen.getByRole("button", { name: "No more examples" })).toBeDisabled(); // a short page is the last
    fireEvent.click(screen.getByRole("button", { name: "Previous examples" }));
    expect(screen.getByText("学校に行く")).toBeInTheDocument();
  });

  it("strokes block absent when strokePaths is []", () => {
    const { unmount } = show(payload());
    expect(screen.getByRole("region", { name: "Stroke order" })).toBeInTheDocument();
    unmount();
    show(payload({ data: { strokePaths: [] } }));
    expect(screen.queryByRole("region", { name: "Stroke order" })).toBeNull();
  });

  it("favorite is optimistic and rolls back on a 500", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let land: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { land = resolve; }));
    show(payload());
    const favorite = screen.getByRole("button", { name: "Favorite" });
    expect(favorite).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(favorite);
    expect(favorite).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenCalledWith("/api/kanji/favorites/%E5%AD%A6", { method: "PUT" });
    land(new Response(JSON.stringify({ error: "x" }), { status: 500 }));
    await waitFor(() => expect(favorite).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("a 429 shows the rate-limit message with its Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "7" } }));
    show(payload());
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests — try again in 7s.");
  });

  it("no progress row: Add-to-Review prompt; adding makes the button 'In review', disabled, and shows the status without a ring", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { inReview: true } }), { status: 200 }));
    show(payload());
    expect(screen.queryByText("SRS stage")).toBeNull();
    expect(screen.getByText("Not in your review deck yet.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Add to Review" })[0] as HTMLElement);
    expect(fetchMock).toHaveBeenCalledWith("/api/kanji/progress/%E5%AD%A6", { method: "PUT" });
    expect(await screen.findByRole("button", { name: "In review" })).toBeDisabled();
    expect(screen.getByText("SRS stage")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /recalled/ })).toBeNull();
  });

  it("with reviews the status shows the ring = (reviews − lapses) / reviews and Review Now", () => {
    show(payload({ learner: { favorite: true, progress: { stage: 4, reviews: 10, lapses: 2, nextReviewAt: "2099-01-01T00:00:00.000Z" } } }));
    expect(screen.getByRole("img", { name: "80% recalled" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Now" })).toHaveAttribute("href", "/kanji/review");
    expect(screen.getByRole("button", { name: "In review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bottom CTAs: Study this Kanji focuses the literal, the other three are placeholders to /", () => {
    show(payload());
    expect(screen.getByRole("link", { name: /Study this Kanji/ })).toHaveAttribute("href", "/kanji/review?focus=%E5%AD%A6");
    for (const name of [/Open Vocabulary/, /Practice Writing/, /Find Similar Kanji/]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", "/");
    }
  });

  it("page variant renders the same blocks, glyph as the h1", () => {
    show(payload(), "page");
    expect(screen.getByRole("heading", { level: 1, name: "学" })).toBeInTheDocument();
    for (const name of ["Stroke order", "Meaning", "My status", "Classical meaning (Thiều Chửu)", "Composition"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Words" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Study this Kanji/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "KanjiVG main" })).toHaveAttribute("title", "CC BY-SA 3.0"); // compact: licence on the link
  });
});
