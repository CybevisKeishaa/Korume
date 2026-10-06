import { beforeEach, describe, expect, it, vi } from "vitest";

const page = {
  emulateMedia: vi.fn(), goto: vi.fn(), waitForSelector: vi.fn(), pdf: vi.fn(async () => Buffer.from("%PDF-1.7")),
};
const context = { route: vi.fn(), newPage: vi.fn(async () => page), close: vi.fn() };
const browser = { newContext: vi.fn(async () => context), close: vi.fn(), on: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("playwright", () => ({ chromium: { launch: vi.fn(async () => browser) }, errors: { TimeoutError: class extends Error {} } }));

import { chromium, errors } from "playwright";
import { __resetBrowserForTests, PdfLayoutError, PdfUnavailableError, printOrigin, renderPdf } from "./renderer";

beforeEach(() => {
  vi.clearAllMocks();
  __resetBrowserForTests();
  vi.useRealTimers();
  context.newPage.mockResolvedValue(page);
  browser.newContext.mockResolvedValue(context);
  page.pdf.mockResolvedValue(Buffer.from("%PDF-1.7"));
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
  it("a browser that died after launch gives unavailable, and the next call launches a fresh one", async () => {
    browser.newContext.mockRejectedValueOnce(new Error("Target page, context or browser has been closed"));
    await expect(renderPdf("/vi/print-render/tok")).rejects.toBeInstanceOf(PdfUnavailableError);
    await expect(renderPdf("/vi/print-render/tok")).resolves.toEqual(Buffer.from("%PDF-1.7"));
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });
  it("a disconnected event clears the cached browser so the next call relaunches", async () => {
    await renderPdf("/vi/print-render/tok");
    expect(browser.on).toHaveBeenCalledWith("disconnected", expect.any(Function));
    (browser.on.mock.calls[0]![1] as () => void)();
    await renderPdf("/vi/print-render/tok");
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });
  it("one 30s deadline: a hung pdf() rejects with TimeoutError and the context is closed", async () => {
    vi.useFakeTimers();
    page.pdf.mockImplementationOnce(() => new Promise(() => undefined));
    const outcome = renderPdf("/vi/print-render/tok").then(() => null, (error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await outcome).toBeInstanceOf(errors.TimeoutError);
    expect(context.close).toHaveBeenCalled();
  });
  it("a failing context.close does not mask the original error", async () => {
    page.waitForSelector.mockResolvedValue({ getAttribute: async (name: string) => (name === "data-pdf-error" ? "" : null) });
    context.close.mockRejectedValueOnce(new Error("close failed"));
    await expect(renderPdf("/vi/print-render/tok")).rejects.toBeInstanceOf(PdfLayoutError);
  });
});
