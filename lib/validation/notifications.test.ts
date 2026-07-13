import { describe, expect, it } from "vitest";
import { markNotificationsReadSchema, notificationsQuerySchema } from "./notifications";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";

describe("notificationsQuerySchema", () => {
  it("defaults limit to 20 when absent", () => {
    const result = notificationsQuerySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it("coerces a string query param to a number", () => {
    const result = notificationsQuerySchema.parse({ limit: "5" });
    expect(result.limit).toBe(5);
  });

  it("rejects a limit above 50", () => {
    expect(notificationsQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
  });

  it("accepts a limit of exactly 50", () => {
    expect(notificationsQuerySchema.safeParse({ limit: "50" }).success).toBe(true);
  });

  it("rejects a limit below 1", () => {
    expect(notificationsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});

describe("markNotificationsReadSchema", () => {
  it("accepts an ids array", () => {
    const result = markNotificationsReadSchema.safeParse({ ids: [UUID, UUID2] });
    expect(result.success).toBe(true);
  });

  it("accepts { all: true }", () => {
    expect(markNotificationsReadSchema.safeParse({ all: true }).success).toBe(true);
  });

  it("rejects an empty ids array", () => {
    expect(markNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it("rejects more than 50 ids", () => {
    const ids = Array.from({ length: 51 }, (_, i) => UUID.slice(0, -2) + String(i).padStart(2, "0"));
    expect(markNotificationsReadSchema.safeParse({ ids }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(markNotificationsReadSchema.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
  });

  it("rejects { all: false }", () => {
    expect(markNotificationsReadSchema.safeParse({ all: false }).success).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(markNotificationsReadSchema.safeParse({}).success).toBe(false);
  });
});
