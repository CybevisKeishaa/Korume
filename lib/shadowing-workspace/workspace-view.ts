export type WorkspaceView = "normal" | "focus" | "full-transcript";
export type FullscreenTarget = "none" | "workspace" | "player";
export type EscapeAction = "close-popover" | "exit-fullscreen" | "exit-view" | "none";

export function toggleView(current: WorkspaceView, requested: Exclude<WorkspaceView, "normal">): WorkspaceView {
  return current === requested ? "normal" : requested;
}

export function escapeAction(state: { popoverOpen: boolean; fullscreen: FullscreenTarget; view: WorkspaceView }): EscapeAction {
  if (state.popoverOpen) return "close-popover";
  if (state.fullscreen !== "none") return "exit-fullscreen";
  return state.view === "normal" ? "none" : "exit-view";
}
