import { describe, expect, it } from "vitest";
import { isInteractiveTarget, shortcutFor } from "./shortcuts";

const event = (key: string, target: EventTarget | null = document.body, modifiers = {}) => ({ key, target, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });

describe("workspace shortcuts", () => {
  it("maps workspace keys", () => {
    expect(shortcutFor(event(" "))).toBe("toggle-play");
    expect(shortcutFor(event("ArrowLeft"))).toBe("previous-sentence");
    expect(shortcutFor(event("ArrowRight"))).toBe("next-sentence");
    expect(shortcutFor(event("ArrowLeft", document.body, { shiftKey: true }))).toBe("rewind-5");
    expect(shortcutFor(event("l"))).toBe("toggle-loop");
    expect(shortcutFor(event("L"))).toBe("toggle-loop");
    expect(shortcutFor(event("f"))).toBe("toggle-focus");
    expect(shortcutFor(event("F"))).toBe("toggle-focus");
  });

  it("maps k to Ask Korume only outside editable targets", () => {
    expect(shortcutFor(event("k"))).toBe("ask-korume");
    expect(shortcutFor(event("K"))).toBe("ask-korume");
    expect(shortcutFor(event("k", document.createElement("textarea")))).toBeNull();
    expect(shortcutFor(event("k", document.body, { metaKey: true }))).toBeNull();
  });

  it("does not use modified keys", () => {
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) expect(shortcutFor(event(" ", document.body, modifiers))).toBeNull();
  });

  it("leaves interactive and editable targets alone", () => {
    const targets = ["input", "textarea", "select", "button", "a[href]", '[role="slider"]', '[role="separator"]', '[role="menuitem"]', '[role="option"]', '[contenteditable="true"]', '[role="dialog"] span'];
    for (const selector of targets) {
      let target: Element = document.createElement("div");
      if (selector === "a[href]") target = Object.assign(document.createElement("a"), { href: "#" });
      else if (selector.includes(" ")) { const dialog = document.createElement("div"); dialog.setAttribute("role", "dialog"); const child = document.createElement("span"); dialog.append(child); target = child; }
      else if (selector.startsWith("input") || selector.startsWith("textarea") || selector.startsWith("select") || selector.startsWith("button")) target = document.createElement(selector);
      if (selector.includes("role=") && !selector.includes(" ")) target.setAttribute("role", selector.match(/role="([^"]+)/)?.[1] ?? "");
      if (selector.includes("contenteditable")) target.setAttribute("contenteditable", "true");
      expect(isInteractiveTarget(target)).toBe(true);
      expect(shortcutFor(event(" ", target))).toBeNull();
    }
  });

  it("treats ARIA widgets as interactive but not contenteditable=false", () => {
    for (const role of ["button", "switch", "tab", "checkbox", "menuitemcheckbox", "combobox", "textbox", "spinbutton"]) {
      const widget = document.createElement("div");
      widget.setAttribute("role", role);
      expect(isInteractiveTarget(widget)).toBe(true);
    }
    const inert = document.createElement("div");
    inert.setAttribute("contenteditable", "false");
    expect(isInteractiveTarget(inert)).toBe(false);
  });

  it("accepts body and plain div targets", () => {
    expect(isInteractiveTarget(document.body)).toBe(false);
    expect(shortcutFor(event(" ", document.createElement("div")))).toBe("toggle-play");
  });
});
