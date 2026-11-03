"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { ListeningFormat } from "@/lib/shadowing-workspace/learning-modes";

/** What an unfinished Listening attempt leaves behind when the learner moves on (spec §3.9, plan Task 14). */
export type ListeningDraft = { hinted: number[]; input?: string; answer?: number[]; blanks?: number[]; answers?: string[]; easyUsed?: boolean };

/**
 * The draft key: line + stored format; word pieces add the cut version (A3, spec 2026-10-31 §3.5), so a draft never
 * restores onto another cut of the line.
 */
export function draftKey(lineId: string, format: ListeningFormat, chunkVersion?: number): string {
  return format === "word_bank" ? `${lineId}|${format}|${chunkVersion ?? ""}` : `${lineId}|${format}`;
}

/** A draft with nothing in it is no draft: it neither restores nor marks the navigator. */
export function isEmptyDraft(draft: ListeningDraft): boolean {
  return draft.hinted.length === 0 && !draft.input?.trim() && !draft.answer?.length && !draft.answers?.some((a) => a.trim() !== "") && !draft.easyUsed;
}

interface DraftStore {
  version: number;
  get(key: string): ListeningDraft | undefined;
  save(key: string, draft: ListeningDraft): void;
  clear(key: string): void;
  keys(): string[];
}

const DraftsContext = createContext<DraftStore | null>(null);

/**
 * In-memory drafts for the page visit: a Map in a ref plus a version counter that re-renders readers. It sits above
 * the Listening body and the picker, so a draft survives a line change, an exercise change and the picker; a reload
 * (remount) drops it. Nothing touches storage.
 */
export function ListeningDraftsProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, ListeningDraft>());
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const save = useCallback((key: string, draft: ListeningDraft) => {
    if (isEmptyDraft(draft)) {
      if (drafts.current.delete(key)) bump();
      return;
    }
    const had = drafts.current.has(key);
    drafts.current.set(key, draft);
    // Only a new key changes what the navigator marks; content edits need no re-render.
    if (!had) bump();
  }, [bump]);
  const clear = useCallback((key: string) => { if (drafts.current.delete(key)) bump(); }, [bump]);
  const value = useMemo<DraftStore>(() => ({
    version,
    get: (key) => drafts.current.get(key),
    save,
    clear,
    keys: () => [...drafts.current.keys()],
  }), [clear, save, version]);
  return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>;
}

/** The store itself, for a caller that must clear a key other than its current one (a late submit response). */
export function useListeningDrafts(): DraftStore {
  const store = useContext(DraftsContext);
  if (store === null) throw new Error("useListeningDraft must be used within ListeningDraftsProvider");
  return store;
}
const useStore = useListeningDrafts;

export function useListeningDraft(key: string | null): { draft: ListeningDraft | undefined; save(draft: ListeningDraft): void; clear(): void } {
  const store = useStore();
  const { save: storeSave, clear: storeClear } = store;
  const save = useCallback((draft: ListeningDraft) => { if (key) storeSave(key, draft); }, [key, storeSave]);
  const clear = useCallback(() => { if (key) storeClear(key); }, [key, storeClear]);
  return { draft: key ? store.get(key) : undefined, save, clear };
}

/** The lines holding a draft in any of `formats` (the navigator's dot). */
export function useDraftLineIds(formats: readonly ListeningFormat[]): ReadonlySet<string> {
  const store = useStore();
  const { version, keys } = store;
  const wanted = formats.join(",");
  return useMemo(() => {
    void version;
    const allowed = new Set(wanted.split(","));
    return new Set(keys().flatMap((key) => {
      const [lineId, format] = key.split("|");
      return lineId && format && allowed.has(format) ? [lineId] : [];
    }));
  }, [keys, version, wanted]);
}
