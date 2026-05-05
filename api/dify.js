// Vercel Serverless Function - Dify API Proxy
const DIFY_API_BASE = "https://api.dify.ai/v1";

const API_KEYS = {
  0:  process.env.DIFY_API_KEY_STEP00_A,
  1:  process.env.DIFY_API_KEY_STEP01,
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

function mapInputs(stepNum, inputs) {
  const m = { ...inputs };

  // STEP1: theme をそのまま渡す（変換不要）
  // 何もしない

  if (stepNum === 2) {
    if (m.amazon_html !== undefined) { m.HTML = m.amazon_html; delete m.amazon_html; }
  }

  if (stepNum === 5) {
    if (m.keyword1 !== undefined)       { m.kw1 = m.keyword1; delete m.keyword1; }
    if (m.keyword2 !== undefined)       { m.kw2 = m.keyword2; delete m.keyword2; }
    if (m.blueprint_text !== undefined) { m.theme_output = m.blueprint_text; delete m.blueprint_text; }
    if (m.interview_text !== undefined) { m.diff_elements = m.interview_text; delete m.interview_text; }
  }

  if (stepNum === 6) {
    if (m.blueprint_text !== undefined) { m.blueprint = m.blueprint_text; delete m.blueprint_text; }
    if (m.interview_text !== undefined) { m.interview_notes = m.interview_text; delete m.interview_text; }
  }

  if (stepNum === 7) {
    if (m.toc_text !== undefined)       { m.refined_toc = m.toc_text; delete m.toc_text; }
    if (m.blueprint_text !== undefined) { m.blueprint = m.blueprint_text; delete m.blueprint_text; }
    if (m.interview_text !== undefined) { m.nterview_notes = m.interview_text; delete m.interview_text; }
  }

  if (stepNum === 8) {
    if (m.chapter_outline_text !== undefined) { m.plot_instruction = m.chapter_outline_text; delete m.chapter_outline_text; }
    if (m.added_episode_text !== undefined)   { m.added_episodes = m.added_episode_text; delete m.added_episode_text; }
  }

  if (stepNum === 9) {
    if (m.past_writing_text !== undefined) { m.past_writing_data = m.past_writing_text; delete m.past_writing_text; }
  }

  if (stepNum === 10) {
    if (m.title_text !== undefined)          { m.title = m.title_text; delete m.title_text; }
    if (m.subtitle_text !== undefined)       { m.subtitle = m.subtitle_text; delete m.subtitle_text; }
    if (m.blueprint_text !== undefined)      { m.reader_value_design = m.blueprint_text; delete m.blueprint_text; }
    if (m.interview_text !== undefined)      { m.author_episode = m.interview_text; delete m.interview_text; }
    if (m.outline_text !== undefined)        { m.toc_text = m.outline_text; delete m.outline_text; }
    if (m.author_profile_text !== undefined) { m.author_profile = m.author_profile_text; delete m.author_profile_text; }
  }

  return m;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { stepNum, inputs } = req.body;
  if (!stepNum || !inputs) return res.status(400).json({ error: "stepNum and inputs are required" });

  const apiKey = API_KEYS[stepNum];
  if (!apiKey) return res.status(400).json({ error: `No API key configured for STEP${stepNum}` });

  const difyInputs = mapInputs(stepNum, inputs);

  try {
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: difyInputs,
        response_mode: "blocking",
        user: "ai-pub-producer-user",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Dify API error: ${errorText}` });
    }

    const data = await response.json();
    const output = data?.data?.outputs?.text
      || data?.data?.outputs?.output
      || data?.data?.outputs?.result
      || data?.data?.outputs?.author_profile
      || JSON.stringify(data?.data?.outputs || data, null, 2);

    // --- DEBUG LOG (for Vercel logs) ---
    const rawText = data?.data?.outputs?.text;
    const rawTextLen = (rawText || "").length;
    const outputLen = (output || "").length;
    const rawTextTail = rawText ? String(rawText).slice(-30) : "(empty)";
    console.log(`[DIFY_DEBUG] STEP${stepNum} rawText.length=${rawTextLen} output.length=${outputLen} tail="${rawTextTail}"`);
    // --- END DEBUG ---

    return res.status(200).json({ output });

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}