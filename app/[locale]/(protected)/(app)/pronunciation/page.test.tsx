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
  getPracticeGoals: vi.fn().mockResolvedValue([]),
  // Both shelves default to empty; a test that cares supplies its own rows.
  getShadowingCollections: vi.fn().mockResolvedValue([]),
  listPracticeSituations: vi.fn().mockResolvedValue([]),
  getWeeklyPronunciationMetrics: vi.fn().mockResolvedValue({ means: { accuracy: null, pitch: null, rhythm: null }, weakest: null }),
  getMyPreferences: vi.fn().mockResolvedValue(null),
  getJlptSpeakingSummary: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/data/shadowing-hub", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/shadowing-hub")>()),
  getHubDiscovery: data.getHubDiscovery,
}));

vi.mock("@/lib/data/collections", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/collections")>()),
  getLearningPaths: data.getLearningPaths,
  getPracticeGoals: data.getPracticeGoals,
  getShadowingCollections: data.getShadowingCollections,
}));
vi.mock("@/lib/data/lesson-taxonomy", () => ({ listPracticeSituations: data.listPracticeSituations }));
vi.mock("@/lib/data/pronunciation-metrics", () => ({
  getWeeklyPronunciationMetrics: data.getWeeklyPronunciationMetrics,
  getJlptSpeakingSummary: data.getJlptSpeakingSummary,
}));
vi.mock("@/lib/data/preferences", () => ({ getMyPreferences: data.getMyPreferences }));

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
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/pronunciation",
  getPathname: vi.fn().mockReturnValue("/pronunciation"),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

vi.mock("@/components/layout/upcoming-screen", () => ({
  UpcomingScreen: () => <div data-testid="upcoming-screen" />,
}));

import PronunciationPage from "./page";

describe("PronunciationPage", () => {
  it("uses profile display settings only when the URL supplies none, and URL wins otherwise", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getMyPreferences.mockResolvedValue({ pronunciationSort: "shortest", pronunciationDuration: "under_10", pronunciationHideCompleted: true });

    await PronunciationPage({});
    expect(data.getHubDiscovery).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "shortest", duration: "under_10", hideCompleted: true }));
    await PronunciationPage({ searchParams: { sort: "newest" } });
    expect(data.getHubDiscovery).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "newest", duration: null, hideCompleted: false }));
    // A bad `q` fails only the search params; the display params still win.
    await PronunciationPage({ searchParams: { q: "x".repeat(101), sort: "shortest" } });
    expect(data.getHubDiscovery).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "shortest", duration: null, hideCompleted: false }));
  });

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
    expect(screen.getByRole("button", { name: pronunciationCopy.hub.display.trigger })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: pronunciationCopy.hub.searchLabel })).toHaveAttribute("placeholder", "Search by lesson title");
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

  it("places goals between situations and collections, with one weakest-metric recommendation", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.listPracticeSituations.mockResolvedValueOnce([{ slug: "cafe", icon: "â˜•" }]);
    const summary = (id: string, skillFocus: "pitch" | "rhythm", started = false) => ({
      collection: { id, slug: id, title: `Goal ${id}`, description: `Description ${id}`, coverImageUrl: null, displayOrder: 1, kind: "goal", skillFocus, icon: "â—Œ" },
      total: 2, completed: started ? 1 : 0, next: video(`${id}-lesson`, "First"), started, lessonCount: 2, durationMinutes: 30,
    });
    data.getPracticeGoals.mockResolvedValueOnce([summary("pitch", "pitch"), summary("rhythm-first", "rhythm", true), summary("rhythm-second", "rhythm")]);
    data.getWeeklyPronunciationMetrics.mockResolvedValueOnce({ means: { accuracy: 80, pitch: 70, rhythm: 50 }, weakest: "rhythm" });
    data.getShadowingCollections.mockResolvedValueOnce([]);
    render(await PronunciationPage({}));

    const situations = screen.getByRole("region", { name: pronunciationCopy.hub.situations.title });
    const goals = screen.getByRole("region", { name: pronunciationCopy.hub.goals.title });
    const collections = screen.getByRole("region", { name: pronunciationCopy.hub.shadowingCollections.title });
    expect(situations.compareDocumentPosition(goals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(goals.compareDocumentPosition(collections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(goals).getByText(pronunciationCopy.hub.goals.recommended)).toBeInTheDocument();
    expect(within(goals).getAllByText(pronunciationCopy.hub.goals.recommended)).toHaveLength(1);
    expect(within(goals).queryByRole("button", { name: /Save Goal/ })).not.toBeInTheDocument();
    expect(goals.querySelector("ul")).toHaveClass("xl:grid-cols-3");
    expect(within(goals).getByRole("link", { name: `Continue: Goal rhythm-first` })).toHaveAttribute("href", "/shadowing/rhythm-first-lesson");
    expect(within(goals).getByRole("link", { name: `Start: Goal pitch` })).toHaveAttribute("href", "/shadowing/pitch-lesson");
    expect(goals).toHaveTextContent("2 lessons · 30m");
  });

  it("does not recommend a goal when the learner has no scored history", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getPracticeGoals.mockResolvedValueOnce([{
      collection: { id: "pitch", slug: "pitch", title: "Goal pitch", description: null, coverImageUrl: null, displayOrder: 1, kind: "goal", skillFocus: "pitch", icon: "〽" },
      total: 1, completed: 0, next: video("pitch-lesson", "First"), started: false, lessonCount: 1, durationMinutes: 10,
    }]);
    data.getWeeklyPronunciationMetrics.mockResolvedValueOnce({ means: { accuracy: null, pitch: null, rhythm: null }, weakest: null });
    render(await PronunciationPage({}));

    expect(within(screen.getByRole("region", { name: pronunciationCopy.hub.goals.title })).queryByText(pronunciationCopy.hub.goals.recommended)).not.toBeInTheDocument();
  });

  it("gives each new shelf its own empty copy", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    render(await PronunciationPage({}));

    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.situations.emptyTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.goals.emptyTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.shadowingCollections.emptyTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.jlptSpeaking.emptyTitle })).toBeInTheDocument();
  });

  it("shelves JLPT Speaking between goals and collections: practiced share, lessons, and a dash for no score", async () => {
    const user = userEvent.setup();
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getJlptSpeakingSummary.mockResolvedValueOnce([
      { level: "N5", lessonCount: 18, practicedCount: 15, averageScore: 91 },
      // Nothing practiced is a measured 0%; no scored session is unknown, so a dash.
      { level: "N1", lessonCount: 48, practicedCount: 0, averageScore: null },
      // Every lesson but one practiced never reads 100%.
      { level: "N3", lessonCount: 200, practicedCount: 199, averageScore: 70 },
    ]);
    render(await PronunciationPage({}));

    const goals = screen.getByRole("region", { name: pronunciationCopy.hub.goals.title });
    const jlpt = screen.getByRole("region", { name: pronunciationCopy.hub.jlptSpeaking.title });
    const collections = screen.getByRole("region", { name: pronunciationCopy.hub.shadowingCollections.title });
    expect(goals.compareDocumentPosition(jlpt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(jlpt.compareDocumentPosition(collections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(jlpt.querySelector("ul")).toHaveClass("xl:grid-cols-5");
    expect(within(jlpt).queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();

    const n5 = within(jlpt).getByRole("link", { name: /^N5/ });
    expect(n5).toHaveAttribute("href", "/pronunciation?filter=level%3An5");
    expect(n5).toHaveTextContent("83% practiced");
    expect(n5).toHaveTextContent("18 lessons");
    expect(n5).toHaveTextContent("Avg score 91");
    const n1 = within(jlpt).getByRole("link", { name: /^N1/ });
    expect(n1).toHaveTextContent("0% practiced");
    expect(n1).toHaveTextContent(pronunciationCopy.hub.jlptSpeaking.noScore);
    expect(within(jlpt).getByRole("link", { name: /^N3/ })).toHaveTextContent("99% practiced");

    await user.click(screen.getByRole("button", { name: pronunciationCopy.hub.filterToggleLabel }));
    expect(await screen.findByRole("link", { name: "N4" })).toHaveAttribute("href", "/pronunciation?filter=level%3An4");
  });
});
