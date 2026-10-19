"use client";

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "@/lib/i18n";
import type { Assessment } from "@/lib/pronunciation/assessment";
import type { SessionListItem } from "@/lib/data/shadowing";
import type { PitchAccentScore } from "@/lib/pitch";
import { PitchContourOverlay } from "@/components/video-player/pitch-contour-overlay";

export function progressLine(items: SessionListItem[]): { metric: "rhythm" | "pronunciation"; from: number; to: number } | null {
  const scored = items.filter((item) => item.state === "scored" && item.pronunciationScore !== null);
  const [latest, previous] = scored;
  if (!latest || !previous) return null;
  // Whole numbers, like the badge and the history: scores are numeric(5,2).
  const round = (value: number | null) => value === null ? null : Math.round(value);
  const [from, to] = [round(previous.rhythmScore), round(latest.rhythmScore)];
  if (from !== null && to !== null && from !== to) return { metric: "rhythm", from, to };
  return { metric: "pronunciation", from: Math.round(previous.pronunciationScore as number), to: Math.round(latest.pronunciationScore as number) };
}

export function PronunciationDetails({ assessment, rhythmScore, pitch, pitchScore = null, items, onScore, historyStatus = "ready", onReload, retryDisabled, open, onOpenChange, contentId }: {
  assessment: Assessment | null; rhythmScore: number | null; pitch: PitchAccentScore | null;
  /** The stored score of a take whose contour is no longer in memory (after a reload): shown as a number, no overlay. */
  pitchScore?: number | null;
  items: SessionListItem[]; onScore(id: string): void;
  historyStatus?: "loading" | "ready" | "error"; onReload?(): void;
  retryDisabled?(id: string): boolean;
  open?: boolean; onOpenChange?(open: boolean): void; contentId?: string;
}) {
  const t = useTranslations("shadowing.workspace.practice.pronunciation");
  const format = useFormatter();
  const [localExpanded, setLocalExpanded] = useState(false);
  const localId = useId();
  const expanded = open ?? localExpanded;
  const setExpanded = onOpenChange ?? setLocalExpanded;
  const id = contentId ?? localId;
  const progress = progressLine(items);
  const metrics = [["accuracy", assessment?.accuracy], ["rhythm", rhythmScore], ["completeness", assessment?.completeness]] as const;
  return <section className="border-t border-border pt-sm">
    <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)} className="rounded-md px-sm py-xs text-body font-semibold hover:bg-muted">{t("details")}</button>
    {expanded && <div id={id} className="space-y-md pt-sm">
      {assessment === null && <p className="text-caption text-muted-foreground">{t("noDetail")}</p>}
      <dl className="grid grid-cols-3 gap-sm">{metrics.map(([key, value]) => value != null && <div key={key} className="rounded-lg bg-muted p-sm"><dt className="text-caption text-muted-foreground">{t(key)}</dt><dd className="text-body font-semibold tabular-nums">{Math.round(value)}</dd></div>)}</dl>
      {pitch ? <div><p className="text-caption text-muted-foreground">{t("intonation")}</p><PitchContourOverlay score={pitch} label={t("intonation")} /></div>
        : pitchScore != null && <div><p className="text-caption text-muted-foreground">{t("intonation")}</p><p className="text-body font-semibold tabular-nums">{Math.round(pitchScore)}</p></div>}
      {assessment?.recognizedText && <div><p className="text-caption text-muted-foreground">{t("heard")}</p><p lang="ja" className="font-jp text-body">{assessment.recognizedText}</p></div>}
      <div><h3 className="text-body font-semibold">{t("history")}</h3>
        {historyStatus === "loading" && <p role="status" className="text-caption">{t("historyLoading")}</p>}
        {historyStatus === "error" && <p role="alert" className="text-caption">{t("historyError")} <button type="button" className="underline" onClick={onReload}>{t("convertAgain")}</button></p>}
        {historyStatus === "ready" && items.length === 0 && <p className="text-caption text-muted-foreground">{t("historyEmpty")}</p>}
        <ol className="space-y-sm">{items.map((item) => <li key={item.id} className="space-y-xs rounded-lg border border-border p-sm text-caption">
          <div className="flex flex-wrap items-center justify-between gap-sm"><time dateTime={item.createdAt}>{format.dateTime(new Date(item.createdAt), { dateStyle: "short", timeStyle: "short" })}</time>
            <span>{item.state === "scored" && item.pronunciationScore !== null ? Math.round(item.pronunciationScore) : t(item.state === "scoring" ? "scoring" : "notScored")}</span>
          </div>
          {item.signedUrl && <audio controls preload="none" src={item.signedUrl} aria-label={t("playMine")} className="h-control w-full" />}
          {(item.state === "unscored" || item.state === "legacy") && <button type="button" disabled={item.format === "webm" || retryDisabled?.(item.id)} onClick={() => onScore(item.id)} className="rounded-md px-sm py-xs text-caption underline disabled:opacity-50">{t("scoreAgain")}</button>}
          {item.format === "webm" && <p className="text-muted-foreground">{t("legacy")}</p>}
        </li>)}</ol>
      </div>
      {progress && <p className="rounded-lg bg-muted p-sm text-caption">{t(`progress.${progress.metric}`, { from: progress.from, to: progress.to })}</p>}
    </div>}
  </section>;
}
