export type WorkspaceView = "normal" | "focus" | "full-transcript";
export type FullscreenTarget = "none" | "workspace" | "player";
export type EscapeAction = "close-popover" | "collapse-drawer" | "exit-fullscreen" | "exit-view" | "none";

export function toggleView(current: WorkspaceView, requested: Exclude<WorkspaceView, "normal">): WorkspaceView {
  return current === requested ? "normal" : requested;
}

/** One press, one thing (spec §6.1): popover → drawer (to collapsed) → fullscreen → Focus / Full Transcript. */
export function escapeAction(state: { popoverOpen: boolean; drawerOpen: boolean; fullscreen: FullscreenTarget; view: WorkspaceView }): EscapeAction {
  if (state.popoverOpen) return "close-popover";
  if (state.drawerOpen) return "collapse-drawer";
  if (state.fullscreen !== "none") return "exit-fullscreen";
  return state.view === "normal" ? "none" : "exit-view";
}
