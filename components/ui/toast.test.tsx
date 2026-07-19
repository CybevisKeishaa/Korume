import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { ToastProvider, useToast } from "./toast";

function Demo() {
  const { toast } = useToast();
  return (
    <button
      onClick={() =>
        toast({ title: "Card saved", description: "Added to your deck", variant: "success" })
      }
    >
      save
    </button>
  );
}

describe("Toast", () => {
  it("shows a toast with title and description when requested", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findByText("Card saved")).toBeInTheDocument();
    expect(screen.getByText("Added to your deck")).toBeInTheDocument();
  });

  it("dismisses via the close button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("Card saved");
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    // Radix's Close click removes the toast synchronously under jsdom (no
    // exit animation to await), so by the time we'd call
    // waitForElementToBeRemoved its precondition (element still present) is
    // already false and it throws. waitFor asserting absence keeps the same
    // meaning — "the toast is gone after dismiss" — without that race.
    await waitFor(() => {
      expect(screen.queryByText("Card saved")).not.toBeInTheDocument();
    });
  });

  it("stacks multiple toasts", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findAllByText("Card saved")).toHaveLength(2);
  });

  it("useToast outside the provider throws a helpful error", () => {
    // Silence React's error boundary noise for the expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Demo />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it("falls back to the English default dismiss label when dismissLabel is omitted", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("Card saved");
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeInTheDocument();
  });

  it("honours a passed dismissLabel as the dismiss control's accessible name", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider dismissLabel="Bỏ qua thông báo">
        <Demo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("Card saved");
    expect(screen.getByRole("button", { name: "Bỏ qua thông báo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss notification" })).not.toBeInTheDocument();
  });
});
