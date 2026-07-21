"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
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

/**
 * Which `shadowing.summary.errors.*` catalog entry a failed summary request
 * maps to. A descriptor, not a resolved string, because this is a
 * module-level function and `t()` is only callable from within component
 * render (same shape as Task 10's `BAND_LABEL_KEY` and the vocab examples
 * panel's `classifyError`, Task 8).
 *
 * Defect fix (found in Task 11c scouting): the previous version of this
 * function did `body.error ?? "Could not generate a summary right now."` —
 * rendering the API's server-authored English straight to the DOM, which
 * made the translated string unreachable whenever the server sent any
 * `error` field at all (the exact defect Task 8 removed from the vocab
 * panel). `body.error` is no longer read or rendered here; the generic
 * fallback below is always the translated `errors.generic` copy regardless
 * of what the response body contains.
 */
type SummaryErrorDescriptor =
  | { key: "noTranscript" }
  | { key: "unavailable" }
  | { key: "rateLimited"; seconds: number }
  | { key: "rateLimitedGeneric" }
  | { key: "generic" };

function classifySummaryError(res: Response): SummaryErrorDescriptor {
  if (res.status === 422) return { key: "noTranscript" };
  if (res.status === 503) return { key: "unavailable" };
  if (res.status === 429) {
    // RFC 9110 permits Retry-After to be an HTTP-date, not just
    // delay-seconds, and a proxy/CDN in front of the API could rewrite the
    // header — Number() on anything non-numeric is NaN, and IntlMessageFormat
    // would render that straight into the message ("try again in NaNs.").
    // Number("") is 0 (finite, not NaN), so an empty-but-present header is
    // rejected explicitly rather than relying on Number()'s quirk to do it.
    // Fall back to the generic wait message instead of trusting the header.
    const retryAfter = res.headers.get("Retry-After");
    const seconds =
      retryAfter === null || retryAfter.trim() === "" ? NaN : Number(retryAfter);
    return Number.isFinite(seconds)
      ? { key: "rateLimited", seconds }
      : { key: "rateLimitedGeneric" };
  }
  return { key: "generic" };
}

/**
 * AI video summary (CLAUDE.md §5, spec §10). Loads the cached summary on
 * mount; a 404 shows a "Generate" button (generate-once — the backend
 * returns the cached row on any later call, `cached: true`). Every AI-authored
 * section is labeled AI-generated per CLAUDE.md §9.
 */
export function VideoSummaryPanel({ videoId, className }: VideoSummaryPanelProps) {
  const t = useTranslations("shadowing");
  // "Loading…" is byte-identical to the already-promoted common.states.loading
  // (Task 2); reused here rather than duplicated into shadowing.json (P4 — a
  // string needed by 2+ modules is promoted to common, never duplicated).
  const tCommon = useTranslations("common");
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
          const descriptor = classifySummaryError(res);
          const message =
            descriptor.key === "rateLimited"
              ? t("summary.errors.rateLimited", { seconds: descriptor.seconds })
              : t(`summary.errors.${descriptor.key}`);
          setState({ status: "error", message });
          return;
        }
        const json = (await res.json()) as { data?: VideoSummaryData };
        if (!json.data || typeof json.data.summary !== "string") {
          setState({ status: "missing" });
          return;
        }
        setState({ status: "ready", data: json.data, inputTruncated: false });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: t("summary.errors.loadFailed") });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId, t]);

  async function generate() {
    setState({ status: "generating" });
    try {
      const res = await fetch(summaryUrl(videoId), { method: "POST" });
      if (!res.ok) {
        const descriptor = classifySummaryError(res);
        const message =
          descriptor.key === "rateLimited"
            ? t("summary.errors.rateLimited", { seconds: descriptor.seconds })
            : t(`summary.errors.${descriptor.key}`);
        setState({ status: "error", message });
        return;
      }
      const json = (await res.json()) as {
        data: VideoSummaryData;
        cached: boolean;
        inputTruncated?: boolean;
      };
      setState({ status: "ready", data: json.data, inputTruncated: json.inputTruncated ?? false });
    } catch {
      setState({ status: "error", message: t("summary.errors.generateFailed") });
    }
  }

  return (
    <Card className={cn("p-4", className)} aria-label={t("summary.a11y.region")}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("summary.heading")}</h3>
        {state.status === "ready" && (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("summary.aiGenerated")}
          </span>
        )}
      </div>

      <div className="mt-2" aria-live="polite">
        {state.status === "loading" && (
          <p className="text-sm text-muted-foreground">{tCommon("states.loading")}</p>
        )}

        {state.status === "missing" && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{t("summary.empty")}</p>
            <Button type="button" size="sm" onClick={generate}>
              {t("summary.generate")}
            </Button>
          </div>
        )}

        {state.status === "generating" && (
          <p className="text-sm text-muted-foreground">{t("summary.generating")}</p>
        )}

        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger-strong">
            {state.message}
          </p>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            <p className="text-sm">{state.data.summary}</p>
            {state.inputTruncated && (
              <p className="text-xs text-muted-foreground">{t("summary.inputTruncated")}</p>
            )}

            {state.data.key_vocab.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("summary.keyVocab")}
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
                  {t("summary.keyGrammar")}
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
