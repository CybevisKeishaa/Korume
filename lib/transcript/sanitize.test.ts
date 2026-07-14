import { describe, expect, it } from "vitest";
import { sanitizeContentText, sanitizeTranscriptText } from "./sanitize";

describe("sanitizeTranscriptText", () => {
  it("strips <script> tags entirely, leaving only inert text", () => {
    const result = sanitizeTranscriptText("<script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("strips a self-closing tag with an event-handler attribute", () => {
    const result = sanitizeTranscriptText('<img src=x onerror="alert(1)">after');
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("<");
    expect(result.replace(/\s+/g, "")).toContain("after");
  });

  it("strips an unclosed/malformed tag", () => {
    const result = sanitizeTranscriptText("<img onerror=alert(1) src=x");
    expect(result).not.toContain("<");
  });

  it("leaves normal Japanese text completely intact", () => {
    expect(sanitizeTranscriptText("今日はいい天気ですね。")).toBe("今日はいい天気ですね。");
    expect(sanitizeTranscriptText("日本語を勉強する")).toBe("日本語を勉強する");
  });

  it("strips control characters", () => {
    const withControlChar = "hello" + String.fromCharCode(0) + "world";
    expect(sanitizeTranscriptText(withControlChar)).toBe("hello world");
  });

  it("collapses internal whitespace and trims the ends", () => {
    expect(sanitizeTranscriptText("  hello   world  ")).toBe("hello world");
    expect(sanitizeTranscriptText("line one\nline two")).toBe("line one line two");
  });

  it("returns an empty string for input that is only markup", () => {
    expect(sanitizeTranscriptText("<b></b>")).toBe("");
  });

  it("handles an already-clean empty string", () => {
    expect(sanitizeTranscriptText("")).toBe("");
  });
});

describe("sanitizeContentText", () => {
  it("strips script tags and malformed markup, same as sanitizeTranscriptText", () => {
    const result = sanitizeContentText('<script>alert(1)</script><img onerror=alert(1) src=x');
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("strips control characters", () => {
    const withControlChar = "hello" + String.fromCharCode(0) + "world";
    expect(sanitizeContentText(withControlChar)).toBe("hello world");
  });

  it("preserves internal newlines/paragraphs instead of collapsing them", () => {
    expect(sanitizeContentText("line one\nline two")).toBe("line one\nline two");
    expect(sanitizeContentText("段落一\n\n段落二")).toBe("段落一\n\n段落二");
  });

  it("trims only the outer edges", () => {
    expect(sanitizeContentText("  hello world  \n")).toBe("hello world");
  });

  it("leaves normal Japanese text completely intact", () => {
    expect(sanitizeContentText("今日はいい天気ですね。")).toBe("今日はいい天気ですね。");
  });

  it("handles an already-clean empty string", () => {
    expect(sanitizeContentText("")).toBe("");
  });
});
