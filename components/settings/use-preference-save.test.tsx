import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider, usePreferences } from "@/components/providers/preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import { usePreferenceSave, type PreferenceSaveOutcome } from "./use-preference-save";

type Deferred = { resolve: (response: Response) => void };
const pending: Deferred[] = [];
const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push({ resolve })));

/**
 * `PreferencesProvider.setLocal` reads `window.matchMedia` whenever a patch
 * carries `reduceMotion`, and jsdom does not implement it.
 */
function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

afterEach(() => {
  pending.length = 0;
  fetchMock.mockClear();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

const ok = (data: Partial<UserPreferences>) =>
  new Response(JSON.stringify({ data: { ...DEFAULT_PREFERENCES, ...data } }), { status: 200 });
const fail = () => new Response(JSON.stringify({ error: "x" }), { status: 500 });

/**
 * ⚠️ `ThemeProvider` is REQUIRED and the plan's own snippet omitted it:
 * `PreferencesProvider` calls `useTheme()`, which throws outside one, so the
 * snippet as written could not have run.
 */
function setup() {
  stubMatchMedia();
  vi.stubGlobal("fetch", fetchMock);
  return renderHook(
    () => ({
      difficulty: usePreferenceSave("difficulty"),
      scale: usePreferenceSave("displayScale"),
      prefs: usePreferences().preferences,
    }),
    {
      wrapper: ({ children }) => (
        <ThemeProvider>
          <ToastProvider>
            <PreferencesProvider initial={DEFAULT_PREFERENCES}>{children}</PreferencesProvider>
          </ToastProvider>
        </ThemeProvider>
      ),
    },
  );
}

describe("usePreferenceSave (settings spec §5)", () => {
  it("applies the optimistic value before the server answers", async () => {
    const { result } = setup();
    act(() => {
      void result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });

    expect(result.current.prefs.difficulty).toBe("easy");
    expect(result.current.difficulty.saving).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/user/preferences");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ difficulty: "easy" });
  });

  it("an older response arriving after a newer one changes nothing", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    let b!: Promise<PreferenceSaveOutcome>;
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });
    act(() => {
      b = result.current.difficulty.save({ difficulty: "challenge" }, { difficulty: "challenge" });
    });

    await act(async () => {
      (pending[1] as Deferred).resolve(ok({ difficulty: "challenge" }));
      await b;
    });
    await act(async () => {
      (pending[0] as Deferred).resolve(ok({ difficulty: "easy" }));
      await a;
    });

    expect(result.current.prefs.difficulty).toBe("challenge");
  });

  it("a failed latest request rolls back to the last confirmed value", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });
    expect(result.current.prefs.difficulty).toBe("easy");

    await act(async () => {
      (pending[0] as Deferred).resolve(fail());
      await a;
    });

    expect(result.current.prefs.difficulty).toBe("adaptive");
    expect(result.current.difficulty.saving).toBe(false);
  });

  it("a failed stale request is ignored", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    let b!: Promise<PreferenceSaveOutcome>;
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });
    act(() => {
      b = result.current.difficulty.save({ difficulty: "challenge" }, { difficulty: "challenge" });
    });

    await act(async () => {
      (pending[1] as Deferred).resolve(ok({ difficulty: "challenge" }));
      await b;
    });
    await act(async () => {
      (pending[0] as Deferred).resolve(fail());
      await a;
    });

    expect(result.current.prefs.difficulty).toBe("challenge");
  });

  it("two different controls saving at once do not affect each other", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    let b!: Promise<PreferenceSaveOutcome>;
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });
    act(() => {
      b = result.current.scale.save({ displayScale: "large" }, { displayScale: "large" });
    });

    await act(async () => {
      (pending[1] as Deferred).resolve(ok({ displayScale: "large" }));
      await b;
    });
    await act(async () => {
      (pending[0] as Deferred).resolve(fail());
      await a;
    });

    // The rollback restores only the failed control's own keys. Restoring the
    // whole row would drop the other control's confirmed save.
    expect(result.current.prefs).toMatchObject({ difficulty: "adaptive", displayScale: "large" });
  });

  /**
   * A success applies the SERVER's value for the optimistic keys, not the
   * optimistic value again — the server canonicalises (`every_day` rewrites
   * `scheduleDays`), so echoing the request back would show the user something
   * the database does not hold.
   */
  it("applies the server's canonical value, not the optimistic one", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });

    await act(async () => {
      (pending[0] as Deferred).resolve(ok({ difficulty: "challenge" }));
      await a;
    });

    expect(result.current.prefs.difficulty).toBe("challenge");
  });

  /**
   * A success must not write back keys the caller did not touch: another
   * control's newer optimistic value may already be in `preferences`, and the
   * response body carries that control's OLD value alongside this one's.
   */
  it("never applies response keys the caller did not save", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    let b!: Promise<PreferenceSaveOutcome>;
    act(() => {
      b = result.current.scale.save({ displayScale: "large" }, { displayScale: "large" });
    });
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });

    // difficulty's response still carries displayScale: "normal" (the default),
    // which is now stale — applying the whole row would undo the scale change.
    await act(async () => {
      (pending[1] as Deferred).resolve(ok({ difficulty: "easy" }));
      await a;
    });

    expect(result.current.prefs.displayScale).toBe("large");
    await act(async () => {
      (pending[0] as Deferred).resolve(ok({ displayScale: "large" }));
      await b;
    });
  });

  /**
   * The result is what a caller holding state OUTSIDE `UserPreferences` rolls
   * back on — AI Training's `consent` is a `users` column, so its row keeps
   * its own `useState`. `save` resolves rather than rejects, so a `.catch()`
   * there would never fire and the switch would stay on a value the server
   * refused.
   */
  it("resolves true on a confirmed save and false on a failed one, never rejecting", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    let b!: Promise<PreferenceSaveOutcome>;

    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });
    await act(async () => {
      (pending[0] as Deferred).resolve(ok({ difficulty: "easy" }));
    });
    await expect(a).resolves.toBe("saved");

    act(() => {
      b = result.current.scale.save({ displayScale: "large" }, { displayScale: "large" });
    });
    await act(async () => {
      (pending[1] as Deferred).resolve(fail());
    });
    await expect(b).resolves.toBe("failed");
  });

  it("resolves false for a superseded save, so its caller does not roll back a newer value", async () => {
    const { result } = setup();
    let a!: Promise<PreferenceSaveOutcome>;
    let b!: Promise<PreferenceSaveOutcome>;
    act(() => {
      a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });
    act(() => {
      b = result.current.difficulty.save({ difficulty: "challenge" }, { difficulty: "challenge" });
    });

    await act(async () => {
      (pending[1] as Deferred).resolve(ok({ difficulty: "challenge" }));
      await b;
    });
    await act(async () => {
      (pending[0] as Deferred).resolve(ok({ difficulty: "easy" }));
    });

    await expect(a).resolves.toBe("superseded");
    await expect(b).resolves.toBe("saved");
  });

  it("reports a rejected request the same way a failed one is reported", async () => {
    stubMatchMedia();
    const rejecting = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", rejecting);
    const { result } = renderHook(
      () => ({ difficulty: usePreferenceSave("difficulty"), prefs: usePreferences().preferences }),
      {
        wrapper: ({ children }) => (
          <ThemeProvider>
            <ToastProvider>
              <PreferencesProvider initial={DEFAULT_PREFERENCES}>{children}</PreferencesProvider>
            </ToastProvider>
          </ThemeProvider>
        ),
      },
    );

    await act(async () => {
      await result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" });
    });

    expect(result.current.prefs.difficulty).toBe("adaptive");
    expect(result.current.difficulty.saving).toBe(false);
  });
});
