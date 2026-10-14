import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { getReviewSummary } from "@/lib/data/dashboard/review";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/data/subscriptions", () => ({ getActivePlanTier: vi.fn() }));
vi.mock("@/lib/data/dashboard/review", () => ({ getReviewSummary: vi.fn() }));
vi.mock("@/lib/profile/avatar-url", () => ({ resolveAvatarUrl: vi.fn() }));

import { getNavSummary } from "./nav-summary";

const user = { id: "u1", email: "yuki.tanaka@example.com" };
function profile(row: { name: string | null; avatar_url: string | null; avatar_path?: string | null } | null, error: { message: string } | null = null) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    tables: { users: () => ({ data: row, error }) },
  }) as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(user as never);
  vi.mocked(getActivePlanTier).mockResolvedValue("plus");
  vi.mocked(getReviewSummary).mockResolvedValue({ href: "/kanji/review", due: 32 });
  // The real resolver's contract: a signed link for an upload, else the OAuth picture.
  vi.mocked(resolveAvatarUrl).mockImplementation(async ({ avatarPath, avatarUrl }) => (avatarPath ? `https://signed/${avatarPath}` : avatarUrl));
});

describe("getNavSummary", () => {
  it("returns null when signed out", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getNavSummary()).resolves.toBeNull();
  });
  it("assembles name, avatar, plan and review", async () => {
    profile({ name: "Yuki Tanaka", avatar_url: "https://x/a.png" });
    await expect(getNavSummary()).resolves.toEqual({
      name: "Yuki Tanaka", avatarUrl: "https://x/a.png", plan: "plus", reviewDue: 32, reviewHref: "/kanji/review",
    });
  });
  it("shows an uploaded photo (avatar_path) over the OAuth picture, like Dashboard and Profile", async () => {
    profile({ name: "Yuki", avatar_url: "https://google/old.png", avatar_path: "u1/avatar.webp" });
    await expect(getNavSummary()).resolves.toMatchObject({ avatarUrl: "https://signed/u1/avatar.webp" });
    expect(resolveAvatarUrl).toHaveBeenCalledWith({ avatarPath: "u1/avatar.webp", avatarUrl: "https://google/old.png" });
  });
  it("falls back to the email local part and no avatar", async () => {
    profile({ name: "  ", avatar_url: null });
    await expect(getNavSummary()).resolves.toMatchObject({ name: "yuki.tanaka", avatarUrl: null });
  });
  it("hides the plan instead of guessing when the plan read fails", async () => {
    profile({ name: "Yuki", avatar_url: null });
    vi.mocked(getActivePlanTier).mockRejectedValue(new Error("db"));
    await expect(getNavSummary()).resolves.toMatchObject({ plan: null });
  });
  it("hides the badge and points at the library when the review read fails", async () => {
    profile({ name: "Yuki", avatar_url: null });
    vi.mocked(getReviewSummary).mockRejectedValue(new Error("rpc"));
    await expect(getNavSummary()).resolves.toMatchObject({ reviewDue: null, reviewHref: "/kanji" });
  });
  it("survives a profile read error with the email fallback", async () => {
    profile(null, { message: "boom" });
    await expect(getNavSummary()).resolves.toMatchObject({ name: "yuki.tanaka", avatarUrl: null });
  });
});
