export type WorkspaceShortcut = "toggle-play" | "previous-sentence" | "next-sentence" | "rewind-5" | "toggle-loop" | "toggle-focus" | "ask-korume";

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea, select, button, a[href], [role="slider"], [role="separator"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="dialog"], [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="menuitemcheckbox"], [role="combobox"], [role="textbox"], [role="spinbutton"], [contenteditable]:not([contenteditable="false"])') !== null;
}

export function shortcutFor(event: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target">): WorkspaceShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey || isInteractiveTarget(event.target)) return null;
  if (event.key === " ") return "toggle-play";
  if (event.key === "ArrowLeft") return event.shiftKey ? "rewind-5" : "previous-sentence";
  if (event.key === "ArrowRight") return "next-sentence";
  if (event.key.toLocaleLowerCase() === "l") return "toggle-loop";
  if (event.key.toLocaleLowerCase() === "f") return "toggle-focus";
  if (event.key.toLocaleLowerCase() === "k") return "ask-korume";
  return null;
}
