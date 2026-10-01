"use client";

import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { TranscriptPanel } from "./transcript-panel";
import { useLesson } from "./workspace-context";

export function ShadowingModeBody() {
  const t = useTranslations("shadowing");
  const router = useRouter();
  const { transcriptId } = useLesson();

  if (transcriptId === null) {
    return (
      <section aria-label={t("workspace.regionLabel")}>
        <h2>{t("workspace.emptyTranscript.title")}</h2>
        <button type="button" onClick={() => router.refresh()}>{t("workspace.emptyTranscript.retry")}</button>
        <Link href="/shadowing">{t("workspace.emptyTranscript.backToHub")}</Link>
      </section>
    );
  }

  return (
    <section aria-label={t("workspace.regionLabel")} className="h-full p-md">
      <TranscriptPanel />
    </section>
  );
}
