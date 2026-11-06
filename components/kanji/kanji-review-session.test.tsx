import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { KanjiReviewCard } from "@/lib/data/kanji-review";
import { GRADES } from "@/components/learning/review-session";
import { KanjiReviewSession } from "./kanji-review-session";

const presence = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: presence }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: forwardRef<HTMLAnchorElement, React.ComponentProps<"a"> & { scroll?: boolean }>(function Link({ children, scroll, ...props }, ref) {
    return <a ref={ref} data-scroll={scroll} {...props}>{children}</a>;
  }),
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/kanji/review",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("level=N5") }));

const NICHI: KanjiReviewCard = { literal: "日", hanViet: ["Nhật"], meaningsEn: ["day", "sun", "Japan"], meaningVi: "ngày", on: ["ニチ", "ジツ"], kun: ["ひ", "-び"], level: "N5", isNew: false };
const GAKU: KanjiReviewCard = { literal: "学", hanViet: ["Học"], meaningsEn: ["study"], meaningVi: null, on: ["ガク"], kun: ["まな.ぶ"], level: "N5", isNew: true };
const CARDS = [NICHI, GAKU];

const show = (cards = CARDS, streak: number | null = 7) =>
  render(<KanjiReviewSession cards={cards} deckLabel="JLPT N5" streak={streak} backHref="/kanji?level=N5" />);
const grade = (name: RegExp) => screen.getByRole("button", { name });

let calls: { url: string; body: unknown }[];
function mockFetch(...oks: boolean[]) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const ok = oks.shift() ?? true;
    return { ok, status: ok ? 200 : 500, json: async () => ({}) } as Response;
  }));
}

beforeEach(() => { mockFetch(); push.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe("KanjiReviewSession", () => {
  it("vocab's grade map is the one it rates with (SM-2 quality 1/3/4/5 on keys 1–4)", () => {
    expect(GRADES.map((g) => [g.labelKey, g.quality, g.key])).toEqual([["again", 1, "1"], ["hard", 3, "2"], ["good", 4, "3"], ["easy", 5, "4"]]);
  });

  it("props survive the RSC boundary as plain data", () => {
    const props = { cards: CARDS, deckLabel: "JLPT N5", streak: 7, backHref: "/kanji?level=N5" };
    expect(structuredClone(props)).toEqual(props);
  });

  it("pre-reveal: the glyph and the bar's n / N, the rating row disabled, no answer shown", () => {
    show();
    expect(presence).toHaveBeenCalledWith({ surface: "srs_review", contextId: "kanji" });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("日")).toBeInTheDocument();
    for (const name of [/^Again/, /^Hard/, /^Good/, /^Easy/]) expect(grade(name)).toBeDisabled();
    expect(screen.queryByText("Nhật")).not.toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Exit study/ })).toHaveAttribute("href", "/kanji");
  });

  it("keys 1–4 do nothing before the reveal", () => {
    show();
    fireEvent.keyDown(window, { key: "3" });
    expect(calls).toHaveLength(0);
  });

  it("Space reveals Hán Việt, English, on/kun, the curated Vietnamese and Xem chi tiết; the rating row enables", () => {
    show();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("Nhật")).toBeInTheDocument();
    expect(screen.getByText("day, sun, Japan")).toBeInTheDocument();
    expect(screen.getByText("ニチ、ジツ")).toBeInTheDocument();
    expect(screen.getByText("ひ、-び")).toBeInTheDocument();
    expect(screen.getByText("ngày")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See details" })).toHaveAttribute("href", "/kanji/review?level=N5&kanji=%E6%97%A5");
    for (const name of [/^Again/, /^Hard/, /^Good/, /^Easy/]) expect(grade(name)).toBeEnabled();
    expect(screen.getByRole("link", { name: "See details" })).toHaveFocus(); // never a rating button: a 2nd Space must not rate
  });

  it("`3` after the reveal posts quality 4 for the literal and moves to the next card", async () => {
    show();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "3" });
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
    expect(calls).toEqual([{ url: "/api/srs/review", body: { itemType: "kanji", itemId: "日", quality: 4 } }]);
    expect(screen.getByText("学")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(grade(/^Good/)).toBeDisabled();
  });

  it("two rating keys in one tick POST the card once and advance one card", async () => {
    show();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "3" });
    fireEvent.keyDown(window, { key: "4" });
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
    expect(calls).toHaveLength(1);
  });

  it("a held key (auto-repeat) is ignored: holding Esc does not push again and again", () => {
    show();
    fireEvent.keyDown(window, { key: "Escape", repeat: true });
    fireEvent.keyDown(window, { key: " ", repeat: true });
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText("Nhật")).not.toBeInTheDocument();
  });

  it("the footer counts the session down and shows the day streak", async () => {
    show();
    const footer = document.querySelector("footer") as HTMLElement;
    expect(footer).toHaveTextContent("0% complete");
    expect(footer).toHaveTextContent("2 cards remaining");
    expect(footer).toHaveTextContent("7 day streak");
    await userEvent.click(screen.getByRole("button", { name: /Reveal meaning/ }));
    await userEvent.click(grade(/^Good/));
    await waitFor(() => expect(footer).toHaveTextContent("50% complete"));
    expect(footer).toHaveTextContent("1 card remaining");
  });

  it("no streak (it failed to load) → no streak line, never a made-up 0", () => {
    show(CARDS, null);
    expect(document.querySelector("footer")).not.toHaveTextContent("streak");
  });

  it("a failed save keeps the card, says so, and Retry sends the same rating again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetch(false, true);
    show();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "1" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your rating wasn't saved.");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    await waitFor(() => expect(within(alert).getByRole("button", { name: "Try again" })).toHaveFocus()); // not body
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
    expect(calls.map((c) => c.body)).toEqual([
      { itemType: "kanji", itemId: "日", quality: 1 },
      { itemType: "kanji", itemId: "日", quality: 1 },
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("end of deck: reviewed and again counts, the session's kanji open the inspect, ways on", async () => {
    show();
    for (const key of ["1", "4"]) {
      fireEvent.keyDown(window, { key: " " });
      fireEvent.keyDown(window, { key });
      await waitFor(() => expect(calls.length).toBe(key === "1" ? 1 : 2));
    }
    const end = await screen.findByRole("region", { name: "Deck complete" });
    expect(within(end).getByText("2", { selector: "dd" })).toBeInTheDocument();
    expect(within(end).getByText("1", { selector: "dd" })).toBeInTheDocument();
    expect(within(end).getByRole("link", { name: "Back to Kanji" })).toHaveAttribute("href", "/kanji?level=N5");
    expect(within(end).getByRole("link", { name: /日/ })).toHaveAttribute("href", "/kanji/review?level=N5&kanji=%E6%97%A5");
    expect(within(end).getByRole("link", { name: /日/ })).toHaveAccessibleName("日, rated Again");
    expect(within(end).getByRole("link", { name: /学/ })).toHaveAccessibleName("学");
    expect(within(end).getByRole("link", { name: "Kanji library" })).toHaveAttribute("href", "/kanji");
    expect(within(end).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("heading", { name: "Deck complete" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "3" });
    expect(calls).toHaveLength(2);
  });

  it("an empty deck is the end state at once, with the levels to learn from", () => {
    show([]);
    const end = screen.getByRole("region", { name: "Nothing to review right now" });
    expect(within(end).getByRole("link", { name: "N3" })).toHaveAttribute("href", "/kanji?level=N3");
    expect(within(end).getByRole("link", { name: "Back to Kanji" })).toHaveAttribute("href", "/kanji?level=N5");
    expect(screen.queryByRole("button", { name: /Reveal meaning/ })).not.toBeInTheDocument();
    // No session to count down: the footer keeps only the streak.
    expect(document.querySelector("footer")).toHaveTextContent(/^7 day streak$/);
  });

  it("Esc leaves for /kanji; keys inside a dialog (the inspect modal) are not the session's", () => {
    show();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inside = document.createElement("button");
    dialog.append(inside);
    document.body.append(dialog);
    fireEvent.keyDown(inside, { key: " " });
    fireEvent.keyDown(inside, { key: "Escape" });
    expect(screen.queryByText("Nhật")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    dialog.remove();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/kanji");
  });

  it("the deck is fixed for the session: a new `cards` prop (the server re-renders on ?kanji=) does not reshuffle it", async () => {
    const { rerender } = show();
    rerender(<KanjiReviewSession cards={[GAKU]} deckLabel="JLPT N5" streak={7} backHref="/kanji?level=N5" />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("日")).toBeInTheDocument();
  });
});
