/** Spec §6 + W W9: the first-page colour mascot; the centre watermark is the owner's art (2026-10-07), built by scripts/mascot/watermark.js. */
export const MASCOT_SRC = "/mascot/poses/quill-writing.png";
export const WATERMARK_SRC = "/mascot/watermark/korume.png";

let ready: Promise<void> | null = null;

/** Spec §3.5: a page set is never committed before both images decode; a failed decode never blocks printing. */
export function mascotReady(): Promise<void> {
  if (!ready) {
    ready = Promise.all([MASCOT_SRC, WATERMARK_SRC].map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => undefined);
    })).then(() => undefined);
  }
  return ready;
}
