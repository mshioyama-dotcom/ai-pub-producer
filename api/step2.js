// Vercel Serverless Function - 新STEP2「キーワード絞り込み」オーケストレータ (v4新規)
//
// 設計概要:
//   フロントエンドからの単一POSTで以下を実行する:
//     1. Dify ワークフロー A (STEP2A_キーワード生成) を呼び出し、書籍プロファイル草案から
//        キーワード候補10個を生成する
//     2. 各キーワードについて Real-Time Amazon Data API (RapidAPI経由・Product Search)
//        を Promise.all で並列呼び出しする
//     3. 取得した上位本データから「発売予定日（未発売本）」を除外し、需要スコア・競合スコアを
//        Node側で機械計算する
//     4. Dify ワークフロー B (STEP2B_スコア判定) を呼び出し、LLMによる意図合致判定 + AI推奨 +
//        STEP1への戻り判定 + 戻り推奨時の修正示唆フィードバックを生成する
//     5. すべての結果を統合した JSON をフロントに返す
//
// クライアント送信ペイロード:
//   {
//     work_profile_draft: string,   // STEP1の書籍プロファイル草案（必須）
//     author_profile: string,       // 著者プロファイル全文（任意）
//     publishing_goal: string,      // 出版目標テキスト（任意）
//     return_feedback: string,      // 前回戻り時のフィードバック（任意・通常は空）
//   }
//
// レスポンス:
//   {
//     keywords: string[],                                  // 生成された10キーワード
//     market_data: Array<{ keyword: string, books: BookData[], total_products: number }>,
//     scored: Array<{ keyword, demand, competition_weakness, ... }>, // 機械計算スコア
//     judgment_text: string,                               // LLM判定結果（マークダウン）
//     ai_recommendation: "proceed_to_step3" | "return_to_step1",
//     return_feedback_for_step1: string | null,            // 戻り推奨時のみセット
//     warnings: string[],                                  // 警告メッセージ（任意）
//   }
//
// 必要な環境変数:
//   - DIFY_API_KEY_STEP02A  (キーワード生成ワークフロー)
//   - DIFY_API_KEY_STEP02B  (スコア判定ワークフロー)
//   - RAPIDAPI_KEY          (Real-Time Amazon Data 認証)
//   - RAPIDAPI_HOST         (デフォルト: real-time-amazon-data.p.rapidapi.com)

const DIFY_API_BASE = "https://api.dify.ai/v1";
const RAPIDAPI_DEFAULT_HOST = "real-time-amazon-data.p.rapidapi.com";
const RAPIDAPI_SEARCH_ENDPOINT = "/search";
const KEYWORD_COUNT = 10;

// Dify workflow runner（blocking モード）
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

// LLM出力からJSON配列を抽出する（マークダウンコードフェンスを許容）
function extractJsonArray(text) {
  if (!text || typeof text !== "string") return null;
  // ```json ... ``` パターン
  const fenceMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }
  // 素のJSON配列
  const arrayMatch = text.match(/(\[[\s\S]*?\])/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[1]); } catch {}
  }
  return null;
}

// RapidAPI Product Search 単発呼出
async function searchAmazonProducts(keyword, apiKey, host) {
  const url = `https://${host}${RAPIDAPI_SEARCH_ENDPOINT}?query=${encodeURIComponent(keyword)}&country=JP&page=1`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": host,
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RapidAPI error for "${keyword}" (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  // 仕様: data.data.total_products と data.data.products[] が返る
  return {
    keyword,
    total_products: Number(data?.data?.total_products) || 0,
    products: Array.isArray(data?.data?.products) ? data.data.products : [],
  };
}

// 「発売予定日」表記の本を除外（v4 仕様: 未発売本はスコアリングから除外）
function isReleasedBook(product) {
  if (!product) return false;
  const delivery = product?.delivery || "";
  return !String(delivery).includes("発売予定日");
}

// ASIN先頭2文字で「最近の新刊」を判定（B0G/B0H = 概ね2022〜2025年）
// 完全な判定ではないが、相対比較用の補助スコアとして利用
function isRecentKindleAsin(asin) {
  if (!asin || typeof asin !== "string") return false;
  const head3 = asin.slice(0, 3).toUpperCase();
  return head3 === "B0G" || head3 === "B0H";
}

// 配列の中央値（数値配列・空なら 0）
function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 機械スコアリング: 10候補すべての相対ランクから 10〜1点を割り当てる
// 入力: marketDataArray = [{ keyword, total_products, products: [...] }] × 10
// 出力: scoredArray = [{ keyword, demand_score, competition_weakness_score, top_books: [...] }] × 10
function computeMechanicalScores(marketDataArray) {
  const enriched = marketDataArray.map((entry) => {
    const released = (entry.products || []).filter(isReleasedBook);
    const ratingCounts = released.map((p) => Number(p.product_num_ratings) || 0);
    const recentCount = released.filter((p) => isRecentKindleAsin(p.asin)).length;
    const newRatio = released.length > 0 ? recentCount / released.length : 0;
    return {
      keyword: entry.keyword,
      total_products: entry.total_products,
      released_count: released.length,
      median_reviews: median(ratingCounts),
      new_ratio: newRatio,
      top_books: released.slice(0, 10).map((p) => ({
        asin: p.asin || "",
        product_title: p.product_title || "",
        product_star_rating: p.product_star_rating || null,
        product_num_ratings: Number(p.product_num_ratings) || 0,
        product_url: p.product_url || "",
        book_format: p.book_format || "",
        kindle_unlimited: !!p.kindle_unlimited,
      })),
    };
  });

  // 需要スコア: total_products 多い順に 10..1 + new_ratio による加点（最大+2）
  const byDemand = [...enriched].sort((a, b) => b.total_products - a.total_products);
  byDemand.forEach((entry, idx) => {
    entry.demand_rank = idx + 1;
    entry.demand_score = Math.max(1, KEYWORD_COUNT - idx) + Math.round(entry.new_ratio * 2);
    if (entry.demand_score > 10) entry.demand_score = 10;
  });

  // 競合の弱さスコア: median_reviews 少ない順に 10..1（少ない=参入しやすい=高得点）
  const byCompetition = [...enriched].sort((a, b) => a.median_reviews - b.median_reviews);
  byCompetition.forEach((entry, idx) => {
    entry.competition_rank = idx + 1;
    entry.competition_weakness_score = Math.max(1, KEYWORD_COUNT - idx);
  });

  // 元の順序に戻す（marketDataArray の順序）
  const byKeyword = new Map(enriched.map((e) => [e.keyword, e]));
  return marketDataArray.map((m) => byKeyword.get(m.keyword)).filter(Boolean);
}

// スコア判定LLMに渡すためのマーケットデータ要約文を生成
function buildMarketDataSummary(scoredArray) {
  return scoredArray.map((entry, idx) => {
    const topBooksLines = (entry.top_books || []).slice(0, 5).map((b, i) =>
      `    ${i + 1}. ${b.product_title} (ASIN: ${b.asin} / レビュー数: ${b.product_num_ratings} / 評価: ${b.product_star_rating || "N/A"})`
    ).join("\n");
    return [
      `【${idx + 1}】キーワード: "${entry.keyword}"`,
      `  検索ヒット総数: ${entry.total_products}件`,
      `  発売済み上位本数: ${entry.released_count}件`,
      `  上位10冊レビュー数中央値: ${entry.median_reviews}`,
      `  直近新刊比率: ${(entry.new_ratio * 100).toFixed(1)}%`,
      `  需要スコア(機械): ${entry.demand_score}/10`,
      `  競合の弱さスコア(機械): ${entry.competition_weakness_score}/10`,
      `  上位本サンプル:`,
      topBooksLines || "    (上位本なし)",
    ].join("\n");
  }).join("\n\n");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 必須環境変数チェック（未設定の場合はエラーで早期return）
  const difyKeyA = process.env.DIFY_API_KEY_STEP02A;
  const difyKeyB = process.env.DIFY_API_KEY_STEP02B;
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || RAPIDAPI_DEFAULT_HOST;

  const missingEnv = [];
  if (!difyKeyA) missingEnv.push("DIFY_API_KEY_STEP02A");
  if (!difyKeyB) missingEnv.push("DIFY_API_KEY_STEP02B");
  if (!rapidApiKey) missingEnv.push("RAPIDAPI_KEY");
  if (missingEnv.length > 0) {
    return res.status(500).json({
      error: `必要な環境変数が未設定です: ${missingEnv.join(", ")}。Vercelの環境変数設定をご確認ください。`,
      missingEnv,
    });
  }

  const { work_profile_draft, author_profile, publishing_goal, return_feedback } = req.body || {};

  if (!work_profile_draft || !String(work_profile_draft).trim()) {
    return res.status(400).json({ error: "work_profile_draft（STEP1の書籍プロファイル草案）が必須です。" });
  }

  const warnings = [];

  try {
    // === Stage 1: Dify ワークフロー A で 10キーワード生成 ===
    const stageAOutput = await runDifyWorkflow(difyKeyA, {
      work_profile_draft: String(work_profile_draft).trim(),
      author_profile: String(author_profile || "").trim(),
      publishing_goal: String(publishing_goal || "").trim(),
      return_feedback: String(return_feedback || "").trim(),
    });
    const keywords = extractJsonArray(stageAOutput);
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(502).json({
        error: "Dify ワークフロー A（キーワード生成）から有効なキーワード配列が返ってきませんでした。",
        debug: { stageAOutput },
      });
    }
    const trimmedKeywords = keywords
      .map((k) => String(k || "").trim())
      .filter(Boolean)
      .slice(0, KEYWORD_COUNT);

    if (trimmedKeywords.length < KEYWORD_COUNT) {
      warnings.push(`キーワード生成数が ${trimmedKeywords.length}/${KEYWORD_COUNT} 個でした。後段スコアリング精度に影響する可能性があります。`);
    }

    // === Stage 2: RapidAPI Product Search を並列呼出 ===
    const marketDataResults = await Promise.allSettled(
      trimmedKeywords.map((kw) => searchAmazonProducts(kw, rapidApiKey, rapidApiHost))
    );
    const marketData = marketDataResults.map((r, idx) => {
      if (r.status === "fulfilled") return r.value;
      warnings.push(`キーワード "${trimmedKeywords[idx]}" のAmazon検索でエラー: ${r.reason?.message || r.reason}`);
      return { keyword: trimmedKeywords[idx], total_products: 0, products: [] };
    });

    // === Stage 3: Node 側で機械スコアリング ===
    const scored = computeMechanicalScores(marketData);

    // === Stage 4: Dify ワークフロー B で LLM 意図合致判定＋AI推奨＋戻り判定 ===
    const marketSummary = buildMarketDataSummary(scored);
    const stageBOutput = await runDifyWorkflow(difyKeyB, {
      work_profile_draft: String(work_profile_draft).trim(),
      author_profile: String(author_profile || "").trim(),
      publishing_goal: String(publishing_goal || "").trim(),
      market_data_summary: marketSummary,
      keywords_json: JSON.stringify(trimmedKeywords),
    });

    // === Stage 5: judgment_text から ai_recommendation と feedback を簡易パース ===
    const judgmentText = String(stageBOutput || "");
    const recommendsReturn = /推奨キーワード\s*[:：]?\s*0\s*個|STEP\s*1\s*に戻る/i.test(judgmentText);
    const ai_recommendation = recommendsReturn ? "return_to_step1" : "proceed_to_step3";

    // 戻り推奨時はマークダウンの戻り示唆セクションをそのまま渡す（フロントで保存→STEP1表示）
    let return_feedback_for_step1 = null;
    if (recommendsReturn) {
      // 「【AIからのフィードバック】」以降を抽出（無ければ全文）
      const feedbackMatch = judgmentText.match(/【AIからのフィードバック】[\s\S]*$/);
      return_feedback_for_step1 = feedbackMatch ? feedbackMatch[0] : judgmentText;
    }

    return res.status(200).json({
      keywords: trimmedKeywords,
      market_data: marketData,
      scored,
      judgment_text: judgmentText,
      ai_recommendation,
      return_feedback_for_step1,
      warnings,
    });

  } catch (error) {
    return res.status(500).json({
      error: `STEP2 処理中にエラーが発生しました: ${error.message}`,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
}
