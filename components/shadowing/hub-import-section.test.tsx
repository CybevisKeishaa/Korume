import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { HubImportSection } from "./hub-import-section";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const labels = {
  eyebrow: "Import lesson from YouTube",
  title: "Turn any Japanese video into an interactive lesson.",
  body: "Paste a YouTube link to create a lesson with vocabulary, grammar, and shadowing practice.",
  support: "Japanese dialogue and subtitles improve lesson quality.",
  freePlan: "Free plan",
  importsRemaining: "Imports remaining",
  quotaUnlimited: "Your plan has room for every lesson.",
};

describe("HubImportSection", () => {
  it("shows the Figma import hierarchy with the free learner's actual remaining quota", () => {
    render(<HubImportSection used={3} limit={5} tier="free" labels={labels} />);

    expect(screen.getByText("Import lesson from YouTube")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Turn any Japanese video into an interactive lesson." })).toBeInTheDocument();
    expect(screen.getByText("Paste a YouTube link to create a lesson with vocabulary, grammar, and shadowing practice.")).toBeInTheDocument();
    expect(screen.getByText("Japanese dialogue and subtitles improve lesson quality.")).toBeInTheDocument();
    expect(screen.getByText("Free plan")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "2 / 5")).toBeInTheDocument();
    expect(screen.getByText("Imports remaining")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import video" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Turn any Japanese video into an interactive lesson." })).toHaveAttribute("id", "hub-import");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("does not invent a limit for a Plus learner", () => {
    render(<HubImportSection used={18} limit={null} tier="plus" labels={labels} />);

    expect(screen.getByText("Your plan has room for every lesson.")).toBeInTheDocument();
    expect(screen.queryByText(/imports remaining/i)).not.toBeInTheDocument();
  });
});
