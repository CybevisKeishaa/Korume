import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import commonCopy from "@/messages/en/common.json";
import pronunciationCopy from "@/messages/en/pronunciation.json";
import shadowingCopy from "@/messages/en/shadowing.json";

const catalogs = { common: commonCopy, pronunciation: pronunciationCopy, shadowing: shadowingCopy } as const;

function translation(namespace: keyof typeof catalogs) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const message = key.split(".").reduce<unknown>((value, part) => (
      value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined
    ), catalogs[namespace]) as string;
    // Enough ICU for these assertions: take a plural's `other` branch, then fill named arguments.
    const flat = message.replace(/^\{\w+, plural,.*other \{(.*)\}\}$/, "$1");
    return Object.entries(values).reduce((copy, [name, value]) => copy.split(`{${name}}`).join(String(value)), flat);
  };
}

const data = vi.hoisted(() => ({
  getHubDiscovery: vi.fn(),
  getLearningPaths: vi.fn(),
  // Both shelves default to empty; a test that cares supplies its own rows.
  getShadowingCollections: vi.fn().mockResolvedValue([]),
  listPracticeSituations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/data/shadowing-hub", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/shadowing-hub")>()),
  getHubDiscovery: data.getHubDiscovery,
}));

vi.mock("@/lib/data/collections", () => ({ getLearningPaths: data.getLearningPaths, getShadowingCollections: data.getShadowingCollections }));
vi.mock("@/lib/data/lesson-taxonomy", () => ({ listPracticeSituations: data.listPracticeSituations }));

const noDiscovery = { filters: [{ kind: "situation", slug: "restaurant" }], discovery: null };

function video(id: string, title: string) {
  return {
    id, title, youtube_video_id: `yt-${id}`, duration_seconds: 600, thumbnail_url: null, jlpt_level_estimate: "N3",
    added_by_user_id: null, library_access: "FREE" as const, promotion_starred: false, created_at: "2026-09-01",
  };
}

vi.mock("@/lib/i18n/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockImplementation(async (input: string | { namespace: keyof typeof catalogs }) => (
    translation(typeof input === "string" ? input as keyof typeof catalogs : input.namespace)
  )),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
  useRouter: () => ({ refresh: vi.fn() }),
  getPathname: vi.fn().mockReturnValue("/pronunciation"),
}));

vi.mock("@/components/layout/upcoming-screen", () => ({
  UpcomingScreen: () => <div data-testid="upcoming-screen" />,
}));

import PronunciationPage from "./page";

describe("PronunciationPage", () => {
  it("renders the catalog heading and pronunciation discovery controls without undefined sliders", async () => {
    const user = userEvent.setup();
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    render(await PronunciationPage({}));

    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.title })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: pronunciationCopy.hub.searchLabel })).toHaveAttribute("action", "/pronunciation");
    await user.click(screen.getByRole("button", { name: pronunciationCopy.hub.filterToggleLabel }));
    expect(await screen.findByRole("link", { name: shadowingCopy.situations.restaurant })).toHaveAttribute("href", "/pronunciation?filter=situation%3Arestaurant");
    expect(screen.queryByTestId("upcoming-screen")).not.toBeInTheDocument();
  });

  it("keeps the course region with its own empty copy when no path has lessons", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    render(await PronunciationPage({}));

    expect(screen.getByRole("region", { name: pronunciationCopy.hub.featuredCourse })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.emptyCourse.title })).toBeInTheDocument();
  });

  it("mounts the featured course, then the resume strip, then the results, with catalog copy", async () => {
    const first = video("v1", "Greetings");
    const second = video("v2", "Meeting introductions");
    data.getHubDiscovery.mockResolvedValue({
      filters: [],
      discovery: { query: "meet", activeFilter: null, lessons: [{ id: "r1", youtubeVideoId: "yt-r1", title: "Result", durationSeconds: 60, thumbnailUrl: null, jlptLevelEstimate: null }] },
    });
    data.getLearningPaths.mockResolvedValue({ paths: [], featured: {
      collection: { id: "c1", slug: "business-japanese", title: "Business Japanese", description: "Meetings and emails.", coverImageUrl: null, displayOrder: 7, kind: "path", skillFocus: null },
      total: 2, completed: 1, lessonCount: 2, next: second, lessons: [first, second],
      resume: { lesson: second, index: 2, percent: 92 },
      coverUrl: null, durationMinutes: 210, jlptRange: "N3", levelBand: { from: "intermediate", to: "intermediate" },
      selectedByRecentActivity: false,
    } });
    render(await PronunciationPage({}));

    const hero = screen.getByRole("region", { name: pronunciationCopy.hub.featuredCourse });
    expect(hero).toContainElement(screen.getByRole("heading", { name: "Business Japanese" }));
    expect(hero).toHaveTextContent(pronunciationCopy.hub.levels.intermediate);
    expect(hero).toHaveTextContent("3.5 hours");
    expect(screen.getByRole("link", { name: `${pronunciationCopy.hub.continueLearning}: Business Japanese` })).toHaveAttribute("href", "/shadowing/v2");

    const strip = screen.getByRole("link", { name: /Business Japanese · Lesson 2 · Meeting introductions/ });
    expect(strip).toHaveAttribute("href", "/shadowing/v2");
    expect(strip).toHaveTextContent("92%");

    const results = screen.getByRole("heading", { name: shadowingCopy.hub.search.results });
    expect(hero.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shelves the first four learning paths, with the frame's meta line and a View all link", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    const summary = (id: string, title: string) => ({
      collection: { id, slug: id, title, description: null, coverImageUrl: null, displayOrder: 1, kind: "path", skillFocus: null, icon: null },
      total: 48, completed: 0, next: video(`${id}-1`, "First"), started: false, saved: false, lessonCount: 48, durationMinutes: 200,
    });
    data.getLearningPaths.mockResolvedValue({
      featured: null,
      paths: ["one", "two", "three", "four", "five"].map((id) => summary(id, `Path ${id}`)),
    });
    render(await PronunciationPage({}));

    const shelf = screen.getByRole("region", { name: pronunciationCopy.hub.paths.title });
    expect(shelf.querySelectorAll("li")).toHaveLength(4);
    expect(shelf).not.toHaveTextContent("Path five");
    expect(shelf).toHaveTextContent("48 lessons · 3h 20m");
    expect(within(shelf).getByRole("link", { name: /^View all/ })).toHaveAttribute("href", "/pronunciation/paths");
    expect(screen.getByRole("button", { name: "Save Path one" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shelves the situations with lessons and the shadowing collections, each linking where it practises", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.listPracticeSituations.mockResolvedValueOnce([{ slug: "cafe", icon: "☕" }]);
    const collection = (slug: string) => ({ id: slug, slug, title: `Title ${slug}`, description: null, coverImageUrl: null, displayOrder: 0, kind: "shelf" });
    data.getShadowingCollections.mockResolvedValueOnce([
      { collection: collection("c1"), lessonCount: 3, durationMinutes: 42, levelBand: { from: "intermediate", to: "intermediate" }, sentenceCount: 38 },
      { collection: collection("c2"), lessonCount: 1, durationMinutes: null, levelBand: null, sentenceCount: 0 },
      { collection: collection("c3"), lessonCount: 1, durationMinutes: null, levelBand: null, sentenceCount: 1 },
      { collection: collection("c4"), lessonCount: 1, durationMinutes: null, levelBand: null, sentenceCount: 1 },
      { collection: collection("c5"), lessonCount: 1, durationMinutes: null, levelBand: null, sentenceCount: 1 },
    ]);
    render(await PronunciationPage({}));

    const situations = screen.getByRole("region", { name: pronunciationCopy.hub.situations.title });
    expect(within(situations).getByRole("link", { name: `Start practice: ${shadowingCopy.situations.cafe}` }))
      .toHaveAttribute("href", "/pronunciation?filter=situation%3Acafe");

    const shelf = screen.getByRole("region", { name: pronunciationCopy.hub.shadowingCollections.title });
    // The frame shelves four; "View all" opens the collections' own home.
    expect(within(shelf).getAllByRole("listitem")).toHaveLength(4);
    expect(within(shelf).getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/shadowing/explore");
    const first = within(shelf).getByRole("link", { name: /Title c1/ });
    expect(first).toHaveAttribute("href", "/pronunciation/collections/c1");
    expect(first).toHaveTextContent("Intermediate · 42 min");
    expect(first).toHaveTextContent("38 sentences");
  });

  it("gives each new shelf its own empty copy", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    render(await PronunciationPage({}));

    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.situations.emptyTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.shadowingCollections.emptyTitle })).toBeInTheDocument();
  });
});
