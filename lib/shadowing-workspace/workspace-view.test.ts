import { describe, expect, it } from "vitest";
import { escapeAction, toggleView } from "./workspace-view";

describe("workspace views", () => {
  it("toggles and switches requested views", () => {
    expect(toggleView("normal", "focus")).toBe("focus");
    expect(toggleView("focus", "focus")).toBe("normal");
    expect(toggleView("focus", "full-transcript")).toBe("full-transcript");
  });

  it("applies escape priority", () => {
    expect(escapeAction({ popoverOpen: true, fullscreen: "player", view: "focus" })).toBe("close-popover");
    expect(escapeAction({ popoverOpen: false, fullscreen: "player", view: "focus" })).toBe("exit-fullscreen");
    expect(escapeAction({ popoverOpen: false, fullscreen: "none", view: "focus" })).toBe("exit-view");
    expect(escapeAction({ popoverOpen: false, fullscreen: "none", view: "normal" })).toBe("none");
  });
});
