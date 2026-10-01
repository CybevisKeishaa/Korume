"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resolveStartPosition } from "@/lib/shadowing-workspace/resume";
import { parseSessionResumeRecord, sessionResumeKey } from "@/lib/shadowing-workspace/session-resume-record";
import { LiveSentence } from "./live-sentence";
import { PlaybackRoot } from "./playback-root";
import { WorkspacePlayer } from "./workspace-player";
import { WorkspaceProviders } from "./workspace-context";
import { WorkspaceHeader } from "./workspace-header";

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
        {/* Bounded to the viewport: the transcript scrolls inside its own column and the page never does. */}
        <div className="grid h-dvh grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]" data-testid="shadowing-workspace">
          <div className="col-span-3" data-testid="workspace-header-slot"><WorkspaceHeader /></div>
          <div className="flex min-w-0 flex-col gap-md p-md" data-testid="workspace-player-slot">
            <WorkspacePlayer />
            <LiveSentence />
          </div>
          <div aria-hidden="true" className="w-px bg-border" data-testid="workspace-divider-slot" />
          <div className="min-h-0 min-w-0">{children}</div>
        </div>
      </PlaybackRoot>
    </WorkspaceProviders>
  );
}
