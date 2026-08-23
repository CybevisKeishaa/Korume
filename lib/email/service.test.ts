import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setProviderForTesting } from "./registry";
import { sendEmail } from "./service";
import type { EmailProvider, RenderedEmail } from "./types";

const INPUT = {
  template: "account-deletion-requested",
  to: "learner@example.com",
  locale: "en",
  variables: {
    tier: "erase_all",
    executeAfter: "2026-08-27T10:00:00.000Z",
    cancelUrl: "https://app.korume.example/settings/privacy",
  },
} as const;

beforeEach(() => setProviderForTesting(null));
afterEach(() => setProviderForTesting(null));

describe("sendEmail", () => {
  it("renders the named template and sends it through the active provider", async () => {
    const received: { to: string; message: RenderedEmail }[] = [];
    const fake: EmailProvider = {
      name: "console",
      async send(message) {
        received.push({ to: message.to, message: { subject: message.subject, html: message.html, text: message.text } });
        return { id: "fixed-id" };
      },
    };
    setProviderForTesting(fake);

    const result = await sendEmail(INPUT);

    expect(result).toEqual({ status: "sent", id: "fixed-id", provider: "console" });
    expect(received).toHaveLength(1);
    expect(received[0]?.to).toBe("learner@example.com");
    expect(received[0]?.message.subject.length).toBeGreaterThan(0);
    expect(received[0]?.message.text).toContain("https://app.korume.example/settings/privacy");
  });

  it("returns skipped, not an error, when email is intentionally disabled", async () => {
    const result = await sendEmail(INPUT, { APP_ENV: "dev", EMAIL_PROVIDER: "none" });
    expect(result).toEqual({ status: "skipped" });
  });

  it("propagates a genuine provider failure rather than swallowing it", async () => {
    setProviderForTesting({
      name: "console",
      send: async () => {
        throw new Error("SMTP connection refused");
      },
    });

    await expect(sendEmail(INPUT)).rejects.toThrow("SMTP connection refused");
  });
});
