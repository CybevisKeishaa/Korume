export type CardState<T> = { kind: "ok"; data: T } | { kind: "unavailable" } | { kind: "error" };

function isAuthFailure(error: unknown): error is { status: 401 } {
  return typeof error === "object" && error !== null && "status" in error && error.status === 401;
}

export async function loadCard<T>(name: string, load: () => Promise<T>): Promise<CardState<T>> {
  try {
    return { kind: "ok", data: await load() };
  } catch (error: unknown) {
    if (isAuthFailure(error)) throw error;
    console.error({ event: "dashboard_card_failed", card: name, error });
    return { kind: "error" };
  }
}
