// Vercel Serverless Function - STEP12「出版状況分析」オーケストレータ
//
// 設計概要:
//   著者が出版した自分の本（ASIN指定）について、Real-Time Amazon Data API で
//   現状データ（タイトル・価格・カテゴリランキング・レビュー分布）と最新レビューを取得し、
//   著者が手動で入力する KDP データ（売上・KU既読など）と統合して、
//   Dify ワークフローで客観分析＋改善提案を生成する。
//
//   ※ 設計書 v4 では Keepa API を使う想定だったが、サブスク化計画の都合で
//   STEP2/3 と同じ Real-Time Amazon Data API（RapidAPI）を使う方針に変更。
//   過去推移データ（Keepa の強み）は取得できないが、現状スナップショット＋レビュー分析で
//   十分な改善提案を出せる設計にする。
//
// クライアント送信ペイロード:
//   {
//     asin: string,                 // 著者が出版した本のASIN（必須）
//     kdp_manual_data: string,      // KDP管理画面から手動転記したテキスト（任意・売上/KU既読/印税 等）
//     campaign_notes: string,       // キャンペーン記述（任意・無料キャンペーン期間 / セール / 広告出稿 等）
//     author_profile: string,       // 著者プロファイル全文（任意・自動転記）
//     work_profile: string,         // 書籍プロファイル確定版（任意・自動転記）
//   }
//
// レスポンス:
//   {
//     product_snapshot: {           // RapidAPI Product Details から取得した現状
//       title, price, currency, rating, num_ratings, best_seller_rank,
//       product_url, image_url, sales_volume, book_format
//     },
//     review_summary: {             // レビュー分析用の生データ
//       rating_distribution: { "1": n, "2": n, ... },
//       reviews: Array<{ star, title, comment, date }>,
//       reviews_count: number,
//     },
//     analysis_text: string,        // Dify が生成したマークダウン分析レポート
//     ai_recommendation: "good_position" | "improvement_needed" | "major_revision_needed",
//     warnings: string[],
//   }
//
// 必要な環境変数:
//   - DIFY_API_KEY_STEP12         (STEP12 出版状況分析 Dify ワークフロー)
//   - RAPIDAPI_KEY                (Real-Time Amazon Data 認証)
//   - RAPIDAPI_HOST               (デフォルト: real-time-amazon-data.p.rapidapi.com)
//   - RAPIDAPI_DETAILS_ENDPOINT   (Product Details パス・デフォルト: /product-details)
//   - RAPIDAPI_REVIEWS_ENDPOINT   (Top Product Reviews パス・デフォルト: /top-product-reviews)

const DIFY_API_BASE = "https://api.dify.ai/v1";
const RAPIDAPI_DEFAULT_HOST = "real-time-amazon-data.p.rapidapi.com";
const RAPIDAPI_DEFAULT_DETAILS_ENDPOINT = "/product-details";
const RAPIDAPI_DEFAULT_REVIEWS_ENDPOINT = "/top-product-reviews";

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

// 429 リトライ付き fetch
async function fetchWithRetry(url, headers, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { method: "GET", headers });
    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!response.ok) {
      const errText = await response.text();
      lastError = new Error(`RapidAPI error (${response.status}): ${errText.slice(0, 200)}`);
      throw lastError;
    }
    return await response.json();
  }
  throw lastError || new Error("RapidAPI: max retries reached");
}

// オブジェクト/配列を安全に人間可読な文字列にする（[object Object] 化を防ぐ）
function safeStringify(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map((item) => safeStringify(item)).filter(Boolean).join(" / ");
  }
  if (typeof v === "object") {
    // よくある構造：{name, link, rank} 等 → 「name#rank」のように整形
    const parts = [];
    if (v.name) parts.push(safeStringify(v.name));
    if (v.category) parts.push(safeStringify(v.category));
    if (v.rank) parts.push(`#${safeStringify(v.rank)}`);
    if (v.position) parts.push(`#${safeStringify(v.position)}`);
    if (parts.length > 0) return parts.join(" ");
    // 構造が不明な場合は JSON で表現（[object Object] 回避）
    try { return JSON.stringify(v); } catch { return ""; }
  }
  return String(v);
}

// best_seller_rank / カテゴリ情報を product_information / category_path 等から抽出
function extractBestSellerInfo(d) {
  // 優先順：sales_volume → best_sellers_rank → category_path → product_information
  const candidates = [d.sales_volume, d.best_sellers_rank, d.category_path, d.categories, d.product_information];
  for (const c of candidates) {
    const s = safeStringify(c);
    if (s) return s;
  }
  return "";
}

// ASIN の Product Details を取得
async function fetchProductDetails(asin, apiKey, host, endpoint) {
  const url = `https://${host}${endpoint}?asin=${encodeURIComponent(asin)}&country=JP`;
  const data = await fetchWithRetry(url, {
    "x-rapidapi-key": apiKey,
    "x-rapidapi-host": host,
  });
  const d = data?.data || {};
  return {
    asin: d.asin || asin,
    title: safeStringify(d.product_title),
    price: safeStringify(d.product_price),
    currency: safeStringify(d.currency) || "JPY",
    rating: safeStringify(d.product_star_rating),
    num_ratings: Number(d.product_num_ratings) || 0,
    best_seller_rank: extractBestSellerInfo(d),
    product_url: safeStringify(d.product_url),
    image_url: safeStringify(d.product_photo),
    book_format: safeStringify(d.book_format),
    description: safeStringify(d.product_description),
    is_amazon_choice: !!d.is_amazon_choice,
    is_best_seller: !!d.is_best_seller,
    raw_categories: safeStringify(d.category_path) || safeStringify(d.categories),
  };
}

// ASIN のレビューを取得
async function fetchProductReviews(asin, apiKey, host, endpoint) {
  const url = `https://${host}${endpoint}?asin=${encodeURIComponent(asin)}&country=JP`;
  const data = await fetchWithRetry(url, {
    "x-rapidapi-key": apiKey,
    "x-rapidapi-host": host,
  });
  return {
    rating_distribution: data?.data?.rating_distribution || {},
    reviews: Array.isArray(data?.data?.reviews) ? data.data.reviews : [],
  };
}

// LLM 入力用のテキストを構築
function buildAnalysisInputText(snapshot, reviewSummary) {
  const dist = reviewSummary.rating_distribution || {};
  const distLine = `★1: ${dist["1"] || 0}件 / ★2: ${dist["2"] || 0}件 / ★3: ${dist["3"] || 0}件 / ★4: ${dist["4"] || 0}件 / ★5: ${dist["5"] || 0}件`;

  // レビューを ★1〜3（不満寄り）と ★4〜5（肯定的）に分けて整理
  const lowStar = (reviewSummary.reviews || []).filter((r) => {
    const s = parseInt(r.review_star_rating, 10);
    return Number.isFinite(s) && s <= 3;
  });
  const highStar = (reviewSummary.reviews || []).filter((r) => {
    const s = parseInt(r.review_star_rating, 10);
    return Number.isFinite(s) && s >= 4;
  });
  const renderReviews = (revs, maxCount) => revs.slice(0, maxCount).map((r) =>
    `  - ★${r.review_star_rating || "?"} ${r.review_title ? `「${r.review_title}」` : ""}\n    ${(r.review_comment || "").replace(/\n+/g, " ").slice(0, 400)}`
  ).join("\n") || "  (該当レビューなし)";

  return [
    `【現状スナップショット】`,
    `タイトル: ${snapshot.title}`,
    `価格: ${snapshot.price} ${snapshot.currency || ""}`,
    `平均評価: ${snapshot.rating} (${snapshot.num_ratings.toLocaleString()}件)`,
    `カテゴリランキング/状態: ${snapshot.best_seller_rank || "（取得失敗）"}`,
    `形態: ${snapshot.book_format || "Kindle"}`,
    snapshot.is_best_seller ? "★ ベストセラー指定中" : "",
    snapshot.is_amazon_choice ? "★ Amazon Choice 指定中" : "",
    `Amazon URL: ${snapshot.product_url || "（取得失敗）"}`,
    `カテゴリパス: ${snapshot.raw_categories || "（取得失敗）"}`,
    "",
    `【レビュー分布】`,
    distLine,
    "",
    `【★1〜3の不満寄りレビュー（最大8件）】`,
    renderReviews(lowStar, 8),
    "",
    `【★4〜5の肯定的レビュー（最大5件）】`,
    renderReviews(highStar, 5),
  ].filter(Boolean).join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const difyKey = process.env.DIFY_API_KEY_STEP12;
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || RAPIDAPI_DEFAULT_HOST;
  const detailsEndpoint = process.env.RAPIDAPI_DETAILS_ENDPOINT || RAPIDAPI_DEFAULT_DETAILS_ENDPOINT;
  const reviewsEndpoint = process.env.RAPIDAPI_REVIEWS_ENDPOINT || RAPIDAPI_DEFAULT_REVIEWS_ENDPOINT;

  const missingEnv = [];
  if (!difyKey) missingEnv.push("DIFY_API_KEY_STEP12");
  if (!rapidApiKey) missingEnv.push("RAPIDAPI_KEY");
  if (missingEnv.length > 0) {
    return res.status(500).json({
      error: `必要な環境変数が未設定です: ${missingEnv.join(", ")}。Vercelの環境変数設定をご確認ください。`,
      missingEnv,
    });
  }

  const { asin, kdp_manual_data, campaign_notes, author_profile, work_profile } = req.body || {};

  if (!asin || !String(asin).trim()) {
    return res.status(400).json({ error: "asin（出版した本のASIN）が必須です。" });
  }
  // ASIN フォーマット簡易チェック: B0 で始まる 10文字（Kindle ASIN の典型）
  const trimmedAsin = String(asin).trim().toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(trimmedAsin)) {
    // 警告にとどめ、API には投げる（Amazon側で正式判定）
  }

  const warnings = [];

  try {
    // Stage 1: Product Details を取得
    let snapshot;
    try {
      snapshot = await fetchProductDetails(trimmedAsin, rapidApiKey, rapidApiHost, detailsEndpoint);
    } catch (e) {
      return res.status(502).json({
        error: `Amazon Product Details の取得に失敗しました: ${e.message}\n\nASIN が正しいか、または Amazon に本書が表示されているかご確認ください。`,
      });
    }

    if (!snapshot.title) {
      warnings.push("Amazon Product Details からタイトルが取得できませんでした。ASIN が正しいかご確認ください。");
    }

    // 1.1秒空けてからレビュー取得（Basic プランレート制限対応）
    await new Promise((r) => setTimeout(r, 1100));

    // Stage 2: Top Product Reviews を取得
    let reviewSummary;
    try {
      reviewSummary = await fetchProductReviews(trimmedAsin, rapidApiKey, rapidApiHost, reviewsEndpoint);
    } catch (e) {
      warnings.push(`レビュー取得エラー: ${e.message}。Dify分析はスナップショットのみで実行します。`);
      reviewSummary = { rating_distribution: {}, reviews: [] };
    }

    // Stage 3: Dify に渡す入力テキストを構築
    const amazon_data_summary = buildAnalysisInputText(snapshot, reviewSummary);

    // Stage 4: Dify ワークフロー実行
    const stageOutput = await runDifyWorkflow(difyKey, {
      asin: trimmedAsin,
      amazon_data_summary,
      kdp_manual_data: String(kdp_manual_data || "").trim(),
      campaign_notes: String(campaign_notes || "").trim(),
      author_profile: String(author_profile || "").trim(),
      work_profile: String(work_profile || "").trim(),
    });

    const analysis_text = String(stageOutput || "").trim();
    if (!analysis_text || analysis_text.length < 100) {
      return res.status(502).json({
        error: "Dify から有効な分析結果が返ってきませんでした。",
        debug: { stageOutput },
        product_snapshot: snapshot,
        review_summary: reviewSummary,
      });
    }

    // AI 推奨判定（分析テキストからキーワード抽出・簡易版）
    let ai_recommendation = "good_position";
    if (/大幅な見直し|major.?revision|致命/i.test(analysis_text)) {
      ai_recommendation = "major_revision_needed";
    } else if (/改善の余地|improvement|△|要改善/i.test(analysis_text)) {
      ai_recommendation = "improvement_needed";
    }

    return res.status(200).json({
      product_snapshot: snapshot,
      review_summary: {
        rating_distribution: reviewSummary.rating_distribution,
        reviews: reviewSummary.reviews,
        reviews_count: reviewSummary.reviews.length,
      },
      analysis_text,
      ai_recommendation,
      warnings,
    });

  } catch (error) {
    return res.status(500).json({
      error: `STEP12 分析処理中にエラーが発生しました: ${error.message}`,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
}
