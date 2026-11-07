import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KanjiSearchResponse, KanjiSearchResult } from "@/lib/kanji/search";
import { KanjiSearch } from "./kanji-search";

const push = vi.hoisted(() => vi.fn());
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

const NICHI: KanjiSearchResult = { literal: "日", hanViet: ["Nhật"], meaningVi: "vi-1", meaningEn: "day, sun" };
const HON: KanjiSearchResult = { literal: "本", hanViet: ["Bản", "Bổn"], meaningVi: null, meaningEn: "book" };
const GO: KanjiSearchResult = { literal: "語", hanViet: ["Ngữ"], meaningVi: "vi-3", meaningEn: "word" };
const WORD: KanjiSearchResponse = { query: "日本語", mode: "chars", results: [NICHI, HON, GO] };
const TEXT: KanjiSearchResponse = { query: "ngữ", mode: "text", results: [GO, HON] };

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status, headers }));
beforeEach(() => {
  push.mockReset();
  fetchMock = vi.fn();
  answer(WORD);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const box = () => screen.getByRole("combobox", { name: "Search kanji" });
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const key = (k: string) => fireEvent.keyDown(box(), { key: k });
const urls = () => fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url)));

describe("KanjiSearch", () => {
  it("is a closed combobox at rest that never takes focus by itself", () => {
    render(<KanjiSearch />);
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(box()).toHaveAttribute("aria-autocomplete", "list");
    expect(box()).not.toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a typed word lists its kanji as tiles under 'Kanji in …'; ↓ ↓ Enter opens the second one's page", async () => {
    render(<KanjiSearch />);
    type("日本語");
    const list = await screen.findByRole("listbox", { name: "Kanji in 日本語" });
    expect(screen.getByRole("status")).toHaveTextContent("3 kanji found");
    expect(urls()).toEqual(["/api/kanji/search?q=日本語"]);
    expect(box()).toHaveAttribute("aria-expanded", "true");
    expect(box()).toHaveAttribute("aria-controls", list.id);
    const options = within(list).getAllByRole("option");
    expect(options.map((o) => o.querySelector("[lang='ja']")?.textContent)).toEqual(["日", "本", "語"]);
    expect(box()).not.toHaveAttribute("aria-activedescendant");
    key("ArrowDown");
    key("ArrowDown");
    expect(box()).toHaveAttribute("aria-activedescendant", options[1]?.id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    key("ArrowUp");
    expect(box()).toHaveAttribute("aria-activedescendant", options[0]?.id);
    key("ArrowUp"); // wraps to the last
    expect(box()).toHaveAttribute("aria-activedescendant", options[2]?.id);
    key("ArrowDown"); // and back to the first
    key("ArrowDown");
    key("Enter");
    expect(push).toHaveBeenCalledWith(`/kanji/${encodeURIComponent("本")}`);
  });

  it("a reading or text result is a row: glyph, Hán Việt in capitals, the Vietnamese meaning or else the English", async () => {
    answer(TEXT);
    render(<KanjiSearch />);
    type("ngữ");
    const list = await screen.findByRole("listbox", { name: "Search kanji" });
    const [first, second] = within(list).getAllByRole("option");
    expect(first).toHaveTextContent("語");
    expect(first).toHaveTextContent("NGỮ");
    expect(first).toHaveTextContent("vi-3");
    expect(second).toHaveTextContent("BẢN, BỔN");
    expect(second).toHaveTextContent("book");
    expect(screen.queryByText(/^Kanji in/)).toBeNull();
  });

  it("a click on a result opens its page", async () => {
    render(<KanjiSearch />);
    type("日本語");
    const option = await screen.findByRole("option", { name: /語/ });
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    expect(push).toHaveBeenCalledWith(`/kanji/${encodeURIComponent("語")}`);
  });

  it("Enter with nothing highlighted opens a single typed kanji (non-BMP too), and nothing for a longer query", async () => {
    render(<KanjiSearch />);
    type("𠮟");
    key("Enter");
    expect(push).toHaveBeenCalledWith(`/kanji/${encodeURIComponent("𠮟")}`);
    push.mockReset();
    type("日本語");
    key("Enter");
    expect(push).not.toHaveBeenCalled();
  });

  it("debounces typing into one request and aborts a request the next query made stale", async () => {
    let first: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      first = init.signal ?? undefined;
      return new Promise<never>(() => undefined);
    });
    render(<KanjiSearch />);
    type("n");
    type("ng");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(urls()).toEqual(["/api/kanji/search?q=ng"]);
    expect(screen.getByText("Searching…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(""); // not read out on every key
    answer(TEXT);
    type("ngữ");
    await screen.findByRole("option", { name: /語/ });
    expect(first?.aborted).toBe(true);
    expect(urls()).toEqual(["/api/kanji/search?q=ng", "/api/kanji/search?q=ngữ"]);
  });

  it("the last results stay up while the next search loads (no flash per key)", async () => {
    render(<KanjiSearch />);
    type("日本語");
    await screen.findAllByRole("option");
    fetchMock.mockImplementation(() => new Promise<never>(() => undefined));
    type("日本語学");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("listbox", { name: "Kanji in 日本語" })).toBeInTheDocument();
    expect(screen.queryByText("Searching…")).toBeNull();
  });

  it("no result says so; a failed or rate-limited search shows inline and throws nothing", async () => {
    answer({ ...WORD, results: [] });
    render(<KanjiSearch />);
    type("zzz");
    // Shown in the open list and read out by the live region.
    const shown = (text: string) => within(screen.getByRole("combobox").parentElement as HTMLElement).getAllByText(text);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No kanji found"));
    expect(shown("No kanji found")).toHaveLength(2);
    answer({ error: "Something went wrong. Please try again." }, 500);
    type("zzzz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't search. Try again."));
    answer({ error: "Too many requests, slow down" }, 429, { "Retry-After": "7" });
    type("zzzzz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Too many requests — try again in 7s."));
    expect(shown("Too many requests — try again in 7s.")).toHaveLength(2);
    fetchMock.mockRejectedValue(new TypeError("offline"));
    type("zzzzzz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't search. Try again."));
  });

  it("Esc closes the list, a second Esc clears the box; clearing the box closes and sends nothing", async () => {
    render(<KanjiSearch />);
    type("日本語");
    await screen.findByRole("listbox");
    key("Escape");
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    key("ArrowDown"); // reopens
    expect(box()).toHaveAttribute("aria-expanded", "true");
    key("Escape");
    key("Escape");
    expect(box()).toHaveValue("");
    const sent = fetchMock.mock.calls.length;
    type("   ");
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(fetchMock).toHaveBeenCalledTimes(sent);
  });

  it("/ focuses the box from the page, but not while typing in another field", () => {
    render(<><input aria-label="other" /><KanjiSearch /></>);
    fireEvent.keyDown(document.body, { key: "/" });
    expect(box()).toHaveFocus();
    const other = screen.getByRole("textbox", { name: "other" });
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(other).toHaveFocus();
    expect(box()).toHaveAttribute("aria-keyshortcuts", "/");
  });
});
