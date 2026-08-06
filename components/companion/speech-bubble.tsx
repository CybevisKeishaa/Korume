"use client";

import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CompanionSpeechKey } from "@/lib/companion/presence/speech";

/**
 * Renders one template address. The text is a `companion.speech.*` template
 * chosen by the pure core — surfaces never script it (spec 1 §5.12).
 *
 * The `role="status"` element is ALWAYS mounted, even with nothing to say, and
 * only its TEXT changes when an address is granted. Screen readers commonly do
 * NOT announce a live region that appears already populated — the reliable
 * pattern is a persistent region whose contents change after mount. That is
 * why `speechKey` is nullable here rather than the anchor conditionally
 * mounting this whole component (CLAUDE.md §2.5).
 *
 * The region must never be `hidden` when silent either: a `display: none`
 * subtree is dropped from the accessibility tree, so its live region stops
 * being monitored — the same bug in a different costume.
 *
 * The live region carries the MESSAGE only, never the dismiss control: a live
 * region announces its whole subtree, so a nested button would append its
 * label to every line the Companion says. The chrome — border, surface,
 * dismiss button, and the inline offset from the sprite — is what appears and
 * disappears around the persistent region.
 *
 * `speechKey` is a literal union, not `string`, so a key the catalog does not
 * carry fails to compile.
 */
export function SpeechBubble({
  speechKey,
  onDismiss,
}: {
  speechKey: CompanionSpeechKey | null;
  onDismiss: () => void;
}) {
  const t = useTranslations("companion");
  const speaking = speechKey !== null;
  return (
    <div
      className={cn(
        "flex max-w-xs items-start gap-xs",
        // Silent: no chrome and no inline offset, so the empty region has zero
        // visual footprint beside the sprite.
        speaking &&
          "ms-xs rounded-lg border border-border bg-overlay px-3 py-2 text-body text-foreground shadow-overlay",
      )}
    >
      <p role="status" className="min-w-0">
        {speechKey !== null ? t(speechKey) : ""}
      </p>
      {speaking ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("a11y.dismissSpeech")}
          className="shrink-0 rounded px-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
