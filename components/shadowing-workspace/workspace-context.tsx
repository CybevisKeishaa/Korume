"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { createKeyedMutator, type KeyedMutator } from "@/lib/shadowing-workspace/keyed-mutations";
import { locateSentence, sameSentencePosition, type SentencePosition } from "@/lib/shadowing-workspace/sentence-lookup";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { toggleView, type FullscreenTarget, type WorkspaceView } from "@/lib/shadowing-workspace/workspace-view";
import { SENTENCE_MARK_KINDS, type ReadingTranslation, type SentenceMarkKind, type UserPreferences } from "@/lib/preferences/options";
import { createPlaybackPositionStore, type PlaybackPositionStore } from "./playback-position-store";
import type { PlaybackController } from "./use-playback-controller";

export const DEFAULT_SPLIT_RATIO = 0.5;
/** The shortcut hint sheet's `openPopover` id (its component imports the context, so the id lives here). */
export const SHORTCUT_HINTS_POPOVER = "shortcut-hints";
// The pronunciation trio only validates together (lib/validation/preferences.ts), so a single-field PATCH would 400.
export type PreferenceKey = Exclude<keyof UserPreferences,
  "dailyMinutes" | "learningSchedule" | "scheduleDays" | "pronunciationSort" | "pronunciationDuration" | "pronunciationHideCompleted">;

export interface SessionState {
  view: WorkspaceView;
  fullscreen: FullscreenTarget;
  liveSentenceHidden: boolean;
  transcriptTranslation: "follow" | "shown" | "hidden";
  lineFurigana: Record<string, boolean>;
  lineTranslationRevealed: Record<string, boolean>;
  query: string;
  splitRatio: number;
  openPopover: string | null;
}

export type SessionAction =
  | { type: "toggle-view"; view: "focus" | "full-transcript" }
  | { type: "exit-view" }
  | { type: "set-fullscreen"; target: FullscreenTarget }
  | { type: "toggle-live-sentence" }
  | { type: "cycle-transcript-translation"; persisted: ReadingTranslation }
  | { type: "toggle-line-furigana"; lineId: string; shownByMode: boolean }
  | { type: "reveal-line-translation"; lineId: string }
  | { type: "reset-overrides"; scope?: "translation" | "furigana" | "all" }
  | { type: "set-query"; query: string }
  | { type: "set-split"; ratio: number }
  | { type: "set-popover"; id: string | null };

const initialSessionState: SessionState = {
  view: "normal", fullscreen: "none", liveSentenceHidden: false, transcriptTranslation: "follow",
  lineFurigana: {}, lineTranslationRevealed: {}, query: "", splitRatio: DEFAULT_SPLIT_RATIO, openPopover: null,
};

export function sessionReducer(state: SessionState = initialSessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "toggle-view": return { ...state, view: toggleView(state.view, action.view) };
    case "exit-view": return { ...state, view: "normal" };
    case "set-fullscreen": return { ...state, fullscreen: action.target };
    case "toggle-live-sentence": return { ...state, liveSentenceHidden: !state.liveSentenceHidden };
    case "cycle-transcript-translation": {
      const next = state.transcriptTranslation === "follow"
        ? action.persisted === "always" ? "hidden" : "shown"
        : state.transcriptTranslation === "hidden" ? "shown" : "follow";
      return { ...state, transcriptTranslation: next };
    }
    case "toggle-line-furigana": {
      // A second press puts the line back on its mode: storing a flipped value instead would leave a
      // stale override that Live Sentence (persisted mode) and the row (view mode) read differently.
      const { [action.lineId]: existing, ...rest } = state.lineFurigana;
      return { ...state, lineFurigana: existing === undefined ? { ...rest, [action.lineId]: !action.shownByMode } : rest };
    }
    case "reveal-line-translation": return { ...state, lineTranslationRevealed: { ...state.lineTranslationRevealed, [action.lineId]: true } };
    case "reset-overrides": {
      const scope = action.scope ?? "all";
      return {
        ...state,
        ...(scope === "translation" || scope === "all" ? { transcriptTranslation: "follow" as const, lineTranslationRevealed: {} } : {}),
        ...(scope === "furigana" || scope === "all" ? { lineFurigana: {} } : {}),
      };
    }
    case "set-query": return { ...state, query: action.query };
    case "set-split": return { ...state, splitRatio: action.ratio };
    case "set-popover": return { ...state, openPopover: action.id };
  }
}

const LessonContext = createContext<{ video: WorkspaceBootstrap["video"]; lines: WorkspaceLine[]; masteryMap: Record<string, number>; transcriptId: string | null } | null>(null);
const ControllerContext = createContext<PlaybackController | null>(null);
const PositionStoreContext = createContext<PlaybackPositionStore | null>(null);
const CurrentSentenceContext = createContext<SentencePosition | null>(null);
const StartPositionContext = createContext<number>(0);
const SessionContext = createContext<[SessionState, Dispatch<SessionAction>] | null>(null);
const PreferencesContext = createContext<{ preferences: UserPreferences; setPreference<K extends PreferenceKey>(key: K, value: UserPreferences[K]): void; pending(key: PreferenceKey): boolean } | null>(null);
const MarksContext = createContext<{ isMarked(lineId: string, kind: SentenceMarkKind): boolean; toggleMark(lineId: string, kind: SentenceMarkKind): void; lessonBookmarked: boolean; toggleLessonBookmark(): void; pending(key: string): boolean } | null>(null);

function useRequired<T>(context: T | null, name: string): T {
  if (context === null) throw new Error(`${name} must be used within WorkspaceProviders`);
  return context;
}

function CurrentSentenceProvider({ lines, duration, store, children }: { lines: WorkspaceLine[]; duration: number | null; store: PlaybackPositionStore; children: ReactNode }) {
  const cached = useRef<SentencePosition | null>(null);
  const getSnapshot = useCallback(() => {
    const next = locateSentence(lines, store.get(), duration);
    if (cached.current && sameSentencePosition(cached.current, next)) return cached.current;
    cached.current = next;
    return next;
  }, [duration, lines, store]);
  const sentence = useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  return <CurrentSentenceContext.Provider value={sentence}>{children}</CurrentSentenceContext.Provider>;
}

/**
 * Spec §4.3 "mutable bootstrap must never come back stale": the layout's bootstrap sits in Next 14's
 * client router cache, so after a successful write we refresh it (which also purges that cache) — once
 * the key has no newer write in flight, so a burst of clicks costs one refresh, not one per click.
 */
function useRefreshAfterWrite(mutator: KeyedMutator) {
  const router = useRouter();
  return useCallback((key: string, ok: boolean) => {
    if (ok && !mutator.isPending(key)) startTransition(() => router.refresh());
  }, [mutator, router]);
}

/**
 * This tab's own writes, layered over a bootstrap that can be older than them (spec §4.3). `router.refresh()`
 * after a write purges the router cache — but only once it completes: a learner who changes a setting and
 * leaves at once returns (client-side Back) to the payload from BEFORE the write (T11, measured: 3 of 3 runs
 * stale with no wait, 0 of 3 after 3 s). Every optimistic apply and rollback records its value here; a
 * remount takes the recorded value over the bootstrap's, and forgets it once a bootstrap agrees.
 * ponytail: lives for the tab; a later change from another device is masked here until a bootstrap shows
 * this tab's value or the tab reloads (a full load drops the map).
 */
const tabWrites = new Map<string, unknown>();
function rememberWrite(key: string, value: unknown) { tabWrites.set(key, value); }
/** Tests share one module (one "tab") across cases; each case starts with a fresh tab. */
export function resetTabWritesForTests() { tabWrites.clear(); }
function reconcileWrite<V>(key: string, server: V): V {
  if (!tabWrites.has(key)) return server;
  const mine = tabWrites.get(key) as V;
  if (Object.is(mine, server)) tabWrites.delete(key);
  return mine;
}

function PreferencesProvider({ userId, initial, dispatch, children }: { userId: string; initial: UserPreferences; dispatch: Dispatch<SessionAction>; children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => Object.fromEntries(
    Object.entries(initial).map(([key, value]) => [key, reconcileWrite(`pref:${userId}:${key}`, value)]),
  ) as unknown as UserPreferences);
  const [mutationRevision, setMutationRevision] = useState(0);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const mutator = useState(createKeyedMutator)[0];
  const refreshAfterWrite = useRefreshAfterWrite(mutator);
  const setPreference = useCallback(<K extends PreferenceKey>(key: K, value: UserPreferences[K]) => {
    const previous = preferencesRef.current[key];
    void mutator.run(`pref:${key}`, {
      apply: () => {
        const next = { ...preferencesRef.current, [key]: value } as UserPreferences;
        preferencesRef.current = next;
        rememberWrite(`pref:${userId}:${key}`, value);
        setPreferences(next);
        if (key === "readingTranslation") dispatch({ type: "reset-overrides", scope: "translation" });
        if (key === "readingFurigana") dispatch({ type: "reset-overrides", scope: "furigana" });
      },
      request: async () => {
        const response = await fetch("/api/user/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
        if (!response.ok) throw new Error("Preference update failed");
      },
      rollback: () => {
        const next = { ...preferencesRef.current, [key]: previous } as UserPreferences;
        preferencesRef.current = next;
        rememberWrite(`pref:${userId}:${key}`, previous);
        setPreferences(next);
      },
      onSettled: (ok) => { setMutationRevision((revision) => revision + 1); refreshAfterWrite(`pref:${key}`, ok); },
    });
  }, [dispatch, mutator, refreshAfterWrite, userId]);
  // mutationRevision is load-bearing: it re-renders consumers so pending() reflects a settled request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ preferences, setPreference, pending: (key: PreferenceKey) => mutator.isPending(`pref:${key}`) }), [mutationRevision, mutator, preferences, setPreference]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

function markKey(lineId: string, kind: SentenceMarkKind): string {
  return `${lineId}:${kind}`;
}

function MarksProvider({ bootstrap, children }: { bootstrap: WorkspaceBootstrap; children: ReactNode }) {
  const { userId } = bootstrap;
  const [marks, setMarks] = useState(() => {
    const server = new Set(bootstrap.marks.map(({ lineId, kind }) => markKey(lineId, kind)));
    const reconciled = new Set<string>();
    for (const line of bootstrap.transcript?.lines ?? []) {
      for (const kind of SENTENCE_MARK_KINDS) {
        const id = markKey(line.id, kind);
        if (reconcileWrite(`mark:${userId}:${id}`, server.has(id))) reconciled.add(id);
      }
    }
    return reconciled;
  });
  const [lessonBookmarked, setLessonBookmarked] = useState(() => reconcileWrite(`bookmark:${userId}:${bootstrap.video.id}`, bootstrap.lessonBookmarked));
  const [mutationRevision, setMutationRevision] = useState(0);
  const marksRef = useRef(marks);
  const bookmarkRef = useRef(lessonBookmarked);
  marksRef.current = marks;
  bookmarkRef.current = lessonBookmarked;
  const mutator = useState(createKeyedMutator)[0];
  const refreshAfterWrite = useRefreshAfterWrite(mutator);
  const updateMarks = useCallback((change: (next: Set<string>) => void) => {
    const next = new Set(marksRef.current);
    change(next);
    marksRef.current = next;
    setMarks(next);
  }, []);
  const toggleMark = useCallback((lineId: string, kind: SentenceMarkKind) => {
    const id = markKey(lineId, kind);
    const marked = marksRef.current.has(id);
    void mutator.run(`mark:${lineId}:${kind}`, {
      apply: () => { rememberWrite(`mark:${userId}:${id}`, !marked); updateMarks((next) => marked ? next.delete(id) : next.add(id)); },
      request: async () => {
        const response = await fetch("/api/sentence-marks", {
          method: marked ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcriptLineId: lineId, kind }),
        });
        if (!response.ok) throw new Error("Sentence mark update failed");
      },
      rollback: () => { rememberWrite(`mark:${userId}:${id}`, marked); updateMarks((next) => marked ? next.add(id) : next.delete(id)); },
      onSettled: (ok) => { setMutationRevision((revision) => revision + 1); refreshAfterWrite(`mark:${lineId}:${kind}`, ok); },
    });
  }, [mutator, refreshAfterWrite, updateMarks, userId]);
  const toggleLessonBookmark = useCallback(() => {
    const bookmarked = bookmarkRef.current;
    void mutator.run("lesson-bookmark", {
      apply: () => { bookmarkRef.current = !bookmarked; rememberWrite(`bookmark:${userId}:${bootstrap.video.id}`, !bookmarked); setLessonBookmarked(!bookmarked); },
      request: async () => {
        const response = await fetch(`/api/videos/${bootstrap.video.id}/bookmark`, { method: bookmarked ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" } });
        if (!response.ok) throw new Error("Lesson bookmark update failed");
      },
      rollback: () => { bookmarkRef.current = bookmarked; rememberWrite(`bookmark:${userId}:${bootstrap.video.id}`, bookmarked); setLessonBookmarked(bookmarked); },
      onSettled: (ok) => { setMutationRevision((revision) => revision + 1); refreshAfterWrite("lesson-bookmark", ok); },
    });
  }, [bootstrap.video.id, mutator, refreshAfterWrite, userId]);
  const value = useMemo(() => ({
    isMarked: (lineId: string, kind: SentenceMarkKind) => marks.has(markKey(lineId, kind)), toggleMark, lessonBookmarked, toggleLessonBookmark,
    pending: (key: string) => mutator.isPending(key),
  // mutationRevision is load-bearing: it re-renders consumers so pending() reflects a settled request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lessonBookmarked, marks, mutationRevision, mutator, toggleLessonBookmark, toggleMark]);
  return <MarksContext.Provider value={value}>{children}</MarksContext.Provider>;
}

export function WorkspaceProviders({ bootstrap, controller, initialPosition, children }: { bootstrap: WorkspaceBootstrap; controller?: PlaybackController; initialPosition?: number; children: ReactNode }) {
  // The shortcut hint sheet starts open only when the learner asked for hints (spec §6.1); after that it is session state.
  const [session, dispatch] = useReducer(sessionReducer, bootstrap.preferences.showShortcutHints, (hints): SessionState => (
    { ...initialSessionState, openPopover: hints ? SHORTCUT_HINTS_POPOVER : null }
  ));
  const startPosition = initialPosition ?? bootstrap.resume?.position ?? 0;
  const store = useState(() => createPlaybackPositionStore(startPosition))[0];
  // The shell settles the start position once after mount (session record); move the store with it.
  useEffect(() => { store.set(startPosition); }, [startPosition, store]);
  const sessionValue = useMemo((): [SessionState, Dispatch<SessionAction>] => [session, dispatch], [session]);
  const lesson = useMemo(() => ({ video: bootstrap.video, lines: bootstrap.transcript?.lines ?? [], masteryMap: bootstrap.masteryMap, transcriptId: bootstrap.transcript?.id ?? null }), [bootstrap]);
  return (
    <LessonContext.Provider value={lesson}>
      <ControllerContext.Provider value={controller ?? null}>
        <PositionStoreContext.Provider value={store}>
          <StartPositionContext.Provider value={startPosition}>
          <SessionContext.Provider value={sessionValue}>
            <CurrentSentenceProvider lines={lesson.lines} duration={lesson.video.durationSeconds} store={store}>
              <PreferencesProvider userId={bootstrap.userId} initial={bootstrap.preferences} dispatch={dispatch}>
                <MarksProvider bootstrap={bootstrap}>{children}</MarksProvider>
              </PreferencesProvider>
            </CurrentSentenceProvider>
          </SessionContext.Provider>
          </StartPositionContext.Provider>
        </PositionStoreContext.Provider>
      </ControllerContext.Provider>
    </LessonContext.Provider>
  );
}

/**
 * Supplies the playback controller below `WorkspaceProviders`: the controller needs the position store those
 * providers create, and both columns (player, transcript) consume it, so `PlaybackRoot` mounts it around the grid.
 */
export function ControllerProvider({ controller, children }: { controller: PlaybackController; children: ReactNode }) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>;
}

export function useLesson() { return useRequired(useContext(LessonContext), "useLesson"); }
export function usePlaybackController(): PlaybackController {
  const controller = useContext(ControllerContext);
  if (controller === null) throw new Error("PlaybackController was not provided to WorkspaceProviders");
  return controller;
}
/** Where the player is initialised (paused) — Task 6 passes it to `YouTubePlayer initialPosition`. */
export function useStartPosition(): number { return useContext(StartPositionContext); }
export function usePositionStore(): PlaybackPositionStore { return useRequired(useContext(PositionStoreContext), "usePositionStore"); }
export function useCurrentSentence(): SentencePosition { return useRequired(useContext(CurrentSentenceContext), "useCurrentSentence"); }
export function useSession(): [SessionState, Dispatch<SessionAction>] { return useRequired(useContext(SessionContext), "useSession"); }
export function usePreferences() { return useRequired(useContext(PreferencesContext), "usePreferences"); }
export function useMarks() { return useRequired(useContext(MarksContext), "useMarks"); }
