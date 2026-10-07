import "server-only";
import sharp from "sharp";

import { AVATAR_INPUT_MAX_BYTES } from "./avatar-limits";

export { AVATAR_INPUT_MAX_BYTES };
export const AVATAR_MAX_PIXELS = 40_000_000;
export const AVATAR_SIZE = 512;

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  "image/webp": (b) =>
    String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
};

/**
 * Decode → auto-orient → 512×512 cover → WebP (spec §9). sharp writes no metadata unless asked, so EXIF/GPS never
 * survive; the re-encoded buffer is the only thing ever stored. Size and type are checked before any decode.
 */
export async function processAvatar(
  bytes: Uint8Array,
  declaredType: string,
): Promise<{ ok: true; webp: Buffer } | { ok: false; reason: "too_large" | "type" | "pixels" | "corrupt" }> {
  if (bytes.byteLength > AVATAR_INPUT_MAX_BYTES) return { ok: false, reason: "too_large" };
  const matches = SIGNATURES[declaredType];
  if (!matches || bytes.byteLength < 12 || !matches(bytes)) return { ok: false, reason: "type" };
  try {
    const webp = await sharp(bytes, { limitInputPixels: AVATAR_MAX_PIXELS, failOn: "truncated" })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, webp };
  } catch (error) {
    return { ok: false, reason: /pixel limit/i.test(String(error)) ? "pixels" : "corrupt" };
  }
}
