"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resolveStartPosition } from "@/lib/shadowing-workspace/resume";
import { parseSessionResumeRecord, sessionResumeKey } from "@/lib/shadowing-workspace/session-resume-record";
import { LiveSentence } from "./live-sentence";
import { PlaybackRoot, usePlayerWiring } from "./playback-root";
import { useStudyPresence } from "@/components/study-time/use-study-presence";
import { WorkspacePlayer } from "./workspace-player";
import { tabPreference, usePlaybackController, usePreferences, useSession, WorkspaceProviders } from "./workspace-context";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceDivider } from "./workspace-divider";
import { useFullscreen } from "./use-fullscreen";
import { useWorkspaceShortcuts } from "./use-workspace-shortcuts";
import { escapeAction, type FullscreenTarget } from "@/lib/shadowing-workspace/workspace-view";
import { useTranslations } from "@/lib/i18n";
import { HEADER_ICON_BUTTON } from "./lesson-bookmark-button";
import { FullscreenGlyph } from "./player-glyphs";
import { AtmosphereLayer } from "./atmosphere-layer";
import { ReadingSettingsPopover } from "./reading-settings-popover";
import { ShortcutHintsPopover } from "./shortcut-hints-popover";
import { StudyEnvironmentPopover } from "./study-environment-popover";
import { PipDragHandle } from "./pip-drag-handle";
import { DrawerProvider, useDrawer } from "./drawer/drawer-context";
import { NotesProvider } from "./drawer/notes-context";
import { UtilityDrawer } from "./drawer/utility-drawer";
import { SelectionPopoverHost } from "./selection-popover";
import { KorumeMascot, useKorumeOverlay } from "./korume-mascot";
import { KorumeSheet } from "./korume-sheet";
import { drawerRowHeight, type DrawerLevel } from "@/lib/shadowing-workspace/drawer-state";

// useLayoutEffect warns during SSR; on the client it runs before paint, so the session position never flashes.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readSessionRecord(bootstrap: WorkspaceBootstrap) {
  try {
    return parseSessionResumeRecord(sessionStorage.getItem(sessionResumeKey(bootstrap.userId, bootstrap.video.id)), bootstrap.userId, bootstrap.video.id);
  } catch {
    return null; // Private browsing can reject sessionStorage; server resume remains available.
  }
}

function newerSyncedServerAt(server: string | null, session: string | null): string | null {
  const serverAt = server === null ? Number.NEGATIVE_INFINITY : Date.parse(server);
  const sessionAt = session === null ? Number.NEGATIVE_INFINITY : Date.parse(session);
  return (Number.isFinite(sessionAt) ? sessionAt : Number.NEGATIVE_INFINITY) > (Number.isFinite(serverAt) ? serverAt : Number.NEGATIVE_INFINITY) ? session : server;
}

export function ShadowingWorkspaceShell({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceBootstrap;
  children: React.ReactNode;
}) {
  const requestedLineId = useSearchParams().get("line");
  const resolve = (session: ReturnType<typeof readSessionRecord>, resumeBehavior = bootstrap.preferences.resumeBehavior) => resolveStartPosition({
    // A lesson stored without a duration still gets the end-of-video guard: the last line's end stands in.
    lines: bootstrap.transcript?.lines ?? [], duration: bootstrap.video.durationSeconds ?? bootstrap.transcript?.lines.at(-1)?.endTime ?? null, deepLinkLineId: requestedLineId,
    resumeBehavior, server: bootstrap.resume, session,
  }).position;
  // The start position is decided ONCE. The first render (server and hydration) uses server facts only, so the
  // markup matches; the tab's session record is read after mount. A later bootstrap (router.refresh) never moves it.
  const [initialPosition, setInitialPosition] = useState(() => resolve(null));
  const [initialSyncedServerAt, setInitialSyncedServerAt] = useState(() => bootstrap.resume?.lastWatchedAt ?? null);
  const resolveOnMount = useRef(() => {
    const session = readSessionRecord(bootstrap);
    return {
      position: resolve(session, tabPreference(bootstrap.userId, "resumeBehavior", bootstrap.preferences.resumeBehavior)),
      syncedServerAt: newerSyncedServerAt(bootstrap.resume?.lastWatchedAt ?? null, session?.syncedServerAt ?? null),
    };
  });
  useIsomorphicLayoutEffect(() => {
    const initial = resolveOnMount.current();
    setInitialPosition(initial.position);
    setInitialSyncedServerAt(initial.syncedServerAt);
  }, []);

  return (
    <WorkspaceProviders bootstrap={bootstrap} initialPosition={initialPosition}>
      <PlaybackRoot userId={bootstrap.userId} initialSyncedServerAt={initialSyncedServerAt}>
        <WorkspacePresence videoId={bootstrap.video.id} />
        <DrawerProvider>
          <NotesProvider bootstrap={bootstrap}>
            <WorkspaceLayout>{children}</WorkspaceLayout>
          </NotesProvider>
        </DrawerProvider>
      </PlaybackRoot>
    </WorkspaceProviders>
  );
}

function WorkspacePresence({ videoId }: { videoId: string }) {
  const { playing } = usePlayerWiring();
  useStudyPresence({ surface: "shadowing", contextId: videoId, mediaPlaying: playing });
  return null;
}

export function workspaceGridTemplateColumns(ratio: number): string {
  return `minmax(var(--workspace-left-min), ${ratio * 100}fr) var(--workspace-divider-width) minmax(var(--workspace-right-min), ${(1 - ratio) * 100}fr)`;
}

/**
 * The shell's rows: header, columns, drawer (spec §6.1). Opening the drawer shortens the columns, never narrows
 * them, and `--workspace-drawer-height` takes the same height out of the 1a video budget. Maximized gives the
 * drawer everything below the header; the columns' row shrinks to nothing but the player stays mounted.
 */
export function workspaceGridRows(level: DrawerLevel | null): CSSProperties {
  if (level === null) return { gridTemplateRows: "auto minmax(0, 1fr)", ["--workspace-drawer-height" as string]: "0px" };
  if (level === "maximized") return { gridTemplateRows: "auto 0 minmax(0, 1fr)", ["--workspace-drawer-height" as string]: "0px" };
  const height = drawerRowHeight(level);
  return { gridTemplateRows: `auto minmax(0, 1fr) ${height}`, ["--workspace-drawer-height" as string]: height };
}

function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shadowing");
  const [session, dispatch] = useSession();
  const { preferences } = usePreferences();
  const controller = usePlaybackController();
  const { toggleLoop } = usePlayerWiring();
  const drawer = useDrawer();
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const setFullscreen = useCallback((target: FullscreenTarget) => dispatch({ type: "set-fullscreen", target }), [dispatch]);
  const { requestFullscreen, supported: fullscreenSupported } = useFullscreen(rootRef, playerRef, setFullscreen);
  const focusFullscreen = useCallback((trigger: HTMLElement) => requestFullscreen("workspace", trigger), [requestFullscreen]);
  const playerFullscreen = useCallback((trigger: HTMLElement) => requestFullscreen("player", trigger), [requestFullscreen]);
  // Ask Korume (spec §6.2): off means no mascot, no sheet, no `k`, and so no request at all.
  const korumeEnabled = preferences.companionEnabled;
  const korume = useKorumeOverlay(rootRef);
  const mascotRef = useRef<HTMLDivElement>(null);
  const korumeVisible = korumeEnabled && session.view !== "focus" && session.fullscreen === "none";
  const openKorume = korume.openSheet;
  const closeKorume = korume.close;
  const returnFocusToMascot = useCallback(() => mascotRef.current?.querySelector<HTMLElement>("button")?.focus(), []);
  const shortcuts = useMemo(() => ({
    togglePlay: () => controller.togglePlay(), previousSentence: () => controller.previousSentence(), nextSentence: () => controller.nextSentence(), rewind: (seconds: number) => controller.rewind(seconds),
    toggleLoop, toggleFocus: () => dispatch({ type: "toggle-view", view: "focus" }),
    ...(korumeVisible ? { askKorume: openKorume } : {}),
  }), [controller, dispatch, korumeVisible, openKorume, toggleLoop]);
  useWorkspaceShortcuts(shortcuts);
  const drawerShown = session.view !== "focus";
  const drawerOpen = drawerShown && drawer.state.level !== "collapsed";
  const drawerDispatch = drawer.dispatch;

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !(event.target instanceof Element) || event.target.closest("[role='dialog'], [data-radix-popper-content-wrapper]")) return;
      const action = escapeAction({ popoverOpen: session.openPopover !== null, korumeOpen: korumeVisible && korume.open, inspectorOpen: drawerOpen && drawer.state.inspector !== null, drawerOpen, fullscreen: session.fullscreen, view: session.view });
      if (action === "close-popover") dispatch({ type: "set-popover", id: null });
      if (action === "close-korume") closeKorume();
      if (action === "close-inspector") drawerDispatch({ type: "inspector-close" });
      if (action === "collapse-drawer") drawerDispatch({ type: "collapse" });
      if (action === "exit-view") dispatch({ type: "exit-view" });
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [closeKorume, dispatch, drawer.state.inspector, drawerDispatch, drawerOpen, korume.open, korumeVisible, session.fullscreen, session.openPopover, session.view]);

  const normal = session.view === "normal";
  const fullTranscript = session.view === "full-transcript";
  return (
    <div
      ref={rootRef}
      className={normal ? "relative isolate grid h-dvh overflow-hidden" : "relative isolate grid h-dvh overflow-hidden grid-cols-1"}
      style={{
        ...(normal ? { gridTemplateColumns: workspaceGridTemplateColumns(session.splitRatio) } : {}),
        ...workspaceGridRows(drawerShown ? drawer.state.level : null),
      }}
      data-testid="shadowing-workspace"
      // Reading Settings and Study Environment (spec §6): globals.css maps these to the --reading-* and
      // --atmosphere-* variables the reading surfaces consume, so a change re-styles without a re-render below.
      data-reading-preset={preferences.readingColorPreset}
      data-reading-size={preferences.readingTextSize}
      data-reading-line-height={preferences.readingLineHeight}
      data-reading-width={preferences.readingWidth}
      data-reading-emphasis={preferences.readingEmphasis}
      data-reading-font={preferences.readingJpFont}
      data-atmosphere={preferences.studyAtmosphere}
    >
      <AtmosphereLayer atmosphere={preferences.studyAtmosphere} reduceMotion={preferences.reduceMotion} />
      <div ref={headerRef} className={normal ? "col-span-3" : "col-span-1"} data-testid="workspace-header-slot">
        <WorkspaceHeader
          beforeFocus={<StudyEnvironmentPopover />}
          afterFocus={(
            <>
              {fullscreenSupported && <button type="button" aria-label={t("workspace.header.fullscreen")} title={t("workspace.header.fullscreen")} aria-pressed={session.fullscreen === "workspace"} onClick={(event) => focusFullscreen(event.currentTarget)} className={HEADER_ICON_BUTTON}><FullscreenGlyph className="size-icon-sm" /></button>}
              <ReadingSettingsPopover />
              <ShortcutHintsPopover />
            </>
          )}
        />
      </div>
      <div ref={paneRef} id="workspace-player-pane" data-pip={fullTranscript ? "" : undefined} className={fullTranscript ? "group/pip fixed bottom-md right-md z-10 touch-none w-[min(calc(100%-var(--space-2xl)),var(--workspace-pip-width))]" : session.view === "focus" ? "mx-auto flex w-full max-w-[--workspace-focus-max] min-w-0 flex-col gap-md p-md" : "flex min-h-0 min-w-0 flex-col gap-md overflow-hidden p-md"} data-testid="workspace-player-slot">
        {fullTranscript && <PipDragHandle paneRef={paneRef} label={t("workspace.pipMove")} />}
        <WorkspacePlayer ref={playerRef} onFullscreen={playerFullscreen} fullscreenAvailable={fullscreenSupported} />
        {!fullTranscript && <LiveSentence />}
      </div>
      {normal && <WorkspaceDivider ratio={session.splitRatio} onChange={(ratio) => dispatch({ type: "set-split", ratio })} workspaceRef={rootRef} ariaLabel={t("workspace.divider")} controls="workspace-player-pane" />}
      {session.view !== "focus" && (
        <div className={fullTranscript ? "relative col-span-1 row-start-2 min-h-0 min-w-0 p-md" : "relative min-h-0 min-w-0"}>
          {children}
          {korumeVisible && !korume.open && <KorumeMascot mascotRef={mascotRef} onOpen={openKorume} onPress={korume.rememberSelection} />}
        </div>
      )}
      {korumeEnabled && korume.draft && (
        <KorumeSheet
          key={korume.draft.key}
          open={korumeVisible && korume.open}
          anchor={korume.draft.anchor}
          onClose={closeKorume}
          onAskCurrent={korume.askCurrent}
          onReturnFocus={returnFocusToMascot}
        />
      )}
      <SelectionPopoverHost workspaceRef={rootRef} />
      {/* Focus Mode hides the drawer; its state lives in DrawerProvider above, so leaving Focus restores it. */}
      {drawerShown && (
        <div className={normal ? "col-span-3 row-start-3 min-h-0" : "col-span-1 row-start-3 min-h-0"} data-testid="workspace-drawer-slot">
          <UtilityDrawer workspaceRef={rootRef} headerRef={headerRef} />
        </div>
      )}
    </div>
  );
}
