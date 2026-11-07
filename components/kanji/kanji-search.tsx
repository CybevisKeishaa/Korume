"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { kanjiPageHref } from "@/lib/kanji/href";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import type { KanjiSearchResponse } from "@/lib/kanji/search";

const DEBOUNCE_MS = 200;

type State =
  | { status: "idle" }
  // The last answer stays up while the next one loads, so typing does not flash the list.
  | { status: "loading"; previous: KanjiSearchResponse | null }
  | { status: "done"; response: KanjiSearchResponse }
  | { status: "error"; message: string };

/** `/` from anywhere on the page focuses the search, never while the learner is typing in a field. */
function typingIn(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * Find another kanji from `/kanji/[literal]` (port-kanji Task 12): a WAI-ARIA combobox over `GET /api/kanji/search`.
 * A typed word shows its kanji as tiles; a reading, a Hán Việt or a meaning shows rows. The list overlays the page
 * (K1: it never pushes the layout) and nothing here takes focus on load (owner focus rule 2026-11-07).
 */
export function KanjiSearch() {
  const t = useTranslations("kanji");
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const trimmed = query.trim();
  // The effect reads the latest translator without re-running (and aborting) on a new function identity.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    setActive(-1);
    if (!trimmed) return setState({ status: "idle" });
    setState((last) => ({ status: "loading", previous: last.status === "done" ? last.response : last.status === "loading" ? last.previous : null }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/kanji/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (response.ok) return setState({ status: "done", response: (await response.json()) as KanjiSearchResponse });
        const seconds = response.status === 429 ? response.headers.get("Retry-After") : null;
        setState({ status: "error", message: seconds ? tRef.current("inspect.rateLimited", { seconds }) : tRef.current("search.failed") });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error", message: tRef.current("search.failed") });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || typingIn(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const shown = state.status === "done" ? state.response : state.status === "loading" ? state.previous : null;
  const results = shown?.results ?? [];
  const tiles = shown?.mode === "chars" && [...shown.query].length > 1;
  const expanded = open && trimmed !== "";
  const optionId = (index: number) => `${id}-option-${index}`;

  function go(literal: string) {
    setOpen(false);
    router.push(kanjiPageHref(literal));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (count === 0) return;
      setActive((current) => (event.key === "ArrowDown" ? (current + 1) % count : current <= 0 ? count - 1 : current - 1));
    } else if (event.key === "Enter") {
      const highlighted = expanded ? results[active] : undefined;
      const typed = parseKanjiLiteral(trimmed);
      if (highlighted || typed) {
        event.preventDefault();
        go(highlighted?.literal ?? (typed as string));
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (expanded) setOpen(false);
      else setQuery("");
      setActive(-1);
    }
  }

  const status =
    state.status === "loading" ? (results.length > 0 ? null : t("search.loading"))
    : state.status === "error" ? state.message
    : state.status === "done" && results.length === 0 ? t("search.empty")
    : null;
  // Read out once a search settles (never "Searching…" on every key): the count, "none", or the error.
  const announce = state.status === "loading" ? "" : status ?? (results.length > 0 ? t("search.results", { count: results.length }) : "");

  return (
    <div className="relative min-w-[calc(150*var(--density-unit))] max-w-[calc(260*var(--density-unit))] flex-1">
      <Search aria-hidden="true" className="pointer-events-none absolute start-sm top-1/2 size-icon-xs -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={t("search.label")}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        aria-keyshortcuts="/"
        autoComplete="off"
        spellCheck={false}
        placeholder={t("search.placeholder")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="peer h-control-sm w-full rounded-full border border-border bg-background pe-[calc(var(--space-sm)+var(--icon-sm))] ps-[calc(var(--space-sm)+var(--icon-xs)+var(--space-2xs))] text-body text-foreground placeholder:text-muted-foreground hover:bg-muted/60 focus:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query === "" && (
        <kbd aria-hidden="true" className="pointer-events-none absolute end-sm top-1/2 -translate-y-1/2 rounded-sm border border-border px-2xs font-mono text-caption text-muted-foreground peer-focus:hidden">
          /
        </kbd>
      )}
      <p role="status" className="sr-only">{announce}</p>
      {expanded && (
        <div className="absolute end-0 top-full z-popover mt-2xs flex max-h-[60dvh] w-[max(100%,calc(340*var(--density-unit)))] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-overlay">
          {tiles && results.length > 0 && <p aria-hidden="true" className="shrink-0 px-sm pt-sm text-caption font-medium text-muted-foreground">{t("search.charsOf", { query: shown.query })}</p>}
          {status && (
            <p aria-hidden="true" className={cn("px-sm py-sm text-caption", state.status === "error" ? "text-danger-strong" : "text-muted-foreground")}>{status}</p>
          )}
          {results.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label={tiles ? t("search.charsOf", { query: shown.query }) : t("search.label")}
              className={cn("min-h-0 overflow-y-auto p-2xs", tiles && "flex flex-wrap gap-2xs p-sm")}
            >
              {results.map((result, index) => {
                const hanViet = result.hanViet.join(", ").toLocaleUpperCase("vi");
                const meaning = result.meaningVi ?? result.meaningEn;
                return (
                  <li
                    key={result.literal}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    // Keeps focus in the box, so a click is not a blur that closes the list first.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(result.literal)}
                    onMouseMove={() => setActive(index)}
                    className={cn(
                      "cursor-pointer rounded-md",
                      index === active ? "bg-muted" : "hover:bg-muted/60",
                      tiles
                        ? "flex min-w-[calc(64*var(--density-unit))] flex-col items-center border border-border px-xs py-2xs"
                        : "flex items-center gap-sm px-xs py-2xs",
                    )}
                  >
                    <span lang="ja" className="font-jp text-heading font-bold">{result.literal}</span>
                    {tiles ? (
                      <span className="max-w-[calc(96*var(--density-unit))] truncate text-caption font-semibold text-primary-strong">{hanViet || " "}</span>
                    ) : (
                      <span className="min-w-0 flex-1">
                        {hanViet && <span className="block truncate text-caption font-semibold text-primary-strong">{hanViet}</span>}
                        <span title={meaning} className="block truncate text-caption text-muted-foreground">{meaning}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
