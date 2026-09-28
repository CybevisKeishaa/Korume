import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import pronunciationCopy from "@/messages/en/pronunciation.json";
import commonCopy from "@/messages/en/common.json";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  lessons: vi.fn(),
  progress: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/data/collections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/collections")>();
  return {
    ...actual,
    getCollectionBySlug: mocks.collection,
    listCollectionLessons: mocks.lessons,
    getCollectionProgress: mocks.progress,
  };
});

vi.mock("@/lib/i18n/server", () => ({
  getTranslations: vi.fn().mockImplementation(async (namespace: string) => (key: string, values?: Record<string, number | string>) => {
    const value = key.split(".").reduce<unknown>((current, part) => (
      current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined
    ), namespace === "common" ? commonCopy : pronunciationCopy) as string;
    if (key === "hub.durationHours" && values?.hours !== undefined) {
      return Number(values.hours) === 1 ? `${values.hoursText} hour` : `${values.hoursText} hours`;
    }
    return values ? Object.entries(values).reduce((copy, [name, replacement]) => copy.replace(`{${name}}`, String(replacement)), value) : value;
  }),
  getLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
}));

import CollectionPage from "./page";

const collection = {
  id: "course-1",
  slug: "everyday-conversation",
  title: "Everyday Conversation",
  description: "Natural phrases for daily life.",
  coverImageUrl: null,
  displayOrder: 1,
  kind: "path" as const,
  skillFocus: null,
};

describe("CollectionPage", () => {
  it("renders a found course with its progress, derived meta, and editorial lesson order", async () => {
    mocks.collection.mockResolvedValue(collection);
    mocks.lessons.mockResolvedValue([
      { id: "first", title: "First lesson", duration_seconds: 1800, thumbnail_url: null, youtube_video_id: "yt-1", jlpt_level_estimate: "N4" },
      { id: "second", title: "Second lesson", duration_seconds: 1800, thumbnail_url: null, youtube_video_id: "yt-2", jlpt_level_estimate: "N3" },
    ]);
    mocks.progress.mockResolvedValue({ total: 2, completed: 1 });

    render(await CollectionPage({ params: { slug: collection.slug } }));

    expect(screen.getByText(pronunciationCopy.hub.course, { selector: "header p" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "50% complete" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(pronunciationCopy.hub.duration).nextElementSibling).toHaveTextContent("1 hour");
    expect(screen.getByText("N4–N3")).toBeInTheDocument();
    const { levels } = pronunciationCopy.hub;
    expect(screen.getByText(pronunciationCopy.hub.level).nextElementSibling).toHaveTextContent(`${levels.beginner}–${levels.intermediate}`);
    const start = pronunciationCopy.hub.startLesson;
    expect(screen.getAllByRole("link", { name: new RegExp(`^${start}:`) }).map((link) => link.getAttribute("aria-label")))
      .toEqual([`${start}: First lesson`, `${start}: Second lesson`]);
  });

  it("labels a plain shelf as a collection", async () => {
    mocks.collection.mockResolvedValue({ ...collection, kind: "shelf" as const });
    mocks.lessons.mockResolvedValue([]);
    mocks.progress.mockResolvedValue({ total: 0, completed: 0 });

    render(await CollectionPage({ params: { slug: collection.slug } }));

    expect(screen.getByText(pronunciationCopy.hub.collection, { selector: "header p" })).toBeInTheDocument();
  });

  it("calls notFound for an unknown collection", async () => {
    mocks.collection.mockResolvedValue(null);
    mocks.notFound.mockImplementation(() => { throw new Error("not found"); });

    await expect(CollectionPage({ params: { slug: "missing" } })).rejects.toThrow("not found");
  });

  it("renders an explicit empty state for a collection without visible lessons", async () => {
    mocks.collection.mockResolvedValue({ ...collection, kind: "goal" as const });
    mocks.lessons.mockResolvedValue([]);
    mocks.progress.mockResolvedValue({ total: 0, completed: 0 });

    render(await CollectionPage({ params: { slug: collection.slug } }));

    expect(screen.getByText(pronunciationCopy.hub.goal)).toBeInTheDocument();
    expect(screen.getByText(pronunciationCopy.hub.emptyCollection)).toBeInTheDocument();
  });
});
