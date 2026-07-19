import { describe, expect, it } from "vitest";
import { NAMESPACES } from "@/lib/i18n/namespaces";
import { loadEnMessages } from "./messages";

describe("loadEnMessages", () => {
  it("returns one entry per declared namespace", () => {
    const messages = loadEnMessages();
    expect(Object.keys(messages).sort()).toEqual([...NAMESPACES].sort());
  });

  it("returns real message content, not empty objects", () => {
    const messages = loadEnMessages();
    expect(messages.common).toMatchObject({ appName: "Nihongo Cinema" });
  });
});
