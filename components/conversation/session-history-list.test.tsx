import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { SessionHistoryList } from "./session-history-list";
import type { ConversationSessionRow } from "@/lib/conversation-types";

const SESSIONS: ConversationSessionRow[] = [
  { id: "s-1", scenario_type: "restaurant", started_at: "2026-07-10T09:00:00.000Z", ended_at: "2026-07-10T09:10:00.000Z" },
  { id: "s-2", scenario_type: "free-talk", started_at: "2026-07-11T09:00:00.000Z", ended_at: null },
];

describe("SessionHistoryList", () => {
  it("renders past sessions with scenario label and status", () => {
    render(<SessionHistoryList sessions={SESSIONS} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /restaurant/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /free talk/i })).toBeInTheDocument();
    expect(screen.getByText(/ended/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it("pairs each row's own scenario label with its own ended/in-progress status — not swapped", () => {
    render(<SessionHistoryList sessions={SESSIONS} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /restaurant/i })).toHaveTextContent(/ended/i);
    expect(screen.getByRole("button", { name: /free talk/i })).toHaveTextContent(/in progress/i);
  });

  it("resolves an unknown scenario id to itself, raw", () => {
    render(
      <SessionHistoryList
        sessions={[
          { id: "s-3", scenario_type: "mystery-scenario", started_at: "2026-07-12T09:00:00.000Z", ended_at: null },
        ]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /mystery-scenario/i })).toBeInTheDocument();
  });

  it("resolves a missing scenario id to the translated fallback label", () => {
    render(
      <SessionHistoryList
        sessions={[{ id: "s-4", scenario_type: null, started_at: "2026-07-12T09:00:00.000Z", ended_at: null }]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^conversation/i })).toBeInTheDocument();
  });

  it("calls onSelect with the session id when clicked", async () => {
    const onSelect = vi.fn();
    render(<SessionHistoryList sessions={SESSIONS} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /restaurant/i }));
    expect(onSelect).toHaveBeenCalledWith("s-1");
  });

  it("shows an empty state with no sessions", () => {
    render(<SessionHistoryList sessions={[]} onSelect={vi.fn()} />);
    expect(screen.getByText(/no past sessions yet/i)).toBeInTheDocument();
  });
});
