"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
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

/**
 * Which `vocab.errors.*` catalog entry a failed `generate()` request maps
 * to. A descriptor, not a resolved string, because `classifyError` is a
 * module-level function and cannot call `t()` itself — only the component
 * body (inside render) has translation context. The component resolves the
 * descriptor to text after calling this.
 */
type ErrorDescriptor =
  | { key: "unavailable" }
  | { key: "rateLimited"; seconds: number }
  | { key: "rateLimitedGeneric" }
  | { key: "generic" };

const examplesUrl = (vocabId: string) => `/api/vocab/${vocabId}/examples`;

/**
 * Classifies a non-2xx `/api/vocab/[id]/examples` response into a
 * translated-message descriptor.
 *
 * The API's own `error` field (`app/api/vocab/[id]/examples/route.ts`:
 * "Invalid id", "Invalid JSON", "Invalid request", "Too many example
 * requests, slow down") is English, server-authored, and mostly describes a
 * bug a learner can't act on — it is intentionally never rendered to the
 * DOM (CLAUDE.md §2/§5, mirroring the Task 7 review-session.tsx ruling on
 * raw exception text). Instead it's logged for support/debugging, and the
 * UI shows a translated generic message. The 503 (not configured) and 429
 * (rate limited) cases are actionable, so they keep their own dedicated,
 * always-translated copy regardless of what the server's `error` text says.
 */
async function classifyError(res: Response): Promise<ErrorDescriptor> {
  if (res.status === 503) return { key: "unavailable" };
  if (res.status === 429) {
    // RFC 9110 permits Retry-After to be an HTTP-date, not just delay-seconds
    // (our own route.ts:52 always sends a numeric value, but a proxy/CDN in
    // front of it could rewrite the header) — Number() on anything
    // non-numeric is NaN, and IntlMessageFormat renders that straight into
    // the message ("try again in NaNs."). Fall back to the generic wait
    // message instead of trusting the header blindly.
    const retryAfter = res.headers.get("Retry-After");
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    return Number.isFinite(seconds)
      ? { key: "rateLimited", seconds }
      : { key: "rateLimitedGeneric" };
  }
  try {
    const body = (await res.json()) as { error?: string };
    console.error(`vocab examples request failed (${res.status})`, body.error);
  } catch {
    console.error(`vocab examples request failed (${res.status})`);
  }
  return { key: "generic" };
}

/**
 * Curated example sentences + an on-demand "Generate example sentences (AI)"
 * action (CLAUDE.md §5/§9). AI-generated rows are always visibly labeled —
 * this is a compliance surface (AI content labeling) and must keep
 * rendering regardless of locale; a `cached: true` response (the word
 * already hit its generation cap) just replaces the AI section with the
 * authoritative set — no separate "freshly generated" spinner/story to
 * distinguish it from a new batch.
 */
export function VocabExamplesPanel({
  vocabId,
  initialExamples,
  level,
  className,
}: VocabExamplesPanelProps) {
  const t = useTranslations("vocab");
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
        const descriptor = await classifyError(res);
        const message =
          descriptor.key === "rateLimited"
            ? t("errors.rateLimited", { seconds: descriptor.seconds })
            : t(`errors.${descriptor.key}`);
        setState({ status: "error", message });
        return;
      }
      const json = (await res.json()) as { data: VocabExample[]; cached: boolean };
      setExamples((prev) => [...prev.filter((e) => e.source === "curated"), ...json.data]);
      setState({ status: "idle" });
    } catch (e) {
      // Same rule as the !res.ok branch: never surface a raw browser/network
      // exception (untranslatable, locale-dependent browser copy).
      console.error(e);
      setState({ status: "error", message: t("errors.network") });
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("examplesHeading")}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generate}
          disabled={state.status === "generating"}
        >
          {state.status === "generating" ? t("generating") : t("generateExamples")}
        </Button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger-strong">
          {state.message}
        </p>
      )}

      {examples.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noExamples")}</p>
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
                  {t("aiGenerated")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
