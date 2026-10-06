/** Spec §6: the first-page mascot and the footer mark are this one existing asset; no new artwork. */
export const MASCOT_SRC = "/mascot/poses/quill-writing.png";

let ready: Promise<void> | null = null;

/** Spec §3.5: part of the complete-page-set lifecycle — a page set is never committed before the mascot decodes. */
export function mascotReady(): Promise<void> {
  if (!ready) {
    const image = new Image();
    image.src = MASCOT_SRC;
    // A failed decode must not block printing forever: the page then prints without the mascot pixels.
    ready = image.decode().catch(() => undefined);
  }
  return ready;
}
