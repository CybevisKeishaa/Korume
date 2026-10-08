/**
 * Builds the print watermark (public/mascot/watermark/korume.png) from the owner's source art
 * assets/mascot/source/Korume.png (owner 2026-10-07). The source is RGB glow art on solid black,
 * so black becomes transparency ("colour to alpha"): alpha is the brightest channel, and the colour
 * is divided back out, which keeps the soft glow edges instead of cutting a halo.
 *
 *   node scripts/mascot/watermark.js
 *
 * Dependency-free (png.js + matte.js only).
 */
const fs = require("node:fs");
const path = require("node:path");
const { decode, encode } = require("./png.js");
const { resize } = require("./matte.js");

const ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = path.join(ROOT, "assets", "mascot", "source", "Korume.png");
const OUT = path.join(ROOT, "public", "mascot", "watermark", "korume.png");
const WIDTH = 900; // ~75mm at 300dpi; the sheet prints it at 70–90mm
const FLOOR = 10; // near-black compression noise in the background stays fully transparent

const { w, h, ch, data } = decode(SOURCE);
const rgba = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const [r, g, b] = [data[i * ch], data[i * ch + 1], data[i * ch + 2]];
  const max = Math.max(r, g, b);
  const alpha = max <= FLOOR ? 0 : (max - FLOOR) / (255 - FLOOR);
  rgba[i * 4] = max ? Math.round((r * 255) / max) : 0;
  rgba[i * 4 + 1] = max ? Math.round((g * 255) / max) : 0;
  rgba[i * 4 + 2] = max ? Math.round((b * 255) / max) : 0;
  rgba[i * 4 + 3] = Math.round(alpha * 255);
}
const height = Math.round((h * WIDTH) / w);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encode(WIDTH, height, resize(rgba, w, h, WIDTH, height)));
console.log(`${path.relative(ROOT, OUT)} ${WIDTH}x${height}`);
