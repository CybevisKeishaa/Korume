/**
 * Transcript ingestion: parses SRT, WebVTT, and a simple "plain" line format
 * into `ParsedLine[]`. Every returned `textJp` has already gone through
 * `sanitizeTranscriptText`, so callers never need to sanitize again.
 */
import { sanitizeTranscriptText } from "./sanitize";
import type { ParsedLine, TranscriptFormat } from "./types";

const CUE_TIME_RE = /([\d:.,]+)\s*-->\s*([\d:.,]+)/;
const SRT_TIME_PATTERN = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
const VTT_TIME_PATTERN = /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;
const WEBVTT_HEADER_RE = /^WEBVTT/i;
const BRACKET_TIME_RE = /^\[(\d{1,3}):(\d{2})\]\s*(.*)$/;
const TAB_TIME_RE = /^(\d{1,3}):(\d{2})\t(.*)$/;
const TIMESTAMP_RE = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/;

/** Parse an SRT/VTT-style timestamp (HH:MM:SS,mmm | HH:MM:SS.mmm | MM:SS.mmm) to seconds. */
function parseTimestamp(raw: string): number {
  const match = raw.trim().match(TIMESTAMP_RE);
  if (!match) {
    throw new Error(`Invalid cue timestamp: "${raw}"`);
  }
  const [, hoursStr, minutesStr, secondsStr, millisStr] = match;
  const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
  const minutes = parseInt(minutesStr as string, 10);
  const seconds = parseInt(secondsStr as string, 10);
  const millis = parseInt((millisStr as string).padEnd(3, "0"), 10);
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

/** Sniff SRT vs WebVTT vs plain from the raw text. */
function detectFormat(raw: string): "srt" | "vtt" | "plain" {
  if (WEBVTT_HEADER_RE.test(raw.trimStart())) {
    return "vtt";
  }
  if (SRT_TIME_PATTERN.test(raw)) {
    return "srt";
  }
  if (VTT_TIME_PATTERN.test(raw)) {
    return "vtt";
  }
  return "plain";
}

/** Split raw cue text into blank-line-separated blocks, dropping empties. */
function cueBlocks(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * Shared parser for SRT and WebVTT: both are cue blocks of
 * `[identifier line?] TIME --> TIME` followed by one or more text lines,
 * separated by blank lines. We locate the `-->` line by content rather than
 * position, which makes this tolerant of the optional SRT index / VTT cue
 * identifier, WEBVTT headers, and NOTE/STYLE blocks (skipped: no `-->`).
 */
function parseCueBased(raw: string): ParsedLine[] {
  const lines: ParsedLine[] = [];

  for (const block of cueBlocks(raw)) {
    const blockLines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (blockLines.length === 0) {
      continue;
    }
    if (WEBVTT_HEADER_RE.test(blockLines[0] as string)) {
      continue;
    }

    const timeLineIndex = blockLines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex === -1) {
      continue;
    }

    const timeMatch = (blockLines[timeLineIndex] as string).match(CUE_TIME_RE);
    if (!timeMatch) {
      continue;
    }

    let startTime: number;
    let endTime: number;
    try {
      startTime = parseTimestamp(timeMatch[1] as string);
      endTime = parseTimestamp(timeMatch[2] as string);
    } catch {
      continue;
    }

    const textJp = sanitizeTranscriptText(blockLines.slice(timeLineIndex + 1).join(" "));
    if (textJp.length === 0) {
      continue;
    }

    lines.push({ startTime, endTime, textJp });
  }

  return lines;
}

/** Parse the simple `[mm:ss] text` / `mm:ss<TAB>text` line format. */
function parsePlain(raw: string): ParsedLine[] {
  const lines: ParsedLine[] = [];

  for (const rawLine of raw.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const match = line.match(BRACKET_TIME_RE) ?? line.match(TAB_TIME_RE);
    if (!match) {
      continue;
    }

    const [, minutesStr, secondsStr, text] = match;
    const startTime = parseInt(minutesStr as string, 10) * 60 + parseInt(secondsStr as string, 10);
    const textJp = sanitizeTranscriptText(text as string);
    if (textJp.length === 0) {
      continue;
    }

    lines.push({ startTime, endTime: null, textJp });
  }

  return lines;
}

/**
 * Parse a raw transcript into structured, sanitized lines.
 * @param format defaults to `"auto"`, sniffing SRT vs WebVTT vs plain.
 */
export function parseTranscript(raw: string, format: TranscriptFormat = "auto"): ParsedLine[] {
  const resolved = format === "auto" ? detectFormat(raw) : format;

  if (resolved === "plain") {
    return parsePlain(raw);
  }
  return parseCueBased(raw);
}
