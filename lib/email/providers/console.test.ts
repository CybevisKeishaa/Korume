import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConsoleProvider } from "./console";

describe("createConsoleProvider", () => {
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });
  afterEach(() => info.mockRestore());

  it("is named console", () => {
    expect(createConsoleProvider().name).toBe("console");
  });

  it("logs the message once and returns a generated id", async () => {
    const provider = createConsoleProvider();
    const result = await provider.send({
      to: "learner@example.com",
      subject: "Your deletion request",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.join(" ")).toContain("learner@example.com");
    expect(info.mock.calls[0]?.join(" ")).toContain("Your deletion request");
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns a distinct id per send", async () => {
    const provider = createConsoleProvider();
    const first = await provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" });
    const second = await provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" });
    expect(first.id).not.toBe(second.id);
  });
});
