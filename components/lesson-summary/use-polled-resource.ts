"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollPolicy<T> {
  /** ms to wait before the next GET, or null when this body ends the chain. */
  waitMs(body: T): number | null;
  /** true when this GET body means the client must POST once. */
  needsPost(body: T): boolean;
}

/**
 * One GET → (POST) → wait → GET chain per mount (spec §7.4). GET carries the query string; POST goes to the same
 * path with `postBody`. Unmount aborts the in-flight request and clears the timer; `retry()` starts a new chain
 * with a POST. `maxPosts` bounds a server that keeps answering "not ready". `onBody` sees EVERY body, including
 * ones React batches away from `body` when two answers land in one tick.
 */
export function usePolledResource<T>({ url, postBody, enabled, policy, maxPosts = 3, onBody }: {
  url: string;
  postBody: Record<string, unknown>;
  enabled: boolean;
  policy: PollPolicy<T>;
  maxPosts?: number;
  onBody?: (body: T) => void;
}): { body: T | null; settled: boolean; retry(): void } {
  const [body, setBody] = useState<T | null>(null);
  const [settled, setSettled] = useState(false);
  const [chain, setChain] = useState({ id: 0, startWithPost: false });
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const onBodyRef = useRef(onBody);
  onBodyRef.current = onBody;
  const bodyJson = JSON.stringify(postBody);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let posts = 0;

    const step = async (method: "GET" | "POST"): Promise<void> => {
      try {
        if (method === "POST") posts += 1;
        const response = await fetch(method === "GET" ? url : (url.split("?")[0] ?? url), {
          method,
          signal: controller.signal,
          ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: bodyJson } : {}),
        });
        const next = (await response.json()) as T;
        if (controller.signal.aborted) return;
        setBody(next);
        onBodyRef.current?.(next);
        const wait = policyRef.current.waitMs(next);
        if (wait !== null) {
          timer = setTimeout(() => void step("GET"), wait);
          return;
        }
        if (policyRef.current.needsPost(next) && posts < maxPosts) {
          void step("POST");
          return;
        }
        setSettled(true);
      } catch {
        if (!controller.signal.aborted) setSettled(true);
      }
    };

    setSettled(false);
    void step(chain.startWithPost ? "POST" : "GET");
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [bodyJson, chain, enabled, maxPosts, url]);

  const retry = useCallback(() => setChain((current) => ({ id: current.id + 1, startWithPost: true })), []);
  return { body, settled, retry };
}
