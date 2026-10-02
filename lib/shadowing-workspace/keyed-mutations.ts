export interface KeyedMutator {
  run<T>(key: string, options: { apply: () => void; request: () => Promise<T>; rollback: () => void; onSettled?: (ok: boolean) => void }): Promise<void>;
  isPending(key: string): boolean;
}

export function createKeyedMutator(): KeyedMutator {
  const latest = new Map<string, number>();
  let counter = 0;
  return {
    async run(key, { apply, request, rollback, onSettled }) {
      const token = ++counter;
      latest.set(key, token);
      let ok = true;
      try {
        apply();
        await request();
      } catch {
        ok = false;
      }
      const isLatest = latest.get(key) === token;
      if (isLatest) latest.delete(key);
      try {
        if (!ok && isLatest) rollback();
      } finally {
        onSettled?.(ok);
      }
    },
    isPending: (key) => latest.has(key),
  };
}
