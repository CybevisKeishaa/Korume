import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resetTabWritesForTests, usePositionStore } from "../workspace-context";
import { ShadowingWorkspaceShell } from "../workspace-shell";
import { TranscriptPanel } from "../transcript-panel";
import { resetLineAnalysisCacheForTests } from "../use-line-analysis";
import { useDrawer } from "./drawer-context";
import { resetNoteWritesForTests } from "./notes-context";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1", useSearchParams: () => new URLSearchParams() }));

const LINES = Array.from({ length: 14 }, (_, i) => ({
  id: `line-${i + 1}`, index: i, startTime: i * 2, endTime: i * 2 + 2, textJp: `文${i + 1}`, textTranslation: null, furigana: null,
}));
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 28, jlptLevel: "N4" },
  transcript: { id: "transcript-1", lines: LINES },
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [],
  notes: { lessonNote: null, sentenceNotes: [] },
};

interface SectionBody { transcriptLineId: string; section: string; locale: string; span?: { start: number; end: number } }
type Responder = (body: SectionBody, attempt: number) => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ready = (section: string, content: unknown, access: "full" | "preview" = "full") =>
  json({ data: { status: "ready", section, access, content, model: "m", source: "ai_generated" } });
const CONTENT: Record<string, unknown> = {
  lite: { summary: "It means one.", literal: "Sentence one", keyPoints: ["first point"] },
  grammar_breakdown: { items: [{ surface: "文", pattern: "N", meaning: "a noun", explanation: "Just a noun." }] },
  native_nuance: { register: "casual", nuance: "Friendly." },
  phrase_analysis: { phrase: "文", breakdown: [{ part: "文", role: "noun", meaning: "sentence" }], nuance: "Plain." },
};

let fetchMock: ReturnType<typeof vi.fn>;
let respond: Responder;
let usage: unknown;
let yt: YouTubeStubHandle;
let store: ReturnType<typeof usePositionStore> | undefined;
function Probe(): null { store = usePositionStore(); return null; }
/** Stands in for the selection popover's ✨ Analyze: opens the AI tab on a span of line 2. */
function AnalyzeSpan() {
  const { dispatch } = useDrawer();
  return <button type="button" onClick={() => dispatch({ type: "open", tab: "ai", target: { lineId: "line-2", span: { start: 0, end: 1 } } })}>Analyze span</button>;
}

beforeEach(() => {
  yt = installYouTubeStub();
  resetTabWritesForTests(); resetLineAnalysisCacheForTests(); resetNoteWritesForTests();
  sessionStorage.clear();
  respond = (body) => ready(body.section, CONTENT[body.section] ?? {});
  usage = { plan: "free", used: 1, limit: 3, resetsAt: new Date(Date.now() + 5 * 3_600_000 - 60_000).toISOString() };
  const attempts = new Map<string, number>();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/knowledge/sections") {
      const body = JSON.parse(String(init?.body)) as SectionBody;
      const key = `${body.transcriptLineId}:${body.section}`;
      attempts.set(key, (attempts.get(key) ?? 0) + 1);
      return respond(body, attempts.get(key) ?? 1);
    }
    if (url === "/api/knowledge/usage") return json({ data: usage });
    if (url.includes("/api/lines/")) return json({ data: { lineId: url.split("/")[3], snapshotId: "s", tokens: [], mastery: {}, grammar: [] } });
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

function renderShell() {
  render(<ShadowingWorkspaceShell bootstrap={bootstrap}><Probe /><AnalyzeSpan /><TranscriptPanel /></ShadowingWorkspaceShell>);
}
const row = (n: number) => document.querySelector<HTMLElement>(`li[data-index="${n - 1}"]`) as HTMLElement;
const openAi = (n: number) => fireEvent.click(within(row(n)).getByRole("button", { name: "AI explanation" }));
const panel = () => screen.getByRole("tabpanel");
const at = (seconds: number) => act(() => { store?.set(seconds); });
const posts = () => fetchMock.mock.calls
  .filter(([input, init]) => String(input) === "/api/knowledge/sections" && (init as RequestInit | undefined)?.method === "POST")
  .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as SectionBody);
const item = (name: string) => within(panel()).getByRole("button", { name: new RegExp(name) });
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("AI tab", () => {
  it("requests lite once from the ✨ click, and nothing while following playback", async () => {
    renderShell();
    openAi(3);
    expect(await within(panel()).findByText("It means one.")).toBeInTheDocument();
    expect(posts()).toEqual([{ transcriptLineId: "line-3", section: "lite", locale: "en" }]);

    fireEvent.click(screen.getByRole("button", { name: "Follow current sentence" }));
    for (let n = 1; n <= 10; n += 1) at(n * 2 + 0.5);
    await settle();
    expect(posts()).toHaveLength(1);
    // The followed sentence has no explanation yet: the learner asks for it.
    expect(within(panel()).getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("labels every loaded section AI-generated and shows the usage line", async () => {
    renderShell();
    openAi(3);
    expect(await within(panel()).findByText("1/3 sentences today · resets in 5 h")).toBeInTheDocument();
    await within(panel()).findByText("It means one.");
    fireEvent.click(item("Grammar breakdown"));
    await within(panel()).findByText("Just a noun.");
    expect(within(panel()).getAllByText("AI-generated")).toHaveLength(2);
  });

  it("shows the Plus allowance as a percentage", async () => {
    usage = { plan: "plus", remainingPercent: 72, resetsAt: "2026-11-01T00:00:00Z" };
    renderShell();
    openAi(3);
    expect(await within(panel()).findByText("72% of this month's AI left")).toBeInTheDocument();
    expect(within(panel()).getByRole("meter", { name: "AI left this month" })).toHaveAttribute("aria-valuenow", "72");
  });

  it("requests an accordion section once and keeps it when re-expanded", async () => {
    renderShell();
    openAi(3);
    await within(panel()).findByText("It means one.");
    fireEvent.click(item("Grammar breakdown"));
    await within(panel()).findByText("Just a noun.");
    fireEvent.click(item("Grammar breakdown"));
    expect(within(panel()).queryByText("Just a noun.")).not.toBeInTheDocument();
    fireEvent.click(item("Grammar breakdown"));
    expect(within(panel()).getByText("Just a noun.")).toBeInTheDocument();
    await settle();
    expect(posts().map((post) => post.section)).toEqual(["lite", "grammar_breakdown"]);
  });

  it("opens and requests the grammar breakdown from Grammar's shortcut", async () => {
    renderShell();
    fireEvent.click(within(row(3)).getByRole("button", { name: "Grammar" }));
    fireEvent.click(await within(panel()).findByRole("button", { name: "AI Grammar Breakdown →" }));
    expect(await within(panel()).findByText("Just a noun.")).toBeInTheDocument();
    expect(item("Grammar breakdown")).toHaveAttribute("aria-expanded", "true");
    expect(posts().map((post) => post.section).sort()).toEqual(["grammar_breakdown", "lite"]);
  });

  it("polls a pending section after retryAfterMs and announces it", async () => {
    respond = (body, attempt) => (attempt === 1
      ? json({ data: { status: "pending", section: body.section, retryAfterMs: 30 } }, 202)
      : ready(body.section, CONTENT[body.section]));
    renderShell();
    openAi(3);
    expect(await within(panel()).findByText("Writing this section…")).toBeInTheDocument();
    expect(await within(panel()).findByText("It means one.")).toBeInTheDocument();
    expect(posts()).toHaveLength(2);
    expect(within(panel()).getByText("Explanation is ready.")).toHaveAttribute("role", "status");
  });

  it("shows the reset time on 402", async () => {
    respond = () => json({ error: "quota_exhausted", resetsAt: new Date(Date.now() + 3 * 3_600_000 - 60_000).toISOString() }, 402);
    renderShell();
    openAi(3);
    expect(await within(panel()).findByText("You've used today's free AI sentences. Resets in 3 h.")).toBeInTheDocument();
  });

  it("rests on 503 without retrying, and keeps sections already loaded", async () => {
    respond = (body) => (body.section === "lite" ? ready("lite", CONTENT.lite) : json({ error: "ai_unavailable", reason: "disabled" }, 503));
    renderShell();
    openAi(3);
    await within(panel()).findByText("It means one.");
    fireEvent.click(item("Culture notes"));
    expect(await within(panel()).findByText("AI is resting right now. Sections already loaded stay here.")).toBeInTheDocument();
    await settle();
    expect(posts()).toHaveLength(2);
    expect(within(panel()).getByText("It means one.")).toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry after an error", async () => {
    respond = (body, attempt) => (attempt === 1 ? json({ error: "x" }, 500) : ready(body.section, CONTENT[body.section]));
    renderShell();
    openAi(3);
    fireEvent.click(await within(panel()).findByRole("button", { name: "Try again" }));
    expect(await within(panel()).findByText("It means one.")).toBeInTheDocument();
    expect(posts()).toHaveLength(2);
  });

  it("locks a preview: 🔒, the preview and the Plus text, with no button", async () => {
    respond = (body) => (body.section === "native_nuance"
      ? ready("native_nuance", CONTENT.native_nuance, "preview")
      : ready(body.section, CONTENT[body.section]));
    renderShell();
    openAi(3);
    await within(panel()).findByText("It means one.");
    fireEvent.click(item("Native nuance"));
    const body = (await within(panel()).findByText("Friendly.")).closest("li") as HTMLElement;
    expect(body).toHaveTextContent("🔒");
    expect(within(body).getByText("Preview. The full section comes with Plus.")).toBeInTheDocument();
    expect(within(body).getAllByRole("button")).toHaveLength(1); // the accordion header itself
  });

  it("heads the tab with the phrase analysis for a span", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Analyze span" }));
    const phrase = await within(panel()).findByRole("region", { name: "Phrase analysis" });
    expect(await within(phrase).findByText("Plain.")).toBeInTheDocument();
    expect(posts()).toEqual(expect.arrayContaining([
      { transcriptLineId: "line-2", section: "phrase_analysis", locale: "en", span: { start: 0, end: 1 } },
      { transcriptLineId: "line-2", section: "lite", locale: "en" },
    ]));
    expect(posts()).toHaveLength(2);
    const regions = within(panel()).getAllByRole("region");
    expect(regions[0]).toBe(phrase);
  });
});
