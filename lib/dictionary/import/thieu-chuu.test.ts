import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadThieuChuu, resolveTcLines } from "./thieu-chuu";

// Redirect lines are copied from the real shards (学, 緑, 绿); other lines are placeholders.
const R_GAKU = "Giản thể của chữ 學.";
const index = new Map<string, string[]>([
  ["日", ["L1", "L2"]],
  ["氣", ["K1", "K2"]],
  ["学", [R_GAKU, "L1"]],
  ["學", ["L1", "L2"]],
  ["驛", ["Giản thể của chữ 日."]],
  ["緑", ["Dị dạng của chữ [绿]."]],
  ["绿", ["Giản thể của chữ 綠.", "G1"]],
  ["糸", ["Dị dạng của chữ 無."]],
]);
const old = { 気: ["氣"], 駅: ["驛"], 畑: ["火"] };
const r = (l: string) => resolveTcLines(l, index, old);

describe("resolveTcLines", () => {
  it("direct", () => expect(r("日")).toEqual({ lines: ["L1", "L2"], category: "direct", reason: null }));
  it("kyujitai", () => expect(r("気")).toEqual({ lines: ["K1", "K2"], category: "kyujitai", reason: null }));
  it("redirect: target lines first, then the rest, redirect line dropped", () =>
    expect(r("学")).toEqual({ lines: ["L1", "L2"], category: "redirect-resolved", reason: null }));
  it("redirect reached through the old form", () =>
    expect(r("駅")).toEqual({ lines: ["L1", "L2"], category: "redirect-resolved", reason: null }));
  it("bracket target", () => {
    const i = new Map([["X", ["Dị dạng của chữ [绿]."]], ["绿", ["G1"]]]);
    expect(resolveTcLines("X", i, {}).lines).toEqual(["G1"]);
  });
  it("missing target", () =>
    expect(r("糸")).toEqual({ lines: ["Dị dạng của chữ 無."], category: "redirect-unresolved", reason: "missing-target" }));
  it("chained", () =>
    expect(r("緑")).toEqual({ lines: ["Dị dạng của chữ [绿]."], category: "redirect-unresolved", reason: "chained" }));
  it("none", () => expect(r("畑")).toEqual({ lines: [], category: "none", reason: null }));
});

describe("loadThieuChuu", () => {
  it("maps code point keys to characters", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tc-"));
    await writeFile(join(dir, "25.json"), JSON.stringify({ "65e5": { tc: ["L1"] }, "65e6": { e: "no tc" } }));
    await writeFile(join(dir, "26.json"), JSON.stringify({ "6c23": { hv: "khí" } }));
    const map = await loadThieuChuu(dir);
    expect(map.get("日")).toEqual(["L1"]);
    expect(map.has("氣")).toBe(false);
  });
});
