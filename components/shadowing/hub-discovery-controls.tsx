import { Input } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
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
  basePath: string;
  heading?: React.ReactNode;
  filterToggleLabel?: string;
  /** Null means the learner has not searched or filtered yet. */
  results: HubLesson[] | null;
  labels: HubDiscoveryControlsLabels;
}

/**
 * The Hub's quiet discovery entry point. It submits to the server-rendered
 * Hub route, keeping search/filtering in the same RLS-protected read model.
 */
export function HubDiscoveryControls({
  filters,
  query,
  activeFilter,
  results,
  action,
  basePath,
  heading,
  filterToggleLabel,
  labels,
}: HubDiscoveryControlsProps) {
  const activeFilterLabel = filters.find((filter) => `${filter.kind}:${filter.slug}` === activeFilter)?.label;
  const filterTriggerLabel = activeFilterLabel ? `${filterToggleLabel}: ${activeFilterLabel}` : filterToggleLabel;
  const filterLinks = (
    <nav aria-label={labels.searchLabel} className={cn("flex flex-wrap gap-xs", !heading && "mt-md")}>
      <Link
        href={basePath}
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
            href={`${basePath}?filter=${encodeURIComponent(value)}`}
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
  );

  const searchForm = (
    <form
      role="search"
      aria-label={labels.searchLabel}
      action={action}
      method="get"
      className={heading ? "min-w-0 flex-1" : undefined}
    >
      <label htmlFor="hub-search" className="sr-only">{labels.searchLabel}</label>
      {heading ? (
        <div className="relative">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute inset-y-0 left-sm my-auto size-icon-sm text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <Input
            id="hub-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={labels.searchPlaceholder}
            className="h-control-lg rounded-lg bg-card pl-lg"
          />
        </div>
      ) : (
        <Input
          id="hub-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={labels.searchPlaceholder}
          className="h-control-lg rounded-lg bg-card"
        />
      )}
    </form>
  );

  const resultsContent = results ? (
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
        <p className="mt-md text-body text-muted-foreground">{labels.noResults}</p>
      )}
    </div>
  ) : null;

  return (
    <section aria-label={labels.searchLabel}>
      {heading ? (
        <>
          <div className="lg:flex lg:items-end lg:justify-between">
            <div className="min-w-0">{heading}</div>
            <div className="mt-lg flex items-end gap-xs lg:mt-0 lg:basis-2/5 lg:shrink-0">
              {searchForm}
              <Popover
                align="end"
                trigger={(
                  <button type="button" aria-label={filterTriggerLabel} className={cn(
                    "flex h-control-lg min-h-hit-target aspect-square items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeFilter !== null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-primary-strong",
                  )}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 4h18l-7 8v5l-4 3v-8z" />
                  </svg>
                  </button>
                )}
              >
                {filterLinks}
              </Popover>
            </div>
          </div>
          {resultsContent}
        </>
      ) : (
        <>
          {searchForm}
          {filterLinks}
          {resultsContent}
        </>
      )}
    </section>
  );
}
