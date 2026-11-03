"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { hasUnsaved } from "@/lib/pronunciation/attempts";
import { useCurrentSentence, useLesson } from "../workspace-context";
import { PracticeEmptyTranscript, PracticePanel, useFirstPracticeSentence } from "./practice-panel";
import { SentenceNavigator } from "./sentence-navigator";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";
import { PronunciationDetails } from "./pronunciation-details";
import { PronunciationPanel } from "./pronunciation-panel";
import { usePronunciationCapture } from "./use-pronunciation-capture";
import { usePronunciationSessions } from "./use-pronunciation-sessions";

export function PronunciationModeBody() {
  const t = useTranslations("shadowing");
  const { transcriptId, lines } = useLesson();
  const { index } = useCurrentSentence();
  const { attempts } = usePronunciationAttempts();
  const lineId = index === null ? null : lines[index]?.id ?? null;
  const sessions = usePronunciationSessions(lineId);
  const capture = usePronunciationCapture(sessions.saved);
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => { setDetailsOpen(false); }, [lineId]);
  useFirstPracticeSentence();
  if (transcriptId === null) return <PracticeEmptyTranscript />;
  const unsaved = hasUnsaved(attempts);
  return <PracticePanel label={t("workspace.practice.pronunciation.region")}
    navigator={<SentenceNavigator disabled={unsaved} disabledHint={t("workspace.practice.pronunciation.finishSaving")} />}
    feedback={<PronunciationDetails key={lineId} open={detailsOpen} onOpenChange={setDetailsOpen} contentId={detailsId} pitch={sessions.attempt?.pitch ?? null} pitchScore={sessions.selected?.pitchScore ?? null}
      items={sessions.items} historyStatus={sessions.historyStatus} retryDisabled={sessions.retryDisabled} onReload={() => { if (lineId) void sessions.reload(lineId); }}
      onScore={(sessionId) => { if (lineId) void sessions.score(sessionId, lineId); }} />}>
    <PronunciationPanel index={index} capture={capture} sessions={sessions} detailsOpen={detailsOpen} detailsId={detailsId} onToggleDetails={() => setDetailsOpen(!detailsOpen)} />
  </PracticePanel>;
}
