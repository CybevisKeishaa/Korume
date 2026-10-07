"use client";

import { useTranslations } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import type { Draft } from "./draft";

/**
 * The frame's "Privacy" section, renamed: Show Korume is the only control that survives R3 (spec §8.3). It writes
 * `companion_enabled`, the same column the `/settings` switch writes (R5).
 */
export function KorumeSection({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  const t = useTranslations("profile");
  return (
    <section aria-labelledby="profile-edit-korume" className="grid gap-sm border-t border-border pt-md">
      <h2 id="profile-edit-korume" className="text-body-lg font-semibold">{t("edit.sections.korume")}</h2>
      <div className="flex items-center justify-between gap-sm">
        <span aria-hidden="true" className="text-body">{t("edit.fields.showKorume")}</span>
        <Switch checked={draft.companionEnabled} onCheckedChange={(companionEnabled) => set({ companionEnabled })} aria-label={t("edit.fields.showKorume")} />
      </div>
    </section>
  );
}
