import "server-only";
import { chromium, type Browser } from "playwright";

export class PdfLayoutError extends Error {}
export class PdfUnavailableError extends Error {}

const TIMEOUT_MS = 30_000;
const IDLE_MS = 5 * 60_000;

/** Spec W §6.3: Chromium only ever talks to this origin. */
export function printOrigin(): string {
  return process.env.PRINT_PDF_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

let browser: Promise<Browser> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;

function launch(): Promise<Browser> {
  browser ??= chromium.launch().catch((error: unknown) => {
    browser = null;
    throw new PdfUnavailableError(error instanceof Error ? error.message : String(error));
  });
  return browser;
}

export function __resetBrowserForTests(): void {
  clearTimeout(idle);
  browser = null;
}

/** Spec W §6.3 steps 4–6: a fresh cookie-less context, print media, the render page's own ready signal, then A4 from CSS. */
export async function renderPdf(path: string): Promise<Buffer> {
  clearTimeout(idle);
  const origin = printOrigin();
  const context = await (await launch()).newContext({ viewport: { width: 1280, height: 900 } });
  try {
    await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    const response = await page.goto(`${origin}${path}`, { waitUntil: "load", timeout: TIMEOUT_MS });
    if (!response?.ok()) throw new Error(`render page answered ${response?.status() ?? "nothing"}`);
    const marker = await page.waitForSelector("[data-pdf-ready], [data-pdf-error]", { state: "attached", timeout: TIMEOUT_MS });
    if ((await marker.getAttribute("data-pdf-error")) !== null) throw new PdfLayoutError("a sheet overflowed in the PDF render");
    return await page.pdf({ preferCSSPageSize: true, printBackground: false });
  } finally {
    await context.close();
    idle = setTimeout(() => {
      const closing = browser;
      browser = null;
      void closing?.then((instance) => instance.close());
    }, IDLE_MS);
  }
}
