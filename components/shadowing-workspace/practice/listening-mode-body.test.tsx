import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { attemptBodies, calls, fetchMock, lesson, LINES, probe, serve, server, shell, slotList, stubListeningFetch, type AttemptBody, type LineId } from "@/test/listening-body";
import type { LineChunks } from "@/lib/dictation/types";
import { bankOrder } from "@/lib/dictation/shuffle";
import { resetTabWritesForTests } from "../workspace-context";

vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: vi.fn() }));
const router = { refresh: vi.fn(), replace: vi.fn() };
let pathname = "/en/shadowing/video-1/listening";
let searchParams = new URLSearchParams("line=line-1");
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
  usePathname: () => pathname.replace(/^\/en/, ""),
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useSearchParams: () => searchParams }));

const { frames } = probe;
const bank = () => screen.getByRole("list", { name: "Word bank" });
const bankTexts = () => within(bank()).getAllByRole("button").map((chip) => chip.textContent);
const check = () => screen.getByRole("button", { name: /^(Check|Checking…)$/ });
const feedback = () => screen.getByTestId("listening-feedback");
const nextSentence = () => within(screen.getByTestId("practice-panel")).getByRole("button", { name: /^Next sentence/ });
/** The pieces placed in the answer, as shown. */
const placedTexts = () => [...required(slotList()).querySelectorAll("[data-piece]")].map((chip) => chip.textContent);
/** A fresh, empty attempt on `line`: every piece in the bank, none placed. */
const expectEmpty = async (line: LineId) => {
  await waitFor(() => expect([...bankTexts()].sort()).toEqual([...LINES[line].display].sort()));
  expect(placedTexts()).toEqual([]);
};
/** From now on the chunks route answers with `change` applied: another chunker version or line text on the server. */
const serveChunksWith = (change: Partial<LineChunks>) => {
  const base = required(fetchMock.getMockImplementation());
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const response = await base(url, init) as Response;
    if (!/\/chunks$/.test(String(url))) return response;
    const { data } = await response.json() as { data: LineChunks };
    return Response.json({ data: { ...data, ...change } });
  });
};
const place = (text: string) => fireEvent.click(within(bank()).getByRole("button", { name: text }));
/** 💡 (spec §3.3): Show answer in Chép chính tả. */
const showAll = () => screen.getByRole("button", { name: /^Show the sentence/ });
const star = (n: number) => screen.getByRole("button", { name: new RegExp(`^Character ${n} of \\d+, `) });
const altH = (target: Element | Document = document.body, init: KeyboardEventInit = {}) => fireEvent.keyDown(target, { key: "h", code: "KeyH", altKey: true, ...init });
const placeAll = (texts: readonly string[]) => texts.forEach(place);

/** Chép chính tả with Chế độ dễ on: the word pieces (spec §3.0, §3.2). */
async function open(line: LineId = "line-1") {
  searchParams = new URLSearchParams(`line=${line}&format=dictation`);
  const view = render(shell());
  fireEvent.click(await screen.findByRole("button", { name: "Easy mode" }));
  await screen.findByRole("list", { name: "Your sentence" });
  return view;
}

let yt: YouTubeStubHandle;
beforeEach(() => {
  yt = installYouTubeStub();
  sessionStorage.clear();
  resetTabWritesForTests();
  router.replace.mockReset();
  frames.length = 0;
  pathname = "/en/shadowing/video-1/listening";
  searchParams = new URLSearchParams("line=line-1");
  stubListeningFetch();
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

describe("ListeningModeBody — Word Bank", () => {
  it("shows the bank in bankOrder; a tap appends a chip and a tap on a placed chip sends it back", async () => {
    await open();
    const shown = bankOrder(4, "line-1").map((i) => LINES["line-1"].display[i]);
    expect(bankTexts()).toEqual(shown);
    expect(placedTexts()).toEqual([]);
    place("今日は");
    place("雨です。");
    expect(within(required(slotList())).getByRole("button", { name: "Slot 1 of 4, 今日は" })).toBeInTheDocument();
    expect(within(required(slotList())).getByRole("button", { name: "Slot 2 of 4, 雨です。" })).toBeInTheDocument();
    expect(bankTexts()).toEqual(shown.filter((text) => text !== "今日は" && text !== "雨です。"));
    fireEvent.click(screen.getByRole("button", { name: "Slot 1 of 4, 今日は" }));
    expect(placedTexts()).toEqual(["雨です。"]);
    expect(bankTexts()).toEqual(shown.filter((text) => text !== "雨です。"));
  });

  it("makes every chip a keyboard button: Enter places, Space returns", async () => {
    const user = userEvent.setup();
    await open();
    const chips = within(bank()).getAllByRole("button");
    expect(chips).toHaveLength(4);
    for (const chip of chips) {
      expect(chip.tagName).toBe("BUTTON");
      expect(chip).not.toHaveAttribute("tabindex", "-1");
    }
    within(bank()).getByRole("button", { name: "でも" }).focus();
    await user.keyboard("{Enter}");
    const placed = screen.getByRole("button", { name: "Slot 1 of 4, でも" });
    placed.focus();
    await user.keyboard(" ");
    expect(placedTexts()).toEqual([]);
    expect(bankTexts()).toContain("でも");
  });

  it("shows the raw display characters, never the normalised form (P13)", async () => {
    await open();
    expect(bankTexts()).toContain("明日は晴れ…");
    expect(document.body.textContent).not.toContain("...");
    place("明日は晴れ…");
    expect(screen.getByRole("button", { name: "Slot 1 of 4, 明日は晴れ…" })).toBeInTheDocument();
  });

  it("enables Check only when every slot is filled and sends the strict Word Bank body", async () => {
    await open();
    placeAll(["今日は", "雨です。", "でも"]);
    expect(check()).toBeDisabled();
    place("明日は晴れ…");
    expect(check()).toBeEnabled();
    fireEvent.click(check());
    await waitFor(() => expect(attemptBodies()).toHaveLength(1));
    expect(attemptBodies()[0]).toEqual({
      kind: "submit", videoId: "video-1", lineId: "line-1", format: "word_bank", version: 1, textHash: "a".repeat(64),
      chunkOrder: [0, 1, 2, 3], hintedUnits: [],
    });
  });

  it("sends one request for two fast Check presses (Review Focus 1)", async () => {
    let resolve: (response: Response) => void = () => undefined;
    server.attempt = () => new Promise((done) => { resolve = done; });
    await open();
    placeAll(LINES["line-1"].display);
    act(() => { check().click(); check().click(); });
    expect(calls("/api/dictation/attempt")).toHaveLength(1);
    expect(check()).toBeDisabled();
    fireEvent.click(check());
    expect(calls("/api/dictation/attempt")).toHaveLength(1);
    await act(async () => { resolve(serve(attemptBodies()[0] as AttemptBody)); });
    await screen.findByTestId("listening-score");
  });

  it("keeps the arrangement, says so and stays concealed when the request fails (Review Focus 2)", async () => {
    server.attempt = () => Promise.reject(new TypeError("offline"));
    await open();
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answer could not be checked. It is kept here, so try again.");
    expect(check()).toBeEnabled();
    LINES["line-1"].display.forEach((text, i) => expect(screen.getByRole("button", { name: `Slot ${i + 1} of 4, ${text}` })).toBeInTheDocument());
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    expect(screen.queryByTestId("listening-answer")).toBeNull();
  });

  it("locks the hinted chunk at the front and keeps every placed chunk exactly once (Review Focus 3)", async () => {
    await open();
    place("でも");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    const hinted = screen.getByRole("button", { name: "Slot 1 of 4, 今日は, hint" });
    expect(hinted).toBeDisabled();
    expect(hinted).toHaveTextContent("Hint");
    expect(placedTexts()).toEqual(["今日はHint", "でも"]);
    expect(bankTexts()).not.toContain("でも");
    expect(bankTexts()).not.toContain("今日は");
    expect(feedback()).toHaveTextContent("1 chunk hinted so far.");
  });

  it("never puts an unhinted chunk's text in the live feedback region while answering", async () => {
    await open("line-2");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    const region = feedback();
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.textContent).toContain("hinted so far");
    expect(region.textContent).not.toContain("雨です。");
    expect(region.textContent).not.toContain("雨");
  });

  it("after a successful Check shows the coloured slots, score, Recall and Slots only, the message, the answer and the subtitle, and refreshes stats", async () => {
    await open();
    const statsBefore = calls("practice-stats").length;
    placeAll(["今日は", "雨です。", "明日は晴れ…", "でも"]);
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("50");
    expect(screen.getByTestId("listening-score")).toHaveTextContent("50%");
    expect(screen.queryByText("Keep practising")).toBeNull(); // the P14 heading carries the verdict
    expect(screen.getByText("Saved to your personal listening memory.")).toBeInTheDocument();
    const results = [...required(slotList()).querySelectorAll("li")].map((slot) => slot.getAttribute("data-result"));
    expect(results).toEqual(["correct", "correct", "wrong", "wrong"]);
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(expect.arrayContaining(["Recall", "Slots"]));
    expect(screen.queryByRole("term", { name: "Kanji" })).toBeNull();
    expect(screen.queryByText("Kanji")).toBeNull();
    expect(screen.queryByText("Grammar")).toBeNull();
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(feedback()).toHaveTextContent("You got 2/4 chunks right. Listen again and watch the order of the 2 chunks still wrong.");
    expect(screen.getByTestId("listening-answer")).toHaveTextContent(LINES["line-1"].text);
    expect(screen.getByTestId("workspace-subtitle")).toHaveTextContent(LINES["line-1"].text);
    expect(calls("practice-stats").length).toBeGreaterThan(statsBefore);
  });

  it("praises a perfect unhinted arrangement and labels it", async () => {
    await open();
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("100");
    expect(screen.queryByText("Excellent")).toBeNull();
    expect(feedback()).toHaveTextContent("You arranged the whole sentence yourself!");
    expect(feedback().querySelector("[data-feedback-heading]")).toHaveTextContent("You arranged the whole sentence yourself!");
  });

  it("Try again restarts concealed in the click's own commit, says the last score, and names a fix only after a new submitted result", async () => {
    await open();
    const shown = bankTexts();
    placeAll(["今日は", "明日は晴れ…", "雨です。", "でも"]); // slots 1, 2, 3 wrong
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("25");
    expect(screen.getByTestId("workspace-subtitle")).toBeInTheDocument();
    const before = required(probe.reveal).attempt;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const first = frames.find((frame) => frame.attempt === before + 1);
    expect(first).toEqual({ attempt: before + 1, subtitle: false, dock: false, filled: 0, typed: null, answer: false, korume: null });
    expect(bankTexts()).toEqual(shown);
    expect(feedback()).toHaveTextContent("New attempt. Your last score on this sentence was 25.");
    expect(feedback()).not.toHaveTextContent("You fixed");

    // A failed Check is not a result: nothing is compared.
    server.attempt = () => Promise.resolve(new Response(null, { status: 500 }));
    placeAll(["今日は", "雨です。", "明日は晴れ…", "でも"]); // slot 1 fixed, 2 and 3 still wrong
    fireEvent.click(check());
    await screen.findByRole("alert");
    expect(feedback()).not.toHaveTextContent("You fixed");

    server.attempt = (body) => Promise.resolve(serve(body));
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("50");
    expect(feedback()).toHaveTextContent("You fixed 1 chunk since your last try.");
  });

  it("no comparison across versions: Word Bank compares only with a result of the same chunker version and line text", async () => {
    await open();
    placeAll(["今日は", "明日は晴れ…", "雨です。", "でも"]); // slots 1, 2, 3 wrong
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("25");
    // The line's text changed on the server: a 409 refetches chunks that carry another hash.
    serveChunksWith({ textHash: "b".repeat(64) });
    server.attempt = () => Promise.resolve(Response.json({ error: "line_changed" }, { status: 409 }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    await waitFor(() => expect(calls("/api/lines/line-1/chunks")).toHaveLength(2));
    await expectEmpty("line-1");
    server.attempt = (body) => Promise.resolve(serve(body));
    placeAll(["今日は", "雨です。", "明日は晴れ…", "でも"]); // against the first result this is 1 fixed (the Try again case)
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("50");
    expect(attemptBodies().at(-1)).toMatchObject({ textHash: "b".repeat(64) });
    expect(feedback()).not.toHaveTextContent("You fixed");
  });

  it("Show answer reveals the answer with the hints so far, scores nothing and never feeds the retry score", async () => {
    await open();
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("100");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    fireEvent.click(showAll());
    expect(await screen.findByTestId("listening-answer")).toHaveTextContent(LINES["line-1"].text);
    expect(attemptBodies().at(-1)).toEqual({ kind: "reveal", videoId: "video-1", lineId: "line-1", format: "word_bank", version: 1, textHash: "a".repeat(64), hintedUnits: [0] });
    expect(feedback().textContent).toBe("This sentence is marked for review. This attempt has no score and doesn't count toward today's mission.");
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(screen.getByTestId("workspace-subtitle")).toHaveTextContent(LINES["line-1"].text);
    LINES["line-1"].display.forEach((text, i) => expect(screen.getByRole("button", { name: `Slot ${i + 1} of 4, ${text}` })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(feedback()).toHaveTextContent("New attempt. Your last score on this sentence was 100.");
  });

  it("drops a response that arrives after the learner moved to the next line", async () => {
    let resolve: (response: Response) => void = () => undefined;
    server.attempt = () => new Promise((done) => { resolve = done; });
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    fireEvent.click(nextSentence());
    await expectEmpty("line-2");
    await act(async () => { resolve(serve(attemptBodies()[0] as AttemptBody)); });
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(screen.queryByTestId("listening-answer")).toBeNull();
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    await expectEmpty("line-2");
  });

  it("Next sentence moves the controller and the new line starts concealed and empty", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    place("今日は");
    fireEvent.click(nextSentence());
    await expectEmpty("line-2");
    expect(screen.getByRole("button", { name: /^Sentence 2,/ })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    // The navigator stays live in Listening (D12).
    expect(screen.getByRole("button", { name: /^Sentence 1,/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("on 409 line_changed says so and restarts on refetched chunks", async () => {
    server.attempt = () => Promise.resolve(Response.json({ error: "line_changed" }, { status: 409 }));
    await open();
    expect(calls("/api/lines/line-1/chunks")).toHaveLength(1);
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent("This sentence changed, start again");
    await waitFor(() => expect(calls("/api/lines/line-1/chunks")).toHaveLength(2));
    await expectEmpty("line-1");
    expect(screen.getByRole("alert")).toHaveTextContent("This sentence changed, start again");
  });

  it("with Chế độ dễ on, an unreliable line is typed with its notice, the URL untouched; the next reliable line has pieces again (D9)", async () => {
    await open("line-2");
    fireEvent.click(nextSentence());
    expect(await screen.findByTestId("listening-unreliable")).toHaveTextContent("This sentence can't be split reliably, so it's Typing only");
    expect(await screen.findByRole("textbox", { name: "Type what you hear" })).toBeInTheDocument();
    expect(slotList()).toBeNull();
    expect(screen.getByRole("button", { name: "Easy mode" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Easy mode" })).toHaveAttribute("aria-pressed", "true");
    typeInto("ABC");
    fireEvent.click(check());
    await waitFor(() => expect(attemptBodies()).toHaveLength(1));
    expect(attemptBodies()[0]).toMatchObject({ lineId: "line-3", format: "typing", hintUnit: "grapheme1" });
    expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", "dictation");
    expect(router.replace).not.toHaveBeenCalled();
    await screen.findByTestId("listening-score");
    fireEvent.click(nextSentence());
    await screen.findByRole("list", { name: "Your sentence" });
    expect(screen.getByRole("button", { name: "Easy mode" })).not.toHaveAttribute("aria-disabled");
  });
});

describe("ListeningModeBody — Figma composition (Task 9c)", () => {
  it("Replay audio seeks the CURRENT sentence's start and plays", async () => {
    await open("line-2");
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = required(yt.players[0]);
    const play = vi.spyOn(player, "playVideo");
    const seek = vi.spyOn(player, "seekTo");
    fireEvent.click(screen.getByRole("button", { name: "Replay audio" }));
    expect(seek.mock.calls.at(-1)?.[0]).toBe(lesson.transcript?.lines[1]?.startTime);
    expect(play).toHaveBeenCalled();
  });

  it("Loop and the 0.75x / 1x buttons drive the shared player state and show it", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const loop = screen.getByRole("button", { name: "Loop" });
    const pressed = loop.getAttribute("aria-pressed");
    fireEvent.click(loop);
    expect(loop).toHaveAttribute("aria-pressed", pressed === "true" ? "false" : "true");
    const slow = screen.getByRole("button", { name: "0.75× speed" });
    const normal = screen.getByRole("button", { name: "1× speed" });
    expect(normal).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(slow);
    expect(slow).toHaveAttribute("aria-pressed", "true");
    expect(normal).toHaveAttribute("aria-pressed", "false");
    expect(required(yt.players[0]).getPlaybackRate()).toBe(0.75);
    fireEvent.click(normal);
    expect(required(yt.players[0]).getPlaybackRate()).toBe(1);
  });

  it("the rate buttons' accessible name contains their visible text in every locale (WCAG 2.5.3)", async () => {
    searchParams = new URLSearchParams("line=line-1&format=dictation");
    render(shell(), { locale: "vi" });
    const slow = (await screen.findByText("0.75×")).closest("button");
    expect(slow).toHaveAccessibleName(expect.stringContaining("0.75×"));
  });

  it("draws the Live Feedback divider only once there is something to show; the live region stays mounted", async () => {
    await open();
    const section = feedback().closest("section");
    expect(section).not.toHaveClass("border-t");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(section).toHaveClass("border-t");
  });

  it("shows no footnote before an attempt is stored, and the remaining count follows the bank", async () => {
    await open();
    expect(screen.queryByText("Saved to your personal listening memory.")).toBeNull();
    expect(screen.getByText("4 words remaining")).toBeInTheDocument();
    place("今日は");
    expect(screen.getByText("3 words remaining")).toBeInTheDocument();
  });

  it("Show answer is stored, so the footnote follows it", async () => {
    await open();
    fireEvent.click(showAll());
    await screen.findByTestId("listening-answer");
    expect(screen.getByText("Saved to your personal listening memory.")).toBeInTheDocument();
  });

  it("renders the 2nd and 3rd P14 messages as tips inside the same live region, the first as the heading", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    placeAll(["雨です。", "でも", "明日は晴れ…"]);
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    const heading = feedback().querySelector("[data-feedback-heading]");
    expect(heading).toHaveTextContent("You got 3/4 chunks right.");
    const tips = feedback().querySelectorAll("[data-feedback-tip]");
    expect(tips).toHaveLength(1);
    expect(tips[0]).toHaveTextContent("1 hinted chunk doesn't count as your own.");
  });

  it("puts the Hint pill in the puzzle header and hides it once answered", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Hint" }).closest("[data-puzzle-header]")).not.toBeNull();
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
  });
});

const input = () => screen.getByRole("textbox", { name: "Type what you hear" });
const easyMode = () => screen.getByRole("button", { name: "Easy mode" });
const metricNames = () => within(required(screen.getByText("Recall").closest("dl"))).getAllByRole("term").map((term) => term.textContent);
const typeInto = (text: string) => fireEvent.change(input(), { target: { value: text } });

async function openTyping(line: LineId) {
  searchParams = new URLSearchParams(`line=${line}&format=dictation`);
  const view = render(shell());
  await screen.findByRole("textbox", { name: "Type what you hear" });
  return view;
}

describe("ListeningModeBody — Typing and Chế độ dễ", () => {
  it("a star reveals one raw character in place, posts nothing, and the submit carries grapheme1 + its unit", async () => {
    await openTyping("line-4");
    expect(easyMode()).toHaveAttribute("aria-pressed", "false");
    typeInto("テスト");
    fireEvent.click(star(5));
    expect(star(5)).toHaveTextContent("い");
    expect(star(5)).toHaveAccessibleName("Character 5 of 8, い");
    expect(screen.getAllByRole("button", { name: /^Character \d+ of 8, hidden$/ })).toHaveLength(7);
    expect(calls("/api/dictation/attempt")).toHaveLength(0);
    expect(input()).toHaveValue("テスト");
    expect(feedback()).toHaveTextContent("1 character hinted so far. Hinted parts don't count toward recall.");
    fireEvent.click(check());
    await waitFor(() => expect(attemptBodies()).toHaveLength(1));
    expect(attemptBodies()[0]).toEqual({
      kind: "submit", videoId: "video-1", lineId: "line-4", format: "typing", version: 1, textHash: "a".repeat(64),
      input: "テスト", hintUnit: "grapheme1", hintedUnits: [4],
    });
  });

  it("a revealed star shows the raw line's character (P13): ㌘ for the グ of 砂糖1グラム", async () => {
    await openTyping("line-5");
    fireEvent.click(star(4));
    expect(star(4)).toHaveTextContent("㌘");
    expect(screen.getByRole("group", { name: "Hidden sentence" }).textContent).not.toContain("グ");
  });

  it("no Hint and no Show answer button in Chép chính tả; 💡 has its tooltip, Alt+H and calls reveal", async () => {
    await openTyping("line-4");
    expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show answer" })).toBeNull();
    expect(showAll()).toHaveAttribute("aria-keyshortcuts", "Alt+H");
    expect(showAll()).toHaveAccessibleName("Show the sentence (Alt+H)");
    fireEvent.click(star(1));
    fireEvent.click(showAll());
    expect(await screen.findByTestId("dictation-sentence")).toHaveTextContent(LINES["line-4"].text);
    expect(screen.queryAllByRole("button", { name: /^Character/ })).toHaveLength(0);
    expect(attemptBodies()).toEqual([{ kind: "reveal", videoId: "video-1", lineId: "line-4", format: "typing", version: 1, textHash: "a".repeat(64), hintUnit: "grapheme1", hintedUnits: [0] }]);
  });

  it("Alt+H from the typing box reveals the sentence once, keeps the text, and moves no sentence or playback", async () => {
    await openTyping("line-4");
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = required(yt.players[0]);
    const seek = vi.spyOn(player, "seekTo");
    typeInto("テスト");
    // An IME composition owns the keys: Alt+H then is the IME's, never 💡.
    altH(input(), { isComposing: true });
    altH(input(), { keyCode: 229 });
    altH(input(), { altKey: false });
    altH(input(), { ctrlKey: true });
    expect(calls("/api/dictation/attempt")).toHaveLength(0);
    altH(input());
    expect(await screen.findByTestId("dictation-sentence")).toHaveTextContent(LINES["line-4"].text);
    expect(attemptBodies()).toEqual([expect.objectContaining({ kind: "reveal", format: "typing", lineId: "line-4" })]);
    expect(input()).toHaveValue("テスト");
    expect(seek).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Sentence 4,/ })).toHaveAttribute("aria-current", "true");
    altH();
    expect(calls("/api/dictation/attempt")).toHaveLength(1);
  });

  it("Alt+H posts nothing in Điền từ (it hints a character there) or on the picker", async () => {
    searchParams = new URLSearchParams("line=line-1&format=cloze");
    const view = render(shell());
    await screen.findByRole("textbox", { name: "Blank 1" });
    altH();
    expect(await screen.findByText("あ")).toBeInTheDocument();
    searchParams = new URLSearchParams("line=line-4");
    view.rerender(shell());
    await screen.findByRole("heading", { name: "How would you like to practise listening?" });
    altH();
    await new Promise((done) => setTimeout(done, 50));
    expect(calls("/api/dictation/attempt")).toHaveLength(0);
    // Positive control: the same key in Chép chính tả does reveal.
    searchParams = new URLSearchParams("line=line-4&format=dictation");
    view.rerender(shell());
    await screen.findByRole("textbox", { name: "Type what you hear" });
    altH();
    await waitFor(() => expect(calls("/api/dictation/attempt")).toHaveLength(1));
  });

  it("Chế độ dễ: word pieces with the mask above them, its stars not buttons; 💡 still reveals; off brings typing back", async () => {
    await open("line-2");
    const mask = screen.getByRole("group", { name: "Hidden sentence" });
    expect(within(mask).queryAllByRole("button")).toHaveLength(0);
    expect(within(mask).getAllByRole("img", { name: /^Character \d+ of 6, hidden$/ })).toHaveLength(6);
    expect(mask.compareDocumentPosition(required(slotList())) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hint" })).toBeInTheDocument(); // WP's piece Hint is the hint here
    fireEvent.click(showAll());
    expect(await screen.findByTestId("dictation-sentence")).toHaveTextContent(LINES["line-2"].text);
    expect(attemptBodies().at(-1)).toMatchObject({ kind: "reveal", format: "word_bank" });
    fireEvent.click(easyMode());
    expect(await screen.findByRole("textbox", { name: "Type what you hear" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Character \d+ of 6, hidden$/ })).toHaveLength(6);
  });

  it("arrows and Space in the input type and move the caret, never the sentence or playback; Enter submits once, never mid-composition (Review Focus 4)", async () => {
    const user = userEvent.setup();
    let resolve: (response: Response) => void = () => undefined;
    server.attempt = () => new Promise((done) => { resolve = done; });
    await openTyping("line-1");
    await waitFor(() => expect(yt.players).toHaveLength(1));
    // Positive control: outside the input the same key does move the sentence.
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("button", { name: /^Sentence 2,/ })).toHaveAttribute("aria-current", "true"));
    await screen.findByRole("textbox", { name: "Type what you hear" });
    const player = required(yt.players[0]);
    const seek = vi.spyOn(player, "seekTo");
    const play = vi.spyOn(player, "playVideo");
    const pause = vi.spyOn(player, "pauseVideo");

    await user.click(input());
    await user.keyboard("あ{ArrowLeft}{ArrowRight} い{ArrowLeft}{ArrowLeft}");
    expect(input()).toHaveValue("あ い");
    expect(seek).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Sentence 2,/ })).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    expect(calls("/api/dictation/attempt")).toHaveLength(0);
    fireEvent.keyDown(input(), { key: "Enter" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(calls("/api/dictation/attempt")).toHaveLength(1);
    await act(async () => { resolve(serve(attemptBodies()[0] as AttemptBody)); });
    await screen.findByTestId("listening-score");
    expect(calls("/api/dictation/attempt")).toHaveLength(1);
  });

  it("after Check shows the raw-character diff, Recall only on a line with no kanji and no grammar ranges from the scorer, and names the wrong characters", async () => {
    await openTyping("line-4");
    typeInto("テストはいいてす");
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("88");
    expect(screen.getByTestId("typing-diff").textContent).toBe("ﾃｽﾄはいいです");
    expect(screen.getByTestId("typing-diff").querySelector("[data-op='wrong']")).toHaveTextContent("で");
    expect(metricNames()).toEqual(["Recall"]);
    expect(screen.queryByText("Saved to your personal listening memory.")).not.toBeNull();
    expect(feedback()).toHaveTextContent("1 wrong, 0 missing, 0 extra. Replay the sentence and listen for で.");
    expect(feedback()).not.toHaveTextContent("Every character");
    expect(screen.getByTestId("listening-answer")).toHaveTextContent("ﾃｽﾄはいいです？");
    expect(screen.getByTestId("workspace-subtitle")).toBeInTheDocument();

    // Try again, then a better submitted result: the fewer-errors line appears only now.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(input()).toHaveValue("");
    expect(feedback()).not.toHaveTextContent("fewer");
    typeInto("テストはいいです");
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("100");
    expect(feedback()).toHaveTextContent("Every character written from memory.");
    expect(feedback()).toHaveTextContent("1 fewer character error than your last try.");
  });

  it("no comparison across versions: Typing names fewer errors only against a result of the same chunker version", async () => {
    await openTyping("line-4");
    typeInto("テストはいいてす");
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("88");
    serveChunksWith({ version: 2 });
    server.attempt = () => Promise.resolve(Response.json({ error: "line_changed" }, { status: 409 }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    typeInto("テスト");
    fireEvent.click(check());
    await waitFor(() => expect(calls("/api/lines/line-4/chunks")).toHaveLength(2));
    await waitFor(() => expect(input()).toHaveValue(""));
    server.attempt = (body) => Promise.resolve(serve(body));
    typeInto("テストはいいです");
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("100");
    expect(attemptBodies().at(-1)).toMatchObject({ version: 2 });
    expect(feedback()).toHaveTextContent("Every character written from memory.");
    expect(feedback()).not.toHaveTextContent("fewer");
  });

  it("shows Kanji and Grammar only when the line has them, and remarks on one only when it is below Recall", async () => {
    await openTyping("line-2");
    typeInto("今日わ雨です");
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(metricNames()).toEqual(["Grammar", "Kanji", "Recall"]); // the frame's order
    expect(feedback()).toHaveTextContent("Particles and endings 67%, below your recall.");
    expect(feedback()).not.toHaveTextContent("Listen for the kanji words");
  });

  it("never praises a hinted attempt and colours the hinted characters", async () => {
    await openTyping("line-4");
    for (const n of [1, 2, 3, 4]) fireEvent.click(star(n));
    typeInto("テストはいいです");
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(screen.getByTestId("typing-diff").querySelectorAll("[data-op='hinted']")).toHaveLength(4);
    expect(feedback()).toHaveTextContent("4 hinted characters don't count toward recall.");
    expect(feedback()).not.toHaveTextContent("Every character written from memory.");
  });

  it("keeps the typed text and stays concealed when the submit fails (Review Focus 2)", async () => {
    server.attempt = () => Promise.resolve(new Response(null, { status: 500 }));
    await openTyping("line-4");
    typeInto("テスト");
    fireEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answer could not be checked. It is kept here, so try again.");
    expect(input()).toHaveValue("テスト");
    expect(check()).toBeEnabled();
    expect(screen.queryByTestId("listening-answer")).toBeNull();
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
  });

  it("never carries a reveal across a Chế độ dễ toggle: the first commit after it is concealed and empty, URL untouched (P11)", async () => {
    await open("line-2");
    placeAll(LINES["line-2"].display);
    fireEvent.click(check());
    await screen.findByTestId("listening-answer");
    expect(screen.getByTestId("workspace-subtitle")).toBeInTheDocument();

    const before = required(probe.reveal).attempt;
    fireEvent.click(easyMode());
    expect(frames.find((frame) => frame.attempt === before + 1)).toEqual({ attempt: before + 1, subtitle: false, dock: false, filled: 0, typed: "", answer: false, korume: null });
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(input()).toHaveValue("");

    fireEvent.click(easyMode());
    expect(frames.find((frame) => frame.attempt === before + 2)).toEqual({ attempt: before + 2, subtitle: false, dock: false, filled: 0, typed: null, answer: false, korume: null });
    await expectEmpty("line-2");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("on an unreliable line Chế độ dễ is unavailable with the reason and the notice shows", async () => {
    await openTyping("line-3");
    expect(easyMode()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(easyMode());
    expect(easyMode()).toHaveAttribute("aria-pressed", "false");
    expect(input()).toBeInTheDocument();
    expect(screen.getByTestId("listening-unreliable")).toBeVisible();
  });
});

describe("ListeningModeBody — picker and URL (spec §3.0)", () => {
  const panel = () => screen.queryByTestId("practice-panel");
  async function entry(query: string) {
    searchParams = new URLSearchParams(query);
    const view = render(shell());
    await waitFor(() => expect(yt.players).toHaveLength(1));
    return view;
  }

  it.each(["line=line-1", "line=line-1&format=nope"])("no or an unknown format shows the picker (%s)", async (query) => {
    await entry(query);
    expect(screen.getByRole("heading", { name: "How would you like to practise listening?" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(Dictation|Fill in the blanks)/ })).toHaveLength(2);
    expect(panel()).toBeNull();
    expect(screen.queryByTestId("lesson-stat-strip")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(calls("/chunks")).toHaveLength(0);
  });

  it.each([
    ["Dictation", "dictation"],
    ["Fill in the blanks", "cloze"],
  ] as const)("choosing %s replaces the URL with its format, keeping the other params", async (name, format) => {
    await entry("line=line-2&mode=x");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
    expect(router.replace).toHaveBeenCalledWith(`/shadowing/video-1/listening?line=line-2&mode=x&format=${format}`, { scroll: false });
  });

  it("format=dictation opens the exercise directly: its name, Change exercise and the typing panel", async () => {
    await entry("line=line-1&format=dictation");
    expect(await screen.findByRole("textbox", { name: "Type what you hear" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dictation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "How would you like to practise listening?" })).toBeNull();
    expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", "dictation");
  });

  it("format=cloze opens Fill in the blanks with its panel, reading the cloze route, never the chunks", async () => {
    await entry("line=line-1&format=cloze");
    expect(screen.getByRole("heading", { name: "Fill in the blanks" })).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "Blank 1" })).toBeInTheDocument();
    expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", "cloze");
    expect(calls("/api/lines/line-1/cloze")).toHaveLength(1);
    expect(calls("/chunks")).toHaveLength(0);
  });

  it.each([
    ["typing", "false"],
    ["word_bank", "true"],
  ] as const)("format=%s maps to dictation by a URL replace (Chế độ dễ %s), with no practice control until the URL agrees", async (legacy, easy) => {
    const view = await entry(`line=line-1&format=${legacy}&mode=x`);
    expect(router.replace).toHaveBeenCalledWith("/shadowing/video-1/listening?line=line-1&format=dictation&mode=x", { scroll: false });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(slotList()).toBeNull();
    expect(calls("/chunks")).toHaveLength(0);
    searchParams = new URLSearchParams("line=line-1&format=dictation&mode=x");
    view.rerender(shell());
    expect(screen.getByRole("button", { name: "Easy mode" })).toHaveAttribute("aria-pressed", easy);
    if (easy === "true") await screen.findByRole("list", { name: "Your sentence" });
    else await screen.findByRole("textbox", { name: "Type what you hear" });
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("Change exercise removes format, keeping the other params", async () => {
    await entry("line=line-2&format=dictation");
    fireEvent.click(screen.getByRole("button", { name: "Change exercise" }));
    expect(router.replace).toHaveBeenCalledWith("/shadowing/video-1/listening?line=line-2", { scroll: false });
  });

  it("late response after Change exercise: the row is saved, but no result on the picker or back in the exercise (Review Focus 3)", async () => {
    let resolve: (response: Response) => void = () => undefined;
    server.attempt = () => new Promise((done) => { resolve = done; });
    const view = await open();
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    const dictationStats = () => calls("practice-stats?mode=dictation").length;
    await waitFor(() => expect(dictationStats()).toBe(1)); // the strip's read
    fireEvent.click(screen.getByRole("button", { name: "Change exercise" }));
    searchParams = new URLSearchParams("line=line-1");
    view.rerender(shell());
    expect(screen.getByRole("heading", { name: "How would you like to practise listening?" })).toBeInTheDocument();
    await waitFor(() => expect(dictationStats()).toBe(2)); // the picker's own progress read
    await act(async () => { resolve(serve(attemptBodies()[0] as AttemptBody)); });
    // The saved row reaches the stats on their next read (back in the exercise, below); the stale refresh is a no-op,
    // so it can never abort or overwrite another exercise's strip.
    expect(dictationStats()).toBe(2);
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    searchParams = new URLSearchParams("line=line-1&format=dictation");
    view.rerender(shell());
    await expectEmpty("line-1");
    await waitFor(() => expect(dictationStats()).toBe(3));
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(screen.queryByTestId("listening-answer")).toBeNull();
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
  });

  it("the sentence counter appears once, in the workspace header, with the video shown or hidden (spec §3.1)", async () => {
    await entry("line=line-2&format=dictation");
    const counters = () => screen.getAllByText(/Sentence 2 ?\/ ?5/);
    expect(screen.getByTestId("lesson-stat-strip")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide video" }));
    expect(screen.queryByTestId("lesson-stat-strip")).toBeNull();
    expect(counters()).toHaveLength(1);
    expect(counters()[0]).toHaveTextContent("Sentence 2 / 5");
  });
});

describe("ListeningModeBody — the listen-only dock (Ruling T1)", () => {
  const dock = () => required(document.querySelector<HTMLElement>("[data-listen-dock]"));
  const practicePanel = () => screen.getByTestId("practice-panel");
  const hideVideo = () => within(practicePanel()).getByRole("button", { name: "Hide video" });

  it("listen-only renders the dock with Nghe lại câu and without the ReplayRow in the panel", async () => {
    await open("line-2");
    await waitFor(() => expect(yt.players).toHaveLength(1));
    // Video visible: the ReplayRow sits in the panel, there is no dock.
    expect(within(practicePanel()).getByRole("button", { name: "Replay audio" })).toBeInTheDocument();
    expect(within(practicePanel()).getByRole("button", { name: "Loop" })).toBeInTheDocument();
    expect(document.querySelector("[data-listen-dock]")).toBeNull();
    fireEvent.click(hideVideo());
    expect(within(practicePanel()).queryByRole("button", { name: "Replay audio" })).toBeNull();
    expect(within(practicePanel()).queryByRole("button", { name: "Loop" })).toBeNull();
    expect(within(practicePanel()).queryByRole("button", { name: "1× speed" })).toBeNull();
    const replay = within(dock()).getByRole("button", { name: "Replay audio" });
    for (const name of ["Loop", "0.75× speed", "1× speed", "Previous sentence", "Play", "Next sentence", "Mute", "Show video"]) {
      expect(within(dock()).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(dock()).getByRole("slider", { name: "Seek" })).toBeInTheDocument();
    // The same handlers as the panel's row: Replay audio seeks the current sentence and plays.
    const player = required(yt.players[0]);
    const seek = vi.spyOn(player, "seekTo");
    fireEvent.click(replay);
    expect(seek.mock.calls.at(-1)?.[0]).toBe(lesson.transcript?.lines[1]?.startTime);
    // One player: the iframe stays mounted, never display:none, inside a collapsed, hidden box.
    expect(yt.players).toHaveLength(1);
    const video = required(document.querySelector<HTMLElement>("[data-workspace-player-video]"));
    expect(video.closest(".invisible.h-0")).not.toBeNull();
    for (let node: HTMLElement | null = video; node; node = node.parentElement) expect(node.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("dock has no fullscreen, CC, -5s, loop-count or speed popover", async () => {
    // jsdom has no Fullscreen API: claim it, so the normal bar's fullscreen button is a real positive control.
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    onTestFinished(() => { delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled; });
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    // Positive control: the normal bar has each of them.
    const player = screen.getByRole("region", { name: "Player" });
    for (const name of ["Player fullscreen", "Hide subtitles", "Back 5 seconds", "Sentence loop"]) expect(within(player).getByRole("button", { name })).toBeInTheDocument();
    expect(within(player).getByRole("button", { name: /^Playback speed/ })).toBeInTheDocument();
    fireEvent.click(hideVideo());
    for (const name of ["Player fullscreen", "Hide subtitles", "Show subtitles", "Back 5 seconds", "Sentence loop"]) expect(within(player).queryByRole("button", { name })).toBeNull();
    expect(within(player).queryByRole("button", { name: /^Playback speed/ })).toBeNull();
    // No overlay, no idle hide: the dock's row is plain flow, never the auto-hiding grid of the normal bar.
    expect(player.querySelector("[data-workspace-player-controls]")).toBeNull();
    expect(dock().querySelector("[class*='grid-rows']")).toBeNull();
    // The progress fill steps down to a neutral; the normal bar keeps the accent.
    expect(within(dock()).getByRole("slider", { name: "Seek" })).toHaveClass("accent-muted-foreground");
    expect(within(dock()).getByTestId("playback-clock")).toHaveTextContent(/^\d+:\d{2} \/ 0:30$/);
  });

  it("Hiện video in the dock turns listenOnly off and the toolbar's Ẩn video aria-pressed follows", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(hideVideo());
    expect(hideVideo()).toHaveAttribute("aria-pressed", "true");
    const show = within(dock()).getByRole("button", { name: "Show video" });
    expect(show).not.toHaveAttribute("aria-pressed");
    show.focus();
    fireEvent.click(show);
    expect(document.querySelector("[data-listen-dock]")).toBeNull();
    expect(hideVideo()).toHaveAttribute("aria-pressed", "false");
    expect(required(probe.reveal).listenOnly).toBe(false);
    // The pressed button unmounts with the dock; focus stays in the player instead of falling to the page.
    await waitFor(() => expect(document.activeElement).toBe(within(required(document.querySelector<HTMLElement>("[data-workspace-player-controls]"))).getByRole("button", { name: "Play" })));
    expect(yt.players).toHaveLength(1);
  });

  it("Focus Mode undocks the player: no empty workspace under a dock, and leaving Focus docks it again", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(hideVideo());
    expect(document.querySelector("[data-listen-dock]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Focus Mode" }));
    expect(document.querySelector("[data-listen-dock]")).toBeNull();
    expect(required(document.querySelector<HTMLElement>("[data-workspace-player-video]")).closest(".invisible")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Focus Mode" }));
    expect(document.querySelector("[data-listen-dock]")).not.toBeNull();
    expect(yt.players).toHaveLength(1);
    await expectEmpty("line-1"); // the remounted panel's chunk read settles inside the test
  });

  it("listen-only survives Next and Try again, and turning it off stays off", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(hideVideo());
    fireEvent.click(nextSentence());
    await expectEmpty("line-2");
    expect(document.querySelector("[data-listen-dock]")).not.toBeNull();
    placeAll(LINES["line-2"].display);
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(document.querySelector("[data-listen-dock]")).not.toBeNull();
    fireEvent.click(within(dock()).getByRole("button", { name: "Show video" }));
    fireEvent.click(nextSentence());
    await screen.findByTestId("listening-unreliable"); // line-3
    expect(document.querySelector("[data-listen-dock]")).toBeNull();
    expect(hideVideo()).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ListeningModeBody — Điền từ (spec §3.4)", () => {
  const blank = (n: number) => screen.getByRole("textbox", { name: `Blank ${n}` });
  const fill = (n: number, value: string) => fireEvent.change(blank(n), { target: { value } });
  const bulb = () => screen.getByRole("button", { name: "Hint (Alt+H)" });
  const verdicts = () => [...document.querySelectorAll("[data-blank-answer]")].map((el) => el.getAttribute("data-blank-answer"));
  const HEAD = { videoId: "video-1", format: "cloze", version: 1, textHash: "c".repeat(64) };
  async function openCloze(line: LineId) {
    searchParams = new URLSearchParams(`line=${line}&format=cloze`);
    const view = render(shell());
    await screen.findByRole("textbox", { name: "Blank 1" });
    return view;
  }

  it("fill and check: no blank's surface or reading before Check; the strict cloze body; then per-blank results", async () => {
    await openCloze("line-1");
    const panelHtml = screen.getByTestId("practice-panel").innerHTML;
    for (const text of ["雨", "明日", "あめ", "あした", "___"]) expect(panelHtml).not.toContain(text);
    expect(screen.getAllByRole("textbox").map((el) => el.getAttribute("aria-label"))).toEqual(["Blank 1", "Blank 2"]);
    expect(check()).toBeDisabled();
    fill(1, "あめ");
    expect(check()).toBeDisabled();
    fill(2, "あさ");
    fireEvent.click(check());
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(attemptBodies()).toEqual([{ kind: "submit", ...HEAD, lineId: "line-1", hintedUnits: [], blanks: [2, 6], answers: ["あめ", "あさ"], easy: false }]);
    expect(verdicts()).toEqual(["correct", "wrong"]);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Hint (Alt+H)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show answer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("💡 / Alt+H gives the next kana of the lowest unfinished blank, read-only; posts nothing; Check carries the flat indices", async () => {
    await openCloze("line-1");
    expect(bulb()).toHaveAttribute("aria-keyshortcuts", "Alt+H");
    fill(1, "あお");
    fill(2, "あさ");
    expect(bulb()).toBeDisabled(); // every blank holds the learner's answer: nothing left to hint
    altH(blank(1));
    expect(blank(1)).not.toHaveAccessibleDescription();
    fill(2, "");
    altH(blank(1), { isComposing: true });
    altH(blank(1), { keyCode: 229 });
    altH(blank(1), { ctrlKey: true });
    altH(blank(1), { repeat: true });
    expect(blank(2)).not.toHaveAccessibleDescription();
    altH(blank(1));
    expect(blank(1)).toHaveValue("あお"); // 💡 never overwrites a typed answer: it hints the lowest untouched blank
    expect(blank(1)).not.toHaveAccessibleDescription();
    expect(blank(2)).toHaveAccessibleDescription("Hint: あ");
    fill(1, "");
    fireEvent.click(bulb());
    expect(blank(1)).toHaveAccessibleDescription("Hint: あ");
    altH();
    expect(blank(1)).toHaveAccessibleDescription("Hint: あめ");
    expect(blank(1)).toHaveValue("");
    expect(feedback()).toHaveTextContent("3 characters hinted so far.");
    expect(calls("/api/dictation/attempt")).toHaveLength(0);
    expect(check()).toBeEnabled(); // a hinted prefix is text
    fill(2, "した");
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(attemptBodies()).toEqual([{ kind: "submit", ...HEAD, lineId: "line-1", hintedUnits: [2, 0, 1], blanks: [2, 6], answers: ["あめ", "あした"], easy: false }]);
    expect(verdicts()).toEqual(["hinted", "hinted"]);
  });

  it("the Typing-only notice stays in Chép chính tả: switching to Điền từ on the same unreliable line drops it", async () => {
    searchParams = new URLSearchParams("line=line-3&format=dictation");
    const view = render(shell());
    expect(await screen.findByTestId("listening-unreliable")).toBeVisible();
    searchParams = new URLSearchParams("line=line-3&format=cloze");
    view.rerender(shell());
    await screen.findByText("This sentence has no word to fill");
    expect(screen.queryByTestId("listening-unreliable")).toBeNull();
  });

  it("Chế độ dễ: a chip fills the first empty blank and latches easy: true, even after the chip is returned and easy is off", async () => {
    await openCloze("line-1");
    fireEvent.click(easyMode());
    const chips = () => within(screen.getByRole("list", { name: "Word bank" }));
    expect(chips().getAllByRole("button").map((chip) => chip.textContent).sort()).toEqual(["明日", "雨"].sort());
    fireEvent.click(chips().getByRole("button", { name: "雨" }));
    fireEvent.click(screen.getByRole("button", { name: "Blank 1, 雨" }));
    expect(blank(1)).toHaveValue("");
    fireEvent.click(easyMode());
    expect(screen.queryByRole("list", { name: "Word bank" })).toBeNull();
    fill(1, "あめ");
    fill(2, "あした");
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(attemptBodies()).toEqual([expect.objectContaining({ kind: "submit", answers: ["あめ", "あした"], easy: true })]);
  });

  it("👁 Show answer posts the cloze reveal and fills every blank with its surface", async () => {
    await openCloze("line-1");
    altH();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByTestId("listening-answer");
    expect(attemptBodies()).toEqual([{ kind: "reveal", ...HEAD, lineId: "line-1", hintedUnits: [0], blanks: [2, 6], easy: false }]);
    expect([...document.querySelectorAll("[data-blank-answer]")].map((el) => el.textContent)).toEqual(["雨", "明日"]);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(feedback()).toHaveTextContent("This sentence is marked for review.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("a line with no candidate: the notice and Next sentence; no blank, Check, 💡 or 👁; Alt+H posts nothing", async () => {
    searchParams = new URLSearchParams("line=line-3&format=cloze");
    render(shell());
    expect(await screen.findByText("This sentence has no word to fill")).toBeInTheDocument();
    expect(nextSentence()).toBeEnabled();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^(Check|Hint \(Alt\+H\)|Show answer)$/ })).toBeNull();
    altH();
    await new Promise((done) => setTimeout(done, 50));
    expect(calls("/api/dictation/attempt")).toHaveLength(0);
  });

  it("changing line mid-attempt discards it (D12): back on the line, the blanks and hints are empty", async () => {
    await openCloze("line-1");
    fill(1, "あめ");
    altH();
    fireEvent.click(nextSentence());
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Blank 2" })).toBeNull()); // line-2 has one blank
    expect(blank(1)).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /^Sentence 1,/ }));
    await screen.findByRole("textbox", { name: "Blank 2" });
    expect(blank(1)).toHaveValue("");
    expect(blank(1)).not.toHaveAccessibleDescription();
  });

  it("a failed cloze read says so and Retry reads it again", async () => {
    const base = required(fetchMock.getMockImplementation());
    let fail = true;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => fail && /\/cloze$/.test(String(url)) ? Promise.resolve(new Response(null, { status: 500 })) : base(url, init));
    searchParams = new URLSearchParams("line=line-1&format=cloze");
    render(shell());
    expect(await screen.findByText("This sentence could not be loaded.")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("textbox", { name: "Blank 1" })).toBeInTheDocument();
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
