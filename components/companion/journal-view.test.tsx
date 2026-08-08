import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { JournalView } from "./journal-view";
import type { CompanionMemory } from "@/lib/companion";

/**
 * Fixture factory. Defaults describe the `first_meeting` anchor — the one
 * memory every learner has by the time they can see this surface at all
 * (the Journal's own render records it, spec D8).
 */
const memory = (overrides: Partial<CompanionMemory>): CompanionMemory => ({
  id: "m1",
  kind: "discovered",
  memoryType: "first_meeting",
  title: null,
  videoId: null,
  transcriptLineId: null,
  timestampSeconds: null,
  lineTextJp: null,
  note: null,
  isAnchor: true,
  occurredAt: "2026-07-24T10:00:00Z",
  dedupeKey: "first_meeting",
  ...overrides,
});

describe("JournalView (spec §5 — a keepsake, never a log)", () => {
  it("renders discovered titles at read time from the descriptor", () => {
    // Discovered rows persist `title: null` on purpose (§4.4): the descriptor
    // is resolved in the READER's locale, here.
    render(<JournalView memories={[memory({})]} />);
    expect(screen.getByText("The day the two of you met.")).toBeInTheDocument();
  });

  it("renders ICU-valued titles from the dedupe key (jlpt_passed:N4 → level N4)", () => {
    render(
      <JournalView
        memories={[memory({ id: "m2", memoryType: "jlpt_passed", dedupeKey: "jlpt_passed:N4" })]}
      />,
    );
    expect(screen.getByText("JLPT N4 milestone")).toBeInTheDocument();
  });

  it("a gifted memory shows the learner's own title and note verbatim, never translated", () => {
    render(
      <JournalView
        memories={[
          memory({
            id: "m3",
            kind: "gifted",
            memoryType: "pinned_line",
            title: "Câu này làm mình nổi da gà",
            note: "xem lần đầu",
            lineTextJp: "逃げるは恥だが役に立つ",
            dedupeKey: "pinned_line:l1",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Câu này làm mình nổi da gà")).toBeInTheDocument();
    expect(screen.getByText("xem lần đầu")).toBeInTheDocument();
    expect(screen.getByText("逃げるは恥だが役に立つ")).toBeInTheDocument();
  });

  it("a gifted memory with no title of its own still reads as a kept line, not as a blank row", () => {
    render(
      <JournalView
        memories={[
          memory({ id: "m5", kind: "gifted", memoryType: "pinned_line", dedupeKey: "pinned_line:l2" }),
        ]}
      />,
    );
    expect(screen.getByText("A line you kept.")).toBeInTheDocument();
  });

  it("names each memory's provenance for assistive tech (the ✎ mark is decorative)", () => {
    render(
      <JournalView
        memories={[
          memory({ id: "m6", kind: "gifted", memoryType: "pinned_line", title: "mine", dedupeKey: "pinned_line:l3" }),
          memory({}),
        ]}
      />,
    );
    expect(screen.getByText("A memory you gifted")).toBeInTheDocument();
    expect(screen.getByText("A memory discovered along the way")).toBeInTheDocument();
  });

  it("links back to the moment when the pointer is complete", () => {
    render(
      <JournalView
        memories={[
          memory({
            id: "m4",
            memoryType: "first_shadow",
            videoId: "v1",
            transcriptLineId: "l1",
            dedupeKey: "first_shadow",
          }),
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /return to this moment/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/shadowing/v1?line=l1"));
  });

  it("offers no return link when the pointer is incomplete", () => {
    // A memory with no video/line to go back to must not render a dead link.
    render(<JournalView memories={[memory({})]} />);
    expect(screen.queryByRole("link", { name: /return to this moment/i })).toBeNull();
  });

  it("dates every memory in VN time, not in whatever zone the renderer happens to sit in", () => {
    // 2026-07-24T18:00Z is already 2026-07-25 in Asia/Ho_Chi_Minh (UTC+7).
    // Without an explicit zone next-intl falls back to the ENVIRONMENT's — the
    // server's on first paint, the browser's after hydration — so the same
    // instant could render as two different days. This also keeps the Journal
    // consistent with the streak card, which is VN-local by construction
    // (`vnDateString`, lib/gamification/streak.ts).
    render(<JournalView memories={[memory({ occurredAt: "2026-07-24T18:00:00Z" })]} />);
    expect(screen.getByText("July 25, 2026")).toBeInTheDocument();
  });

  it("empty journal looks forward, never apologizes (D9)", () => {
    render(<JournalView memories={[]} />);
    expect(screen.getByText(/first page is waiting/i)).toBeInTheDocument();
    expect(screen.queryByText(/no memories|empty/i)).toBeNull();
  });

  it("orders strictly by occurredAt (the API already sorts; the view must not re-sort by anything else)", () => {
    const older = memory({ id: "a", occurredAt: "2026-01-01T00:00:00Z" });
    const newer = memory({
      id: "b",
      memoryType: "first_shadow",
      dedupeKey: "first_shadow",
      occurredAt: "2026-06-01T00:00:00Z",
    });
    render(<JournalView memories={[newer, older]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("The first line you shadowed successfully.");
    expect(items[1]).toHaveTextContent("The day the two of you met.");
  });
});
