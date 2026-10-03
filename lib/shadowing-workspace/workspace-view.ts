export type WorkspaceView = "normal" | "focus" | "full-transcript";
export type FullscreenTarget = "none" | "workspace" | "player";
export type EscapeAction = "close-popover" | "close-korume" | "close-inspector" | "collapse-drawer" | "exit-fullscreen" | "exit-view" | "none";

export function toggleView(current: WorkspaceView, requested: Exclude<WorkspaceView, "normal">): WorkspaceView {
  return current === requested ? "normal" : requested;
}

/** One press, one thing: popover → Korume sheet → Inspector → drawer (to collapsed) → fullscreen → Focus / Full Transcript. */
export function escapeAction(state: { popoverOpen: boolean; korumeOpen?: boolean; inspectorOpen: boolean; drawerOpen: boolean; fullscreen: FullscreenTarget; view: WorkspaceView }): EscapeAction {
  if (state.popoverOpen) return "close-popover";
  if (state.korumeOpen) return "close-korume";
  if (state.inspectorOpen) return "close-inspector";
  if (state.drawerOpen) return "collapse-drawer";
  if (state.fullscreen !== "none") return "exit-fullscreen";
  return state.view === "normal" ? "none" : "exit-view";
}
