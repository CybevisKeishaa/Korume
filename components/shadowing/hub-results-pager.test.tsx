import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { HubResultsPager } from "./hub-results-pager";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ push: nav.push }),
}));

const more = { href: "/pronunciation?shown=48", label: "Show more lessons", pendingLabel: "Loading more lessons…" };

function list(count: number) {
  return <ul>{Array.from({ length: count }, (_, index) => <li key={index}><a href={`/shadowing/l${index}`}>Lesson {index}</a></li>)}</ul>;
}

beforeEach(() => nav.push.mockReset());

describe("HubResultsPager", () => {
  it("loads the next page in place and moves focus to the first new card", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HubResultsPager count={2} more={more}>{list(2)}</HubResultsPager>);

    await user.click(screen.getByRole("link", { name: more.label }));
    expect(nav.push).toHaveBeenCalledWith(more.href, { scroll: false });

    rerender(<HubResultsPager count={4} more={{ ...more, href: "/pronunciation?shown=72" }}>{list(4)}</HubResultsPager>);
    expect(screen.getByRole("link", { name: "Lesson 2" })).toHaveFocus();
  });

  it("does not drop focus to the page top when the last page removes the link", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HubResultsPager count={2} more={more}>{list(2)}</HubResultsPager>);

    await user.click(screen.getByRole("link", { name: more.label }));
    rerender(<HubResultsPager count={3} more={null}>{list(3)}</HubResultsPager>);

    expect(screen.queryByRole("link", { name: more.label })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lesson 2" })).toHaveFocus();
  });

  it("leaves focus alone when the list changes for any other reason", () => {
    const { rerender } = render(<HubResultsPager count={2} more={more}>{list(2)}</HubResultsPager>);
    rerender(<HubResultsPager count={4} more={more}>{list(4)}</HubResultsPager>);
    expect(document.body).toHaveFocus();
  });

  it("keeps modified clicks for the browser (a new tab), so nothing is pushed", async () => {
    const user = userEvent.setup();
    render(<HubResultsPager count={2} more={more}>{list(2)}</HubResultsPager>);
    // jsdom cannot open a tab; stop the browser default after the component had its say.
    document.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: more.label }));
    expect(nav.push).not.toHaveBeenCalled();
  });
});
