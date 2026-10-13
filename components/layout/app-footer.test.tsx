import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
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

/** Spec F3: interactive elements and their destinations. Home is /dashboard, not the landing. */
const LINKS: ReadonlyArray<readonly [string, string]> = [
  [f.columns.explore.home, "/en/dashboard"],
  [f.columns.explore.roadmap, "/en/roadmap"],
  [f.columns.explore.contact, `mailto:${SUPPORT_EMAIL}`],
  [f.mascot.cta, "/en/companion"],
];
/** Spec F3: kept as text. */
const TEXT_ONLY = [f.columns.legal.privacy, f.columns.legal.terms] as const;
/** Spec F3 round 3: not rendered at all. */
const CUT = [
  f.columns.explore.pricing, f.columns.explore.faq, f.columns.explore.blog, f.columns.explore.about,
  f.columns.explore.careers, f.columns.community.discord, f.columns.community.facebook,
  f.columns.community.tiktok, f.columns.community.heading, SUPPORT_EMAIL,
] as const;

async function renderFooter(state: Awaited<ReturnType<typeof getNewsletterState>>) {
  vi.mocked(getNewsletterState).mockResolvedValue(state);
  return render(await AppFooter());
}

describe("AppFooter (spec F3, L1, T1)", () => {
  it("links exactly the F3 destinations", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    for (const [name, href] of LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: new RegExp(en.footer.app.appStore.name) })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("link", { name: new RegExp(en.footer.app.playStore.name) })).toHaveAttribute("href", PLAY_STORE_URL);
  });

  it("keeps Legal as text and renders none of the cut labels", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    for (const label of TEXT_ONLY) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
    for (const label of CUT) expect(screen.queryByText(label)).toBeNull();
  });

  it("has three sections and the frame's bottom band", async () => {
    const { container } = await renderFooter({ email: "learner@example.com", optedIn: false });
    const footer = container.querySelector("footer[data-app-footer]");
    expect(footer).toHaveAttribute("aria-label", a.ariaLabel);
    expect(footer?.querySelectorAll(".app-footer__row > *")).toHaveLength(3);
    for (const heading of [f.columns.explore.heading, f.columns.support.heading, f.columns.legal.heading]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
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
    await renderFooter(null);
    expect(screen.queryByRole("button", { name: a.newsletter.submit })).toBeNull();
  });
});
