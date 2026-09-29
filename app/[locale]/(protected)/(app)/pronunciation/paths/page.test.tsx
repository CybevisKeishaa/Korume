import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import pronunciationCopy from "@/messages/en/pronunciation.json";

const data = vi.hoisted(() => ({ getLearningPaths: vi.fn() }));

vi.mock("@/lib/data/collections", () => ({ getLearningPaths: data.getLearningPaths }));

vi.mock("@/lib/i18n/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string, values: Record<string, string | number> = {}) => {
    const message = key.split(".").reduce<unknown>((value, part) => (
      value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined
    ), pronunciationCopy) as string;
    const flat = message.replace(/^\{\w+, plural,.*other \{(.*)\}\}$/, "$1");
    return Object.entries(values).reduce((copy, [name, value]) => copy.split(`{${name}}`).join(String(value)), flat);
  }),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import LearningPathsPage from "./page";

function summary(id: string, saved: boolean) {
  return {
    collection: { id, slug: id, title: `Path ${id}`, description: null, coverImageUrl: null, displayOrder: 1, kind: "path", skillFocus: null, icon: null },
    total: 2, completed: 0, next: null, started: false, saved, lessonCount: 2, durationMinutes: null,
  };
}

describe("LearningPathsPage", () => {
  it("lists the saved paths first, then every path", async () => {
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [summary("a", false), summary("b", true)] });
    render(await LearningPathsPage());

    expect(screen.getByRole("heading", { level: 1, name: pronunciationCopy.hub.paths.pageTitle })).toBeInTheDocument();
    const saved = screen.getByRole("region", { name: pronunciationCopy.hub.paths.saved });
    expect(within(saved).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Path b"]);
    const all = screen.getByRole("region", { name: pronunciationCopy.hub.paths.all });
    expect(within(all).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Path a", "Path b"]);
    expect(saved.compareDocumentPosition(all) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explains an empty saved list instead of hiding it", async () => {
    data.getLearningPaths.mockResolvedValue({ featured: null, paths: [summary("a", false)] });
    render(await LearningPathsPage());

    const saved = screen.getByRole("region", { name: pronunciationCopy.hub.paths.saved });
    expect(within(saved).getByText(pronunciationCopy.hub.paths.savedEmptyTitle)).toBeInTheDocument();
  });
});
