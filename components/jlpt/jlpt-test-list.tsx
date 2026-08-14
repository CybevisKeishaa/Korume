import { useTranslations } from "@/lib/i18n";
import type { JlptTestListItem } from "@/lib/jlpt-ui";
import { JlptTestCard } from "./jlpt-test-card";

export interface JlptTestListProps {
  tests: JlptTestListItem[];
}

/**
 * The `/certification` test list, grouped implicitly by the caller's level
 * filter. A non-async Server Component — `useTranslations` works here without
 * `"use client"` (same precedent as `components/learning/recommendation-rail.tsx`).
 */
export function JlptTestList({ tests }: JlptTestListProps) {
  const t = useTranslations("jlpt");

  if (tests.length === 0) {
    return <p className="text-muted-foreground">{t("testList.empty")}</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {tests.map((test) => (
        <li key={test.id}>
          <JlptTestCard test={test} />
        </li>
      ))}
    </ul>
  );
}
