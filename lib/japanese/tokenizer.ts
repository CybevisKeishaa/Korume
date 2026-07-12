/**
 * kuromoji-backed Japanese morphological tokenizer. Server-side only — the
 * dictionary is loaded from disk via Node's `fs`/`zlib` (see
 * `NodeDictionaryLoader` in kuromoji), so this must never be imported from
 * client components.
 */
import * as kuromoji from "kuromoji";
import path from "node:path";
import type { Token } from "./types";

export type KuromojiTokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

/** Module-level singleton so we only ever build the tokenizer (and load the dict) once. */
let tokenizerPromise: Promise<KuromojiTokenizer> | null = null;

/**
 * Resolve the installed kuromoji dictionary directory. Resolved from
 * `process.cwd()` rather than `__dirname`/`import.meta.url` because kuromoji
 * itself joins this path with plain filenames via `path.join`, and
 * `process.cwd()` is stable across the Next.js server runtime and tests run
 * from the repo root.
 */
function resolveDicPath(): string {
  return path.join(process.cwd(), "node_modules", "kuromoji", "dict");
}

/** Lazily build (once) and return the shared kuromoji tokenizer instance. */
export function getTokenizer(): Promise<KuromojiTokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise<KuromojiTokenizer>((resolve, reject) => {
      kuromoji.builder({ dicPath: resolveDicPath() }).build((err, tokenizer) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolve(tokenizer);
      });
    }).catch((err: unknown) => {
      // Allow a retry on the next call instead of caching a permanent rejection.
      tokenizerPromise = null;
      throw err;
    });
  }
  return tokenizerPromise;
}

function toToken(feature: kuromoji.IpadicFeatures): Token {
  const reading = feature.reading && feature.reading !== "*" ? feature.reading : null;
  const base = feature.basic_form && feature.basic_form !== "*" ? feature.basic_form : feature.surface_form;
  return {
    surface: feature.surface_form,
    reading,
    base,
    pos: feature.pos,
  };
}

/** Tokenize Japanese text into surface/reading/base/pos morphemes. */
export async function tokenize(text: string): Promise<Token[]> {
  const tokenizer = await getTokenizer();
  return tokenizer.tokenize(text).map(toToken);
}
