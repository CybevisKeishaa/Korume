import { describe, expect, it } from "vitest";
import { variantFor } from "./entitlement";

describe("variantFor", () => {
  it("gives Free the full variant of its free sections and a preview elsewhere", () => {
    expect(variantFor("free", "free_full", false)).toEqual({ variant: "full", project: false });
    expect(variantFor("free", "free_preview", false)).toEqual({ variant: "preview", project: false });
  });

  it("reads a cached full entry for Free but projects it on the server", () => {
    expect(variantFor("free", "free_preview", true)).toEqual({ variant: "full", project: true });
  });

  it("gives Plus the full variant of everything", () => {
    expect(variantFor("plus", "free_preview", false)).toEqual({ variant: "full", project: false });
    expect(variantFor("plus", "free_preview", true)).toEqual({ variant: "full", project: false });
  });

  it("serves system-funded sections in full to every tier", () => {
    expect(variantFor("free", "system", false)).toEqual({ variant: "full", project: false });
  });
});
