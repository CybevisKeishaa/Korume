"use client";

import { useId, useState, type RefObject } from "react";
import { useTranslations } from "@/lib/i18n";
import { AVATAR_INPUT_MAX_BYTES } from "@/lib/profile/avatar-limits";
import { Button } from "@/components/ui/button";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Choosing a photo and removing the uploaded one. Type and size are checked here so an obvious mistake never costs
 * an upload; the server re-checks everything (magic bytes, pixels) and is the authority.
 */
export function AvatarPicker({
  input, canRemove, onPick, onRemove,
}: {
  /** The one file input; the preview badge clicks the same element. */
  input: RefObject<HTMLInputElement>;
  canRemove: boolean; onPick: (file: File) => void; onRemove: () => void;
}) {
  const t = useTranslations("profile");
  const [error, setError] = useState<"type" | "size" | null>(null);
  const errorId = useId();

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("type");
    if (file.size > AVATAR_INPUT_MAX_BYTES) return setError("size");
    setError(null);
    onPick(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-sm">
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        aria-label={t("edit.avatar.label")}
        aria-describedby={error ? errorId : undefined}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
        {t("edit.avatar.change")}
      </Button>
      {canRemove && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t("edit.avatar.remove")}
        </Button>
      )}
      {error && <p id={errorId} role="alert" className="w-full text-caption text-danger-strong">{t(`edit.avatar.errors.${error}`)}</p>}
    </div>
  );
}
