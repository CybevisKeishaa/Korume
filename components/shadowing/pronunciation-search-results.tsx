import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { SearchType } from "@/lib/validation/pronunciation-search";
import { cn } from "@/lib/utils";
import { HubResultsPager } from "./hub-results-pager";
import { HubSectionHeading } from "./hub-section-heading";

export interface PronunciationResultTab {
  key: "all" | SearchType;
  /** The visible label, count included: the count is part of the tab's accessible name. */
  label: string;
  href: string;
  current: boolean;
}

export interface PronunciationResultGroup {
  key: SearchType;
  title: string;
  seeAll: { href: string; label: string } | null;
  /** Rendered cards, each an `<li>`. */
  items: ReactNode[];
}

export interface PronunciationSearchResultsProps {
  heading: string;
  summary?: string;
  /** Null in Browse, which shows lessons only. */
  tabs: { label: string; items: PronunciationResultTab[] } | null;
  /** All: every group, as one-row previews. A tab or Browse: its one group, paged. */
  groups: PronunciationResultGroup[];
  preview: boolean;
  more: { href: string; label: string; pendingLabel: string } | null;
  /** Shown when every group is empty; empty groups are never rendered. */
  empty: string;
}

/**
 * The pronunciation result surface (search spec 2026-10-01): one grid for every
 * group and state inside a container-query pane. A preview grid hides what
 * would wrap to a second row with `display: none` (app/globals.css), so hidden
 * cards leave the tab order and the accessibility tree.
 */
export function PronunciationSearchResults({ heading, summary, tabs, groups, preview, more, empty }: PronunciationSearchResultsProps) {
  const shown = groups.filter((group) => group.items.length > 0);
  const single = shown[0];

  return (
    <div className="result-pane mt-xl">
      <HubSectionHeading title={heading} />
      {summary ? <p className="mt-xs text-body text-muted-foreground">{summary}</p> : null}
      {tabs ? (
        <nav aria-label={tabs.label} className="mt-md">
          <ul className="flex flex-wrap gap-xs">
            {tabs.items.map((tab) => (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={tab.current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-hit-target items-center rounded-full border px-md text-caption font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tab.current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {!single ? (
        <p className="mt-md text-body text-muted-foreground">{empty}</p>
      ) : preview ? (
        shown.map((group) => (
          <section key={group.key} aria-labelledby={`result-group-${group.key}`} className="mt-xl">
            <div className="flex items-end justify-between gap-md">
              {/* h2, beside the results heading: the cards inside are h3, so a
                  group title must outrank them for heading navigation. */}
              <h2 id={`result-group-${group.key}`} className="text-heading font-semibold text-foreground">{group.title}</h2>
              {group.seeAll ? (
                <Link href={group.seeAll.href} className="inline-flex min-h-hit-target shrink-0 items-center text-caption font-semibold text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {group.seeAll.label} <span aria-hidden="true">&nbsp;→</span>
                </Link>
              ) : null}
            </div>
            <ul className="result-grid result-preview mt-md">{group.items}</ul>
          </section>
        ))
      ) : (
        // Always the pager, even with no next page: it must stay mounted across
        // the last "Show more" to put focus on the cards that page added.
        <HubResultsPager count={single.items.length} more={more}>
          <ul className="result-grid mt-md">{single.items}</ul>
        </HubResultsPager>
      )}
    </div>
  );
}
