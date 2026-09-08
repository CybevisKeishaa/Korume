import { Input } from "@/components/ui/input";
import { Link } from "@/lib/i18n/navigation";
import type { HubLesson } from "@/lib/data/shadowing-hub";
import { cn } from "@/lib/utils";
import { HubLessonCard } from "./hub-lesson-card";
import { HubSectionHeading } from "./hub-section-heading";

export interface HubDiscoveryFilter {
  kind: "situation" | "source";
  slug: string;
  label: string;
}

export interface HubDiscoveryControlsLabels {
  searchLabel: string;
  searchPlaceholder: string;
  all: string;
  results: string;
  noResults: string;
  start: string;
  noThumbnail: string;
}

export interface HubDiscoveryControlsProps {
  filters: HubDiscoveryFilter[];
  query: string;
  activeFilter: string | null;
  action: string;
  /** Null means the learner has not searched or filtered yet. */
  results: HubLesson[] | null;
  labels: HubDiscoveryControlsLabels;
}

/**
 * The Hub's quiet discovery entry point. It submits to the server-rendered
 * Hub route, keeping search/filtering in the same RLS-protected read model.
 */
export function HubDiscoveryControls({ filters, query, activeFilter, results, action, labels }: HubDiscoveryControlsProps) {
  return (
    <section aria-label={labels.searchLabel}>
      <form role="search" aria-label={labels.searchLabel} action={action} method="get">
        <label htmlFor="hub-search" className="sr-only">{labels.searchLabel}</label>
        <Input
          id="hub-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={labels.searchPlaceholder}
          className="h-11 rounded-lg bg-card"
        />
      </form>

      <nav aria-label={labels.searchLabel} className="mt-md flex flex-wrap gap-xs">
        <Link
          href="/shadowing"
          aria-current={activeFilter === null ? "page" : undefined}
          className={cn(
            "rounded-full border px-sm py-xs text-caption font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeFilter === null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {labels.all}
        </Link>
        {filters.map((filter) => {
          const value = `${filter.kind}:${filter.slug}`;
          return (
            <Link
              key={value}
              href={`/shadowing?filter=${encodeURIComponent(value)}`}
              aria-current={activeFilter === value ? "page" : undefined}
              className={cn(
                "rounded-full border px-sm py-xs text-caption font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeFilter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {results ? (
        <div className="mt-xl">
          <HubSectionHeading title={labels.results} />
          {results.length ? (
            <ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2">
              {results.map((lesson) => (
                <HubLessonCard
                  key={lesson.id}
                  lesson={lesson}
                  href={`/shadowing/${lesson.id}`}
                  actionLabel={labels.start}
                  noThumbnailLabel={labels.noThumbnail}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-md text-sm text-muted-foreground">{labels.noResults}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
