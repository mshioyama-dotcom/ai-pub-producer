// Vercel Serverless Function - Dify API Proxy
const DIFY_API_BASE = "https://api.dify.ai/v1";

// v4改修(2026-05): 番号繰り上げ後の対応表
//   旧STEP3 (エピソードインタビュー)   → 新STEP4
//   旧STEP4 (タイトル・サブタイトル)   → 新STEP5
//   旧STEP5 (目次作成)                 → 新STEP6
//   旧STEP6 (章構成作成)               → 新STEP7
//   旧STEP7 (詳細プロット作成)         → 新STEP8
//   旧STEP8 (本文作成)                 → 新STEP9
//   旧STEP9 (Amazon説明文作成)         → 新STEP10
// 新STEP2 (キーワード絞り込み) と 新STEP3 (競合レビュー評価) は本ファイルを通らず
// api/step2.js / api/step3.js (実装は優先度3後半) でそれぞれ専用フローを呼ぶ。
//
// 既存の DIFY_API_KEY_STEP03〜09 はそのまま流用する設計（中身のDify workflowは変更不要）。
// 新STEP4のリクエストが来たら DIFY_API_KEY_STEP03 を使う、というシフトを resolveApiKey で吸収する。
const API_KEYS = {
  0:  process.env.DIFY_API_KEY_STEP00_A,
  1:  process.env.DIFY_API_KEY_STEP01,
  2:  process.env.DIFY_API_KEY_STEP02,   // 旧STEP2(廃止)・新STEP2はapi/step2.js経由なので未使用
  3:  process.env.DIFY_API_KEY_STEP03,   // 旧STEP3 エピソード - 新STEP4 用に流用
  4:  process.env.DIFY_API_KEY_STEP04,   // 旧STEP4 タイトル - 新STEP5 用に流用
  5:  process.env.DIFY_API_KEY_STEP05,   // 旧STEP5 目次 - 新STEP6 用に流用
  6:  process.env.DIFY_API_KEY_STEP06,   // 旧STEP6 章構成 - 新STEP7 用に流用
  7:  process.env.DIFY_API_KEY_STEP07,   // 旧STEP7 プロット - 新STEP8 用に流用
  8:  process.env.DIFY_API_KEY_STEP08,   // 旧STEP8 本文 - 新STEP9 用に流用
  9:  process.env.DIFY_API_KEY_STEP09,   // 旧STEP9 Amazon説明文 - 新STEP10 用に流用
  11: process.env.DIFY_API_KEY_STEP11,   // 新STEP11 X投稿生成（新規ワークフロー）
};

// 新stepNum → 使用する API Key を解決する
// 新STEP4〜10 のリクエストは旧キー3〜9 にルーティング、新STEP11 以降は独自キー
function resolveApiKey(newStepNum) {
  if (newStepNum <= 3) return API_KEYS[newStepNum];
  if (newStepNum >= 11) return API_KEYS[newStepNum];
  return API_KEYS[newStepNum - 1];
}

function mapInputs(stepNum, inputs) {
  const m = { ...inputs };

  // STEP1: theme をそのまま渡す（変換不要）
  // STEP2: api/step2.js 経由のため本関数は通らない
  // STEP3: api/step3.js (実装予定) 経由のため本関数は通らない
  // STEP4 (エピソードインタビュー): チャット型のため dify-chat.js 側、本関数は通らない

  // 新STEP5 (旧STEP4 タイトル・サブタイトル作成)。theme_output 入力は廃止
  if (stepNum === 5) {
    if (m.keyword1 !== undefined)       { m.kw1 = m.keyword1; delete m.keyword1; }
    if (m.keyword2 !== undefined)       { m.kw2 = m.keyword2; delete m.keyword2; }
    if (m.interview_text !== undefined) { m.diff_elements = m.interview_text; delete m.interview_text; }
  }

  // 新STEP6 (旧STEP5 目次作成)。blueprint 入力は廃止
  // title / subtitle は getAutoInjectedProfiles から自動注入（STEP5で確定された値）
  if (stepNum === 6) {
    if (m.interview_text !== undefined) { m.interview_notes = m.interview_text; delete m.interview_text; }
  }

  // 新STEP7 (旧STEP6 章構成作成)。blueprint 入力は廃止
  if (stepNum === 7) {
    if (m.toc_text !== undefined)       { m.refined_toc = m.toc_text; delete m.toc_text; }
    if (m.interview_text !== undefined) { m.interview_notes = m.interview_text; delete m.interview_text; }
  }

  // 新STEP8 (旧STEP7 詳細プロット作成)
  if (stepNum === 8) {
    if (m.chapter_outline_text !== undefined) { m.plot_instruction = m.chapter_outline_text; delete m.chapter_outline_text; }
    if (m.added_episode_text !== undefined)   { m.added_episodes = m.added_episode_text; delete m.added_episode_text; }
  }

  // 新STEP9 (旧STEP8 本文作成)
  if (stepNum === 9) {
    if (m.past_writing_text !== undefined) { m.past_writing_data = m.past_writing_text; delete m.past_writing_text; }
  }

  // 新STEP10 (旧STEP9 Amazon説明文作成)。reader_value_design 入力は廃止
  if (stepNum === 10) {
    if (m.interview_text !== undefined)      { m.author_episode = m.interview_text; delete m.interview_text; }
    if (m.outline_text !== undefined)        { m.toc_text = m.outline_text; delete m.outline_text; }
  }

  // 新STEP11 X投稿生成。Dify YML 変数名がそのまま使えるため特別な remap は不要。
  // - author_profile / work_profile は getAutoInjectedProfiles で自動注入
  // - amazon_description_text は STEP10 出力から autoFill
  // - tweet_length / total_count はユーザー選択
  // ※ Dify YML の変数名と完全一致しているため、ここでは何もしない（明示的にコメントだけ残す）
  // if (stepNum === 11) { /* no remap needed */ }

  return m;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { stepNum, inputs } = req.body;
  if (stepNum === undefined || stepNum === null || !inputs) return res.status(400).json({ error: "stepNum and inputs are required" });

  const apiKey = resolveApiKey(stepNum);
  if (!apiKey) return res.status(400).json({ error: `No API key configured for STEP${stepNum}` });

  const difyInputs = mapInputs(stepNum, inputs);

  try {
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: difyInputs,
        response_mode: "blocking",
        user: "ai-pub-producer-user",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Dify API error: ${errorText}` });
    }

    const data = await response.json();
    const outputs = data?.data?.outputs || {};
    const output = outputs.text
      || outputs.output
      || outputs.result
      || outputs.author_profile
      || outputs.final_report
      || JSON.stringify(outputs, null, 2);

    // --- DEBUG LOG (for Vercel logs) ---
    const rawText = outputs.text;
    const rawTextLen = (rawText || "").length;
    const outputLen = (output || "").length;
    const rawTextTail = rawText ? String(rawText).slice(-30) : "(empty)";
    const outputKeys = Object.keys(outputs).join(",");
    const workflowStatus = data?.data?.status || "unknown";
    const workflowError = data?.data?.error || "";
    console.log(`[DIFY_DEBUG] STEP${stepNum} status=${workflowStatus} keys=[${outputKeys}] outputLen=${outputLen} rawTextLen=${rawTextLen} tail="${rawTextTail}" error="${workflowError}"`);
    // --- END DEBUG ---

    // 出力が空の場合は診断情報をクライアントに返す。
    // Dify が `{ text: "" }` のように空文字のみを返すケースも検出（rawText未定義 or trim後0文字）。
    const rawTextTrimmedLen = (rawText || "").trim().length;
    const isEffectivelyEmpty = rawTextTrimmedLen === 0 || outputLen <= 10;
    if (isEffectivelyEmpty) {
      return res.status(200).json({
        output,
        diagnostic: {
          workflowStatus,
          workflowError,
          outputKeys,
          outputsRaw: outputs,
          rawTextTrimmedLen,
          message: `Dify が空または短い出力を返しました（rawText: ${rawTextTrimmedLen}文字 / output: ${outputLen}文字）。考えられる原因: (1) Dify Cloud の YML 再import 後、プロンプト内の変数参照（{{#XXX.title#}}等）が新しい NodeID とマッチしていない、(2) 出力ノード（end/output）の text 接続が外れている、(3) LLM ノードでエラーが起きている。Dify Cloud でこのアプリの「実行履歴」を開き、最新実行の各ノードの input/output を確認してください。`,
        },
      });
    }

    return res.status(200).json({ output });

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}