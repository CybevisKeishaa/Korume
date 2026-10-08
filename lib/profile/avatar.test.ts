import { beforeEach, describe, expect, it, vi } from "vitest";
import { crc32 } from "node:zlib";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

// The spy wraps the real sharp so "no decode attempted" is observable without changing behaviour elsewhere.
const sharpSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("sharp", async () => {
  const actual = await vi.importActual<typeof import("sharp")>("sharp");
  const wrapped = ((...args: Parameters<typeof actual.default>) => {
    sharpSpy.calls += 1;
    return actual.default(...args);
  }) as typeof actual.default;
  return { default: wrapped };
});

import { AVATAR_INPUT_MAX_BYTES, processAvatar } from "./avatar";

const RAW_SHARP = (await vi.importActual<typeof import("sharp")>("sharp")).default;
const build = RAW_SHARP; // fixtures are built with the unwrapped module so the spy counts only production calls

async function jpeg(width: number, height: number, background = "#336699", withExif = false): Promise<Buffer> {
  let image = build({ create: { width, height, channels: 3, background } }).jpeg();
  if (withExif) image = image.withMetadata({ exif: { IFD0: { Copyright: "x" } } });
  return image.toBuffer();
}

beforeEach(() => {
  sharpSpy.calls = 0;
});

describe("processAvatar", () => {
  it("re-encodes to a 512x512 WebP and drops EXIF", async () => {
    const input = await jpeg(600, 400, "#336699", true);
    expect((await build(input).metadata()).exif).toBeDefined(); // the fixture really carries EXIF
    const result = await processAvatar(input, "image/jpeg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.webp).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([512, 512]);
    expect(meta.exif).toBeUndefined();
  });

  it("applies EXIF orientation 6 (the left half of the source ends up on top)", async () => {
    // Source 40x20: left half red, right half blue; orientation 6 = rotate 90 degrees clockwise on display.
    const left = await build({ create: { width: 20, height: 20, channels: 3, background: "#ff0000" } }).png().toBuffer();
    const right = await build({ create: { width: 20, height: 20, channels: 3, background: "#0000ff" } }).png().toBuffer();
    const input = await build({ create: { width: 40, height: 20, channels: 3, background: "#000000" } })
      .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 20, top: 0 }])
      .jpeg({ quality: 100, chromaSubsampling: "4:4:4" })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processAvatar(input, "image/jpeg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data, info } = await sharp(result.webp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [0, 1, 2].map((c) => data[(y * info.width + x) * info.channels + c]!);
    // Rotated 90 degrees clockwise: the red (left) half ends up on TOP, the blue (right) half at the BOTTOM.
    const top = px(256, 20);
    const bottom = px(256, 490);
    expect(top[0]).toBeGreaterThan(200);
    expect(top[2]).toBeLessThan(60);
    expect(bottom[2]).toBeGreaterThan(200);
    expect(bottom[0]).toBeLessThan(60);
  });

  it("stays under the 512 KiB bucket limit on the worst case (high-entropy noise)", async () => {
    const size = 512; // no downscale smoothing: the encoder sees the full noise
    const noise = Buffer.alloc(size * size * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(Math.random() * 256);
    const source = await build(noise, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
    expect(source.byteLength).toBeLessThanOrEqual(AVATAR_INPUT_MAX_BYTES);
    const result = await processAvatar(source, "image/png");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.webp.byteLength).toBeLessThan(512 * 1024); // measured ~186 KB
  });

  it("stays under the bucket limit on 4-channel (RGBA) noise too", async () => {
    const size = 512;
    const noise = Buffer.alloc(size * size * 4);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(Math.random() * 256);
    const source = await build(noise, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    expect(source.byteLength).toBeLessThanOrEqual(AVATAR_INPUT_MAX_BYTES);
    const result = await processAvatar(source, "image/png");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.webp.byteLength).toBeLessThan(524288); // measured ~451 KB
  });

  it("rejects 2 MB + 1 byte as too_large without decoding", async () => {
    const oversized = new Uint8Array(AVATAR_INPUT_MAX_BYTES + 1);
    oversized.set([0xff, 0xd8, 0xff]); // a valid JPEG signature: only the size check can stop it
    const result = await processAvatar(oversized, "image/jpeg");
    expect(result).toEqual({ ok: false, reason: "too_large" });
    expect(sharpSpy.calls).toBe(0);
  });

  it("checks the declared type and the magic bytes before decoding", async () => {
    const jpegBytes = await jpeg(20, 20);
    expect(await processAvatar(jpegBytes, "image/png")).toEqual({ ok: false, reason: "type" });
    expect(await processAvatar(jpegBytes, "image/heic")).toEqual({ ok: false, reason: "type" });
    // ftyp/heic box: not a JPEG signature, whatever the label says
    const heic = Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
    expect(await processAvatar(heic, "image/jpeg")).toEqual({ ok: false, reason: "type" });
    expect(sharpSpy.calls).toBe(0);
    // positive control: the same bytes under their true type decode
    expect((await processAvatar(jpegBytes, "image/jpeg")).ok).toBe(true);
    expect(sharpSpy.calls).toBe(1); // the spy does count real decodes, so the zero assertions above can fail
  });

  it("rejects a PNG whose IHDR claims 10000x10000 as pixels, before allocating a bitmap", async () => {
    const png = Buffer.from(await build({ create: { width: 1, height: 1, channels: 3, background: "#fff" } }).png().toBuffer());
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    png.writeUInt32BE(10_000, 16);
    png.writeUInt32BE(10_000, 20);
    png.writeUInt32BE(crc32(png.subarray(12, 29)) >>> 0, 29);
    const result = await processAvatar(png, "image/png");
    expect(result).toEqual({ ok: false, reason: "pixels" });
  });

  it("rejects a truncated JPEG as corrupt", async () => {
    const noise = Buffer.alloc(300 * 300 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 31) % 251;
    const full = await build(noise, { raw: { width: 300, height: 300, channels: 3 } }).jpeg().toBuffer();
    const result = await processAvatar(full.subarray(0, Math.floor(full.length / 2)), "image/jpeg");
    expect(result).toEqual({ ok: false, reason: "corrupt" });
  });
});
