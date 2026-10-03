"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useTranslations } from "@/lib/i18n";

/**
 * The message box. Enter sends, Shift+Enter breaks the line, and an Enter that confirms an IME conversion never
 * sends — Japanese input commits kana→kanji with Enter. No mic and no correction mode: no dead controls (§6.3).
 */
export function Composer({ onSend, disabled = false, placeholder }: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const t = useTranslations("companion");
  const [text, setText] = useState("");
  const hintId = useId();
  const canSend = !disabled && text.trim().length > 0;
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  };
  // The form's focus-within ring IS the focus indicator; the global :focus-visible ring on the textarea would draw a
  // second, square one inside it.
  return (
    <form
      className="rounded-lg border border-border bg-card px-md py-sm focus-within:ring-2 focus-within:ring-ring"
      onSubmit={(event) => { event.preventDefault(); submit(); }}
    >
      <div className="flex items-end gap-sm">
        <textarea
          data-korume-composer=""
          aria-label={t("ask.composerLabel")}
          aria-describedby={hintId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          maxLength={2000}
          className="max-h-[40vh] min-h-hit-target flex-1 resize-none bg-transparent py-xs text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label={t("ask.send")}
          disabled={!canSend}
          className="flex aspect-square h-control-md shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </div>
      <p id={hintId} className="mt-2xs text-end text-caption text-muted-foreground">{t("ask.hint")}</p>
    </form>
  );
}
