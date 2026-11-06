import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KanjiInspectPayload, KanjiNeighbors } from "@/lib/kanji/learner-types";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { KanjiInspectModal as Modal } from "./kanji-inspect-modal";

const KanjiInspectModal = () => <ThemeProvider><Modal /></ThemeProvider>;

/** A whole payload: the modal now renders the full inspect content. */
function full(literal: string, hanViet: string[], neighbors: KanjiNeighbors | null): { data: KanjiInspectPayload } {
  return {
    data: {
      data: {
        literal, onReadings: [], kunReadings: [], meaningsEn: ["sun"], meaningVi: null, mnemonic: null, strokeCount: 4, grade: null,
        frequency: null, jlpt: null, hanViet, tcLines: [], oldJlpt: null, strokePaths: [],
        components: { element: literal, position: null, children: [] }, componentGlosses: {}, commonWords: [], curatedKanjiId: null, attribution: [],
      },
      learner: { favorite: false, progress: null }, examples: [], lessons: [], neighbors,
    },
  };
}

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }));
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("@/lib/i18n/navigation", () => ({
  // `scroll` is a next/link prop, not an <a> attribute.
  Link: ({ children, scroll, ...props }: React.ComponentProps<"a"> & { scroll?: boolean }) => <a data-scroll={scroll} {...props}>{children}</a>,
  useRouter: () => router,
  usePathname: () => "/kanji",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(url.search) }));

let fetchMock: ReturnType<typeof vi.fn>;
function serve(neighbors: KanjiNeighbors | null) {
  fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(full("日", ["Nhật", "Nhựt"], neighbors)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  url.search = "";
  // jsdom has no showModal/close; the real behaviour (top layer, focus, Esc) is proven in Playwright.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
});
afterEach(() => vi.unstubAllGlobals());

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("KanjiInspectModal", () => {
  it.each(["abc", "日本", "%E0%A4"])("?kanji=%s opens nothing, fetches nothing and touches no history", (raw) => {
    serve(null);
    url.search = `level=N5&kanji=${raw}`;
    render(<KanjiInspectModal />);
    expect(dialog().open).toBe(false);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("opens on ?kanji=, loads the payload with from, shows glyph, Hán Việt, page link and ‹ ›", async () => {
    serve({ prev: "月", next: "火" });
    url.search = "level=N5&kanji=%E6%97%A5&from=level%3AN5";
    render(<KanjiInspectModal />);
    expect(dialog().open).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/dictionary/kanji/%E6%97%A5?from=level%3AN5");
    expect(await screen.findByText("Nhật, Nhựt")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "日" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open its own page" })).toHaveAttribute("href", "/kanji/%E6%97%A5");
    fireEvent.click(screen.getByRole("button", { name: "Next kanji" }));
    expect(router.replace).toHaveBeenLastCalledWith("/kanji?level=N5&kanji=%E7%81%AB&from=level%3AN5", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Previous kanji" }));
    expect(router.replace).toHaveBeenLastCalledWith("/kanji?level=N5&kanji=%E6%9C%88&from=level%3AN5", { scroll: false });
  });

  it("keeps the same ‹ › mounted while the next literal loads, inert until it lands", async () => {
    serve({ prev: "月", next: "火" });
    url.search = "level=N5&kanji=%E6%97%A5&from=level%3AN5";
    const { rerender } = render(<KanjiInspectModal />);
    const next = await screen.findByRole("button", { name: "Next kanji" });
    let land: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { land = resolve; }));
    url.search = "level=N5&kanji=%E7%81%AB&from=level%3AN5";
    rerender(<KanjiInspectModal />);
    expect(screen.getByRole("button", { name: "Next kanji" })).toBe(next); // the same node: focus survives
    expect(next).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(next);
    expect(router.replace).not.toHaveBeenCalled();
    land(new Response(JSON.stringify(full("火", ["Hỏa"], { prev: "日", next: null }))));
    await screen.findByText("Hỏa");
    expect(screen.getByRole("button", { name: "Next kanji" })).toBe(next);
    expect(next).toHaveAttribute("aria-disabled", "true"); // the end of the list
    expect(screen.getByRole("button", { name: "Previous kanji" })).toHaveAttribute("aria-disabled", "false");
  });

  it("hides ‹ › without neighbors and leaves out an absent from", async () => {
    serve(null);
    url.search = "kanji=%E6%97%A5";
    render(<KanjiInspectModal />);
    expect(fetchMock).toHaveBeenCalledWith("/api/dictionary/kanji/%E6%97%A5");
    await screen.findByText("Nhật, Nhựt");
    expect(screen.queryByRole("button", { name: "Next kanji" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous kanji" })).toBeNull();
  });

  it("Esc (cancel, default prevented), the backdrop and ✕ all close", async () => {
    serve(null);
    url.search = "kanji=%E6%97%A5";
    render(<KanjiInspectModal />);
    await screen.findByText("Nhật, Nhựt");

    const cancel = createEvent("cancel", dialog(), { cancelable: true });
    fireEvent(dialog(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(router.replace).toHaveBeenCalledTimes(1);

    fireEvent.click(dialog());
    expect(router.replace).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("Nhật, Nhựt")); // inside the panel: not the backdrop
    expect(router.replace).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(router.replace).toHaveBeenCalledTimes(3);
    expect(router.replace).toHaveBeenLastCalledWith("/kanji", { scroll: false });
  });

  it("a failed load says so and retries; the page link stays", async () => {
    vi.stubGlobal("fetch", (fetchMock = vi.fn(async () => new Response("{}", { status: 500 }))));
    url.search = "kanji=%E6%97%A5";
    render(<KanjiInspectModal />);
    expect(await screen.findByText("Couldn't load this kanji.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open its own page" })).toHaveAttribute("href", "/kanji/%E6%97%A5");
    serve(null);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nhật, Nhựt")).toBeInTheDocument();
  });

  it("shows a loading skeleton with the glyph until the payload lands", () => {
    vi.stubGlobal("fetch", (fetchMock = vi.fn(() => new Promise<Response>(() => undefined))));
    url.search = "kanji=%E6%97%A5";
    render(<KanjiInspectModal />);
    expect(screen.getByRole("status", { name: "Loading kanji…" })).toHaveTextContent("日");
  });

  it("closes the dialog when the param goes away", async () => {
    serve(null);
    url.search = "kanji=%E6%97%A5";
    const { rerender } = render(<KanjiInspectModal />);
    await screen.findByText("Nhật, Nhựt");
    url.search = "";
    rerender(<KanjiInspectModal />);
    await waitFor(() => expect(dialog().open).toBe(false));
  });
});
