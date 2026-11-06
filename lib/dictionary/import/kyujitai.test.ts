import { describe, expect, it } from "vitest";
import kyujitai from "./kyujitai.json";

describe("kyujitai.json", () => {
  it("holds the 296 jōyō new→old pairs", () => {
    expect(Object.keys(kyujitai.pairs)).toHaveLength(296);
    const pairs = kyujitai.pairs as Record<string, string[]>;
    expect(pairs["気"]).toEqual(["氣"]);
    expect(pairs["駅"]).toEqual(["驛"]);
    expect(pairs["円"]).toEqual(["圓"]);
    expect(pairs["関"]).toEqual(["關"]);
  });
});
