import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("de-duplicates conflicting Tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

/**
 * Regression test for the tailwind-merge misclassification bug (final review,
 * Task 12, item 1): stock tailwind-merge v2 doesn't know this repo's custom
 * font-size/shadow/leading/font-weight/duration/ease/z-index scales, so it
 * treats e.g. `text-caption` as a text COLOR utility and silently drops it
 * whenever a real color class follows in the same cn() call. `lib/utils.ts`
 * must configure `extendTailwindMerge` so these custom tokens merge inside
 * their real group instead of colliding with unrelated groups.
 */
describe("cn (tailwind-merge custom token config)", () => {
  it("keeps a custom font-size token alongside an unrelated text color", () => {
    const result = cn("text-body", "text-foreground");
    expect(result).toContain("text-body");
    expect(result).toContain("text-foreground");
  });

  it("keeps a custom font-size token alongside an unrelated bg color", () => {
    const result = cn("text-caption font-medium", "bg-muted text-muted-foreground");
    expect(result).toContain("text-caption");
    expect(result).toContain("bg-muted");
    expect(result).toContain("text-muted-foreground");
  });

  it("resolves a real font-size conflict in favor of the later class", () => {
    const result = cn("text-sm", "text-body");
    expect(result).not.toContain("text-sm");
    expect(result).toContain("text-body");
  });

  it("merges custom spacing scale with numeric spacing (same group)", () => {
    const result = cn("px-4", "px-sm");
    expect(result).not.toContain("px-4");
    expect(result).toContain("px-sm");
  });

  it("resolves a custom shadow conflict in favor of the later class", () => {
    const result = cn("shadow-sm", "shadow-floating");
    expect(result).not.toContain("shadow-sm");
    expect(result).toContain("shadow-floating");
  });

  it("resolves a custom z-index conflict in favor of the later class", () => {
    const result = cn("z-40", "z-overlay");
    expect(result).not.toContain("z-40");
    expect(result).toContain("z-overlay");
  });

  it("still resolves stock Tailwind color conflicts (sanity check)", () => {
    const result = cn("bg-primary", "bg-accent");
    expect(result).not.toContain("bg-primary");
    expect(result).toContain("bg-accent");
  });
});
