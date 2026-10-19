"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { hasUnsaved } from "@/lib/pronunciation/attempts";
import { locateSentence } from "@/lib/shadowing-workspace/sentence-lookup";
import { useCurrentSentence, useLesson, usePlaybackController, useStartPosition } from "../workspace-context";
import { PracticePanel } from "./practice-panel";
import { SentenceNavigator } from "./sentence-navigator";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";
import { PronunciationDetails } from "./pronunciation-details";
import { PronunciationPanel } from "./pronunciation-panel";
import { usePronunciationCapture } from "./use-pronunciation-capture";
import { usePronunciationSessions } from "./use-pronunciation-sessions";

export function PronunciationModeBody() {
  const t = useTranslations("shadowing");
  const router = useRouter();
  const { transcriptId, lines, video } = useLesson();
  const { index } = useCurrentSentence();
  const start = useStartPosition();
  const controller = usePlaybackController();
  const { attempts } = usePronunciationAttempts();
  const lineId = index === null ? null : lines[index]?.id ?? null;
  const sessions = usePronunciationSessions(lineId);
  const capture = usePronunciationCapture(sessions.saved);
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => { setDetailsOpen(false); }, [lineId]);
  useEffect(() => {
    if (index === null && lines.length) controller.seekToSentence(locateSentence(lines, start, video.durationSeconds).index ?? 0);
  }, [controller, index, lines, start, video.durationSeconds]);
  if (transcriptId === null) return <section aria-label={t("workspace.regionLabel")}>
    <h2>{t("workspace.emptyTranscript.title")}</h2>
    <button type="button" onClick={() => router.refresh()}>{t("workspace.emptyTranscript.retry")}</button>
    <Link href="/shadowing">{t("workspace.emptyTranscript.backToHub")}</Link>
  </section>;
  const unsaved = hasUnsaved(attempts);
  return <PracticePanel label={t("workspace.practice.pronunciation.region")}
    navigator={<SentenceNavigator disabled={unsaved} disabledHint={t("workspace.practice.pronunciation.finishSaving")} />}
    feedback={<PronunciationDetails key={lineId} open={detailsOpen} onOpenChange={setDetailsOpen} contentId={detailsId} pitch={sessions.attempt?.pitch ?? null} pitchScore={sessions.selected?.pitchScore ?? null}
      items={sessions.items} historyStatus={sessions.historyStatus} retryDisabled={sessions.retryDisabled} onReload={() => { if (lineId) void sessions.reload(lineId); }}
      onScore={(sessionId) => { if (lineId) void sessions.score(sessionId, lineId); }} />}>
    <PronunciationPanel index={index} capture={capture} sessions={sessions} detailsOpen={detailsOpen} detailsId={detailsId} onToggleDetails={() => setDetailsOpen(!detailsOpen)} />
  </PracticePanel>;
}
