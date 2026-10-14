// Spec V3: before | after per page and viewport, with a pixel-difference % that is an INDICATOR ONLY.
// Usage: node scripts/typography-report.mjs <dir containing baseline/ and after/>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.argv[2];
if (!root) throw new Error("usage: node scripts/typography-report.mjs <capture root>");
const before = path.join(root, "baseline");
const after = path.join(root, "after");

async function diff(a, b) {
  const [ia, ib] = await Promise.all([a, b].map((file) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const width = Math.min(ia.info.width, ib.info.width);
  const height = Math.min(ia.info.height, ib.info.height);
  let changed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * ia.info.width + x) * 4;
      const j = (y * ib.info.width + x) * 4;
      const delta = Math.abs(ia.data[i] - ib.data[j]) + Math.abs(ia.data[i + 1] - ib.data[j + 1]) + Math.abs(ia.data[i + 2] - ib.data[j + 2]);
      if (delta > 24) changed++;
    }
  }
  const resized = ia.info.width !== ib.info.width || ia.info.height !== ib.info.height
    ? ` · size ${ia.info.width}x${ia.info.height} → ${ib.info.width}x${ib.info.height}` : "";
  return `${((100 * changed) / (width * height)).toFixed(1)}% pixels differ${resized}`;
}

const names = [...new Set([...readdirSync(before), ...readdirSync(after)])].filter((name) => name.endsWith(".png")).sort();
const rows = [];
for (const name of names) {
  const a = path.join(before, name);
  const b = path.join(after, name);
  const note = existsSync(a) && existsSync(b) ? await diff(a, b) : existsSync(a) ? "missing AFTER image" : "missing BASELINE image";
  rows.push(`<section><h2>${name}</h2><p>${note}</p><div class="pair"><img src="baseline/${name}" alt="before"><img src="after/${name}" alt="after"></div></section>`);
}
const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "(missing)");
const html = `<!doctype html><meta charset="utf-8"><title>Type normalization — before / after</title>
<style>body{font:14px system-ui;margin:16px;background:#111;color:#eee}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;border:1px solid #444}pre{white-space:pre-wrap;background:#222;padding:8px}</style>
<h1>Type normalization — before (master) | after (branch)</h1>
<p><strong>At 1920 every page differs by design</strong> (spec S1: the app zooms 1.0 → 1.25 between 1440 and 1920). The pixel % is an indicator, not a verdict.</p>
<h2>Capture log — baseline</h2><pre>${read(path.join(before, "log.txt"))}</pre>
<h2>Capture log — after</h2><pre>${read(path.join(after, "log.txt"))}</pre>
<h2>Ratios (spec V4) — baseline</h2><pre>${read(path.join(before, "ratios.json"))}</pre>
<h2>Ratios (spec V4) — after</h2><pre>${read(path.join(after, "ratios.json"))}</pre>
${rows.join("\n")}`;
writeFileSync(path.join(root, "report.html"), html);
console.log(`${names.length} images -> ${path.join(root, "report.html")}`);
