// Vercel Serverless Function - 書籍プロファイル確定アクション オーケストレータ (v4新規)
//
// 設計概要:
//   STEP1草案 + STEP2選定キーワード+上位本タイトル一覧 + STEP3分析結果 を統合した
//   書籍プロファイル確定版（マークダウン構造化テキスト）を Dify ワークフローで生成する。
//
//   フロント側の Step2_Analysis から上位本タイトル一覧を Node 側で整形して Dify に渡す。
//   v4実装指示書 §6 を参照。
//
// クライアント送信ペイロード:
//   {
//     work_profile_draft: string,         // STEP1の書籍プロファイル草案（必須）
//     author_profile: string,             // 著者プロファイル全文（任意）
//     publishing_goal: string,            // 出版目標テキスト（任意）
//     selected_keywords: string[],        // STEP2で選定したキーワード1〜2個（必須）
//     selected_books_for_context: Array<{ asin, product_title, ... }>, // 上位本（任意・コンテキスト用）
//     step3_analysis_text: string,        // STEP3の分析結果全文マークダウン（必須）
//   }
//
// レスポンス:
//   {
//     work_profile_final: string,         // 書籍プロファイル確定版 マークダウン全文
//     warnings: string[],
//   }
//
// 必要な環境変数:
//   - DIFY_API_KEY_STEP_CONFIRM           (書籍プロファイル確定 Dify ワークフロー)

const DIFY_API_BASE = "https://api.dify.ai/v1";

async function runDifyWorkflow(apiKey, inputs) {
  const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs,
      response_mode: "blocking",
      user: "ai-pub-producer-user",
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dify API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const output = data?.data?.outputs?.text
    || data?.data?.outputs?.output
    || data?.data?.outputs?.result
    || JSON.stringify(data?.data?.outputs || {});
  return output;
}

// 確定版テキストから検索キーワード（旧3軸形式と新「主要検索キーワード」セクション形式の両方に対応）
// 旧形式: `主題軸: XXX` のインライン
// 新形式: `## 主要検索キーワード\n- XXX\n- YYY` のセクション+箇条書き
function extractKeywords3Axes(text) {
  if (!text) return { theme: "", reader: "", diff: "" };
  const grab = (label) => {
    const re = new RegExp(`(?:^|\\n)\\s*[\\-・*+]?\\s*${label}\\s*[：:]\\s*([^\\n]+)`);
    const m = text.match(re);
    return m ? m[1].replace(/\*+/g, "").trim() : "";
  };
  return { theme: grab("主題軸"), reader: grab("読者軸"), diff: grab("差分軸") };
}

// 「## 主要検索キーワード」セクションから箇条書きキーワードを抽出
// 新形式の Dify 出力に対応。1個でも複数でも検出する。
function extractMainKeywordsSection(text) {
  if (!text) return [];
  // セクション見出し検出: ## / ### に「主要検索キーワード」「検索キーワード」「キーワード」のいずれか
  const sectionRe = /(?:^|\n)#{2,3}\s*(?:主要)?検索キーワード[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|\n*$)/;
  const m = text.match(sectionRe);
  if (!m) return [];
  // セクション本文から箇条書き行を抽出
  const lines = m[1].split(/\n/);
  const keywords = [];
  for (const line of lines) {
    const bullet = line.match(/^\s*[\-・*+]\s*(.+?)\s*$/);
    if (bullet) {
      const kw = bullet[1].replace(/\*+/g, "").trim();
      if (kw) keywords.push(kw);
    }
  }
  return keywords;
}

// STEP2 で選定したキーワードが、Dify から返ってきた確定版で書き換えられていないか検証。
// 書き換えられていれば、STEP2 選定値で強制的に上書きして warnings に明示する。
//
// 設計意図: STEP2 はAmazon検索のスコアデータに基づいてキーワードを確定する工程。
// この結果を確定アクションのLLMが「コンセプト整合性」を理由に書き換えるのは、
// 市場検証されていないキーワードで本書を設計することになり、本来の運用上の意図に反する。
// もしキーワードを変えたい場合は STEP2 のキーワード分析からやり直すのが正しいフロー。
//
// 動作方針（堅牢化）:
//   ① 新形式「## 主要検索キーワード」セクション → 含まれていれば合格、不一致なら置換
//   ② 旧形式「主題軸: XXX」インライン → 一致すれば合格（読者軸/差分軸はLLM任せ）、不一致なら置換
//   ③ どちらの形式も無い → 確定版末尾に「## 主要検索キーワード（STEP2選定・固定）」を追記
//   ※ どんな出力形式でも、最終的に STEP2 選定値が確定版に必ず残ることを保証する
function enforceSelectedKeywords(confirmedText, selectedKeywords) {
  const warnings = [];
  if (!Array.isArray(selectedKeywords) || selectedKeywords.length === 0) {
    return { text: confirmedText, warnings };
  }
  // 選定キーワードを正規化（全角/半角スペースの違いを吸収）
  const normalize = (s) => String(s || "").replace(/[\s　]+/g, " ").trim();
  const expectedRaw = selectedKeywords.map((s) => String(s).trim()).filter(Boolean);
  const expectedNorm = expectedRaw.map(normalize);
  if (expectedRaw.length === 0) return { text: confirmedText, warnings };

  // ① 新形式: 「## 主要検索キーワード」セクション
  const mainSectionKws = extractMainKeywordsSection(confirmedText).map(normalize);
  if (mainSectionKws.length > 0) {
    const allIncluded = expectedNorm.every((kw) => mainSectionKws.includes(kw));
    if (allIncluded) {
      return { text: confirmedText, warnings }; // 既に反映済み → そのまま
    }
    // セクション本文を STEP2 選定値で置換
    const sectionRe = /((?:^|\n)#{2,3}\s*(?:主要)?検索キーワード[^\n]*\n)([\s\S]*?)(?=\n#{1,3}\s|\n*$)/;
    const replacedSection = expectedRaw.map((kw) => `- ${kw}`).join("\n") + "\n";
    const replaced = confirmedText.replace(sectionRe, `$1${replacedSection}`);
    warnings.push(
      `⚠ Dify の確定アクション LLM が「主要検索キーワード」セクションを STEP2 選定値（${expectedRaw.join("、")}）と異なる値（${mainSectionKws.join("、")}）で出力していたため、STEP2 選定値に復元しました。`
      + ` 市場検証していないキーワードへの自動変更は無効化されます。`
      + ` 本当にキーワードを変えたい場合は、STEP2 のキーワード分析からやり直してください。`
    );
    return { text: replaced, warnings };
  }

  // ② 旧形式: 「主題軸: XXX」インライン
  const extracted = extractKeywords3Axes(confirmedText);
  const expectedTheme = expectedRaw[0];
  const expectedThemeNorm = expectedNorm[0];
  if (extracted.theme) {
    if (normalize(extracted.theme) === expectedThemeNorm) {
      return { text: confirmedText, warnings }; // 主題軸 = STEP2 選定値1個目 → 合格（読者軸/差分軸はLLM任せ）
    }
    // 主題軸を STEP2 選定値で置換
    const themeLineRe = /((?:^|\n)\s*[\-・*+]?\s*主題軸\s*[：:]\s*)([^\n]+)/;
    if (themeLineRe.test(confirmedText)) {
      const replaced = confirmedText.replace(themeLineRe, `$1${expectedTheme}`);
      warnings.push(
        `⚠ Dify の確定アクション LLM が主題軸を STEP2 選定値「${expectedTheme}」ではなく「${extracted.theme}」で出力していたため、STEP2 選定値に復元しました。`
        + ` 市場検証していないキーワードへの自動変更は無効化されます。`
        + ` 本当にキーワードを変えたい場合は、STEP2 のキーワード分析からやり直してください。`
      );
      return { text: replaced, warnings };
    }
  }

  // ③ どちらの形式も認識できない → 末尾に強制追記して STEP2 選定値を必ず残す
  const appendix = `\n\n---\n\n## 主要検索キーワード（STEP2選定・固定）\n${expectedRaw.map((kw) => `- ${kw}`).join("\n")}\n`;
  const replaced = confirmedText.replace(/\s*$/, "") + appendix;
  warnings.push(
    `⚠ Dify の確定アクション LLM 出力に「## 主要検索キーワード」セクションも「主題軸：」行も見つからなかったため、確定版の末尾に STEP2 選定値（${expectedRaw.join("、")}）を強制追記しました。`
    + ` STEP5/STEP6 のキーワード自動転記に必要なため、このセクションは編集しないでください。`
    + ` この警告が頻発する場合は、確定アクションの Dify YML プロンプトを見直してください。`
  );
  return { text: replaced, warnings };
}

// 上位本タイトル一覧をマークダウン箇条書きに整形（最大10冊）
function buildTopBooksTitles(selectedBooks) {
  if (!Array.isArray(selectedBooks) || selectedBooks.length === 0) return "";
  return selectedBooks.slice(0, 10).map((b, i) => {
    const title = (b.product_title || "（タイトル不明）").trim();
    const ratings = Number.isFinite(Number(b.product_num_ratings))
      ? `（レビュー${b.product_num_ratings}件）`
      : "";
    return `- ${title} ${ratings}`;
  }).join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const difyKey = process.env.DIFY_API_KEY_STEP_CONFIRM;
  if (!difyKey) {
    return res.status(500).json({
      error: "DIFY_API_KEY_STEP_CONFIRM が未設定です。Vercelの環境変数に確定アクション用Difyワークフローの APIキー を追加してください。",
      missingEnv: ["DIFY_API_KEY_STEP_CONFIRM"],
    });
  }

  const { work_profile_draft, author_profile, publishing_goal, selected_keywords, selected_books_for_context, step3_analysis_text } = req.body || {};

  if (!work_profile_draft || !String(work_profile_draft).trim()) {
    return res.status(400).json({ error: "work_profile_draft（STEP1の書籍プロファイル草案）が必須です。" });
  }
  if (!Array.isArray(selected_keywords) || selected_keywords.length === 0) {
    return res.status(400).json({ error: "selected_keywords（STEP2で選定したキーワード）が必須です。" });
  }
  if (!step3_analysis_text || !String(step3_analysis_text).trim()) {
    return res.status(400).json({ error: "step3_analysis_text（STEP3の分析結果）が必須です。STEP3を完了してから確定アクションへ進んでください。" });
  }

  const warnings = [];

  try {
    const topBooksTitles = buildTopBooksTitles(selected_books_for_context || []);
    if (!topBooksTitles) warnings.push("STEP2の上位本タイトル一覧が空でした。確定版の「競合本の傾向」セクションが薄くなる可能性があります。");

    const stageOutput = await runDifyWorkflow(difyKey, {
      work_profile_draft: String(work_profile_draft).trim(),
      author_profile: String(author_profile || "").trim(),
      publishing_goal: String(publishing_goal || "").trim(),
      selected_keywords_text: selected_keywords.join("、"),
      top_books_titles: topBooksTitles,
      step3_analysis_text: String(step3_analysis_text).trim(),
    });

    const workProfileFinalRaw = String(stageOutput || "").trim();
    if (!workProfileFinalRaw || workProfileFinalRaw.length < 100) {
      return res.status(502).json({
        error: "Dify から有効な書籍プロファイル確定版が返ってきませんでした。",
        debug: { stageOutput },
      });
    }

    // STEP2 で選定したキーワードが LLM に書き換えられていないか検証。
    // 書き換えられていれば STEP2 選定値に強制復元し、warnings に明示する。
    const enforced = enforceSelectedKeywords(workProfileFinalRaw, selected_keywords);
    const workProfileFinal = enforced.text;
    if (Array.isArray(enforced.warnings)) {
      warnings.push(...enforced.warnings);
    }

    return res.status(200).json({
      work_profile_final: workProfileFinal,
      warnings,
    });

  } catch (error) {
    return res.status(500).json({
      error: `書籍プロファイル確定処理中にエラーが発生しました: ${error.message}`,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
}
