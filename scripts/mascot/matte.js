/**
 * Separating one mascot pose from a character sheet.
 *
 * The sheets draw a cream character on a cream ground, so a luminance threshold
 * would punch holes through the character's own highlights. Everything here is
 * built on connectivity instead: the ground is whatever a fill seeded from the
 * image border can reach, so an interior highlight brighter than the tolerance
 * survives — nothing outside can reach it.
 */
const { decode, encode } = require("./png.js");

/** Background tolerance, per channel, around the sheet's own median border colour. */
const BG_TOLERANCE = 10;

/**
 * A cast shadow is the ground colour scaled down by one factor across all three
 * channels. That is what separates it from the character, whose shading shifts
 * hue as well as level, and it is why the fill can swallow a shadow without
 * biting into the drawing.
 */
const SHADOW_MIN_SCALE = 0.7;
const SHADOW_MAX_SCALE = 0.985;
const SHADOW_MAX_RESIDUAL = 5;

/**
 * Decodes a sheet and returns everything else here needs: the pixels, the
 * background colour, the background mask, per-pixel coverage (`cov` — the
 * antialiased inverse of that mask), a component label per pixel, and the
 * components themselves.
 */
function analyse(filePath) {
  const img = decode(filePath);
  const { w, h, ch, data } = img;
  const n = w * h;

  const border = [];
  for (let x = 0; x < w; x += 7) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += 7) border.push([0, y], [w - 1, y]);
  const median = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const B = [0, 1, 2].map((k) =>
    median(border.map(([x, y]) => data[(y * w + x) * ch + k])),
  );

  const at = (i) => {
    const o = i * ch;
    return [data[o], data[o + 1], data[o + 2]];
  };
  const isBackground = (i) => {
    const c = at(i);
    return (
      Math.abs(c[0] - B[0]) <= BG_TOLERANCE &&
      Math.abs(c[1] - B[1]) <= BG_TOLERANCE &&
      Math.abs(c[2] - B[2]) <= BG_TOLERANCE
    );
  };
  const isShadow = (i) => {
    const c = at(i);
    const k = (c[0] / B[0] + c[1] / B[1] + c[2] / B[2]) / 3;
    if (k > SHADOW_MAX_SCALE || k < SHADOW_MIN_SCALE) return false;
    for (let j = 0; j < 3; j++) {
      if (Math.abs(c[j] - k * B[j]) > SHADOW_MAX_RESIDUAL) return false;
    }
    return true;
  };

  const bg = new Uint8Array(n);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i]) continue;
    if (!isBackground(i) && !isShadow(i)) continue;
    bg[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // Coverage: a 3x3 mean of the mask, so a boundary pixel gets partial alpha
  // instead of a staircase edge.
  const cov = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          sum += bg[ny * w + nx];
          count++;
        }
      }
      cov[y * w + x] = 1 - sum / count;
    }
  }

  const lbl = new Int32Array(n).fill(-1);
  const comps = [];
  for (let seed = 0; seed < n; seed++) {
    if (bg[seed] || lbl[seed] !== -1) continue;
    const id = comps.length;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let size = 0;
    const queue = [seed];
    lbl[seed] = id;
    while (queue.length) {
      const i = queue.pop();
      size++;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [];
      if (x > 0) nb.push(i - 1);
      if (x < w - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - w);
      if (y < h - 1) nb.push(i + w);
      for (const j of nb) {
        if (!bg[j] && lbl[j] === -1) {
          lbl[j] = id;
          queue.push(j);
        }
      }
    }
    comps.push({ id, x0, y0, x1, y1, n: size });
  }

  return { img, B, bg, cov, lbl, comps };
}

/** The component containing (x,y), or null when that point is background. */
function componentAt(ctx, x, y) {
  const id = ctx.lbl[y * ctx.img.w + x];
  return id === -1 ? null : ctx.comps[id];
}

/**
 * The component ids that make up one pose: the pose's own body, plus anything
 * inside its box that belongs to the drawing — a sparkle, a "?", the floating
 * companion orb.
 *
 * Two things separate those from the sheet's own furniture. The captions are
 * darker than any part of the character, and they sit under each pose, whereas
 * sparkles and speech marks sit above or beside it. Either test alone lets a
 * caption through on one of the two sheets, so both are applied.
 */
function poseIds(ctx, main, minLuma = 170) {
  const { img, comps, lbl } = ctx;
  const { w, ch, data } = img;
  const keep = new Set([main.id]);
  const captionBand = main.y0 + 0.85 * (main.y1 - main.y0);

  for (const c of comps) {
    if (c.id === main.id || c.n < 60) continue;
    if (c.x0 < main.x0 || c.x1 > main.x1) continue;
    if (c.y0 < main.y0 || c.y1 > main.y1) continue;
    if (c.y0 > captionBand) continue;
    let sum = 0;
    let count = 0;
    for (let y = c.y0; y <= c.y1; y += 2) {
      for (let x = c.x0; x <= c.x1; x += 2) {
        const i = y * w + x;
        if (lbl[i] !== c.id) continue;
        const o = i * ch;
        sum += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
        count++;
      }
    }
    if (count && sum / count > minLuma) keep.add(c.id);
  }
  return keep;
}

/** The tight box over exactly the pixels `ids` covers. */
function tightBox(ctx, ids) {
  const { img, lbl } = ctx;
  const { w, h } = img;
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ids.has(lbl[y * w + x])) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * An RGBA crop of `ids`, with the sheet's cream unpremultiplied back out of the
 * partially covered edge pixels — without that step every cutout carries a
 * one-pixel cream fringe, which is exactly what shows on a dark page.
 */
function crop(ctx, X, Y, W, H, ids) {
  const { img, B, cov, lbl } = ctx;
  const { w, h, ch, data } = img;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = X + x;
      const sy = Y + y;
      const di = (y * W + x) * 4;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = sy * w + sx;
      const a = cov[si];
      if (a <= 0) continue;
      if (ids) {
        // An edge pixel is part background, so it carries no label of its own.
        // Accept it when a 4-neighbour belongs to the pose.
        let inPose = ids.has(lbl[si]);
        if (!inPose && a < 0.999) {
          for (const j of [si - 1, si + 1, si - w, si + w]) {
            if (j >= 0 && j < w * h && ids.has(lbl[j])) {
              inPose = true;
              break;
            }
          }
        }
        if (!inPose) continue;
      }
      const o = si * ch;
      for (let k = 0; k < 3; k++) {
        out[di + k] =
          a >= 0.999
            ? data[o + k]
            : Math.max(
                0,
                Math.min(255, Math.round((data[o + k] - (1 - a) * B[k]) / a)),
              );
      }
      out[di + 3] = Math.round(a * 255);
    }
  }
  return out;
}

/** Box-filter resize of an RGBA buffer, averaging colour in premultiplied space. */
function resize(src, W, H, TW, TH) {
  const out = Buffer.alloc(TW * TH * 4);
  const sx = W / TW;
  const sy = H / TH;
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.min(W, Math.ceil((x + 1) * sx)));
      const y0 = Math.floor(y * sy);
      const y1 = Math.max(y0 + 1, Math.min(H, Math.ceil((y + 1) * sy)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * W + xx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al;
          g += src[o + 1] * al;
          b += src[o + 2] * al;
          a += al;
          count++;
        }
      }
      const di = (y * TW + x) * 4;
      if (a <= 0) continue;
      out[di] = Math.round(r / a);
      out[di + 1] = Math.round(g / a);
      out[di + 2] = Math.round(b / a);
      out[di + 3] = Math.round((255 * a) / count);
    }
  }
  return out;
}

module.exports = {
  analyse,
  crop,
  resize,
  encode,
  poseIds,
  tightBox,
  componentAt,
};
