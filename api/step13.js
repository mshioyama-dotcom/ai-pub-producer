// Vercel Serverless Function - STEP13「出版経験の振り返り」オーケストレータ
//
// 設計概要:
//   STEP12 の改善提案レポート + 現在の著者プロファイル + 著者の振り返りコメント を入力に、
//   AI が以下を生成する：
//     1. 著者プロファイル更新案（主役・著者が編集して STEP0 に上書き保存できる完成形）
//     2. 次回作テーマ候補（参考・3〜5案の方向性のみ・書籍プロファイル草案は作らない）
//
//   このSTEPは「著者として進化する」ことに集中する。出版経験で学んだ固有概念・主張・スキルを
//   著者プロファイルに反映し、次回作以降の全STEPの精度を一段上げる。
//   次回作テーマは参考情報。実際に書くかは著者の判断で、新プロジェクト作成は STEP1 へ手動で進む。
//
// クライアント送信ペイロード:
//   {
//     step12_analysis_text: string,    // STEP12 の改善提案レポート（必須・自動転記）
//     current_author_profile: string,  // 現在の著者プロファイル（必須・自動転記）
//     reflection_comment: string,      // 著者の振り返りコメント（任意）
//     work_profile: string,            // 書籍プロファイル確定版（任意・参考）
//   }
//
// レスポンス:
//   {
//     updated_author_profile: string,  // 著者プロファイル更新版（編集可能な完成形マークダウン）
//     next_book_themes: string,        // 次回作テーマ候補（3〜5案・参考情報）
//     warnings: string[],
//   }
//
// 必要な環境変数:
//   - DIFY_API_KEY_STEP13 (STEP13 出版経験の振り返り Dify ワークフロー)

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

// Dify 出力からセクションを分離するヘルパー
// Dify が 1 つの text 出力で「著者プロファイル更新版」「次回作テーマ候補」を返す前提で、
// マーカーを使って分割する。マーカーが見つからない場合は全部 updated_author_profile に入れる。
function splitOutput(text) {
  if (!text) return { updated_author_profile: "", next_book_themes: "" };
  const marker = /<<<\s*次回作テーマ\s*>>>/i;
  if (marker.test(text)) {
    const [profile, themes] = text.split(marker);
    return {
      updated_author_profile: (profile || "").trim(),
      next_book_themes: (themes || "").trim(),
    };
  }
  // マーカー無しなら、見出し「## 次回作テーマ候補」で分割
  const headingMatch = text.match(/(##\s*次回作テーマ候補[\s\S]*)/);
  if (headingMatch) {
    const profile = text.slice(0, headingMatch.index).trim();
    const themes = headingMatch[1].trim();
    return { updated_author_profile: profile, next_book_themes: themes };
  }
  return { updated_author_profile: text.trim(), next_book_themes: "" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const difyKey = process.env.DIFY_API_KEY_STEP13;
  if (!difyKey) {
    return res.status(500).json({
      error: "DIFY_API_KEY_STEP13 が未設定です。Vercelの環境変数に設定してください。",
      missingEnv: ["DIFY_API_KEY_STEP13"],
    });
  }

  const { step12_analysis_text, current_author_profile, reflection_comment, work_profile } = req.body || {};

  if (!step12_analysis_text || !String(step12_analysis_text).trim()) {
    return res.status(400).json({
      error: "step12_analysis_text（STEP12 の改善提案レポート）が必須です。先に STEP12 で本の改善提案を生成してください。",
    });
  }
  if (!current_author_profile || !String(current_author_profile).trim()) {
    return res.status(400).json({
      error: "current_author_profile（現在の著者プロファイル）が必須です。STEP0 で著者プロファイルを生成してください。",
    });
  }

  const warnings = [];

  try {
    const stageOutput = await runDifyWorkflow(difyKey, {
      step12_analysis_text: String(step12_analysis_text).trim(),
      current_author_profile: String(current_author_profile).trim(),
      reflection_comment: String(reflection_comment || "").trim(),
      work_profile: String(work_profile || "").trim(),
    });

    const rawText = String(stageOutput || "").trim();
    if (!rawText || rawText.length < 100) {
      return res.status(502).json({
        error: "Dify から有効な振り返り結果が返ってきませんでした。",
        debug: { stageOutput },
      });
    }

    const { updated_author_profile, next_book_themes } = splitOutput(rawText);

    if (!updated_author_profile || updated_author_profile.length < 100) {
      warnings.push("著者プロファイル更新版が短すぎる可能性があります。Dify 出力をご確認ください。");
    }

    return res.status(200).json({
      updated_author_profile,
      next_book_themes,
      raw_output: rawText, // フォールバック：分割失敗時に手動で参照
      warnings,
    });

  } catch (error) {
    return res.status(500).json({
      error: `STEP13 処理中にエラーが発生しました: ${error.message}`,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
}
