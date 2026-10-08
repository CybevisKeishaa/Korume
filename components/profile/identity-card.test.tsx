import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { IdentityCard } from "./identity-card";
import { makeView } from "./view-fixture";

const t = en.identity;
const model = (over = {}) => ({ ...makeView().identity, ...over });

describe("IdentityCard", () => {
  it("shows name, handle, bio and the identity rows with real names", () => {
    render(<IdentityCard identity={model()} variant="page" />);
    expect(screen.getByRole("heading", { name: "Keishaa" })).toBeInTheDocument();
    expect(screen.getByText("@keishaa")).toBeInTheDocument();
    expect(screen.getByText("Learning slowly.")).toBeInTheDocument();
    expect(screen.getByText("Vietnam")).toBeInTheDocument();
    expect(screen.getByText("Vietnamese")).toBeInTheDocument();
    expect(screen.getByText("N2")).toBeInTheDocument();
    expect(screen.getByText(t.interface)).toBeInTheDocument();
    expect(screen.getByText("UTC+7")).toBeInTheDocument();
    expect(screen.getByText("Japanese + translation + furigana")).toBeInTheDocument();
  });

  it("omits the handle and every row whose value is missing or unknown", () => {
    render(<IdentityCard identity={model({ username: null, country: "ZZ", nativeLanguage: "xx", targetJlptLevel: "N9", bio: null })} variant="page" />);
    expect(screen.queryByText(/^@/)).toBeNull();
    expect(screen.queryByText(t.country)).toBeNull();
    expect(screen.queryByText(t.nativeLanguage)).toBeNull();
    expect(screen.queryByText(t.jlptGoal)).toBeNull();
    expect(screen.queryByText("ZZ")).toBeNull();
  });

  it("hides the since row while firstKnownLearningAt is null", () => {
    render(<IdentityCard identity={model({ firstKnownLearningAt: null })} variant="page" />);
    expect(screen.queryByText(/Learning with Korume since/)).toBeNull();
  });

  it("shows the since row with its month when known", () => {
    render(<IdentityCard identity={model()} variant="page" />);
    expect(screen.getByText("Learning with Korume since March 2026")).toBeInTheDocument();
  });

  it("uses the photo with its catalog alt, else a decorative initial", () => {
    const { rerender } = render(<IdentityCard identity={model({ avatarUrl: "https://x.test/a.webp" })} variant="page" />);
    expect(screen.getByAltText("Keishaa's photo")).toHaveAttribute("src", "https://x.test/a.webp");
    rerender(<IdentityCard identity={model()} variant="page" />);
    expect(screen.getByText("K")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the actions slot on the page and no card heading on the preview", () => {
    const { rerender } = render(<IdentityCard identity={model()} variant="page" actions={<a href="/x">{t.edit}</a>} />);
    expect(screen.getByRole("link", { name: t.edit })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    rerender(<IdentityCard identity={model()} variant="preview" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Keishaa")).toBeInTheDocument();
  });

  it("gives every identity row its decorative icon", () => {
    const { container } = render(<IdentityCard identity={model()} variant="page" />);
    const icons = Array.from(container.querySelectorAll("svg[data-profile-icon]")).map((n) => n.getAttribute("data-profile-icon"));
    expect(icons).toEqual(expect.arrayContaining(["country", "timeZone", "learningSince", "jlpt", "nativeLanguage", "interface", "subtitle"]));
    for (const svg of container.querySelectorAll("svg")) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("offers a change-photo link to the editor on the page only", () => {
    const { rerender } = render(<IdentityCard identity={model()} variant="page" />);
    expect(screen.getByRole("link", { name: t.changePhoto })).toHaveAttribute("href", expect.stringContaining("/profile/edit"));
    rerender(<IdentityCard identity={model()} variant="preview" />);
    expect(screen.queryByRole("link", { name: t.changePhoto })).toBeNull();
  });

  it("keeps the since sentence out of any term/definition list", () => {
    render(<IdentityCard identity={model()} variant="page" />);
    const row = screen.getByText("Learning with Korume since March 2026");
    expect(row.closest("dt")).toBeNull();
    expect(row.closest("dl")).toBeNull();
  });

  it("shows the interface row for an explicit interfaceLocale and a photo button only in the preview", async () => {
    const onChangePhoto = vi.fn();
    render(<IdentityCard identity={model({ nativeLanguage: null })} variant="preview" interfaceLocale="vi" onChangePhoto={onChangePhoto} />);
    expect(screen.getByText("Vietnamese")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: t.changePhoto }));
    expect(onChangePhoto).toHaveBeenCalledTimes(1);
  });
});
