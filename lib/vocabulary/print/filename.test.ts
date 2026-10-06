import { describe, expect, it } from "vitest";
import { contentDisposition, pdfFilename } from "./filename";

describe("PDF filename (spec W §6.3 step 7)", () => {
  it("builds the localized name and replaces characters invalid in file names", () => {
    expect(pdfFilename("Luyện viết từ vựng", "Ep.729 苦手な人")).toBe("Korume - Luyện viết từ vựng - Ep.729 苦手な人.pdf");
    expect(pdfFilename("Vocabulary Writing Practice", 'a/b\\c:d*e?f"g<h>i|j\u0007k')).toBe("Korume - Vocabulary Writing Practice - a b c d e f g h i j k.pdf");
    expect(pdfFilename("Vocabulary Self-test", "  ")).toBe("Korume - Vocabulary Self-test.pdf");
  });
  it("sends an ASCII fallback per mode and the UTF-8 name RFC 5987-encoded", () => {
    const header = contentDisposition("Korume - Luyện viết từ vựng - 苦手 (1)'s.pdf", "practice");
    expect(header).toBe(`attachment; filename="Korume-Writing-Practice.pdf"; filename*=UTF-8''Korume%20-%20Luy%E1%BB%87n%20vi%E1%BA%BFt%20t%E1%BB%AB%20v%E1%BB%B1ng%20-%20%E8%8B%A6%E6%89%8B%20%281%29%27s.pdf`);
    expect(contentDisposition("x.pdf", "selfTest")).toContain('filename="Korume-Self-Test.pdf"');
  });
  it("keeps an emoji title intact in filename*", () => {
    expect(contentDisposition(pdfFilename("Vocabulary Writing Practice", "🍣"), "practice")).toContain("%F0%9F%8D%A3");
  });
});
