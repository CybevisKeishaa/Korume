import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// Partial mock: only the two calls postConversationMessage makes into the AI
// port are stubbed (isAiEnabled gates entry; conversationReply produces the
// reply it inserts as the "ai" row). Everything else — AiError, types, the
// other exports — stays real.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    isAiEnabled: vi.fn(() => true),
    conversationReply: vi.fn(async () => ({ reply: "こんにちは!", truncated: false, model: "test-model" })),
  };
});

import { postConversationMessage } from "./conversation";

/** Registers the tables `postConversationMessage` touches on a happy path:
 * an owned, unended session; no prior messages; a resolvable profile level.
 * `onInsert` receives every `conversation_messages` insert's values, in call
 * order (user row first, then the AI reply row). */
function mockHappyPath(onInsert: (values: Record<string, unknown>) => void) {
  const supabase = createMockSupabase({
    user: { id: "u1" },
    tables: {
      conversation_sessions: () => ({
        data: { id: "s1", user_id: "u1", scenario_type: "free-talk", ended_at: null },
        error: null,
      }),
      users: () => ({ data: { level: "N5" }, error: null }),
      conversation_messages: (calls) => {
        const insert = calls.find((c) => c.op === "insert");
        if (insert) onInsert((insert as { values: Record<string, unknown> }).values);
        return { data: [], error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("postConversationMessage — pronunciation score persistence", () => {
  it("persists a supplied pronunciation score on the user message", async () => {
    const inserts: Record<string, unknown>[] = [];
    mockHappyPath((values) => inserts.push(values));

    await postConversationMessage({ sessionId: "s1", message: "こんにちは", pronunciationScore: 82.5 });

    const userInsert = inserts.find((row) => row.role === "user");
    expect(userInsert).toBeDefined();
    expect(userInsert).toMatchObject({ pronunciation_score: 82.5 });
  });

  it("writes null rather than omitting the column when no score was produced", async () => {
    const inserts: Record<string, unknown>[] = [];
    mockHappyPath((values) => inserts.push(values));

    await postConversationMessage({ sessionId: "s1", message: "こんにちは" });

    const userInsert = inserts.find((row) => row.role === "user");
    expect(userInsert).toMatchObject({ pronunciation_score: null });
  });

  it("never attaches a score to the AI's own message", async () => {
    const inserts: Record<string, unknown>[] = [];
    mockHappyPath((values) => inserts.push(values));

    await postConversationMessage({ sessionId: "s1", message: "こんにちは", pronunciationScore: 82.5 });

    const aiInsert = inserts.find((row) => row.role === "ai");
    expect(aiInsert).toBeDefined();
    expect(aiInsert).not.toHaveProperty("pronunciation_score");
  });
});
