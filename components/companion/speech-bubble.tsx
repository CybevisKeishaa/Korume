"use client";

import { useTranslations } from "@/lib/i18n";
import type { CompanionSpeechKey } from "@/lib/companion/presence/speech";

/**
 * Renders one template address. The text is a `companion.speech.*` template
 * chosen by the pure core — surfaces never script it (spec 1 §5.12).
 *
 * `role="status"` (a polite live region) sits on the MESSAGE only, not on the
 * wrapper: a live region that also contains the dismiss control announces the
 * control's label alongside the line every time it changes.
 *
 * `speechKey` is a literal union, not `string`, so a key the catalog does not
 * carry fails to compile.
 */
export function SpeechBubble({
  speechKey,
  onDismiss,
}: {
  speechKey: CompanionSpeechKey;
  onDismiss: () => void;
}) {
  const t = useTranslations("companion");
  return (
    <div className="flex max-w-xs items-start gap-xs rounded-lg border border-border bg-overlay px-3 py-2 text-body text-foreground shadow-overlay">
      <p role="status" className="min-w-0">
        {t(speechKey)}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("a11y.dismissSpeech")}
        className="shrink-0 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
