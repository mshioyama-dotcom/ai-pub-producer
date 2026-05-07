// Vercel Serverless Function - Dify "STEP_共通_出力相談" Chatflow Proxy
// 全STEP共通の「出力について相談する」チャット用エンドポイント
//
// クライアントから送信されるpayload:
//   {
//     stepNum: number,            // 相談対象のSTEP番号 (例: 4)
//     stepName: string,           // STEP名 (例: "タイトル・サブタイトル作成")
//     stepRules: string,          // 当該STEPの設計ルール抜粋 (任意)
//     stepInputSummary: string,   // 当該STEPへの入力サマリ (任意)
//     stepOutput: string,         // 当該STEPの現在の出力 (必須)
//     authorProfile: string,      // 著者プロファイル (任意)
//     workProfile: string,        // 書籍プロファイル (任意)
//     message: string,            // ユーザーの今回の発言 (必須)
//     conversationId: string,     // 継続対話の場合に指定 (空文字 or 未指定で新規)
//   }
//
// レスポンス:
//   { answer: string, conversation_id: string }

const DIFY_API_BASE = "https://api.dify.ai/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.DIFY_API_KEY_DISCUSS;
  if (!apiKey) {
    return res.status(500).json({
      error: "DIFY_API_KEY_DISCUSS が設定されていません。Vercel環境変数に相談用ChatflowのAPIキーを追加してください。",
    });
  }

  const {
    stepNum,
    stepName,
    stepRules,
    stepInputSummary,
    stepOutput,
    authorProfile,
    workProfile,
    message,
    conversationId,
  } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message は必須です" });
  }
  if (stepNum === undefined || stepNum === null) {
    return res.status(400).json({ error: "stepNum は必須です" });
  }
  if (!stepOutput || typeof stepOutput !== "string" || !stepOutput.trim()) {
    return res.status(400).json({ error: "stepOutput は必須です（相談対象の出力が空）" });
  }

  // Dify chat-messages API は inputs を「会話の最初の1回」のみ参照する。
  // continuation 時は inputs を再送しても無視されるが、害はないので毎回送る。
  const inputs = {
    step_num: String(stepNum),
    step_name: stepName || "",
    step_rules: stepRules || "",
    step_input_summary: stepInputSummary || "",
    step_output: stepOutput || "",
    author_profile: authorProfile || "",
    work_profile: workProfile || "",
  };

  const body = {
    query: message,
    response_mode: "streaming",
    user: "ai-pub-producer-user",
    inputs,
  };
  if (conversationId) body.conversation_id = conversationId;

  try {
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

    // SSEストリームを受け取り、answer を結合して返す（dify-chat.js と同じ方式）
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
