// Types for `png.js`, the dependency-free PNG codec that `extract.js`,
// `trim.js` and the pose tests share. The implementation stays plain CommonJS
// JavaScript — it is a build-time script, not application code — so its
// contract lives here rather than as annotations inside it.

/** Decoded RGB(A) pixels. `ch` is 4 for colortype 6, 3 for colortype 2. */
export interface DecodedPng {
  w: number;
  h: number;
  ch: number;
  data: Buffer;
}

/** Decodes a non-interlaced, 8-bit PNG of colortype 2 or 6. */
export function decode(path: string): DecodedPng;

/** Encodes RGBA pixels as a colortype-6 PNG. `data` is `w * h * 4` bytes. */
export function encode(w: number, h: number, data: Buffer): Buffer;
