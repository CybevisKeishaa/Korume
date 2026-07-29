import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { MiningCardListItem } from "@/lib/mining-types";
import { AmbientProvider } from "@/components/companion/ambient-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { MiningDeckList } from "./mining-deck-list";

// AmbientProvider calls `useRouter()` unconditionally (it is the door to the
// journal). Under jsdom there is no App Router context, so next-intl's client
// router throws "invariant expected app router to be mounted" — verified by
// running this file without the mock. Same shape as `components/companion/
// ambient.test.tsx`.
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const CARD: MiningCardListItem = {
  id: "card-1",
  sentenceJp: "私は学校に行きます",
  targetWord: "学校",
  reading: "がっこう",
  translation: "I go to school",
  videoId: "abc123",
  startTime: 10,
  endTime: 15,
  createdAt: "2026-01-01T00:00:00.000Z",
  srsStage: 0,
  intervalDays: 0,
  easeFactor: 2.5,
  nextReviewAt: null,
  lastReviewedAt: null,
};

describe("MiningDeckList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an empty state when there are no cards", () => {
    render(<MiningDeckList cards={[]} />);
    expect(screen.getByText(/no mined sentences yet/i)).toBeInTheDocument();
  });

  it("renders a card's sentence with the target word emphasized, reading, and translation", () => {
    render(<MiningDeckList cards={[CARD]} />);

    const sentence = screen.getByText((_, node) => node?.textContent === "私は学校に行きます");
    expect(sentence).toBeInTheDocument();
    expect(screen.getByText("学校", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("がっこう")).toBeInTheDocument();
    expect(screen.getByText("I go to school")).toBeInTheDocument();
  });

  it("offers a Play clip control for a card with timestamps", () => {
    render(<MiningDeckList cards={[CARD]} />);
    expect(screen.getByRole("button", { name: /play clip/i })).toBeInTheDocument();
  });

  it("renders one card per item in a list", () => {
    render(<MiningDeckList cards={[CARD, { ...CARD, id: "card-2" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  /**
   * Spec 1 §5.2/§5.4: the empty deck is a rest point, so it INVITES the
   * Companion; a populated deck is the study surface itself and must stay
   * dormant. The anchor only renders inside the Ambient Layer, so the
   * provider — mounted for real in the (app) layout — is supplied here.
   */
  it("invites the Companion only in the empty state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { xp: 0 } }) }),
    );

    // ThemeProvider: the sprite reads `reduceMotion` from it (CLAUDE.md §2.4).
    const { unmount } = render(
      <ThemeProvider>
        <AmbientProvider>
          <MiningDeckList cards={[]} />
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(document.querySelector('[data-companion-surface="mining-empty"]')).not.toBeNull();
    // The empty state itself survives beside the invitation.
    expect(screen.getByText(/no mined sentences yet/i)).toBeInTheDocument();
    unmount();

    render(
      <ThemeProvider>
        <AmbientProvider>
          <MiningDeckList cards={[CARD]} />
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(document.querySelector('[data-companion-surface="mining-empty"]')).toBeNull();
  });
});
