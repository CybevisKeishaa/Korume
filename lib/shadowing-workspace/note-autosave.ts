export type NoteSaveStatus = "saved" | "saving" | "failed" | "idle";

interface KeyState {
  latest: string;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  status: NoteSaveStatus;
}

/**
 * Note autosave (spec §5.5): debounce 800 ms and flush on blur; per note key at most one request in flight —
 * a newer body replaces any queued older one and is sent after the current request settles. Last write wins.
 */
export function createNoteAutosave(send: (key: string, body: string) => Promise<void>, opts: { debounceMs?: number } = {}) {
  const debounceMs = opts.debounceMs ?? 800;
  const keys = new Map<string, KeyState>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const stateOf = (key: string): KeyState => {
    let state = keys.get(key);
    if (!state) keys.set(key, (state = { latest: "", timer: null, inFlight: null, status: "idle" }));
    return state;
  };
  const setStatus = (state: KeyState, status: NoteSaveStatus) => {
    if (state.status === status) return;
    state.status = status;
    notify();
  };

  /** Sends the latest body; while a request is in flight, returns it — its settle sends whatever is newer. */
  function flush(key: string): Promise<void> {
    const state = stateOf(key);
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.inFlight) return state.inFlight;
    const body = state.latest;
    setStatus(state, "saving");
    state.inFlight = send(key, body).then(
      () => {
        state.inFlight = null;
        // Changed while this request was in flight: one follow-up carries the latest body.
        if (state.latest !== body) return flush(key);
        setStatus(state, "saved");
      },
      () => {
        state.inFlight = null;
        setStatus(state, "failed");
      },
    );
    return state.inFlight;
  }

  return {
    change(key: string, body: string): void {
      const state = stateOf(key);
      state.latest = body;
      setStatus(state, "saving");
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => { state.timer = null; void flush(key); }, debounceMs);
    },
    flush,
    status(key: string): NoteSaveStatus {
      return keys.get(key)?.status ?? "idle";
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type NoteAutosave = ReturnType<typeof createNoteAutosave>;
