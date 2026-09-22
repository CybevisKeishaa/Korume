import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { OtpInput } from "./otp-input";

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const box = (index: number) => {
  const input = boxes()[index];
  if (!input) throw new Error(`Expected OTP box ${index + 1}`);
  return input;
};
const hidden = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>("input[name='token']");

describe("OtpInput (spec 5.2)", () => {
  it("renders six boxes in one labelled group", () => {
    render(<OtpInput name="token" errorId="token-error" />);

    expect(screen.getByRole("group", { name: "Verification code" })).toHaveAttribute(
      "aria-describedby",
      "token-error",
    );
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]).toHaveAccessibleName("Digit 1 of 6");
    expect(boxes()[0]).toHaveAttribute("autocomplete", "one-time-code");
    expect(boxes()[1]).not.toHaveAttribute("autocomplete", "one-time-code");
    boxes().forEach((box) => expect(box).toHaveAttribute("inputmode", "numeric"));
  });

  it("keeps boxes valid when they only describe an error", () => {
    render(<OtpInput name="token" errorId="token-error" />);

    boxes().forEach((input) => expect(input).not.toHaveAttribute("aria-invalid", "true"));
  });

  it("marks every box invalid when invalid is true", () => {
    const invalidProps = { invalid: true };
    render(<OtpInput name="token" errorId="token-error" {...invalidProps} />);

    boxes().forEach((input) => expect(input).toHaveAttribute("aria-invalid", "true"));
  });

  it("discards non-digits and advances on a digit", async () => {
    const user = userEvent.setup();
    render(<OtpInput name="token" />);

    await user.type(box(0), "a");
    expect(boxes()[0]).toHaveValue("");
    await user.type(box(0), "4");
    expect(boxes()[0]).toHaveValue("4");
    expect(boxes()[1]).toHaveFocus();
  });

  it("backspace in an empty box clears and focuses the previous box", async () => {
    const user = userEvent.setup();
    render(<OtpInput name="token" />);

    await user.type(box(0), "12");
    expect(boxes()[2]).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(boxes()[1]).toHaveFocus();
    expect(boxes()[1]).toHaveValue("");
  });

  it("distributes a paste from the focused box, stripping non-digits", async () => {
    const user = userEvent.setup();
    const { container } = render(<OtpInput name="token" />);

    boxes()[1]?.focus();
    await user.paste("9-8 7a");

    expect(boxes().map((box) => box.value)).toEqual(["", "9", "8", "7", "", ""]);
    expect(boxes()[4]).toHaveFocus();
    expect(hidden(container)).toHaveValue("987");
  });

  it("distributes a six-digit input event with no paste event", () => {
    const onComplete = vi.fn();
    const { container } = render(<OtpInput name="token" onComplete={onComplete} />);

    fireEvent.change(box(0), { target: { value: "123456" } });

    expect(boxes().map((box) => box.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(hidden(container)).toHaveValue("123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("completes a full pasted code and leaves final focus to its parent", async () => {
    const user = userEvent.setup();
    function CompletionHost() {
      const submit = useRef<HTMLButtonElement>(null);
      return (
        <>
          <OtpInput name="token" onComplete={() => submit.current?.focus()} />
          <button ref={submit} type="button">
            Verify email
          </button>
        </>
      );
    }

    const { container } = render(<CompletionHost />);
    box(0).focus();
    await user.paste("123456");

    expect(hidden(container)).toHaveValue("123456");
    expect(screen.getByRole("button", { name: "Verify email" })).toHaveFocus();
  });

  it("truncates at six and never completes an incomplete value", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OtpInput name="token" onComplete={onComplete} />);

    boxes()[3]?.focus();
    await user.paste("98765");

    expect(boxes().map((box) => box.value)).toEqual(["", "", "", "9", "8", "7"]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("replaces a digit and advances instead of distributing the old value", () => {
    render(<OtpInput name="token" />);

    fireEvent.change(box(0), { target: { value: "1" } });
    fireEvent.change(box(0), { target: { value: "4" } });

    expect(boxes().map((box) => box.value)).toEqual(["4", "", "", "", "", ""]);
    expect(boxes()[1]).toHaveFocus();
  });

  it("leaves final focus to its parent after completing the code", () => {
    function CompletionHost() {
      const submit = useRef<HTMLButtonElement>(null);
      return (
        <>
          <OtpInput name="token" onComplete={() => submit.current?.focus()} />
          <button ref={submit} type="button">
            Verify email
          </button>
        </>
      );
    }

    render(<CompletionHost />);
    fireEvent.change(box(0), { target: { value: "123456" } });

    expect(screen.getByRole("button", { name: "Verify email" })).toHaveFocus();
  });
});
