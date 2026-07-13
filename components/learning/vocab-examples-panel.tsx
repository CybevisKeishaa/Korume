"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JlptLevel } from "@/lib/validation/content";

/**
 * Client-safe mirror of `lib/data/content.ts`'s `VocabExampleItem` (that
 * module is `server-only`) — structurally identical, so the server page can
 * pass its query result straight through as `initialExamples` without a cast.
 */
export interface VocabExample {
  id: string;
  sentence_jp: string;
  sentence_translation: string | null;
  source: "curated" | "ai_generated";
}

export interface VocabExamplesPanelProps {
  vocabId: string;
  /** Curated seed examples plus any already AI-generated ones, in display order. */
  initialExamples: VocabExample[];
  /** Overrides the word's own JLPT level for generation, if the caller wants to. */
  level?: JlptLevel;
  className?: string;
}

type State = { status: "idle" } | { status: "generating" } | { status: "error"; message: string };

const examplesUrl = (vocabId: string) => `/api/vocab/${vocabId}/examples`;

/** Maps a non-2xx examples response to a friendly message. */
async function friendlyError(res: Response): Promise<string> {
  if (res.status === 503) return "AI example generation isn't set up yet for this deployment.";
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    return retryAfter
      ? `Too many example requests — try again in ${retryAfter}s.`
      : "Too many example requests — please wait a moment and try again.";
  }
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? "Could not generate examples right now.";
  } catch {
    return "Could not generate examples right now.";
  }
}

/**
 * Curated example sentences + an on-demand "Generate example sentences (AI)"
 * action (CLAUDE.md §5/§9). AI-generated rows are always visibly labeled;
 * a `cached: true` response (the word already hit its generation cap) just
 * replaces the AI section with the authoritative set — no separate
 * "freshly generated" spinner/story to distinguish it from a new batch.
 */
export function VocabExamplesPanel({
  vocabId,
  initialExamples,
  level,
  className,
}: VocabExamplesPanelProps) {
  const [examples, setExamples] = useState<VocabExample[]>(initialExamples);
  const [state, setState] = useState<State>({ status: "idle" });

  async function generate() {
    setState({ status: "generating" });
    try {
      const res = await fetch(examplesUrl(vocabId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(level ? { level } : {}),
      });
      if (!res.ok) {
        setState({ status: "error", message: await friendlyError(res) });
        return;
      }
      const json = (await res.json()) as { data: VocabExample[]; cached: boolean };
      setExamples((prev) => [...prev.filter((e) => e.source === "curated"), ...json.data]);
      setState({ status: "idle" });
    } catch {
      setState({ status: "error", message: "Network error — check your connection and try again." });
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Example sentences</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generate}
          disabled={state.status === "generating"}
        >
          {state.status === "generating" ? "Generating…" : "Generate example sentences (AI)"}
        </Button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      {examples.length === 0 ? (
        <p className="text-sm text-muted-foreground">No example sentences yet.</p>
      ) : (
        <ul className="space-y-3">
          {examples.map((example) => (
            <li key={example.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-jp">{example.sentence_jp}</p>
              {example.sentence_translation && (
                <p className="mt-1 text-muted-foreground">{example.sentence_translation}</p>
              )}
              {example.source === "ai_generated" && (
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  AI-generated
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
