import { describe, expect, it } from "vitest";
import { CHUNKERS } from "./chunk";

// Pin: v1 and v2 never change behaviour (a rule change ships as a new version number).
const T = 60000;
const LINES = [
  "毎日日本語を勉強しました。",
  "私は「はい」と言った。",
  "今日はいい天気ですね？",
  "注文をお願いします。",
  "「この前行ったここ本当に美味しかった」とかあるじゃないですか",
  "ああいうのをその場ですぐGoogleマップで調べて",
  "今日は2026年です。",
  "今日は21番目の文を読みます。",
  "ABCです",
  "3時です",
  "はい。",
  "ぱぽぴぷぺ",
  "ポッドジャスト…です",
  "お店を検索すると思うんですけど。",
  "お店を検索すると思うんですけど。".repeat(7),
  "…今日は雨です",
  '彼は"はい"と言った',
  "今日は楽しいですね♪",
  "お値段が…みたいな時が結構あるんですね？",
  "すぐＧｏｏｇｌｅで",
  "ｶﾀｶﾅ",
  "あ。",
  "ね何さん角さんもういろんな人がいますね色んな人いろんな名前がありますね",
  "おやすみなさい",
  "1時と2時と3時",
  "COVID19です",
  "あ👍🏽い",
  "「はい」",
];

describe("frozen v1 and v2", () => {
  it("results for the pinned corpus", async () => {
    const out: Record<string, unknown> = {};
    for (const l of LINES) out[l] = [await CHUNKERS[1]!(l), await CHUNKERS[2]!(l)];
    expect(out).toMatchInlineSnapshot(`
      {
        "1時と2時と3時": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "3時です": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "ABCです": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "COVID19です": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "…今日は雨です": [
          {
            "chunks": [
              "...今日は",
              "雨です",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "...今日",
              "は",
              "雨",
              "です",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "「この前行ったここ本当に美味しかった」とかあるじゃないですか": [
          {
            "chunks": [
              "「この",
              "前",
              "行った",
              "ここ",
              "本当に",
              "美味しかった」とか",
              "あるじゃないですか",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "「この",
              "前",
              "行っ",
              "た",
              "ここ",
              "本当に",
              "美味しかっ",
              "た」",
              "とか",
              "ある",
              "じゃ",
              "ない",
              "です",
              "か",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "「はい」": [
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 2,
          },
        ],
        "あ。": [
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 2,
          },
        ],
        "ああいうのをその場ですぐGoogleマップで調べて": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "あ👍🏽い": [
          {
            "chunks": [],
            "reason": "mismatch",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "mismatch",
            "reliable": false,
            "version": 2,
          },
        ],
        "おやすみなさい": [
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 2,
          },
        ],
        "お値段が…みたいな時が結構あるんですね？": [
          {
            "chunks": [
              "お値段が...みたいな時が",
              "結構",
              "あるんですね?",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "お",
              "値段",
              "が...",
              "みたい",
              "な",
              "時",
              "が",
              "結構",
              "ある",
              "ん",
              "です",
              "ね?",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "お店を検索すると思うんですけど。": [
          {
            "chunks": [
              "お店を",
              "検索すると",
              "思うんですけど。",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "お",
              "店",
              "を",
              "検索",
              "する",
              "と",
              "思う",
              "ん",
              "です",
              "けど。",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "お店を検索すると思うんですけど。お店を検索すると思うんですけど。お店を検索すると思うんですけど。お店を検索すると思うんですけど。お店を検索すると思うんですけど。お店を検索すると思うんですけど。お店を検索すると思うんですけど。": [
          {
            "chunks": [
              "お店を検索すると思うんですけど。",
              "お店を検索すると思うんですけど。",
              "お店を検索すると思うんですけど。",
              "お店を検索すると思うんですけど。",
              "お店を検索すると思うんですけど。",
              "お店を検索すると思うんですけど。",
              "お店を検索すると",
              "思うんですけど。",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "too_many_pieces",
            "reliable": false,
            "version": 2,
          },
        ],
        "すぐＧｏｏｇｌｅで": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "ね何さん角さんもういろんな人がいますね色んな人いろんな名前がありますね": [
          {
            "chunks": [
              "ね",
              "何さん角さん",
              "もう",
              "いろんな人が",
              "いますね",
              "色んな人",
              "いろんな名前が",
              "ありますね",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "ね",
              "何",
              "さん",
              "角",
              "さん",
              "もう",
              "いろんな",
              "人",
              "が",
              "い",
              "ます",
              "ね",
              "色んな",
              "人",
              "いろんな",
              "名前",
              "が",
              "あり",
              "ます",
              "ね",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "はい。": [
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 2,
          },
        ],
        "ぱぽぴぷぺ": [
          {
            "chunks": [],
            "reason": "unknown_token",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "unknown_token",
            "reliable": false,
            "version": 2,
          },
        ],
        "ポッドジャスト…です": [
          {
            "chunks": [],
            "reason": "unknown_token",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "unknown_token",
            "reliable": false,
            "version": 2,
          },
        ],
        "今日は2026年です。": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "今日は21番目の文を読みます。": [
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "latin_or_digit",
            "reliable": false,
            "version": 2,
          },
        ],
        "今日はいい天気ですね？": [
          {
            "chunks": [
              "今日は",
              "いい",
              "天気ですね?",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "今日",
              "は",
              "いい",
              "天気",
              "です",
              "ね?",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "今日は楽しいですね♪": [
          {
            "chunks": [],
            "reason": "unknown_token",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [
              "今日",
              "は",
              "楽しい",
              "です",
              "ね♪",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "彼は"はい"と言った": [
          {
            "chunks": [
              "彼は",
              ""はい"と",
              "言った",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "彼",
              "は",
              ""はい"",
              "と",
              "言っ",
              "た",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "毎日日本語を勉強しました。": [
          {
            "chunks": [
              "毎日",
              "日本語を",
              "勉強しました。",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "毎日",
              "日本語",
              "を",
              "勉強",
              "し",
              "まし",
              "た。",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "注文をお願いします。": [
          {
            "chunks": [
              "注文を",
              "お願いします。",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "注文",
              "を",
              "お願い",
              "し",
              "ます。",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "私は「はい」と言った。": [
          {
            "chunks": [
              "私は",
              "「はい」と",
              "言った。",
            ],
            "reason": null,
            "reliable": true,
            "version": 1,
          },
          {
            "chunks": [
              "私",
              "は",
              "「はい」",
              "と",
              "言っ",
              "た。",
            ],
            "reason": null,
            "reliable": true,
            "version": 2,
          },
        ],
        "ｶﾀｶﾅ": [
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 1,
          },
          {
            "chunks": [],
            "reason": "single_chunk",
            "reliable": false,
            "version": 2,
          },
        ],
      }
    `);
  }, T);
});
