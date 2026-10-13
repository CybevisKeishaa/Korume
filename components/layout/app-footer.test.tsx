import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/test/render";
import { AppFooter } from "./app-footer";
import { getNewsletterState } from "@/lib/data/newsletter";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import en from "@/messages/en/marketing.json";

vi.mock("@/lib/data/newsletter", () => ({ getNewsletterState: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const f = en.footer;
const a = en.appFooter;

/** Spec F3 (owner 2026-10-13): every frame label is a link. Home is /dashboard, not the landing. */
const LINKS: ReadonlyArray<readonly [string, string]> = [
  [f.columns.explore.home, "/en/dashboard"],
  [f.columns.explore.roadmap, "/en/roadmap"],
  [f.columns.explore.contact, `mailto:${SUPPORT_EMAIL}`],
  [SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`],
  [f.mascot.cta, "/en/companion"],
];
/** No page of their own yet: the landing page until each exists. */
const PLACEHOLDERS = [
  f.columns.explore.pricing, f.columns.explore.faq, f.columns.explore.blog, f.columns.explore.about,
  f.columns.explore.careers, f.columns.community.discord, f.columns.community.facebook,
  f.columns.community.tiktok, f.columns.legal.privacy, f.columns.legal.terms,
] as const;

async function renderFooter(state: Awaited<ReturnType<typeof getNewsletterState>>) {
  vi.mocked(getNewsletterState).mockResolvedValue(state);
  return render(await AppFooter());
}

describe("AppFooter (spec F3, L1, T1)", () => {
  it("links every frame label to its F3 destination", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    for (const [name, href] of LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    for (const name of PLACEHOLDERS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", "/en");
    }
    expect(screen.getByRole("link", { name: new RegExp(en.footer.app.appStore.name) })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("link", { name: new RegExp(en.footer.app.playStore.name) })).toHaveAttribute("href", PLAY_STORE_URL);
    // Exact: nothing else (e.g. the settings link of a subscribed learner) is rendered.
    expect(screen.getAllByRole("link")).toHaveLength(LINKS.length + PLACEHOLDERS.length + 2);
  });

  it("keeps the frame's small note as text", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    expect(screen.getByRole("heading", { level: 2, name: a.note.heading })).toBeInTheDocument();
    expect(screen.getByText(a.note.body)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: a.note.body })).toBeNull();
  });

  it("has three sections and the frame's bottom band", async () => {
    const { container } = await renderFooter({ email: "learner@example.com", optedIn: false });
    const footer = container.querySelector("footer[data-app-footer]");
    expect(footer).not.toHaveAttribute("aria-label");
    expect(footer?.querySelectorAll(".app-footer__row > *")).toHaveLength(3);
    for (const heading of [f.columns.explore.heading, f.columns.community.heading, f.columns.support.heading, f.columns.legal.heading]) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(a.closing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(f.backToTop) })).toBeInTheDocument();
  });

  it("marks only the L2b-reducible elements, in their fixed order", async () => {
    const { container } = await renderFooter({ email: "learner@example.com", optedIn: false });
    const marked = [...container.querySelectorAll("[data-footer-reducible]")].map((el) => el.getAttribute("data-footer-reducible"));
    expect(marked.sort()).toEqual(["1", "2", "3"]);
    expect(container.querySelector('[data-footer-reducible="1"]')).toHaveTextContent(a.app.body);
    expect(container.querySelector('[data-footer-reducible="2"]')).toHaveTextContent(a.tagline);
    expect(container.querySelector('[data-footer-reducible="3"]')).toHaveAttribute("href", "/en/companion");
  });

  it("omits the newsletter form when there is no signed-in user", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    expect(screen.getByRole("button", { name: a.newsletter.submit })).toBeInTheDocument();
    cleanup();
    await renderFooter(null);
    expect(screen.queryByRole("button", { name: a.newsletter.submit })).toBeNull();
  });
});
