"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DEFAULT_PREFERENCES, type PronunciationDuration, type PronunciationSort } from "@/lib/preferences/options";

export interface HubDisplayPanelLabels {
  trigger: string;
  title: string;
  sort: string;
  recommended: string;
  newest: string;
  shortest: string;
  inProgress: string;
  duration: string;
  anyDuration: string;
  underTen: string;
  tenToThirty: string;
  overThirty: string;
  hideCompleted: string;
  apply: string;
  reset: string;
  close: string;
  saveFailed: string;
}

export interface HubDisplayValue {
  sort: PronunciationSort;
  duration: PronunciationDuration;
  hideCompleted: boolean;
}

const DEFAULTS: HubDisplayValue = {
  sort: DEFAULT_PREFERENCES.pronunciationSort,
  duration: DEFAULT_PREFERENCES.pronunciationDuration,
  hideCompleted: DEFAULT_PREFERENCES.pronunciationHideCompleted,
};

const OPTION = "flex min-h-hit-target items-center gap-sm text-body text-foreground";
const CONTROL = "size-icon-sm accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The studio's Sort & display panel (ruling 8). The applied view lives in the
 * URL, so it is shareable and Back restores it; Apply also saves it to the
 * profile, which the page applies on a visit whose URL sets none of it.
 */
export function HubDisplayPanel({ value, labels }: { value: HubDisplayValue; labels: HubDisplayPanelLabels }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveFailed, setSaveFailed] = useState(false);
  const customised = value.sort !== DEFAULTS.sort || value.duration !== DEFAULTS.duration || value.hideCompleted !== DEFAULTS.hideCompleted;

  // Every opening starts from the applied view, so a cancelled draft is never saved later.
  function openPanel(): void {
    setDraft(value);
    setOpen(true);
  }

  async function apply(): Promise<void> {
    let saved = false;
    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pronunciationSort: draft.sort, pronunciationDuration: draft.duration, pronunciationHideCompleted: draft.hideCompleted }),
      });
      saved = response.ok;
    } catch {
      saved = false;
    }
    setSaveFailed(!saved);

    // `q` and `filter` survive. A default is omitted, since the saved profile
    // matches it; when the save failed every value is spelled out, because an
    // empty URL would bring the OLD profile back.
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const entries: Array<[string, string, boolean]> = [
      ["sort", draft.sort, draft.sort === DEFAULTS.sort],
      ["duration", draft.duration ?? "any", draft.duration === DEFAULTS.duration],
      ["hideCompleted", String(draft.hideCompleted), draft.hideCompleted === DEFAULTS.hideCompleted],
    ];
    for (const [key, raw, isDefault] of entries) {
      if (isDefault && saved) params.delete(key);
      else params.set(key, raw);
    }
    setOpen(false);
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
    // A URL without display params renders from the profile, and the router
    // may hold that URL's payload from before the save: refetch it.
    router.refresh();
  }

  const radio = <T extends string | null>(name: string, current: T, options: ReadonlyArray<readonly [T, string]>, onPick: (next: T) => void) => (
    options.map(([option, label]) => (
      <label key={option ?? "any"} className={OPTION}>
        <input type="radio" name={name} className={CONTROL} checked={current === option} onChange={() => onPick(option)} />
        {label}
      </label>
    ))
  );

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={labels.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPanel}
        className={cn(
          "flex h-control-lg min-h-hit-target aspect-square items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Marked like the filter toggle when the applied view is not the default.
          customised ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-primary-strong",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4" />
        </svg>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={labels.title} closeLabel={labels.close}>
        <fieldset>
          <legend className="text-body font-semibold text-foreground">{labels.sort}</legend>
          {radio<PronunciationSort>("pronunciation-sort", draft.sort, [
            ["recommended", labels.recommended], ["newest", labels.newest], ["shortest", labels.shortest], ["in_progress", labels.inProgress],
          ], (sort) => setDraft({ ...draft, sort }))}
        </fieldset>
        <fieldset className="mt-md">
          <legend className="text-body font-semibold text-foreground">{labels.duration}</legend>
          {radio<PronunciationDuration>("pronunciation-duration", draft.duration, [
            [null, labels.anyDuration], ["under_10", labels.underTen], ["10_30", labels.tenToThirty], ["over_30", labels.overThirty],
          ], (duration) => setDraft({ ...draft, duration }))}
        </fieldset>
        <label className={`mt-md ${OPTION}`}>
          <input type="checkbox" className={CONTROL} checked={draft.hideCompleted} onChange={(event) => setDraft({ ...draft, hideCompleted: event.target.checked })} />
          {labels.hideCompleted}
        </label>
        <div className="mt-lg flex justify-end gap-sm">
          <Button type="button" variant="outline" onClick={() => setDraft(DEFAULTS)}>{labels.reset}</Button>
          <Button type="button" onClick={() => void apply()}>{labels.apply}</Button>
        </div>
      </Dialog>
      {/* Always mounted, so screen readers announce the text when it appears;
          out of the toolbar's flow, so it cannot squeeze the search row. */}
      <p role="status" className="absolute right-0 top-full mt-xs w-max max-w-xs text-right text-caption text-danger-strong">{saveFailed ? labels.saveFailed : ""}</p>
    </div>
  );
}
