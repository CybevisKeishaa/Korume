import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/vocabulary/print/pdf/jobs", () => ({ takeRenderJob: vi.fn() }));
vi.mock("@/components/vocabulary-print/pdf-render", () => ({ PdfRender: () => null }));

import { takeRenderJob } from "@/lib/vocabulary/print/pdf/jobs";
import Page, { metadata } from "./page";

describe("print-render page (spec W §6.3 step 5)", () => {
  it("404s for an unknown, used or expired token, and for a job of another locale", async () => {
    vi.mocked(takeRenderJob).mockReturnValueOnce(null);
    await expect(async () => Page({ params: { locale: "vi", token: "x" } })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.mocked(takeRenderJob).mockReturnValueOnce({ userId: "u", lessonId: "l", expiresAt: 1, payload: { locale: "en" } } as never);
    await expect(async () => Page({ params: { locale: "vi", token: "x" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("passes only plain data to the client renderer, and is never indexed", async () => {
    const payload = { locale: "vi", title: "T", settings: {}, pages: [], resources: { strokeGuides: {}, credits: { jmdict: null, kanjivg: null } } };
    vi.mocked(takeRenderJob).mockReturnValueOnce({ userId: "u", lessonId: "l", expiresAt: 1, payload } as never);
    const element = await Page({ params: { locale: "vi", token: "x" } });
    expect(() => structuredClone(element.props.payload)).not.toThrow();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
