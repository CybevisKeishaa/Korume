import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Harness() {
  return (
    <Tabs defaultValue="queue">
      <TabsList aria-label="Peer review">
        <TabsTrigger value="queue">Queue</TabsTrigger>
        <TabsTrigger value="mine">Mine</TabsTrigger>
      </TabsList>
      <TabsContent value="queue">queue panel</TabsContent>
      <TabsContent value="mine">mine panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders the tablist pattern with only the active panel visible", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Peer review" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("queue panel")).toBeInTheDocument();
    expect(screen.queryByText("mine panel")).not.toBeInTheDocument();
  });

  it("switches panels on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Mine" }));
    expect(screen.getByText("mine panel")).toBeInTheDocument();
    expect(screen.queryByText("queue panel")).not.toBeInTheDocument();
  });

  it("moves selection with arrow keys (roving tabindex)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Queue" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true");
    // Only the focused tab is in the Tab order (roving tabindex).
    expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute("tabindex", "-1");
  });
});
