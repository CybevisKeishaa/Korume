import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { decode } from "./png.js";
import { join } from "node:path";

/**
 * Every PNG in `public/mascot/poses/` is a `supplied` entry in
 * `scripts/mascot/poses.json`: hand-cut art the owner pasted in, or a trimmed,
 * downscaled copy of the owner's action art. Spec 5.2 requires a filled asset
 * slot to name a source whose origin is recorded, so the record is only worth
 * anything if it still describes the files on disk. These tests pin that: no
 * file without a record, no record without a file, and every recorded size is
 * the file's real size.
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
  supplied: Supplied[];
};

const manifest: Manifest = JSON.parse(
  readFileSync(join(__dirname, "poses.json"), "utf8"),
);

describe("mascot pose manifest", () => {
  it("records a non-empty depiction and origin for every supplied pose", () => {
    // Pattern-gathered collection: assert its size explicitly too, so an
    // empty `supplied` array (or one that silently shrank) can't pass this
    // by vacuous truth.
    expect(manifest.supplied.length).toBe(31);
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
      "celebrating.png",
      "note-taking-on-orb.png",
      "sleeping.png",
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
    // manifest's `slot`. "Transparent" means alpha <= 8, the same floor
    // `opaqueBox` uses, so a derived cut must be trimmed at that floor too —
    // a trim of exactly-zero alpha leaves a faint glow rim (celebrating.png
    // first measured 89.5% wide that way, 2026-10-08).
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const dir = join(process.cwd(), "components", "marketing");
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
      .map((f) => stripComments(readFileSync(join(dir, f), "utf8")));
    expect(sources.length, "no marketing components found to scan").toBeGreaterThan(0);

    const shipped = manifest.supplied.filter((pose) =>
      sources.some((src) => src.includes(pose.out)),
    );
    // L-004: without this, a scan that matched nothing would make the loop
    // below vacuously green — and this guard was written over existing code,
    // which is exactly when that happens unnoticed.
    expect(shipped.map((pose) => pose.out).sort()).toEqual([
      "celebrating.png",
      "hugging-an-orb.png",
      "note-taking-on-orb.png",
      "reading-on-the-orb.png",
      "sleeping.png",
    ]);

    for (const pose of shipped) {
      const { w, h, boxW, boxH } = opaqueBox(join(POSES_DIR, pose.out));
      expect(boxW / w, `${pose.out} horizontal fill`).toBeGreaterThan(0.98);
      expect(boxH / h, `${pose.out} vertical fill`).toBeGreaterThan(0.98);
      // The recorded size must describe the file on disk — otherwise a trim
      // leaves two records disagreeing (CLAUDE.md 6, one fact one home).
      expect({ width: w, height: h }, `${pose.out} manifest dimensions`).toEqual({
        width: pose.width,
        height: pose.height,
      });
    }
  });

  it("has no asset in public/mascot/poses that the manifest does not name", () => {
    const onDisk = readdirSync(POSES_DIR).filter((f) => f.endsWith(".png"));
    const named = manifest.supplied.map((p) => p.out);
    // THE INVARIANT, permanent: the directory and the manifest name the same
    // set. A bare length check on `onDisk` alone would pass just as happily if
    // a file and a record drifted apart by the same count, so compare names.
    expect(onDisk.sort()).toEqual(named.sort());

    // TODAY'S STATE. Not an invariant (L-031). 31 supplied (2026-10-08: the 5 extracted cuts deleted, 3 action-art cuts added).
    // Adding a pose is legitimate and SHOULD fail here — update this number,
    // never the manifest, to make it green again. Kept separate from the
    // invariant above so a later reader can tell which is which.
    expect(onDisk.length, "poses on disk today").toBe(31);
    expect(named.length, "poses the manifest names today").toBe(31);
  });

});
