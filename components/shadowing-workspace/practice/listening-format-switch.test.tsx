import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { ListeningFormatSwitch } from "./listening-format-switch";

const router = { replace: vi.fn() };
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router, usePathname: () => "/shadowing/video-1/listening" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("line=line-2&format=word_bank") }));

const radio = (name: string) => screen.getByRole("radio", { name });
const TO_TYPING = ["/shadowing/video-1/listening?line=line-2&format=typing", { scroll: false }];

describe("ListeningFormatSwitch", () => {
  beforeEach(() => router.replace.mockReset());

  it("is a radiogroup that switches only ?format=, keeping the other params, when nothing is in progress", () => {
    render(<ListeningFormatSwitch format="word_bank" inProgress={false} wordBankAvailable />);
    expect(screen.getByRole("radiogroup", { name: "Listening format" })).toBeInTheDocument();
    expect(radio("Word Bank")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(radio("Typing"));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(...TO_TYPING);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before discarding an attempt in progress: Cancel keeps the format, Confirm switches", () => {
    // The dialog's × is also labelled "Keep going"; tests click the visible button.
    render(<ListeningFormatSwitch format="word_bank" inProgress wordBankAvailable />);
    fireEvent.click(radio("Typing"));
    expect(screen.getByRole("dialog", { name: "Discard this attempt?" })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Keep going", { selector: "button" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(radio("Word Bank")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(radio("Typing"));
    fireEvent.click(screen.getByRole("button", { name: "Discard and switch" }));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(...TO_TYPING);
  });

  it("disables Word Bank on an unreliable line with the reason", () => {
    render(<ListeningFormatSwitch format="typing" inProgress={false} wordBankAvailable={false} />);
    expect(radio("Word Bank")).toBeDisabled();
    expect(radio("Word Bank")).toHaveAccessibleDescription("This sentence can't be split reliably, so it's Typing only");
    expect(radio("Typing")).toHaveAttribute("aria-checked", "true");
  });
});
