import { afterEach, describe, expect, it } from "vitest";
import { isLessonCreationWorkerEnabled, lessonCreationWorkerEnvSpec } from "./env";

describe("lessonCreationWorkerEnvSpec", () => {
  const parse = (env: Record<string, string>) => lessonCreationWorkerEnvSpec.schema.safeParse(env);

  it("accepts unset as the deliberately disabled default", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts only the two literal configured values", () => {
    expect(parse({ LESSON_CREATION_WORKER_ENABLED: "true" }).success).toBe(true);
    expect(parse({ LESSON_CREATION_WORKER_ENABLED: "false" }).success).toBe(true);
  });

  const NEAR_MISSES = ["1", "TRUE", "yes"];

  it("checks every required near-miss, not an empty list", () => {
    expect(NEAR_MISSES).toHaveLength(3);
    expect(new Set(NEAR_MISSES).size).toBe(NEAR_MISSES.length);
  });

  it.each(NEAR_MISSES)("rejects %o rather than silently disabling the worker", (value) => {
    expect(parse({ LESSON_CREATION_WORKER_ENABLED: value }).success).toBe(false);
  });

  it("names the worker switch in the startup validation error", () => {
    const result = parse({ LESSON_CREATION_WORKER_ENABLED: "1" });
    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues.map((issue) => issue.message).join(" ");
    expect(message).toContain("LESSON_CREATION_WORKER_ENABLED");
    expect(message).toContain("true");
    expect(message).toContain("false");
  });

  it("is registered under its own env spec name", () => {
    expect(lessonCreationWorkerEnvSpec.name).toBe("lesson-creation-worker");
  });
});

describe("isLessonCreationWorkerEnabled", () => {
  const ORIGINAL = process.env.LESSON_CREATION_WORKER_ENABLED;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.LESSON_CREATION_WORKER_ENABLED;
    else process.env.LESSON_CREATION_WORKER_ENABLED = ORIGINAL;
  });

  it("is enabled by the exact literal only", () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "true";
    expect(isLessonCreationWorkerEnabled()).toBe(true);
  });

  const DISABLING = ["false", "TRUE", "True", "1", "yes", " true", ""];

  it("checks every disabling value, not an empty list", () => {
    expect(DISABLING).toHaveLength(7);
    expect(new Set(DISABLING).size).toBe(DISABLING.length);
  });

  it.each(DISABLING)("treats %o as disabled", (value) => {
    process.env.LESSON_CREATION_WORKER_ENABLED = value;
    expect(isLessonCreationWorkerEnabled()).toBe(false);
  });

  it("treats unset as deliberately disabled", () => {
    delete process.env.LESSON_CREATION_WORKER_ENABLED;
    expect(isLessonCreationWorkerEnabled()).toBe(false);
  });
});
