"use client";

import { useSearchParams } from "next/navigation";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { WorkspaceProviders } from "./workspace-context";

export function ShadowingWorkspaceShell({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceBootstrap;
  children: React.ReactNode;
}) {
  const requestedLineId = useSearchParams().get("line");

  return (
    <WorkspaceProviders bootstrap={bootstrap}>
      <div className="grid min-h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]" data-testid="shadowing-workspace">
        <div className="col-span-3" data-testid="workspace-header-slot" />
        <div className="min-w-0" data-line-id={requestedLineId ?? undefined} data-testid="workspace-player-slot" />
        <div aria-hidden="true" className="w-px bg-border" data-testid="workspace-divider-slot" />
        <div className="min-w-0">{children}</div>
      </div>
    </WorkspaceProviders>
  );
}
