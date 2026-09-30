import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { PronunciationSearchResults, type PronunciationSearchResultsProps } from "./pronunciation-search-results";

// The pager navigates with the app router, which a unit render does not mount.
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const card = (id: string) => <li key={id}><a href={`/shadowing/${id}`}>{id}</a></li>;

const base: PronunciationSearchResultsProps = {
  heading: "Results for “ramen”",
  tabs: {
    label: "Result types",
    items: [
      { key: "all", label: "All", href: "/pronunciation?q=ramen", current: true },
      { key: "lessons", label: "Lessons (2)", href: "/pronunciation?q=ramen&type=lessons", current: false },
    ],
  },
  groups: [
    { key: "lessons", title: "Lessons", seeAll: { href: "/pronunciation?q=ramen&type=lessons", label: "See all Lessons" }, items: [card("a"), card("b")] },
    { key: "paths", title: "Learning paths", seeAll: { href: "/pronunciation?q=ramen&type=paths", label: "See all Learning paths" }, items: [] },
  ],
  preview: true,
  more: null,
  empty: "No results for “ramen”.",
};

describe("PronunciationSearchResults", () => {
  it("renders the tabs as links in a named nav, marking the current one", () => {
    render(<PronunciationSearchResults {...base} />);

    const nav = screen.getByRole("navigation", { name: "Result types" });
    const [all, lessons] = within(nav).getAllByRole("link");
    expect(all).toHaveAttribute("aria-current", "page");
    expect(lessons).not.toHaveAttribute("aria-current");
    expect(lessons).toHaveAccessibleName("Lessons (2)");
  });

  it("previews each non-empty group as one row with See all, inside the container pane", () => {
    const { container } = render(<PronunciationSearchResults {...base} />);

    expect(container.firstElementChild).toHaveClass("result-pane");
    const group = screen.getByRole("region", { name: "Lessons" });
    // A group title outranks the h3 card titles inside it.
    expect(within(group).getByRole("heading", { name: "Lessons" })).toHaveProperty("tagName", "H2");
    expect(group.querySelector("ul")).toHaveClass("result-grid", "result-preview");
    expect(within(group).getByRole("link", { name: /See all Lessons/ })).toHaveAttribute("href", "/en/pronunciation?q=ramen&type=lessons");
    // An empty group is not rendered.
    expect(screen.queryByRole("region", { name: "Learning paths" })).not.toBeInTheDocument();
  });

  it("pages a single group without preview or See all, with Show more after the grid", () => {
    render(<PronunciationSearchResults
      {...base}
      tabs={null}
      preview={false}
      groups={[{ key: "lessons", title: "Lessons", seeAll: null, items: [card("a"), card("b")] }]}
      more={{ href: "/pronunciation?sort=shortest&shown=48", label: "Show more lessons", pendingLabel: "Loading…" }}
    />);

    const list = screen.getByRole("list");
    expect(list).toHaveClass("result-grid");
    expect(list).not.toHaveClass("result-preview");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /See all/ })).not.toBeInTheDocument();
    const more = screen.getByRole("link", { name: "Show more lessons" });
    expect(screen.getAllByRole("listitem").at(-1)!.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows only the shared empty state when every group is empty", () => {
    render(<PronunciationSearchResults {...base} groups={base.groups.map((group) => ({ ...group, items: [] }))} />);

    expect(screen.getByText("No results for “ramen”.")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
