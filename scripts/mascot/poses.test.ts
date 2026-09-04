import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { decode } from "./png.js";
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

/** The bounding box of a PNG's non-transparent pixels. */
function opaqueBox(path: string) {
  const { w, h, ch, data } = decode(path);
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 8, not 0: a hand-cut edge feathers, and a pixel at alpha 3 is not
      // margin a viewer can see.
      if (ch === 4 && (data[(y * w + x) * ch + 3] ?? 0) <= 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { w, h, boxW: x1 - x0 + 1, boxH: y1 - y0 + 1 };
}


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
  /** Present only once the pose is wired into a component — see the test below. */
  slot?: string;
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
  // "the five EXTRACTED poses", not "the five placements": task 9 left
  // holding-memory.png in this array with no landing-page slot (§6 shipped a
  // supplied pose whose orb the frozen alt copy actually describes), and
  // extract.js still reproduces it, so it still belongs here.
  it("declares the five extracted poses", () => {
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
    }
  });

  it("names every supplied pose that has been wired into a component", () => {
    // This test used to assert `"slot" in pose === false` for EVERY supplied
    // entry, which contradicted the manifest's own `$comment`: "If one is later
    // wired into a component, add a `slot` to its `supplied` entry — it does
    // not migrate to `poses`." Task 9 (§6) is the first time that happened, so
    // the rule is now written the way the manifest states it rather than as a
    // blanket ban. Spec 5.2's "origin recorded" is still satisfied by `origin`
    // for every supplied pose, placed or not.
    //
    // Named individually rather than counted: a bare count passes just as
    // happily when one placement is dropped and another appears.
    const placed = manifest.supplied.filter((pose) => pose.slot !== undefined);
    // Manifest order, not placement order: §8 (`hugging-an-orb`) was wired after
    // §6 (`reading-on-the-orb`) but sorts earlier in `supplied`.
    expect(placed.map((pose) => pose.out)).toEqual([
      "hugging-an-orb.png",
      "reading-on-the-orb.png",
    ]);
    for (const pose of placed) {
      expect((pose.slot as string).length, `${pose.out} slot`).toBeGreaterThan(0);
    }
  });

  it("wires each placed pose into a component that actually references its file", () => {
    // The `slot` field is prose and prose drifts. This makes it checkable: a
    // pose recorded as placed must appear, by filename, in some component under
    // components/marketing. Without this, deleting §8's <Image> would leave the
    // manifest claiming a placement that no longer exists — and the test above
    // would still pass, because it only reads the manifest.
    const placed = manifest.supplied.filter((pose) => pose.slot !== undefined);
    expect(placed.length, "no placed poses to check").toBeGreaterThan(0);

    const dir = join(process.cwd(), "components", "marketing");
    // ⚠️ COMMENTS ARE STRIPPED FIRST, and that is the whole test. Written
    // without this it was vacuously green: every one of these components
    // explains in a docblock WHY it chose its pose, by filename, so a plain
    // `includes` matched the prose and kept passing after the actual <Image>
    // was repointed at a different file. Caught by mutation — swapping §8's
    // pose for `relax.png` left all assertions green until the strip was added.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
      .map((f) => stripComments(readFileSync(join(dir, f), "utf8")));
    expect(sources.length, "no marketing components found to scan").toBeGreaterThan(0);

    for (const pose of placed) {
      expect(
        sources.some((src) => src.includes(pose.out)),
        `${pose.out} is recorded as placed but no component references it in code`,
      ).toBe(true);
    }
  });

  it("draws every pose that ships with no transparent margin around it", () => {
    // A placement sizes the FILE, not the creature — `sizes="160px"` paints the
    // image box — so transparent margin is drawn size the artwork never gets,
    // and asymmetric margin also pushes it off its own box's centre. §6 shipped
    // `reading-on-the-orb.png` at 82.6% x 90.8% of its frame: in a 160px box
    // the creature drew 132 x 145 CSS px, sat 5.6px left of centre, and its
    // 16px bottom margin floated the orb 5.1 CSS px ABOVE the rail that
    // `capability-chain.tsx` bottom-aligns it to.
    //
    // Scoped to what SHIPS, read from the components rather than from the
    // manifest's `slot`. Both classes are scanned on purpose: three of the five
    // poses a component references are `extract.js`'s output, and THEY are what
    // proves the convention — a cutter emits a tight box, so all three measure
    // 100% fill. The two that did not were hand-cut and pasted in.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const dir = join(process.cwd(), "components", "marketing");
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
      .map((f) => stripComments(readFileSync(join(dir, f), "utf8")));
    expect(sources.length, "no marketing components found to scan").toBeGreaterThan(0);

    const shipped = [...manifest.poses, ...manifest.supplied].filter((pose) =>
      sources.some((src) => src.includes(pose.out)),
    );
    // L-004: without this, a scan that matched nothing would make the loop
    // below vacuously green — and this guard was written over existing code,
    // which is exactly when that happens unnoticed.
    expect(shipped.map((pose) => pose.out).sort()).toEqual([
      "greeting.png",
      "hugging-an-orb.png",
      "noting.png",
      "reading-on-the-orb.png",
      "resting.png",
    ]);

    for (const pose of shipped) {
      const { w, h, boxW, boxH } = opaqueBox(join(POSES_DIR, pose.out));
      expect(boxW / w, `${pose.out} horizontal fill`).toBeGreaterThan(0.98);
      expect(boxH / h, `${pose.out} vertical fill`).toBeGreaterThan(0.98);
      // A supplied entry records both dimensions, and they must describe the
      // file on disk — otherwise a trim leaves two records disagreeing
      // (CLAUDE.md 6, one fact one home). An extracted entry records only the
      // cut `width`; its height comes from the sheet, and `extract.js --check`
      // already byte-compares those files.
      if ("height" in pose) {
        expect({ width: w, height: h }, `${pose.out} manifest dimensions`).toEqual({
          width: pose.width,
          height: pose.height,
        });
      }
    }
  });

  it("has no asset in public/mascot/poses that the manifest does not name", () => {
    const onDisk = readdirSync(POSES_DIR).filter((f) => f.endsWith(".png"));
    const named = [
      ...manifest.poses.map((p) => p.out),
      ...manifest.supplied.map((p) => p.out),
    ];
    // THE INVARIANT, permanent: the directory and the manifest name the same
    // set. A bare length check on `onDisk` alone would pass just as happily if
    // a file and a record drifted apart by the same count, so compare names.
    expect(onDisk.sort()).toEqual(named.sort());

    // TODAY'S STATE. Not an invariant (L-031). 5 extracted + 27 supplied = 32.
    // Adding a pose is legitimate and SHOULD fail here — update this number,
    // never the manifest, to make it green again. Kept separate from the
    // invariant above so a later reader can tell which is which.
    expect(onDisk.length, "poses on disk today").toBe(32);
    expect(named.length, "poses the manifest names today").toBe(32);
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
