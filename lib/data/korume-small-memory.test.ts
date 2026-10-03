import { describe, expect, it, vi } from "vitest";
import { smallMemoryFor } from "./korume";

vi.mock("server-only", () => ({}));

function fakeClient(rows: Array<{ title: string | null; line_text_jp: string | null; occurred_at: string }> | null, error: unknown = null) {
  const ilike = vi.fn(() => ({ order: () => ({ limit: async () => ({ data: rows, error }) }) }));
  return { from: vi.fn(() => ({ select: () => ({ eq: () => ({ ilike }) }) })), ilike };
}

describe("smallMemoryFor", () => {
  it("escapes labels, skips blank labels, caps queries, and returns the newest matching row", async () => {
    const client = fakeClient([{ title: "New", line_text_jp: "100%_\\", occurred_at: "2026-10-03T00:00:00.000Z" }]);
    const result = await smallMemoryFor("user", [{ label: "100%_\\" }, { label: "" }, { label: "100%_\\" }, { label: "a" }, { label: "b" }, { label: "c" }, { label: "d" }], client as never);
    expect(result).toEqual({ title: "New", lineTextJp: "100%_\\", occurredAt: "2026-10-03T00:00:00.000Z" });
    expect(client.ilike).toHaveBeenCalledWith("line_text_jp", "%100\\%\\_\\\\%");
    expect(client.ilike).toHaveBeenCalledTimes(4);
  });

  it("picks the newest row across labels, not the first label's", async () => {
    const byPattern: Record<string, string> = { "%a%": "2026-09-01T00:00:00.000Z", "%b%": "2026-10-02T00:00:00.000Z", "%c%": "2026-09-15T00:00:00.000Z" };
    const ilike = vi.fn((_column: string, pattern: string) => ({ order: () => ({ limit: async () => ({ data: [{ title: pattern, line_text_jp: pattern, occurred_at: byPattern[pattern] }], error: null }) }) }));
    const client = { from: () => ({ select: () => ({ eq: () => ({ ilike }) }) }) };
    expect(await smallMemoryFor("user", [{ label: "a" }, { label: "b" }, { label: "c" }], client as never)).toMatchObject({ title: "%b%" });
  });

  it("returns null without queries for empty labels and on a database error", async () => {
    const empty = fakeClient([]); await expect(smallMemoryFor("user", [{ label: "   " }], empty as never)).resolves.toBeNull(); expect(empty.from).not.toHaveBeenCalled();
    const failing = fakeClient(null, new Error("db")); await expect(smallMemoryFor("user", [{ label: "x" }], failing as never)).resolves.toBeNull();
  });
});
