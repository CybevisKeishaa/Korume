import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeView } from "@/components/profile/view-fixture";

const getProfile = vi.fn();
const redirect = vi.fn();

vi.mock("@/lib/data/profile", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  redirect: (arg: unknown) => redirect(arg),
}));

import ProfileRoute from "./page";

beforeEach(() => {
  getProfile.mockReset();
  redirect.mockReset();
});

describe("/profile route", () => {
  it("hands the view to the page unchanged after a JSON round trip (RSC plain data)", async () => {
    const view = makeView();
    getProfile.mockResolvedValue({ ok: true, data: view });
    const element = await ProfileRoute({ params: { locale: "en" } });
    const passed = (element as { props: { view: unknown } }).props.view;
    expect(passed).toEqual(JSON.parse(JSON.stringify(passed)));
    expect(passed).toEqual(view);
  });

  it("redirects a 401 to the login page", async () => {
    getProfile.mockResolvedValue({ ok: false, status: 401 });
    await ProfileRoute({ params: { locale: "en" } });
    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });
});
