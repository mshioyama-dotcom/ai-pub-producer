// Vercel Serverless Function - Debug Log Collector (Slack連携版)
// フロントエンドからのデバッグログをSlackに通知する

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

    // Slack通知（SLACK_WEBHOOK_URLが設定されている時のみ）
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl && label) {
      // INIT loadAllSteps はノイズが多いのでスキップ
      const skipLabel = label === "INIT" && data?.action === "loadAllSteps";

      if (!skipLabel) {
        // ラベル別の絵文字
        const emojiMap = {
          RECV: "📥",
          SAVE: "💾",
          STORED: "🗂️",
          AUTOFILL: "🔄",
          SAVE_ERROR: "🚨",
          INIT: "🟢",
        };
        const emoji = emojiMap[label] || "📝";

        const shortSession = (sessionId || "none").substring(0, 8);
        const dataStr = JSON.stringify(data || {}, null, 0).substring(0, 800);

        const slackMessage = {
          text: `${emoji} *${label}* \`${shortSession}\`\n\`\`\`${dataStr}\`\`\``,
        };

        // Slackへ非同期送信（失敗してもログ機能自体は止めない）
        try {
          await fetch(slackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackMessage),
          });
        } catch (slackError) {
          console.error("[SLACK_NOTIFY_ERROR]", slackError.message);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[CLIENT_DEBUG_ERROR]", error.message);
    return res.status(500).json({ error: error.message });
  }
}
