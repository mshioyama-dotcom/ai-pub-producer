// Vercel Serverless Function - Dify Chat API Proxy（STEP1・4用）
const DIFY_API_BASE = "https://api.dify.ai/v1";

const CHAT_API_KEYS = {
  1: process.env.DIFY_API_KEY_STEP01,
  4: process.env.DIFY_API_KEY_STEP04,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { stepNum, message, conversation_id } = req.body;
  if (!stepNum || !message) {
    return res.status(400).json({ error: "stepNum and message are required" });
  }

  const apiKey = CHAT_API_KEYS[stepNum];
  if (!apiKey) {
    return res.status(400).json({ error: `No chat API key configured for STEP${stepNum}` });
  }

  try {
    const body = {
      query: message,
      response_mode: "streaming",
      user: "ai-pub-producer-user",
      inputs: {},
    };
    if (conversation_id) body.conversation_id = conversation_id;

    const difyRes = await fetch(`${DIFY_API_BASE}/chat-messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!difyRes.ok) {
      const errorText = await difyRes.text();
      return res.status(difyRes.status).json({ error: `Dify API error: ${errorText}` });
    }

    // SSEストリームを受け取り、answer を結合して返す
    const text = await difyRes.text();
    const lines = text.split("\n");

    let answer = "";
    let returnedConversationId = "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;
      try {
        const data = JSON.parse(jsonStr);
        if (data.event === "agent_message" || data.event === "message") {
          answer += data.answer || "";
        }
        if (data.conversation_id) {
          returnedConversationId = data.conversation_id;
        }
      } catch {
        // パース失敗行はスキップ
      }
    }

    return res.status(200).json({
      answer,
      conversation_id: returnedConversationId,
    });

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}