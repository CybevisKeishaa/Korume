import { describe, expect, it } from "vitest";
import { cacheKeyJson } from "./cache-key";
import type { KnowledgeKey } from "./types";

const BASE: KnowledgeKey = {
  fingerprint: "f".repeat(64),
  section: "lite",
  locale: "vi",
  contextKey: "",
  schemaVersion: 1,
  generatorVersion: 1,
  contentVariant: "full",
};

describe("cacheKeyJson", () => {
  it("serialises exactly the seven dimensions the SQL key reads", () => {
    expect(cacheKeyJson(BASE)).toEqual({
      fingerprint: BASE.fingerprint,
      section: "lite",
      locale: "vi",
      contextKey: "",
      schemaVersion: 1,
      generatorVersion: 1,
      contentVariant: "full",
    });
  });

  it.each<[keyof KnowledgeKey, KnowledgeKey[keyof KnowledgeKey]]>([
    ["fingerprint", "0".repeat(64)],
    ["section", "quiz"],
    ["locale", "en"],
    ["contextKey", "video-1"],
    ["schemaVersion", 2],
    ["generatorVersion", 2],
    ["contentVariant", "preview"],
  ])("changes when %s changes", (dimension, value) => {
    expect(JSON.stringify(cacheKeyJson({ ...BASE, [dimension]: value }))).not.toBe(JSON.stringify(cacheKeyJson(BASE)));
  });
});
