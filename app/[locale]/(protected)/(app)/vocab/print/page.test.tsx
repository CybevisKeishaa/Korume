import { describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { loadPrintDocument } from "@/lib/vocabulary/print/load";
import PrintPage, { generateMetadata } from "./page";

// React 18.3.1 has no `cache` outside the RSC runtime; stubs suffice for a unit test.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: (fn: unknown) => fn }));
vi.mock("@/components/vocabulary-print/print-workspace", () => ({ PrintWorkspace: () => null }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/vocabulary/print/load", () => ({ loadPrintDocument: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: vi.fn(async () => (key: string, values?: Record<string, string>) => `${key}${values ? JSON.stringify(values) : ""}`) }));

const LESSON = "ba522023-8eba-4929-924f-35ae69eacf99";
const params = { locale: "vi" as const };
const doc = { title: "苦手な人", backHref: "/b", backLabel: "b", items: [] };

describe("/vocab/print (spec §2.1)", () => {
  it("is a static segment beside /vocab/[id], so Next routes /vocab/print here", () => {
    const dir = join(process.cwd(), "app/[locale]/(protected)/(app)/vocab");
    expect(existsSync(join(dir, "print/page.tsx"))).toBe(true);
    expect(existsSync(join(dir, "[id]/page.tsx"))).toBe(true);
  });

  it("404s a bad or ambiguous query without loading anything", async () => {
    for (const searchParams of [{ source: "lesson", lesson: "x" }, { source: ["lesson", "lesson"], lesson: LESSON }]) {
      await expect(PrintPage({ params, searchParams })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(loadPrintDocument).not.toHaveBeenCalled();
  });

  it("404s an unreadable lesson exactly like a missing one", async () => {
    for (const kind of ["unauthorized", "not_found"] as const) {
      vi.mocked(loadPrintDocument).mockResolvedValueOnce({ kind });
      await expect(PrintPage({ params, searchParams: { source: "lesson", lesson: LESSON } })).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("titles the page after the lesson for the PDF file name", async () => {
    vi.mocked(loadPrintDocument).mockResolvedValueOnce({ kind: "ok", doc });
    expect(await generateMetadata({ params, searchParams: { source: "lesson", lesson: LESSON } })).toEqual({ title: 'pageTitle{"title":"苦手な人"}' });
  });

  it("keys the workspace by set so All and Saved remount instead of sharing selection", async () => {
    for (const set of ["all", "saved"]) {
      vi.mocked(loadPrintDocument).mockResolvedValueOnce({ kind: "ok", doc });
      const page = (await PrintPage({ params, searchParams: { source: "lesson", lesson: LESSON, set } })) as ReactElement<{ children: ReactElement }>;
      expect(page.props.children.key).toBe(set);
    }
  });
});
