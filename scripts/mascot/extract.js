/**
 * Cuts the landing page's mascot assets out of the character sheets in
 * public/mascot/, per scripts/mascot/poses.json.
 *
 *   node scripts/mascot/extract.js          # rewrite public/mascot/poses/
 *   node scripts/mascot/extract.js --check  # fail if the outputs are stale
 *
 * Deliberately dependency-free: it decodes and encodes PNG over node's own
 * zlib (see png.js), so preparing an asset never adds a package to the app.
 */
const fs = require("node:fs");
const path = require("node:path");
const { analyse, crop, resize, poseIds, tightBox, componentAt } = require("./matte.js");
const { encode } = require("./png.js");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "public", "mascot", "poses");
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "poses.json"), "utf8"),
);

const check = process.argv.includes("--check");
const sheets = new Map();
const stale = [];

for (const pose of manifest.poses) {
  const rel = manifest.sheets[pose.sheet];
  if (!rel) throw new Error(`${pose.out}: unknown sheet "${pose.sheet}"`);
  const sheetPath = path.join(ROOT, rel);
  if (!sheets.has(sheetPath)) sheets.set(sheetPath, analyse(sheetPath));
  const ctx = sheets.get(sheetPath);

  const [ax, ay] = pose.anchor;
  const main = componentAt(ctx, ax, ay);
  if (!main) {
    throw new Error(
      `${pose.out}: anchor ${ax},${ay} lands on background in ${rel} — ` +
        `it must sit inside the drawing.`,
    );
  }
  const ids = poseIds(ctx, main);
  const box = tightBox(ctx, ids);
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const rgba = crop(ctx, box.x0, box.y0, w, h, ids);

  if (pose.fade) {
    const [from, to] = pose.fade;
    for (let y = 0; y < h; y++) {
      const f = (y / h - from) / (to - from);
      if (f <= 0) continue;
      const mul = f >= 1 ? 0 : 1 - f * f * (3 - 2 * f); // smoothstep
      for (let x = 0; x < w; x++) rgba[(y * w + x) * 4 + 3] *= mul;
    }
  }

  const tw = pose.width;
  const th = Math.round((h * tw) / w);
  const png = encode(tw, th, resize(rgba, w, h, tw, th));

  const dest = path.join(OUT_DIR, pose.out);
  const current = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (current && current.equals(png)) {
    console.log(`  = ${pose.out.padEnd(20)} ${tw}x${th}  ${pose.caption}`);
    continue;
  }
  if (check) {
    stale.push(pose.out);
    console.log(`  ! ${pose.out.padEnd(20)} STALE`);
    continue;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(dest, png);
  console.log(
    `  + ${pose.out.padEnd(20)} ${tw}x${th}  ` +
      `from ${pose.sheet} @ ${ax},${ay}  ${pose.caption}`,
  );
}

if (check && stale.length) {
  console.error(
    `\n${stale.length} asset(s) do not match the manifest: ${stale.join(", ")}\n` +
      `Run: node scripts/mascot/extract.js`,
  );
  process.exit(1);
}
