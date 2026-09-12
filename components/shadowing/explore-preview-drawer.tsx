"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

export interface ExplorePreviewLesson {
  id: string;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  jlptLevelEstimate: string | null;
  transcriptPreview: string[];
  lineCount: number;
  wordCount: number;
}

export interface ExplorePreviewDrawerLabels {
  close: string;
  start: string;
  add: string;
  added: string;
  adding: string;
  addFailed: string;
  transcript: string;
  transcriptUnavailable: string;
  /** Localized template with a literal `{count}` placeholder. */
  durationTemplate: string;
  metadata: { jlpt: string; duration: string; vocabulary: string; sentences: string };
}

function durationValue(seconds: number | null, template: string): string {
  return seconds === null ? "—" : template.replace("{count}", `${Math.max(1, Math.round(seconds / 60))}`);
}

export function ExplorePreviewDrawer({ lesson, onClose, labels }: {
  lesson: ExplorePreviewLesson;
  onClose: () => void;
  labels: ExplorePreviewDrawerLabels;
}) {
  const [state, setState] = useState<"idle" | "adding" | "added" | "failed">("idle");

  async function addToLibrary(): Promise<void> {
    setState("adding");
    try {
      const response = await fetch(`/api/videos/${lesson.id}/library`, { method: "POST" });
      if (!response.ok) throw new Error("Library add failed");
      setState("added");
    } catch {
      setState("failed");
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={lesson.title}
      closeLabel={labels.close}
      className="!left-auto !right-0 !top-0 h-[100svh] max-h-none !w-[420px] max-w-full !translate-x-0 !translate-y-0 rounded-none border-y-0 border-r-0 p-lg motion-reduce:transition-none"
    >
      <div className="space-y-lg">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {lesson.thumbnailUrl ? <Image src={lesson.thumbnailUrl} alt="" fill sizes="420px" className="object-cover" /> : null}
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
          {[
            [labels.metadata.jlpt, lesson.jlptLevelEstimate ?? "—"],
            [labels.metadata.duration, durationValue(lesson.durationSeconds, labels.durationTemplate)],
            [labels.metadata.vocabulary, `${lesson.wordCount}`],
            [labels.metadata.sentences, `${lesson.lineCount}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-card p-sm">
              <dt className="text-caption uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-2xs font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <section aria-label={labels.transcript}>
          <h3 className="text-sm font-semibold text-foreground">{labels.transcript}</h3>
          {lesson.transcriptPreview.length ? (
            <ol className="mt-sm space-y-sm text-sm text-muted-foreground">
              {lesson.transcriptPreview.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
            </ol>
          ) : (
            <p className="mt-sm text-sm text-muted-foreground">{labels.transcriptUnavailable}</p>
          )}
        </section>
        <div className="grid gap-sm">
          <Link href={`/shadowing/${lesson.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-md text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {labels.start}
          </Link>
          <Button type="button" variant="outline" onClick={() => void addToLibrary()} disabled={state === "adding" || state === "added"}>
            {state === "adding" ? labels.adding : state === "added" ? labels.added : labels.add}
          </Button>
          {state === "failed" ? <p role="alert" className="text-sm text-danger-strong">{labels.addFailed}</p> : null}
        </div>
      </div>
    </Dialog>
  );
}
