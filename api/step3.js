// Vercel Serverless Function - 新STEP3「競合レビュー評価」オーケストレータ (v4新規)
//
// 設計概要:
//   STEP2で選定したキーワードの上位本3冊のAmazonレビューを Real-Time Amazon Data API
//   (Top Product Reviews エンドポイント) で並列取得し、Difyワークフロー (LLM) で
//   読者の共通不満点・既存本がカバーできていない切り口・本企画の差別化ポイント・
//   注意すべき落とし穴を抽出する。
//
//   v4実装指示書 §5 を参照。
//
// クライアント送信ペイロード:
//   {
//     work_profile_draft: string,         // STEP1の書籍プロファイル草案（必須）
//     author_profile: string,             // 著者プロファイル全文（任意）
//     publishing_goal: string,            // 出版目標テキスト（任意）
//     selected_keywords: string[],        // STEP2で選定したキーワード1〜2個（必須）
//     selected_books: Array<{ asin, product_title, ... }>, // 上位3冊のASIN取得用（必須）
//   }
//
// レスポンス:
//   {
//     analyzed_books: Array<{ asin, product_title, rating_distribution, reviews_count }>,
//     analysis_text: string,                // LLM分析結果（マークダウン）
//     ai_recommendation: "proceed_to_confirmation" | "return_to_step1",
//     return_feedback_for_step1: string | null,  // 戻り推奨時のみセット
//     warnings: string[],
//   }
//
// 必要な環境変数:
//   - DIFY_API_KEY_STEP03_REVIEW  (新STEP3 レビュー分析 Difyワークフロー)
//   - RAPIDAPI_KEY                (Real-Time Amazon Data 認証)
//   - RAPIDAPI_HOST               (デフォルト: real-time-amazon-data.p.rapidapi.com)
//   - RAPIDAPI_REVIEWS_ENDPOINT   (Top Product Reviews パス・デフォルト: /top-product-reviews。
//                                  PoC実機検証 2026-05-16 で確認済み)

const DIFY_API_BASE = "https://api.dify.ai/v1";
const RAPIDAPI_DEFAULT_HOST = "real-time-amazon-data.p.rapidapi.com";
// PoC実機検証で確認した正確なパス: /top-product-reviews
// (Real-Time Amazon Data API・FlyByAPIs提供・RapidAPI経由)
const RAPIDAPI_DEFAULT_REVIEWS_ENDPOINT = "/top-product-reviews";
const TARGET_BOOK_COUNT = 3;

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

// 単一ASINのTop Product Reviewsを取得（429リトライ付き）
async function fetchTopProductReviews(asin, apiKey, host, endpoint, maxRetries = 3) {
  const url = `https://${host}${endpoint}?asin=${encodeURIComponent(asin)}&country=JP`;
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
      lastError = new Error(`RapidAPI reviews error for ${asin} (${response.status}): ${errText.slice(0, 200)}`);
      throw lastError;
    }
    const data = await response.json();
    // PoC実測: data.data.rating_distribution と data.data.reviews[] が返る
    return {
      asin,
      rating_distribution: data?.data?.rating_distribution || {},
      reviews: Array.isArray(data?.data?.reviews) ? data.data.reviews : [],
    };
  }
  throw lastError || new Error(`RapidAPI reviews: max retries reached for ${asin}`);
}

// 3冊を順次取得（Basic プランレート制限対応）
async function fetchReviewsSequential(asins, apiKey, host, endpoint, delayMs = 1100) {
  const results = [];
  for (let i = 0; i < asins.length; i++) {
    const r = await Promise.allSettled([fetchTopProductReviews(asins[i], apiKey, host, endpoint)]);
    results.push(r[0]);
    if (i < asins.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

// LLMに渡すレビュー要約テキストを生成（★分布 + ★1〜2と★4〜5を分けて整理）
function buildReviewsSummaryForLlm(books) {
  return books.map((entry, idx) => {
    const dist = entry.rating_distribution || {};
    const distLine = `[★分布] ★1: ${dist["1"] || 0}件 / ★2: ${dist["2"] || 0}件 / ★3: ${dist["3"] || 0}件 / ★4: ${dist["4"] || 0}件 / ★5: ${dist["5"] || 0}件`;
    const lowStarReviews = (entry.reviews || []).filter((r) => {
      const s = parseInt(r.review_star_rating, 10);
      return Number.isFinite(s) && s <= 3;
    });
    const highStarReviews = (entry.reviews || []).filter((r) => {
      const s = parseInt(r.review_star_rating, 10);
      return Number.isFinite(s) && s >= 4;
    });
    const renderReviews = (revs, maxCount) => revs.slice(0, maxCount).map((r) =>
      `  - ★${r.review_star_rating || "?"} ${r.review_title ? `「${r.review_title}」` : ""}\n    ${(r.review_comment || "").replace(/\n+/g, " ").slice(0, 400)}`
    ).join("\n") || "  (該当レビューなし)";
    return [
      `【${idx + 1}】${entry.product_title || "（タイトル不明）"} (ASIN: ${entry.asin})`,
      distLine,
      `[★1〜3の不満寄りレビュー(最大5件)]`,
      renderReviews(lowStarReviews, 5),
      `[★4〜5の肯定的レビュー(最大3件)]`,
      renderReviews(highStarReviews, 3),
    ].join("\n");
  }).join("\n\n---\n\n");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const difyKey = process.env.DIFY_API_KEY_STEP03_REVIEW;
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || RAPIDAPI_DEFAULT_HOST;
  const reviewsEndpoint = process.env.RAPIDAPI_REVIEWS_ENDPOINT || RAPIDAPI_DEFAULT_REVIEWS_ENDPOINT;

  const missingEnv = [];
  if (!difyKey) missingEnv.push("DIFY_API_KEY_STEP03_REVIEW");
  if (!rapidApiKey) missingEnv.push("RAPIDAPI_KEY");
  if (missingEnv.length > 0) {
    return res.status(500).json({
      error: `必要な環境変数が未設定です: ${missingEnv.join(", ")}。Vercelの環境変数設定をご確認ください。`,
      missingEnv,
    });
  }

  const { work_profile_draft, author_profile, publishing_goal, selected_keywords, selected_books } = req.body || {};

  if (!work_profile_draft || !String(work_profile_draft).trim()) {
    return res.status(400).json({ error: "work_profile_draft が必須です。" });
  }
  if (!Array.isArray(selected_keywords) || selected_keywords.length === 0) {
    return res.status(400).json({ error: "selected_keywords（STEP2で選定したキーワード）が必須です。" });
  }
  if (!Array.isArray(selected_books) || selected_books.length === 0) {
    return res.status(400).json({ error: "selected_books（STEP2の上位本データ）が必須です。STEP2に戻って再実行してください。" });
  }

  const warnings = [];

  try {
    // === Stage 1: 上位3冊のASINを抽出（既に発売済みフィルタ済みの想定。レビュー数の多い順に絞る） ===
    const eligibleBooks = selected_books
      .filter((b) => b && b.asin && (b.is_released !== false))
      .sort((a, b) => (Number(b.product_num_ratings) || 0) - (Number(a.product_num_ratings) || 0))
      .slice(0, TARGET_BOOK_COUNT);

    if (eligibleBooks.length === 0) {
      return res.status(400).json({
        error: "分析対象の本が見つかりませんでした。STEP2に戻って再実行してください。",
      });
    }

    if (eligibleBooks.length < TARGET_BOOK_COUNT) {
      warnings.push(`分析対象本が ${eligibleBooks.length}冊 / ${TARGET_BOOK_COUNT}冊 です。レビュー分析の精度が下がる可能性があります。`);
    }

    // === Stage 2: Top Product Reviews を順次取得（Basic プランレート制限対応） ===
    // 3冊なので1.1秒×3=約3〜5秒で完了。429リトライ付き。
    const reviewResults = await fetchReviewsSequential(
      eligibleBooks.map((b) => b.asin),
      rapidApiKey,
      rapidApiHost,
      reviewsEndpoint,
      1100
    );

    const analyzedBooks = reviewResults.map((r, idx) => {
      const book = eligibleBooks[idx];
      if (r.status === "fulfilled") {
        return {
          asin: book.asin,
          product_title: book.product_title || "",
          rating_distribution: r.value.rating_distribution,
          reviews: r.value.reviews,
          reviews_count: r.value.reviews.length,
        };
      }
      warnings.push(`ASIN "${book.asin}" のレビュー取得エラー: ${r.reason?.message || r.reason}`);
      return {
        asin: book.asin,
        product_title: book.product_title || "",
        rating_distribution: {},
        reviews: [],
        reviews_count: 0,
      };
    });

    const validBooks = analyzedBooks.filter((b) => b.reviews_count > 0);
    if (validBooks.length === 0) {
      return res.status(502).json({
        error: "すべての本でレビュー取得に失敗しました。RapidAPIのエンドポイント設定 (RAPIDAPI_REVIEWS_ENDPOINT) を確認してください。",
        warnings,
        analyzed_books: analyzedBooks,
      });
    }

    // === Stage 3: Dify LLM ワークフローで分析 ===
    const reviewsSummary = buildReviewsSummaryForLlm(analyzedBooks);
    const stageOutput = await runDifyWorkflow(difyKey, {
      work_profile_draft: String(work_profile_draft).trim(),
      author_profile: String(author_profile || "").trim(),
      publishing_goal: String(publishing_goal || "").trim(),
      selected_keywords_text: selected_keywords.join("、"),
      reviews_summary: reviewsSummary,
    });

    const analysisText = String(stageOutput || "");

    // === Stage 4: AI判定 - 差別化ポイント数で判定 ===
    // LLM出力から「差別化ポイント」の項目数を数える（番号付きリストパターン）
    const diffSection = analysisText.match(/【本企画[がの]?差別化できるポイント】([\s\S]*?)(?=【|$)/);
    let differentiationCount = 0;
    if (diffSection && diffSection[1]) {
      const lines = diffSection[1].split("\n").map((l) => l.trim());
      differentiationCount = lines.filter((l) => /^[0-9０-９][\.．)）]/.test(l) || /^[-・*+]\s+/.test(l)).length;
    }
    const recommendsReturn = differentiationCount <= 2;
    const ai_recommendation = recommendsReturn ? "return_to_step1" : "proceed_to_confirmation";

    // 戻り推奨時のフィードバックを生成（分析結果から抽出）
    let return_feedback_for_step1 = null;
    if (recommendsReturn) {
      // ヘッダ追加 + 既存マークダウンを引き継ぐ
      return_feedback_for_step1 = `## STEP3「競合レビュー評価」からのフィードバック\n\nSTEP3の市場検証で差別化ポイントが${differentiationCount}個と少なめでした。以下の分析を踏まえ、書籍コンセプトを再設計してください。\n\n${analysisText}`;
    }

    return res.status(200).json({
      analyzed_books: analyzedBooks.map((b) => ({
        asin: b.asin,
        product_title: b.product_title,
        rating_distribution: b.rating_distribution,
        reviews_count: b.reviews_count,
      })),
      analysis_text: analysisText,
      ai_recommendation,
      differentiation_count: differentiationCount,
      return_feedback_for_step1,
      warnings,
    });

  } catch (error) {
    return res.status(500).json({
      error: `STEP3 処理中にエラーが発生しました: ${error.message}`,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
}
