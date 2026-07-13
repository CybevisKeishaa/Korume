"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KeyVocabItem {
  word: string;
  reading: string;
  meaning: string;
}

export interface KeyGrammarItem {
  pattern: string;
  explanation: string;
}

export interface VideoSummaryData {
  summary: string;
  key_vocab: KeyVocabItem[];
  key_grammar: KeyGrammarItem[];
  model: string;
  created_at: string;
}

export interface VideoSummaryPanelProps {
  videoId: string;
  className?: string;
}

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "generating" }
  | { status: "ready"; data: VideoSummaryData; inputTruncated: boolean }
  | { status: "error"; message: string };

const summaryUrl = (videoId: string) => `/api/videos/${videoId}/summary`;

/** Maps a non-2xx summary response to a friendly message. */
async function friendlyError(res: Response): Promise<string> {
  if (res.status === 422) return "This video has no transcript to summarize yet.";
  if (res.status === 503) return "AI summarization isn't set up yet for this deployment.";
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    return retryAfter
      ? `Too many summary requests — try again in ${retryAfter}s.`
      : "Too many summary requests — please wait a moment and try again.";
  }
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? "Could not generate a summary right now.";
  } catch {
    return "Could not generate a summary right now.";
  }
}

/**
 * AI video summary (CLAUDE.md §5, spec §10). Loads the cached summary on
 * mount; a 404 shows a "Generate" button (generate-once — the backend
 * returns the cached row on any later call, `cached: true`). Every AI-authored
 * section is labeled AI-generated per CLAUDE.md §9.
 */
export function VideoSummaryPanel({ videoId, className }: VideoSummaryPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(summaryUrl(videoId));
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: "missing" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: await friendlyError(res) });
          return;
        }
        const json = (await res.json()) as { data?: VideoSummaryData };
        if (!json.data || typeof json.data.summary !== "string") {
          setState({ status: "missing" });
          return;
        }
        setState({ status: "ready", data: json.data, inputTruncated: false });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Couldn't load the summary." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  async function generate() {
    setState({ status: "generating" });
    try {
      const res = await fetch(summaryUrl(videoId), { method: "POST" });
      if (!res.ok) {
        setState({ status: "error", message: await friendlyError(res) });
        return;
      }
      const json = (await res.json()) as {
        data: VideoSummaryData;
        cached: boolean;
        inputTruncated?: boolean;
      };
      setState({ status: "ready", data: json.data, inputTruncated: json.inputTruncated ?? false });
    } catch {
      setState({ status: "error", message: "Couldn't generate a summary right now." });
    }
  }

  return (
    <Card className={cn("p-4", className)} aria-label="AI video summary">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Summary</h3>
        {state.status === "ready" && (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI-generated
          </span>
        )}
      </div>

      <div className="mt-2" aria-live="polite">
        {state.status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {state.status === "missing" && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">No summary yet for this video.</p>
            <Button type="button" size="sm" onClick={generate}>
              Generate summary
            </Button>
          </div>
        )}

        {state.status === "generating" && (
          <p className="text-sm text-muted-foreground">Generating summary…</p>
        )}

        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            <p className="text-sm">{state.data.summary}</p>
            {state.inputTruncated && (
              <p className="text-xs text-muted-foreground">
                Note: the transcript was truncated to summarize it.
              </p>
            )}

            {state.data.key_vocab.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Key vocab
                </h4>
                <ul className="mt-1 space-y-1">
                  {state.data.key_vocab.map((v, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-jp font-medium">{v.word}</span>{" "}
                      <span className="font-jp text-muted-foreground">{v.reading}</span> —{" "}
                      <span>{v.meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.data.key_grammar.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Key grammar
                </h4>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {state.data.key_grammar.map((g, i) => (
                    <li
                      key={i}
                      title={g.explanation}
                      className="rounded-full bg-muted px-2 py-1 text-xs"
                    >
                      <span className="font-jp font-medium">{g.pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
