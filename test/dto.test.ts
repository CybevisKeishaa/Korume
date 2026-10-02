import { describe, expect, it } from "vitest";
import { assertPlainSerializableDto } from "./dto";

class Point {
  constructor(public x: number) {}
}

describe("assertPlainSerializableDto", () => {
  it("accepts nested plain data", () => {
    expect(() =>
      assertPlainSerializableDto({ a: 1, b: "x", c: null, d: true, e: [1, { f: [] }], g: { h: undefined } }),
    ).not.toThrow();
  });

  it.each([
    ["a function", () => 1],
    ["a Map", new Map()],
    ["a Set", new Set()],
    ["a Date", new Date()],
    ["a BigInt", 1n],
    ["a class instance", new Point(1)],
    ["undefined inside an array", [undefined]],
    ["a symbol", Symbol("s")],
    ["NaN", Number.NaN],
  ])("rejects %s", (_label, value) => {
    expect(() => assertPlainSerializableDto({ nested: { value } })).toThrow(/\$\.nested\.value/);
  });

  it("names the array index in the path", () => {
    expect(() => assertPlainSerializableDto({ items: [{ ok: 1 }, { bad: new Map() }] })).toThrow(
      /\$\.items\[1\]\.bad/,
    );
  });
});
