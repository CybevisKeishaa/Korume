import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccountMenu } from "./account-menu";

const ITEMS = [{ href: "/profile", key: "profile" }, { href: "/settings", key: "settings" }];
const SUMMARY = { name: "Yuki Tanaka", avatarUrl: null, plan: "free" as const, reviewDue: 3, reviewHref: "/kanji/review" };
function setup(collapsed = false) {
  render(<ThemeProvider><AccountMenu summary={SUMMARY} email="yuki@example.com" items={ITEMS} collapsed={collapsed} /></ThemeProvider>);
  return { user: userEvent.setup(), trigger: screen.getByRole("button", { name: "Yuki Tanaka's account" }) };
}

// RTL role queries are exact-match (no regex), so collect menuitem + menuitemcheckbox in DOM order.
const menuItems = () => Array.from(screen.getByRole("menu").querySelectorAll<HTMLElement>('[role^="menuitem"]'));

describe("AccountMenu", () => {
  it("is a closed menu button showing name and plan", () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("FREE")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("opens on Enter with focus on the first item, in order", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}");
    const items = menuItems();
    expect(items.map((el) => el.textContent)).toEqual(["Profile", "Settings", "Reduce motion", "Sign out"]);
    expect(items[0]).toHaveFocus();
  });
  it("moves with arrows, Home and End, and wraps", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const items = menuItems();
    await user.keyboard("{ArrowUp}");
    expect(items[3]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items[3]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
  });
  it("ArrowUp on the trigger opens on the last item", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  });
  it("Escape closes and returns focus to the trigger", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it("Tab and an outside click close it", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("Reduce motion is a real checkbox item bound to the theme state", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const item = screen.getByRole("menuitemcheckbox", { name: "Reduce motion" });
    expect(item).toHaveAttribute("aria-checked", "false");
    await user.click(item);
    expect(screen.getByRole("menuitemcheckbox", { name: "Reduce motion" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-reduce-motion", "true");
  });
  it("Sign out submits the existing POST form", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut).toHaveAttribute("type", "submit");
    expect(signOut.closest("form")).toHaveAttribute("action", "/auth/signout");
    expect(signOut.closest("form")).toHaveAttribute("method", "post");
  });
  it("in rail mode shows only the avatar and keeps the accessible name", () => {
    setup(true);
    expect(screen.queryByText("FREE")).toBeNull();
    expect(screen.getByRole("button", { name: "Yuki Tanaka's account" })).toBeInTheDocument();
  });
});
