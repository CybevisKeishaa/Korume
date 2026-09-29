import { describe, expect, it } from "vitest";
import pronunciationCopy from "@/messages/en/pronunciation.json";
import type { PathSummary } from "@/lib/data/collections";
import { pathCardLabels, pathCards } from "./path-card-copy";

function t(key: string, values: Record<string, string | number> = {}): string {
  const message = key.split(".").reduce<unknown>((value, part) => (
    value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined
  ), pronunciationCopy) as string;
  const flat = message.replace(/^\{\w+, plural,.*other \{(.*)\}\}$/, "$1");
  return Object.entries(values).reduce((copy, [name, value]) => copy.split(`{${name}}`).join(String(value)), flat);
}
const translator = t as unknown as Parameters<typeof pathCardLabels>[0];

const summary: PathSummary = {
  collection: { id: "p1", slug: "p1", title: "Business Japanese", description: null, coverImageUrl: null, displayOrder: 7, kind: "path", skillFocus: null, icon: "💼" },
  total: 120,
  completed: 80,
  next: null,
  started: true,
  saved: false,
  lessonCount: 120,
  durationMinutes: 480,
};

describe("path card copy", () => {
  it("hands the Client Component only serialisable props (a function here broke the page at runtime)", () => {
    // structuredClone throws on a function, which is exactly what RSC refuses to send.
    expect(() => structuredClone(pathCardLabels(translator))).not.toThrow();
    expect(() => structuredClone(pathCards([summary], translator))).not.toThrow();
  });

  it("formats the per-path copy from the catalog", () => {
    const [card] = pathCards([summary], translator);
    expect(card).toMatchObject({
      meta: "120 lessons · 8h",
      saveLabel: "Save Business Japanese",
      progressLabel: "67% complete",
    });
  });
});
