import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `public/mascot/poses/` holds two classes of asset, both recorded in
 * `scripts/mascot/poses.json`:
 *
 *  - `poses` — cut out of the character sheets by `scripts/mascot/extract.js`.
 *    Only that script may write these files, and `--check` proves their bytes
 *    still match what the sheets produce.
 *  - `supplied` — hand-cut PNGs the project owner pasted in directly. No
 *    script produced them and none ever will (a human edit is not
 *    reproducible by re-running an extractor), so their record is the
 *    manifest's `origin` line, not a byte comparison.
 *
 * Either way, spec 5.2 requires a filled asset slot to name a source whose
 * origin is recorded, so the record is only worth anything if it still
 * describes the files on disk. These tests pin that: no file without a
 * record, no record without a file, and the `poses` bytes are what
 * re-running the extractor produces.
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
type Supplied = {
  out: string;
  caption: string;
  depicts: string;
  width: number;
  height: number;
  origin: string;
};
type Manifest = {
  sheets: Record<string, string>;
  poses: Pose[];
  supplied: Supplied[];
};

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

  it("records a non-empty depiction and origin for every supplied pose", () => {
    // Pattern-gathered collection: assert its size explicitly too, so an
    // empty `supplied` array (or one that silently shrank) can't pass this
    // by vacuous truth.
    expect(manifest.supplied.length).toBe(27);
    for (const pose of manifest.supplied) {
      expect(pose.depicts.length, `${pose.out} depicts`).toBeGreaterThan(0);
      expect(pose.origin.length, `${pose.out} origin`).toBeGreaterThan(0);
      // Supplied poses fill no slot — spec 5.2's "origin recorded" is
      // satisfied by `origin` above, not by a placement that doesn't exist.
      expect("slot" in pose, `${pose.out} has no slot`).toBe(false);
    }
  });

  it("has no asset in public/mascot/poses that the manifest does not name", () => {
    const onDisk = readdirSync(POSES_DIR).filter((f) => f.endsWith(".png"));
    const named = [
      ...manifest.poses.map((p) => p.out),
      ...manifest.supplied.map((p) => p.out),
    ];
    // Union of both classes: 5 extracted + 27 supplied. A bare length check
    // on `onDisk` alone would pass just as happily if a file and a record
    // drifted apart by the same count, so compare the actual name sets too.
    expect(onDisk.length).toBe(32);
    expect(named.length).toBe(32);
    expect(onDisk.sort()).toEqual(named.sort());
  });

  it("the extracted assets are what the extractor produces from the sheets", () => {
    // Decoding two 3072x2048 sheets is the slow part; --check reuses one
    // analysis per sheet and compares bytes without writing. This applies to
    // manifest.poses only — a supplied pose is not extract.js's output and
    // never can be (a human edit isn't reproducible by re-running a cutter).
    const run = () =>
      execFileSync(
        process.execPath,
        [join(__dirname, "extract.js"), "--check"],
        { cwd: ROOT, encoding: "utf8" },
      );
    expect(run).not.toThrow();
    const output = run();
    // Every line must be a match line; a "!" line means an asset is stale, and
    // extract.js exits non-zero for that, so assert the shape too. The line
    // count is derived from the manifest, not retyped, so it can't drift.
    const lines = output.trim().split(/\r?\n/);
    expect(lines.length).toBe(manifest.poses.length);
    for (const line of lines) expect(line.trimStart().startsWith("=")).toBe(true);

    const suppliedNames = new Set(manifest.supplied.map((p) => p.out));
    const extractedNames = output
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim().slice(2).trim().split(/\s+/, 1)[0] ?? "");
    expect(extractedNames.length).toBe(manifest.poses.length);
    for (const name of extractedNames) {
      expect(name.length, "extracted line names a file").toBeGreaterThan(0);
      expect(suppliedNames.has(name), `${name} is not a supplied pose`).toBe(false);
    }
  }, 60_000);
});
