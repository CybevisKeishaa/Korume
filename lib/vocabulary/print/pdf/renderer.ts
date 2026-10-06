import "server-only";
import { chromium, errors, type Browser, type BrowserContext } from "playwright";

export class PdfLayoutError extends Error {}
export class PdfUnavailableError extends Error {}

const TIMEOUT_MS = 30_000;
const IDLE_MS = 5 * 60_000;

/** Spec W §6.3: Chromium only ever talks to this origin. Normalised (`.../` or a path would never equal a request's origin). */
export function printOrigin(): string {
  return new URL(process.env.PRINT_PDF_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).origin;
}

let browser: Promise<Browser> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;

function launch(): Promise<Browser> {
  if (browser) return browser;
  const launching: Promise<Browser> = chromium.launch({ timeout: TIMEOUT_MS }).then(
    (instance) => {
      // a dead Chromium must not stay cached: the next request launches a fresh one
      instance.on("disconnected", () => { if (browser === launching) browser = null; });
      return instance;
    },
    (error: unknown) => {
      if (browser === launching) browser = null;
      throw new PdfUnavailableError(error instanceof Error ? error.message : String(error));
    },
  );
  browser = launching;
  return launching;
}

export function __resetBrowserForTests(): void {
  clearTimeout(idle);
  browser = null;
}

/** Spec W §6.3 steps 4–6: a fresh cookie-less context, print media, the render page's own ready signal, then A4 from CSS.
 *  One overall 30s deadline covers goto, the ready marker and the PDF; the context is closed on every path. */
export async function renderPdf(path: string): Promise<Buffer> {
  clearTimeout(idle);
  const origin = printOrigin();
  try {
    const instance = await launch();
    let context: BrowserContext;
    try {
      context = await instance.newContext({ viewport: { width: 1280, height: 900 } });
    } catch (error) {
      if (!/closed|disconnected|target/i.test(String(error instanceof Error ? error.message : error))) throw error;
      browser = null;
      throw new PdfUnavailableError("Chromium is no longer running");
    }
    const work = (async () => {
      await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));
      const page = await context.newPage();
      await page.emulateMedia({ media: "print" });
      const response = await page.goto(`${origin}${path}`, { waitUntil: "load", timeout: TIMEOUT_MS });
      if (!response?.ok()) throw new Error(`render page answered ${response?.status() ?? "nothing"}`);
      const marker = await page.waitForSelector("[data-pdf-ready], [data-pdf-error]", { state: "attached", timeout: TIMEOUT_MS });
      if ((await marker.getAttribute("data-pdf-error")) !== null) throw new PdfLayoutError("a sheet overflowed in the PDF render");
      return await page.pdf({ preferCSSPageSize: true, printBackground: false });
    })();
    work.catch(() => undefined); // after a deadline the abandoned work rejects once the context closes
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new errors.TimeoutError("PDF render deadline")), TIMEOUT_MS); });
    try {
      return await Promise.race([work, deadline]);
    } finally {
      clearTimeout(timer);
      try { await context.close(); } catch { /* a failing close never replaces the original error */ }
    }
  } finally {
    idle = setTimeout(() => {
      const closing = browser;
      browser = null;
      void closing?.then((instance) => instance.close()).catch(() => undefined);
    }, IDLE_MS);
  }
}
