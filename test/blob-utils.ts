/**
 * Blob helpers for tests. jsdom's `Blob` doesn't implement `arrayBuffer()`,
 * so tests that need to inspect blob bytes (e.g. the WAV output of
 * `lib/audio/blob-to-wav.ts`, or multipart bodies captured by fetch mocks)
 * read through `FileReader`, which jsdom does support.
 */
export function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsArrayBuffer(blob);
  });
}
