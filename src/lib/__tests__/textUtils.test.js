// src/lib/textUtils.js の回帰テスト。
// 過去にプロダクションで実際に発生したバグを再発させないよう、各バグに対応するテストを記述する。
// 各 describe ブロックの先頭コメントで「どのコミットで直したバグか」を明記する。

import { describe, it, expect } from "vitest";
import {
  normalizeChapterKey,
  detectDuplicateSections,
  parseOutputSections,
  upsertChapterInOutput,
  dedupeOutputSections,
  extractChapters,
  extractSections,
  dedupeBodyHeaders,
  stripChapterSection,
  extractKeywords3Axes,
  parseWorkProfileKeywords,
  resolveAutofillSync,
} from "../textUtils.js";

// ============================================================
// normalizeChapterKey
// ============================================================

describe("normalizeChapterKey", () => {
  it("全角空白・半角空白を吸収する", () => {
    expect(normalizeChapterKey("第1章： 概要")).toBe("第1章概要");
    expect(normalizeChapterKey("第1章　概要")).toBe("第1章概要");
    expect(normalizeChapterKey("  第1章  概要  ")).toBe("第1章概要");
  });
  it("コロン（半角/全角）を吸収する", () => {
    expect(normalizeChapterKey("第1章：概要")).toBe(normalizeChapterKey("第1章:概要"));
  });
  it("装飾記号（* # [ ] 【 】 「 」）を除去する", () => {
    expect(normalizeChapterKey("## 第1章：概要")).toBe("第1章概要");
    expect(normalizeChapterKey("**第1章：概要**")).toBe("第1章概要");
    expect(normalizeChapterKey("【第1章：概要】")).toBe("第1章概要");
  });
  it("空・null・undefined を安全に扱う", () => {
    expect(normalizeChapterKey("")).toBe("");
    expect(normalizeChapterKey(null)).toBe("");
    expect(normalizeChapterKey(undefined)).toBe("");
  });
});

// ============================================================
// detectDuplicateSections
// 過去バグ: STEP7 の LLM 出力に「おわりに」見出しが複数行存在すると
//          extractChapters が 9章ではなく 10章を返し、STEP8 出力に
//          `=== おわりに ===` が2回出る（commit ed86268, af4dc88）
// ============================================================

describe("detectDuplicateSections", () => {
  it("重複しない場合は false を返す", () => {
    const text = "=== はじめに ===\n\n本文\n\n=== 第1章 ===\n\n本文";
    expect(detectDuplicateSections(text)).toBe(false);
  });
  it("同じ章タイトルが2回出現すると true を返す", () => {
    const text = "=== おわりに ===\n\n本文1\n\n=== 第1章 ===\n\n本文\n\n=== おわりに ===\n\n本文2";
    expect(detectDuplicateSections(text)).toBe(true);
  });
  it("コロン・空白の差を吸収して重複を検出する", () => {
    const text = "=== 第1章:概要 ===\n\n本文1\n\n=== 第1章： 概要 ===\n\n本文2";
    expect(detectDuplicateSections(text)).toBe(true);
  });
  it("空文字は false", () => {
    expect(detectDuplicateSections("")).toBe(false);
    expect(detectDuplicateSections(null)).toBe(false);
  });
});

// ============================================================
// parseOutputSections
// ============================================================

describe("parseOutputSections", () => {
  it("セクションが0個（=== なし）の場合は preamble に全文", () => {
    const result = parseOutputSections("本文だけ\n何もマーカー無し");
    expect(result.sections).toHaveLength(0);
    expect(result.preamble).toBe("本文だけ\n何もマーカー無し");
  });
  it("単一セクションを正しく分離する", () => {
    const text = "=== はじめに ===\n\n本文1\n本文2";
    const result = parseOutputSections(text);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe("はじめに");
    expect(result.sections[0].header).toBe("=== はじめに ===");
    expect(result.sections[0].body).toContain("本文1");
  });
  it("複数セクションを順序通りに分離する", () => {
    const text = "=== A ===\n\nA本文\n\n---\n\n=== B ===\n\nB本文";
    const result = parseOutputSections(text);
    expect(result.sections).toHaveLength(2);
    expect(result.sections.map((s) => s.title)).toEqual(["A", "B"]);
  });
});

// ============================================================
// dedupeOutputSections
// 過去バグ: 同上（commit 5b9fe86 で mount時自動修復が入った）
// ============================================================

describe("dedupeOutputSections", () => {
  it("重複セクションを除去し、本文が長い方を残す", () => {
    const text =
      "=== おわりに ===\n\n短い本文\n\n---\n\n=== 第1章 ===\n\n第1章\n\n---\n\n=== おわりに ===\n\nこちらは長めの本文で内容も豊富";
    const result = dedupeOutputSections(text);
    // 重複「おわりに」は1つに
    const matches = [...result.matchAll(/^===\s*(.+?)\s*===$/gm)];
    expect(matches).toHaveLength(2); // はじめに（無）+ おわりに（1） + 第1章（1） = 2
    // 長い方の本文が残る
    expect(result).toContain("こちらは長めの本文で内容も豊富");
    expect(result).not.toContain("短い本文");
  });
  it("重複が無ければそのまま返す（タイトルとセクション数の維持）", () => {
    const text = "=== A ===\n\nA本文\n\n---\n\n=== B ===\n\nB本文";
    const result = dedupeOutputSections(text);
    const matches = [...result.matchAll(/^===\s*(.+?)\s*===$/gm)];
    expect(matches).toHaveLength(2);
  });
});

// ============================================================
// extractChapters
// 過去バグ:
//   1. `=== はじめに ===` ラッパー内 body に「第1章: ...」と書かれていると
//      extractChapters が body 内の見出しを優先して「はじめに」が消滅する（commit 29e54e1）
//   2. 「おわりに」が2回検出されると 9章のはずが 10章になる（commit ed86268）
// ============================================================

describe("extractChapters", () => {
  it("ラッパー形式（=== title ===）を最優先で認識する", () => {
    // body 内に「第1章: ...」とあっても、ラッパーが「はじめに」ならそちらが採用される
    const text =
      "=== はじめに ===\n\n第1章：誤ったタイトル\n本文だがラッパーが正\n\n---\n\n=== 第1章：本当のタイトル ===\n\n本当の第1章本文";
    const chapters = extractChapters(text);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].chapterTitle).toBe("はじめに");
    expect(chapters[1].chapterTitle).toBe("第1章：本当のタイトル");
  });
  it("ラッパー無しの平文（目次など）では inline 検出にフォールバック", () => {
    const text = "はじめに\n本文の冒頭\n\n第1章 役割\n第1章の本文";
    const chapters = extractChapters(text);
    expect(chapters.length).toBeGreaterThanOrEqual(2);
    expect(chapters.find((c) => c.chapterTitle.includes("はじめに"))).toBeDefined();
    expect(chapters.find((c) => c.chapterTitle.includes("第1章"))).toBeDefined();
  });
  it("同じタイトルの章が複数あれば本文が長い方を残して重複排除する", () => {
    const text =
      "=== おわりに ===\n\n短い\n\n---\n\n=== 第1章 ===\n\n第1章本文\n\n---\n\n=== おわりに ===\n\nこちらの方が長い本文で内容も豊富である";
    const chapters = extractChapters(text);
    expect(chapters).toHaveLength(2);
    const owari = chapters.find((c) => c.chapterTitle === "おわりに");
    expect(owari.body).toContain("こちらの方が長い本文で内容も豊富である");
  });
  it("空・null を安全に扱う", () => {
    expect(extractChapters("")).toEqual([]);
    expect(extractChapters(null)).toEqual([]);
  });
});

// ============================================================
// extractSections
// ============================================================

describe("extractSections", () => {
  it("(1)(2)(3) 節と ①②③ 項を抽出する", () => {
    const text =
      "第1章 概要\n\n(1) 節タイトル1\n① 項1の見出し\n② 項2の見出し\n\n(2) 節タイトル2\n① 項のみ\n② 項2";
    const sections = extractSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].items.length).toBeGreaterThanOrEqual(2);
    expect(sections[0].items[0]).toMatch(/^①/);
  });
  it("項のみで節見出しが無い場合のデフォルト挿入", () => {
    const text = "① 項のみ\n② 項2";
    const sections = extractSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0].sectionTitle).toBe("（節見出しなし）");
  });
});

// ============================================================
// dedupeBodyHeaders
// 過去バグ: 本文で章タイトル/節見出しが項ごとに繰り返される（commit 4bb3316）
// ============================================================

describe("dedupeBodyHeaders", () => {
  it("章タイトル（はじめに）が項ごとに繰り返されても、最初の1回だけにする", () => {
    const text =
      "はじめに\n(1) 節タイトル\n① 項1\n本文A\n\nはじめに\n(1) 節タイトル\n② 項2\n本文B\n\nはじめに\n(1) 節タイトル\n③ 項3\n本文C";
    const result = dedupeBodyHeaders(text);
    const hajimeniCount = (result.match(/^はじめに\s*$/gm) || []).length;
    expect(hajimeniCount).toBe(1);
  });
  it("節見出し（(1)）が項ごとに繰り返されても、最初の1回だけにする", () => {
    const text =
      "はじめに\n(1) 節タイトル\n① 項1\n本文A\n\nはじめに\n(1) 節タイトル\n② 項2\n本文B";
    const result = dedupeBodyHeaders(text);
    const sectionCount = (result.match(/^\(1\)/gm) || []).length;
    expect(sectionCount).toBe(1);
  });
  it("新しい節は出る（節間で見出しは保持される）", () => {
    const text =
      "はじめに\n(1) 節A\n① 項1\n本文A\n\nはじめに\n(2) 節B\n① 項1\n本文B";
    const result = dedupeBodyHeaders(text);
    expect(result).toMatch(/^\(1\)/m);
    expect(result).toMatch(/^\(2\)/m);
  });
  it("項見出し（①②③）は重複除去対象外（毎回出る）", () => {
    const text =
      "はじめに\n(1) 節\n① 項1\n本文\n\nはじめに\n(1) 節\n② 項2\n本文\n\nはじめに\n(1) 節\n③ 項3\n本文";
    const result = dedupeBodyHeaders(text);
    expect(result).toMatch(/^①/m);
    expect(result).toMatch(/^②/m);
    expect(result).toMatch(/^③/m);
  });
  it("第N章・おわりにも対象（commit 4bb3316 で stripChapterSection 改善）", () => {
    const text = "第1章 役割\n本文\n\n第1章 役割\nもう一度";
    const result = dedupeBodyHeaders(text);
    expect((result.match(/^第1章 役割$/gm) || []).length).toBe(1);
  });
});

// ============================================================
// extractKeywords3Axes / parseWorkProfileKeywords
// 過去バグ: 新形式「## 主要検索キーワード」セクションが認識されず、
//          STEP5 のキーワード自動転記が空欄になる（commit 3085f1f）
// ============================================================

describe("extractKeywords3Axes", () => {
  it("旧形式（主題軸: XXX）から theme を抽出する", () => {
    const text = "## キーワード\n- 主題軸：書く 自己分析\n- 読者軸：会社員 副業\n- 差分軸：自分 言語化";
    const axes = extractKeywords3Axes(text);
    expect(axes.theme).toBe("書く 自己分析");
    expect(axes.reader).toBe("会社員 副業");
    expect(axes.diff).toBe("自分 言語化");
  });
  it("新形式（## 主要検索キーワード + 箇条書き）を fallback で認識する", () => {
    const text = "## 主要検索キーワード\n- やりたいこと 仕事\n- 副業 適職";
    const axes = extractKeywords3Axes(text);
    expect(axes.theme).toBe("やりたいこと 仕事");
  });
  it("全角空白付き（やりたいこと　仕事）も正しく抽出する", () => {
    const text = "## 主要検索キーワード\n- やりたいこと　仕事";
    const axes = extractKeywords3Axes(text);
    expect(axes.theme).toContain("やりたいこと");
    expect(axes.theme).toContain("仕事");
  });
  it("空入力で例外を出さない", () => {
    expect(extractKeywords3Axes("")).toEqual({ theme: "", reader: "", diff: "" });
    expect(extractKeywords3Axes(null)).toEqual({ theme: "", reader: "", diff: "" });
  });
});

describe("parseWorkProfileKeywords", () => {
  it("旧形式から keyword1/keyword2 を取り出す", () => {
    const text = "## キーワード\n- 主題軸：書く 自己分析";
    const result = parseWorkProfileKeywords(text);
    expect(result.keyword1).toBe("書く");
    expect(result.keyword2).toBe("自己分析");
  });
  it("新形式（## 主要検索キーワード）からも取り出す", () => {
    const text = "## 主要検索キーワード\n- やりたいこと 仕事";
    const result = parseWorkProfileKeywords(text);
    expect(result.keyword1).toBe("やりたいこと");
    expect(result.keyword2).toBe("仕事");
  });
  it("全角空白も区切り文字として扱う", () => {
    const text = "## 主要検索キーワード\n- やりたいこと　仕事";
    const result = parseWorkProfileKeywords(text);
    expect(result.keyword1).toBe("やりたいこと");
    expect(result.keyword2).toBe("仕事");
  });
  it("空入力で空オブジェクトを返す", () => {
    expect(parseWorkProfileKeywords("")).toEqual({ keyword1: "", keyword2: "" });
  });
});

// ============================================================
// upsertChapterInOutput
// 章単位生成（STEP9）で章を1つずつ追加・置換する際の挙動
// ============================================================

describe("upsertChapterInOutput", () => {
  it("既存outputTextが空なら新規追加", () => {
    const result = upsertChapterInOutput("", "はじめに", "本文1", ["はじめに", "第1章"]);
    expect(result).toContain("=== はじめに ===");
    expect(result).toContain("本文1");
  });
  it("既存にあれば置換", () => {
    const initial = upsertChapterInOutput("", "はじめに", "古い本文", ["はじめに"]);
    const updated = upsertChapterInOutput(initial, "はじめに", "新しい本文", ["はじめに"]);
    expect(updated).toContain("新しい本文");
    expect(updated).not.toContain("古い本文");
  });
  it("chapterOrderTitles の順序で並ぶ（第2章を先に追加→はじめに追加→順序は はじめに→第2章）", () => {
    const orderTitles = ["はじめに", "第1章", "第2章", "おわりに"];
    let out = upsertChapterInOutput("", "第2章", "ch2", orderTitles);
    out = upsertChapterInOutput(out, "はじめに", "intro", orderTitles);
    const { sections } = parseOutputSections(out);
    expect(sections.map((s) => s.title)).toEqual(["はじめに", "第2章"]);
  });
});

// ============================================================
// stripChapterSection (legacy)
// dedupeBodyHeaders が主役だが、後方互換性として動作確認
// ============================================================

describe("stripChapterSection (legacy)", () => {
  it("isFirst=true のときは何もしない", () => {
    const text = "第1章 概要\n(1) 節\n① 項\n本文";
    expect(stripChapterSection(text, true)).toBe(text);
  });
  it("isFirst=false かつ 第N章/(N) で始まれば章+節を削る", () => {
    const text = "第1章 概要\n(1) 節\n② 項\n本文";
    const result = stripChapterSection(text, false);
    expect(result).not.toMatch(/^第1章/);
    expect(result).not.toMatch(/^\(1\)/);
    expect(result).toContain("② 項");
  });
});

// ============================================================
// resolveAutofillSync
// 「上流STEPの出力が新しくなったら、下流のautoFill欄を再転記なしで自動更新する。
//  ただしユーザーが手編集した欄は上書きしない」挙動の回帰テスト。
// 元の不具合：autoFillが空欄のときしか投入されず、STEP4を更新してもSTEP5の欄が旧値のまま固定された。
// ============================================================

describe("resolveAutofillSync", () => {
  // テスト用の決定的ハッシュ（中身が見えるように接頭辞付与）
  const h = (s) => `h:${s}`;

  it("空欄なら上流値を投入し、マーカーも設定する", () => {
    const r = resolveAutofillSync("", undefined, "NEW", h);
    expect(r.value).toBe("NEW");
    expect(r.markerHash).toBe("h:NEW");
  });

  it("上流が空なら何もしない（既存値を消さない）", () => {
    const r = resolveAutofillSync("既存", "h:既存", "", h);
    expect(r.value).toBeNull();
    expect(r.markerHash).toBeNull();
  });

  it("旧データ（マーカー無し）で値が古ければ最新へ治す", () => {
    const r = resolveAutofillSync("OLD", undefined, "NEW", h);
    expect(r.value).toBe("NEW");
    expect(r.markerHash).toBe("h:NEW");
  });

  it("旧データ（マーカー無し）で既に最新なら値は変えずマーカーだけ設定", () => {
    const r = resolveAutofillSync("NEW", undefined, "NEW", h);
    expect(r.value).toBeNull();
    expect(r.markerHash).toBe("h:NEW");
  });

  it("未編集（前回同期値のまま）かつ上流が更新 → 再同期する", () => {
    const r = resolveAutofillSync("OLD", "h:OLD", "NEW", h);
    expect(r.value).toBe("NEW");
    expect(r.markerHash).toBe("h:NEW");
  });

  it("ユーザーが手編集した欄（マーカーと不一致）は上書きしない", () => {
    const r = resolveAutofillSync("MY EDIT", "h:OLD", "NEW", h);
    expect(r.value).toBeNull();
    expect(r.markerHash).toBeNull();
  });

  it("既に最新と同期済み（current=marker=src）なら何もしない", () => {
    const r = resolveAutofillSync("NEW", "h:NEW", "NEW", h);
    expect(r.value).toBeNull();
    expect(r.markerHash).toBeNull();
  });
});
