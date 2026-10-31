import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { lesson, shell, stubListeningFetch, TRANSLATIONS, type LineId } from "@/test/listening-body";
import { resetTabWritesForTests } from "../workspace-context";

vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: vi.fn() }));
let searchParams = new URLSearchParams("line=line-1");
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shadowing/video-1/listening",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1/listening", useSearchParams: () => searchParams }));

const TRANSLATION = TRANSLATIONS["line-1"] ?? "";
const toggle = (name: "Sentence audio" | "Translation" | "Romaji") => screen.getByRole("button", { name });
const check = () => screen.getByRole("button", { name: /^(Check|Checking…)$/ });
const nextSentence = () => within(screen.getByTestId("practice-panel")).getByRole("button", { name: /^Next sentence/ });

async function openAt(format: "dictation" | "cloze", line: LineId = "line-1") {
  searchParams = new URLSearchParams(`line=${line}&format=${format}`);
  render(shell());
  await screen.findByRole("textbox", { name: format === "cloze" ? "Blank 1" : "Type what you hear" });
}

let yt: YouTubeStubHandle;
beforeEach(() => {
  yt = installYouTubeStub();
  sessionStorage.clear();
  resetTabWritesForTests();
  stubListeningFetch();
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

describe("ListeningCardToggleButtons and ListeningCardSurfaces (spec §3.5, D4; A3 §3.6)", () => {
  it("🔊 plays the current sentence once from its start: seekToSentence(index, { play: true })", async () => {
    await openAt("cloze", "line-2");
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = required(yt.players[0]);
    const seek = vi.spyOn(player, "seekTo");
    const play = vi.spyOn(player, "playVideo");
    fireEvent.click(toggle("Sentence audio"));
    expect(seek.mock.calls.at(-1)?.[0]).toBe(lesson.transcript?.lines[1]?.startTime);
    expect(play).toHaveBeenCalled();
    expect(toggle("Sentence audio")).not.toHaveAttribute("aria-pressed");
  });

  it("hides Translation on a line without one; shows it under the sentence on a line with one", async () => {
    await openAt("cloze", "line-2");
    expect(screen.queryByRole("button", { name: "Translation" })).toBeNull();
    expect(toggle("Romaji")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Sentence 1,/ }));
    await screen.findByRole("textbox", { name: "Blank 2" });
    expect(toggle("Translation")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle("Translation"));
    expect(toggle("Translation")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("listening-translation")).toHaveTextContent(TRANSLATION);
  });

  it("in Chép chính tả translation and romaji are unavailable and absent from the DOM until Check", async () => {
    await openAt("dictation");
    for (const name of ["Translation", "Romaji"] as const) {
      expect(toggle(name)).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(toggle(name));
      expect(toggle(name)).toHaveAttribute("aria-pressed", "false");
    }
    const html = document.body.innerHTML;
    expect(html).not.toContain(TRANSLATION);
    expect(html).not.toContain("romaji of line-1");
    expect(screen.queryByTestId("listening-translation")).toBeNull();
    expect(screen.queryByTestId("listening-romaji")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Type what you hear" }), { target: { value: "今日は" } });
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    for (const name of ["Translation", "Romaji"] as const) {
      expect(toggle(name)).not.toHaveAttribute("aria-disabled");
      fireEvent.click(toggle(name));
    }
    expect(screen.getByTestId("listening-translation")).toHaveTextContent(TRANSLATION);
    expect(screen.getByTestId("listening-romaji")).toHaveTextContent("romaji of line-1");
  });

  it("in Chép chính tả 💡 (Show the sentence) makes them available too", async () => {
    await openAt("dictation");
    fireEvent.click(screen.getByRole("button", { name: "Show the sentence (Alt+H)" }));
    await screen.findByTestId("dictation-sentence");
    fireEvent.click(toggle("Romaji"));
    expect(screen.getByTestId("listening-romaji")).toHaveTextContent("romaji of line-1");
  });

  it("in Điền từ both work while answering; a blank's romaji is ___ and its reading never shows until Check", async () => {
    await openAt("cloze");
    expect(toggle("Translation")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(toggle("Translation"));
    fireEvent.click(toggle("Romaji"));
    expect(screen.getByTestId("listening-translation")).toHaveTextContent(TRANSLATION);
    expect(screen.getByTestId("listening-romaji")).toHaveTextContent("romaji ___ romaji ___ romaji");
    expect(screen.getByTestId("practice-panel").innerHTML).not.toMatch(/\bame\b|ashita/);
    fireEvent.change(screen.getByRole("textbox", { name: "Blank 1" }), { target: { value: "あめ" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Blank 2" }), { target: { value: "あさ" } });
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(screen.getByTestId("listening-romaji")).toHaveTextContent("romaji ame romaji ashita romaji");
  });

  it("in Typing and Điền từ the buttons ride in the 💡 row and the surfaces sit under the answer box", async () => {
    for (const format of ["dictation", "cloze"] as const) {
      await openAt(format);
      const bulb = screen.getByRole("button", { name: format === "cloze" ? /^Hint/ : "Show the sentence (Alt+H)" });
      const header = required(bulb.closest("[data-puzzle-header]"));
      for (const name of ["Sentence audio", "Romaji"] as const) {
        expect(header).toContainElement(toggle(name));
        expect(toggle(name).compareDocumentPosition(bulb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      if (format === "dictation") {
        fireEvent.click(bulb);
        await screen.findByTestId("dictation-sentence");
      }
      fireEvent.click(toggle("Romaji"));
      const romaji = await screen.findByTestId("listening-romaji");
      expect(header).not.toContainElement(romaji);
      const box = format === "cloze" ? screen.getByTestId("cloze-sentence") : screen.getByRole("textbox", { name: "Type what you hear" });
      expect(box.compareDocumentPosition(romaji) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      cleanup();
    }
  });

  it("the toggles are remembered for the page visit: they survive Next", async () => {
    await openAt("cloze");
    fireEvent.click(toggle("Romaji"));
    fireEvent.click(nextSentence());
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Blank 2" })).toBeNull()); // line-2 has one blank
    expect(toggle("Romaji")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("listening-romaji")).toHaveTextContent(/^romaji ___ romaji$/);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
