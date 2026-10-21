"use client";

import { useTranslations } from "@/lib/i18n";

/**
 * The listen-only cover (spec §5.9, D19). It hides the picture, not the player: it sits above the iframe and its
 * click surface and below the control bar and centre play button (DOM order, no z-index), and takes no pointer
 * itself, so a click on the picture still toggles play and every control stays usable. Only "Show video" is live.
 */
export function ListenCover({ onShow }: { onShow(): void }) {
  const t = useTranslations("shadowing.workspace.practice.listening.cover");
  return (
    <div data-testid="listen-cover" className="pointer-events-none absolute inset-0 flex flex-col items-center gap-2xs bg-card p-sm text-center">
      <p className="text-caption font-semibold text-muted-foreground">{t("title")}</p>
      <button type="button" aria-pressed={false} onClick={onShow}
        className="pointer-events-auto rounded-md border border-border px-sm py-2xs text-caption font-medium text-foreground transition-colors hover:bg-muted">
        {t("show")}
      </button>
    </div>
  );
}
