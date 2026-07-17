import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { JlptLevel } from "@/lib/validation/content";

const LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

/** JLPT-level filter tabs. `active` undefined = the "All" tab. */
export function LevelTabs({
  basePath,
  active,
}: {
  basePath: string;
  active?: JlptLevel;
}) {
  return (
    <nav aria-label="JLPT level" className="flex flex-wrap gap-2">
      <LevelTab href={basePath} label="All" isActive={!active} />
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
