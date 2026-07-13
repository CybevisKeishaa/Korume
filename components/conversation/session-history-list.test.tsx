import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
