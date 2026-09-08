import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { HubImportSection } from "./hub-import-section";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("HubImportSection", () => {
  it("shows the free learner's actual monthly quota beside the import control", () => {
    render(<HubImportSection used={3} limit={5} tier="free" />);

    expect(screen.getByText("3 of 5 lesson imports used this month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import video" })).toBeInTheDocument();
  });

  it("does not invent a limit for a Plus learner", () => {
    render(<HubImportSection used={18} limit={null} tier="plus" />);

    expect(screen.getByText("Plus plan includes unlimited lesson imports.")).toBeInTheDocument();
    expect(screen.queryByText(/18 of/i)).not.toBeInTheDocument();
  });
});
