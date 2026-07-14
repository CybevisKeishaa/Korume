import { describe, expect, it } from "vitest";
import {
  contentListQuerySchema,
  contentTypeSchema,
  createGrammarSchema,
  createJlptTestSchema,
  createKanjiSchema,
  createReadingPassageSchema,
  createVocabSchema,
  csvImportBodySchema,
  grammarCsvRowSchema,
  jlptTestCsvRowSchema,
  kanjiCsvRowSchema,
  readingPassageCsvRowSchema,
  updateKanjiSchema,
  vocabCsvRowSchema,
} from "./admin-content";

describe("contentTypeSchema", () => {
  it("accepts every documented content type", () => {
    for (const t of ["kanji", "vocab", "grammar", "jlpt_tests", "reading_passages"]) {
      expect(contentTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects an unknown type", () => {
    expect(contentTypeSchema.safeParse("subscriptions").success).toBe(false);
  });
});

describe("contentListQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(contentListQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces page/pageSize from query-string strings", () => {
    const parsed = contentListQuerySchema.safeParse({ page: "2", pageSize: "50" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ page: 2, pageSize: 50 });
  });

  it("rejects a pageSize over 100", () => {
    expect(contentListQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });
});

describe("createKanjiSchema", () => {
  it("accepts a minimal valid kanji", () => {
    expect(createKanjiSchema.safeParse({ character: "水" }).success).toBe(true);
  });

  it("accepts nested readings", () => {
    const parsed = createKanjiSchema.safeParse({
      character: "水",
      jlpt_level: "N5",
      readings: [{ reading: "みず", reading_type: "kun" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing character", () => {
    expect(createKanjiSchema.safeParse({ jlpt_level: "N5" }).success).toBe(false);
  });

  it("rejects an invalid reading_type", () => {
    const parsed = createKanjiSchema.safeParse({
      character: "水",
      readings: [{ reading: "みず", reading_type: "nope" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("updateKanjiSchema", () => {
  it("accepts a partial update with a single field", () => {
    expect(updateKanjiSchema.safeParse({ meaning_en: "water" }).success).toBe(true);
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateKanjiSchema.safeParse({}).success).toBe(true);
  });
});

describe("kanjiCsvRowSchema", () => {
  it("has no readings field", () => {
    expect("readings" in kanjiCsvRowSchema.shape).toBe(false);
  });

  it("accepts a flat row", () => {
    expect(kanjiCsvRowSchema.safeParse({ character: "水", jlpt_level: "N5" }).success).toBe(true);
  });
});

describe("createVocabSchema / vocabCsvRowSchema", () => {
  it("accepts a minimal valid vocab entry", () => {
    expect(createVocabSchema.safeParse({ word: "水" }).success).toBe(true);
  });

  it("rejects a missing word", () => {
    expect(createVocabSchema.safeParse({ reading: "みず" }).success).toBe(false);
  });

  it("csv row schema matches the create schema (vocab has no nested children)", () => {
    expect(vocabCsvRowSchema).toBe(createVocabSchema);
  });
});

describe("createGrammarSchema / grammarCsvRowSchema", () => {
  it("accepts a minimal valid grammar point", () => {
    expect(createGrammarSchema.safeParse({ title: "〜てしまう" }).success).toBe(true);
  });

  it("accepts example_sentences", () => {
    const parsed = createGrammarSchema.safeParse({
      title: "〜てしまう",
      example_sentences: [{ jp: "食べてしまった。", en: "I ended up eating it." }],
    });
    expect(parsed.success).toBe(true);
  });

  it("csv row schema has no example_sentences field", () => {
    expect("example_sentences" in grammarCsvRowSchema.shape).toBe(false);
  });
});

describe("createJlptTestSchema", () => {
  const validQuestion = {
    section: "vocab",
    question_type: "kanji-reading",
    question_data: { stem: "「水」の読み方は？", choices: ["みず", "みし", "すい", "すな"] },
    correct_answer: "0",
  };

  it("accepts a test with no questions", () => {
    expect(createJlptTestSchema.safeParse({ level: "N5", title: "Test 1" }).success).toBe(true);
  });

  it("accepts a test with valid nested questions", () => {
    const parsed = createJlptTestSchema.safeParse({ level: "N5", title: "Test 1", questions: [validQuestion] });
    expect(parsed.success).toBe(true);
  });

  it("rejects a question with the wrong number of choices", () => {
    const parsed = createJlptTestSchema.safeParse({
      level: "N5",
      title: "Test 1",
      questions: [{ ...validQuestion, question_data: { ...validQuestion.question_data, choices: ["a", "b"] } }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an out-of-range correct_answer", () => {
    const parsed = createJlptTestSchema.safeParse({
      level: "N5",
      title: "Test 1",
      questions: [{ ...validQuestion, correct_answer: "9" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid section", () => {
    const parsed = createJlptTestSchema.safeParse({
      level: "N5",
      title: "Test 1",
      questions: [{ ...validQuestion, section: "kanji" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("jlptTestCsvRowSchema", () => {
  it("accepts a row without section_config", () => {
    expect(jlptTestCsvRowSchema.safeParse({ level: "N5", title: "Test 1" }).success).toBe(true);
  });

  it("parses a JSON-encoded section_config cell", () => {
    const parsed = jlptTestCsvRowSchema.safeParse({
      level: "N5",
      title: "Test 1",
      section_config: '{"sections":[{"section":"vocab"}]}',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.section_config).toEqual({ sections: [{ section: "vocab" }] });
    }
  });

  it("rejects a malformed JSON section_config cell", () => {
    const parsed = jlptTestCsvRowSchema.safeParse({ level: "N5", title: "Test 1", section_config: "{not json" });
    expect(parsed.success).toBe(false);
  });
});

describe("createReadingPassageSchema / readingPassageCsvRowSchema", () => {
  it("accepts a minimal valid passage", () => {
    expect(
      createReadingPassageSchema.safeParse({ title: "T", jlpt_level: "N4", body_jp: "わたしは学生です。" }).success,
    ).toBe(true);
  });

  it("rejects a missing jlpt_level (required, unlike other content types)", () => {
    expect(createReadingPassageSchema.safeParse({ title: "T", body_jp: "x" }).success).toBe(false);
  });

  it("accepts nested questions with valid options/correct_answer", () => {
    const parsed = createReadingPassageSchema.safeParse({
      title: "T",
      jlpt_level: "N4",
      body_jp: "x",
      questions: [{ question: "Q?", options: ["a", "b"], correct_answer: "0" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("csv row schema has no questions field", () => {
    expect("questions" in readingPassageCsvRowSchema.shape).toBe(false);
  });
});

describe("csvImportBodySchema", () => {
  it("accepts non-empty CSV text", () => {
    expect(csvImportBodySchema.safeParse("word,reading\n猫,ねこ").success).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(csvImportBodySchema.safeParse("").success).toBe(false);
  });

  it("rejects a body over 1MB", () => {
    expect(csvImportBodySchema.safeParse("a".repeat(1_000_001)).success).toBe(false);
  });
});
