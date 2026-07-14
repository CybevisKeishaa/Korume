import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

// Imported after the mocks above are registered.
import { isAdmin, requireAdmin } from "./guard";

const USER = { id: "u1" };
const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

function mockAuthed(tables: Parameters<typeof createMockSupabase>[0]["tables"] = {}, user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
  delete process.env.ADMIN_EMAILS;
});

afterEach(() => {
  if (ORIGINAL_ADMIN_EMAILS === undefined) {
    delete process.env.ADMIN_EMAILS;
  } else {
    process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  }
});

describe("requireAdmin", () => {
  it("returns 401 when signed out", async () => {
    mockAuthed({}, null);
    const result = await requireAdmin();
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 403 when the user's profile row does not exist", async () => {
    mockAuthed();
    mockService({ users: () => ({ data: null, error: null }) });
    const result = await requireAdmin();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns ok when users.is_admin is already true, with no write attempted", async () => {
    mockAuthed();
    mockService({
      users: (calls: QueryCall[]) => {
        expect(eqValue(calls, "id")).toBe(USER.id);
        if (calls.some((c) => c.op === "update")) {
          throw new Error("must not write when already admin");
        }
        return { data: { id: USER.id, email: "admin@example.com", is_admin: true }, error: null };
      },
    });
    const result = await requireAdmin();
    expect(result).toEqual({ ok: true, user: { id: USER.id, email: "admin@example.com" } });
  });

  it("returns 403 when is_admin is false and ADMIN_EMAILS is unset", async () => {
    mockAuthed();
    mockService({
      users: () => ({ data: { id: USER.id, email: "nobody@example.com", is_admin: false }, error: null }),
    });
    const result = await requireAdmin();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns 403 when is_admin is false and the email is not on the ADMIN_EMAILS bootstrap list", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    mockAuthed();
    mockService({
      users: () => ({ data: { id: USER.id, email: "nobody@example.com", is_admin: false }, error: null }),
    });
    const result = await requireAdmin();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("bootstraps: promotes is_admin via ADMIN_EMAILS (case-insensitive, trimmed) then passes", async () => {
    process.env.ADMIN_EMAILS = " Founder@Example.com , other@example.com ";
    mockAuthed();
    let updatePayload: unknown;
    mockService({
      users: (calls: QueryCall[]) => {
        const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        if (updateCall) {
          updatePayload = updateCall.values;
          return { data: { id: USER.id }, error: null };
        }
        return { data: { id: USER.id, email: "founder@example.com", is_admin: false }, error: null };
      },
    });

    const result = await requireAdmin();
    expect(result).toEqual({ ok: true, user: { id: USER.id, email: "founder@example.com" } });
    expect(updatePayload).toEqual({ is_admin: true });
  });

  it("never trusts a client-supplied admin flag — only DB is_admin / ADMIN_EMAILS matter", async () => {
    // Nothing in this codebase can pass a flag into requireAdmin() at all (it
    // takes no arguments) — this test documents that contract explicitly so
    // a future refactor can't accidentally add a bypassable parameter.
    expect(requireAdmin.length).toBe(0);
  });
});

describe("isAdmin", () => {
  it("returns true when the row's is_admin is true", async () => {
    mockService({ users: () => ({ data: { is_admin: true }, error: null }) });
    expect(await isAdmin(USER.id)).toBe(true);
  });

  it("returns false when the row's is_admin is false", async () => {
    mockService({ users: () => ({ data: { is_admin: false }, error: null }) });
    expect(await isAdmin(USER.id)).toBe(false);
  });

  it("returns false when the row does not exist", async () => {
    mockService({ users: () => ({ data: null, error: null }) });
    expect(await isAdmin(USER.id)).toBe(false);
  });

  it("has no bootstrap side effect even when ADMIN_EMAILS matches", async () => {
    process.env.ADMIN_EMAILS = "someone@example.com";
    mockService({
      users: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "update")) {
          throw new Error("isAdmin must never write");
        }
        return { data: { is_admin: false }, error: null };
      },
    });
    expect(await isAdmin(USER.id)).toBe(false);
  });
});
