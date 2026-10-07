import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { AvatarPicker } from "./avatar-picker";

const copy = en.edit.avatar;
const upload = (file: File) => userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText(copy.label), file);

describe("AvatarPicker", () => {
  it("passes a valid photo up", async () => {
    const onPick = vi.fn();
    render(<AvatarPicker canRemove={false} onPick={onPick} onRemove={vi.fn()} />);
    const file = new File(["x"], "a.webp", { type: "image/webp" });
    await upload(file);
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it("refuses a wrong type and an oversize file, with a message", async () => {
    const onPick = vi.fn();
    render(<AvatarPicker canRemove={false} onPick={onPick} onRemove={vi.fn()} />);
    await upload(new File(["x"], "a.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.errors.type);
    await upload(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.errors.size);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("shows Remove only when there is an uploaded photo to remove", async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<AvatarPicker canRemove={false} onPick={vi.fn()} onRemove={onRemove} />);
    expect(screen.queryByRole("button", { name: copy.remove })).toBeNull();
    rerender(<AvatarPicker canRemove onPick={vi.fn()} onRemove={onRemove} />);
    await userEvent.setup().click(screen.getByRole("button", { name: copy.remove }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
