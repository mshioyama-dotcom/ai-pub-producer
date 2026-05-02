import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// デザイントークン（ネイビー × ゴールド × ホワイト）
// ============================================================

const C = {
  navy:       "#243d5c",
  navyMid:    "#345578",
  navyLight:  "#e8eef5",
  gold:       "#b8922a",
  goldLight:  "#f0d98a",
  goldPale:   "#fdf6e3",
  white:      "#ffffff",
  bg:         "#f4f3ef",
  surface:    "#ffffff",
  border:     "#d0cac0",
  text:       "#1a1a1a",
  textSub:    "#444444",
  textLight:  "#777777",
  // ステータス
  blue:       "#2a4468",
  blueLight:  "rgba(42,68,104,0.1)",
  green:      "#1e6b3a",
  greenLight: "rgba(30,107,58,0.1)",
  red:        "#b52b1e",
  redLight:   "rgba(181,43,30,0.08)",
};

// ============================================================
// データ定義
// ============================================================

const STEPS = [
  {
    id: "step_01", num: 1, title: "テーマ発見",
    description: "書きたいテーマから、Amazon Kindleで実際に売れている本の市場データを元に、本のタイトルに使えそうなキーワード候補を5つ提案します。ここで選んだ2語が、このあと本全体の軸になります。",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/REPLACE_WITH_NEW_WORKFLOW_URL",
    inputs: [
      { name: "theme", label: "書きたいテーマ語", desc: "書きたい本のテーマを1語で入力してください。もし「FIRE × 副業」のように複数の軸を組み合わせたい場合は、カンマ区切り（例：「FIRE、副業」「投資、節税」）で入力すると、両方の要素を含んだ鋭い候補が出ます。", source: null, required: true, type: "text", maxChars: 64 }
    ],
    outputTitle: "キーワード候補",
    help: [
      "1語だけで入力すると、そのテーマに関連する幅広い候補が出ます（例：「FIRE」）",
      "複数の軸を組み合わせたい場合は、カンマ区切りで入力すると絞り込まれた候補になります（例：「FIRE、副業」「投資、節税」）",
      "結果がピンとこない時は、テーマ語を変えて何度でも試せます",
      "出た候補から1つ選んで、STEP2へ進みましょう"
    ]
  },
  {
    id: "step_02", num: 2, title: "市場勝率診断",
    description: "選んだ2語のキーワードで、Amazon Kindleに実際にどんなライバル本があるかを分析します。競合が少なく需要のある「狙い目」を見つけるのが目的です。",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/x0Ce5PCv2FjEaFs4",
    inputs: [
      { name: "keyword1", label: "1つ目のキーワード", desc: "STEP1で選んだ候補の1語目を入力します（例：「FIRE」）", source: "STEP1", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "keyword2", label: "2つ目のキーワード", desc: "STEP1で選んだ候補の2語目を入力します（例：「副業」）", source: "STEP1", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "amazon_html", label: "Amazon検索結果のHTMLソース", desc: "AmazonのKindleストアで2語を検索した結果ページのHTMLを貼り付けます。下の青いボタンから検索ページが直接開けます。貼り付け後は自動でAIが読み取れる形に整形します。", source: null, required: true, type: "textarea", maxChars: 1000000 }
    ],
    outputTitle: "診断結果",
    help: [
      "HTMLの取得方法：検索結果ページで右クリック→「ページのソースを表示」→Ctrl+A で全選択→Ctrl+C でコピー",
      "貼り付けて「実行する」を押すだけ。自動でクリーニングしてAIに渡します",
      "キーワードを変えて何度でも診断できます。複数の切り口を比較してみてください"
    ]
  },
  {
    id: "step_03", num: 3, title: "読者・価値設計",
    description: "この本を「誰に」「何を」届けるかを設計します。読者像・読者が抱えている悩み・読後の変化までを一気に作ります。本全体の方向性が決まる重要なSTEPです。",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/V0yHio0PcP42yJjQ",
    inputs: [
      { name: "keyword1", label: "検索キーワード1", desc: "STEP2で確定した1語目", source: "STEP2", required: true, type: "text", autoFill: false, maxChars: 128 },
      { name: "keyword2", label: "検索キーワード2", desc: "STEP2で確定した2語目", source: "STEP2", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "intent_lock", label: "検索意図仮説", desc: "STEP2の出力から「🎯 検索者の意図（仮説）」の文章を見つけて、そのまま貼り付けてください。「参照」ボタンでSTEP2の出力を右側に表示できます。", source: "STEP2", required: true, type: "textarea", autoFill: false, maxChars: 256 },
      { name: "market_report", label: "狙い目切り口（任意）", desc: "STEP2で見つけた「狙い目の切り口」の中から、書きたい切り口を1つ選んでください。「自動振り分け」ボタンを押すとSTEP2の出力から候補を自動抽出します。", source: "STEP2", required: false, type: "textarea", autoFill: false, maxChars: 256 }
    ],
    outputTitle: "設計結果",
    help: [
      "章数はデフォルト7章で生成されます",
      "章数を変えたい場合は、出力をClaude/ChatGPTなどに貼り付けて「6章構成に再構成して」と指示してください",
      "読者像がしっくりこない場合は、検索意図や切り口を変えて再実行できます"
    ]
  },
  {
    id: "step_04", num: 4, title: "エピソードインタビュー",
    description: "AIがあなたに質問しながら、本の素材となる体験談やエピソードを引き出します。他の本にはない差別化ポイントが、ここで集まる素材から生まれます。",
    category: "企画設計", type: "chat",
    url: "https://udify.app/chat/qbB9SNU5UG3gryYp",
    inputs: [
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "STEP3の出力を全文コピーして、まず最初にAIに貼り付けます。これをもとにAIが質問を考えます。", source: "STEP3", required: true, type: "textarea", autoFill: true, maxChars: 5000 }
    ],
    outputTitle: "インタビュー要約",
    help: [
      "AIは1回に1つだけ質問します。焦らず具体的に答えてください",
      "「数字は出せない」場合は「体感では◯◯くらい」でOKです",
      "質問が終わったら、AIが要約を出してくれます。その要約を保存してSTEP5以降で使います"
    ]
  },
  {
    id: "step_05", num: 5, title: "タイトル・サブタイトル作成",
    description: "Amazonで検索されやすく、かつ読者がクリックしたくなるタイトル案を複数作ります。2語キーワードは必ずタイトルかサブタイトルに含まれます。",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/z7djuT4RLqfAbEqY",
    inputs: [
      { name: "keyword1", label: "検索キーワード1", desc: "確定した1語目", source: "STEP2", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "keyword2", label: "検索キーワード2", desc: "確定した2語目", source: "STEP2", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "STEP3の出力を貼り付け（「自動振り分け」ボタンで自動入力できます）", source: "STEP3", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "STEP4のインタビュー要約を貼り付け（「自動振り分け」ボタンで自動入力できます）", source: "STEP4", required: true, type: "textarea", autoFill: true, maxChars: 5000 }
    ],
    outputTitle: "タイトル案",
    help: [
      "複数のタイトル案が出ます。気に入った1つを選んで次に進みましょう",
      "修正したい案だけを抜き出して、出力をAIチャットに貼り付けて指示すれば調整できます",
      "タイトルはあとからいつでも作り直せるので、気軽に決めて大丈夫です"
    ]
  },
  {
    id: "step_06", num: 6, title: "目次作成",
    description: "本全体の目次（章見出し+節見出し）を作ります。ここで本の骨格が決まります。",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/tcqNIyr8wpCBAJhb",
    inputs: [
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "STEP3の出力を貼り付け（「自動振り分け」で自動入力）", source: "STEP3", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "STEP4のインタビュー要約を貼り付け（「自動振り分け」で自動入力）", source: "STEP4", required: true, type: "textarea", autoFill: true, maxChars: 5000 }
    ],
    outputTitle: "完成目次",
    help: [
      "「はじめに」と「おわりに」は自動で付きます",
      "特定の章だけ修正したい場合は、出力をAIチャットに貼り付けて指示してください",
      "目次が気に入らない場合は、STEP3の読者・価値設計を見直すと改善することがあります"
    ]
  },
  {
    id: "step_07", num: 7, title: "章構成作成",
    description: "目次の各節に「この節で何を書くか」の要約を付けます。本文執筆前の最後の設計図になります。",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/4KDXsPKSlgk5qMu8",
    inputs: [
      { name: "toc_text", label: "目次作成のアウトプット", desc: "STEP6の目次を貼り付け（「自動振り分け」で自動入力）", source: "STEP6", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "STEP3の出力を貼り付け（「自動振り分け」で自動入力）", source: "STEP3", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "STEP4のインタビュー要約を貼り付け（「自動振り分け」で自動入力）", source: "STEP4", required: true, type: "textarea", autoFill: true, maxChars: 5000 }
    ],
    outputTitle: "章構成",
    help: [
      "全ての章の構成を1回で作ります",
      "特定の節だけ修正したい場合は、出力をAIチャットに貼り付けて指示してください",
      "次のSTEP8では、ここで作った章構成を1章ずつ細かく分解していきます"
    ]
  },
  {
    id: "step_08", num: 8, title: "詳細プロット作成",
    description: "1章分の節を、本文執筆に必要な細かさ（項）まで分解します。節の中をさらに①②③の項に分けて、各項で何を書くかの要約を作ります。本文作成の直前の工程です。",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/Ka9gpeDvAnkPV9hW",
    inputs: [
      { name: "chapter_outline_text", label: "1章分のアウトライン", desc: "STEP7の出力から、今回分解したい1章分だけをコピーして貼り付けてください。「参照」ボタンでSTEP7の出力を右側に表示できます。", source: "STEP7", required: true, type: "textarea", autoFill: false, maxChars: 2048 },
      { name: "added_episode_text", label: "著者が入れたいエピソード（任意）", desc: "この章でとくに入れたい体験談やエピソードがあれば書いてください。空欄でもOKです。", source: null, required: false, type: "textarea", maxChars: 1024 }
    ],
    outputTitle: "詳細プロット",
    help: [
      "1章ずつ処理します。「参照」ボタンでSTEP7の出力を開き、該当の章だけをコピーして貼り付けましょう",
      "出力の形式：(1)(2)(3)...が節、①②③...が項になります",
      "次のSTEP9で、この詳細プロットをもとに本文を作ります"
    ]
  },
  {
    id: "step_09", num: 9, title: "本文作成",
    description: "詳細プロットから節を選ぶと、その節の中の項（①②③...）の本文を連続で生成します。1節ずつ着実に本文を積み上げていくSTEPです。",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/lRAWtZGuVL4bqHM9",
    inputs: [
      { name: "detailed_plot_text", label: "詳細プロット作成のアウトプット（1章分）", desc: "STEP8の詳細プロットを貼り付け（「自動振り分け」で自動入力）", source: "STEP8", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "target_section", label: "執筆対象の節（1節分）", desc: "今回書きたい節を1つ選びます。下の「STEP8から節を抽出」ボタンを押すと、節の候補が一覧表示されます。1つクリックすると、その節に含まれる全ての項（①②③...）を連続で生成します。", source: "STEP8", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "past_writing_text", label: "著者の過去の執筆データ（任意）", desc: "あなたの過去の記事や原稿があれば貼り付けてください。AIが文体を真似て書いてくれます。空欄でもOKです。", source: null, required: false, type: "textarea", maxChars: 4000 }
    ],
    outputTitle: "生成された本文",
    help: [
      "1節ずつ処理します。節を選ぶと、その節の項（①②③...）を順番に生成して、1つの節としてまとまった文章で出力します",
      "途中でエラーが出た場合は、途中結果は破棄されます。もう一度「実行する」を押してください",
      "文体や内容を調整したい場合は、出力をAIチャットに貼り付けて指示してください"
    ]
  },
  {
    id: "step_10", num: 10, title: "Amazon説明文作成",
    description: "Amazonの商品ページに載せる本の紹介文を作ります。読者が「買いたい」と思う文章に仕上げます。",
    category: "販売準備", type: "workflow",
    url: "https://udify.app/workflow/6yWZfOGGU76ciJBI",
    inputs: [
      { name: "title_text", label: "タイトル", desc: "STEP5で確定したメインタイトル", source: "STEP5", required: true, type: "text", autoFill: false, maxChars: 128 },
      { name: "subtitle_text", label: "サブタイトル", desc: "STEP5で確定したサブタイトル", source: "STEP5", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "STEP3の出力を貼り付け（「自動振り分け」で自動入力）", source: "STEP3", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "STEP4のインタビュー要約を貼り付け（「自動振り分け」で自動入力）", source: "STEP4", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "outline_text", label: "章構成作成のアウトプット", desc: "STEP7の章構成を貼り付け（「自動振り分け」で自動入力）", source: "STEP7", required: true, type: "textarea", autoFill: true, maxChars: 20000 },
      { name: "author_profile_text", label: "著者プロフィール（任意）", desc: "著者の経歴や実績があれば書いてください。空欄でもOKです。", source: null, required: false, type: "textarea", maxChars: 2000 }
    ],
    outputTitle: "Amazon説明文",
    help: [
      "修正したい場合は、出力をAIチャットに貼り付けて修正を指示してください",
      "「冒頭の読者像をもっと絞って」「購読を促す文章を追加して」等と指示できます"
    ]
  }
];

const CATEGORIES = [
  { label: "企画設計", steps: [1, 2, 3, 4, 5] },
  { label: "執筆設計", steps: [6, 7, 8, 9] },
  { label: "販売準備", steps: [10] }
];

const STATUS_LABELS = { not_started: "未着手", in_progress: "進行中", completed: "完了" };
const STATUS_COLORS = {
  not_started: { bg: "rgba(120,120,130,0.1)", text: C.textLight },
  in_progress: { bg: C.blueLight, text: C.navyMid },
  completed:   { bg: C.greenLight, text: C.green }
};

// ============================================================
// ストレージ（localStorage版）
// ============================================================

const STORAGE_KEY = "aipub:project";
const STEPS_KEY_PREFIX = "aipub:step:";

const defaultProject = () => ({
  projectName: "新しい企画",
  currentStep: 1,
  lastUpdatedStep: null,
  createdAt: new Date().toISOString()
});

const defaultStepData = (num) => ({
  status: "not_started",
  inputData: {},
  outputText: "",
  updatedAt: null,
  isSaved: false
});

async function loadProject() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function saveProject(proj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(proj)); } catch (e) { console.error(e); }
}
async function loadStepData(num) {
  try { const raw = localStorage.getItem(STEPS_KEY_PREFIX + num); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ===== DEBUG: サーバーにログを送信する関数 =====
function sendDebugLog(label, data) {
  if (typeof window === "undefined") return;
  if (!window.__DEBUG_LOGS) window.__DEBUG_LOGS = [];
  const entry = { timestamp: new Date().toLocaleTimeString(), label, data };
  window.__DEBUG_LOGS.push(entry);
  console.log(`[DEBUG] ${label}`, data);
  try {
    fetch("/api/debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: window.__DEBUG_SESSION_ID || "unknown",
        label,
        data,
        userAgent: navigator.userAgent || ""
      })
    }).catch(() => {});
  } catch (e) { /* 無視 */ }
}
// ===== END DEBUG =====

async function saveStepData(num, data) {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STEPS_KEY_PREFIX + num, serialized);
    const outLen = (data?.outputText || "").length;
    const serLen = serialized.length;
    sendDebugLog(`SAVE STEP${num}`, { outputTextLength: outLen, serializedLength: serLen });
  } catch (e) {
    console.error(e);
    sendDebugLog(`SAVE_ERROR STEP${num}`, { error: e.message });
  }
}
async function loadAllSteps() {
  const all = {};
  for (let i = 1; i <= 10; i++) { all[i] = (await loadStepData(i)) || defaultStepData(i); }
  return all;
}
async function resetAllData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (let i = 1; i <= 10; i++) { localStorage.removeItem(STEPS_KEY_PREFIX + i); }
  } catch (e) { console.error(e); }
}

// ============================================================
// メインアプリ
// ============================================================

export default function App() {
  // ===== 2026/05/02追加：無料体験終了表示 =====
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: "24px",
      background: "#f4f3ef", fontFamily: "'Noto Sans JP', sans-serif", color: "#1a1a1a",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{
        maxWidth: 480, width: "100%", padding: "48px 32px",
        background: "#ffffff", border: "1px solid #d0cac0", borderRadius: 12,
        textAlign: "center", boxShadow: "0 2px 12px rgba(36,61,92,0.06)",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#243d5c", marginBottom: 16, letterSpacing: "0.02em" }}>
          無料体験は終了しました
        </div>
        <div style={{ fontSize: 14, color: "#444444", lineHeight: 1.8 }}>
          無料体験の受付は2026年4月30日(木)に終了いたしました。<br />
          次回の無料体験は、第3期募集時にご案内いたします。
        </div>
      </div>
    </div>
  );
  // ===== END 終了表示 =====
}
