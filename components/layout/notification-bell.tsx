"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { describeNotification, formatRelativeTime } from "@/lib/notification-format";
import { useUnreadIncreasePulse } from "@/components/layout/use-unread-increase-pulse";
import type { NotificationRow, NotificationsPage } from "@/lib/notification-types";

const LIST_URL = "/api/notifications?limit=20";
const MUTATE_URL = "/api/notifications";

type LoadState = { status: "idle" | "loading" } | { status: "error"; message: string };

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M10 2a5 5 0 00-5 5v2.2c0 .5-.15 1-.44 1.4L3.2 12.6A1 1 0 004 14.3h12a1 1 0 00.8-1.7l-1.36-2c-.3-.4-.44-.9-.44-1.4V7a5 5 0 00-5-5z" />
      <path d="M8.2 16.4a1.9 1.9 0 003.6 0h-3.6z" />
    </svg>
  );
}

/**
 * Notification bell + inbox panel (Layer 6, CLAUDE.md §5). Lives in the app
 * shell (`AppNav`). Data flow:
 * - Fetches `GET /api/notifications` once on mount (populates the unread
 *   badge immediately) and again whenever the panel opens (picks up anything
 *   new since mount). No interval polling — this is a single long-running
 *   Node instance (deploy-host-almostgone.vn memory note), so we stay gentle
 *   and event-driven rather than hammering it on a timer.
 * - "Mark read" (single item or all) is optimistic: the UI updates
 *   immediately, then `PATCH /api/notifications` confirms it. A non-2xx
 *   response rolls the optimistic change back. A 429 rolls back too but
 *   shows no error text (CLAUDE.md/product principle G3 — no nag/alarm UI)
 *   and just disables mark-read actions until the `Retry-After` window
 *   passes.
 *
 * Keyboard/focus follows this repo's existing popover precedent
 * (`components/reading/word-lookup-popover.tsx`): Escape closes and returns
 * focus to the trigger, an outside click closes, and opening moves focus
 * into the panel.
 *
 * Motion (Layer 6, motion-engineer): the panel gets a light `.panel-in`
 * fade + rise on open (plain CSS keyframe, see `app/globals.css`); it has no
 * matching exit animation — closing is a plain unmount, which keeps this
 * light rather than reaching for `AnimatePresence` for a repeated,
 * low-stakes popover. The unread-count badge gets a single, non-looping
 * `.badge-pulse` scale bump the moment the count *rises while mounted*
 * (a new notification arriving) — never on the initial load's reveal — via
 * `useUnreadIncreasePulse`. Both are plain CSS animations, so they're
 * kill-switched globally by `[data-reduce-motion]` / `prefers-reduced-motion`.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [mutateError, setMutateError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const panelId = useId();
  const headingId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();
  const pulseKey = useUnreadIncreasePulse(unreadCount);

  const load = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const res = await fetch(LIST_URL);
      if (!res.ok) {
        setLoadState({ status: "error", message: "Could not load notifications." });
        return;
      }
      const body = (await res.json()) as { data: NotificationsPage };
      setNotifications(body.data.notifications);
      setUnreadCount(body.data.unreadCount);
      setLoadState({ status: "idle" });
    } catch {
      setLoadState({ status: "error", message: "Could not load notifications." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(cooldownTimer.current), []);

  function startCooldown(retryAfterSeconds: number): void {
    setRateLimited(true);
    clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setRateLimited(false), retryAfterSeconds * 1000);
  }

  async function mutate(body: { ids: string[] } | { all: true }): Promise<boolean> {
    setMutateError(null);
    try {
      const res = await fetch(MUTATE_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
        startCooldown(Number.isFinite(retryAfter) ? retryAfter : 60);
        return false;
      }
      if (!res.ok) {
        setMutateError("Couldn't update notifications — please try again.");
        return false;
      }
      return true;
    } catch {
      setMutateError("Couldn't update notifications — please try again.");
      return false;
    }
  }

  async function markOne(id: string): Promise<void> {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.readAt || rateLimited) return;

    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const ok = await mutate({ ids: [id] });
    if (!ok) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: null } : n)));
      setUnreadCount((prev) => prev + 1);
    }
  }

  async function markAll(): Promise<void> {
    if (unreadCount === 0 || rateLimited) return;

    const previous = notifications;
    const previousUnread = unreadCount;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);

    const ok = await mutate({ all: true });
    if (!ok) {
      setNotifications(previous);
      setUnreadCount(previousUnread);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            key={pulseKey}
            aria-hidden="true"
            className={cn(
              // `leading-none` (final whole-branch review F7, 2026-08-07):
              // `text-caption` is a paired size+line-height token
              // (`tailwind.config.ts`), so it also pulls in `--leading-caption`
              // (18px) — inside this fixed `h-4` (16px) pill that line box no
              // longer fits. The token-adoption pass that moved this off the
              // old arbitrary 10px font size only reasoned about the width
              // axis (`min-w-4` already flexes for 2-digit counts); the
              // height was pinned and needs the line-height silenced, not
              // grown, to stay a true circle at the 1-digit count.
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-caption font-bold leading-none text-danger-foreground",
              pulseKey > 0 && "badge-pulse",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={headingId}
          className="panel-in absolute right-0 top-full z-30 mt-2 w-80 max-w-[90vw] rounded-md border border-border bg-card p-3 text-left shadow-overlay"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={headingId} className="text-sm font-semibold">
              Notifications
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close notifications"
              className="shrink-0 rounded px-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {unreadCount} unread
            </p>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unreadCount === 0 || rateLimited}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary-strong hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
            >
              Mark all as read
            </button>
          </div>

          {loadState.status === "error" && (
            <p role="alert" className="mt-2 text-xs text-danger-strong">
              {loadState.message}
            </p>
          )}
          {mutateError && (
            <p role="alert" className="mt-2 text-xs text-danger-strong">
              {mutateError}
            </p>
          )}
          {rateLimited && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              Please wait a moment before marking more as read.
            </p>
          )}

          <div className="mt-2 max-h-80 overflow-y-auto">
            {notifications.length === 0 && loadState.status !== "loading" ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No notifications yet — you&apos;ll see badges, level-ups and review reminders here.
              </p>
            ) : (
              <ul className="space-y-1">
                {notifications.map((notification) => {
                  const unread = !notification.readAt;
                  const description = describeNotification(notification);
                  const time = formatRelativeTime(notification.createdAt);
                  const content = (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          unread ? "bg-primary" : "bg-transparent",
                        )}
                      />
                      <span className="flex-1">
                        <span className={cn("block text-sm", unread ? "font-semibold" : "text-foreground")}>
                          {description}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <time dateTime={notification.createdAt}>{time}</time>
                          {unread && <span className="font-medium text-primary-strong">· Unread</span>}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li key={notification.id}>
                      {unread ? (
                        <button
                          type="button"
                          onClick={() => void markOne(notification.id)}
                          disabled={rateLimited}
                          aria-label={`${description}, unread`}
                          className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-secondary disabled:pointer-events-none disabled:opacity-60"
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="flex items-start gap-2 rounded-md p-2">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
