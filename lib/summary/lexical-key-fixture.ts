/** Saved-word identity cases shared by the TS test and the live SQL gate (port-dashboard S3): `normalizeRef(input)`
 * and SQL `vocab.lexical_key` must both produce `key`. The gate file lists one `('<input>', '<key>')` row per case. */
export const LEXICAL_KEY_CASES: readonly { input: string; key: string }[] = [
  { input: "　食べる　", key: "食べる" },
  { input: "ﾀﾍﾞﾙ", key: "タベル" },
  { input: "Ｔｏｋｙｏ", key: "Tokyo" },
  { input: "\u00a0日本\u3000", key: "日本" },
  { input: "お茶", key: "お茶" },
  { input: "\t飲む\n", key: "飲む" },
];
