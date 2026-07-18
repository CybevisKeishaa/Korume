import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { StyleGuide } from "./style-guide";

/**
 * Smoke coverage only: every section of the executable spec renders inside
 * the real providers. Behaviour of each primitive is covered by its own
 * test file; visual verification is the page's own job (D9).
 *
 * ToastProvider wraps the render because PrimitiveSections calls useToast();
 * ThemeProvider wraps it because ThemeToggle/ReduceMotionToggle call
 * useTheme(). The real page gets both from app/[locale]/layout.tsx, nested
 * in this same order (ThemeProvider > ToastProvider > children).
 */
function renderGuide() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StyleGuide />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("StyleGuide", () => {
  it("renders every section", () => {
    renderGuide();
    for (const heading of [
      "Colour",
      "Typography",
      "Spacing",
      "Elevation",
      "Motion",
      "Z-index",
      "Primitives",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("shows the locale-stress samples (VN diacritics + Japanese)", () => {
    renderGuide();
    // getAllByText, not getByText: the Vietnamese sample line is repeated
    // once per row of TYPE_SCALE in token-sections.tsx (by design — every
    // type-scale step demos the same stress string), so multiple matches
    // are expected here.
    expect(
      screen.getAllByText(/Học tiếng Nhật qua phim/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/映画で日本語を学ぶ/)).toBeInTheDocument();
  });

  it("demos every primitive", () => {
    renderGuide();
    for (const name of [
      "Button",
      "Badge",
      "Skeleton",
      "Dialog",
      "Tabs",
      "Select",
      "Tooltip",
      "Popover",
      "Toast",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});
