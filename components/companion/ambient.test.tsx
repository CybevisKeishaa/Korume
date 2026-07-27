import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SPEECH_AUTO_FADE_MS } from "@/lib/companion/presence/config";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";
import { AmbientProvider } from "./ambient-provider";
import { CompanionAnchor } from "./companion-anchor";
import { useCompanion } from "./use-companion";

const pushMock = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: pushMock }),
}));

/**
 * One probe for all four verbs: it renders the observable machine state and
 * phase, and exposes buttons for `emitContext` / `openJournal`. Rendering
 * `getCurrentState()` is what makes the dormant-surface rule (below)
 * assertable directly rather than by inference.
 */
function Probe({ context }: { context?: ExperienceContext }) {
  const companion = useCompanion();
  const { state, phase } = companion.getCurrentState();
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="phase">{String(phase)}</span>
      <button
        type="button"
        onClick={() => {
          if (context) companion.emitContext(context);
        }}
      >
        emit
      </button>
      <button type="button" onClick={() => companion.openJournal()}>
        open journal
      </button>
    </div>
  );
}

function renderAmbient(ui: React.ReactNode) {
  return render(
    <ThemeProvider>
      <AmbientProvider>{ui}</AmbientProvider>
    </ThemeProvider>,
  );
}

const SPRITE = { name: /companion/i } as const;

beforeEach(() => {
  pushMock.mockClear();
  document.documentElement.setAttribute("data-reduce-motion", "false");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { xp: 0 } }) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ambient shell", () => {
  it("renders nothing (dormant) without an anchor, and fetches nothing", () => {
    renderAmbient(<div>page</div>);
    expect(screen.queryByRole("button", SPRITE)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("an anchored surface renders the sprite; a context yields exactly ONE address", async () => {
    const user = userEvent.setup();
    renderAmbient(
      <>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Probe context="finished_shadowing" />
      </>,
    );

    await user.click(screen.getByText("emit"));
    expect(await screen.findByRole("status")).toHaveTextContent(/journey/i);
    expect(screen.getByTestId("state")).toHaveTextContent("speaking");

    // A second ambient context inside the cooldown window is suppressed —
    // the Companion never queues a monologue (§5.10).
    await user.click(screen.getByText("emit"));
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  /**
   * A live region that is mounted together with its text is commonly NOT
   * announced (NVDA/JAWS/VoiceOver): the reliable pattern is a region that is
   * already in the accessibility tree and whose CONTENTS change. So the
   * `role="status"` element must outlive the address, not arrive with it.
   */
  it("keeps the speech live region mounted and changes its text in place", async () => {
    const user = userEvent.setup();
    renderAmbient(
      <>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Probe context="finished_shadowing" />
      </>,
    );

    // Present and EMPTY before anything has been said.
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("");

    await user.click(screen.getByText("emit"));

    // The very same node now carries the address — it was not remounted.
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent(/journey/i);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    // …and it survives the dismissal too, ready for the next address.
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("");
  });

  it("an anchor's own `context` prop is announced once on mount", async () => {
    renderAmbient(<CompanionAnchor surface="videos" pose="standing" context="empty_library" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/chapter/i);
  });

  it("sprite is a focusable door to the journal", async () => {
    const user = userEvent.setup();
    renderAmbient(<CompanionAnchor surface="dashboard" pose="sitting" />);

    const sprite = screen.getByRole("button", SPRITE);
    await user.tab();
    expect(sprite).toHaveFocus();

    await user.click(sprite);
    expect(pushMock).toHaveBeenCalledWith("/journal");
  });

  it("the address can be dismissed, and the machine settles back to idle", async () => {
    const user = userEvent.setup();
    renderAmbient(
      <>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Probe context="finished_shadowing" />
      </>,
    );

    await user.click(screen.getByText("emit"));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    // The live region stays mounted (see the live-region test above); what
    // goes away is the address itself and the chrome around it.
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.queryByRole("button", { name: /dismiss/i })).toBeNull();
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
  });

  it("the address auto-fades after SPEECH_AUTO_FADE_MS and settles back to idle", () => {
    // A phase read that never settles: under fake timers its resolution would
    // land outside act() and warn. Presence does not depend on it (§6.5).
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    vi.useFakeTimers();
    try {
      renderAmbient(
        <>
          <CompanionAnchor surface="dashboard" pose="sitting" />
          <Probe context="finished_shadowing" />
        </>,
      );

      // fireEvent (not userEvent) because userEvent's own async waits fight
      // fake timers; the click itself is all this test needs.
      act(() => {
        screen.getByText("emit").click();
      });
      expect(screen.getByRole("status")).toHaveTextContent(/journey/i);

      act(() => {
        vi.advanceTimersByTime(SPEECH_AUTO_FADE_MS);
      });
      expect(screen.getByRole("status")).toHaveTextContent("");
      expect(screen.getByTestId("state")).toHaveTextContent("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * The dormant-surface rule (spec 1 §5.4): `emitContext` is callable from ANY
   * surface, including one with no anchor. Dispatching `context_arrived` there
   * would move the machine to `observing` with nothing able to move it back —
   * arbitration early-returns with zero anchors — pinning it forever. The
   * context must still be REMEMBERED, so a later anchor can address it.
   */
  it("emitContext from a dormant surface never moves the machine, but the context survives", async () => {
    const user = userEvent.setup();
    const { rerender } = renderAmbient(<Probe context="finished_shadowing" />);

    await user.click(screen.getByText("emit"));

    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", SPRITE)).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // A surface that DOES invite the Companion mounts later: the pending
    // context is still inside CONTEXT_TTL_MS, so it is addressed now.
    rerender(
      <ThemeProvider>
        <AmbientProvider>
          <>
            <Probe context="finished_shadowing" />
            <CompanionAnchor surface="dashboard" pose="sitting" />
          </>
        </AmbientProvider>
      </ThemeProvider>,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(/journey/i);
    expect(screen.getByTestId("state")).toHaveTextContent("speaking");
  });

  it("useCompanion outside a provider is a silent no-op API (§6.5)", async () => {
    const user = userEvent.setup();
    render(<Probe context="finished_shadowing" />);

    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(screen.getByTestId("phase")).toHaveTextContent("null");

    await user.click(screen.getByText("emit"));
    await user.click(screen.getByText("open journal"));

    expect(screen.queryByRole("status")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("reads the relationship phase once per session when an anchor mounts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { xp: 3000 } }) }),
    );
    renderAmbient(
      <>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Probe />
      </>,
    );

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/user/stats");
  });

  it("a stats fetch failure leaves presence intact — sprite renders, no error UI", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    renderAmbient(
      <>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Probe />
      </>,
    );

    expect(await screen.findByRole("button", SPRITE)).toBeInTheDocument();
    expect(screen.queryByText(/error|down/i)).toBeNull();
    // Presence needs no data: the phase simply stays unknown.
    expect(screen.getByTestId("phase")).toHaveTextContent("null");
    // Flush the rejected phase read so its catch has run.
    await act(async () => {
      await Promise.resolve();
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] phase fetch failed:",
      expect.objectContaining({ message: "down" }),
    );
    errorSpy.mockRestore();
  });

  it("still speaks when the phase is unknown — a failed read never silences the Companion", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const user = userEvent.setup();
    renderAmbient(
      <>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Probe context="finished_shadowing" />
      </>,
    );

    await user.click(screen.getByText("emit"));
    expect(await screen.findByRole("status")).toHaveTextContent(/journey/i);
    errorSpy.mockRestore();
  });

  it("reduced motion strips the idle breathe animation (CLAUDE.md §2.4)", async () => {
    document.documentElement.setAttribute("data-reduce-motion", "true");
    renderAmbient(<CompanionAnchor surface="dashboard" pose="sitting" />);

    const sprite = await screen.findByRole("button", SPRITE);
    expect(sprite.className).not.toContain("companion-breathe");
  });

  it("carries the breathe class when motion is allowed", async () => {
    renderAmbient(<CompanionAnchor surface="dashboard" pose="sitting" />);
    const sprite = await screen.findByRole("button", SPRITE);
    expect(sprite.className).toContain("companion-breathe");
  });
});
