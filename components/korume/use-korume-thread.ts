"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import type { KorumeMessageView, KorumeThreadDetail } from "@/lib/korume/types";

export interface DraftAnchor { videoId: string; lineId: string; span: { start: number; end: number } | null }

export type TurnNotice =
  | { kind: "free_daily_limit"; limit: number; resetsAt: string }
  | { kind: "plus_credits_exhausted"; resetsAt: string }
  | { kind: "slow_down"; retryAfterSeconds: number }
  | { kind: "resting" }
  | { kind: "conflict" }
  | { kind: "disabled" };

export interface PendingTurnState { turnId: string; text: string; status: "sending" | "running" | "retryable" | "failed" }

export interface KorumeThreadState {
  /** The client's draft id until the thread exists, then the same id (spec §4.1). */
  threadId: string;
  created: boolean;
  messages: KorumeMessageView[];
  pending: PendingTurnState | null;
  notice: TurnNotice | null;
}

export const POLL_MS = 2_000;
export const POLL_LIMIT_MS = 180_000;

const newId = () => crypto.randomUUID();

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try { return (await response.json()) as Record<string, unknown>; } catch { return {}; }
}

/** Notices that lock the composer until they clear. */
export const LOCKING_NOTICES: ReadonlySet<TurnNotice["kind"]> = new Set(["free_daily_limit", "plus_credits_exhausted", "disabled"]);

/**
 * One Korume conversation on the client — shared by the Shadowing sheet and `/korume/chat`. Nothing is written until
 * the first send; a lost response is retried with the SAME ids, so the server's idempotency (spec §4.1, §5.1) turns a
 * flaky network into one thread and one turn.
 */
export function useKorumeThread(init: { threadId?: string; anchor: DraftAnchor | null; initial?: KorumeThreadDetail }) {
  const locale = useLocale();
  const [state, setState] = useState<KorumeThreadState>(() => {
    const initial = init.initial;
    const pendingTurn = initial?.pendingTurns.at(-1);
    const pendingText = pendingTurn && initial?.messages.find((m) => m.role === "user" && m.turnId === pendingTurn.turnId)?.text;
    return {
      threadId: init.threadId ?? initial?.thread.id ?? newId(),
      created: Boolean(initial),
      messages: initial?.messages ?? [],
      pending: pendingTurn && pendingText ? { turnId: pendingTurn.turnId, text: pendingText, status: pendingTurn.status } : null,
      notice: null,
    };
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const anchorRef = useRef(init.anchor);
  const poll = useRef<{ timer: ReturnType<typeof setTimeout> | null; startedAt: number }>({ timer: null, startedAt: 0 });

  const stopPolling = useCallback(() => {
    if (poll.current.timer) clearTimeout(poll.current.timer);
    poll.current.timer = null;
  }, []);

  const pollOnce = useCallback(async (turnId: string) => {
    const { threadId } = stateRef.current;
    let detail: KorumeThreadDetail | null = null;
    try {
      const response = await fetch(`/api/korume/threads/${threadId}`, { cache: "no-store" });
      if (response.ok) detail = (await response.json()) as KorumeThreadDetail;
    } catch { /* a missed poll is retried on the next tick */ }
    if (stateRef.current.pending?.turnId !== turnId) return;
    const answered = detail?.messages.some((m) => m.role === "assistant" && m.turnId === turnId);
    const retryable = detail?.pendingTurns.some((p) => p.turnId === turnId && p.status === "retryable");
    if (detail && answered) {
      stopPolling();
      setState((s) => ({ ...s, messages: detail.messages, pending: null }));
      return;
    }
    if (retryable || Date.now() - poll.current.startedAt >= POLL_LIMIT_MS) {
      stopPolling();
      setState((s) => (s.pending?.turnId === turnId ? { ...s, pending: { ...s.pending, status: "retryable" } } : s));
      return;
    }
    poll.current.timer = setTimeout(() => void pollOnce(turnId), POLL_MS);
  }, [stopPolling]);

  const startPolling = useCallback((turnId: string) => {
    stopPolling();
    poll.current.startedAt = Date.now();
    poll.current.timer = setTimeout(() => void pollOnce(turnId), POLL_MS);
  }, [pollOnce, stopPolling]);

  useEffect(() => {
    const pending = stateRef.current.pending;
    if (pending?.status === "running") startPolling(pending.turnId);
    return stopPolling;
  }, [startPolling, stopPolling]);

  const fail = (turnId: string, notice: TurnNotice | null, keep: boolean) => setState((s) => ({
    ...s, notice,
    pending: keep && s.pending?.turnId === turnId ? { ...s.pending, status: notice ? "retryable" : "failed" } : keep ? s.pending : null,
  }));

  const ensureThread = useCallback(async (): Promise<boolean> => {
    if (stateRef.current.created) return true;
    const anchor = anchorRef.current;
    const response = await fetch("/api/korume/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: stateRef.current.threadId, ...(anchor ? { videoId: anchor.videoId, lineId: anchor.lineId, ...(anchor.span ? { span: anchor.span } : {}) } : {}) }),
    });
    if (response.ok) { setState((s) => ({ ...s, created: true })); stateRef.current = { ...stateRef.current, created: true }; return true; }
    if (response.status === 403) setState((s) => ({ ...s, notice: { kind: "disabled" }, pending: null }));
    return false;
  }, []);

  const submit = useCallback(async (turnId: string, text: string) => {
    setState((s) => ({ ...s, notice: null, pending: { turnId, text, status: "sending" } }));
    try {
      if (!(await ensureThread())) {
        setState((s) => (s.notice ? s : { ...s, pending: s.pending && { ...s.pending, status: "failed" } }));
        return;
      }
      const response = await fetch(`/api/korume/threads/${stateRef.current.threadId}/turns`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turnId, text, locale }),
      });
      const body = await readJson(response);
      switch (response.status) {
        case 200: {
          const message = body.message as KorumeMessageView;
          const user: KorumeMessageView = { id: `user:${turnId}`, turnId, role: "user", text, answer: null, grounding: null, createdAt: message.createdAt };
          setState((s) => ({ ...s, pending: null, messages: [...s.messages.filter((m) => m.turnId !== turnId), user, message] }));
          return;
        }
        case 202:
          setState((s) => ({ ...s, pending: { turnId, text, status: "running" } }));
          startPolling(turnId);
          return;
        case 402:
          fail(turnId, body.reason === "free_daily_limit"
            ? { kind: "free_daily_limit", limit: Number(body.limit), resetsAt: String(body.resetsAt) }
            : { kind: "plus_credits_exhausted", resetsAt: String(body.resetsAt) }, false);
          return;
        case 403: fail(turnId, { kind: "disabled" }, false); return;
        case 409: fail(turnId, { kind: "conflict" }, false); return;
        case 429: {
          const seconds = Math.max(1, Number(response.headers.get("Retry-After")) || 1);
          fail(turnId, body.error === "fuse_tripped" ? { kind: "resting" } : { kind: "slow_down", retryAfterSeconds: seconds }, true);
          return;
        }
        case 503: fail(turnId, { kind: "resting" }, true); return;
        default: fail(turnId, null, true);
      }
    } catch {
      // A lost response: the server may have done the work. Retrying with the same ids is always safe.
      fail(turnId, null, true);
    }
  }, [ensureThread, locale, startPolling]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || stateRef.current.pending?.status === "sending" || stateRef.current.pending?.status === "running") return;
    await submit(newId(), text);
  }, [submit]);

  const retry = useCallback(async () => {
    const pending = stateRef.current.pending;
    if (pending && (pending.status === "failed" || pending.status === "retryable")) await submit(pending.turnId, pending.text);
  }, [submit]);

  return { ...state, send, retry };
}
