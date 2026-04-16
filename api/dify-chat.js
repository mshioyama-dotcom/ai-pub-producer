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
      response_mode: "blocking",
      user: "ai-pub-producer-user",
      inputs: {},
    };
    if (conversation_id) body.conversation_id = conversation_id;

    const response = await fetch(`${DIFY_API_BASE}/chat-messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Dify API error: ${errorText}` });
    }

    const data = await response.json();
    return res.status(200).json({
      answer: data.answer || "",
      conversation_id: data.conversation_id || "",
    });

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
