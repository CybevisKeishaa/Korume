/**
 * Dev/test adapter: logs the fully-rendered message instead of sending it.
 * Never legal in production (`lib/email/env.ts`'s schema forbids it) — this
 * is what lets a developer see what an email would say without a real
 * transport, and what lets tests assert on the rendered content deterministically.
 */
import type { EmailProvider } from "../types";

export function createConsoleProvider(): EmailProvider {
  return {
    name: "console",
    async send(message) {
      const id = crypto.randomUUID();
      console.info(`[email:console] to=${message.to} subject="${message.subject}" id=${id}\n${message.text}`);
      return { id };
    },
  };
}
