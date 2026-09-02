// Trims a pose to its opaque bounding box.
//
// WHY THIS EXISTS. A placement sizes the FILE, not the creature: §6 renders
// `reading-on-the-orb.png` with `sizes="160px"`, so transparent margin inside
// the file is drawn size the artwork never gets. That pose shipped filling
// 82.6% x 90.8% of its own frame — the creature drew 132 x 145 CSS px in a
// 160px box, sat 5.6 px left of the box's centre because the right margin was
// 61px against the left's 26, and its 16px bottom margin floated the orb 5.1
// CSS px above the rail `capability-chain.tsx` bottom-aligns it to.
//
// `extract.js` already emits tight cuts, which is why all three of its outputs
// that ship measure 100% fill. This is the same guarantee for the poses the
// owner hand-cut and pasted in.
//
// LOSSLESS FOR THE CREATURE: only margin at or below ALPHA_FLOOR is removed, so
// every pixel the artwork draws survives byte-identical. `--check` re-derives
// the box and reports without writing, the contract `extract.js --check` has.
//
// Usage:
//   node scripts/mascot/trim.js [--check] <path> [<path> ...]
const { decode, encode } = require("./png.js");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
// 8, not 0: a hand-cut edge feathers, and a pixel at alpha 3 is not margin a
// viewer can see. Kept identical to the guard in `poses.test.ts`.
const ALPHA_FLOOR = 8;

function opaqueBox({ w, h, ch, data }) {
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ch === 4 && data[(y * w + x) * ch + 3] <= ALPHA_FLOOR) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("image is fully transparent");
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function trim(rel, { write }) {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  const img = decode(abs);
  const box = opaqueBox(img);
  const already = box.x0 === 0 && box.y0 === 0 && box.w === img.w && box.h === img.h;

  console.log(
    `${rel}: ${img.w}x${img.h} -> ${box.w}x${box.h} (offset ${box.x0},${box.y0})` +
      (already ? "  already trimmed" : write ? "  WRITTEN" : "  would trim"),
  );
  if (already || !write) return box;

  // `encode` writes colortype 6 unconditionally and calls `data.copy`, so it
  // wants an RGBA **Buffer** — matching `decode`, which returns one. A pose
  // without an alpha channel has no margin to trim and never reaches here.
  if (img.ch !== 4) throw new Error(`${rel}: expected RGBA, got ${img.ch} channels`);

  const rowBytes = box.w * 4;
  const out = Buffer.alloc(box.h * rowBytes);
  for (let y = 0; y < box.h; y++) {
    const src = ((y + box.y0) * img.w + box.x0) * 4;
    img.data.copy(out, y * rowBytes, src, src + rowBytes);
  }
  fs.writeFileSync(abs, encode(box.w, box.h, out));
  return box;
}

const write = !process.argv.includes("--check");
const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (files.length === 0) {
  console.error("usage: node scripts/mascot/trim.js [--check] <path> [<path> ...]");
  process.exit(1);
}
for (const file of files) trim(file, { write });
