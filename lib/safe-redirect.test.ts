import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/kanji?level=N5")).toBe("/kanji?level=N5");
  });

  it("rejects protocol-relative and backslash open-redirect payloads", () => {
    expect(safeRedirectPath("//evil.com")).toBeNull();
    expect(safeRedirectPath("/\\evil.com")).toBeNull();
    expect(safeRedirectPath("\\\\evil.com")).toBeNull();
    expect(safeRedirectPath("https://evil.com")).toBeNull();
  });

  it("rejects non-path and empty values", () => {
    expect(safeRedirectPath("dashboard")).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(42)).toBeNull();
  });
});
