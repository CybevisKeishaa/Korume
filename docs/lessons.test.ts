import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..");
const LESSONS_PATH = path.join(REPO_ROOT, "docs", "lessons.md");

/** Every reference to a lesson, anywhere. */
const REFERENCE_PATTERN = /\bL-\d{3}\b/g;
/** A lesson *definition*. Only headings define ids. */
const HEADING_PATTERN = /^### (L-\d{3}) — /gm;

/** How many leading bytes to sniff for a NUL byte when classifying binary vs text. */
const BINARY_SNIFF_BYTES = 8192;

/**
 * `git ls-files` is the sole membership boundary (spec G10): it already
 * answers "which files belong to this repo", so no exclusion list exists to
 * drift, and gitignored paths — node_modules, .next, .worktrees,
 * .superpowers — are excluded for free. Binary files are detected by
 * content, not by a maintained extension list: a NUL byte within the first
 * BINARY_SNIFF_BYTES bytes marks a file binary, and it is skipped.
 */
function trackedFiles(): string[] {
  const stdout = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split("\0").filter(Boolean);
}

function definedIds(): string[] {
  const source = readFileSync(LESSONS_PATH, "utf8");
  return [...source.matchAll(HEADING_PATTERN)].map((match) => match[1]);
}

describe("lessons registry integrity", () => {
  it("I1: every L-NNN reference in a tracked file resolves to a defined lesson", () => {
    const defined = new Set(definedIds());
    const dangling: string[] = [];

    for (const file of trackedFiles()) {
      let buffer: Buffer;
      try {
        buffer = readFileSync(path.join(REPO_ROOT, file));
      } catch {
        continue; // unreadable or deleted-but-staged; not this guard's concern
      }
      if (buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) continue; // binary

      const contents = buffer.toString("utf8");
      for (const [id] of contents.matchAll(REFERENCE_PATTERN)) {
        if (!defined.has(id)) dangling.push(`${file}: ${id}`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it("I2: every lesson id is defined exactly once", () => {
    const ids = definedIds();
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(duplicates).toEqual([]);
    expect(ids.length).toBeGreaterThan(0);
  });
});
