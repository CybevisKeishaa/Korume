import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { ToastProvider } from "@/components/ui/toast";
// `viCatalog`, not `vi` — that name is vitest's, and shadowing it here made
// the hoisted `vi.mock` below read an uninitialised binding.
import enCatalog from "@/messages/en/settings.json";
import viCatalog from "@/messages/vi/settings.json";
import { MemoryEraseForm } from "./memory-erase-form";

/**
 * Labels come from the CATALOG, not from literals typed here. These tests are
 * about the confirmation gate and the wire literal, never about the words —
 * see `messages/README.md`. The one thing deliberately pinned is that the two
 * locales ask for DIFFERENT words, which is asserted in
 * `messages/settings.pin.test.ts`, not here.
 */
const copy = { en: enCatalog.memoryErase, vi: viCatalog.memoryErase };

/**
 * The one string in this file that is deliberately a literal. It is NOT copy —
 * it is the wire contract `lib/validation/memory-erase.ts` validates, and it
 * must stay `"ERASE"` however the typed word is worded in any locale. Reading
 * it from the catalog would make the assertion circular and let a rename of
 * `confirmWord` silently change what the server is sent.
 */
const WIRE_LITERAL = "ERASE";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => vi.clearAllMocks());

function mockFetch(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    headers: new Headers(),
    json: response.json ?? (async () => ({})),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** `ToastProvider` is mounted in `app/[locale]/layout.tsx`; `useToast` throws without it. */
function renderForm() {
  return render(
    <ToastProvider>
      <MemoryEraseForm />
    </ToastProvider>,
  );
}

const submitButton = () => screen.getByRole("button", { name: copy.en.submit });

describe("MemoryEraseForm", () => {
  it("keeps the button disabled until the confirmation word is typed exactly", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText(new RegExp(copy.en.confirmWord));

    expect(submitButton()).toBeDisabled();

    await user.type(input, copy.en.confirmWord.slice(0, -1));
    expect(submitButton()).toBeDisabled();

    // A near-miss must not arm a destructive action — that is the only job
    // a typed confirmation has.
    await user.clear(input);
    await user.type(input, copy.en.confirmWord.toLowerCase());
    expect(submitButton()).toBeDisabled();

    await user.clear(input);
    await user.type(input, copy.en.confirmWord);
    expect(submitButton()).toBeEnabled();
  });

  it("posts the literal confirmation, then returns to the privacy section with a toast", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ ok: true, status: 200, json: async () => ({ data: { erased: true } }) });
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(copy.en.confirmWord)), copy.en.confirmWord);
    await user.click(submitButton());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/user/memory-erase");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ confirm: WIRE_LITERAL });

    expect(await screen.findByText(copy.en.done)).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/settings#privacy");
  });

  /**
   * ⚠️ The EN test above CANNOT prove this. Under `en` the typed word and the
   * wire literal are both "ERASE", so an implementation that posts
   * `{ confirm: typed }` passes it byte-for-byte — mutation-checked, and it
   * stayed green until this test existed.
   *
   * This is the property that actually matters: a Vietnamese user types "XOA"
   * and the server still receives the ASCII literal it validates against
   * (`lib/validation/memory-erase.ts`). Getting it wrong would make Erase
   * Korume Memory 400 for every non-English user while working perfectly in
   * development.
   */
  it("sends the ASCII literal even when the user typed a translated word", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ ok: true, status: 200, json: async () => ({ data: { erased: true } }) });
    render(
      <ToastProvider>
        <MemoryEraseForm />
      </ToastProvider>,
      { locale: "vi" },
    );

    const input = screen.getByLabelText(new RegExp(copy.vi.confirmWord));
    const submit = screen.getByRole("button", { name: copy.vi.submit });

    // The English word must NOT arm a Vietnamese confirmation.
    await user.type(input, copy.en.confirmWord);
    expect(submit).toBeDisabled();

    await user.clear(input);
    await user.type(input, copy.vi.confirmWord);
    expect(submit).toBeEnabled();
    await user.click(submit);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ confirm: WIRE_LITERAL });
  });

  // The route answers with an opaque message, but this assertion is about the
  // CLIENT never rendering a server string even if one arrives — the defect
  // class L9a closed five times.
  it("shows its own failure message and never the server's text, and does not navigate", async () => {
    const user = userEvent.setup();
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({ error: "pg: relation companion_memories at db-primary-3" }),
    });
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(copy.en.confirmWord)), copy.en.confirmWord);
    await user.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.en.failed);
    expect(alert).not.toHaveTextContent("db-primary-3");
    expect(document.body.textContent).not.toContain("companion_memories");
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a rejected request the same way, without navigating", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(copy.en.confirmWord)), copy.en.confirmWord);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.en.failed);
    expect(push).not.toHaveBeenCalled();
  });
});
