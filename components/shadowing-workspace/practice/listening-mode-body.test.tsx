import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { attemptBodies, calls, LINES, probe, serve, server, shell, slotList, stubListeningFetch, type AttemptBody, type LineId } from "@/test/listening-body";
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
const place = (text: string) => fireEvent.click(within(bank()).getByRole("button", { name: text }));
const placeAll = (texts: readonly string[]) => texts.forEach(place);

async function open(line: LineId = "line-1") {
  searchParams = new URLSearchParams(`line=${line}`);
  const view = render(shell());
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
  it("shows the bank in bankOrder; a chip fills the first empty slot and a placed chip goes back", async () => {
    await open();
    const shown = bankOrder(4, "line-1").map((i) => LINES["line-1"].display[i]);
    expect(bankTexts()).toEqual(shown);
    expect(screen.getByText("Slot 2 of 4, empty")).toBeInTheDocument();
    place("今日は");
    place("雨です。");
    expect(within(required(slotList())).getByRole("button", { name: "Slot 1 of 4, 今日は" })).toBeInTheDocument();
    expect(within(required(slotList())).getByRole("button", { name: "Slot 2 of 4, 雨です。" })).toBeInTheDocument();
    expect(bankTexts()).toEqual(shown.filter((text) => text !== "今日は" && text !== "雨です。"));
    fireEvent.click(screen.getByRole("button", { name: "Slot 1 of 4, 今日は" }));
    expect(screen.getByText("Slot 1 of 4, empty")).toBeInTheDocument();
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
    expect(screen.getByText("Slot 1 of 4, empty")).toBeInTheDocument();
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
    expect(screen.getByTestId("listen-cover")).toBeInTheDocument();
  });

  it("locks the hinted chunk in its slot and returns the chunk that sat there to the bank once (Review Focus 3)", async () => {
    await open();
    place("でも");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    const hinted = screen.getByRole("button", { name: "Slot 1 of 4, 今日は, hint" });
    expect(hinted).toBeDisabled();
    expect(hinted).toHaveTextContent("Hint");
    expect(bankTexts().filter((text) => text === "でも")).toHaveLength(1);
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
    expect(screen.getByText("Keep practising")).toBeInTheDocument();
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
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(feedback()).toHaveTextContent("You arranged the whole sentence yourself!");
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
    expect(first).toEqual({ attempt: before + 1, subtitle: false, cover: true, filled: 0, typed: null, answer: false, korume: null });
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

  it("Show answer reveals the answer with the hints so far, keeps the video covered, scores nothing and never feeds the retry score", async () => {
    await open();
    placeAll(LINES["line-1"].display);
    fireEvent.click(check());
    expect(await screen.findByTestId("listening-score")).toHaveTextContent("100");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(await screen.findByTestId("listening-answer")).toHaveTextContent(LINES["line-1"].text);
    expect(attemptBodies().at(-1)).toEqual({ kind: "reveal", videoId: "video-1", lineId: "line-1", format: "word_bank", version: 1, textHash: "a".repeat(64), hintedUnits: [0] });
    expect(feedback().textContent).toBe("This sentence is marked for review. This attempt has no score and doesn't count toward today's mission.");
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(screen.getByTestId("listen-cover")).toBeInTheDocument();
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
    await screen.findByText("Slot 2 of 2, empty");
    await act(async () => { resolve(serve(attemptBodies()[0] as AttemptBody)); });
    expect(screen.queryByTestId("listening-score")).toBeNull();
    expect(screen.queryByTestId("listening-answer")).toBeNull();
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    expect(screen.getByText("Slot 1 of 2, empty")).toBeInTheDocument();
  });

  it("Next sentence moves the controller and the new line starts concealed and empty", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    place("今日は");
    fireEvent.click(nextSentence());
    expect(await screen.findByText("Slot 1 of 2, empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sentence 2,/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("listen-cover")).toBeInTheDocument();
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
    expect(await screen.findByText("Slot 1 of 4, empty")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This sentence changed, start again");
    expect(bankTexts()).toHaveLength(4);
  });

  it("moves an unreliable Word Bank line to format=typing by the URL, rendering no practice control until it agrees (D9, P10)", async () => {
    searchParams = new URLSearchParams("line=line-3&mode=x");
    const view = render(shell());
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(router.replace).toHaveBeenCalledWith("/shadowing/video-1/listening?line=line-3&mode=x&format=typing", { scroll: false });
    expect(slotList()).toBeNull();
    expect(screen.queryByRole("list", { name: "Word bank" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
    expect(screen.queryByTestId("listening-unreliable")).toBeNull();
    expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", "word_bank");

    searchParams = new URLSearchParams("line=line-3&mode=x&format=typing");
    view.rerender(shell());
    expect(await screen.findByTestId("listening-unreliable")).toHaveTextContent("This sentence can't be split reliably, so it's Typing only");
    expect(slotList()).toBeNull();
    expect(screen.getByTestId("lesson-stat-strip")).toHaveTextContent("Typing · Submitted");
    await waitFor(() => expect(String(calls("practice-stats").at(-1)?.[0])).toBe("/api/shadowing/video-1/practice-stats?mode=typing"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});

const input = () => screen.getByRole("textbox", { name: "Type what you hear" });
const radio = (name: string) => screen.getByRole("radio", { name });
const metricNames = () => within(required(screen.getByText("Recall").closest("dl"))).getAllByRole("term").map((term) => term.textContent);
const typeInto = (text: string) => fireEvent.change(input(), { target: { value: text } });

async function openTyping(line: LineId) {
  searchParams = new URLSearchParams(`line=${line}&format=typing`);
  const view = render(shell());
  await screen.findByRole("textbox", { name: "Type what you hear" });
  return view;
}

describe("ListeningModeBody — Typing and the format switch", () => {
  it("sends the typed text with the line's hint unit; a hint shows the chunk's raw text and never edits the input", async () => {
    await openTyping("line-4");
    expect(screen.getByRole("radio", { name: "Typing" })).toHaveAttribute("aria-checked", "true");
    typeInto("テスト");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByTestId("typing-hint")).toHaveTextContent("ﾃｽﾄは");
    expect(screen.getByTestId("typing-hint")).not.toHaveTextContent("いいです");
    expect(input()).toHaveValue("テスト");
    expect(feedback()).toHaveTextContent("1 chunk hinted so far. Hinted parts don't count toward recall.");
    expect(feedback().textContent).not.toContain("ﾃｽﾄ");
    fireEvent.click(check());
    await waitFor(() => expect(attemptBodies()).toHaveLength(1));
    expect(attemptBodies()[0]).toEqual({
      kind: "submit", videoId: "video-1", lineId: "line-4", format: "typing", version: 1, textHash: "a".repeat(64),
      input: "テスト", hintUnit: "chunk", hintedUnits: [0],
    });
  });

  it("hints 4 graphemes of the raw line on a grapheme4 line and says part", async () => {
    await openTyping("line-5");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    // Base 砂糖1グラム: the first unit 砂糖1グ is shown as written, 砂糖1㌘ (P13).
    expect(screen.getByTestId("typing-hint")).toHaveTextContent("砂糖1㌘");
    expect(screen.getByTestId("typing-hint")).not.toHaveTextContent("グ");
    expect(feedback()).toHaveTextContent("1 part hinted so far.");
    typeInto("砂糖1グラム");
    fireEvent.click(check());
    await waitFor(() => expect(attemptBodies()).toHaveLength(1));
    expect(attemptBodies()[0]).toMatchObject({ format: "typing", hintUnit: "grapheme4", hintedUnits: [0] });
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

  it("shows Kanji and Grammar only when the line has them, and remarks on one only when it is below Recall", async () => {
    await openTyping("line-2");
    typeInto("今日わ雨です");
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(metricNames()).toEqual(["Recall", "Kanji", "Grammar"]);
    expect(feedback()).toHaveTextContent("Particles and endings 67%, below your recall.");
    expect(feedback()).not.toHaveTextContent("Listen for the kanji words");
  });

  it("never praises a hinted attempt and colours the hinted characters", async () => {
    await openTyping("line-4");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
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
    expect(screen.getByTestId("listen-cover")).toBeInTheDocument();
  });

  it("asks before switching away from typed text: Cancel keeps text and format, Confirm switches", async () => {
    await openTyping("line-4");
    fireEvent.click(radio("Word Bank"));
    expect(router.replace).toHaveBeenCalledTimes(1); // nothing typed yet: no confirm
    expect(screen.queryByRole("dialog")).toBeNull();
    router.replace.mockReset();

    typeInto("テスト");
    fireEvent.click(radio("Word Bank"));
    expect(screen.getByRole("dialog", { name: "Discard this attempt?" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Keep going", { selector: "button" }));
    expect(router.replace).not.toHaveBeenCalled();
    expect(input()).toHaveValue("テスト");
    expect(radio("Typing")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(radio("Word Bank"));
    fireEvent.click(screen.getByRole("button", { name: "Discard and switch" }));
    expect(router.replace).toHaveBeenCalledWith("/shadowing/video-1/listening?line=line-4&format=word_bank", { scroll: false });
  });

  it("asks before switching away from a placed chunk", async () => {
    await open("line-2");
    place("今日は");
    fireEvent.click(radio("Typing"));
    expect(screen.getByRole("dialog", { name: "Discard this attempt?" })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("never carries a reveal across formats: the first commit after the URL change is concealed and empty (P11)", async () => {
    const view = await open("line-2");
    placeAll(LINES["line-2"].display);
    fireEvent.click(check());
    await screen.findByTestId("listening-answer");
    expect(screen.getByTestId("workspace-subtitle")).toBeInTheDocument();
    fireEvent.click(radio("Typing"));
    expect(router.replace).toHaveBeenCalledWith("/shadowing/video-1/listening?line=line-2&format=typing", { scroll: false });

    const before = required(probe.reveal).attempt;
    searchParams = new URLSearchParams("line=line-2&format=typing");
    view.rerender(shell());
    expect(frames.find((frame) => frame.attempt === before + 1)).toEqual({ attempt: before + 1, subtitle: false, cover: true, filled: 0, typed: "", answer: false, korume: null });
    expect(screen.queryByTestId("listening-score")).toBeNull();

    searchParams = new URLSearchParams("line=line-2&format=word_bank");
    view.rerender(shell());
    expect(frames.find((frame) => frame.attempt === before + 2)).toEqual({ attempt: before + 2, subtitle: false, cover: true, filled: 0, typed: null, answer: false, korume: null });
    expect(screen.getByText("Slot 1 of 2, empty")).toBeInTheDocument();
  });

  it("on an unreliable line disables Word Bank with the reason and shows the notice", async () => {
    await openTyping("line-3");
    expect(radio("Word Bank")).toBeDisabled();
    expect(radio("Word Bank")).toHaveAccessibleDescription("This sentence can't be split reliably, so it's Typing only");
    expect(screen.getByTestId("listening-unreliable")).toBeVisible();
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
