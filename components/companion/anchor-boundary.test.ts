import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 1 §5.4 made structural: the Companion CANNOT appear inside a learning
 * loop — enforced as an ALLOWLIST of files permitted to import the anchor.
 * A surface not on this list rendering CompanionAnchor is a build-breaking
 * defect, not a review nit. `emitContext` is callable anywhere (emitting is
 * not appearing), so this scan deliberately targets only `companion-anchor`.
 *
 * Several entries name files LATER tasks create (journal, mining deck). That
 * is intentional: the boundary is declared once, up front, so the task that
 * adds the surface does not get to quietly widen it.
 */
const ALLOWLIST = new Set([
  "app/[locale]/(app)/dashboard/page.tsx",
  "app/[locale]/(app)/journal/page.tsx",
  "app/[locale]/(app)/videos/page.tsx",
  "components/companion/journal-view.tsx",
  "components/companion/ambient.test.tsx",
  // This scan itself names the module it forbids.
  "components/companion/anchor-boundary.test.ts",
  "components/video-player/mining-deck-list.tsx",
]);

/** The anchor module is allowed to be itself. */
const ANCHOR_MODULE = "components/companion/companion-anchor.tsx";

function collectSources(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSources(fullPath));
    else if (/\.tsx?$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

/** Pure predicate, so the detector itself can be tested against a synthetic
 * source — otherwise an always-empty scan would pass forever unnoticed. */
function isOffender(rel: string, source: string): boolean {
  if (rel === ANCHOR_MODULE) return false;
  if (!source.includes("companion-anchor")) return false;
  return !ALLOWLIST.has(rel);
}

function scan(): { scanned: number; offenders: string[] } {
  const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
  const offenders: string[] = [];
  let scanned = 0;
  for (const root of roots) {
    for (const file of collectSources(root)) {
      scanned += 1;
      const rel = path.relative(process.cwd(), file).replaceAll(path.sep, "/");
      if (isOffender(rel, readFileSync(file, "utf8"))) offenders.push(rel);
    }
  }
  return { scanned, offenders };
}

describe("CompanionAnchor import boundary (spec 1 §5.4)", () => {
  it("scans a non-empty set of sources", () => {
    expect(scan().scanned).toBeGreaterThan(0);
  });

  it("only allowlisted surfaces invite the Companion", () => {
    expect(scan().offenders).toEqual([]);
  });

  it("flags a learning-loop surface that imports the anchor", () => {
    // Synthetic: a shadowing player is exactly the surface §5.4 forbids.
    expect(
      isOffender(
        "components/video-player/shadowing-player.tsx",
        'import { CompanionAnchor } from "@/components/companion/companion-anchor";',
      ),
    ).toBe(true);
    // …while an allowlisted surface with the same import is fine.
    expect(
      isOffender(
        "app/[locale]/(app)/dashboard/page.tsx",
        'import { CompanionAnchor } from "@/components/companion/companion-anchor";',
      ),
    ).toBe(false);
  });
});
