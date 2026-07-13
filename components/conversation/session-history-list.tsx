"use client";

import { cn } from "@/lib/utils";
import type { ConversationSessionRow } from "@/lib/conversation-types";
import { SCENARIOS } from "./scenario-picker";

export interface SessionHistoryListProps {
  sessions: ConversationSessionRow[];
  onSelect: (sessionId: string) => void;
  className?: string;
}

function scenarioLabel(scenarioType: string | null): string {
  return SCENARIOS.find((s) => s.id === scenarioType)?.label ?? scenarioType ?? "Conversation";
}

/** Past-session list (read-only entry point to a session's transcript). */
export function SessionHistoryList({ sessions, onSelect, className }: SessionHistoryListProps) {
  if (sessions.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No past sessions yet — start one above.
      </p>
    );
  }

  return (
    <ul className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onSelect(session.id)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
          >
            <span className="font-jp">{scenarioLabel(session.scenario_type)}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {session.ended_at ? "Ended" : "In progress"} ·{" "}
              {new Date(session.started_at).toLocaleDateString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
