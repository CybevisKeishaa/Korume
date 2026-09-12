import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { render, screen } from "@testing-library/react";
import en from "./en/shadowing.json";
import viCatalog from "./vi/shadowing.json";
import enVideos from "./en/videos.json";
import viVideos from "./vi/videos.json";
import { HubFeaturedHero } from "@/components/shadowing/hub-featured-hero";
import { HubImportSection } from "@/components/shadowing/hub-import-section";
import { HubLibrarySection } from "@/components/shadowing/hub-library-section";
import { HubDiscoveryControls } from "@/components/shadowing/hub-discovery-controls";
import { HubShelves } from "@/components/shadowing/hub-shelves";
import { HubCompanionRail } from "@/components/shadowing/hub-companion-rail";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

type CatalogNode = Record<string, unknown>;
type Locale = "en" | "vi";

const COPY_ROOTS = ["hub", "mobileHandoff", "explore"] as const;
const EXPECTED_LEAF_COUNT = 77;

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

function LocalizedEmptyHub(): JSX.Element {
  const t = useTranslations("shadowing");

  return (
    <>
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
      <HubImportSection
        used={0}
        limit={3}
        tier="free"
        labels={{
          eyebrow: t("hub.import.eyebrow"),
          title: t("hub.import.title"),
          body: t("hub.import.body"),
          support: t("hub.import.support"),
          freePlan: t("hub.import.freePlan"),
          importsRemaining: t("hub.import.importsRemaining"),
          quotaUnlimited: t("hub.import.quotaUnlimited"),
        }}
      />
      <HubLibrarySection
        items={[]}
        labels={{
          title: t("hub.sections.library"),
          readyAction: t("hub.actions.start"),
          unavailable: "",
          retry: "",
          retryPending: "",
          retryFailed: "",
          noThumbnail: "",
          emptyTitle: t("hub.empty.library.title"),
          emptyBody: t("hub.empty.library.body"),
          emptyAction: t("hub.empty.library.action"),
        }}
      />
      <HubDiscoveryControls
        filters={[]}
        query=""
        activeFilter={null}
        results={null}
        action="/shadowing"
        labels={{
          searchLabel: t("hub.sections.search"),
          searchPlaceholder: t("hub.search.placeholder"),
          all: "",
          results: t("hub.search.results"),
          noResults: t("hub.search.noResults"),
          start: t("hub.actions.start"),
          noThumbnail: "",
        }}
      />
      <HubShelves
        recentlyAdded={[]}
        popular={[]}
        continueLearning={[]}
        recommendations={[]}
        labels={{
          recentlyAdded: t("hub.sections.recentlyAdded"),
          popular: t("hub.sections.popular"),
          continueLearning: t("hub.sections.continueLearning"),
          recommended: t("hub.sections.recommended"),
          start: t("hub.actions.start"),
          continue: t("hub.actions.continue"),
          noThumbnail: "",
          recommendationReason: () => "",
          empty: {
            popular: { title: t("hub.empty.popular.title"), body: t("hub.empty.popular.body") },
            continueLearning: { title: t("hub.empty.continueLearning.title"), body: t("hub.empty.continueLearning.body") },
            recentlyAdded: { title: t("hub.empty.recentlyAdded.title"), body: t("hub.empty.recentlyAdded.body") },
            recommended: { title: t("hub.empty.recommended.title"), body: t("hub.empty.recommended.body") },
          },
        }}
      />
      <HubCompanionRail
        rail={null}
        labels={{
          preparation: t("hub.rail.preparation"),
          noPreparation: t("hub.rail.noPreparation"),
          todayGoal: t("hub.rail.todayGoal"),
          noGoal: t("hub.rail.noGoal"),
          weeklyProgress: t("hub.rail.weeklyProgress"),
          noWeeklyActivity: t("hub.rail.noWeeklyActivity"),
          suggestion: t("hub.rail.suggestion"),
          noSuggestion: t("hub.rail.noSuggestion"),
          openLesson: t("hub.actions.openLesson"),
          knownWordFit: () => "",
        }}
      />
    </>
  );
}

const LOCALES: ReadonlyArray<{ locale: Locale; catalog: CatalogNode }> = [
  { locale: "en", catalog: en },
  { locale: "vi", catalog: viCatalog },
];

const VIDEO_CATALOGS: Record<Locale, CatalogNode> = { en: enVideos, vi: viVideos };

describe("Shadowing Hub and Explore EN/VI copy contract", () => {
  it("covers the Hub and C3 Explore roots with their expected non-empty leaf collections", () => {
    expect(COPY_ROOTS).toEqual(["hub", "mobileHandoff", "explore"]);
    expect(COPY_ROOTS).toHaveLength(3);
    expect(LOCALES).toHaveLength(2);

    for (const { locale, catalog } of LOCALES) {
      const leaves = collectContractLeaves(catalog);
      expect(Object.keys(leaves), `${locale} copy leaves`).toHaveLength(EXPECTED_LEAF_COUNT);
      expect(Object.keys(leaves).length, `${locale} copy leaves`).toBeGreaterThan(0);
    }
  });

  it("has identical leaf paths and ICU placeholder sets in EN and VI", () => {
    const enLeaves = collectContractLeaves(en);
    const viLeaves = collectContractLeaves(viCatalog);
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

    it(`renders every honest empty Hub region and its real import action in ${locale}`, () => {
      render(
        <NextIntlClientProvider locale={locale} messages={{ shadowing: catalog, videos: VIDEO_CATALOGS[locale] }}>
          <LocalizedEmptyHub />
        </NextIntlClientProvider>,
      );

      const hub = catalog.hub as CatalogNode;
      const sections = hub.sections as CatalogNode;
      const rail = hub.rail as CatalogNode;
      const libraryEmpty = (hub.empty as CatalogNode).library as CatalogNode;

      for (const title of [
        sections.featured,
        sections.library,
        sections.popular,
        sections.continueLearning,
        sections.recentlyAdded,
        sections.recommended,
      ]) {
        expect(screen.getByRole("region", { name: title as string })).toBeVisible();
      }
      for (const title of [rail.preparation, rail.todayGoal, rail.weeklyProgress, rail.suggestion]) {
        expect(screen.getByRole("region", { name: title as string })).toBeVisible();
      }

      expect(screen.getByRole("search", { name: sections.search as string })).toBeVisible();
      expect(screen.getByRole("link", { name: libraryEmpty.action as string })).toHaveAttribute("href", "#hub-import");
      expect(screen.getByRole("button", { name: (VIDEO_CATALOGS[locale] as CatalogNode).import as string })).toBeVisible();
    });
  }
});
