// Vercel Serverless Function - Dify API Proxy
// APIキーはVercelの環境変数に設定する

const DIFY_API_BASE = "https://api.dify.ai/v1";

// 各STEPのAPIキー（環境変数から取得）
const API_KEYS = {
  2:  process.env.DIFY_API_KEY_STEP02,
  3:  process.env.DIFY_API_KEY_STEP03,
  4:  process.env.DIFY_API_KEY_STEP04,
  5:  process.env.DIFY_API_KEY_STEP05,
  6:  process.env.DIFY_API_KEY_STEP06,
  7:  process.env.DIFY_API_KEY_STEP07,
  8:  process.env.DIFY_API_KEY_STEP08,
  9:  process.env.DIFY_API_KEY_STEP09,
  10: process.env.DIFY_API_KEY_STEP10,
};

export default async function handler(req, res) {
  // CORS設定
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { stepNum, inputs } = req.body;

  if (!stepNum || !inputs) {
    return res.status(400).json({ error: "stepNum and inputs are required" });
  }

  const apiKey = API_KEYS[stepNum];
  if (!apiKey) {
    return res.status(400).json({ error: `No API key configured for STEP${stepNum}` });
  }

  try {
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
      return res.status(response.status).json({ error: `Dify API error: ${errorText}` });
    }

    const data = await response.json();

    // Difyのワークフロー実行結果から出力テキストを抽出
    const output = data?.data?.outputs?.text
      || data?.data?.outputs?.output
      || data?.data?.outputs?.result
      || JSON.stringify(data?.data?.outputs || data, null, 2);

    return res.status(200).json({ output });

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
