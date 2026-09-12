"use client";

import { useState } from "react";
import type { ExploreShelf } from "@/lib/data/shadowing-explore";
import { HubSectionHeading } from "./hub-section-heading";
import { ExplorePreviewDrawer, type ExplorePreviewDrawerLabels, type ExplorePreviewLesson } from "./explore-preview-drawer";
import { ExploreLessonCard } from "./explore-lesson-card";

export function ExploreShelves({ shelves, labels }: {
  shelves: ExploreShelf[];
  labels: { start: string; preview: string; noThumbnail: string; empty: string; moreAvailable: string; drawer: ExplorePreviewDrawerLabels };
}) {
  const [selected, setSelected] = useState<ExplorePreviewLesson | null>(null);

  return (
    <>
      <div className="space-y-3xl">
        {shelves.map((shelf) => (
          <section key={shelf.collection.id} aria-label={shelf.collection.title}>
            <HubSectionHeading title={shelf.collection.title} />
            {shelf.lessons.length ? (
              <ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
                {shelf.lessons.map((lesson) => (
                  <ExploreLessonCard key={lesson.id} lesson={lesson} labels={labels} onPreview={setSelected} />
                ))}
              </ul>
            ) : (
              <p className="mt-md text-sm text-muted-foreground">{labels.empty}</p>
            )}
            {shelf.hasMore ? <p className="mt-sm text-sm text-muted-foreground">{labels.moreAvailable}</p> : null}
          </section>
        ))}
      </div>
      {selected ? <ExplorePreviewDrawer lesson={selected} onClose={() => setSelected(null)} labels={labels.drawer} /> : null}
    </>
  );
}
