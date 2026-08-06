"use client";

import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ConversationSessionRow } from "@/lib/conversation-types";
import { scenarioLabel } from "./scenario-picker";

export interface SessionHistoryListProps {
  sessions: ConversationSessionRow[];
  onSelect: (sessionId: string) => void;
  className?: string;
}

/** Past-session list (read-only entry point to a session's transcript). */
export function SessionHistoryList({ sessions, onSelect, className }: SessionHistoryListProps) {
  const t = useTranslations("conversation");

  if (sessions.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{t("history.empty")}</p>
    );
  }

  return (
    <ul className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onSelect(session.id)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-secondary"
          >
            <span className="font-jp">{scenarioLabel(t, session.scenario_type)}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {session.ended_at ? t("history.ended") : t("history.inProgress")} ·{" "}
              {new Date(session.started_at).toLocaleDateString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
