import { useTranslations } from "@/lib/i18n";

export interface TranslationDisclosureProps {
  translation: string | null;
}

/**
 * Collapsed-by-default reveal for the passage's translation — learners
 * shouldn't see it before attempting the passage themselves. Native
 * `<details>/<summary>` gives keyboard operability (Enter/Space toggle,
 * focusable) and screen-reader semantics for free, no JS state needed.
 *
 * `translation` is passage CONTENT (spec D8) and is rendered raw, never
 * localized — only the `<summary>` chrome label is.
 */
export function TranslationDisclosure({ translation }: TranslationDisclosureProps) {
  const t = useTranslations("reading");
  if (!translation) return null;

  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">{t("translation.show")}</summary>
      <p className="mt-2 text-sm text-muted-foreground">{translation}</p>
    </details>
  );
}
