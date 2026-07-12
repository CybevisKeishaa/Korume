import { describe, expect, it } from "vitest";
import { parseTranscript } from "./parse";

describe("parseTranscript — SRT", () => {
  const srt = `1
00:00:01,000 --> 00:00:04,000
こんにちは

2
00:00:05,500 --> 00:00:08,250
世界
へようこそ
`;

  it("parses cues with correct start/end times in seconds", () => {
    const lines = parseTranscript(srt, "srt");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ startTime: 1, endTime: 4, textJp: "こんにちは" });
    expect(lines[1]?.startTime).toBe(5.5);
    expect(lines[1]?.endTime).toBe(8.25);
  });

  it("joins multi-line cue text into one line", () => {
    const lines = parseTranscript(srt, "srt");
    expect(lines[1]?.textJp).toBe("世界 へようこそ");
  });

  it("auto-detects SRT format", () => {
    expect(parseTranscript(srt)).toEqual(parseTranscript(srt, "srt"));
  });

  it("tolerates blank lines, extra blank lines, and no trailing newline", () => {
    const messy = "\n\n1\n00:00:00,000 --> 00:00:01,000\n中\n\n\n\n2\n00:00:02,000 --> 00:00:03,000\n上\n\n\n";
    const lines = parseTranscript(messy, "srt");
    expect(lines.map((l) => l.textJp)).toEqual(["中", "上"]);
  });

  it("preserves out-of-order cues as given (no re-sorting)", () => {
    const outOfOrder = `1
00:00:10,000 --> 00:00:12,000
二番目

2
00:00:01,000 --> 00:00:02,000
一番目
`;
    const lines = parseTranscript(outOfOrder, "srt");
    expect(lines.map((l) => l.textJp)).toEqual(["二番目", "一番目"]);
  });
});

describe("parseTranscript — WebVTT", () => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
こんにちは

cue-2
00:00:05.000 --> 00:00:08.000
世界
へようこそ
`;

  it("parses cues, skipping the WEBVTT header", () => {
    const lines = parseTranscript(vtt, "vtt");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ startTime: 1, endTime: 4, textJp: "こんにちは" });
  });

  it("handles a named cue identifier line before the timestamp", () => {
    const lines = parseTranscript(vtt, "vtt");
    expect(lines[1]?.textJp).toBe("世界 へようこそ");
    expect(lines[1]?.startTime).toBe(5);
  });

  it("supports MM:SS.mmm timestamps without an hours component", () => {
    const shortVtt = "WEBVTT\n\n00:01.500 --> 00:04.000\n短い\n";
    const lines = parseTranscript(shortVtt, "vtt");
    expect(lines[0]?.startTime).toBe(1.5);
    expect(lines[0]?.endTime).toBe(4);
  });

  it("auto-detects WebVTT via the WEBVTT header", () => {
    expect(parseTranscript(vtt)).toEqual(parseTranscript(vtt, "vtt"));
  });

  it("skips NOTE blocks that have no --> line", () => {
    const withNote = `WEBVTT

NOTE this is a comment

00:00:01.000 --> 00:00:02.000
本文
`;
    const lines = parseTranscript(withNote, "vtt");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.textJp).toBe("本文");
  });
});

describe("parseTranscript — plain", () => {
  it("parses [mm:ss] text lines", () => {
    const plain = "[00:01] こんにちは\n[01:05] 世界";
    const lines = parseTranscript(plain, "plain");
    expect(lines).toEqual([
      { startTime: 1, endTime: null, textJp: "こんにちは" },
      { startTime: 65, endTime: null, textJp: "世界" },
    ]);
  });

  it("parses mm:ss<TAB>text lines", () => {
    const plain = "00:01\tこんにちは\n01:05\t世界";
    const lines = parseTranscript(plain, "plain");
    expect(lines).toEqual([
      { startTime: 1, endTime: null, textJp: "こんにちは" },
      { startTime: 65, endTime: null, textJp: "世界" },
    ]);
  });

  it("auto-detects plain format when there's no --> or WEBVTT marker", () => {
    const plain = "[00:01] こんにちは";
    expect(parseTranscript(plain)).toEqual(parseTranscript(plain, "plain"));
  });

  it("skips blank and unparsable lines", () => {
    const plain = "[00:01] こんにちは\n\nnot a timestamp line\n[00:05] 世界";
    const lines = parseTranscript(plain, "plain");
    expect(lines.map((l) => l.textJp)).toEqual(["こんにちは", "世界"]);
  });
});

describe("parseTranscript — sanitization", () => {
  it("strips HTML markup from SRT cue text", () => {
    const malicious = `1
00:00:01,000 --> 00:00:02,000
<script>alert(1)</script>安全
`;
    const lines = parseTranscript(malicious, "srt");
    expect(lines[0]?.textJp).not.toContain("<script>");
  });

  it("strips HTML markup from plain-format text", () => {
    const malicious = '[00:01] <img src=x onerror=alert(1)>text';
    const lines = parseTranscript(malicious, "plain");
    expect(lines[0]?.textJp).not.toContain("<img");
  });
});
