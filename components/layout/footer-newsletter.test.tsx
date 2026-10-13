import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { FooterNewsletter } from "./footer-newsletter";
import en from "@/messages/en/marketing.json";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const copy = en.appFooter.newsletter;
const EMAIL = "a.very.long.learner.address.for.the.footer.test@korume-example.com";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function respond(status: number) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { optedIn: true } }), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("FooterNewsletter (spec N3/N3a)", () => {
  it("shows the account email as labelled text, never as an input, with the full address kept", () => {
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(copy.emailLabel)).toBeInTheDocument();
    const email = document.querySelector("[data-footer-email]");
    expect(email).toHaveTextContent(EMAIL);
    expect(email).toHaveAttribute("title", EMAIL);
    expect(screen.getByText(copy.purpose)).toBeInTheDocument();
  });

  it("sends only { optIn: true }, then shows the saved line and refreshes the router", async () => {
    const fetchMock = respond(200);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByText(copy.subscribed);
    expect(fetchMock).toHaveBeenCalledWith("/api/user/newsletter", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ optIn: true }),
    }));
    expect(screen.getByRole("link", { name: copy.manage })).toHaveAttribute("href", "/en/settings#newsletter");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disables the button while pending, so a double click is one request", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    const button = screen.getByRole("button", { name: copy.submit });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response("{}", { status: 200 }));
    await screen.findByText(copy.subscribed);
  });

  it("401 shows the signed-out state and claims nothing", async () => {
    respond(401);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signedOut);
    expect(screen.queryByText(copy.subscribed)).toBeNull();
    expect(screen.getByRole("button", { name: copy.signIn })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a server or network error keeps the form and shows an alert", async () => {
    respond(500);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.error);
    expect(screen.getByRole("button", { name: copy.submit })).toBeEnabled();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(copy.error));
  });

  it("an already subscribed learner sees the saved line, not the form", () => {
    render(<FooterNewsletter email={EMAIL} initialOptedIn />);
    expect(screen.getByText(copy.subscribed)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.submit })).toBeNull();
  });

  it("keeps an always-mounted status region, empty before saving", () => {
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("moves focus to the Manage link after a confirmed save", async () => {
    respond(200);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    const manage = await screen.findByRole("link", { name: copy.manage });
    await waitFor(() => expect(document.activeElement).toBe(manage));
    expect(screen.getByRole("status")).toHaveTextContent(copy.subscribed);
  });

  it("does not steal focus when mounted already subscribed", () => {
    render(<FooterNewsletter email={EMAIL} initialOptedIn />);
    expect(document.activeElement).toBe(document.body);
  });

  it("re-syncs from the server prop without a remount", () => {
    const { rerender } = render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    rerender(<FooterNewsletter email={EMAIL} initialOptedIn />);
    expect(screen.getByText(copy.subscribed)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.submit })).toBeNull();
    rerender(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    expect(screen.getByRole("button", { name: copy.submit })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
