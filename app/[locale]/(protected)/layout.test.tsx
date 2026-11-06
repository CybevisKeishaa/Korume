import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ hasPublicSupabaseEnv: () => true }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("@/lib/data/preferences", () => ({ getMyPreferences: async () => null }));
vi.mock("@/lib/time/study-timezone", () => ({
  getStudyTimezone: vi.fn().mockRejectedValue({ message: "users read failed" }),
}));

import ProtectedLayout from "./layout";
import { KanjiInspectModal } from "@/components/kanji/kanji-inspect-modal";

describe("ProtectedLayout", () => {
  it("renders the session with timezone detection disabled after a failed read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await ProtectedLayout({ children: <p>study</p> });
    const provider = result.props.children[1];
    const detector = provider.props.children[0];
    expect(detector.props.needsDetection).toBe(false);
    const [page, modal] = provider.props.children[1].props.children;
    expect(page.props.children).toBe("study");
    // The ?kanji= inspect modal rides the same session boundary, in its own Suspense (port-kanji spec §5.1).
    expect(modal.props.children.type).toBe(KanjiInspectModal);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
