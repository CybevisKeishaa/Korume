import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { ToastProvider } from "@/components/ui/toast";
import type { PrintDocument, PrintResources, VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import * as paginateModule from "@/lib/vocabulary/print/paginate";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { MM_TO_PX, PAPER } from "@/lib/vocabulary/print/paper";
import { PrintWorkspace } from "./print-workspace";

vi.mock("@/lib/i18n/navigation", () => ({ Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/vocabulary/print/mascot", () => ({ MASCOT_SRC: "/m.png", WATERMARK_SRC: "/w.png", mascotReady: vi.fn(() => Promise.resolve()) }));

const items = (count: number): VocabularyPrintItem[] => Array.from({ length: count }, (_, i) => ({
  id: `i-${i}`, surface: `語${i}`, reading: "ご", meaning: `m${i}`, meaningLocale: "en", meaningSource: "jmdict", resolution: "resolved",
  example: { text: `語${i}の例`, spans: [] },
}));
const kana = (surface: string): VocabularyPrintItem => ({ id: surface, surface, reading: surface, meaning: "m", meaningLocale: "en", resolution: "resolved" });
const doc = (list: VocabularyPrintItem[]): PrintDocument => ({ title: "Lesson", backHref: "/back", backLabel: "Back to the lesson summary", items: list });
const views = [{ label: "All", href: "/vocab/print?set=all", current: true }, { label: "Saved", href: "/vocab/print?set=saved", current: false }];
const source = { lessonId: "L", set: "all" as const };
const resources: PrintResources = { strokeGuides: {}, credits: { jmdict: "JMdict v1 (CC)", kanjivg: null } };

// jsdom lays nothing out: heights come from the element's role in the measurement tree.
const HEIGHTS: Record<string, number> = { "first-header": 100, "continuation-header": 40, quote: 30, footer: 30, "answers-heading": 20 };
let itemHeight = 100;
let answerHeight = 20;
let contentHeight = 1000;
const observers = new Map<Element, ResizeObserverCallback>();
const observedBy = (selector: string) => observers.get(document.querySelector(selector)!);

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const role = this.dataset.measure;
    const height = role === "item" ? itemHeight : role === "answer" ? answerHeight : role === "content" ? contentHeight : HEIGHTS[role ?? ""] ?? 0;
    return { height, width: 600, top: 0, left: 0, bottom: height, right: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  observers.clear();
  vi.stubGlobal("ResizeObserver", class {
    constructor(private cb: ResizeObserverCallback) { /* callback kept per observed element */ }
    observe(element: Element) { observers.set(element, this.cb); }
    disconnect() { /* noop */ }
  });
  vi.spyOn(paginateModule, "paginate");
  vi.mocked(mascotReady).mockImplementation(() => Promise.resolve());
});
afterEach(() => { vi.useRealTimers(); Reflect.deleteProperty(document, "fonts"); vi.restoreAllMocks(); vi.unstubAllGlobals(); itemHeight = 100; answerHeight = 20; contentHeight = 1000; });

const printButton = () => screen.getByRole("button", { name: "Print" });
const printRoot = () => document.body.querySelector(":scope > [data-print-root]");
const workspace = (list: VocabularyPrintItem[]) => (
  <ToastProvider dismissLabel="Dismiss"><PrintWorkspace doc={doc(list)} views={views} source={source} resources={resources} /></ToastProvider>
);

describe("PrintWorkspace (spec §3, W §2 + §5–§6)", () => {
  it("commits a complete page set into the preview and a body-level print root", async () => {
    render(workspace(items(20)));
    // capacity: first 1000-100-30-30 = 840 → 8 items; continuation 1000-40-30-30 = 900 → 9 items; 20 items → 3 pages
    expect(await screen.findByText("20/20 words · 3 pages")).toBeInTheDocument();
    expect(printRoot()?.querySelectorAll(".vp-sheet")).toHaveLength(3);
    expect(document.querySelectorAll("[data-preview] .vp-sheet")).toHaveLength(3);
    expect(printButton()).not.toHaveAttribute("aria-disabled");
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    fireEvent.click(printButton());
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("commits nothing and keeps Print disabled until the mascot decodes", async () => {
    let decode!: () => void;
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { decode = resolve; }));
    render(workspace(items(3)));
    await waitFor(() => expect(paginateModule.paginate).toHaveBeenCalled());
    expect(printRoot()?.querySelectorAll(".vp-sheet") ?? []).toHaveLength(0);
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    await act(async () => decode());
    expect(await screen.findByText("3/3 words · 1 page")).toBeInTheDocument();
  });

  it("re-paginates on a setting change but not on a resize, which only rescales the preview", async () => {
    render(workspace(items(5)));
    await screen.findByText("5/5 words · 1 page");
    const calls = vi.mocked(paginateModule.paginate).mock.calls.length;
    await act(async () => observedBy("[data-preview]")?.([{ contentRect: { width: 300 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls);
    const inner = document.querySelector<HTMLElement>("[data-preview] .origin-top-left");
    expect(inner?.style.transform).toBe(`scale(${300 / (PAPER.widthMm * MM_TO_PX)})`);
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    await waitFor(() => expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls + 1));
  });

  it("commits nothing while the measurement tree has no layout, and re-measures when layout returns", async () => {
    contentHeight = 0;
    render(workspace(items(5)));
    await waitFor(() => expect(observers.size).toBeGreaterThan(0));
    await act(async () => { await Promise.resolve(); });
    expect(printRoot()?.querySelectorAll(".vp-sheet") ?? []).toHaveLength(0);
    expect(vi.mocked(paginateModule.paginate)).not.toHaveBeenCalled();
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    contentHeight = 1000;
    await act(async () => observedBy('[data-measure="content"]')?.([{ contentRect: { height: 1000 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(await screen.findByText("5/5 words · 1 page")).toBeInTheDocument();
    expect(printButton()).not.toHaveAttribute("aria-disabled");
  });

  it("ignores a content observation whose height did not change", async () => {
    render(workspace(items(5)));
    await screen.findByText("5/5 words · 1 page");
    const calls = vi.mocked(paginateModule.paginate).mock.calls.length;
    await act(async () => observedBy('[data-measure="content"]')?.([{ contentRect: { height: 1000 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls);
  });

  it("never lets a stale generation win over a newer one", async () => {
    const pending: (() => void)[] = [];
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { pending.push(resolve); }));
    render(workspace(items(4)));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1]!());
    await act(async () => pending[0]!());
    expect(printRoot()?.querySelector(".vp-paper")).toHaveClass("vp-compact");
  });

  it("re-measures once after a burst of font loads", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    render(workspace(items(4)));
    await screen.findByText("4/4 words · 1 page");
    const calls = vi.mocked(paginateModule.paginate).mock.calls.length;
    const paginated = () => vi.mocked(paginateModule.paginate).mock.calls.length;
    await act(async () => { fonts.dispatchEvent(new Event("loadingdone")); });
    await act(async () => { vi.advanceTimersByTime(50); });
    await act(async () => { fonts.dispatchEvent(new Event("loadingdone")); });
    await act(async () => { vi.advanceTimersByTime(200); });
    await waitFor(() => expect(paginated()).toBe(calls + 1));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(paginated()).toBe(calls + 1);
  });

  it("blocks printing, without clipping, when an item is taller than a page", async () => {
    itemHeight = 950;
    render(workspace(items(1)));
    expect(await screen.findByText(/is too long for the page/)).toBeInTheDocument();
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    expect(printButton().className).toContain("aria-disabled:cursor-not-allowed");
    expect(printButton().className).toContain("aria-disabled:opacity-50");
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    fireEvent.click(printButton());
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-preview] .vp-item")).toHaveLength(1);
  });

  it("disables Print and shows the empty message when every word is deselected", async () => {
    render(workspace(items(2)));
    await screen.findByText("2/2 words · 1 page");
    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(await screen.findByText("0/2 words · 0 pages")).toBeInTheDocument();
    expect(document.querySelector("[data-preview]")).toHaveTextContent("There are no words to print here yet.");
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the adapter's back link instead of a blank sheet for an empty document", () => {
    render(workspace([]));
    expect(screen.getByText("There are no words to print here yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the lesson summary" })).toHaveAttribute("href", "/back");
  });

  it("notes raw saved items before printing", async () => {
    render(workspace([...items(1), { id: "raw-x", surface: "消えた", resolution: "saved_raw" }]));
    expect(await screen.findByText("1 item has no reading or meaning on record.")).toBeInTheDocument();
  });

  it("commits nothing after unmount while the font wait is still pending", async () => {
    let ready!: () => void;
    const fonts = Object.assign(new EventTarget(), { ready: new Promise<void>((resolve) => { ready = resolve; }) });
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    const { unmount } = render(workspace(items(2)));
    unmount();
    await act(async () => ready());
    expect(paginateModule.paginate).not.toHaveBeenCalled();
    expect(printRoot()).toBeNull();
  });

  it("keeps the committed sheets' labels until the new page set commits", async () => {
    render(workspace(items(2)));
    await screen.findByText("2/2 words · 1 page");
    expect(printRoot()).toHaveTextContent("Vocabulary Writing Practice");
    let decode!: () => void;
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { decode = resolve; }));
    fireEvent.click(screen.getByRole("radio", { name: "Self-test" }));
    await waitFor(() => expect(decode).toBeDefined());
    expect(printRoot()).toHaveTextContent("Vocabulary Writing Practice");
    expect(printRoot()).not.toHaveTextContent("Vocabulary Self-test");
    await act(async () => decode());
    expect(printRoot()).toHaveTextContent("Vocabulary Self-test");
  });

  it("names the views navigation", async () => {
    render(workspace(items(1)));
    await screen.findByText("1/1 words · 1 page");
    expect(screen.getByRole("navigation", { name: "Words" })).toBeInTheDocument();
  });

  it("starts in Writing practice with words without kanji hidden, and shows them when the toggle is on", async () => {
    render(workspace([...items(2), kana("する")]));
    expect(await screen.findByText("2/2 words · 1 page")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Writing practice" })).toBeChecked();
    expect(screen.queryByText("する")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Include kana-only words" }));
    expect(await screen.findByText("3/3 words · 1 page")).toBeInTheDocument();
  });

  it("self-test: the last enabled prompt cannot be turned off", async () => {
    render(workspace(items(2)));
    fireEvent.click(await screen.findByRole("radio", { name: "Self-test" }));
    fireEvent.click(screen.getByRole("switch", { name: "Reading" }));
    fireEvent.click(screen.getByRole("switch", { name: "Example" }));
    expect(screen.getByRole("switch", { name: "Meaning" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Meaning" })).toHaveAccessibleDescription("Keep at least one prompt.");
    expect(screen.getByText("Keep at least one prompt.")).toBeInTheDocument();
    expect(await screen.findByText("2/2 words · 2 pages")).toBeInTheDocument(); // the in-flight generation commits inside the test
  });

  it("self-test never starts with every prompt off: switching from a target-only practice sheet turns Meaning on", async () => {
    render(workspace(items(2)));
    await screen.findByText("2/2 words · 1 page");
    for (const name of ["Reading", "Meaning", "Example"]) fireEvent.click(screen.getByRole("switch", { name }));
    expect(screen.getByRole("switch", { name: "Meaning" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: "Self-test" }));
    const meaning = screen.getByRole("switch", { name: "Meaning" });
    expect(meaning).toHaveAttribute("aria-checked", "true");
    expect(meaning).toBeDisabled();
    expect(screen.getByText("Keep at least one prompt.")).toBeVisible();
    expect(await screen.findByText("2/2 words · 2 pages")).toBeInTheDocument();
  });

  it("self-test commits item pages then answer pages, the answers measured with the heading", async () => {
    render(workspace(items(3)));
    fireEvent.click(await screen.findByRole("radio", { name: "Self-test" }));
    await waitFor(() => expect(printRoot()?.querySelectorAll(".vp-answer")).toHaveLength(3));
    const sheets = [...(printRoot()?.querySelectorAll(".vp-sheet") ?? [])];
    expect(sheets.at(-1)?.querySelector(".vp-answers-title")).not.toBeNull();
    expect(sheets.slice(0, -1).every((sheet) => sheet.querySelector(".vp-answer") === null)).toBe(true);
    expect(printRoot()?.querySelector(".vp-model, .vp-trace, .vp-guide")).toBeNull();
  });

  it("every answer page keeps room for its own heading", async () => {
    answerHeight = 450; // room per answer page: 1000-40-30-30-20 = 880 → one answer; without the heading 900 would hold two
    render(workspace(items(2)));
    fireEvent.click(await screen.findByRole("radio", { name: "Self-test" }));
    await waitFor(() => expect(printRoot()?.querySelectorAll(".vp-answer")).toHaveLength(2));
    const answerPages = [...(printRoot()?.querySelectorAll(".vp-sheet") ?? [])].filter((sheet) => sheet.querySelector(".vp-answers-title"));
    expect(answerPages.map((sheet) => sheet.querySelectorAll(".vp-answer").length)).toEqual([1, 1]);
  });

  it("notes words left out of self-test for lack of a prompt, and characters without a stroke guide in practice", async () => {
    const bare: VocabularyPrintItem = { id: "raw", surface: "消えた", resolution: "saved_raw" };
    render(workspace([...items(1), bare]));
    expect(await screen.findByText(/characters have no stroke guide yet/)).toBeInTheDocument(); // 語, 0 … and 消, え, た: none in resources
    fireEvent.click(screen.getByRole("radio", { name: "Self-test" }));
    expect(await screen.findByText("1 word has no prompt, so it is left out of the self-test.")).toBeInTheDocument();
  });

  it("blocks Print when every printed item is excluded, and when a word is too wide even at 8mm cells", async () => {
    const bare: VocabularyPrintItem = { id: "raw", surface: "消えた", resolution: "saved_raw" };
    const { unmount } = render(workspace([bare]));
    fireEvent.click(await screen.findByRole("radio", { name: "Self-test" }));
    expect(await screen.findByText("1 word has no prompt, so it is left out of the self-test.")).toBeInTheDocument();
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    unmount();

    const long: VocabularyPrintItem = { id: "long", surface: "語".repeat(23), resolution: "resolved", meaning: "x", meaningLocale: "en" };
    render(workspace([long]));
    expect(await screen.findByRole("alert")).toHaveTextContent("is too long for the page");
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
  });
});

it("Download PDF posts the committed ids and settings, then saves the returned file", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const fetchMock = vi.fn(async () => new Response(new Blob(["%PDF-1.7"]), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const createObjectURL = vi.fn(() => "blob:x");
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  render(workspace(items(3)));
  await screen.findByText("3/3 words · 1 page");
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  // revoking right after click() cancels the download in Safari / older Firefox: revoke a minute later
  expect(revokeObjectURL).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/vocab/print/pdf");
  expect(JSON.parse(init.body as string)).toEqual({
    lessonId: "L", set: "all", locale: "en", settings: expect.objectContaining({ mode: "practice" }),
    pages: [{ kind: "items", ids: ["i-0", "i-1", "i-2"] }],
  });
});

it("keeps Download PDF busy while a request runs, even if the selection changes (Review Focus 3)", async () => {
  let respond!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
  render(workspace(items(2)));
  await screen.findByText("2/2 words · 1 page");
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
  expect(await screen.findByRole("button", { name: "Creating the PDF…" })).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(screen.getAllByRole("checkbox")[0]!);
  fireEvent.click(screen.getByRole("button", { name: "Creating the PDF…" }));
  expect(fetch).toHaveBeenCalledTimes(1);
  respond(new Response(null, { status: 503 }));
  expect(await screen.findByText("The server is busy — try again shortly.")).toBeInTheDocument();
});

it("disables both actions until a page set is committed", async () => {
  vi.mocked(mascotReady).mockImplementation(() => new Promise(() => undefined));
  render(workspace(items(2)));
  expect(screen.getByRole("button", { name: "Download PDF" })).toHaveAttribute("aria-disabled", "true");
  expect(printButton()).toHaveAttribute("aria-disabled", "true");
});

it("Download PDF sends the committed page split, not a re-derived one", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  render(workspace(items(20)));
  await screen.findByText("20/20 words · 3 pages"); // 8 + 9 + 3, as the measured capacities dictate
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
  await screen.findByText("Could not create the PDF.");
  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  const sent = JSON.parse(init.body as string) as { pages: { ids: string[] }[] };
  expect(sent.pages.map((page) => page.ids.length)).toEqual([8, 9, 3]);
});
