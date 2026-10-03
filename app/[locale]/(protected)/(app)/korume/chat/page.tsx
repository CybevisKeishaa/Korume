import { z } from "zod";
import { KorumeChatPage } from "@/components/korume/korume-chat-page";
import { smallMemoryFor, getThread, listThreads } from "@/lib/data/korume";
import { korumeGate } from "@/lib/korume/gate";
import { unionGrounding } from "@/lib/korume/grounding";
import { redirect } from "@/lib/i18n";

const threadIdSchema = z.string().uuid();

/**
 * Korume Chat (spec §6.3). Gate first and fail closed; an unknown, malformed or unreadable `?thread` is a quiet
 * "not found" over free chat, never an error page. Only plain DTOs cross into the client component.
 */
export default async function KorumeChatRoute({ searchParams, params }: { searchParams: { thread?: string | string[] }; params: { locale: "en" | "vi" } }) {
  const gate = await korumeGate();
  if (gate.kind === "unauthorized") redirect({ href: "/login", locale: params.locale });
  if (gate.kind !== "ok") {
    return <KorumeChatPage detail={null} threads={[]} nextCursor={null} memory={null} disabled={gate.kind === "disabled"} unavailable={gate.kind === "unavailable"} notFound={false} />;
  }
  const requested = searchParams.thread;
  const threadId = threadIdSchema.safeParse(requested);
  const [result, threads] = await Promise.all([
    threadId.success ? getThread(threadId.data).catch(() => null) : null,
    listThreads(null).catch(() => null),
  ]);
  const detail = result?.kind === "ok" ? result.detail : null;
  const memory = await smallMemoryFor(gate.userId, unionGrounding(detail?.messages ?? []), gate.supabase);
  return (
    // Not keyed here: KorumeChatPage keys its conversation itself, so the thread a free chat creates is not remounted.
    <KorumeChatPage
      detail={detail}
      threads={threads?.kind === "ok" ? threads.threads : []}
      nextCursor={threads?.kind === "ok" ? threads.nextCursor : null}
      memory={memory}
      disabled={false}
      unavailable={false}
      notFound={requested !== undefined && detail === null}
    />
  );
}
