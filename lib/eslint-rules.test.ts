import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: process.cwd() });

async function lint(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) {
    throw new Error(`ESLint produced no result for ${filePath}`);
  }
  return result.messages.map((m) => m.message);
}

describe("import boundary rules", () => {
  it("forbids feature code from importing next-intl directly", async () => {
    const messages = await lint(
      `import { useTranslations } from "next-intl";\nexport const a = useTranslations;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n/);
  });

  it("allows the foundation to import next-intl", async () => {
    const messages = await lint(
      `import { createNavigation } from "next-intl/navigation";\nexport const a = createNavigation;\n`,
      "lib/i18n/example.ts",
    );
    expect(messages.join("\n")).not.toMatch(/lib\/i18n/);
  });

  it("forbids feature code from importing next/link", async () => {
    const messages = await lint(
      `import Link from "next/link";\nexport const a = Link;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n\/navigation/);
  });

  it("forbids locale-sensitive named imports from next/navigation", async () => {
    const messages = await lint(
      `import { useRouter } from "next/navigation";\nexport const a = useRouter;\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).toMatch(/lib\/i18n\/navigation/);
  });

  it("permits locale-irrelevant imports from next/navigation", async () => {
    const messages = await lint(
      `import { useSearchParams, notFound } from "next/navigation";\nexport const a = [useSearchParams, notFound];\n`,
      "components/learning/example.tsx",
    );
    expect(messages.join("\n")).not.toMatch(/lib\/i18n\/navigation/);
  });

  it("allows the root layout to import next-intl (it mounts NextIntlClientProvider)", async () => {
    // app/[locale]/layout.tsx is exempted via the escaped override glob
    // app/[[]locale[]]/layout.tsx — an unescaped [locale] is a minimatch
    // character class (matches one of l,o,c,a,e, e.g. app/e/layout.tsx),
    // not the literal directory name, so the escaping is load-bearing.
    const messages = await lint(
      `import { NextIntlClientProvider } from "next-intl";\nexport const a = NextIntlClientProvider;\n`,
      "app/[locale]/layout.tsx",
    );
    expect(messages.join("\n")).not.toMatch(/lib\/i18n/);
  });

  it("allows the test render helper to import next-intl", async () => {
    const messages = await lint(
      `import { NextIntlClientProvider } from "next-intl";\nexport const a = NextIntlClientProvider;\n`,
      "test/render.tsx",
    );
    expect(messages.join("\n")).not.toMatch(/lib\/i18n/);
  });
});
