import { describe, expect, it, vi } from "vitest";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  shell: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/data/shadowing-workspace", () => ({ loadWorkspaceBootstrap: mocks.load }));
vi.mock("@/lib/i18n/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/shadowing-workspace/workspace-shell", () => ({ ShadowingWorkspaceShell: mocks.shell }));

import ShadowingWorkspaceLayout from "./layout";

const bootstrap = { userId: "user-1" } as WorkspaceBootstrap;

describe("ShadowingWorkspaceLayout", () => {
  it("passes only the bootstrap and children through the server-client boundary", async () => {
    mocks.load.mockResolvedValue({ ok: true, data: bootstrap });
    const children = <p>workspace body</p>;

    const result = await ShadowingWorkspaceLayout({ children, params: { locale: "en", id: "video-1" } });

    expect(mocks.load).toHaveBeenCalledWith("video-1");
    expect(result.type).toBe(mocks.shell);
    expect(Object.keys(result.props).sort()).toEqual(["bootstrap", "children"]);
    expect(result.props).toEqual({ bootstrap, children });
  });

  it("redirects an unauthorized bootstrap request with the route locale", async () => {
    mocks.load.mockResolvedValue({ ok: false, status: 401 });
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });

    await expect(ShadowingWorkspaceLayout({ children: null, params: { locale: "vi", id: "video-1" } })).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith({ href: "/login", locale: "vi" });
  });

  it("uses the not-found boundary for a missing lesson", async () => {
    mocks.load.mockResolvedValue({ ok: false, status: 404 });
    mocks.notFound.mockImplementation(() => { throw new Error("missing"); });

    await expect(ShadowingWorkspaceLayout({ children: null, params: { locale: "en", id: "missing" } })).rejects.toThrow("missing");
  });
});
