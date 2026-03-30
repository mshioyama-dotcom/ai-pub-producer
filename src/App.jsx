import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// データ定義
// ============================================================

const STEPS = [
  {
    id: "step_01", num: 1, title: "テーマ発見インタビュー",
    description: "書きたいテーマをもとに、気になる2語の候補を見つけます",
    category: "企画設計", type: "chat",
    url: "https://udify.app/chat/cii6zTpOFc29rvVw",
    inputs: [
      { name: "user_chat_input", label: "テーマ・関心領域", desc: "書きたいテーマ、想定読者、読者の悩みなどを会話で伝えてください", source: null, required: true, type: "textarea" }
    ],
    outputTitle: "候補メモ",
    help: [
      "最初から正解を1つに絞る必要はありません",
      "まず幅広く候補を出してから、しっくりくる方向へ絞っていきます",
      "「もう少し実務寄りのキーワードが欲しい」と伝えることもできます"
    ]
  },
  {
    id: "step_02", num: 2, title: "市場勝率診断",
    description: "選んだ2語でKindle市場の勝率を診断します",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/x0Ce5PCv2FjEaFs4",
    inputs: [
      { name: "keyword1", label: "1つ目のキーワード", desc: "テーマ発見で選んだ1語目", source: "STEP1", required: true, type: "text" },
      { name: "keyword2", label: "2つ目のキーワード", desc: "テーマ発見で選んだ2語目", source: "STEP1", required: true, type: "text" },
      { name: "amazon_html", label: "Amazon検索結果のHTMLソース", desc: "AmazonでKindle検索した結果ページのHTMLソースを貼り付け", source: null, required: true, type: "textarea" }
    ],
    outputTitle: "診断結果",
    help: [
      "HTML取得：検索結果ページで右クリック→「ページのソースを表示」→全選択してコピー",
      "HTMLが大きすぎる場合は入力欄下の「HTMLをクリーニングする」ボタンで軽量化できます",
      "キーワードを変えて再実行で別の市場を診断できます"
    ]
  },
  {
    id: "step_03", num: 3, title: "読者・価値設計",
    description: "読者の悩み、詰まり、到達点、章構造を設計します",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/V0yHio0PcP42yJjQ",
    inputs: [
      { name: "keyword1", label: "検索キーワード1", desc: "市場診断で確定した1語目", source: "STEP2", required: true, type: "text" },
      { name: "keyword2", label: "検索キーワード2", desc: "市場診断で確定した2語目", source: "STEP2", required: true, type: "text" },
      { name: "intent_lock", label: "検索意図仮説", desc: "読者が何を知りたくて検索するかの仮説", source: "STEP2", required: true, type: "textarea" },
      { name: "market_report", label: "狙い目切り口（任意）", desc: "市場診断で見つけた狙い目の切り口", source: "STEP2", required: false, type: "textarea" }
    ],
    outputTitle: "設計結果",
    help: [
      "章数はデフォルト7章で生成されます",
      "章数を変えたい場合は、出力をAIチャットに貼り付けて「6章構成に再構成して」と指示してください"
    ]
  },
  {
    id: "step_04", num: 4, title: "エピソードインタビュー",
    description: "あなたの体験から差別化につながる素材を整理します",
    category: "企画設計", type: "chat",
    url: "https://udify.app/chat/qbB9SNU5UG3gryYp",
    inputs: [
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文コピーして最初に貼り付けてください", source: "STEP3", required: true, type: "textarea" }
    ],
    outputTitle: "インタビュー要約",
    help: [
      "AIは1回に1つだけ質問します。焦らず具体的に答えてください",
      "「数字は出せない」場合は「体感では○○くらい」でOKです"
    ]
  },
  {
    id: "step_05", num: 5, title: "タイトル・サブタイトル作成",
    description: "検索性とクリック率を両立したタイトル案を作成します",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/z7djuT4RLqfAbEqY",
    inputs: [
      { name: "keyword1", label: "検索キーワード1", desc: "確定した1語目", source: "STEP2", required: true, type: "text" },
      { name: "keyword2", label: "検索キーワード2", desc: "確定した2語目", source: "STEP2", required: true, type: "text" },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea" },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea" }
    ],
    outputTitle: "タイトル案",
    help: [
      "キーワード2語はタイトル＋サブタイトル内に必ず含まれます",
      "特定の案だけ修正したい場合は、出力をAIチャットに貼り付けて修正を指示してください",
      "タイトルはあとから再作成しても問題ありません"
    ]
  },
  {
    id: "step_06", num: 6, title: "目次作成",
    description: "章構造をもとに、具体的な節見出し付きの目次を作ります",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/tcqNIyr8wpCBAJhb",
    inputs: [
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea" },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea" }
    ],
    outputTitle: "完成目次",
    help: [
      "「はじめに」と「おわりに」は自動的に付きます",
      "特定の章だけ修正したい場合は、出力をAIチャットに貼り付けて修正を指示してください"
    ]
  },
  {
    id: "step_07", num: 7, title: "章構成作成",
    description: "目次の各節に要約を付けて、章ごとの構成案を作ります",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/4KDXsPKSlgk5qMu8",
    inputs: [
      { name: "toc_text", label: "目次作成のアウトプット", desc: "目次作成の出力を全文貼り付け", source: "STEP6", required: true, type: "textarea" },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea" },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea" }
    ],
    outputTitle: "章構成",
    help: [
      "全章を一括処理します",
      "特定の節だけ修正したい場合は、出力をAIチャットに貼り付けて修正を指示してください"
    ]
  },
  {
    id: "step_08", num: 8, title: "詳細プロット作成",
    description: "1章分を本文執筆できる粒度まで分解します",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/Ka9gpeDvAnkPV9hW",
    inputs: [
      { name: "chapter_outline_text", label: "1章分のアウトライン", desc: "章構成作成の出力から1章分を切り出して貼り付け", source: "STEP7", required: true, type: "textarea" },
      { name: "added_episode_text", label: "著者が入れたいエピソード（任意）", desc: "この章に入れたい体験やエピソード", source: null, required: false, type: "textarea" }
    ],
    outputTitle: "詳細プロット",
    help: [
      "1章ずつ処理します。章構成の出力から該当章だけをコピーして入力してください",
      "特定の項だけ修正したい場合は、出力をAIチャットに貼り付けて修正を指示してください"
    ]
  },
  {
    id: "step_09", num: 9, title: "本文作成",
    description: "指定した項の本文を1つずつ執筆します（600〜1000文字/項）",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/lRAWtZGuVL4bqHM9",
    inputs: [
      { name: "detailed_plot_text", label: "詳細プロット作成のアウトプット（1章分）", desc: "詳細プロット作成の出力を貼り付け", source: "STEP8", required: true, type: "textarea" },
      { name: "target_heading", label: "執筆対象の目次見出し", desc: "書きたい項の見出しを正確に入力", source: "STEP8", required: true, type: "text" },
      { name: "past_writing_text", label: "著者の過去の執筆データ（任意）", desc: "文体参考の過去原稿（最大3000字）", source: null, required: false, type: "textarea" }
    ],
    outputTitle: "生成された本文",
    help: [
      "1項ずつ処理します。見出しは詳細プロットから正確にコピーしてください",
      "文体を変えたい場合は、出力をAIチャットに貼り付けて修正を指示してください"
    ]
  },
  {
    id: "step_10", num: 10, title: "Amazon説明文作成",
    description: "Amazonの商品ページに掲載する説明文を作ります",
    category: "販売準備", type: "workflow",
    url: "https://udify.app/workflow/6yWZfOGGU76ciJBI",
    inputs: [
      { name: "title_text", label: "タイトル", desc: "確定したメインタイトル", source: "STEP5", required: true, type: "text" },
      { name: "subtitle_text", label: "サブタイトル", desc: "確定したサブタイトル", source: "STEP5", required: true, type: "text" },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea" },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea" },
      { name: "outline_text", label: "章構成作成のアウトプット", desc: "章構成作成の出力を全文貼り付け", source: "STEP7", required: true, type: "textarea" },
      { name: "author_profile_text", label: "著者プロフィール（任意）", desc: "著者の経歴や実績", source: null, required: false, type: "textarea" }
    ],
    outputTitle: "Amazon説明文",
    help: [
      "修正したい場合は、出力をAIチャットに貼り付けて修正を指示してください",
      "「冒頭の読者像をもっと絞って」「購読を促す文章を追加して」等と指示できます"
    ]
  }
];

const CATEGORIES = [
  { label: "企画設計", steps: [1,2,3,4,5] },
  { label: "執筆設計", steps: [6,7,8,9] },
  { label: "販売準備", steps: [10] }
];

const STATUS_LABELS = { not_started: "未着手", in_progress: "進行中", completed: "完了" };
const STATUS_COLORS = {
  not_started: { bg: "rgba(120,120,130,0.12)", text: "#888" },
  in_progress: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  completed:   { bg: "rgba(34,197,94,0.12)",  text: "#16a34a" }
};

// ============================================================
// ストレージ（localStorage版 - StackBlitz / 外部デプロイ用）
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveProject(proj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(proj)); } catch(e) { console.error(e); }
}

async function loadStepData(num) {
  try {
    const raw = localStorage.getItem(STEPS_KEY_PREFIX + num);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveStepData(num, data) {
  try { localStorage.setItem(STEPS_KEY_PREFIX + num, JSON.stringify(data)); } catch(e) { console.error(e); }
}

async function loadAllSteps() {
  const all = {};
  for (let i = 1; i <= 10; i++) {
    all[i] = (await loadStepData(i)) || defaultStepData(i);
  }
  return all;
}

async function resetAllData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (let i = 1; i <= 10; i++) {
      localStorage.removeItem(STEPS_KEY_PREFIX + i);
    }
  } catch(e) { console.error(e); }
}

// ============================================================
// 共通コンポーネント
// ============================================================

const Badge = ({ status }) => (
  <span style={{
    display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px",
    borderRadius: 4, background: STATUS_COLORS[status].bg, color: STATUS_COLORS[status].text,
    letterSpacing: "0.02em", whiteSpace: "nowrap"
  }}>{STATUS_LABELS[status]}</span>
);

const SourceLabel = ({ source }) => source ? (
  <span style={{ fontSize: 12, color: "#3b82f6", background: "rgba(59,130,246,0.07)", padding: "2px 7px", borderRadius: 4 }}>
    ← {source}の出力を貼り付け
  </span>
) : null;

const RequiredMark = () => <span style={{ color: "#ef4444", fontSize: 12, marginLeft: 4 }}>必須</span>;

const BtnPrimary = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "10px 20px", background: disabled ? "#ccc" : "#2563eb", color: "#fff",
    border: "none", borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: disabled ? "default" : "pointer",
    transition: "background 0.15s", ...style
  }}>{children}</button>
);

const BtnSecondary = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    padding: "10px 20px", background: "rgba(0,0,0,0.04)", color: "#333",
    border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontWeight: 500, fontSize: 14, cursor: "pointer", ...style
  }}>{children}</button>
);

const Card = ({ children, style }) => (
  <div style={{
    background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)",
    padding: 20, ...style
  }}>{children}</div>
);

// ============================================================
// 左メニュー
// ============================================================

const SideMenu = ({ currentPage, onNavigate, stepStatuses }) => {
  const menuItem = (label, page, status) => {
    const active = currentPage === page;
    return (
      <div key={page} onClick={() => onNavigate(page)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 14px", marginBottom: 2, borderRadius: 7, cursor: "pointer",
        background: active ? "rgba(37,99,235,0.08)" : "transparent",
        color: active ? "#2563eb" : "#444", fontWeight: active ? 600 : 400,
        fontSize: 13.5, transition: "all 0.12s", lineHeight: 1.4
      }}>
        <span style={{ flex: 1, marginRight: 8 }}>{label}</span>
        {status && <Badge status={status} />}
      </div>
    );
  };

  return (
    <div style={{
      width: 380, minWidth: 380, height: "100vh", overflowY: "auto",
      background: "#f8f9fb", borderRight: "1px solid rgba(0,0,0,0.07)",
      display: "flex", flexDirection: "column", padding: "24px 12px 24px 12px",
      boxSizing: "border-box", position: "fixed", left: 0, top: 0, zIndex: 10
    }}>
      <div style={{ padding: "0 14px", marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", letterSpacing: "-0.01em" }}>
          AI出版プロデューサー
        </div>
        <div style={{ fontSize: 11.5, color: "#888", marginTop: 4, lineHeight: 1.5 }}>
          Kindle出版を10ステップで進める
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", letterSpacing: "0.02em", padding: "0 14px", marginBottom: 6, marginTop: 4 }}>ホーム</div>
      {menuItem("ダッシュボード", "home", null)}
      {menuItem("使い方", "guide", null)}

      {CATEGORIES.map(cat => (
        <div key={cat.label}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", letterSpacing: "0.02em", padding: "0 14px", marginBottom: 6, marginTop: 20, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>{cat.label}</div>
          {cat.steps.map(n => {
            const s = STEPS[n - 1];
            return menuItem(`STEP${n} ${s.title}`, `step_${n}`, stepStatuses[n]);
          })}
        </div>
      ))}

      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", letterSpacing: "0.02em", padding: "0 14px", marginBottom: 6, marginTop: 20, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>データ管理</div>
      {menuItem("保存データ", "saved", null)}
    </div>
  );
};

// ============================================================
// ホーム画面
// ============================================================

const HomePage = ({ project, stepStatuses, allSteps, onNavigate }) => {
  const completedCount = Object.values(stepStatuses).filter(s => s === "completed").length;
  const currentStep = project.currentStep || 1;
  const lastUpdated = project.lastUpdatedStep;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0, letterSpacing: "-0.02em" }}>
          AI出版プロデューサー
        </h1>
        <p style={{ fontSize: 15, color: "#666", margin: "8px 0 0", lineHeight: 1.6 }}>
          10のツールで、テーマ発見から本文執筆・Amazon掲載まで進めます
        </p>
      </div>

      {/* 進行状況カード */}
      <div style={{ display: "flex", gap: 14, marginBottom: 32, flexWrap: "nowrap" }}>
        <Card style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 6 }}>現在のステップ</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#2563eb", whiteSpace: "nowrap" }}>STEP{currentStep} {STEPS[currentStep-1]?.title}</div>
        </Card>
        <Card style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 6 }}>最後に更新したステップ</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#333", whiteSpace: "nowrap" }}>
            {lastUpdated ? `STEP${lastUpdated} ${STEPS[lastUpdated-1]?.title}` : "—"}
          </div>
        </Card>
        <Card style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 6 }}>完了数</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>{completedCount}<span style={{ fontSize: 14, color: "#888", fontWeight: 500 }}> / 10</span></div>
        </Card>
      </div>

      {/* 10ステップ一覧 */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 14 }}>進行中のステップ</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {STEPS.map(s => (
            <div key={s.id} onClick={() => onNavigate(`step_${s.num}`)} style={{
              display: "flex", alignItems: "center", padding: "12px 16px",
              background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)",
              cursor: "pointer", transition: "box-shadow 0.12s",
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: stepStatuses[s.num] === "completed" ? "rgba(34,197,94,0.1)" : stepStatuses[s.num] === "in_progress" ? "rgba(59,130,246,0.1)" : "rgba(0,0,0,0.04)",
                color: stepStatuses[s.num] === "completed" ? "#16a34a" : stepStatuses[s.num] === "in_progress" ? "#2563eb" : "#999",
                marginRight: 14, flexShrink: 0
              }}>{s.num}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#333" }}>{s.title}</span>
              <Badge status={stepStatuses[s.num]} />
              <span style={{ marginLeft: 12, fontSize: 12, color: "#2563eb", fontWeight: 500 }}>開く →</span>
            </div>
          ))}
        </div>
      </div>

      {/* その他の操作 */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 14 }}>その他の操作</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BtnSecondary onClick={() => onNavigate("saved")}>保存データを参照</BtnSecondary>
          <BtnSecondary onClick={() => setShowResetConfirm(true)}>保存データを削除</BtnSecondary>
          <BtnSecondary onClick={() => onNavigate("guide")}>使い方を参照</BtnSecondary>
        </div>
        {showResetConfirm && (
          <div style={{ marginTop: 12, padding: 16, background: "#fff4f4", border: "1px solid #fca5a5", borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#dc2626", marginBottom: 10 }}>
              現在のデータはすべてリセットされます。よろしいですか？
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnPrimary onClick={async () => { await resetAllData(); location.reload(); }} style={{ background: "#dc2626" }}>リセットする</BtnPrimary>
              <BtnSecondary onClick={() => setShowResetConfirm(false)}>キャンセル</BtnSecondary>
            </div>
          </div>
        )}
      </div>

      {/* 考え方 */}
      <Card style={{ background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#555", margin: "0 0 10px" }}>このツールの使い方</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#666", lineHeight: 1.8 }}>
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
  const results = [];
  const seen = new Set();
  const searchResultTags = html.match(/<[^>]*data-component-type\s*=\s*"s-search-result"[^>]*>/gi) || [];
  for (const tag of searchResultTags) {
    const asinMatch = tag.match(/data-asin="([A-Za-z0-9]{10})"/i);
    if (asinMatch) {
      const cleaned = '<div data-asin="' + asinMatch[1] + '" data-component-type="s-search-result">';
      if (!seen.has(cleaned)) { seen.add(cleaned); results.push(cleaned); }
    }
  }
  const asinTags = html.match(/<[^>]*data-asin="[A-Za-z0-9]{10}"[^>]*>/gi) || [];
  for (const tag of asinTags) {
    const asinMatch = tag.match(/data-asin="([A-Za-z0-9]{10})"/i);
    if (asinMatch) {
      const cleaned = '<div data-asin="' + asinMatch[1] + '">';
      if (!seen.has(cleaned)) { seen.add(cleaned); results.push(cleaned); }
    }
  }
  const dpLinks = html.match(/<a[^>]*href="[^"]*(?:\/dp\/|\/gp\/product\/)[A-Za-z0-9]{10}[^"]*"[^>]*>/gi) || [];
  for (const tag of dpLinks) {
    const hrefMatch = tag.match(/href="([^"]*(?:\/dp\/|\/gp\/product\/)[A-Za-z0-9]{10}[^"]*)"/i);
    if (hrefMatch) {
      let href = hrefMatch[1];
      const qIdx = href.indexOf('?');
      if (qIdx !== -1) href = href.substring(0, qIdx);
      const cleaned = '<a href="' + href + '">';
      if (!seen.has(cleaned)) { seen.add(cleaned); results.push(cleaned); }
    }
  }
  return results.join('\n');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const HtmlCleanerInline = ({ html, onCleaned }) => {
  const [result, setResult] = useState(null);

  const handleClean = () => {
    const originalSize = new Blob([html]).size;
    const cleaned = cleanHtmlMinimal(html);
    const cleanedSize = new Blob([cleaned]).size;
    const reduction = originalSize > 0 ? ((1 - cleanedSize / originalSize) * 100).toFixed(1) : 0;
    setResult({ cleaned, originalSize, cleanedSize, reduction });
  };

  const handleApply = () => {
    if (result) {
      onCleaned(result.cleaned);
      setResult(null);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      {!result ? (
        <button onClick={handleClean} style={{
          padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none",
          borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer"
        }}>
          HTMLをクリーニングする
        </button>
      ) : (
        <div style={{ padding: 14, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 13, flexWrap: "wrap" }}>
            <span>元のサイズ：<strong>{formatBytes(result.originalSize)}</strong></span>
            <span>クリーン後：<strong style={{ color: "#16a34a" }}>{formatBytes(result.cleanedSize)}</strong></span>
            <span>削減率：<strong style={{ color: "#16a34a" }}>{result.reduction}%</strong></span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleApply} style={{
              padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none",
              borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer"
            }}>
              クリーニング結果を適用する
            </button>
            <button onClick={() => setResult(null)} style={{
              padding: "8px 16px", background: "rgba(0,0,0,0.04)", color: "#333",
              border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontWeight: 500, fontSize: 13, cursor: "pointer"
            }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// 各機能画面（共通テンプレート）
// ============================================================

const StepPage = ({ step, stepData, project, onNavigate, onSaveInput, onSaveOutput, onUpdateProject }) => {
  const [inputs, setInputs] = useState(stepData.inputData || {});
  const [outputText, setOutputText] = useState(stepData.outputText || "");
  const [copyMsg, setCopyMsg] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setInputs(stepData.inputData || {});
    setOutputText(stepData.outputText || "");
    setHelpOpen(false);
    setCopyMsg("");
  }, [step.num, stepData]);

  const prevStep = step.num > 1 ? STEPS[step.num - 2] : null;
  const nextStep = step.num < 10 ? STEPS[step.num] : null;

  const handleInputChange = (name, value) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveInput = async () => {
    await onSaveInput(step.num, inputs);
  };

  const handleSaveOutput = async () => {
    await onSaveOutput(step.num, outputText);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg("コピーしました");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>STEP{step.num}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{step.title}</h1>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>{step.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {prevStep && (
            <BtnSecondary onClick={() => onNavigate(`step_${prevStep.num}`)} style={{ fontSize: 12, padding: "7px 14px" }}>
              ← STEP{prevStep.num}
            </BtnSecondary>
          )}
          {nextStep && (
            <BtnSecondary onClick={() => onNavigate(`step_${nextStep.num}`)} style={{ fontSize: 12, padding: "7px 14px" }}>
              STEP{nextStep.num} →
            </BtnSecondary>
          )}
        </div>
      </div>

      {/* このステップの使い方 */}
      <Card style={{ marginBottom: 24, background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>このステップの進め方</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 2 }}>
          <span style={{ fontWeight: 700, color: "#2563eb" }}>①</span> 下の「入力データ」に情報を入力して保存する{step.inputs.some(f => f.source) && "（前ステップの出力を貼り付け）"}<br/>
          <span style={{ fontWeight: 700, color: "#2563eb" }}>②</span> 「入力データをコピー」→「Difyで実行する」を押してDifyに貼り付けて実行<br/>
          <span style={{ fontWeight: 700, color: "#2563eb" }}>③</span> Difyの実行結果をコピー →「出力データ」に貼り付けて保存する
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 8, lineHeight: 1.6 }}>
          このサイトはDifyの入出力を保存するメモ帳です。保存した出力は、次のステップの入力として使います。
        </div>
      </Card>

      {/* ① 入力データ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700 }}>①</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>入力データ</h2>
        </div>
        {step.inputs.some(f => f.source) && (
          <div style={{ fontSize: 12.5, color: "#555", marginBottom: 12, padding: "8px 12px", background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 6, lineHeight: 1.7 }}>
            前のステップの出力を貼り付けてください。左メニューの「保存データ」からコピーできます。
          </div>
        )}
        {step.inputs.map(field => (
          <div key={field.name} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: "#333" }}>{field.label}</label>
              {field.required && <RequiredMark />}
              <SourceLabel source={field.source} />
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{field.desc}</div>
            {field.type === "text" ? (
              <input
                type="text" value={inputs[field.name] || ""} onChange={e => handleInputChange(field.name, e.target.value)}
                placeholder={field.label}
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 6, outline: "none", boxSizing: "border-box", background: "#fff"
                }}
              />
            ) : (
              <textarea
                value={inputs[field.name] || ""} onChange={e => handleInputChange(field.name, e.target.value)}
                placeholder={field.label} rows={field.name.includes("html") ? 6 : 4}
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 6, outline: "none", boxSizing: "border-box", resize: "vertical",
                  fontFamily: "inherit", background: "#fff"
                }}
              />
            )}
            {/* STEP2のHTML入力欄にクリーニングボタンを表示 */}
            {step.num === 2 && field.name === "amazon_html" && inputs.amazon_html && (
              <HtmlCleanerInline html={inputs.amazon_html} onCleaned={(cleaned) => handleInputChange("amazon_html", cleaned)} />
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <BtnPrimary onClick={handleSaveInput}>入力データを保存</BtnPrimary>
          <BtnSecondary onClick={() => {
            const text = step.inputs.map(f => `【${f.label}】\n${inputs[f.name] || ""}`).join("\n\n");
            handleCopy(text);
          }}>入力データをコピー</BtnSecondary>
          {copyMsg === "コピーしました" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>→ Difyに貼り付けてください</span>}
        </div>
      </div>

      {/* ② Difyで実行 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700 }}>②</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>Difyで実行する</h2>
        </div>
        <Card style={{ background: "rgba(37,99,235,0.03)", border: "1px solid rgba(37,99,235,0.12)" }}>
          <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8, marginBottom: 12 }}>
            上の「入力データをコピー」を押してから、下のボタンでDifyを開いてください。<br/>
            Difyの入力欄に貼り付けて実行し、結果が出たらコピーしてください。
          </div>
          <a href={step.url} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px",
            background: "#2563eb", color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: 15,
            textDecoration: "none", transition: "background 0.15s", boxShadow: "0 2px 8px rgba(37,99,235,0.3)"
          }}>
            Difyを開く ↗
          </a>
          <span style={{ fontSize: 12, color: "#888", marginLeft: 12 }}>
            {step.type === "chat" ? "チャット（対話型）" : "ワークフロー"}
          </span>
        </Card>
      </div>

      {/* ③ 出力データ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700 }}>③</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>出力データ</h2>
        </div>
        <div style={{ fontSize: 12.5, color: "#555", marginBottom: 10, lineHeight: 1.7 }}>
          Difyの実行結果をコピーして、下の欄に貼り付けてください。{nextStep && `この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}
        </div>
        <textarea
          value={outputText} onChange={e => setOutputText(e.target.value)}
          placeholder={"Difyの実行結果をここに貼り付けてください"}
          rows={10}
          style={{
            width: "100%", padding: "12px 14px", fontSize: 14, border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 6, outline: "none", boxSizing: "border-box", resize: "vertical",
            fontFamily: "inherit", background: "#fff", lineHeight: 1.7
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveOutput}>出力データを保存</BtnPrimary>
          <BtnSecondary onClick={() => handleCopy(outputText)}>出力データをコピー</BtnSecondary>
          {nextStep && (
            <BtnSecondary onClick={() => onNavigate(`step_${nextStep.num}`)} style={{ background: "rgba(34,197,94,0.08)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>
              STEP{nextStep.num}へ進む →
            </BtnSecondary>
          )}
          {!nextStep && (
            <BtnSecondary onClick={() => onNavigate("saved")} style={{ background: "rgba(34,197,94,0.08)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>
              完了 → 保存データを見る
            </BtnSecondary>
          )}
        </div>
      </div>

      {/* 操作のポイント */}
      {step.help && step.help.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div onClick={() => setHelpOpen(!helpOpen)} style={{
            fontSize: 13.5, fontWeight: 600, color: "#555", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, padding: "10px 0"
          }}>
            <span style={{ transform: helpOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
            操作のポイント
          </div>
          {helpOpen && (
            <Card style={{ background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.05)" }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#666", lineHeight: 1.8 }}>
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

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg("コピーしました");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 6px" }}>保存データ</h1>
      <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
        プロジェクト名：{project.projectName}　／　現在のステップ：STEP{project.currentStep}
      </div>

      {copyMsg && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 500, marginBottom: 12 }}>{copyMsg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {STEPS.map(s => {
          const sd = allSteps[s.num] || defaultStepData(s.num);
          return (
            <Card key={s.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>STEP{s.num}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{s.title}</span>
                  <Badge status={stepStatuses[s.num]} />
                  {sd.isSaved && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 500 }}>保存済み</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <BtnSecondary onClick={() => onNavigate(`step_${s.num}`)} style={{ fontSize: 12, padding: "6px 12px" }}>開く</BtnSecondary>
                  {sd.outputText && (
                    <BtnSecondary onClick={() => handleCopy(sd.outputText)} style={{ fontSize: 12, padding: "6px 12px" }}>コピー</BtnSecondary>
                  )}
                </div>
              </div>
              {sd.outputText && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#888", lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
                  {sd.outputText.slice(0, 150)}{sd.outputText.length > 150 ? "..." : ""}
                </div>
              )}
              {sd.updatedAt && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#aaa" }}>
                  最終更新：{new Date(sd.updatedAt).toLocaleString("ja-JP")}
                </div>
              )}
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
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>{title}</h2>
      <Card style={{ background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.8 }}>{children}</div>
      </Card>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 6px" }}>使い方</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 28 }}>AI出版プロデューサーの進め方を、短く確認できます</p>

      <Section title="全体の流れ">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>STEP1からSTEP10まで順番に進めます</li>
          <li>前のステップの出力を次のステップの入力に使います</li>
          <li>途中で止まっても、保存データからいつでも再開できます</li>
        </ul>
      </Section>

      <Section title="出力の扱い方">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>出力は素材です。そのまま使うこともできます</li>
          <li>修正したい場合は自分で直すか、AIチャット（Claude、ChatGPT等）に貼り付けて修正を指示してください</li>
        </ul>
      </Section>

      <Section title="市場勝率診断のHTML取得方法">
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Amazonのトップページを開く</li>
          <li>検索バー左のカテゴリを「Kindleストア」に切り替える</li>
          <li>キーワード2語を入力して検索</li>
          <li>検索結果ページで右クリック→「ページのソースを表示」</li>
          <li>Ctrl+A → Ctrl+C で全選択コピー</li>
          <li>STEP2の入力欄に貼り付ける</li>
        </ol>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#888" }}>
          HTMLが大きすぎる場合は、入力欄の下に表示される「HTMLをクリーニングする」ボタンで軽量化できます
        </div>
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

      <Section title="全ツールURL一覧">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#2563eb", minWidth: 48 }}>STEP{s.num}</span>
              <span style={{ color: "#333", flex: 1 }}>{s.title}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontSize: 12 }}>開く ↗</a>
            </div>
          ))}
        </div>
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
      if (p) setProject(p);
      else await saveProject(defaultProject());
      const steps = await loadAllSteps();
      setAllSteps(steps);
      setLoading(false);
    })();
  }, []);

  const stepStatuses = {};
  for (let i = 1; i <= 10; i++) {
    stepStatuses[i] = allSteps[i]?.status || "not_started";
  }

  const navigate = useCallback((p) => {
    setPage(p);
    if (p.startsWith("step_")) {
      const num = parseInt(p.replace("step_", ""));
      setProject(prev => {
        const updated = { ...prev, currentStep: num };
        saveProject(updated);
        return updated;
      });
    }
    window.scrollTo?.(0, 0);
  }, []);

  const handleSaveInput = useCallback(async (num, inputData) => {
    const existing = allSteps[num] || defaultStepData(num);
    const updated = {
      ...existing,
      inputData,
      status: existing.status === "completed" ? "completed" : "in_progress",
      updatedAt: new Date().toISOString()
    };
    await saveStepData(num, updated);
    setAllSteps(prev => ({ ...prev, [num]: updated }));
    setProject(prev => {
      const p = { ...prev, lastUpdatedStep: num };
      saveProject(p);
      return p;
    });
  }, [allSteps]);

  const handleSaveOutput = useCallback(async (num, outputText) => {
    const existing = allSteps[num] || defaultStepData(num);
    const updated = {
      ...existing,
      outputText,
      status: "completed",
      isSaved: true,
      updatedAt: new Date().toISOString()
    };
    await saveStepData(num, updated);
    setAllSteps(prev => ({ ...prev, [num]: updated }));
    setProject(prev => {
      const completedCount = Object.values({ ...allSteps, [num]: updated }).filter(s => s.status === "completed").length;
      const p = { ...prev, lastUpdatedStep: num, completedCount };
      saveProject(p);
      return p;
    });
  }, [allSteps]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Noto Sans JP', sans-serif", color: "#888" }}>
        読み込み中...
      </div>
    );
  }

  const renderPage = () => {
    if (page === "home") return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={navigate} />;
    if (page === "guide") return <GuidePage onNavigate={navigate} />;
    if (page === "saved") return <SavedPage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={navigate} />;
    if (page.startsWith("step_")) {
      const num = parseInt(page.replace("step_", ""));
      const step = STEPS[num - 1];
      const sd = allSteps[num] || defaultStepData(num);
      return <StepPage step={step} stepData={sd} project={project} onNavigate={navigate} onSaveInput={handleSaveInput} onSaveOutput={handleSaveOutput} onUpdateProject={setProject} />;
    }
    return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={navigate} />;
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Noto Sans JP', sans-serif", background: "#f0f2f5" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <SideMenu currentPage={page} onNavigate={navigate} stepStatuses={stepStatuses} />
      <div style={{ marginLeft: 380, flex: 1, padding: "32px 40px", maxWidth: 860, boxSizing: "border-box" }}>
        {renderPage()}
      </div>
    </div>
  );
}
