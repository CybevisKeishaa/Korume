import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/kanji?level=N5")).toBe("/kanji?level=N5");
  });

  it("allows locale-prefixed paths (the shape the l9a middleware now builds)", () => {
    expect(safeRedirectPath("/en/dashboard")).toBe("/en/dashboard");
    expect(safeRedirectPath("/vi/vocab/review")).toBe("/vi/vocab/review");
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

  it("accepts percent-encoded slash/backslash payloads as literal same-origin paths", () => {
    // These strings are NOT decoded anywhere in the redirect pipeline
    // (Next's redirect() just writes the string into a Location header /
    // client navigation target). "%2F"/"%5C" are ordinary path characters
    // to every consumer here, so the browser never reinterprets them as an
    // authority-switching "//" or "\\" and the navigation stays same-origin.
    // Probed explicitly (task 5 checklist item 2) because encoded-slash
    // bypasses are a known open-redirect class in code that DOES decode
    // before validating.
    expect(safeRedirectPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    expect(safeRedirectPath("/%5Cevil.com")).toBe("/%5Cevil.com");
  });
});
