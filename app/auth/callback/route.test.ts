import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession } }),
}));

const call = async (query: string) =>
  (await GET(new Request(`http://localhost:3000/auth/callback?${query}`))).headers.get("location");

describe("auth callback", () => {
  beforeEach(() => exchangeCodeForSession.mockReset());

  it("forwards a successful exchange to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await call("code=c&next=/en/reset-password")).toBe("http://localhost:3000/en/reset-password");
  });

  it("sends a failed recovery link to the reset page's expired state, not login", async () => {
    // Link opened in another browser (no PKCE verifier) or already expired.
    exchangeCodeForSession.mockResolvedValue({ error: new Error("code verifier missing") });
    expect(await call("code=c&next=/en/reset-password")).toBe("http://localhost:3000/en/reset-password");
    expect(await call("error=access_denied&next=/vi/reset-password")).toBe(
      "http://localhost:3000/vi/reset-password",
    );
  });

  it("keeps every other failure on login", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad") });
    expect(await call("code=c&next=/en/dashboard")).toBe("http://localhost:3000/en/login?error=auth");
  });
});
