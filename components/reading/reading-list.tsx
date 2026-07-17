"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JLPT_LEVELS, type JlptLevel, type ReadingPassageListItem } from "@/lib/reading-types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; passages: ReadingPassageListItem[] };

/** Client-side level filter — a local pill row (not URL-driven, since this
 * component owns its own fetch to `GET /api/reading?level=`) styled to match
 * `components/learning/level-tabs.tsx`'s "All" + N5..N1 pattern. */
function LevelFilter({
  active,
  onChange,
}: {
  active: JlptLevel | undefined;
  onChange: (level: JlptLevel | undefined) => void;
}) {
  return (
    <div role="group" aria-label="Filter by JLPT level" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={!active}
        onClick={() => onChange(undefined)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          !active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        All
      </button>
      {JLPT_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          aria-pressed={active === level}
          onClick={() => onChange(level)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            active === level
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

/**
 * Reading passage list (Layer 5, spec §3.7): JLPT-level filter + cards.
 * Entirely client-rendered against `GET /api/reading?level=` — no direct
 * `lib/data` import, so this stays decoupled from the reading data layer
 * while it's still under active development in this same branch.
 */
export function ReadingList() {
  const [level, setLevel] = useState<JlptLevel | undefined>(undefined);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const query = level ? `?level=${level}` : "";
    fetch(`/api/reading${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("request failed");
        const json = (await res.json()) as { data: ReadingPassageListItem[] };
        if (!cancelled) setState({ status: "loaded", passages: json.data });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "Could not load reading passages. Please try again." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [level]);

  return (
    <div className="space-y-6">
      <LevelFilter active={level} onChange={setLevel} />

      {state.status === "loading" && (
        <p className="text-sm text-muted-foreground">Loading reading passages…</p>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      {state.status === "loaded" && state.passages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No reading passages{level ? ` at this level` : ""} yet.
        </p>
      )}

      {state.status === "loaded" && state.passages.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.passages.map((passage) => (
            <li key={passage.id}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium">{passage.title}</h2>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {passage.jlpt_level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {passage.word_count != null ? `${passage.word_count} words` : "Word count unknown"}
                </p>
                <Link
                  href={`/reading/${passage.id}`}
                  className={cn(buttonStyles({ variant: "outline", size: "sm" }), "mt-auto")}
                >
                  Read passage
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
