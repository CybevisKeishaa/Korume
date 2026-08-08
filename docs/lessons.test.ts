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

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".blend", ".blend1", ".mp3", ".wav", ".webm", ".mp4",
]);

/**
 * Scan source is `git ls-files`, not a directory glob (spec G10). Git already
 * answers "which files belong to this repo", so no exclusion list is needed
 * and gitignored paths — node_modules, .next, .worktrees, .superpowers — are
 * excluded for free.
 */
function trackedTextFiles(): string[] {
  const stdout = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function definedIds(): string[] {
  const source = readFileSync(LESSONS_PATH, "utf8");
  return [...source.matchAll(HEADING_PATTERN)].map((match) => match[1]);
}

describe("lessons registry integrity", () => {
  it("I1: every L-NNN reference in a tracked file resolves to a defined lesson", () => {
    const defined = new Set(definedIds());
    const dangling: string[] = [];

    for (const file of trackedTextFiles()) {
      let contents: string;
      try {
        contents = readFileSync(path.join(REPO_ROOT, file), "utf8");
      } catch {
        continue; // unreadable or deleted-but-staged; not this guard's concern
      }
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
