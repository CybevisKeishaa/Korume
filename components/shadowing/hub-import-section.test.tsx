import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { HubImportSection } from "./hub-import-section";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const labels = {
  title: "Bring a lesson into your library",
  quotaUnlimited: "Your plan has room for every lesson.",
  quotaUsed: (used: number, limit: number) => `${used} of ${limit} places are used this month.`,
};

describe("HubImportSection", () => {
  it("shows the free learner's actual monthly quota beside the import control", () => {
    render(<HubImportSection used={3} limit={5} tier="free" labels={labels} />);

    expect(screen.getByRole("heading", { name: "Bring a lesson into your library" })).toBeInTheDocument();
    expect(screen.getByText("3 of 5 places are used this month.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import video" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bring a lesson into your library" })).toHaveAttribute("id", "hub-import");
  });

  it("does not invent a limit for a Plus learner", () => {
    render(<HubImportSection used={18} limit={null} tier="plus" labels={labels} />);

    expect(screen.getByText("Your plan has room for every lesson.")).toBeInTheDocument();
    expect(screen.queryByText(/18 of/i)).not.toBeInTheDocument();
  });
});
