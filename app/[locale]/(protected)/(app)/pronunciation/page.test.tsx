import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import commonCopy from "@/messages/en/common.json";
import pronunciationCopy from "@/messages/en/pronunciation.json";
import shadowingCopy from "@/messages/en/shadowing.json";

const catalogs = { common: commonCopy, pronunciation: pronunciationCopy, shadowing: shadowingCopy } as const;

function translation(namespace: keyof typeof catalogs) {
  const raw = (key: string) => key.split(".").reduce<unknown>((value, part) => (
    value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined
  ), catalogs[namespace]) as string;
  const t = (key: string, values: Record<string, string | number> = {}) => {
    // Enough ICU for these assertions: take a plural's `other` branch, then fill named arguments.
    const flat = raw(key).replace(/^\{\w+, plural,.*other \{(.*)\}\}$/, "$1");
    const filled = Object.entries(values).reduce((copy, [name, value]) => copy.split(`{${name}}`).join(String(value)), flat);
    // use-intl's development build refuses a template with an unfilled argument; so does this mock.
    const missing = filled.match(/\{(\w+)\}/);
    if (missing) throw new Error(`${key}: argument "${missing[1]}" was not provided`);
    return filled;
  };
  // `t.raw` returns the template unformatted, as next-intl does.
  return Object.assign(t, { raw });
}

const data = vi.hoisted(() => ({
  getHubDiscovery: vi.fn(),
  getLearningPaths: vi.fn(),
  getPracticeGoals: vi.fn().mockResolvedValue([]),
  // Both shelves default to empty; a test that cares supplies its own rows.
  getShadowingCollections: vi.fn().mockResolvedValue([]),
  listPracticeSituations: vi.fn().mockResolvedValue([]),
  getWeeklyPronunciationMetrics: vi.fn().mockResolvedValue({ means: { accuracy: null, pitch: null, rhythm: null }, weakest: null }),
  getTodaySpeaking: vi.fn().mockResolvedValue({ minutes: 0, lessonsCompleted: 0, averageScore: null }),
  getWeeklyImprovement: vi.fn().mockResolvedValue({ deltas: { accuracy: null, pitch: null, rhythm: null }, trend: [] }),
  getRecentPractice: vi.fn().mockResolvedValue([]),
  getSenseiRecommendation: vi.fn().mockResolvedValue(null),
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
  getSenseiRecommendation: data.getSenseiRecommendation,
}));
vi.mock("@/lib/data/lesson-taxonomy", () => ({ listPracticeSituations: data.listPracticeSituations }));
vi.mock("@/lib/data/pronunciation-metrics", async (importOriginal) => ({
  // The real VN-day math: the page's "Yesterday" and trend x must cross UTC+7 midnight correctly.
  vnDaysAgo: (await importOriginal<typeof import("@/lib/data/pronunciation-metrics")>()).vnDaysAgo,
  getWeeklyPronunciationMetrics: data.getWeeklyPronunciationMetrics,
  getTodaySpeaking: data.getTodaySpeaking,
  getWeeklyImprovement: data.getWeeklyImprovement,
  getRecentPractice: data.getRecentPractice,
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
import { RESULT_MAX_LIMIT } from "@/lib/validation/shadowing-hub";

describe("PronunciationPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    data.getTodaySpeaking.mockResolvedValue({ minutes: 0, lessonsCompleted: 0, averageScore: null });
    data.getWeeklyImprovement.mockResolvedValue({ deltas: { accuracy: null, pitch: null, rhythm: null }, trend: [] });
    data.getRecentPractice.mockResolvedValue([]);
    data.getSenseiRecommendation.mockResolvedValue(null);
    data.getMyPreferences.mockResolvedValue(null);
  });

  it("renders the pronunciation progress rail in the complementary landmark", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });

    render(await PronunciationPage({}));

    expect(screen.getByRole("complementary", { name: "Pronunciation progress" })).toBeInTheDocument();
  });

  it("projects honest rail data, prioritizing recent practice and measured Sensei focus", async () => {
    vi.useFakeTimers();
    // 00:01 on 2026-09-30 in VN: two minutes earlier was 2026-09-29, "Yesterday", though the same UTC day.
    vi.setSystemTime(new Date("2026-09-29T17:01:00.000Z"));
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getWeeklyImprovement.mockResolvedValue({
      deltas: { accuracy: null, pitch: 0, rhythm: -3 },
      trend: [{ day: "2026-09-17", score: 50 }, { day: "2026-09-30", score: 90 }],
    });
    data.getRecentPractice.mockResolvedValue([{ lesson: { id: "recent", title: "Recent lesson" }, practicedAt: "2026-09-29T16:59:00.000Z", averageScore: 94 }]);
    data.getSenseiRecommendation.mockResolvedValue({ lesson: { id: "sensei", title: "Pitch lesson" }, knownRatio: 0.78, focus: "pitch", home: { kind: "goal", title: "Improve Pitch Accent", lessonNumber: 12 } });

    render(await PronunciationPage({}));

    const rail = screen.getByRole("complementary", { name: "Pronunciation progress" });
    expect(within(rail).getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["Today's Speaking", "Weekly Improvement", "AI Sensei Recommendation", "Recently Practiced"]);
    expect(within(rail).queryByText("Confidence")).not.toBeInTheDocument();
    expect(within(rail).getAllByText("Not enough data", { selector: ".sr-only" })).toHaveLength(1);
    expect(within(rail).getByRole("link", { name: "Continue Practice" })).toHaveAttribute("href", "/shadowing/recent");
    expect(within(rail).getByText("Pitch Accent was your lowest score this week. This lesson trains it, and you already know 78% of its words.")).toBeInTheDocument();
    expect(within(rail).getByText("Yesterday")).toBeInTheDocument();
    // A measured 0 is "0%"; a fall carries a real minus sign (U+2212).
    expect(within(rail).getByText("0%")).toBeInTheDocument();
    expect(within(rail).getByText("−3%")).toBeInTheDocument();
    // 13 VN days back is the chart's left edge, today its right.
    const chart = within(rail).getByRole("img", { name: pronunciationCopy.hub.rail.weekly.chartLabel });
    expect(chart.querySelector("polyline")).toHaveAttribute("points", "0,34 240,13.2");
    expect(within(rail).getByText("Sep 17: 50", { selector: "li" })).toBeInTheDocument();
    expect(within(rail).getByText(pronunciationCopy.hub.rail.sensei.recommendedGoal)).toBeInTheDocument();
    expect(within(rail).getByText("Lesson 12 · Pitch lesson")).toBeInTheDocument();
  });

  it("reads a session the database stamped just after this request, across VN midnight, as today, never tomorrow", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T16:59:59.000Z"));
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getRecentPractice.mockResolvedValue([{ lesson: { id: "late", title: "Late lesson" }, practicedAt: "2026-09-29T17:00:01.000Z", averageScore: 88 }]);

    render(await PronunciationPage({}));

    const recent = screen.getByRole("region", { name: pronunciationCopy.hub.rail.recent.title });
    expect(within(recent).getByText("Today")).toBeInTheDocument();
    expect(within(recent).queryByText("Tomorrow")).not.toBeInTheDocument();
  });

  it("uses the featured course next lesson only when recent practice is absent, and renders unfocused Sensei copy", async () => {
    const next = video("featured-next", "Featured next");
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ paths: [], featured: {
      collection: { id: "course", slug: "course", title: "Course", description: null, coverImageUrl: null, displayOrder: 1, kind: "path", skillFocus: null }, total: 1, completed: 0, lessonCount: 1, next, lessons: [next], resume: null, coverUrl: null, durationMinutes: 10, jlptRange: null, levelBand: null, selectedByRecentActivity: false,
    } });
    data.getSenseiRecommendation.mockResolvedValue({ lesson: { id: "stretch", title: "Stretch lesson" }, knownRatio: 0.64, focus: null, home: null });

    render(await PronunciationPage({}));

    const rail = screen.getByRole("complementary", { name: "Pronunciation progress" });
    expect(within(rail).getByRole("link", { name: "Continue Practice" })).toHaveAttribute("href", "/shadowing/featured-next");
    expect(within(rail).getByText("You already know 64% of this lesson's words — the right stretch for you.")).toBeInTheDocument();
  });

  it("names a customised Sort & display trigger by its applied view", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    render(await PronunciationPage({ searchParams: { sort: "shortest", duration: "under_10" } }));

    const { display } = pronunciationCopy.hub;
    expect(screen.getByRole("button", { name: `${display.trigger}: ${display.shortest}, ${display.underTen}` })).toBeInTheDocument();
  });

  it("uses profile display settings only when the URL supplies none, and URL wins otherwise", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getMyPreferences.mockResolvedValue({ pronunciationSort: "shortest", pronunciationDuration: "under_10", pronunciationHideCompleted: true });

    await PronunciationPage({});
    // A saved non-default display on a bare URL is result mode too (ruling 18).
    expect(data.getHubDiscovery).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "shortest", duration: "under_10", hideCompleted: true, browse: true, limit: 24 }));
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
    expect(screen.getByRole("button", { name: new RegExp(`^${pronunciationCopy.hub.display.trigger}`) })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: pronunciationCopy.hub.searchLabel })).toHaveAttribute("placeholder", "Search by lesson title");
  });

  it("keeps the course region with its own empty copy when no path has lessons", async () => {
    data.getHubDiscovery.mockResolvedValue(noDiscovery);
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    render(await PronunciationPage({}));

    expect(screen.getByRole("region", { name: pronunciationCopy.hub.featuredCourse })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.emptyCourse.title })).toBeInTheDocument();
  });

  it("mounts the featured course and resume strip in the default curated surface", async () => {
    const first = video("v1", "Greetings");
    const second = video("v2", "Meeting introductions");
    data.getHubDiscovery.mockResolvedValue({
      filters: [],
      discovery: { query: "meet", activeFilter: null, lessons: [{ id: "r1", youtubeVideoId: "yt-r1", title: "Result", durationSeconds: 60, thumbnailUrl: null, jlptLevelEstimate: null }], hasMore: false },
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

    // The default surface asks for no browse and shows no result list, even if handed one.
    expect(data.getHubDiscovery).toHaveBeenCalledWith(expect.objectContaining({ browse: false, limit: 4 }));
    expect(screen.queryByRole("heading", { name: shadowingCopy.hub.search.results })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Result/ })).not.toBeInTheDocument();
  });

  it("renders a result surface for a non-default display, without the hero, resume strip, or curated shelves", async () => {
    data.getHubDiscovery.mockResolvedValue({
      filters: [],
      discovery: { query: "", activeFilter: null, lessons: [{ id: "r1", youtubeVideoId: "yt-r1", title: "Result", durationSeconds: 60, thumbnailUrl: null, jlptLevelEstimate: null }], hasMore: true },
    });
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });

    render(await PronunciationPage({ searchParams: { sort: "shortest" } }));

    expect(data.getHubDiscovery).toHaveBeenCalledWith(expect.objectContaining({ browse: true, limit: 24 }));
    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.allLessons })).toBeInTheDocument();
    // The count is what is shown, not the cap: more matches exist beyond the one visible lesson.
    expect(screen.getByText(pronunciationCopy.hub.showingFirstLessons.replace("{count}", "1"))).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.featuredCourse })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.paths.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.situations.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.goals.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.jlptSpeaking.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.shadowingCollections.title })).not.toBeInTheDocument();
  });

  it("shows more by growing the page in the URL, keeping every discovery setting, only while more exist", async () => {
    const result = { id: "r1", youtubeVideoId: "yt-r1", title: "Result", durationSeconds: 60, thumbnailUrl: null, jlptLevelEstimate: null };
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });
    data.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { query: "ramen", activeFilter: "level:n5", lessons: [result], hasMore: true } });

    const { unmount } = render(await PronunciationPage({ searchParams: { q: "ramen", filter: "level:n5", sort: "shortest", hideCompleted: "true", shown: "48" } }));

    expect(data.getHubDiscovery).toHaveBeenLastCalledWith(expect.objectContaining({ browse: true, limit: 48 }));
    const more = new URL(screen.getByRole("link", { name: pronunciationCopy.hub.showMore }).getAttribute("href")!, "http://app");
    expect(more.pathname).toMatch(/\/pronunciation$/);
    expect(Object.fromEntries(more.searchParams)).toEqual({ q: "ramen", filter: "level:n5", sort: "shortest", hideCompleted: "true", shown: "72" });
    // A new search or chip is a new result set: only Show more carries `shown`.
    expect(document.querySelector('input[name="shown"]')).toBeNull();
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("shown=")).map((link) => link.textContent)).toEqual([pronunciationCopy.hub.showMore]);
    unmount();

    data.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { query: "ramen", activeFilter: null, lessons: [result], hasMore: false } });
    const { unmount: unmountWhole } = render(await PronunciationPage({ searchParams: { q: "ramen" } }));
    expect(screen.queryByRole("link", { name: pronunciationCopy.hub.showMore })).not.toBeInTheDocument();
    unmountWhole();

    // At the surface's ceiling the summary still says more exist, but there is no next page to offer.
    data.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { query: "ramen", activeFilter: null, lessons: [result], hasMore: true } });
    render(await PronunciationPage({ searchParams: { q: "ramen", shown: String(RESULT_MAX_LIMIT) } }));
    expect(screen.queryByRole("link", { name: pronunciationCopy.hub.showMore })).not.toBeInTheDocument();
    expect(screen.getByText(pronunciationCopy.hub.showingFirstLessons.replace("{count}", "1"))).toBeInTheDocument();
  });

  it("labels searched discovery as Search results without a truncation line", async () => {
    data.getHubDiscovery.mockResolvedValue({
      filters: [],
      discovery: { query: "meet", activeFilter: null, lessons: [{ id: "r1", youtubeVideoId: "yt-r1", title: "Result", durationSeconds: 60, thumbnailUrl: null, jlptLevelEstimate: null }], hasMore: false },
    });
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });

    render(await PronunciationPage({ searchParams: { q: "meet" } }));

    expect(screen.getByRole("heading", { name: shadowingCopy.hub.search.results })).toBeInTheDocument();
    expect(screen.queryByText(/^Showing the first/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.featuredCourse })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: pronunciationCopy.hub.paths.title })).not.toBeInTheDocument();
  });

  it("titles a browse by what the data layer applied: an unknown filter is All lessons, and an empty browse says the settings match nothing", async () => {
    data.getHubDiscovery.mockResolvedValue({ filters: [], discovery: { query: "", activeFilter: null, lessons: [], hasMore: false } });
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [] });

    render(await PronunciationPage({ searchParams: { filter: "source:unknown" } }));

    expect(screen.getByRole("heading", { name: pronunciationCopy.hub.allLessons })).toBeInTheDocument();
    expect(screen.getByText(pronunciationCopy.hub.noLessonsForDisplay)).toBeInTheDocument();
    expect(screen.queryByText(shadowingCopy.hub.search.noResults)).not.toBeInTheDocument();
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
    data.listPracticeSituations.mockResolvedValueOnce([{ slug: "cafe", icon: "☕" }]);
    const summary = (id: string, skillFocus: "pitch" | "rhythm", started = false) => ({
      collection: { id, slug: id, title: `Goal ${id}`, description: `Description ${id}`, coverImageUrl: null, displayOrder: 1, kind: "goal", skillFocus, icon: "◌" },
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
