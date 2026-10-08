import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { resolveAvatarUrl } from "./avatar-url";

const createSignedUrl = vi.fn();
const from = vi.fn(() => ({ createSignedUrl }));

beforeEach(() => {
  vi.resetAllMocks();
  from.mockImplementation(() => ({ createSignedUrl }));
  vi.mocked(createServiceClient).mockReturnValue({ storage: { from } } as unknown as ReturnType<typeof createServiceClient>);
});

describe("resolveAvatarUrl", () => {
  it("signs the private object for an hour and prefers it over the OAuth picture", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/a.webp" }, error: null });
    expect(await resolveAvatarUrl({ avatarPath: "u/profile/a.webp", avatarUrl: "https://x" })).toBe("https://signed/a.webp");
    expect(from).toHaveBeenCalledWith("avatars");
    expect(createSignedUrl).toHaveBeenCalledWith("u/profile/a.webp", 3600);
  });

  it("falls back to the OAuth picture when signing fails or throws", async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    expect(await resolveAvatarUrl({ avatarPath: "u/profile/a.webp", avatarUrl: "https://x" })).toBe("https://x");
    createSignedUrl.mockRejectedValueOnce(new Error("network"));
    expect(await resolveAvatarUrl({ avatarPath: "u/profile/a.webp", avatarUrl: "https://x" })).toBe("https://x");
  });

  it("uses the OAuth picture, or null, when there is no uploaded path (and never signs)", async () => {
    expect(await resolveAvatarUrl({ avatarPath: null, avatarUrl: "https://x" })).toBe("https://x");
    expect(await resolveAvatarUrl({ avatarPath: null, avatarUrl: null })).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
