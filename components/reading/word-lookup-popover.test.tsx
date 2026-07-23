import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { WordLookupPopover } from "./word-lookup-popover";

describe("WordLookupPopover", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens on tap, shows the word + reading, and never calls fetch (add-to-flashcard is disabled with an explanation)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WordLookupPopover word="学生" reading="がくせい">
        学生
      </WordLookupPopover>,
    );

    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "学生" }));

    const popover = screen.getByRole("group", { name: /学生/ });
    expect(popover).toHaveTextContent("学生");
    expect(popover).toHaveTextContent("がくせい");

    const addButton = screen.getByRole("button", { name: /add to flashcard/i });
    expect(addButton).toBeDisabled();
    expect(screen.getByText(/adding flashcards from reading passages/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<WordLookupPopover word="今日">今日</WordLookupPopover>);

    const trigger = screen.getByRole("button", { name: "今日" });
    await userEvent.click(trigger);
    expect(screen.getByRole("group")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on outside click", async () => {
    render(
      <div>
        <WordLookupPopover word="今日">今日</WordLookupPopover>
        <button type="button">outside</button>
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: "今日" }));
    expect(screen.getByRole("group")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("renders a disabled, non-interactive trigger for an empty/whitespace word (e.g. a punctuation-only segment)", () => {
    render(<WordLookupPopover word=" ">{" "}</WordLookupPopover>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
