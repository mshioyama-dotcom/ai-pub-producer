// Vercel Serverless Function - 図解（Mermaid記法）の下書き生成
//
// 設計判断（Phase 3）:
//   - 既存STEP9の本文生成Difyワークフローには影響を与えない（独立API）
//   - 直接 Anthropic Claude API を呼ぶ（Dify経由ではない）→ プロンプト管理を内製化
//   - Mermaid記法の構文は LLM が稀に間違えるため、結果を1〜3案返してユーザーに選ばせる設計
//   - 図解タイプ（flow/compare/hierarchy/timeline）に応じて適切な Mermaid 構文を生成

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const DIAGRAM_TYPE_INSTRUCTIONS = {
  flow: `フロー図（graph LR または graph TD）。各ノードを矢印で繋ぎ、読者の変化プロセス・手順の流れ・因果関係を可視化する。ノード3〜6個程度。`,
  compare: `比較図（graph TB に subgraph を2つ）。Before/Afterや「思い込み vs 実態」など、対比構造を可視化する。各サブグループに2〜4個のノード。`,
  hierarchy: `階層図（graph TD）。中心概念から枝分かれする要素分解構造。ルート1個、第1階層2〜4個、第2階層0〜3個。`,
  timeline: `時系列図（timeline）。時間軸に沿った段階・推移を可視化する。3〜6個の節目。`,
};

function buildPrompt({ bodyText, diagramType, authorProfile, workProfile, hint }) {
  const typeInstruction = DIAGRAM_TYPE_INSTRUCTIONS[diagramType] || DIAGRAM_TYPE_INSTRUCTIONS.flow;
  return `あなたは書籍編集者として、本文の内容から読者の理解を助ける「Mermaid記法の図解」を3案提案します。

【図解の種類】
${diagramType}：${typeInstruction}

【本文セクション】
${(bodyText || "").trim() || "(指定なし)"}

${hint ? `【追加のヒント】\n${hint.trim()}\n\n` : ""}${authorProfile ? `【著者プロファイル（参考）】\n${authorProfile.trim().slice(0, 600)}\n\n` : ""}${workProfile ? `【書籍プロファイル（参考）】\n${workProfile.trim().slice(0, 800)}\n\n` : ""}━━━━━━━━━━━
【出力ルール（厳守）】
━━━━━━━━━━━

1. 案を3つ提示する（異なる切り口・粒度で）。
2. 各案は **以下の形式** で出力する：

=== 案1 ===
タイトル: （この図解が何を示すか・10〜20字）
キャプション: （Word に出力されるときの図のキャプション・10〜30字）
\`\`\`mermaid
（ここに Mermaid 記法。${diagramType === "timeline" ? "timeline" : "graph LR / graph TD / graph TB"} で書く）
\`\`\`

=== 案2 ===
（同様）

=== 案3 ===
（同様）

3. Mermaid 記法のルール：
   - 日本語ノード名は [ ] で囲む（例：A[読者の悩み]）
   - ノードIDは半角英数（A, B, C... など）
   - ノード名の中に [ ] や " を入れない（壊れる）
   - 矢印は --> （実線）のみ使用
   - subgraph を使う場合は subgraph 名 ... end の形式
   - 1案あたり 3〜8 ノード程度に抑える

4. 装飾・前置き・後置きは禁止。挨拶や説明文も書かない。
   各案は「=== 案X ===」から始まる。
`;
}

// Claude の応答から === 案N === ブロックを抽出して [{ title, caption, mermaid }] の配列に
function parseSuggestions(text) {
  const out = [];
  if (!text) return out;
  // === 案N === から次の === 案N === 直前までをブロック単位で抽出
  const blockRe = /===\s*案\s*\d+\s*===([\s\S]*?)(?=(?:===\s*案\s*\d+\s*===)|$)/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const body = m[1];
    const titleMatch = body.match(/タイトル[:：]\s*(.+)/);
    const captionMatch = body.match(/キャプション[:：]\s*(.+)/);
    const mermaidMatch = body.match(/```mermaid\s*\n([\s\S]*?)```/);
    if (mermaidMatch && mermaidMatch[1].trim()) {
      out.push({
        title: (titleMatch ? titleMatch[1] : "").trim(),
        caption: (captionMatch ? captionMatch[1] : "").trim(),
        mermaid: mermaidMatch[1].trim(),
      });
    }
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { bodyText, diagramType, authorProfile, workProfile, hint } = req.body || {};
  if (!bodyText && !hint) {
    return res.status(400).json({ error: "bodyText か hint のいずれかが必要です（図解にしたい内容のヒント）" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY 環境変数が設定されていません。Vercel の Settings > Environment Variables から ANTHROPIC_API_KEY を追加してください。",
      missingEnv: ["ANTHROPIC_API_KEY"],
    });
  }

  const prompt = buildPrompt({ bodyText: bodyText || "", diagramType: diagramType || "flow", authorProfile, workProfile, hint });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55 * 1000);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Claude API error (${response.status}): ${errText.slice(0, 500)}` });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";
    const suggestions = parseSuggestions(text);

    if (suggestions.length === 0) {
      return res.status(200).json({
        suggestions: [],
        warning: "Claude が想定形式で返してくれませんでした。下書き案が抽出できていません。raw レスポンスを参考にしてください。",
        raw: text.slice(0, 1500),
      });
    }

    return res.status(200).json({ suggestions });
  } catch (e) {
    if (e?.name === "AbortError") {
      return res.status(504).json({ error: "Claude API がタイムアウトしました（55秒）。もう一度お試しください。" });
    }
    return res.status(500).json({ error: `Server error: ${e?.message || e}` });
  } finally {
    clearTimeout(timeoutId);
  }
}
