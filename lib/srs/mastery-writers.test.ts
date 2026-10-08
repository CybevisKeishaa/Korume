import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// port-dashboard S2: every production write of srs_stage to a table with mastered_at must route through
// masteryTransition, so a new writer cannot forget the first-transition timestamp.
function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return productionFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("mastery writers", () => {
  it("every file that writes srs_stage to vocab progress or mining cards uses masteryTransition", () => {
    const writers = ["lib", "app", "components"].flatMap(productionFiles).filter((file) => {
      const text = readFileSync(file, "utf8");
      return /(user_vocab_progress|sentence_mining_cards)/.test(text) && /srs_stage:\s/.test(text) && /\.(upsert|update)\(/.test(text);
    }).map((file) => file.split("\\").join("/")).sort();
    expect(writers).toEqual(["lib/data/mining.ts", "lib/data/srs.ts"]);
    for (const file of writers) expect(readFileSync(file, "utf8"), file).toMatch(/masteryTransition\(/);
  });
});
