import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PrintDocument, VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import * as paginateModule from "@/lib/vocabulary/print/paginate";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { MM_TO_PX, PAPER } from "@/lib/vocabulary/print/paper";
import { PrintWorkspace } from "./print-workspace";

vi.mock("@/lib/i18n/navigation", () => ({ Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/vocabulary/print/mascot", () => ({ MASCOT_SRC: "/m.png", mascotReady: vi.fn(() => Promise.resolve()) }));

const items = (count: number): VocabularyPrintItem[] => Array.from({ length: count }, (_, i) => ({
  id: `i-${i}`, surface: `語${i}`, reading: "ご", meaning: `m${i}`, meaningLocale: "en", meaningSource: "jmdict", resolution: "resolved",
}));
const doc = (list: VocabularyPrintItem[]): PrintDocument => ({ title: "Lesson", backHref: "/back", backLabel: "Back to the lesson summary", items: list });
const views = [{ label: "All", href: "/vocab/print?set=all", current: true }, { label: "Saved", href: "/vocab/print?set=saved", current: false }];

// jsdom lays nothing out: heights come from the element's role in the measurement tree.
const HEIGHTS: Record<string, number> = { "first-header": 100, "continuation-header": 40, footer: 60 };
let itemHeight = 100;
let contentHeight = 1000;
const observers = new Map<Element, ResizeObserverCallback>();
const observedBy = (selector: string) => observers.get(document.querySelector(selector)!);

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const role = this.dataset.measure;
    const height = role === "item" ? itemHeight : role === "content" ? contentHeight : HEIGHTS[role ?? ""] ?? 0;
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
afterEach(() => { vi.useRealTimers(); Reflect.deleteProperty(document, "fonts"); vi.restoreAllMocks(); vi.unstubAllGlobals(); itemHeight = 100; contentHeight = 1000; });

const printButton = () => screen.getByRole("button", { name: "Print / Save PDF" });
const printRoot = () => document.body.querySelector(":scope > [data-print-root]");

describe("PrintWorkspace (spec §3)", () => {
  it("commits a complete page set into the preview and a body-level print root", async () => {
    render(<PrintWorkspace doc={doc(items(20))} views={views} />);
    // capacity: first 1000-100-60 = 840 → 8 items; continuation 1000-40-60 = 900 → 9 items; 20 items → 3 pages
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
    render(<PrintWorkspace doc={doc(items(3))} views={views} />);
    await waitFor(() => expect(paginateModule.paginate).toHaveBeenCalled());
    expect(printRoot()?.querySelectorAll(".vp-sheet") ?? []).toHaveLength(0);
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    await act(async () => decode());
    expect(await screen.findByText("3/3 words · 1 page")).toBeInTheDocument();
  });

  it("re-paginates on a setting change but not on a resize, which only rescales the preview", async () => {
    render(<PrintWorkspace doc={doc(items(5))} views={views} />);
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
    render(<PrintWorkspace doc={doc(items(5))} views={views} />);
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
    render(<PrintWorkspace doc={doc(items(5))} views={views} />);
    await screen.findByText("5/5 words · 1 page");
    const calls = vi.mocked(paginateModule.paginate).mock.calls.length;
    await act(async () => observedBy('[data-measure="content"]')?.([{ contentRect: { height: 1000 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls);
  });

  it("never lets a stale generation win over a newer one", async () => {
    const pending: (() => void)[] = [];
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { pending.push(resolve); }));
    render(<PrintWorkspace doc={doc(items(4))} views={views} />);
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
    render(<PrintWorkspace doc={doc(items(4))} views={views} />);
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
    render(<PrintWorkspace doc={doc(items(1))} views={views} />);
    expect(await screen.findByText(/is too long for one page/)).toBeInTheDocument();
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    expect(printButton().className).toContain("aria-disabled:cursor-not-allowed");
    expect(printButton().className).toContain("aria-disabled:opacity-50");
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    fireEvent.click(printButton());
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-preview] .vp-item")).toHaveLength(1);
  });

  it("disables Print and shows the empty message when every word is deselected", async () => {
    render(<PrintWorkspace doc={doc(items(2))} views={views} />);
    await screen.findByText("2/2 words · 1 page");
    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(await screen.findByText("0/2 words · 0 pages")).toBeInTheDocument();
    expect(document.querySelector("[data-preview]")).toHaveTextContent("There are no words to print here yet.");
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the adapter's back link instead of a blank sheet for an empty document", () => {
    render(<PrintWorkspace doc={doc([])} views={views} />);
    expect(screen.getByText("There are no words to print here yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the lesson summary" })).toHaveAttribute("href", "/back");
  });

  it("notes raw saved items before printing", async () => {
    render(<PrintWorkspace doc={doc([...items(1), { id: "raw-x", surface: "x", resolution: "saved_raw" }])} views={views} />);
    expect(await screen.findByText("1 item has no reading or meaning on record.")).toBeInTheDocument();
  });

  it("commits nothing after unmount while the font wait is still pending", async () => {
    let ready!: () => void;
    const fonts = Object.assign(new EventTarget(), { ready: new Promise<void>((resolve) => { ready = resolve; }) });
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    const { unmount } = render(<PrintWorkspace doc={doc(items(2))} views={views} />);
    unmount();
    await act(async () => ready());
    expect(paginateModule.paginate).not.toHaveBeenCalled();
    expect(printRoot()).toBeNull();
  });

  it("keeps the committed sheets' labels until the new page set commits", async () => {
    render(<PrintWorkspace doc={doc(items(2))} views={views} />);
    await screen.findByText("2/2 words · 1 page");
    expect(printRoot()).toHaveTextContent("Vocabulary review");
    let decode!: () => void;
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { decode = resolve; }));
    fireEvent.click(screen.getByRole("radio", { name: "Self-test" }));
    await waitFor(() => expect(decode).toBeDefined());
    expect(printRoot()).toHaveTextContent("Vocabulary review");
    expect(printRoot()).not.toHaveTextContent("Vocabulary Self-test");
    await act(async () => decode());
    expect(printRoot()).toHaveTextContent("Vocabulary Self-test");
  });

  it("names the views navigation", async () => {
    render(<PrintWorkspace doc={doc(items(1))} views={views} />);
    await screen.findByText("1/1 words · 1 page");
    expect(screen.getByRole("navigation", { name: "Words" })).toBeInTheDocument();
  });
});
