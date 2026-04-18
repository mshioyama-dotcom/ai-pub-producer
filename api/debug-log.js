// Vercel Serverless Function - Debug Log Collector
// フロントエンドからのデバッグログをVercel Logsに記録する

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
    try {
      const { sessionId, label, data, userAgent } = req.body;
  
      // Vercel Logs に出力（構造化ログ）
      const timestamp = new Date().toISOString();
      const logLine = `[CLIENT_DEBUG] ${timestamp} session=${sessionId || "none"} label="${label || "unknown"}" data=${JSON.stringify(data || {})} ua="${(userAgent || "").substring(0, 100)}"`;
      console.log(logLine);
  
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[CLIENT_DEBUG_ERROR]", error.message);
      return res.status(500).json({ error: error.message });
    }
  }