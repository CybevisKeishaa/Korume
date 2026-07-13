/**
 * Reads a `Blob` as an `ArrayBuffer`: prefers `Blob.arrayBuffer()`, falling
 * back to `FileReader` for environments (older Safari, jsdom in tests) that
 * don't implement it. Shared by every consumer that decodes a recording
 * (`blob-to-wav.ts`, waveform/pitch rendering, pitch comparison).
 */
export function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read recording"));
    reader.readAsArrayBuffer(blob);
  });
}
