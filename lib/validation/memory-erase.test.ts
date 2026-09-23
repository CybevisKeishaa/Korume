import { describe, expect, it } from "vitest";
import { memoryEraseSchema } from "./memory-erase";

describe("memoryEraseSchema", () => {
  it("accepts the exact confirmation literal", () => {
    expect(memoryEraseSchema.safeParse({ confirm: "ERASE" }).success).toBe(true);
  });

  // The typed confirmation is the whole point of the control: a body that
  // reaches the route without it, or with a near-miss, must not erase
  // anything. Lower case is the realistic near-miss (a client that forwarded
  // what the user typed instead of the literal).
  it.each([{}, { confirm: "erase" }, { confirm: "Erase" }, { confirm: "" }, { confirm: "XOA" }])(
    "rejects %j",
    (body) => {
      expect(memoryEraseSchema.safeParse(body).success).toBe(false);
    },
  );
});
