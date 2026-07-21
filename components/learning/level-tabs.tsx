import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { JlptLevel } from "@/lib/validation/content";

const LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

/**
 * JLPT-level filter tabs. `active` undefined = the "All" tab. Rendered by
 * kanji, vocab (Task 8), grammar (Task 9) and jlpt (Task 13), so its two
 * translatable strings live under `common` (CLAUDE.md P4) — the N5–N1 level
 * labels themselves are data, not translated.
 */
export function LevelTabs({
  basePath,
  active,
}: {
  basePath: string;
  active?: JlptLevel;
}) {
  const t = useTranslations("common");
  return (
    <nav aria-label={t("a11y.levelFilter")} className="flex flex-wrap gap-2">
      <LevelTab href={basePath} label={t("filters.all")} isActive={!active} />
      {LEVELS.map((level) => (
        <LevelTab
          key={level}
          href={`${basePath}?level=${level}`}
          label={level}
          isActive={active === level}
        />
      ))}
    </nav>
  );
}

function LevelTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
