import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The mascot assets in `public/mascot/poses/` are cut out of the character
 * sheets by `scripts/mascot/extract.js`, and `scripts/mascot/poses.json` is the
 * only record of where each one came from — spec 5.2 requires a filled asset
 * slot to name a source whose origin is recorded.
 *
 * That record is only worth anything if it still describes the files on disk.
 * These tests pin it: no pose without a file, no file without a pose, and the
 * bytes are what re-running the extractor produces.
 */

const ROOT = join(__dirname, "..", "..");
const POSES_DIR = join(ROOT, "public", "mascot", "poses");

type Pose = {
  out: string;
  sheet: string;
  anchor: [number, number];
  caption: string;
  slot: string;
  width: number;
  fade?: [number, number];
};
type Manifest = { sheets: Record<string, string>; poses: Pose[] };

const manifest: Manifest = JSON.parse(
  readFileSync(join(__dirname, "poses.json"), "utf8"),
);

describe("mascot pose manifest", () => {
  it("declares the five landing-page placements", () => {
    // Named individually: a bare length check passes just as happily when a
    // placement is renamed out from under its slot.
    expect(manifest.poses.map((p) => p.out)).toEqual([
      "greeting.png",
      "noting.png",
      "holding-memory.png",
      "looking-ahead.png",
      "resting.png",
    ]);
  });

  it("names a source sheet that exists for every pose", () => {
    expect(manifest.poses.length).toBe(5);
    for (const pose of manifest.poses) {
      const rel: string | undefined = manifest.sheets[pose.sheet];
      expect(rel, `${pose.out} names sheet "${pose.sheet}"`).toBeDefined();
      expect(existsSync(join(ROOT, rel as string)), `${rel} exists`).toBe(true);
    }
  });

  it("records what each pose is and where it goes", () => {
    for (const pose of manifest.poses) {
      expect(pose.caption.length, `${pose.out} caption`).toBeGreaterThan(0);
      expect(pose.slot.length, `${pose.out} slot`).toBeGreaterThan(0);
    }
  });

  it("has no asset in public/mascot/poses that the manifest does not name", () => {
    const onDisk = readdirSync(POSES_DIR).filter((f) => f.endsWith(".png"));
    expect(onDisk.length).toBe(5);
    expect(onDisk.sort()).toEqual(manifest.poses.map((p) => p.out).sort());
  });

  it("the committed assets are what the extractor produces from the sheets", () => {
    // Decoding two 3072x2048 sheets is the slow part; --check reuses one
    // analysis per sheet and compares bytes without writing.
    const run = () =>
      execFileSync(
        process.execPath,
        [join(__dirname, "extract.js"), "--check"],
        { cwd: ROOT, encoding: "utf8" },
      );
    expect(run).not.toThrow();
    const output = run();
    // Every line must be a match line; a "!" line means an asset is stale, and
    // extract.js exits non-zero for that, so assert the shape too.
    const lines = output.trim().split(/\r?\n/);
    expect(lines.length).toBe(5);
    for (const line of lines) expect(line.trimStart().startsWith("=")).toBe(true);
  }, 60_000);
});
