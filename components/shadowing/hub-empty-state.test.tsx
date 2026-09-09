import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubEmptyState } from "./hub-empty-state";

describe("HubEmptyState", () => {
  it("explains an absent source and exposes only an action its parent supplies", () => {
    render(
      <HubEmptyState
        title="Your lessons will appear here"
        body="Import a lesson to begin building your library."
        action={<a href="#hub-import">Import a lesson</a>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your lessons will appear here" })).toBeInTheDocument();
    expect(screen.getByText("Import a lesson to begin building your library.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import a lesson" })).toHaveAttribute("href", "#hub-import");
  });
});
