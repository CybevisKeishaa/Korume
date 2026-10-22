"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslations } from "@/lib/i18n";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import type { ListeningFormat } from "@/lib/shadowing-workspace/learning-modes";

/**
 * Word Bank | Typing (spec §5.1). It changes only `?format=` (P10); the reveal key that conceals the new attempt
 * reads that URL (P11), so nothing here touches attempt state. An attempt in progress is discarded only after an
 * in-app confirm. On an unreliable line Word Bank is disabled with the D9 reason.
 */
export function ListeningFormatSwitch({ format, inProgress, wordBankAvailable }: {
  format: ListeningFormat;
  inProgress: boolean;
  wordBankAvailable: boolean;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<ListeningFormat | null>(null);

  const go = (next: ListeningFormat) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };
  const choose = (next: ListeningFormat) => {
    if (next === format) return;
    if (inProgress) setPending(next);
    else go(next);
  };
  const confirm = () => {
    if (pending) go(pending);
    setPending(null);
  };

  return <>
    <SegmentedControl value={format} onValueChange={choose} aria-label={t("formatLabel")} className="self-start" options={[
      { value: "word_bank", label: t("format.word_bank"), disabled: !wordBankAvailable, title: wordBankAvailable ? undefined : t("unreliable") },
      { value: "typing", label: t("format.typing") },
    ]} />
    <Dialog open={pending !== null} onClose={() => setPending(null)} title={t("discard.title")} description={t("discard.body")} closeLabel={t("discard.keep")}>
      <div className="flex justify-end gap-sm">
        <Button variant="ghost" onClick={() => setPending(null)}>{t("discard.keep")}</Button>
        <Button onClick={confirm}>{t("discard.confirm")}</Button>
      </div>
    </Dialog>
  </>;
}
