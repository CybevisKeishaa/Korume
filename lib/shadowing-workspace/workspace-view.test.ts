import { describe, expect, it } from "vitest";
import { escapeAction, toggleView } from "./workspace-view";

describe("workspace views", () => {
  it("toggles and switches requested views", () => {
    expect(toggleView("normal", "focus")).toBe("focus");
    expect(toggleView("focus", "focus")).toBe("normal");
    expect(toggleView("focus", "full-transcript")).toBe("full-transcript");
  });

  it("applies escape priority", () => {
    expect(escapeAction({ popoverOpen: true, inspectorOpen: true, drawerOpen: true, fullscreen: "player", view: "focus" })).toBe("close-popover");
    expect(escapeAction({ popoverOpen: false, inspectorOpen: true, drawerOpen: true, fullscreen: "player", view: "focus" })).toBe("close-inspector");
    expect(escapeAction({ popoverOpen: false, inspectorOpen: false, drawerOpen: true, fullscreen: "player", view: "focus" })).toBe("collapse-drawer");
    expect(escapeAction({ popoverOpen: false, inspectorOpen: false, drawerOpen: false, fullscreen: "player", view: "focus" })).toBe("exit-fullscreen");
    expect(escapeAction({ popoverOpen: false, inspectorOpen: false, drawerOpen: false, fullscreen: "none", view: "focus" })).toBe("exit-view");
    expect(escapeAction({ popoverOpen: false, inspectorOpen: false, drawerOpen: false, fullscreen: "none", view: "normal" })).toBe("none");
  });

  it("closes the Korume sheet after a popover and before the Inspector (Ask Korume spec §6.2)", () => {
    const base = { popoverOpen: false, korumeOpen: true, inspectorOpen: true, drawerOpen: true, fullscreen: "none" as const, view: "normal" as const };
    expect(escapeAction({ ...base, popoverOpen: true })).toBe("close-popover");
    expect(escapeAction(base)).toBe("close-korume");
    expect(escapeAction({ ...base, korumeOpen: false })).toBe("close-inspector");
  });
});
