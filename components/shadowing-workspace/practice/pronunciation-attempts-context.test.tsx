import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PronunciationAttemptsProvider, usePronunciationAttempts } from "./pronunciation-attempts-context";

describe("PronunciationAttemptsProvider", () => {
  it("shares live reducer state with consumers and releases it when the lesson unmounts", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <PronunciationAttemptsProvider>{children}</PronunciationAttemptsProvider>;
    const first = renderHook(() => [usePronunciationAttempts(), usePronunciationAttempts()], { wrapper });
    const dispatch = first.result.current[0]?.dispatch;
    act(() => dispatch?.({ type: "start", lineId: "L1" }));
    expect(first.result.current[1]?.attempts.L1?.phase).toBe("recording");
    expect(first.result.current[0]?.dispatch).toBe(dispatch);
    first.unmount();
    const nextLesson = renderHook(usePronunciationAttempts, { wrapper });
    expect(nextLesson.result.current.attempts).toEqual({});
  });
});
