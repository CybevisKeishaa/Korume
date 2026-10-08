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

import EditProfileRoute from "./page";

beforeEach(() => {
  getProfile.mockReset();
  redirect.mockReset();
});

describe("/profile/edit route", () => {
  it("hands the view to the form as plain data (survives structuredClone)", async () => {
    const view = makeView();
    getProfile.mockResolvedValue({ ok: true, data: view });
    const element = await EditProfileRoute({ params: { locale: "en" } });
    const passed = (element as { props: { view: unknown } }).props.view;
    expect(structuredClone(passed)).toEqual(view);
  });

  it("redirects a 401 to the login page", async () => {
    getProfile.mockResolvedValue({ ok: false, status: 401 });
    await EditProfileRoute({ params: { locale: "en" } });
    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });
});
