// Vercel Serverless Function - 新STEP2「追加キーワード評価」オーケストレータ (v4 拡張)
//
// 設計概要:
//   既存の STEP2 分析結果（AI生成10キーワード）に対して、ユーザーが指定した追加キーワード
//   （1〜3個）を評価する。流れ:
//     1. 追加キーワードについて Real-Time Amazon Data API を呼び出す
//     2. 既存の market_data と統合して全件で再スコアリング（再ランキング）
//     3. Dify ワークフロー B (STEP2B_スコア判定) を呼び出して LLM 判定を再生成
//        ※ user_added_keywords を明示してプロンプトに渡す
//     4. 統合済み analysis を返す
//
// クライアント送信ペイロード:
//   {
//     work_profile_draft: string,              // STEP1の書籍プロファイル草案（必須）
//     author_profile: string,                  // 著者プロファイル全文（任意）
//     publishing_goal: string,                 // 出版目標テキスト（任意）
//     existing_market_data: array,             // 既存STEP2の market_data（必須）
//     existing_keywords: string[],             // 既存STEP2の keywords（必須）
//     existing_user_added: string[],           // 既にユーザー追加済みのキーワード（任意）
//     new_keywords: string[],                  // 今回追加するキーワード 1〜3個（必須）
//   }
//
// レスポンス:
//   {
//     keywords: string[],                                  // 統合後の全キーワード（AI+ユーザー追加）
//     market_data: Array<...>,                             // 統合後の market_data
//     scored: Array<...>,                                  // 統合後の再ランキング済みスコア
//     judgment_text: string,                               // 再生成された LLM 判定
//     ai_recommendation: "proceed_to_step3" | "return_to_step1",
//     user_added_keywords: string[],                       // ユーザー追加キーワード（累積）
//     warnings: string[],
//   }
//
// 必要な環境変数:
//   - DIFY_API_KEY_STEP02B  (スコア判定ワークフロー)
//   - RAPIDAPI_KEY
//   - RAPIDAPI_HOST (任意)
//
// NOTE: STEP2A（キーワード生成）は再実行しない。既存の10件＋追加キーワードに対して
//       Amazon検索＋機械スコアリング＋LLM判定 だけを再実行する。

const DIFY_API_BASE = "https://api.dify.ai/v1";
const RAPIDAPI_DEFAULT_HOST = "real-time-amazon-data.p.rapidapi.com";
const RAPIDAPI_SEARCH_ENDPOINT = "/search";
const MAX_NEW_KEYWORDS_PER_REQUEST = 3;

// ---- 以下、api/step2.js から複製（serverless function 間で安全に共有するため inline 化） ----

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

async function searchAmazonProducts(keyword, apiKey, host, maxRetries = 3) {
  const url = `https://${host}${RAPIDAPI_SEARCH_ENDPOINT}?query=${encodeURIComponent(keyword)}&country=JP&page=1`;
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
      },
    });
    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!response.ok) {
      const errText = await response.text();
      lastError = new Error(`RapidAPI error for "${keyword}" (${response.status}): ${errText.slice(0, 200)}`);
      throw lastError;
    }
    const data = await response.json();
    return {
      keyword,
      total_products: Number(data?.data?.total_products) || 0,
      products: Array.isArray(data?.data?.products) ? data.data.products : [],
    };
  }
  throw lastError || new Error(`RapidAPI: max retries reached for "${keyword}"`);
}

async function searchAmazonProductsBatched(keywords, apiKey, host, concurrency = 2, batchDelayMs = 1100) {
  const results = [];
  for (let i = 0; i < keywords.length; i += concurrency) {
    const batch = keywords.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((kw) => searchAmazonProducts(kw, apiKey, host))
    );
    results.push(...batchResults);
    if (i + concurrency < keywords.length) {
      await new Promise((r) => setTimeout(r, batchDelayMs));
    }
  }
  return results;
}

function isReleasedBook(product) {
  if (!product) return false;
  const delivery = product?.delivery || "";
  return !String(delivery).includes("発売予定日");
}

function isRecentKindleAsin(asin) {
  if (!asin || typeof asin !== "string") return false;
  const head3 = asin.slice(0, 3).toUpperCase();
  return head3 === "B0G" || head3 === "B0H";
}

function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 機械スコアリング: 全件（10件＋追加件）に対して相対ランクから配点する。
// keyword_count を引数で渡せるよう拡張（追加キーワード対応）
function computeMechanicalScores(marketDataArray) {
  const total = marketDataArray.length;
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

  // 需要スコア: total_products 多い順に total..1 + new_ratio による加点（最大+2、上限10）
  const byDemand = [...enriched].sort((a, b) => b.total_products - a.total_products);
  byDemand.forEach((entry, idx) => {
    entry.demand_rank = idx + 1;
    // 件数が10件以外でも常に最高点が10になるよう正規化（旧仕様: KEYWORD_COUNT - idx）
    // 件数 N 件のとき 1位=10, 最下位=1点になるよう線形マッピング
    const base = total <= 1 ? 10 : Math.round(10 - ((idx) * 9 / (total - 1)));
    entry.demand_score = Math.max(1, base + Math.round(entry.new_ratio * 2));
    if (entry.demand_score > 10) entry.demand_score = 10;
  });

  // 競合の弱さスコア: median_reviews 少ない順に 10..1
  const byCompetition = [...enriched].sort((a, b) => a.median_reviews - b.median_reviews);
  byCompetition.forEach((entry, idx) => {
    entry.competition_rank = idx + 1;
    const base = total <= 1 ? 10 : Math.round(10 - ((idx) * 9 / (total - 1)));
    entry.competition_weakness_score = Math.max(1, base);
  });

  const byKeyword = new Map(enriched.map((e) => [e.keyword, e]));
  return marketDataArray.map((m) => byKeyword.get(m.keyword)).filter(Boolean);
}

function buildMarketDataSummary(scoredArray, userAddedSet) {
  return scoredArray.map((entry, idx) => {
    const topBooksLines = (entry.top_books || []).slice(0, 5).map((b, i) =>
      `    ${i + 1}. ${b.product_title} (ASIN: ${b.asin} / レビュー数: ${b.product_num_ratings} / 評価: ${b.product_star_rating || "N/A"})`
    ).join("\n");
    const tag = userAddedSet && userAddedSet.has(entry.keyword) ? "  ★ユーザー追加キーワード" : "";
    return [
      `【${idx + 1}】キーワード: "${entry.keyword}"${tag}`,
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

  const difyKeyB = process.env.DIFY_API_KEY_STEP02B;
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || RAPIDAPI_DEFAULT_HOST;

  const missingEnv = [];
  if (!difyKeyB) missingEnv.push("DIFY_API_KEY_STEP02B");
  if (!rapidApiKey) missingEnv.push("RAPIDAPI_KEY");
  if (missingEnv.length > 0) {
    return res.status(500).json({
      error: `必要な環境変数が未設定です: ${missingEnv.join(", ")}。Vercelの環境変数設定をご確認ください。`,
      missingEnv,
    });
  }

  const {
    work_profile_draft,
    author_profile,
    publishing_goal,
    existing_market_data,
    existing_keywords,
    existing_user_added,
    new_keywords,
  } = req.body || {};

  // ---- 入力バリデーション ----
  if (!work_profile_draft || !String(work_profile_draft).trim()) {
    return res.status(400).json({ error: "work_profile_draft（STEP1の書籍プロファイル草案）が必須です。" });
  }
  if (!Array.isArray(existing_market_data) || existing_market_data.length === 0) {
    return res.status(400).json({
      error: "existing_market_data が空です。先に STEP2「キーワード分析を実行」してから追加評価を実行してください。",
    });
  }
  if (!Array.isArray(existing_keywords) || existing_keywords.length === 0) {
    return res.status(400).json({ error: "existing_keywords が空です。先に STEP2 を実行してください。" });
  }
  if (!Array.isArray(new_keywords) || new_keywords.length === 0) {
    return res.status(400).json({ error: "new_keywords（追加するキーワード）を 1〜3 個指定してください。" });
  }

  // 正規化＋重複排除
  const normalizedNew = Array.from(new Set(
    new_keywords.map((k) => String(k || "").trim()).filter(Boolean)
  )).slice(0, MAX_NEW_KEYWORDS_PER_REQUEST);

  if (normalizedNew.length === 0) {
    return res.status(400).json({ error: "追加キーワードが空または空白のみです。" });
  }
  if (normalizedNew.length > MAX_NEW_KEYWORDS_PER_REQUEST) {
    return res.status(400).json({
      error: `1回の追加は最大 ${MAX_NEW_KEYWORDS_PER_REQUEST} 個までです。`,
    });
  }

  // 既存キーワードとの重複排除
  const existingSet = new Set(existing_keywords.map((k) => String(k).trim()));
  const dedupedNew = normalizedNew.filter((k) => !existingSet.has(k));
  if (dedupedNew.length === 0) {
    return res.status(400).json({
      error: "追加しようとしたキーワードはすべて既存リストに含まれています。別のキーワードを指定してください。",
    });
  }

  const warnings = [];
  if (dedupedNew.length < normalizedNew.length) {
    warnings.push(
      `重複していたキーワードを除外しました: ${normalizedNew.filter((k) => existingSet.has(k)).join("、")}`
    );
  }

  try {
    // === Stage 1: 追加キーワード分について RapidAPI を呼ぶ ===
    const newMarketResults = await searchAmazonProductsBatched(dedupedNew, rapidApiKey, rapidApiHost, 2, 1100);
    const newMarketData = newMarketResults.map((r, idx) => {
      if (r.status === "fulfilled") return r.value;
      warnings.push(`キーワード "${dedupedNew[idx]}" のAmazon検索でエラー: ${r.reason?.message || r.reason}`);
      return { keyword: dedupedNew[idx], total_products: 0, products: [] };
    });

    // === Stage 2: 既存 market_data と統合 ===
    const mergedMarketData = [...existing_market_data, ...newMarketData];
    const mergedKeywords = mergedMarketData.map((m) => m.keyword);

    // ユーザー追加キーワード累積（過去の追加分＋今回の追加分）
    const userAddedAll = Array.from(new Set([
      ...((Array.isArray(existing_user_added) ? existing_user_added : []).map((k) => String(k).trim()).filter(Boolean)),
      ...dedupedNew,
    ]));
    const userAddedSet = new Set(userAddedAll);

    // === Stage 3: 全件再スコアリング ===
    const scored = computeMechanicalScores(mergedMarketData);

    // === Stage 4: Dify B（LLM 意図合致判定）を再呼び出し ===
    const marketSummary = buildMarketDataSummary(scored, userAddedSet);
    const stageBOutput = await runDifyWorkflow(difyKeyB, {
      work_profile_draft: String(work_profile_draft).trim(),
      author_profile: String(author_profile || "").trim(),
      publishing_goal: String(publishing_goal || "").trim(),
      market_data_summary: marketSummary,
      keywords_json: JSON.stringify(mergedKeywords),
    });

    const judgmentText = String(stageBOutput || "");
    const recommendsReturn = /推奨キーワード\s*[:：]?\s*0\s*個|STEP\s*1\s*に戻る/i.test(judgmentText);
    const ai_recommendation = recommendsReturn ? "return_to_step1" : "proceed_to_step3";

    let return_feedback_for_step1 = null;
    if (recommendsReturn) {
      const feedbackMatch = judgmentText.match(/【AIからのフィードバック】[\s\S]*$/);
      return_feedback_for_step1 = feedbackMatch ? feedbackMatch[0] : judgmentText;
    }

    return res.status(200).json({
      keywords: mergedKeywords,
      market_data: mergedMarketData,
      scored,
      judgment_text: judgmentText,
      ai_recommendation,
      return_feedback_for_step1,
      user_added_keywords: userAddedAll,
      warnings,
    });

  } catch (error) {
    return res.status(500).json({
      error: `追加キーワード評価でエラーが発生しました: ${error.message}`,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
}
