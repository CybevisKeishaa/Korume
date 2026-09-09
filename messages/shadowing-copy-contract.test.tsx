import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { render, screen } from "@testing-library/react";
import en from "./en/shadowing.json";
import vi from "./vi/shadowing.json";
import { HubFeaturedHero } from "@/components/shadowing/hub-featured-hero";

type CatalogNode = Record<string, unknown>;
type Locale = "en" | "vi";

const COPY_ROOTS = ["hub", "mobileHandoff"] as const;
const EXPECTED_LEAF_COUNT = 50;

function collectLeaves(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected a string or object at ${path || "<root>"}`);
  }

  return Object.entries(value as CatalogNode).reduce<Record<string, string>>(
    (leaves, [key, child]) => ({
      ...leaves,
      ...collectLeaves(child, path ? `${path}.${key}` : key),
    }),
    {},
  );
}

function collectContractLeaves(catalog: CatalogNode): Record<string, string> {
  return COPY_ROOTS.reduce<Record<string, string>>((leaves, root) => {
    const value = catalog[root];
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`shadowing.json is missing its ${root} object`);
    }
    return { ...leaves, ...collectLeaves(value, root) };
  }, {});
}

function walk(elements: MessageFormatElement[], visit: (element: MessageFormatElement) => void): void {
  for (const element of elements) {
    visit(element);
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const option of Object.values(element.options)) walk(option.value, visit);
    } else if (element.type === TYPE.tag) {
      walk(element.children, visit);
    }
  }
}

function placeholderSet(message: string): string[] {
  const names = new Set<string>();
  walk(parse(message), (element) => {
    if (
      element.type === TYPE.argument ||
      element.type === TYPE.number ||
      element.type === TYPE.date ||
      element.type === TYPE.time ||
      element.type === TYPE.select ||
      element.type === TYPE.plural
    ) {
      names.add(element.value);
    }
  });
  return [...names].sort();
}

function LocalizedFeaturedEmptyState(): JSX.Element {
  const t = useTranslations("shadowing");
  return (
    <HubFeaturedHero
      lesson={null}
      labels={{
        eyebrow: t("hub.sections.featured"),
        start: t("hub.actions.start"),
        continue: t("hub.actions.continue"),
        noThumbnail: "",
        jlptLabel: t("hub.metadata.jlptLabel"),
        durationLabel: t("hub.metadata.durationLabel"),
        duration: (minutes) => t("hub.metadata.minutes", { count: minutes }),
        emptyTitle: t("hub.empty.featured.title"),
        emptyBody: t("hub.empty.featured.body"),
      }}
    />
  );
}

const LOCALES: ReadonlyArray<{ locale: Locale; catalog: CatalogNode }> = [
  { locale: "en", catalog: en },
  { locale: "vi", catalog: vi },
];

describe("Shadowing Hub EN/VI copy contract", () => {
  it("covers exactly the two Hub-owned roots and their expected non-empty leaf collections", () => {
    expect(COPY_ROOTS).toEqual(["hub", "mobileHandoff"]);
    expect(COPY_ROOTS).toHaveLength(2);
    expect(LOCALES).toHaveLength(2);

    for (const { locale, catalog } of LOCALES) {
      const leaves = collectContractLeaves(catalog);
      expect(Object.keys(leaves), `${locale} copy leaves`).toHaveLength(EXPECTED_LEAF_COUNT);
      expect(Object.keys(leaves).length, `${locale} copy leaves`).toBeGreaterThan(0);
    }
  });

  it("has identical leaf paths and ICU placeholder sets in EN and VI", () => {
    const enLeaves = collectContractLeaves(en);
    const viLeaves = collectContractLeaves(vi);
    const enPaths = Object.keys(enLeaves).sort();
    const viPaths = Object.keys(viLeaves).sort();

    expect(enPaths).toHaveLength(EXPECTED_LEAF_COUNT);
    expect(viPaths).toHaveLength(EXPECTED_LEAF_COUNT);
    expect(viPaths).toEqual(enPaths);

    for (const path of enPaths) {
      const enMessage = enLeaves[path];
      const viMessage = viLeaves[path];
      if (enMessage === undefined || viMessage === undefined) {
        throw new Error(`Missing contract message at ${path}`);
      }
      expect(placeholderSet(viMessage), `vi ${path}`).toEqual(
        placeholderSet(enMessage),
      );
    }
  });

  for (const { locale, catalog } of LOCALES) {
    it(`renders a localized Featured section and honest empty message in ${locale}`, () => {
      render(
        <NextIntlClientProvider locale={locale} messages={{ shadowing: catalog }}>
          <LocalizedFeaturedEmptyState />
        </NextIntlClientProvider>,
      );

      const hub = catalog.hub as CatalogNode;
      const sections = hub.sections as CatalogNode;
      const empty = hub.empty as CatalogNode;
      const featuredEmpty = empty.featured as CatalogNode;
      expect(screen.getByRole("region", { name: sections.featured as string })).toBeVisible();
      expect(screen.getByRole("heading", { name: featuredEmpty.title as string })).toBeVisible();
      expect(screen.getByText(featuredEmpty.body as string)).toBeVisible();
    });
  }
});
