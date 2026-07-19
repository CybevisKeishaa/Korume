"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  ConversationMessageRow,
  ConversationSessionRow,
  JlptLevel,
  ScenarioId,
  SessionEndResult,
} from "@/lib/conversation-types";
import { MessageBubble } from "./message-bubble";
import { ScenarioPicker, SCENARIOS } from "./scenario-picker";
import { SessionHistoryList } from "./session-history-list";
import { CorrectionsPanel } from "./corrections-panel";
import { blobToWav16kMono } from "@/lib/audio/blob-to-wav";
import { VoiceRecorderButton, type TranscribedVoiceMessage } from "./voice-recorder-button";

type View = "picker" | "chat";

interface SendError {
  message: string;
  /** Present only for a 429 — ticks down to 0, then clears itself. */
  retryAfterSeconds?: number;
}

interface PendingVoice {
  /** The exact recognized text this recording produced — scoring only fires
   * when the composer still holds this same text unedited at send time. */
  text: string;
  blob: Blob;
}

let localIdCounter = 0;
/** Client-only ids for optimistically-rendered messages (the message APIs
 * don't echo back row ids — see `postConversationMessage` in
 * `lib/data/conversation.ts`). Never sent to the server. */
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

const SESSION_ENDPOINT = "/api/conversation/session";
const MESSAGE_ENDPOINT = "/api/conversation/message";
const PRONUNCIATION_ENDPOINT = "/api/pronunciation/score";

function scenarioLabel(scenarioType: string | null): string {
  return SCENARIOS.find((s) => s.id === scenarioType)?.label ?? scenarioType ?? "Conversation";
}

function retryMessage(seconds: number): string {
  return `Too many messages — try again in ${seconds}s.`;
}

/**
 * Root orchestrator for the voice-conversation feature (spec §3.6 + §10.5,
 * CLAUDE.md §5.5): scenario/level picker → live chat (text + progressive
 * voice mode) → end-of-session corrections, plus a read-only view of past
 * sessions. Entirely client-rendered — every fetch targets `/api/conversation/*`,
 * `/api/speech/*`, and `/api/pronunciation/*` (all built by backend/ai-engineer);
 * this component owns no business logic of its own.
 */
export function ConversationApp() {
  const [view, setView] = useState<View>("picker");
  const [sessions, setSessions] = useState<ConversationSessionRow[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<JlptLevel | undefined>(undefined);
  const [ended, setEnded] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const [messages, setMessages] = useState<ConversationMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [pendingVoice, setPendingVoice] = useState<PendingVoice | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<SendError | null>(null);
  const [truncatedNotice, setTruncatedNotice] = useState(false);

  const [endState, setEndState] = useState<"idle" | "ending">("idle");
  const [corrections, setCorrections] = useState<SessionEndResult | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(SESSION_ENDPOINT);
      if (!res.ok) return;
      const json = (await res.json()) as { data: ConversationSessionRow[] };
      setSessions(json.data);
    } catch {
      // Best-effort: history is a convenience, never blocks starting a new session.
    } finally {
      setSessionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  function startCountdown(seconds: number) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setSendError({ message: retryMessage(seconds), retryAfterSeconds: seconds });
    countdownRef.current = setInterval(() => {
      setSendError((prev) => {
        if (!prev || prev.retryAfterSeconds == null) return prev;
        const next = prev.retryAfterSeconds - 1;
        if (next <= 0) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return null;
        }
        return { message: retryMessage(next), retryAfterSeconds: next };
      });
    }, 1000);
  }

  async function startSession(scenario: ScenarioId, level: JlptLevel | undefined) {
    setPickerError(null);
    try {
      const res = await fetch(SESSION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, ...(level ? { level } : {}) }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          setPickerError(
            retryAfter
              ? `Too many sessions — try again in ${retryAfter}s.`
              : "Too many sessions — please wait a moment and try again.",
          );
          return;
        }
        setPickerError(await friendlyErrorFrom(res, "Could not start a session."));
        return;
      }
      const json = (await res.json()) as { data: ConversationSessionRow };
      setActiveSessionId(json.data.id);
      setActiveScenario(json.data.scenario_type ?? scenario);
      setActiveLevel(level);
      setEnded(false);
      setReadOnly(false);
      setMessages([]);
      setCorrections(null);
      setEndState("idle");
      setSendError(null);
      setInput("");
      setPendingVoice(null);
      setView("chat");
    } catch {
      setPickerError("Network error — check your connection and try again.");
    }
  }

  async function openHistorySession(sessionId: string) {
    setActiveSessionId(sessionId);
    const session = sessions.find((s) => s.id === sessionId);
    setActiveScenario(session?.scenario_type ?? null);
    setReadOnly(true);
    setEnded(true);
    setMessages([]);
    setCorrections(null);
    setView("chat");
    try {
      const res = await fetch(`${SESSION_ENDPOINT}/${sessionId}`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: ConversationMessageRow[] };
      setMessages(json.data);
    } catch {
      // Best-effort — an empty transcript is still a valid (if unhelpful) state.
    }
  }

  function resetToPicker() {
    setView("picker");
    setActiveSessionId(null);
    setActiveScenario(null);
    setMessages([]);
    setCorrections(null);
    setEnded(false);
    setReadOnly(false);
    setSendError(null);
    setInput("");
    setPendingVoice(null);
    void loadSessions();
  }

  async function scoreVoiceMessage(localMessageId: string, voice: PendingVoice) {
    try {
      // Azure's short-audio endpoint accepts WAV/PCM, not the webm/opus the
      // recorder produced — convert just before upload (best-effort like the
      // rest of this function: a conversion failure only skips the score).
      const wav = await blobToWav16kMono(voice.blob);
      const formData = new FormData();
      formData.append("referenceText", voice.text);
      formData.append("audio", wav, "voice-message.wav");
      const res = await fetch(PRONUNCIATION_ENDPOINT, { method: "POST", body: formData });
      if (!res.ok) return; // optional feature — 503/429/etc. never disrupt the chat
      const json = (await res.json()) as { data: { pronunciationScore: number } };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === localMessageId ? { ...m, pronunciation_score: json.data.pronunciationScore } : m,
        ),
      );
    } catch {
      // Best-effort — see above.
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!activeSessionId || sending || sendError?.retryAfterSeconds) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    setSending(true);
    setSendError(null);
    setTruncatedNotice(false);

    const voice = pendingVoice && pendingVoice.text === trimmed ? pendingVoice : null;

    try {
      const res = await fetch(MESSAGE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: trimmed,
          ...(activeLevel ? { level: activeLevel } : {}),
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("Retry-After") ?? "60") || 60;
          startCountdown(retryAfter);
        } else {
          setSendError({ message: await friendlyErrorFrom(res, "Could not send message.") });
        }
        return;
      }

      const json = (await res.json()) as { data: { reply: string; truncated: boolean; model: string } };
      const userMessage: ConversationMessageRow = {
        id: nextLocalId(),
        role: "user",
        content: trimmed,
        pronunciation_score: null,
        created_at: new Date().toISOString(),
      };
      const aiMessage: ConversationMessageRow = {
        id: nextLocalId(),
        role: "ai",
        content: json.data.reply,
        pronunciation_score: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setInput("");
      setPendingVoice(null);
      if (json.data.truncated) setTruncatedNotice(true);
      if (voice) void scoreVoiceMessage(userMessage.id, voice);
    } catch {
      setSendError({ message: "Network error — check your connection and try again." });
    } finally {
      setSending(false);
    }
  }

  async function endSession() {
    if (!activeSessionId) return;
    setEndState("ending");
    setSendError(null);
    try {
      const res = await fetch(`${SESSION_ENDPOINT}/${activeSessionId}/end`, { method: "POST" });
      if (!res.ok) {
        setEndState("idle");
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          setSendError({
            message: retryAfter
              ? `Too many requests — try again in ${retryAfter}s.`
              : "Too many requests — please wait a moment and try again.",
          });
          return;
        }
        setSendError({ message: await friendlyErrorFrom(res, "Could not end the session.") });
        return;
      }
      const json = (await res.json()) as { data: SessionEndResult };
      setCorrections(json.data);
      setEnded(true);
      setEndState("idle");
      void loadSessions();
    } catch {
      setEndState("idle");
      setSendError({ message: "Network error — check your connection and try again." });
    }
  }

  function handleTranscribed(result: TranscribedVoiceMessage) {
    setInput(result.text);
    setPendingVoice({ text: result.text, blob: result.blob });
  }

  if (view === "picker") {
    return (
      <div className="space-y-10">
        <section aria-label="Start a conversation" className="space-y-4">
          <h2 className="text-lg font-semibold">Start a conversation</h2>
          <ScenarioPicker onStart={startSession} />
          {pickerError && (
            <p role="alert" className="text-sm text-danger-strong">
              {pickerError}
            </p>
          )}
        </section>

        <section aria-label="Past sessions" className="space-y-4">
          <h2 className="text-lg font-semibold">Past sessions</h2>
          {sessionsLoaded ? (
            <SessionHistoryList sessions={sessions} onSelect={openHistorySession} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-jp text-lg font-semibold">{scenarioLabel(activeScenario)}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={resetToPicker}>
          ← Back
        </Button>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-[320px] flex-col gap-2 rounded-lg border border-border p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {readOnly ? "This session has no messages." : "Say hello to get started."}
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {truncatedNotice && (
        <p role="status" className="text-xs text-muted-foreground">
          The AI reply was shortened to fit — it may be cut off.
        </p>
      )}

      {!ended && (
        <form onSubmit={sendMessage} className="space-y-2">
          <Label htmlFor="conversation-message" className="sr-only">
            Message
          </Label>
          <div className="flex items-end gap-2">
            <textarea
              id="conversation-message"
              value={input}
              onChange={(e) => {
                const next = e.target.value;
                setInput(next);
                if (pendingVoice && next !== pendingVoice.text) setPendingVoice(null);
              }}
              rows={2}
              disabled={sending}
              placeholder="Type your reply in Japanese…"
              className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            />
            <VoiceRecorderButton onTranscribed={handleTranscribed} disabled={sending} />
            <Button
              type="submit"
              disabled={sending || !input.trim() || Boolean(sendError?.retryAfterSeconds)}
            >
              Send
            </Button>
          </div>
          {pendingVoice && (
            <p className="text-xs text-muted-foreground">
              AI transcription — check before sending.
            </p>
          )}
          {sendError && (
            <p role="alert" className="text-sm text-danger-strong">
              {sendError.message}
            </p>
          )}
        </form>
      )}

      {!ended && !readOnly && (
        <Button type="button" variant="outline" onClick={endSession} disabled={endState === "ending"}>
          {endState === "ending" ? "Ending…" : "End session"}
        </Button>
      )}

      {ended && corrections && <CorrectionsPanel result={corrections} />}
    </div>
  );
}

/** Reads `{error}` off a JSON error response, falling back to `fallback` when
 * the body is missing/unparsable. Server error strings (see the route
 * `STATUS_MESSAGES` tables in `app/api/conversation/*`) are already
 * friendly/non-technical, so they're shown as-is. */
async function friendlyErrorFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}
