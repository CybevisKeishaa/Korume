"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resolveStartPosition } from "@/lib/shadowing-workspace/resume";
import { parseSessionResumeRecord, sessionResumeKey } from "@/lib/shadowing-workspace/session-resume-record";
import { LiveSentence } from "./live-sentence";
import { PlaybackRoot, usePlayerWiring } from "./playback-root";
import { WorkspacePlayer } from "./workspace-player";
import { usePlaybackController, usePreferences, useSession, WorkspaceProviders } from "./workspace-context";
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

// useLayoutEffect warns during SSR; on the client it runs before paint, so the session position never flashes.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readSessionRecord(bootstrap: WorkspaceBootstrap) {
  try {
    return parseSessionResumeRecord(sessionStorage.getItem(sessionResumeKey(bootstrap.userId, bootstrap.video.id)), bootstrap.userId, bootstrap.video.id);
  } catch {
    return null; // Private browsing can reject sessionStorage; server resume remains available.
  }
}

export function ShadowingWorkspaceShell({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceBootstrap;
  children: React.ReactNode;
}) {
  const requestedLineId = useSearchParams().get("line");
  const resolve = (session: ReturnType<typeof readSessionRecord>) => resolveStartPosition({
    lines: bootstrap.transcript?.lines ?? [], duration: bootstrap.video.durationSeconds, deepLinkLineId: requestedLineId,
    resumeBehavior: bootstrap.preferences.resumeBehavior, server: bootstrap.resume, session,
  }).position;
  // The start position is decided ONCE. The first render (server and hydration) uses server facts only, so the
  // markup matches; the tab's session record is read after mount. A later bootstrap (router.refresh) never moves it.
  const [initialPosition, setInitialPosition] = useState(() => resolve(null));
  const resolveOnMount = useRef(() => resolve(readSessionRecord(bootstrap)));
  useIsomorphicLayoutEffect(() => setInitialPosition(resolveOnMount.current()), []);

  return (
    <WorkspaceProviders bootstrap={bootstrap} initialPosition={initialPosition}>
      <PlaybackRoot userId={bootstrap.userId} initialSyncedServerAt={bootstrap.resume?.lastWatchedAt ?? null}>
        <WorkspaceLayout>{children}</WorkspaceLayout>
      </PlaybackRoot>
    </WorkspaceProviders>
  );
}

export function workspaceGridTemplateColumns(ratio: number): string {
  return `minmax(var(--workspace-left-min), ${ratio * 100}fr) var(--workspace-divider-width) minmax(var(--workspace-right-min), ${(1 - ratio) * 100}fr)`;
}

function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shadowing");
  const [session, dispatch] = useSession();
  const { preferences } = usePreferences();
  const controller = usePlaybackController();
  const { toggleLoop } = usePlayerWiring();
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const setFullscreen = useCallback((target: FullscreenTarget) => dispatch({ type: "set-fullscreen", target }), [dispatch]);
  const { requestFullscreen, supported: fullscreenSupported } = useFullscreen(rootRef, playerRef, setFullscreen);
  const focusFullscreen = useCallback((trigger: HTMLElement) => requestFullscreen("workspace", trigger), [requestFullscreen]);
  const playerFullscreen = useCallback((trigger: HTMLElement) => requestFullscreen("player", trigger), [requestFullscreen]);
  const shortcuts = useMemo(() => ({
    togglePlay: () => controller.togglePlay(), previousSentence: () => controller.previousSentence(), nextSentence: () => controller.nextSentence(), rewind: (seconds: number) => controller.rewind(seconds),
    toggleLoop, toggleFocus: () => dispatch({ type: "toggle-view", view: "focus" }),
  }), [controller, dispatch, toggleLoop]);
  useWorkspaceShortcuts(shortcuts);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !(event.target instanceof Element) || event.target.closest("[role='dialog'], [data-radix-popper-content-wrapper]")) return;
      const action = escapeAction({ popoverOpen: session.openPopover !== null, fullscreen: session.fullscreen, view: session.view });
      if (action === "close-popover") dispatch({ type: "set-popover", id: null });
      if (action === "exit-view") dispatch({ type: "exit-view" });
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [dispatch, session.fullscreen, session.openPopover, session.view]);

  const normal = session.view === "normal";
  const fullTranscript = session.view === "full-transcript";
  return (
    <div
      ref={rootRef}
      className={normal ? "relative isolate grid h-dvh overflow-hidden grid-rows-[auto_minmax(0,1fr)]" : "relative isolate grid h-dvh overflow-hidden grid-cols-1 grid-rows-[auto_minmax(0,1fr)]"}
      style={normal ? { gridTemplateColumns: workspaceGridTemplateColumns(session.splitRatio) } : undefined}
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
      <div className={normal ? "col-span-3" : "col-span-1"} data-testid="workspace-header-slot">
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
      <div id="workspace-player-pane" className={fullTranscript ? "fixed bottom-md right-md z-10 w-[min(calc(100%-var(--space-2xl)),var(--workspace-pip-width))]" : session.view === "focus" ? "mx-auto flex w-full max-w-[--workspace-focus-max] min-w-0 flex-col gap-md p-md" : "flex min-w-0 flex-col gap-md p-md"} data-testid="workspace-player-slot">
        <WorkspacePlayer ref={playerRef} onFullscreen={playerFullscreen} fullscreenAvailable={fullscreenSupported} />
        {!fullTranscript && <LiveSentence />}
      </div>
      {normal && <WorkspaceDivider ratio={session.splitRatio} onChange={(ratio) => dispatch({ type: "set-split", ratio })} workspaceRef={rootRef} ariaLabel={t("workspace.divider")} controls="workspace-player-pane" />}
      {session.view !== "focus" && <div className={fullTranscript ? "col-span-1 row-start-2 min-h-0 min-w-0 p-md" : "min-h-0 min-w-0"}>{children}</div>}
    </div>
  );
}
