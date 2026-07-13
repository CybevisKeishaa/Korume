import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SessionEndResult } from "@/lib/conversation-types";

export interface CorrectionsPanelProps {
  result: SessionEndResult;
  className?: string;
}

/**
 * End-of-session results: Claude's corrections over the learner's own
 * utterances plus an encouragement note. Clearly labeled AI-generated per
 * CLAUDE.md §5/§9 — this is a one-time read, never persisted.
 */
export function CorrectionsPanel({ result, className }: CorrectionsPanelProps) {
  return (
    <div className={cn("space-y-4", className)} aria-label="Session results">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        AI-generated
      </p>

      <Card className="p-4">
        <p className="font-medium">{result.encouragement}</p>
      </Card>

      <div>
        <h3 className="text-sm font-semibold">Corrections</h3>
        {result.corrections.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No corrections this time — nice and clean!
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {result.corrections.map((c, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-jp text-danger line-through decoration-danger/60">
                  {c.original}
                </p>
                <p className="font-jp mt-1 font-medium text-foreground">{c.corrected}</p>
                <p className="mt-1 text-muted-foreground">{c.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
