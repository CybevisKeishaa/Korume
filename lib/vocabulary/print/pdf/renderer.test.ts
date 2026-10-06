import { beforeEach, describe, expect, it, vi } from "vitest";

const page = {
  emulateMedia: vi.fn(), goto: vi.fn(), waitForSelector: vi.fn(), pdf: vi.fn(async () => Buffer.from("%PDF-1.7")),
};
const context = { route: vi.fn(), newPage: vi.fn(async () => page), close: vi.fn() };
const browser = { newContext: vi.fn(async () => context), close: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("playwright", () => ({ chromium: { launch: vi.fn(async () => browser) }, errors: { TimeoutError: class extends Error {} } }));

import { chromium } from "playwright";
import { __resetBrowserForTests, PdfLayoutError, PdfUnavailableError, printOrigin, renderPdf } from "./renderer";

beforeEach(() => {
  vi.clearAllMocks();
  __resetBrowserForTests();
  page.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
  page.waitForSelector.mockResolvedValue({ getAttribute: async (name: string) => (name === "data-pdf-error" ? null : "") });
  process.env.PRINT_PDF_ORIGIN = "http://127.0.0.1:3999";
});

describe("renderPdf (spec W §6.3 steps 4–6)", () => {
  it("opens the render path on the internal origin with print media and no cookies, then prints A4 from CSS", async () => {
    expect(await renderPdf("/vi/print-render/tok")).toEqual(Buffer.from("%PDF-1.7"));
    expect(printOrigin()).toBe("http://127.0.0.1:3999");
    expect(browser.newContext).toHaveBeenCalledWith(expect.not.objectContaining({ storageState: expect.anything() }));
    expect(page.emulateMedia).toHaveBeenCalledWith({ media: "print" });
    expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:3999/vi/print-render/tok", expect.objectContaining({ timeout: 30_000 }));
    expect(page.pdf).toHaveBeenCalledWith({ preferCSSPageSize: true, printBackground: false });
    expect(context.close).toHaveBeenCalled();
  });
  it("aborts every request to another origin", async () => {
    await renderPdf("/vi/print-render/tok");
    const handler = context.route.mock.calls[0]![1] as (route: { request: () => { url: () => string }; continue: () => void; abort: () => void }) => void;
    const route = (url: string) => ({ request: () => ({ url: () => url }), continue: vi.fn(), abort: vi.fn() });
    const own = route("http://127.0.0.1:3999/_next/static/x.woff2");
    const foreign = route("https://fonts.gstatic.com/x.woff2");
    handler(own); handler(foreign);
    expect(own.continue).toHaveBeenCalled();
    expect(foreign.abort).toHaveBeenCalled();
  });
  it("raises a layout error when the render page reports an overflow, and closes the context", async () => {
    page.waitForSelector.mockResolvedValue({ getAttribute: async (name: string) => (name === "data-pdf-error" ? "" : null) });
    await expect(renderPdf("/vi/print-render/tok")).rejects.toBeInstanceOf(PdfLayoutError);
    expect(context.close).toHaveBeenCalled();
  });
  it("raises unavailable when Chromium cannot launch", async () => {
    vi.mocked(chromium.launch).mockRejectedValueOnce(new Error("Executable doesn't exist"));
    await expect(renderPdf("/vi/print-render/tok")).rejects.toBeInstanceOf(PdfUnavailableError);
  });
});
