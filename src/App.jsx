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
async function saveStepData(num, data) {
  try { localStorage.setItem(STEPS_KEY_PREFIX + num, JSON.stringify(data)); } catch (e) { console.error(e); }
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
// STEP2出力パーサー
// ============================================================

function parseStep2Output(text) {
  const titleMatch = text.match(/^#[^#].*[:：]\s*(.+?)\s*[×x×]\s*(.+?)\s*$/m);
  const keyword1 = titleMatch ? titleMatch[1].trim() : "";
  const keyword2 = titleMatch ? titleMatch[2].trim() : "";
  const intentMatch = text.match(/###\s*🎯\s*検索者の意図[（(]仮説[）)]\s*\n([\s\S]*?)(?=\n---|\n##|$)/);
  const marketMatch = text.match(/【狙い目の切り口】\s*\n([\s\S]*?)(?=\n---|\n##|\n【|$)/);
  let markets = [];
  if (marketMatch) {
    const section = marketMatch[1];
    const byBlankLine = section.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    if (byBlankLine.length >= 2) { markets = byBlankLine; }
    else {
      const lines = section.split("\n"); const blocks = []; let current = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "") { if (current.length > 0) { blocks.push(current.join("\n").trim()); current = []; } continue; }
        const isNewParagraph = current.length > 0 && !/^[\s　・\-•]/.test(line) && /^[^\s　]/.test(line);
        if (isNewParagraph) { blocks.push(current.join("\n").trim()); current = [line]; } else { current.push(line); }
      }
      if (current.length > 0) blocks.push(current.join("\n").trim());
      markets = blocks.filter(Boolean);
    }
  }
  return { keyword1, keyword2, intent: intentMatch ? intentMatch[1].trim() : "", markets };
}

// STEP8出力から節 (1)(2)(3) とその配下の項①②③を構造化して抽出
// 返り値: [{ sectionTitle: "(1) xxx", items: ["① ...", "② ..."] }, ...]
function extractSections(text) {
  if (!text || typeof text !== "string") return [];
  const sections = [];
  const lines = text.split("\n");
  // 節: (1) xxx、(2) xxx ...
  const sectionRegex = /^\([0-9]+\)[\s　]*.+$/;
  // 項: ①②③...⑳
  const itemRegex = /^[\u2460-\u2473][\s　]?.{2,100}$/;

  let currentSection = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (sectionRegex.test(line)) {
      // 新しい節を開始
      if (currentSection) sections.push(currentSection);
      currentSection = { sectionTitle: line, items: [] };
    } else if (itemRegex.test(line)) {
      // 現在の節に項を追加
      if (currentSection) {
        // 重複防止
        if (!currentSection.items.includes(line)) {
          currentSection.items.push(line);
        }
      } else {
        // 節がまだ見つかってない場合、暗黙の節を作る
        currentSection = { sectionTitle: "（節見出しなし）", items: [line] };
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  // 項が1つもない節は除外
  return sections.filter((s) => s.items.length > 0);
}

// STEP9の2つ目以降の項の出力から、章タイトル行と節見出し行を除去
// （節一括実行時に重複表示されるのを防ぐ）
// isFirst=true の場合はそのまま返す（最初の項は章・節も出したい）
function stripChapterSection(output, isFirst) {
  if (isFirst) return output;
  if (!output || typeof output !== "string") return output;

  const lines = output.split("\n");
  const result = [];
  let removedChapter = false;
  let removedSection = false;
  let sawContent = false;

  // 章タイトル：「第〜章」で始まる行
  const chapterRegex = /^第[0-9零一二三四五六七八九十百]+章/;
  // 節見出し：「(1)」「(2)」... で始まる行
  const sectionRegex = /^\([0-9]+\)/;

  for (const line of lines) {
    const trimmed = line.trim();

    // 先頭から順に、最初に出てくる章タイトル行を1回だけスキップ
    if (!sawContent && !removedChapter && chapterRegex.test(trimmed)) {
      removedChapter = true;
      continue;
    }

    // 章タイトル削除後、最初に出てくる節見出し行を1回だけスキップ
    if (!sawContent && removedChapter && !removedSection && sectionRegex.test(trimmed)) {
      removedSection = true;
      continue;
    }

    // 章・節を削除した直後の空行も除去（読みやすくするため）
    if (!sawContent && removedChapter && removedSection && !trimmed) {
      continue;
    }

    // 章だけあって節がない場合も、章を削除した直後の空行を除去
    if (!sawContent && removedChapter && !removedSection && !trimmed && result.length === 0) {
      continue;
    }

    // 有意なコンテンツが出現したフラグ
    if (trimmed) sawContent = true;
    result.push(line);
  }

  // 章・節が見つからなかった場合は元のまま返す（フォールバック）
  if (!removedChapter && !removedSection) return output;

  return result.join("\n").replace(/^\n+/, "");
}

// ============================================================
// 共通コンポーネント
// ============================================================

const Badge = ({ status }) => (
  <span style={{
    display: "inline-block", fontSize: 11, fontWeight: 600,
    padding: "2px 8px", borderRadius: 3,
    background: STATUS_COLORS[status].bg,
    color: STATUS_COLORS[status].text,
    letterSpacing: "0.03em", whiteSpace: "nowrap"
  }}>
    {STATUS_LABELS[status]}
  </span>
);

const MarketReportSelector = ({ options, selected, onSelect, onReselect, value, onChange }) => {
  if (!options || options.length === 0) return null;
  if (selected !== null) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>選んだ切り口（必要に応じて編集してください）</span>
          <button onClick={onReselect} style={{ fontSize: 11, color: C.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>
            選び直す
          </button>
        </div>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.gold, fontWeight: 600, marginBottom: 8 }}>切り口を1つ選んでください（選んだ後に編集できます）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} onClick={() => onSelect(i, opt)}
            style={{ padding: "12px 14px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 13, color: C.text, lineHeight: 1.7, transition: "all 0.12s" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: C.navyLight, color: C.navyMid, fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{opt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// STEP9用：節選択コンポーネント
// STEP8の詳細プロット出力から節(1)(2)(3)...を抽出してボタン選択式で表示
// 各節の配下の項数も表示
const SectionSelector = ({ sections, selected, onSelect, onReselect }) => {
  if (!sections || sections.length === 0) return null;
  if (selected !== null && sections[selected]) {
    const sec = sections[selected];
    return (
      <div style={{ marginTop: 8, padding: "12px 14px", background: C.greenLight, borderRadius: 4, border: `1px solid rgba(30,107,58,0.25)` }}>
        <div style={{ fontSize: 12, color: C.green, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600 }}>✓ 選択中の節（{sec.items.length}項を一括生成）</span>
          <button onClick={onReselect} style={{ fontSize: 11, color: C.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>
            選び直す
          </button>
        </div>
        <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, lineHeight: 1.6, marginBottom: 6 }}>
          {sec.sectionTitle}
        </div>
        <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
          {sec.items.map((item, i) => (
            <div key={i} style={{ paddingLeft: 8 }}>{item}</div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.gold, fontWeight: 600, marginBottom: 8 }}>
        執筆する節を1つ選んでください（{sections.length}節を検出）
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", padding: 2 }}>
        {sections.map((sec, i) => (
          <div key={i} onClick={() => onSelect(i, sec)}
            style={{ padding: "10px 14px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", transition: "all 0.12s" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4, lineHeight: 1.5 }}>
              {sec.sectionTitle}
            </div>
            <div style={{ fontSize: 11, color: C.textLight }}>
              {sec.items.length}項を一括生成 ／ 実行時間の目安：{Math.ceil(sec.items.length * 0.7)}〜{sec.items.length}分程度
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



const SourceLabel = ({ source, autoFill, onAutoFill, onRef, onAutoFillParsed }) =>
  source ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 12, color: C.navyMid, background: C.blueLight, padding: "2px 7px", borderRadius: 3 }}>← {source}の出力</span>
      {onAutoFillParsed ? (
        <button onClick={onAutoFillParsed} style={{ fontSize: 11, color: C.white, background: C.gold, border: "none", borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>自動振り分け</button>
      ) : autoFill === true ? (
        <button onClick={onAutoFill} style={{ fontSize: 11, color: C.white, background: C.navyMid, border: "none", borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>自動転記</button>
      ) : (
        <button onClick={onRef} style={{ fontSize: 11, color: C.navyMid, background: C.blueLight, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>参照</button>
      )}
    </span>
  ) : null;

const RequiredMark = () => (
  <span style={{ color: C.red, fontSize: 12, marginLeft: 4 }}>必須</span>
);

const BtnPrimary = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding: "10px 20px", background: disabled ? "#ccc" : C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 600, fontSize: 14, cursor: disabled ? "default" : "pointer", transition: "opacity 0.15s", letterSpacing: "0.03em", ...style }}>
    {children}
  </button>
);

const BtnSecondary = ({ children, onClick, style }) => (
  <button onClick={onClick}
    style={{ padding: "10px 20px", background: "transparent", color: C.navyMid, border: `1px solid ${C.border}`, borderRadius: 3, fontWeight: 500, fontSize: 14, cursor: "pointer", letterSpacing: "0.02em", ...style }}>
    {children}
  </button>
);

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.white, borderRadius: 6, border: `1px solid ${C.border}`, padding: 20, ...style }}>
    {children}
  </div>
);

// ステップ番号丸バッジ
const StepBadge = ({ num }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: C.navy, color: C.white, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{num}</span>
);

// セクション見出し（h2相当）
const SectionHeading = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
    <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0, letterSpacing: "0.03em" }}>{children}</h2>
  </div>
);

// ============================================================
// STEP2 HTML取得ヘルパー（Amazon検索ボタン + 折りたたみ手順図）
// ============================================================

const Step2HtmlHelper = ({ inputs, currentHtml }) => {
  const [showGuide, setShowGuide] = useState(true);
  const kw1 = (inputs.keyword1 || "").trim();
  const kw2 = (inputs.keyword2 || "").trim();
  const canOpenAmazon = kw1.length > 0 && kw2.length > 0;

  const handleOpenAmazon = () => {
    if (!canOpenAmazon) return;
    // Amazon.co.jp Kindleストア検索URL（i=digital-textでKindleストア固定）
    const query = encodeURIComponent(`${kw1} ${kw2}`);
    const url = `https://www.amazon.co.jp/s?i=digital-text&k=${query}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // HTML判定：data-asin を含むものだけ「貼り付け済み」とみなす
  const hasHtml = currentHtml.length > 0;
  const looksLikeHtml = /data-asin|<div|<html|<!DOCTYPE/i.test(currentHtml);
  const isCleanedFormat = /^\s*<div\s+data-asin/i.test(currentHtml);

  let statusLabel = "";
  let statusColor = C.textLight;
  let statusBg = "rgba(0,0,0,0.04)";
  if (!hasHtml) {
    statusLabel = "未入力";
  } else if (isCleanedFormat) {
    statusLabel = "✓ HTML検知（整形済み）";
    statusColor = C.green;
    statusBg = C.greenLight;
  } else if (looksLikeHtml) {
    statusLabel = "✓ HTML検知";
    statusColor = C.green;
    statusBg = C.greenLight;
  } else {
    statusLabel = "⚠ HTMLではない可能性";
    statusColor = C.gold;
    statusBg = C.goldPale;
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Amazon検索ボタンセクション */}
      <div style={{
        padding: "14px 16px",
        background: canOpenAmazon ? "#eef2f7" : "rgba(0,0,0,0.03)",
        border: `1px solid ${canOpenAmazon ? "#c8d4e0" : C.border}`,
        borderRadius: 6,
        marginBottom: 10
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
          Amazon側でやること
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleOpenAmazon}
            disabled={!canOpenAmazon}
            style={{
              padding: "9px 18px",
              background: canOpenAmazon ? C.navy : "rgba(0,0,0,0.1)",
              color: canOpenAmazon ? C.white : C.textLight,
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: canOpenAmazon ? "pointer" : "default",
              letterSpacing: "0.02em",
              flexShrink: 0
            }}
          >
            🔍 AmazonでKindle検索を開く
          </button>
          <div style={{ fontSize: 12, color: C.textSub, flex: 1, minWidth: 200, lineHeight: 1.6 }}>
            {canOpenAmazon
              ? <>検索後、ページ上で<strong>右クリック→「ページのソースを表示」→全選択してコピー</strong>してください。</>
              : <>上の「キーワード1・2」を入力すると、このボタンから検索ページを開けます。</>}
          </div>
        </div>
      </div>

      {/* 折りたたみ式の詳細手順 */}
      <div style={{ marginBottom: 10 }}>
        <div
          onClick={() => setShowGuide(!showGuide)}
          style={{
            fontSize: 12.5,
            color: C.navyMid,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 0",
            fontWeight: 600
          }}
        >
          <span style={{
            transform: showGuide ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            display: "inline-block"
          }}>▶</span>
          詳しい手順図
        </div>
        {showGuide && (
          <div style={{ marginTop: 8, padding: "14px 16px", background: "#f4f3ef", border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <svg width="100%" viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="ha2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </marker>
              </defs>

              {/* 左列：Amazon側でやること */}
              <rect x="10" y="10" width="310" height="240" rx="6" fill="none" stroke="#c8d4e0" strokeWidth="0.5" strokeDasharray="3 3"/>
              <text fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#2a4468" x="20" y="28">Amazon側でやること</text>

              <rect x="30" y="44" width="270" height="50" rx="6" fill="#edf2f8" stroke="#2a4468" strokeWidth="0.5"/>
              <text fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#1a2e4a" x="45" y="65">①</text>
              <text fontFamily="sans-serif" fontSize="12" fill="#2a4468" x="60" y="65">Kindleストアでキーワード2語を検索</text>
              <text fontFamily="sans-serif" fontSize="10" fill="#688" x="60" y="82">(上の青いボタンを使うとワンクリックで開けます)</text>
              <line x1="165" y1="94" x2="165" y2="110" stroke="#555" strokeWidth="1.2" markerEnd="url(#ha2)"/>

              <rect x="30" y="114" width="270" height="50" rx="6" fill="#edf2f8" stroke="#2a4468" strokeWidth="0.5"/>
              <text fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#1a2e4a" x="45" y="134">②</text>
              <text fontFamily="sans-serif" fontSize="12" fill="#2a4468" x="60" y="134">検索結果ページで右クリック</text>
              <text fontFamily="sans-serif" fontSize="11" fill="#2a4468" x="60" y="151">→ 「ページのソースを表示」</text>
              <line x1="165" y1="164" x2="165" y2="180" stroke="#555" strokeWidth="1.2" markerEnd="url(#ha2)"/>

              <rect x="30" y="184" width="270" height="50" rx="6" fill="#edf2f8" stroke="#2a4468" strokeWidth="0.5"/>
              <text fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#1a2e4a" x="45" y="204">③</text>
              <text fontFamily="sans-serif" fontSize="12" fill="#2a4468" x="60" y="204">Ctrl+A → Ctrl+C で全選択してコピー</text>
              <text fontFamily="sans-serif" fontSize="10" fill="#688" x="60" y="221">(Macの場合は Cmd+A → Cmd+C)</text>

              {/* 矢印：左列から右列へ */}
              <line x1="300" y1="209" x2="350" y2="209" stroke="#555" strokeWidth="1.5" markerEnd="url(#ha2)"/>

              {/* 右列：このページでやること */}
              <rect x="360" y="10" width="310" height="240" rx="6" fill="none" stroke="#c8d4e0" strokeWidth="0.5" strokeDasharray="3 3"/>
              <text fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#1a4a2e" x="370" y="28">このページでやること</text>

              <rect x="380" y="184" width="270" height="50" rx="6" fill="#e4f2ec" stroke="#1e6b3a" strokeWidth="0.5"/>
              <text fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#1a4a2e" x="395" y="204">④</text>
              <text fontFamily="sans-serif" fontSize="12" fill="#1e6b3a" x="410" y="204">下の欄にCtrl+Vで貼り付け</text>
              <text fontFamily="sans-serif" fontSize="10" fill="#2d7a4f" x="410" y="221">(貼り付けに少し時間がかかります)</text>
              <line x1="515" y1="184" x2="515" y2="160" stroke="#555" strokeWidth="1.2" markerEnd="url(#ha2)"/>

              <rect x="380" y="114" width="270" height="50" rx="6" fill="#e4f2ec" stroke="#1e6b3a" strokeWidth="0.5"/>
              <text fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#1a4a2e" x="395" y="134">⑤</text>
              <text fontFamily="sans-serif" fontSize="12" fill="#1e6b3a" x="410" y="134">「▶ 実行する」ボタンを押す</text>
              <text fontFamily="sans-serif" fontSize="10" fill="#2d7a4f" x="410" y="151">(自動でクリーニングしてAIに渡します)</text>
            </svg>
          </div>
        )}
      </div>

      {/* 貼り付け先ラベル */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        padding: "6px 12px",
        background: statusBg,
        borderRadius: 4,
        border: `1px solid ${hasHtml ? (isCleanedFormat || looksLikeHtml ? "rgba(45,122,79,0.2)" : "rgba(184,146,42,0.3)") : C.border}`
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>⬇ 下の欄にHTMLを貼り付け</span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: statusColor,
          marginLeft: "auto"
        }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
};

// ============================================================
// 左メニュー
// ============================================================

const SideMenu = ({ currentPage, onNavigate, stepStatuses }) => {
  const menuItem = (label, page, status) => {
    const active = currentPage === page;
    return (
      <div key={page} onClick={() => onNavigate(page)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 18px", cursor: "pointer",
          background: active ? "rgba(26,46,74,0.08)" : "transparent",
          color: active ? C.navy : "#3d3d3d",
          fontWeight: active ? 700 : 400,
          fontSize: 13, lineHeight: 1.3,
          borderLeft: active ? `2px solid ${C.gold}` : "2px solid transparent",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          whiteSpace: "nowrap", overflow: "hidden",
          transition: "background 0.1s, color 0.1s",
        }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", marginRight: 8 }}>{label}</span>
        {status && <Badge status={status} />}
      </div>
    );
  };

  const catLabel = (text) => (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.white,
      letterSpacing: "0.06em", padding: "7px 18px",
      background: C.navy,
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      {text}
    </div>
  );

  return (
    <div style={{
      width: 300, minWidth: 300, height: "100vh", overflowY: "auto",
      background: C.navy,
      display: "flex", flexDirection: "column",
      boxSizing: "border-box",
      position: "fixed", left: 0, top: 0, zIndex: 10,
      borderRight: `2px solid ${C.gold}`,
    }}>
      {/* ロゴ */}
      <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            <div style={{ width: 20, height: 2.5, background: C.gold, borderRadius: 1 }} />
            <div style={{ width: 15, height: 2.5, background: `rgba(184,146,42,0.6)`, borderRadius: 1 }} />
            <div style={{ width: 18, height: 2.5, background: `rgba(184,146,42,0.35)`, borderRadius: 1 }} />
          </div>
          <div style={{ width: 1.5, height: 42, background: C.gold, flexShrink: 0, opacity: 0.6 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em", lineHeight: 1.3, fontFamily: "'Noto Sans JP', sans-serif" }}>AI出版プロデューサー</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 5, letterSpacing: "0.04em", fontFamily: "'Noto Sans JP', sans-serif" }}>Kindle出版を10ステップで進める</div>
          </div>
        </div>
        <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, rgba(184,146,42,0.2), transparent)` }} />
      </div>

      {/* ナビゲーション（ベージュ） */}
      <div style={{ flex: 1, background: "#f4f3ef" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.white, letterSpacing: "0.06em", padding: "7px 18px", background: C.navy }}>ホーム</div>
        {menuItem("ダッシュボード", "home", null)}
        {menuItem("使い方", "guide", null)}

        {CATEGORIES.map((cat) => (
          <div key={cat.label}>
            {catLabel(cat.label)}
            {cat.steps.map((n) => {
              const s = STEPS[n - 1];
              return menuItem(`STEP${n}　${s.title}`, `step_${n}`, stepStatuses[n]);
            })}
          </div>
        ))}

        {catLabel("データ管理")}
        {menuItem("保存データ", "saved", null)}
      </div>
    </div>
  );
};

// ============================================================
// ホーム画面
// ============================================================

const HomePage = ({ project, stepStatuses, allSteps, onNavigate }) => {
  const completedCount = Object.values(stepStatuses).filter((s) => s === "completed").length;
  const currentStep = project.currentStep || 1;
  const lastUpdated = project.lastUpdatedStep;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ========== 修正1：スキップ入口カード用のホバー状態 ==========
  const [hoveredStartCard, setHoveredStartCard] = useState(null);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", marginBottom: 6 }}>DASHBOARD</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.navy, margin: "0 0 8px", letterSpacing: "-0.01em" }}>AI出版プロデューサー</h1>
        <p style={{ fontSize: 14, color: C.textSub, margin: "0 0 16px", lineHeight: 1.7 }}>10のツールで、テーマ発見から本文執筆・Amazon掲載まで進めます</p>
        <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9 }} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "nowrap" }}>
        <Card style={{ flex: "1 1 0", minWidth: 0, borderTop: `2px solid ${C.navy}` }}>
          <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" }}>現在のステップ</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{`STEP${currentStep} ${STEPS[currentStep - 1]?.title}`}</div>
        </Card>
        <Card style={{ flex: "1 1 0", minWidth: 0, borderTop: `2px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" }}>最後に更新したステップ</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{lastUpdated ? `STEP${lastUpdated} ${STEPS[lastUpdated - 1]?.title}` : "—"}</div>
        </Card>
        <Card style={{ flex: "0 0 auto", borderTop: `2px solid ${C.gold}` }}>
          <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" }}>完了数</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>
            {completedCount}<span style={{ fontSize: 13, color: C.textLight, fontWeight: 500 }}> / 10</span>
          </div>
        </Card>
      </div>

      {/* ========== 修正1：始め方を選ぶ（新規追加セクション） ========== */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12, letterSpacing: "0.03em" }}>始め方を選ぶ</h2>
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12, lineHeight: 1.7 }}>
          初めて使う方は「ゼロから始める」を選んでください。すでに狙う2語キーワードが決まっている方は、STEP1をスキップしてSTEP2から始められます。
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {/* 通常フロー */}
          <Card
            style={{
              flex: "1 1 280px", minWidth: 0, cursor: "pointer",
              borderTop: `3px solid ${C.navy}`,
              transition: "box-shadow 0.15s, transform 0.15s",
              boxShadow: hoveredStartCard === "A" ? "0 4px 12px rgba(36,61,92,0.15)" : "none",
              transform: hoveredStartCard === "A" ? "translateY(-2px)" : "translateY(0)"
            }}
            onClick={() => onNavigate("step_1")}
          >
            <div
              onMouseEnter={() => setHoveredStartCard("A")}
              onMouseLeave={() => setHoveredStartCard(null)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 4, background: C.navy, color: C.white,
                  fontSize: 14, fontWeight: 700
                }}>A</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
                  ゼロから始める
                </span>
              </div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 10 }}>
                テーマは決まっているが、狙うキーワードはまだ決めていない方。Amazon Kindleの市場データから2語キーワード候補を抽出します。
              </div>
              <div style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>
                → STEP1 テーマ発見へ
              </div>
            </div>
          </Card>

          {/* スキップフロー */}
          <Card
            style={{
              flex: "1 1 280px", minWidth: 0, cursor: "pointer",
              borderTop: `3px solid ${C.gold}`,
              transition: "box-shadow 0.15s, transform 0.15s",
              boxShadow: hoveredStartCard === "B" ? "0 4px 12px rgba(184,146,42,0.2)" : "none",
              transform: hoveredStartCard === "B" ? "translateY(-2px)" : "translateY(0)"
            }}
            onClick={() => onNavigate("step_2")}
          >
            <div
              onMouseEnter={() => setHoveredStartCard("B")}
              onMouseLeave={() => setHoveredStartCard(null)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 4, background: C.gold, color: C.white,
                  fontSize: 14, fontWeight: 700
                }}>B</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
                  キーワードが決まっている
                </span>
              </div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 10 }}>
                狙う2語キーワードがすでに明確な方。STEP1をスキップして、市場勝率診断から始められます。
              </div>
              <div style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>
                → STEP2 市場勝率診断へ
              </div>
            </div>
          </Card>
        </div>
      </div>
      {/* ========== 修正1 ここまで ========== */}

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12, letterSpacing: "0.03em" }}>進行中のステップ</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {STEPS.map((s) => (
            <div key={s.id} onClick={() => onNavigate(`step_${s.num}`)}
              style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, cursor: "pointer", transition: "box-shadow 0.12s" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 4, fontSize: 12, fontWeight: 700,
                background: stepStatuses[s.num] === "completed" ? C.greenLight : stepStatuses[s.num] === "in_progress" ? C.blueLight : "rgba(0,0,0,0.04)",
                color: stepStatuses[s.num] === "completed" ? C.green : stepStatuses[s.num] === "in_progress" ? C.navyMid : C.textLight,
                marginRight: 14, flexShrink: 0
              }}>{s.num}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: C.text }}>{s.title}</span>
              <Badge status={stepStatuses[s.num]} />
              <span style={{ marginLeft: 12, fontSize: 12, color: C.gold, fontWeight: 600 }}>開く →</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>その他の操作</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BtnSecondary onClick={() => onNavigate("saved")}>保存データを参照</BtnSecondary>
          <BtnSecondary onClick={() => setShowResetConfirm(true)}>保存データを削除</BtnSecondary>
          <BtnSecondary onClick={() => onNavigate("guide")}>使い方を参照</BtnSecondary>
        </div>
        {showResetConfirm && (
          <div style={{ marginTop: 12, padding: 16, background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.red, marginBottom: 10 }}>現在のデータはすべてリセットされます。よろしいですか？</div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnPrimary onClick={async () => { await resetAllData(); location.reload(); }} style={{ background: C.red }}>リセットする</BtnPrimary>
              <BtnSecondary onClick={() => setShowResetConfirm(false)}>キャンセル</BtnSecondary>
            </div>
          </div>
        )}
      </div>

      <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.navyMid, margin: "0 0 10px" }}>このツールの使い方</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.textSub, lineHeight: 1.9 }}>
          <li>AI出版プロデューサーは素材を出すツールです</li>
          <li>出力はそのまま使うことも、修正して使うこともできます</li>
          <li>修正は自分またはAIチャットで行ってください</li>
        </ul>
      </Card>
    </div>
  );
};

// ============================================================
// HTML Cleaner（STEP2用）
// ============================================================

function cleanHtmlMinimal(html) {
  const results = []; const seen = new Set();
  const searchResultTags = html.match(/<[^>]*data-component-type\s*=\s*"s-search-result"[^>]*>/gi) || [];
  for (const tag of searchResultTags) {
    const asinMatch = tag.match(/data-asin="([A-Za-z0-9]{10})"/i);
    if (asinMatch) { const c = `<div data-asin="${asinMatch[1]}" data-component-type="s-search-result">`; if (!seen.has(c)) { seen.add(c); results.push(c); } }
  }
  const asinTags = html.match(/<[^>]*data-asin="[A-Za-z0-9]{10}"[^>]*>/gi) || [];
  for (const tag of asinTags) {
    const asinMatch = tag.match(/data-asin="([A-Za-z0-9]{10})"/i);
    if (asinMatch) { const c = `<div data-asin="${asinMatch[1]}">`;  if (!seen.has(c)) { seen.add(c); results.push(c); } }
  }
  const dpLinks = html.match(/<a[^>]*href="[^"]*(?:\/dp\/|\/gp\/product\/)[A-Za-z0-9]{10}[^"]*"[^>]*>/gi) || [];
  for (const tag of dpLinks) {
    const hrefMatch = tag.match(/href="([^"]*(?:\/dp\/|\/gp\/product\/)[A-Za-z0-9]{10}[^"]*)"/i);
    if (hrefMatch) { let href = hrefMatch[1]; const qIdx = href.indexOf("?"); if (qIdx !== -1) href = href.substring(0, qIdx); const c = `<a href="${href}">`; if (!seen.has(c)) { seen.add(c); results.push(c); } }
  }
  return results.join("\n");
}

// ============================================================
// 各機能画面（共通テンプレート）
// ============================================================

const StepPage = ({ step, stepData, project, onNavigate, onSaveInput, onSaveOutput, onUpdateProject, onInputChange, allSteps, onRefPanel }) => {
  const [inputs, setInputs] = useState(stepData.inputData || {});
  const [outputText, setOutputText] = useState(stepData.outputText || "");
  const [saveInputMsg, setSaveInputMsg] = useState(false);
  const [saveOutputMsg, setSaveOutputMsg] = useState(false);
  const [copyInputMsg, setCopyInputMsg] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [charErrors, setCharErrors] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  // チャット型（STEP1・4）用
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversationId, setChatConversationId] = useState("");
  const [chatError, setChatError] = useState("");
  const chatBottomRef = useRef(null);
  const [chatCopyMsg, setChatCopyMsg] = useState(false);
  const [chatTransferMsg, setChatTransferMsg] = useState(false);
  const [chatSelectOptions, setChatSelectOptions] = useState([]);
  const [chatSelectMsg, setChatSelectMsg] = useState(false);
  const chatAreaRef = useRef(null);
  const [marketOptions, setMarketOptions] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  // STEP9用：節選択と一括実行
  const [sectionOptions, setSectionOptions] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionProgress, setSectionProgress] = useState(null);
    // { total: 5, current: 2, currentItemName: "...", results: [...] }

  useEffect(() => {
    setInputs(stepData.inputData || {}); setOutputText(stepData.outputText || "");
    setHelpOpen(false); setValidationErrors([]); setCharErrors({}); setRunError("");
    setMarketOptions([]); setSelectedMarket(null);
    setSectionOptions([]); setSelectedSection(null); setSectionProgress(null);
    setChatMessages([]); setChatInput(""); setChatLoading(false);
    setChatConversationId(""); setChatError(""); setChatCopyMsg(false); setChatTransferMsg(false); setChatSelectOptions([]); setChatSelectMsg(false);
  }, [step.num]);

  const prevStep = step.num > 1 ? STEPS[step.num - 2] : null;
  const nextStep = step.num < 10 ? STEPS[step.num] : null;

  const handleInputChange = (name, value) => {
    setInputs((prev) => { const updated = { ...prev, [name]: value }; onInputChange?.(step.num, updated); return updated; });
    setValidationErrors((prev) => prev.filter((e) => e !== name));
    const field = step.inputs.find((f) => f.name === name);
    if (field?.maxChars && name !== "amazon_html") setCharErrors((prev) => ({ ...prev, [name]: value.length > field.maxChars }));
  };

  const validateInputs = () => {
    const errors = []; const newCharErrors = {};
    step.inputs.forEach((field) => {
      if (field.required && !(inputs[field.name] || "").trim()) errors.push(field.name);
      if (field.maxChars && field.name !== "amazon_html" && (inputs[field.name] || "").length > field.maxChars) newCharErrors[field.name] = true;
    });
    setValidationErrors(errors); setCharErrors(newCharErrors);
    return errors.length > 0 || Object.keys(newCharErrors).length > 0 ? [...errors, ...Object.keys(newCharErrors)] : [];
  };

  const handleSaveInput = async () => {
    if (validateInputs().length > 0) return;
    await onSaveInput(step.num, inputs); setSaveInputMsg(true); setTimeout(() => setSaveInputMsg(false), 2000);
  };

  const handleSaveOutput = async () => {
    await onSaveOutput(step.num, outputText);
    setSaveOutputMsg("saved");
    setTimeout(() => setSaveOutputMsg(false), 2000);
  };

  const handleRunDify = async () => {
    if (validateInputs().length > 0) return;
    setIsRunning(true); setRunError("");

    // STEP9：節一括実行（項を順次ループしてDifyに投げる）
    if (step.num === 9) {
      // 選択された節を取得
      const sectionToRun = selectedSection !== null ? sectionOptions[selectedSection] : null;
      if (!sectionToRun || !sectionToRun.items || sectionToRun.items.length === 0) {
        setRunError("執筆する節が選ばれていません。\n\n上の「📋 STEP8から節を抽出」ボタンを押して、書きたい節を1つ選んでください。");
        setIsRunning(false);
        return;
      }

      const items = sectionToRun.items;
      const total = items.length;
      const results = [];

      try {
        for (let i = 0; i < total; i++) {
          const currentItem = items[i];
          // 進捗更新
          setSectionProgress({
            total,
            current: i + 1,
            currentItemName: currentItem
          });

          // 各項ごとにDify APIを呼び出し
          // Difyに渡すのは target_heading（項単位の既存仕様に合わせる）
          const execInputs = {
            detailed_plot_text: inputs.detailed_plot_text || "",
            target_heading: currentItem,
            past_writing_text: inputs.past_writing_text || ""
          };

          const response = await fetch("/api/dify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stepNum: 9, inputs: execInputs })
          });
          const data = await response.json();

          if (!response.ok) {
            // エラー時：途中までの結果を破棄し、エラー表示
            const errorMsg = data.error || "不明なエラー";
            setRunError(`節の生成中にエラーが発生しました。\n\n${total}項目中、${i + 1}項目目（${currentItem}）の生成で失敗しました。途中までの生成結果は破棄されます。\n\n少し時間をおいてから、もう一度「実行する」を押してください。\n\n（エラー詳細：${errorMsg}）`);
            setSectionProgress(null);
            setIsRunning(false);
            return;
          }
          results.push(data.output || "");
        }

        // 全項成功：2つ目以降の章・節タイトルを除去してから連結
        const cleaned = results.map((out, idx) => stripChapterSection(out, idx === 0));
        const combined = cleaned.join("\n\n");
        setOutputText(combined);
        await onSaveInput(step.num, {
          detailed_plot_text: inputs.detailed_plot_text || "",
          target_section: sectionToRun.sectionTitle,
          past_writing_text: inputs.past_writing_text || ""
        });
        setSectionProgress(null);
      } catch (e) {
        setRunError(`通信エラーが発生しました。途中までの生成結果は破棄されました。\n\nインターネット接続を確認して、少し時間をおいてからもう一度「実行する」を押してください。\n\n（エラー詳細：${e.message}）`);
        setSectionProgress(null);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // その他のSTEP（従来通り）
    try {
      let execInputs = { ...inputs };
      if (step.num === 2 && execInputs.amazon_html) { const cleaned = cleanHtmlMinimal(execInputs.amazon_html); if (cleaned) execInputs.amazon_html = cleaned; }
      const response = await fetch("/api/dify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepNum: step.num, inputs: execInputs }) });
      const data = await response.json();
      if (!response.ok) { setRunError(data.error || "実行中にエラーが発生しました。少し時間をおいてからもう一度お試しください。"); }
      else { setOutputText(data.output || ""); await onSaveInput(step.num, execInputs); }
    } catch (e) { setRunError("通信エラーが発生しました。インターネット接続を確認して、少し時間をおいてからもう一度お試しください。"); }
    finally { setIsRunning(false); }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const response = await fetch("/api/dify-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNum: step.num, message: text, conversation_id: chatConversationId }),
      });
      const data = await response.json();
      if (!response.ok) { setChatError(data.error || "送信に失敗しました"); }
      else {
        if (data.conversation_id) setChatConversationId(data.conversation_id);
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
        setTimeout(() => { if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight; }, 50);
      }
    } catch (e) { setChatError("通信エラーが発生しました。時間をおいて再度お試しください。"); }
    finally { setChatLoading(false); }
  };

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>STEP {step.num}</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{step.title}</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0 }}>{step.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {prevStep && <BtnSecondary onClick={() => onNavigate(`step_${prevStep.num}`)} style={{ fontSize: 12, padding: "7px 14px" }}>← STEP{prevStep.num}</BtnSecondary>}
          {nextStep && <BtnSecondary onClick={() => onNavigate(`step_${nextStep.num}`)} style={{ fontSize: 12, padding: "7px 14px" }}>STEP{nextStep.num} →</BtnSecondary>}
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      {/* ========== 修正2：STEP1にスキップ案内を追加 ========== */}
      {step.num === 1 && (
        <Card style={{
          marginBottom: 16,
          background: C.goldPale,
          border: `1px solid ${C.goldLight}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
                すでにキーワードが決まっている方へ
              </div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7 }}>
                狙う2語キーワードが明確な場合は、STEP1をスキップしてSTEP2から始められます。
              </div>
            </div>
            <button
              onClick={() => onNavigate("step_2")}
              style={{
                fontSize: 12.5,
                background: C.gold,
                color: C.white,
                border: "none",
                borderRadius: 3,
                padding: "9px 18px",
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
                letterSpacing: "0.02em"
              }}
            >
              STEP2から始める →
            </button>
          </div>
        </Card>
      )}
      {/* ========== 修正2 ここまで ========== */}

      {/* 進め方カード */}
      <Card style={{ marginBottom: 24, background: "#eef2f7", border: `1px solid #c8d4e0` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>このステップの進め方</div>
        <div style={{ fontSize: 13.5, color: "#2a2a2a", lineHeight: 2.1 }}>
          {step.type === "chat" ? (
            <><span style={{ fontWeight: 700, color: C.navy }}>①</span> 下の「入力データ」に情報を入力して保存する<br /><span style={{ fontWeight: 700, color: C.navy }}>②</span> チャット欄でAIと対話する（このページを離れずに会話できます）<br /><span style={{ fontWeight: 700, color: C.navy }}>③</span> 会話が終わったら結果をコピー →「出力データ」に貼り付けて保存する</>
          ) : (
            <><span style={{ fontWeight: 700, color: C.navy }}>①</span> 下の「入力データ」に情報を入力する{step.inputs.some((f) => f.source) && "（前ステップの出力を貼り付け）"}<br /><span style={{ fontWeight: 700, color: C.navy }}>②</span> 「実行する」ボタンを押す → AIが処理して結果が自動で表示される<br /><span style={{ fontWeight: 700, color: C.navy }}>③</span> 出力内容を確認して保存する</>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#555555", marginTop: 8, lineHeight: 1.7 }}>
          出力はそのまま使うことも、自分で修正したり、AIチャット（Claude・ChatGPT等）で整えてから使うこともできます。
        </div>
      </Card>

      {/* ① 入力データ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>入力データ</h2>
        </div>

        {validationErrors.length > 0 && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red, fontWeight: 500 }}>
            必須の項目がまだ空欄です。赤くなっている欄を入力してから、もう一度お試しください。
          </div>
        )}

        {step.num === 3 && (
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12, padding: "10px 14px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 4, lineHeight: 1.8 }}>
            💡 「検索意図仮説」と「狙い目切り口」の欄にある<span style={{ fontWeight: 700, color: C.gold }}>「自動振り分け」</span>ボタンを押すと、STEP2の出力から自動で該当箇所を抽出して入力してくれます。手動コピペが不要になるので便利です。
          </div>
        )}
        {step.num === 5 && (
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12, padding: "10px 14px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 4, lineHeight: 1.8 }}>
            💡 「検索キーワード1・2」の欄にある<span style={{ fontWeight: 700, color: C.gold }}>「自動振り分け」</span>ボタンを押すと、STEP2の出力からキーワードを自動で入力してくれます。
          </div>
        )}
        {step.num !== 3 && step.num !== 5 && step.inputs.some((f) => f.source) && (
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12, padding: "8px 12px", background: C.blueLight, border: `1px solid rgba(42,68,104,0.12)`, borderRadius: 4, lineHeight: 1.7 }}>
            左メニューの「保存データ」から前のステップの出力をコピーし、各欄に貼り付けてください。
          </div>
        )}

        {step.inputs.map((field) => {
          const hasError = validationErrors.includes(field.name);
          const hasCharError = charErrors[field.name];
          const currentLen = (inputs[field.name] || "").length;
          const isOverLimit = field.maxChars && currentLen > field.maxChars;

          const isStep3ParsedField = (step.num === 3 || step.num === 5) &&
            (field.name === "keyword1" || field.name === "keyword2" || field.name === "intent_lock" || field.name === "market_report");

          const handleAutoFillParsed = isStep3ParsedField ? () => {
            const srcOutput = allSteps?.[2]?.outputText;
            if (!srcOutput) { alert("STEP2の出力データがまだ保存されていません。\n\nSTEP2を完了して「出力データを保存」ボタンを押してから、もう一度お試しください。"); return; }
            const parsed = parseStep2Output(srcOutput);
            if (field.name === "keyword1") { if (parsed.keyword1) handleInputChange("keyword1", parsed.keyword1); else alert("STEP2の出力から「キーワード1」が見つかりませんでした。\n\nSTEP2の出力形式が想定と違う可能性があります。手動で入力してください。"); }
            if (field.name === "keyword2") { if (parsed.keyword2) handleInputChange("keyword2", parsed.keyword2); else alert("STEP2の出力から「キーワード2」が見つかりませんでした。\n\nSTEP2の出力形式が想定と違う可能性があります。手動で入力してください。"); }
            if (field.name === "intent_lock") { if (parsed.intent) handleInputChange("intent_lock", parsed.intent); else alert("STEP2の出力から「🎯 検索者の意図（仮説）」の部分が見つかりませんでした。\n\n手動でSTEP2の出力から該当部分をコピーして貼り付けてください。"); }
            if (field.name === "market_report") { if (parsed.markets && parsed.markets.length > 0) { setMarketOptions(parsed.markets); setSelectedMarket(null); handleInputChange("market_report", ""); } else { alert("STEP2の出力から「狙い目の切り口」が見つかりませんでした。\n\n手動でSTEP2の出力から切り口をコピーして貼り付けてください。"); } }
          } : undefined;

          if (field.name === "market_report") {
            return (
              <div key={field.name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>{field.label}</label>
                  <SourceLabel source={field.source} autoFill={field.autoFill} onAutoFill={() => {}}
                    onRef={() => { const s = allSteps?.[2]?.outputText; if (s) onRefPanel({ stepNum: 2, text: s, targetField: "market_report" }); else alert("STEP2の出力データがまだ保存されていません。\n\nSTEP2を完了して「出力データを保存」ボタンを押してから、もう一度お試しください。"); }}
                    onAutoFillParsed={handleAutoFillParsed} />
                </div>
                <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>{field.desc}</div>
                {marketOptions.length === 0 && (
                  <textarea value={inputs[field.name] || ""} onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder="「自動振り分け」ボタンで候補を表示するか、直接入力してください" rows={4}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
                )}
                {marketOptions.length > 0 && (
                  <MarketReportSelector options={marketOptions} selected={selectedMarket}
                    onSelect={(i, opt) => { setSelectedMarket(i); handleInputChange("market_report", opt); }}
                    onReselect={() => { setSelectedMarket(null); handleInputChange("market_report", ""); }}
                    value={inputs["market_report"] || ""} onChange={(v) => handleInputChange("market_report", v)} />
                )}
              </div>
            );
          }

          // STEP9 target_section: 節自動抽出＆ボタン選択UI（節一括実行）
          if (field.name === "target_section") {
            const hasSectionErr = validationErrors.includes(field.name);
            return (
              <div key={field.name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: hasSectionErr ? C.red : C.navy }}>{field.label}</label>
                  {field.required && <RequiredMark />}
                  <SourceLabel source={field.source} autoFill={false}
                    onAutoFill={() => {}}
                    onRef={() => {
                      const s = allSteps?.[8]?.outputText;
                      if (s) onRefPanel({ stepNum: 8, text: s, targetField: "target_section" });
                      else alert("STEP8の出力データがまだ保存されていません。\n\nSTEP8を完了して「出力データを保存」ボタンを押してから、もう一度お試しください。");
                    }} />
                  {hasSectionErr && <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>← 節を選んでください</span>}
                </div>
                <div style={{ fontSize: 13, color: "#444444", marginBottom: 8 }}>{field.desc}</div>

                {/* 抽出ボタン */}
                <div style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => {
                      const srcOutput = allSteps?.[8]?.outputText;
                      if (!srcOutput) {
                        alert("STEP8の出力データがまだ保存されていません。\n\nSTEP8を完了して「出力データを保存」ボタンを押してから、もう一度お試しください。");
                        return;
                      }
                      const extracted = extractSections(srcOutput);
                      if (extracted.length === 0) {
                        alert("STEP8の出力から「(1)(2)(3)...」形式の節を検出できませんでした。\n\nSTEP8の出力がまだ完了していない、もしくは形式が想定と違う可能性があります。STEP8の出力をもう一度確認してください。");
                        return;
                      }
                      setSectionOptions(extracted);
                      setSelectedSection(null);
                      handleInputChange("target_section", "");
                    }}
                    style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: C.white, background: C.gold,
                      border: "none", borderRadius: 3,
                      padding: "7px 14px", cursor: "pointer"
                    }}
                  >
                    📋 STEP8から節を抽出
                  </button>
                  {sectionOptions.length > 0 && (
                    <button
                      onClick={() => {
                        setSectionOptions([]);
                        setSelectedSection(null);
                        handleInputChange("target_section", "");
                      }}
                      style={{
                        fontSize: 12, color: C.textLight,
                        background: "none", border: `1px solid ${C.border}`,
                        borderRadius: 3, padding: "6px 12px",
                        cursor: "pointer", marginLeft: 8
                      }}
                    >
                      抽出結果をクリア
                    </button>
                  )}
                </div>

                {/* 抽出結果：ボタン式選択 */}
                {sectionOptions.length > 0 && (
                  <SectionSelector
                    sections={sectionOptions}
                    selected={selectedSection}
                    onSelect={(i, sec) => {
                      setSelectedSection(i);
                      handleInputChange("target_section", sec.sectionTitle);
                    }}
                    onReselect={() => {
                      setSelectedSection(null);
                      handleInputChange("target_section", "");
                    }}
                  />
                )}
              </div>
            );
          }

          return (
            <div key={field.name} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13.5, fontWeight: 600, color: hasError ? C.red : C.navy }}>{field.label}</label>
                {field.required && <RequiredMark />}
                <SourceLabel source={field.source} autoFill={field.autoFill}
                  onAutoFill={() => {
                    const srcNum = parseInt(field.source.replace("STEP", ""), 10);
                    const srcOutput = allSteps?.[srcNum]?.outputText;
                    if (srcOutput) handleInputChange(field.name, srcOutput);
                    else alert(`STEP${srcNum}の出力データがまだ保存されていません。`);
                  }}
                  onRef={() => {
                    const srcNum = parseInt(field.source.replace("STEP", ""), 10);
                    const srcOutput = allSteps?.[srcNum]?.outputText;
                    if (srcOutput) onRefPanel({ stepNum: srcNum, text: srcOutput, targetField: field.name });
                    else alert(`STEP${srcNum}の出力データがまだ保存されていません。`);
                  }}
                  onAutoFillParsed={handleAutoFillParsed} />
                {hasError && <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>← 入力してください</span>}
              </div>
              <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>{field.desc}</div>

              {/* STEP2 amazon_html: 改善版UI */}
              {step.num === 2 && field.name === "amazon_html" && (
                <Step2HtmlHelper
                  inputs={inputs}
                  currentHtml={inputs.amazon_html || ""}
                />
              )}

              {field.type === "text" ? (
                <input id={`field-${field.name}`} type="text" value={inputs[field.name] || ""} onChange={(e) => handleInputChange(field.name, e.target.value)} placeholder={field.label}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: hasError ? `2px solid ${C.red}` : isOverLimit ? `2px solid ${C.gold}` : `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: hasError ? "#fef2f2" : C.white }} />
              ) : (
                <textarea id={`field-${field.name}`} value={inputs[field.name] || ""} onChange={(e) => handleInputChange(field.name, e.target.value)} placeholder={field.label}
                  rows={field.name.includes("html") ? 6 : 4}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: hasError ? `2px solid ${C.red}` : isOverLimit ? `2px solid ${C.gold}` : `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: hasError ? "#fef2f2" : C.white }} />
              )}

              {field.maxChars && field.name !== "amazon_html" && (
                <div style={{ fontSize: 11, color: isOverLimit ? C.red : C.textLight, textAlign: "right", marginTop: 3 }}>
                  {currentLen.toLocaleString()} / {field.maxChars.toLocaleString()}文字
                  {isOverLimit && <span style={{ fontWeight: 600, marginLeft: 6 }}>⚠ 上限超過</span>}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveInput}>入力データを保存</BtnPrimary>
          {saveInputMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました</span>}
          {step.type === "chat" && (
            <>
              <BtnSecondary onClick={async () => {
                const text = step.inputs.length === 1
                  ? (inputs[step.inputs[0].name] || "")
                  : step.inputs.map((f) => `【${f.label}】\n${inputs[f.name] || ""}`).join("\n\n");
                if (!text.trim()) return;
                setChatTransferMsg(true);
                setTimeout(() => setChatTransferMsg(false), 2500);
                // 入力データをそのままDifyに送信して最初の質問を引き出す
                setChatError("");
                setChatMessages((prev) => [...prev, { role: "user", content: text }]);
                setChatLoading(true);
                try {
                  const response = await fetch("/api/dify-chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stepNum: step.num, message: text, conversation_id: chatConversationId }),
                  });
                  const data = await response.json();
                  if (!response.ok) { setChatError(data.error || "送信に失敗しました"); }
                  else {
                    if (data.conversation_id) setChatConversationId(data.conversation_id);
                    setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
                    setTimeout(() => { if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight; }, 50);
                  }
                } catch (e) { setChatError("通信エラーが発生しました。時間をおいて再度お試しください。"); }
                finally { setChatLoading(false); }
              }} style={{ fontSize: 13 }}>
                チャットに転記して開始
              </BtnSecondary>
              {chatTransferMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ チャットに転記しました</span>}
            </>
          )}
        </div>
      </div>

      {/* ② AIで実行する */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="②" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>AIで実行する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          {step.type === "chat" ? (
            <div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>
                入力データを保存したら、下のチャット欄でAIと対話してください。このページを離れずに会話できます。
              </div>
              {/* チャットUI */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", background: C.white }}>
                {/* メッセージ一覧 */}
                <div ref={chatAreaRef} style={{ height: 340, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10, background: C.navyLight }}>
                  {chatMessages.length === 0 && (
                    <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", marginTop: 60 }}>
                      メッセージを入力して送信してください
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ fontSize: 11, color: C.textLight, marginBottom: 3, paddingLeft: msg.role === "user" ? 0 : 4, paddingRight: msg.role === "user" ? 4 : 0 }}>
                        {msg.role === "user" ? "あなた" : "AI"}
                      </div>
                      <div style={{
                        maxWidth: "82%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                        background: msg.role === "user" ? C.navy : C.white,
                        color: msg.role === "user" ? C.white : C.text,
                        fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        border: msg.role === "user" ? "none" : `1px solid ${C.border}`,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.07)"
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                      <div style={{ padding: "10px 16px", borderRadius: "12px 12px 12px 3px", background: C.white, border: `1px solid ${C.border}`, fontSize: 13, color: C.textLight }}>
                        考え中...
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                {/* エラー表示 */}
                {chatError && (
                  <div style={{ padding: "8px 14px", background: "#fef2f2", borderTop: `1px solid rgba(192,57,43,0.2)`, fontSize: 12.5, color: C.red }}>{chatError}</div>
                )}
                {/* 入力エリア */}
                <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${C.border}`, background: C.white }}>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
                    rows={3}
                    style={{ flex: 1, padding: "12px 14px", fontSize: 13.5, border: "none", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.65, boxSizing: "border-box" }}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={chatLoading || !chatInput.trim()}
                    style={{ width: 80, background: chatLoading || !chatInput.trim() ? "#ccc" : C.navy, color: C.white, border: "none", fontWeight: 700, fontSize: 13, cursor: chatLoading || !chatInput.trim() ? "default" : "pointer", flexShrink: 0, letterSpacing: "0.02em" }}
                  >
                    送信
                  </button>
                </div>
              </div>
              {/* 出力コピー＆会話リセット */}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      const lastAI = [...chatMessages].reverse().find((m) => m.role === "assistant");
                      if (!lastAI) return;
                      // 行ごとに分割して候補を抽出（×や空行・説明文を除く）
                      const lines = lastAI.content.split("\n").map((l) => l.trim()).filter(Boolean);
                      const candidates = lines.filter((l) => l.includes("×") || l.includes("x") || l.includes("X"));
                      if (candidates.length > 1) {
                        setChatSelectOptions(candidates);
                      } else {
                        // 候補が1つ以下ならそのまま転記
                        setOutputText(lastAI.content);
                        setChatCopyMsg(true);
                        setTimeout(() => setChatCopyMsg(false), 2000);
                      }
                    }}
                    disabled={!chatMessages.some((m) => m.role === "assistant")}
                    style={{
                      fontSize: 13, fontWeight: 700,
                      color: chatMessages.some((m) => m.role === "assistant") ? C.white : C.textLight,
                      background: chatMessages.some((m) => m.role === "assistant") ? C.gold : "rgba(0,0,0,0.06)",
                      border: "none", borderRadius: 3, padding: "8px 18px", cursor: chatMessages.some((m) => m.role === "assistant") ? "pointer" : "default"
                    }}
                  >
                    ↓ 最後の回答を出力データへ転記
                  </button>
                  {chatCopyMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 転記しました</span>}
                  {/* 候補選択UI */}
                  {chatSelectOptions.length > 0 && (
                    <div style={{ marginTop: 10, padding: "12px 14px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 6, width: "100%", boxSizing: "border-box" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>出力データに転記するキーワードを1つ選んでください</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {chatSelectOptions.map((opt, i) => (
                          <button key={i} onClick={() => {
                            setOutputText(opt);
                            setChatSelectOptions([]);
                            setChatSelectMsg(true);
                            setTimeout(() => setChatSelectMsg(false), 2000);
                          }}
                            style={{ textAlign: "left", padding: "8px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13.5, fontWeight: 600, color: C.navy, cursor: "pointer" }}>
                            {opt}
                          </button>
                        ))}
                        <button onClick={() => setChatSelectOptions([])}
                          style={{ textAlign: "left", padding: "4px 8px", background: "none", border: "none", fontSize: 12, color: C.textLight, cursor: "pointer" }}>
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                  {chatSelectMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 転記しました</span>}
                </div>
                <div>
                  <button
                    onClick={() => { setChatMessages([]); setChatConversationId(""); setChatError(""); setChatInput(""); }}
                    style={{ fontSize: 12, color: C.textLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer" }}
                  >
                    会話をリセット
                  </button>
                  <span style={{ fontSize: 11.5, color: C.textLight, marginLeft: 8 }}>新しいテーマで試すときはリセットしてください</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>
                入力データが揃ったら「実行する」ボタンを押してください。AIが処理して、結果が下の出力欄に自動で表示されます。
              </div>
              {runError && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>{runError}</div>
              )}

              {/* STEP9 節一括実行中の進捗バー */}
              {step.num === 9 && sectionProgress && (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: C.navyLight, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12.5, color: C.navyMid, fontWeight: 600 }}>
                    <span>節の一括生成中：{sectionProgress.current} / {sectionProgress.total} 項</span>
                    <span>{Math.round((sectionProgress.current / sectionProgress.total) * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${(sectionProgress.current / sectionProgress.total) * 100}%`,
                      height: "100%",
                      background: C.navy,
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
                    ⏳ 生成中：<span style={{ color: C.text, fontWeight: 600 }}>{sectionProgress.currentItemName}</span>
                  </div>
                </div>
              )}

              <button onClick={handleRunDify} disabled={isRunning}
                style={{ padding: "12px 36px", background: isRunning ? "#93c5fd" : C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: isRunning ? "default" : "pointer", letterSpacing: "0.04em" }}>
                {isRunning ? (step.num === 9 ? "節を生成中..." : "実行中...") : "▶ 実行する"}
              </button>
              {isRunning && step.num !== 9 && <span style={{ fontSize: 13, color: C.navyMid, marginLeft: 12 }}>AIが処理しています。少々お待ちください...</span>}
            </div>
          )}
        </Card>
      </div>

      {/* ③ 出力データ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="③" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>出力データ</h2>
        </div>
        <div style={{ fontSize: 13, color: "#444444", marginBottom: 10, lineHeight: 1.8 }}>
          {step.type === "chat" ? <>チャットの会話から得た結果をコピーして、下の欄に貼り付けてください。{nextStep && ` この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}</> : <>AIの実行結果が自動で表示されます。内容を確認してから保存してください。{nextStep && ` この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}</>}
          <br />出力はそのまま使っても、自分で修正したり、AIチャットで整えてから使うこともできます。
        </div>
        <textarea value={outputText} onChange={(e) => setOutputText(e.target.value)}
          placeholder={step.type === "chat" ? "チャットで得た結果をここに貼り付けてください" : "実行するボタンを押すと結果が自動で表示されます"} rows={10}
          style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7, minHeight: 220 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveOutput}>出力データを保存</BtnPrimary>
          {saveOutputMsg === "saved" && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました</span>}
          <BtnSecondary
            onClick={() => {
              if (!outputText) return;
              navigator.clipboard.writeText(outputText);
              setSaveOutputMsg("copy");
              setTimeout(() => setSaveOutputMsg(false), 2000);
            }}
            style={{ fontSize: 13 }}
          >
            出力をコピー
          </BtnSecondary>
          {saveOutputMsg === "copy" && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ コピーしました</span>}
          {nextStep && (
            <BtnSecondary onClick={() => onNavigate(`step_${nextStep.num}`)}
              style={{ background: C.greenLight, color: C.green, border: `1px solid rgba(45,122,79,0.25)` }}>
              STEP{nextStep.num}へ進む →
            </BtnSecondary>
          )}
          {!nextStep && (
            <BtnSecondary onClick={() => onNavigate("saved")}
              style={{ background: C.greenLight, color: C.green, border: `1px solid rgba(45,122,79,0.25)` }}>
              完了 → 保存データを見る
            </BtnSecondary>
          )}
        </div>
      </div>

      {/* 操作のポイント */}
      {step.help && step.help.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div onClick={() => setHelpOpen(!helpOpen)}
            style={{ fontSize: 13, fontWeight: 600, color: C.textSub, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
            <span style={{ transform: helpOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
            操作のポイント
          </div>
          {helpOpen && (
            <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.textSub, lineHeight: 1.9 }}>
                {step.help.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 保存データ画面
// ============================================================

const SavedPage = ({ project, stepStatuses, allSteps, onNavigate }) => {
  const [copyMsg, setCopyMsg] = useState("");
  const handleCopy = (text) => { navigator.clipboard.writeText(text).then(() => { setCopyMsg("コピーしました"); setTimeout(() => setCopyMsg(""), 2000); }); };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", marginBottom: 6 }}>SAVED DATA</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, margin: "0 0 6px" }}>保存データ</h1>
      <div style={{ fontSize: 13.5, color: C.textSub, marginBottom: 24 }}>プロジェクト名：{project.projectName}　／　現在のステップ：STEP{project.currentStep}</div>
      {copyMsg && <div style={{ fontSize: 12, color: C.green, fontWeight: 500, marginBottom: 12 }}>{copyMsg}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 24 }}>
        {STEPS.map((s) => {
          const sd = allSteps[s.num] || defaultStepData(s.num);
          return (
            <Card key={s.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>STEP{s.num}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>{s.title}</span>
                  <Badge status={stepStatuses[s.num]} />
                  {sd.isSaved && <span style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>保存済み</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <BtnSecondary onClick={() => onNavigate(`step_${s.num}`)} style={{ fontSize: 12, padding: "6px 12px" }}>開く</BtnSecondary>
                  {sd.outputText && <BtnSecondary onClick={() => handleCopy(sd.outputText)} style={{ fontSize: 12, padding: "6px 12px" }}>コピー</BtnSecondary>}
                </div>
              </div>
              {sd.outputText && (
                <div style={{ marginTop: 10, fontSize: 12, color: C.textLight, lineHeight: 1.5, maxHeight: 48, overflow: "hidden" }}>
                  {sd.outputText.slice(0, 120)}{sd.outputText.length > 120 ? "..." : ""}
                </div>
              )}
              {sd.updatedAt && <div style={{ marginTop: 6, fontSize: 11, color: C.textLight }}>最終更新：{new Date(sd.updatedAt).toLocaleString("ja-JP")}</div>}
            </Card>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <BtnPrimary onClick={() => onNavigate(`step_${project.currentStep}`)}>この企画を再開する</BtnPrimary>
        <BtnSecondary onClick={() => onNavigate("home")}>ホームへ戻る</BtnSecondary>
      </div>
    </div>
  );
};

// ============================================================
// 使い方画面
// ============================================================

const GuidePage = ({ onNavigate }) => {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${C.gold}` }}>{title}</h2>
      <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.9 }}>{children}</div>
      </Card>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", marginBottom: 6 }}>GUIDE</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, margin: "0 0 6px" }}>使い方</h1>
      <p style={{ fontSize: 13.5, color: C.textSub, marginBottom: 28 }}>AI出版プロデューサーの進め方を、短く確認できます</p>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16, paddingLeft: 10, borderLeft: `3px solid ${C.gold}` }}>AI出版プロデューサーの3つの特徴</h2>

        {[
          { label: "① コンセプトを固めてから書く — 手戻りが少ない理由" },
          { label: "② 市場勝率診断でテーマを外しにくい" },
          { label: "③ AIは素材を出す — 判断するのは人間" },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navyMid, marginBottom: 8 }}>{item.label}</div>
            {i === 0 && (
              <svg width="100%" viewBox="0 0 680 220" xmlns="http://www.w3.org/2000/svg">
                <defs><marker id="ga1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
                <rect x="20" y="60" width="104" height="56" rx="6" fill="#edf2f8" stroke="#2a4468" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1a2e4a" x="72" y="87" textAnchor="middle">STEP1-2</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2a4468" x="72" y="105" textAnchor="middle">テーマ・市場</text>
                <line x1="124" y1="88" x2="148" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
                <rect x="152" y="60" width="104" height="56" rx="6" fill="#edf4ef" stroke="#2d7a4f" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1a4a2e" x="204" y="87" textAnchor="middle">STEP3-4</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2d7a4f" x="204" y="105" textAnchor="middle">読者・素材</text>
                <line x1="256" y1="88" x2="280" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
                <rect x="284" y="60" width="104" height="56" rx="6" fill="#f0eef8" stroke="#534AB7" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#3C3489" x="336" y="87" textAnchor="middle">STEP5-8</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#534AB7" x="336" y="105" textAnchor="middle">設計・構成</text>
                <line x1="388" y1="88" x2="412" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
                <rect x="416" y="60" width="104" height="56" rx="6" fill="#fdf6e3" stroke="#b8922a" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#7a5c10" x="468" y="87" textAnchor="middle">STEP9</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#b8922a" x="468" y="105" textAnchor="middle">本文執筆</text>
                <line x1="520" y1="88" x2="544" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
                <rect x="548" y="60" width="112" height="56" rx="6" fill="#edf4e4" stroke="#2d7a4f" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1a4a2e" x="604" y="87" textAnchor="middle">STEP10</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2d7a4f" x="604" y="105" textAnchor="middle">Amazon出版</text>
                <rect x="20" y="140" width="632" height="1" fill="#e2ddd6"/>
                <text fontFamily="sans-serif" fontSize="11" fill="#999" x="72" y="162" textAnchor="middle">コンセプト確定</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#999" x="204" y="162" textAnchor="middle">差別化の核を発見</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#999" x="336" y="162" textAnchor="middle">設計図が揃う</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#999" x="468" y="162" textAnchor="middle">書くだけの状態</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#999" x="604" y="162" textAnchor="middle">完成</text>
                <rect x="284" y="182" width="240" height="22" rx="4" fill="#fdf6e3" stroke="#f0d98a" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="11" fill="#b8922a" x="404" y="197" textAnchor="middle">ここまでが「設計」— 本文前に固める</text>
              </svg>
            )}
            {i === 1 && (
              <svg width="100%" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="ga2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker>
                  <marker id="ga2g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#2d7a4f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker>
                  <marker id="ga2r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#c0392b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker>
                </defs>
                <rect x="20" y="70" width="130" height="56" rx="6" fill="#f4f3ef" stroke="#999" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#444" x="85" y="92" textAnchor="middle">テーマ候補</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#666" x="85" y="110" textAnchor="middle">気になる2語</text>
                <line x1="150" y1="98" x2="178" y2="98" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga2)"/>
                <rect x="182" y="50" width="160" height="96" rx="6" fill="#edf2f8" stroke="#2a4468" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1a2e4a" x="262" y="78" textAnchor="middle">市場勝率診断</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2a4468" x="262" y="96" textAnchor="middle">Amazonデータで判定</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2a4468" x="262" y="114" textAnchor="middle">競合・レビュー分析</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2a4468" x="262" y="132" textAnchor="middle">狙い目の切り口発見</text>
                <line x1="342" y1="78" x2="378" y2="58" stroke="#2d7a4f" strokeWidth="1.5" markerEnd="url(#ga2g)"/>
                <line x1="342" y1="118" x2="378" y2="148" stroke="#c0392b" strokeWidth="1.5" markerEnd="url(#ga2r)"/>
                <rect x="382" y="32" width="140" height="52" rx="6" fill="#edf4e4" stroke="#2d7a4f" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1a4a2e" x="452" y="52" textAnchor="middle">勝率あり</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2d7a4f" x="452" y="70" textAnchor="middle">次のステップへ進む</text>
                <rect x="382" y="122" width="140" height="52" rx="6" fill="#fef2f2" stroke="#c0392b" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#7a1a1a" x="452" y="142" textAnchor="middle">勝率が低い</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#c0392b" x="452" y="160" textAnchor="middle">テーマを再検討</text>
                <path d="M452 174 Q452 188 340 188 Q220 188 85 188 Q85 180 85 126" fill="none" stroke="#e2ddd6" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#ga2)"/>
                <text fontFamily="sans-serif" fontSize="11" fill="#999" x="300" y="184" textAnchor="middle">テーマを変えてやり直せる</text>
              </svg>
            )}
            {i === 2 && (
              <svg width="100%" viewBox="0 0 680 180" xmlns="http://www.w3.org/2000/svg">
                <defs><marker id="ga3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
                <rect x="20" y="60" width="160" height="56" rx="6" fill="#f0eef8" stroke="#534AB7" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#3C3489" x="100" y="82" textAnchor="middle">AIが素材を出す</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#534AB7" x="100" y="100" textAnchor="middle">叩き台・候補・草案</text>
                <line x1="180" y1="88" x2="208" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga3)"/>
                <rect x="212" y="44" width="176" height="88" rx="6" fill="#fdf6e3" stroke="#b8922a" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#7a5c10" x="300" y="72" textAnchor="middle">人間が判断する</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#b8922a" x="300" y="90" textAnchor="middle">これでいい？違う？</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#b8922a" x="300" y="108" textAnchor="middle">どう修正する？</text>
                <line x1="388" y1="88" x2="416" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga3)"/>
                <rect x="420" y="60" width="160" height="56" rx="6" fill="#edf4e4" stroke="#2d7a4f" strokeWidth="0.5"/>
                <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1a4a2e" x="500" y="82" textAnchor="middle">修正・確定する</text>
                <text fontFamily="sans-serif" fontSize="11" fill="#2d7a4f" x="500" y="100" textAnchor="middle">自分でもAIチャットでも</text>
                <rect x="20" y="148" width="160" height="20" rx="4" fill="#f4f3ef"/>
                <text fontFamily="sans-serif" fontSize="11" fill="#666" x="100" y="162" textAnchor="middle">10ツール全てが対象</text>
                <rect x="420" y="148" width="160" height="20" rx="4" fill="#f4f3ef"/>
                <text fontFamily="sans-serif" fontSize="11" fill="#666" x="500" y="162" textAnchor="middle">Claude・ChatGPT等を活用</text>
              </svg>
            )}
            <div style={{ fontSize: 12, color: C.textLight, marginTop: 6 }}>
              {i === 0 && "設計フェーズ（STEP1〜8）を先に固めることで、本文執筆に入ってから大幅な方向転換が起きにくくなります。"}
              {i === 1 && "Amazonの実データで市場を診断します。勝率が低ければテーマを変えてやり直せるため、「書き終えてから気づく」失敗を防げます。"}
              {i === 2 && "各ツールの出力は叩き台です。そのまま使うことも、自分で修正することも、AIチャットで整えることもできます。"}
            </div>
          </div>
        ))}
      </div>

      <Section title="全体の流れ">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>STEP1からSTEP10まで順番に進めます</li>
          <li>前のステップの出力を次のステップの入力に使います</li>
          <li>途中で止まっても、保存データからいつでも再開できます</li>
        </ul>
      </Section>

      {/* ========== 修正3：GuidePageに「始め方を選ぶ」セクション追加 ========== */}
      <Section title="始め方を選ぶ（2つの入口）">
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: C.navy }}>A：ゼロから始める</span>
          <ul style={{ margin: "4px 0 12px", paddingLeft: 18 }}>
            <li>テーマは決まっているが、狙うキーワードは決めていない方向け</li>
            <li>STEP1のテーマ発見で、Amazon Kindleの市場データから2語キーワード候補を抽出します</li>
            <li>初めてKindle出版する方は、こちらを推奨します</li>
          </ul>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: C.gold }}>B：キーワードが決まっている</span>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            <li>狙う2語キーワードがすでに明確な方向け</li>
            <li>STEP1をスキップして、STEP2（市場勝率診断）から直接始められます</li>
            <li>ダッシュボードまたはSTEP1画面の上部にある「STEP2から始める」ボタンから入れます</li>
          </ul>
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 4, fontSize: 12.5, lineHeight: 1.7, color: C.textSub }}>
          どちらを選んでも、STEP2以降の流れは共通です。途中で入口を変えたくなった場合は、左メニューから直接目的のSTEPに移動できます。
        </div>
      </Section>
      {/* ========== 修正3 ここまで ========== */}

      <Section title="操作方法（ワークフロー型:STEP1〜3・5〜10）">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>① 入力データ欄に情報を入力する。前のSTEPの出力を使う欄には「自動転記」「参照」「自動振り分け」ボタンが表示される</li>
          <li style={{ marginTop: 4 }}><span style={{ fontWeight: 700 }}>自動転記（ネイビー）</span>:押すと前のSTEPの出力が自動で入力欄に入る</li>
          <li style={{ marginTop: 4 }}><span style={{ fontWeight: 700 }}>参照（薄ネイビー）</span>:押すと画面右側に前のSTEPの出力が表示され、見ながら手入力できる</li>
          <li style={{ marginTop: 4 }}><span style={{ fontWeight: 700 }}>自動振り分け（ゴールド）</span>:STEP3専用。押すとSTEP2の出力から該当箇所を自動で抽出して入力する</li>
          <li style={{ marginTop: 8 }}>入力が終わったら「入力データを保存」を押す</li>
          <li>② 「実行する」ボタンを押すとAIが自動で処理し、結果が出力欄に表示される</li>
          <li>③ 内容を確認・修正して「出力データを保存」を押す</li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#b8922a", fontWeight: 600 }}>
          ⚠️ 出力を修正した場合も必ず「出力データを保存」を押してから次のステップへ。保存しないと次のステップの「自動転記」「参照」に反映されません。
        </div>
      </Section>

      <Section title="操作方法（チャット型:STEP4）">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>① 入力データ欄に情報を入力して「入力データを保存」を押す</li>
          <li>② 「チャットに転記して開始」を押すと入力データがそのまま送信され、AIから最初の質問が届く</li>
          <li>③ AIの質問に答えながら会話を進める（ページを離れずに対話できます）</li>
          <li>④ 会話が終わったら「↓ 最後の回答を出力データへ転記」を押す。候補が複数ある場合は1つ選ぶ</li>
          <li>⑤ 出力データ欄の内容を確認して「出力データを保存」を押す</li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#b8922a", fontWeight: 600 }}>
          ⚠️ 出力データを保存してから次のステップへ進んでください。保存しないと次のステップの入力に反映されません。
        </div>
      </Section>

      <Section title="出力の扱い方">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>出力は素材です。そのまま使うこともできます</li>
          <li>修正したい場合は自分で直すか、AIチャット（Claude、ChatGPT等）に貼り付けて修正を指示してください</li>
        </ul>
      </Section>

      <Section title="市場勝率診断のHTML取得方法">
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>下のURLをブラウザで開く:<br /><span style={{ fontFamily: "monospace", fontSize: 12, color: C.navyMid, userSelect: "all" }}>https://www.amazon.co.jp/s?i=digital-text</span></li>
          <li style={{ marginTop: 6 }}>検索バーにキーワード2語を入力して検索</li>
          <li>検索結果ページで右クリック→「ページのソースを表示」</li>
          <li>Ctrl+A → Ctrl+C で全選択コピー</li>
          <li>STEP2の入力欄に貼り付けて「実行する」を押す</li>
        </ol>
        <div style={{ marginTop: 8, fontSize: 12.5, color: C.textLight }}>「実行する」を押すと自動でクリーニングしてAIに渡します。クリーニング操作は不要です。</div>
      </Section>

      <Section title="データの保存について">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>各ステップの入力・出力は「保存」ボタンでブラウザに保存されます</li>
          <li>同じブラウザで再度開けば、保存したデータはそのまま残っています</li>
          <li>別のブラウザや別のPC・スマホからはデータを引き継げません</li>
          <li>ブラウザのキャッシュをクリアするとデータが消えるため、大事な出力はコピーして別途保管してください</li>
          <li>ホーム画面の「保存データを削除する」を押すと、すべてのデータがリセットされます</li>
        </ul>
      </Section>

      <Section title="困ったとき">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>途中で止まったら保存データから再開できます</li>
          <li>文体が合わない場合は過去原稿を使ってください（STEP9）</li>
          <li>出力修正はAIチャットで行えます</li>
          <li>キーワードを変えてSTEP1からやり直すこともできます</li>
        </ul>
      </Section>

      <BtnSecondary onClick={() => onNavigate("home")}>ホームへ戻る</BtnSecondary>
    </div>
  );
};

// ============================================================
// メインアプリ
// ============================================================

export default function App() {
  const [page, setPage] = useState("home");
  const [project, setProject] = useState(defaultProject());
  const [allSteps, setAllSteps] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await loadProject();
      if (p) setProject(p); else await saveProject(defaultProject());
      const steps = await loadAllSteps();
      setAllSteps(steps); setLoading(false);
    })();
  }, []);

  const stepStatuses = {};
  for (let i = 1; i <= 10; i++) stepStatuses[i] = allSteps[i]?.status || "not_started";

  const [pendingInputs, setPendingInputs] = useState({});
  const [refPanel, setRefPanel] = useState(null);

  const handlePendingInputChange = useCallback((stepNum, inputs) => {
    setPendingInputs((prev) => ({ ...prev, [stepNum]: inputs }));
  }, []);

  const navigate = useCallback(async (p) => {
    setPendingInputs((pending) => {
      Object.entries(pending).forEach(async ([stepNum, inputs]) => {
        const num = parseInt(stepNum, 10);
        setAllSteps((prev) => {
          const existing = prev[num] || defaultStepData(num);
          if (JSON.stringify(existing.inputData) === JSON.stringify(inputs)) return prev;
          const updated = { ...existing, inputData: inputs, status: existing.status === "completed" ? "completed" : "in_progress", updatedAt: new Date().toISOString() };
          saveStepData(num, updated);
          return { ...prev, [num]: updated };
        });
      });
      return {};
    });
    setPage(p);
    if (p.startsWith("step_")) {
      const num = parseInt(p.replace("step_", ""), 10);
      setProject((prev) => { const updated = { ...prev, currentStep: num }; saveProject(updated); return updated; });
    }
    window.scrollTo?.(0, 0);
  }, []);

  const handleSaveInput = useCallback(async (num, inputData) => {
    const existing = allSteps[num] || defaultStepData(num);
    const updated = { ...existing, inputData, status: existing.status === "completed" ? "completed" : "in_progress", updatedAt: new Date().toISOString() };
    await saveStepData(num, updated);
    setAllSteps((prev) => ({ ...prev, [num]: updated }));
    setProject((prev) => { const p = { ...prev, lastUpdatedStep: num }; saveProject(p); return p; });
  }, [allSteps]);

  const handleSaveOutput = useCallback(async (num, outputText) => {
    const existing = allSteps[num] || defaultStepData(num);
    const updated = { ...existing, outputText, status: "completed", isSaved: true, updatedAt: new Date().toISOString() };
    await saveStepData(num, updated);
    setAllSteps((prev) => ({ ...prev, [num]: updated }));
    setProject((prev) => {
      const completedCount = Object.values({ ...allSteps, [num]: updated }).filter((s) => s.status === "completed").length;
      const p = { ...prev, lastUpdatedStep: num, completedCount }; saveProject(p); return p;
    });
  }, [allSteps]);

  // スマホ判定
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ナビゲート時にスマホメニューを閉じる
  const navigateAndClose = useCallback(async (p) => {
    setMenuOpen(false);
    await navigate(p);
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "inherit", color: C.textLight }}>
        読み込み中...
      </div>
    );
  }

  const renderPage = () => {
    const nav = isMobile ? navigateAndClose : navigate;
    if (page === "home") return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={nav} />;
    if (page === "guide") return <GuidePage onNavigate={nav} />;
    if (page === "saved") return <SavedPage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={nav} />;
    if (page.startsWith("step_")) {
      const num = parseInt(page.replace("step_", ""), 10);
      const step = STEPS[num - 1];
      const sd = allSteps[num] || defaultStepData(num);
      return <StepPage step={step} stepData={sd} project={project} onNavigate={nav} onSaveInput={handleSaveInput} onSaveOutput={handleSaveOutput} onUpdateProject={setProject} onInputChange={handlePendingInputChange} allSteps={allSteps} onRefPanel={setRefPanel} />;
    }
    return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={nav} />;
  };

  // ============================================================
  // スマホ用ヘッダーバー
  // ============================================================
  const MobileHeader = () => (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: C.navy, height: 56,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", boxSizing: "border-box",
      borderBottom: `1px solid rgba(255,255,255,0.1)`
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5 }}
        >
          <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? C.gold : C.white, borderRadius: 1, transition: "background 0.2s" }} />
          <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? C.gold : C.white, borderRadius: 1, transition: "background 0.2s" }} />
          <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? C.gold : C.white, borderRadius: 1, transition: "background 0.2s" }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
            <div style={{ width: 16, height: 2, background: C.gold, borderRadius: 1 }} />
            <div style={{ width: 12, height: 2, background: `rgba(184,146,42,0.6)`, borderRadius: 1 }} />
            <div style={{ width: 14, height: 2, background: `rgba(184,146,42,0.35)`, borderRadius: 1 }} />
          </div>
          <div style={{ width: 1.5, height: 28, background: C.gold, opacity: 0.6 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white, letterSpacing: "0.02em" }}>AI出版プロデューサー</div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // スマホ用ドロワーメニュー
  // ============================================================
  const MobileDrawer = () => (
    <>
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }}
        />
      )}
      <div style={{
        position: "fixed", top: 56, left: 0, bottom: 0,
        width: 280, background: C.navy,
        zIndex: 300, overflowY: "auto",
        transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
      }}>
        <SideMenu currentPage={page} onNavigate={navigateAndClose} stepStatuses={stepStatuses} isMobile />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ fontFamily: "'Noto Sans JP', sans-serif", background: C.bg, minHeight: "100vh" }}>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <MobileHeader />
        <MobileDrawer />
        <div style={{ paddingTop: 56, paddingBottom: 32, boxSizing: "border-box" }}>
          <div style={{ padding: "20px 16px", maxWidth: 800, margin: "0 auto" }}>
            {renderPage()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Noto Sans JP', sans-serif", background: C.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <SideMenu currentPage={page} onNavigate={navigate} stepStatuses={stepStatuses} />
      <div style={{ marginLeft: 300, flex: 1, padding: "20px 44px 36px", maxWidth: refPanel ? 560 : 820, boxSizing: "border-box", transition: "max-width 0.2s" }}>
        {renderPage()}
      </div>
      {refPanel && (
        <div style={{ position: "sticky", top: 0, width: 320, minWidth: 320, height: "100vh", background: C.white, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: 20, boxSizing: "border-box", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>STEP{refPanel.stepNum}の出力（参照）</span>
            <button onClick={() => setRefPanel(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.textLight, lineHeight: 1, padding: "0 4px" }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 8, lineHeight: 1.5 }}>
            テキストを選択してコピーできます。選択なしで「全文コピー」を押すと全文がコピーされます。
          </div>
          <textarea
            readOnly
            value={refPanel.text}
            style={{
              flex: 1, overflowY: "auto",
              background: C.navyLight, borderRadius: 4,
              padding: 12, fontSize: 12.5, color: C.text,
              lineHeight: 1.7, border: `1px solid ${C.border}`,
              marginBottom: 12, resize: "none",
              fontFamily: "'Noto Sans JP', sans-serif",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
              cursor: "text",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 0 }}>
            <button
              onClick={() => {
                const sel = window.getSelection()?.toString();
                navigator.clipboard.writeText(sel && sel.length > 0 ? sel : refPanel.text);
                if (refPanel.targetField) {
                  setTimeout(() => {
                    const target = document.getElementById(`field-${refPanel.targetField}`);
                    if (target) {
                      target.focus();
                      target.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }, 100);
                }
              }}
              style={{ flex: 1, padding: "10px", background: C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              コピー
            </button>
            <button onClick={() => setRefPanel(null)}
              style={{ flex: 1, padding: "10px", background: "transparent", color: C.textLight, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13, cursor: "pointer" }}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
