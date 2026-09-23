import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MASCOT_POSES } from "./mascot-poses";

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(ROOT, "scripts/mascot/poses.json"), "utf8"),
) as { poses: { out: string }[]; supplied: { out: string }[] };
const recorded = new Set([...manifest.poses, ...manifest.supplied].map((p) => p.out));

describe("MASCOT_POSES", () => {
  const entries = Object.entries(MASCOT_POSES);

  it("maps exactly the screens the spec names", () => {
    expect(entries.map(([name]) => name).sort()).toEqual([
      "forgot-password",
      "login",
      "not-found",
      "register",
      "reset-password",
      "route-error",
      "settings",
      "verify-email",
    ]);
  });

  it("pins the owner-approved pose for each screen (spec §5.4)", () => {
    expect(Object.fromEntries(entries.map(([n, p]) => [n, p.file]))).toEqual({
      login: "bye.png",
      register: "excited.png",
      "forgot-password": "thinking.png",
      "verify-email": "quill-writing.png",
      "reset-password": "proud.png",
      "not-found": "curious-question-mark.png",
      "route-error": "worry.png",
      settings: "relax.png",
    });
  });

  it.each(entries)("%s names a file that exists and is recorded in poses.json", (_n, pose) => {
    expect(existsSync(join(ROOT, "public/mascot/poses", pose.file))).toBe(true);
    expect(recorded.has(pose.file)).toBe(true);
  });

  it.each(entries)("%s carries the PNG's real pixel size", (_n, pose) => {
    const png = readFileSync(join(ROOT, "public/mascot/poses", pose.file));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([pose.width, pose.height]);
  });
});
