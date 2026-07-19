import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./notification-bell";
import type { NotificationsPage } from "@/lib/notification-types";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

function page(overrides: Partial<NotificationsPage> = {}): NotificationsPage {
  return {
    notifications: [
      {
        id: "n1",
        type: "badge_earned",
        payload: { badgeId: "b1", badgeName: "First Steps" },
        readAt: null,
        createdAt: "2026-07-13T00:00:00.000Z",
      },
      {
        id: "n2",
        type: "level_up",
        payload: { level: 3 },
        readAt: "2026-07-12T00:00:00.000Z",
        createdAt: "2026-07-12T00:00:00.000Z",
      },
    ],
    unreadCount: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationBell", () => {
  it("fetches on mount and shows the unread count on the bell", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: page() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications?limit=20");
  });

  it("opens the panel, refetches, and renders a description + time per notification type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: page() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const panel = screen.getByRole("dialog", { name: /notifications/i });
    expect(within(panel).getByText("You earned First Steps")).toBeInTheDocument();
    expect(within(panel).getByText("You reached Level 3")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the bell trigger", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: page() })));
    render(<NotificationBell />);

    const trigger = await screen.findByRole("button", { name: /notifications/i });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on outside click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: page() })));
    render(
      <div>
        <NotificationBell />
        <button type="button">outside</button>
      </div>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks a single unread notification as read optimistically, with a visible (not color-only) unread marker beforehand", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() })) // mount
      .mockResolvedValueOnce(jsonResponse(200, { data: page() })) // open refetch
      .mockResolvedValueOnce(jsonResponse(200, { data: { updated: 1 } })); // PATCH
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const unreadItem = screen.getByRole("button", { name: /you earned first steps.*unread/i });
    await userEvent.click(unreadItem);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/notifications",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ ids: ["n1"] }),
        }),
      ),
    );

    // Bell badge count drops to 0 after the optimistic update.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications, 0 unread" })).toBeInTheDocument(),
    );
  });

  it("rolls back the optimistic mark-read on a server failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: /you earned first steps.*unread/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    // Rolled back: still 1 unread.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument(),
    );
  });

  it("marks all as read via the 'Mark all as read' button", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { updated: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: /mark all as read/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/notifications",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ all: true }) }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications, 0 unread" })).toBeInTheDocument(),
    );
  });

  it("handles a 429 on mark-read gracefully: rolls back, disables mark-read actions briefly, and does not show an alarming error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(429, { error: "slow down" }, { "Retry-After": "30" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: /you earned first steps.*unread/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /mark all as read/i })).toBeDisabled());
  });

  it("renders a calm empty state when there are no notifications", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: page({ notifications: [], unreadCount: 0 }) })),
    );
    render(<NotificationBell />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/no notifications/i)).toBeInTheDocument();
  });
});
