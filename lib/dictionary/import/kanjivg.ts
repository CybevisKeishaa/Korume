import { open as openZip, type Entry, type ZipFile } from "yauzl";
import { sanitizeKanjivgSvg, type KanjiComponentNode } from "./sanitize-kanjivg";

export type { KanjiComponentNode };

export interface KanjivgRow {
  literal: string;
  paths: string[];
  components: KanjiComponentNode;
}

/** `kanji/07dd1.svg` → 緑. Variant files (`07dd1-Kaisho.svg`) and anything else are not characters. */
const CHARACTER_FILE = /(?:^|\/)([0-9a-f]{4,6})\.svg$/;

export async function* readKanjivgFiles(
  files: AsyncIterable<{ name: string; content: string }>,
): AsyncGenerator<KanjivgRow> {
  for await (const file of files) {
    const match = CHARACTER_FILE.exec(file.name);
    if (!match) continue;
    const { paths, components } = sanitizeKanjivgSvg(file.content);
    yield { literal: String.fromCodePoint(parseInt(match[1] as string, 16)), paths, components };
  }
}

/** Reads the zip entry by entry (one small SVG in memory at a time). */
async function* zipTextFiles(zipPath: string): AsyncGenerator<{ name: string; content: string }> {
  const zip = await new Promise<ZipFile>((resolve, reject) =>
    openZip(zipPath, { lazyEntries: true, autoClose: true }, (error, file) => (error ? reject(error) : resolve(file))),
  );
  try {
    while (true) {
      const entry = await new Promise<Entry | null>((resolve, reject) => {
        const onEntry = (value: Entry) => {
          zip.off("end", onEnd);
          zip.off("error", onError);
          resolve(value);
        };
        const onEnd = () => {
          zip.off("entry", onEntry);
          zip.off("error", onError);
          resolve(null);
        };
        const onError = (error: Error) => {
          zip.off("entry", onEntry);
          zip.off("end", onEnd);
          reject(error);
        };
        zip.once("entry", onEntry);
        zip.once("end", onEnd);
        zip.once("error", onError);
        zip.readEntry();
      });
      if (!entry) return;
      if (entry.fileName.endsWith("/")) continue;
      const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) =>
        zip.openReadStream(entry, (error, value) => (error ? reject(error) : resolve(value))),
      );
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      yield { name: entry.fileName, content: Buffer.concat(chunks).toString("utf8") };
    }
  } finally {
    zip.close();
  }
}

export function readKanjivgZip(zipPath: string): AsyncGenerator<KanjivgRow> {
  return readKanjivgFiles(zipTextFiles(zipPath));
}
