"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { locateSentence } from "@/lib/shadowing-workspace/sentence-lookup";
import { useCurrentSentence, useLesson, usePlaybackController, useStartPosition } from "../workspace-context";

export function PracticePanel({ label, navigator, feedback, children }: {
  label: string;
  navigator: ReactNode;
  feedback: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex h-full min-h-0 flex-col gap-md overflow-y-auto p-md" data-testid="practice-panel">
      <div>{navigator}</div>
      <div className="flex flex-col gap-md">{children}</div>
      <div>{feedback}</div>
    </section>
  );
}

/** A practice mode opened before any line is current lands on the line at the start position. */
export function useFirstPracticeSentence(): void {
  const { lines, video } = useLesson();
  const { index } = useCurrentSentence();
  const start = useStartPosition();
  const controller = usePlaybackController();
  useEffect(() => {
    if (index === null && lines.length) controller.seekToSentence(locateSentence(lines, start, video.durationSeconds).index ?? 0);
  }, [controller, index, lines, start, video.durationSeconds]);
}

/** What a practice mode shows for a lesson with no transcript. */
export function PracticeEmptyTranscript() {
  const t = useTranslations("shadowing");
  const router = useRouter();
  return <section aria-label={t("workspace.regionLabel")}>
    <h2>{t("workspace.emptyTranscript.title")}</h2>
    <button type="button" onClick={() => router.refresh()}>{t("workspace.emptyTranscript.retry")}</button>
    <Link href="/shadowing">{t("workspace.emptyTranscript.backToHub")}</Link>
  </section>;
}
