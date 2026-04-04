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
      { name: "keyword1", label: "1つ目のキーワード", desc: "テーマ発見で選んだ1語目", source: "STEP1", required: true, type: "text", autoFill: false },
      { name: "keyword2", label: "2つ目のキーワード", desc: "テーマ発見で選んだ2語目", source: "STEP1", required: true, type: "text", autoFill: false },
      { name: "amazon_html", label: "Amazon検索結果のHTMLソース", desc: "AmazonでKindle検索した結果ページのHTMLソースを貼り付けてください。「実行する」ボタンを押すと自動でクリーニングしてAIに渡します。", source: null, required: true, type: "textarea" }
    ],
    outputTitle: "診断結果",
    help: [
      "HTML取得：検索結果ページで右クリック→「ページのソースを表示」→全選択してコピー",
      "HTMLを貼り付けて「実行する」を押すと、自動でクリーニングしてAIに渡します。",
      "キーワードを変えて再実行で別の市場を診断できます"
    ]
  },
  {
    id: "step_03", num: 3, title: "読者・価値設計",
    description: "読者の悩み、詰まり、到達点、章構造を設計します",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/V0yHio0PcP42yJjQ",
    inputs: [
      { name: "keyword1", label: "検索キーワード1", desc: "市場診断で確定した1語目", source: "STEP2", required: true, type: "text", autoFill: false },
      { name: "keyword2", label: "検索キーワード2", desc: "市場診断で確定した2語目", source: "STEP2", required: true, type: "text", autoFill: false },
      { name: "intent_lock", label: "検索意図仮説", desc: "読者が何を知りたくて検索するかの仮説", source: "STEP2", required: true, type: "textarea", autoFill: false },
      { name: "market_report", label: "狙い目切り口（任意）", desc: "市場診断で見つけた狙い目の切り口", source: "STEP2", required: false, type: "textarea", autoFill: false }
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
      { name: "keyword1", label: "検索キーワード1", desc: "確定した1語目", source: "STEP2", required: true, type: "text", autoFill: false },
      { name: "keyword2", label: "検索キーワード2", desc: "確定した2語目", source: "STEP2", required: true, type: "text", autoFill: false },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea", autoFill: true },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea", autoFill: true }
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
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea", autoFill: true },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea", autoFill: true }
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
      { name: "toc_text", label: "目次作成のアウトプット", desc: "目次作成の出力を全文貼り付け", source: "STEP6", required: true, type: "textarea", autoFill: true },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea", autoFill: true },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea", autoFill: true }
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
      { name: "chapter_outline_text", label: "1章分のアウトライン", desc: "章構成作成の出力から1章分を切り出して貼り付け", source: "STEP7", required: true, type: "textarea", autoFill: false },
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
      { name: "detailed_plot_text", label: "詳細プロット作成のアウトプット（1章分）", desc: "詳細プロット作成の出力を貼り付け", source: "STEP8", required: true, type: "textarea", autoFill: true },
      { name: "target_heading", label: "執筆対象の目次見出し", desc: "書きたい項の見出しを正確に入力", source: "STEP8", required: true, type: "text", autoFill: false },
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
      { name: "title_text", label: "タイトル", desc: "確定したメインタイトル", source: "STEP5", required: true, type: "text", autoFill: false },
      { name: "subtitle_text", label: "サブタイトル", desc: "確定したサブタイトル", source: "STEP5", required: true, type: "text", autoFill: false },
      { name: "blueprint_text", label: "読者・価値設計のアウトプット", desc: "読者・価値設計の出力を全文貼り付け", source: "STEP3", required: true, type: "textarea", autoFill: true },
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "エピソードインタビューの出力を全文貼り付け", source: "STEP4", required: true, type: "textarea", autoFill: true },
      { name: "outline_text", label: "章構成作成のアウトプット", desc: "章構成作成の出力を全文貼り付け", source: "STEP7", required: true, type: "textarea", autoFill: true },
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
  { label: "企画設計", steps: [1, 2, 3, 4, 5] },
  { label: "執筆設計", steps: [6, 7, 8, 9] },
  { label: "販売準備", steps: [10] }
];

const STATUS_LABELS = { not_started: "未着手", in_progress: "進行中", completed: "完了" };
const STATUS_COLORS = {
  not_started: { bg: "rgba(120,120,130,0.12)", text: "#888" },
  in_progress: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  completed: { bg: "rgba(34,197,94,0.12)", text: "#16a34a" }
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
  } catch {
    return null;
  }
}

async function saveProject(proj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proj));
  } catch (e) {
    console.error(e);
  }
}

async function loadStepData(num) {
  try {
    const raw = localStorage.getItem(STEPS_KEY_PREFIX + num);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveStepData(num, data) {
  try {
    localStorage.setItem(STEPS_KEY_PREFIX + num, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
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
  } catch (e) {
    console.error(e);
  }
}

// ============================================================
// 共通コンポーネント
// ============================================================

const Badge = ({ status }) => (
  <span
    style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 4,
      background: STATUS_COLORS[status].bg,
      color: STATUS_COLORS[status].text,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap"
    }}
  >
    {STATUS_LABELS[status]}
  </span>
);

const SourceLabel = ({ source, autoFill, onAutoFill, onShowRef }) =>
  source ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#3b82f6", background: "rgba(59,130,246,0.07)", padding: "2px 7px", borderRadius: 4 }}>
        ← {source}の出力
      </span>
      {autoFill === true ? (
        <button
          onClick={onAutoFill}
          style={{ fontSize: 11, color: "#fff", background: "#2563eb", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}
        >
          自動転記
        </button>
      ) : (
        <button
          onClick={onShowRef}
          style={{ fontSize: 11, color: "#2563eb", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}
        >
          参照
        </button>
      )}
    </span>
  ) : null;

const RequiredMark = () => (
  <span style={{ color: "#ef4444", fontSize: 12, marginLeft: 4 }}>必須</span>
);

const BtnPrimary = ({ children, onClick, disabled, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "10px 20px",
      background: disabled ? "#ccc" : "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      fontWeight: 600,
      fontSize: 14,
      cursor: disabled ? "default" : "pointer",
      transition: "background 0.15s",
      ...style
    }}
  >
    {children}
  </button>
);

const BtnSecondary = ({ children, onClick, style }) => (
  <button
    onClick={onClick}
    style={{
      padding: "10px 20px",
      background: "rgba(0,0,0,0.04)",
      color: "#333",
      border: "1px solid rgba(0,0,0,0.1)",
      borderRadius: 6,
      fontWeight: 500,
      fontSize: 14,
      cursor: "pointer",
      ...style
    }}
  >
    {children}
  </button>
);

const Card = ({ children, style }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.06)",
      padding: 20,
      ...style
    }}
  >
    {children}
  </div>
);

// ============================================================
// 左メニュー
// ============================================================

const SideMenu = ({ currentPage, onNavigate, stepStatuses }) => {
  const menuItem = (label, page, status) => {
    const active = currentPage === page;
    return (
      <div
        key={page}
        onClick={() => onNavigate(page)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 14px",
          marginBottom: 2,
          borderRadius: 7,
          cursor: "pointer",
          background: active ? "rgba(37,99,235,0.08)" : "transparent",
          color: active ? "#2563eb" : "#444",
          fontWeight: active ? 600 : 400,
          fontSize: 13.5,
          transition: "all 0.12s",
          lineHeight: 1.4
        }}
      >
        <span style={{ flex: 1, marginRight: 8 }}>{label}</span>
        {status && <Badge status={status} />}
      </div>
    );
  };

  return (
    <div
      style={{
        width: 380,
        minWidth: 380,
        height: "100vh",
        overflowY: "auto",
        background: "#f8f9fb",
        borderRight: "1px solid rgba(0,0,0,0.07)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 12px 24px 12px",
        boxSizing: "border-box",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 10
      }}
    >
      <div style={{ padding: "0 14px", marginBottom: 24 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#1a1a2e",
            letterSpacing: "-0.01em"
          }}
        >
          AI出版プロデューサー
        </div>
        <div style={{ fontSize: 11.5, color: "#888", marginTop: 4, lineHeight: 1.5 }}>
          Kindle出版を10ステップで進める
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#1a1a2e",
          letterSpacing: "0.02em",
          padding: "0 14px",
          marginBottom: 6,
          marginTop: 4
        }}
      >
        ホーム
      </div>
      {menuItem("ダッシュボード", "home", null)}
      {menuItem("使い方", "guide", null)}

      {CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#1a1a2e",
              letterSpacing: "0.02em",
              padding: "0 14px",
              marginBottom: 6,
              marginTop: 20,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              paddingTop: 16
            }}
          >
            {cat.label}
          </div>
          {cat.steps.map((n) => {
            const s = STEPS[n - 1];
            return menuItem(`STEP${n} ${s.title}`, `step_${n}`, stepStatuses[n]);
          })}
        </div>
      ))}

      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#1a1a2e",
          letterSpacing: "0.02em",
          padding: "0 14px",
          marginBottom: 6,
          marginTop: 20,
          borderTop: "1px solid rgba(0,0,0,0.06)",
          paddingTop: 16
        }}
      >
        データ管理
      </div>
      {menuItem("保存データ", "saved", null)}
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

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#1a1a2e",
            margin: 0,
            letterSpacing: "-0.02em"
          }}
        >
          AI出版プロデューサー
        </h1>
        <p style={{ fontSize: 15, color: "#666", margin: "8px 0 0", lineHeight: 1.6 }}>
          10のツールで、テーマ発見から本文執筆・Amazon掲載まで進めます
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 32, flexWrap: "nowrap" }}>
        <Card style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 6 }}>
            現在のステップ
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#2563eb", whiteSpace: "nowrap" }}>
            STEP{currentStep} {STEPS[currentStep - 1]?.title}
          </div>
        </Card>
        <Card style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 6 }}>
            最後に更新したステップ
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#333", whiteSpace: "nowrap" }}>
            {lastUpdated ? `STEP${lastUpdated} ${STEPS[lastUpdated - 1]?.title}` : "—"}
          </div>
        </Card>
        <Card style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 6 }}>
            完了数
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>
            {completedCount}
            <span style={{ fontSize: 14, color: "#888", fontWeight: 500 }}> / 10</span>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 14 }}>
          進行中のステップ
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {STEPS.map((s) => (
            <div
              key={s.id}
              onClick={() => onNavigate(`step_${s.num}`)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                background: "#fff",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.06)",
                cursor: "pointer",
                transition: "box-shadow 0.12s"
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background:
                    stepStatuses[s.num] === "completed"
                      ? "rgba(34,197,94,0.1)"
                      : stepStatuses[s.num] === "in_progress"
                        ? "rgba(59,130,246,0.1)"
                        : "rgba(0,0,0,0.04)",
                  color:
                    stepStatuses[s.num] === "completed"
                      ? "#16a34a"
                      : stepStatuses[s.num] === "in_progress"
                        ? "#2563eb"
                        : "#999",
                  marginRight: 14,
                  flexShrink: 0
                }}
              >
                {s.num}
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#333" }}>
                {s.title}
              </span>
              <Badge status={stepStatuses[s.num]} />
              <span style={{ marginLeft: 12, fontSize: 12, color: "#2563eb", fontWeight: 500 }}>
                開く →
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 14 }}>
          その他の操作
        </h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BtnSecondary onClick={() => onNavigate("saved")}>保存データを参照</BtnSecondary>
          <BtnSecondary onClick={() => setShowResetConfirm(true)}>保存データを削除</BtnSecondary>
          <BtnSecondary onClick={() => onNavigate("guide")}>使い方を参照</BtnSecondary>
        </div>
        {showResetConfirm && (
          <div
            style={{
              marginTop: 12,
              padding: 16,
              background: "#fff4f4",
              border: "1px solid #fca5a5",
              borderRadius: 8
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#dc2626", marginBottom: 10 }}>
              現在のデータはすべてリセットされます。よろしいですか？
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnPrimary
                onClick={async () => {
                  await resetAllData();
                  location.reload();
                }}
                style={{ background: "#dc2626" }}
              >
                リセットする
              </BtnPrimary>
              <BtnSecondary onClick={() => setShowResetConfirm(false)}>キャンセル</BtnSecondary>
            </div>
          </div>
        )}
      </div>

      <Card style={{ background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#555", margin: "0 0 10px" }}>
          このツールの使い方
        </h3>
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
      const cleaned = `<div data-asin="${asinMatch[1]}" data-component-type="s-search-result">`;
      if (!seen.has(cleaned)) {
        seen.add(cleaned);
        results.push(cleaned);
      }
    }
  }
  const asinTags = html.match(/<[^>]*data-asin="[A-Za-z0-9]{10}"[^>]*>/gi) || [];
  for (const tag of asinTags) {
    const asinMatch = tag.match(/data-asin="([A-Za-z0-9]{10})"/i);
    if (asinMatch) {
      const cleaned = `<div data-asin="${asinMatch[1]}">`;
      if (!seen.has(cleaned)) {
        seen.add(cleaned);
        results.push(cleaned);
      }
    }
  }
  const dpLinks = html.match(/<a[^>]*href="[^"]*(?:\/dp\/|\/gp\/product\/)[A-Za-z0-9]{10}[^"]*"[^>]*>/gi) || [];
  for (const tag of dpLinks) {
    const hrefMatch = tag.match(/href="([^"]*(?:\/dp\/|\/gp\/product\/)[A-Za-z0-9]{10}[^"]*)"/i);
    if (hrefMatch) {
      let href = hrefMatch[1];
      const qIdx = href.indexOf("?");
      if (qIdx !== -1) href = href.substring(0, qIdx);
      const cleaned = `<a href="${href}">`;
      if (!seen.has(cleaned)) {
        seen.add(cleaned);
        results.push(cleaned);
      }
    }
  }
  return results.join("\n");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
        <button
          onClick={handleClean}
          style={{
            padding: "8px 16px",
            background: "#f59e0b",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }}
        >
          HTMLをクリーニングする
        </button>
      ) : (
        <div style={{ padding: 14, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 13, flexWrap: "wrap" }}>
            <span>
              元のサイズ：<strong>{formatBytes(result.originalSize)}</strong>
            </span>
            <span>
              クリーン後：<strong style={{ color: "#16a34a" }}>{formatBytes(result.cleanedSize)}</strong>
            </span>
            <span>
              削減率：<strong style={{ color: "#16a34a" }}>{result.reduction}%</strong>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleApply}
              style={{
                padding: "8px 16px",
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              クリーニング結果を適用する
            </button>
            <button
              onClick={() => setResult(null)}
              style={{
                padding: "8px 16px",
                background: "rgba(0,0,0,0.04)",
                color: "#333",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
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

const StepPage = ({ step, stepData, project, onNavigate, onSaveInput, onSaveOutput, onUpdateProject, onInputChange, allSteps }) => {
  const [inputs, setInputs] = useState(stepData.inputData || {});
  const [outputText, setOutputText] = useState(stepData.outputText || "");
  const [saveInputMsg, setSaveInputMsg] = useState(false);
  const [saveOutputMsg, setSaveOutputMsg] = useState(false);
  const [copyOutputMsg, setCopyOutputMsg] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [refModal, setRefModal] = useState(null); // { stepNum, text }

  useEffect(() => {
    setInputs(stepData.inputData || {});
    setOutputText(stepData.outputText || "");
    setHelpOpen(false);
    setValidationErrors([]);
    setRunError("");
  }, [step.num]);

  const prevStep = step.num > 1 ? STEPS[step.num - 2] : null;
  const nextStep = step.num < 10 ? STEPS[step.num] : null;

  const handleInputChange = (name, value) => {
    setInputs((prev) => {
      const updated = { ...prev, [name]: value };
      onInputChange?.(step.num, updated);
      return updated;
    });
    setValidationErrors((prev) => prev.filter((e) => e !== name));
  };

  const validateInputs = () => {
    const errors = [];
    step.inputs.forEach((field) => {
      if (field.required && !(inputs[field.name] || "").trim()) {
        errors.push(field.name);
      }
    });
    setValidationErrors(errors);
    return errors;
  };

  const handleSaveInput = async () => {
    const errors = validateInputs();
    if (errors.length > 0) return;
    await onSaveInput(step.num, inputs);
    setSaveInputMsg(true);
    setTimeout(() => setSaveInputMsg(false), 2000);
  };

  const handleSaveOutput = async () => {
    await onSaveOutput(step.num, outputText);
    setSaveOutputMsg(true);
    setTimeout(() => setSaveOutputMsg(false), 2000);
  };

  const handleRunDify = async () => {
    const errors = validateInputs();
    if (errors.length > 0) return;
    setIsRunning(true);
    setRunError("");
    try {
      let execInputs = { ...inputs };
      if (step.num === 2 && execInputs.amazon_html) {
        const cleaned = cleanHtmlMinimal(execInputs.amazon_html);
        if (cleaned) execInputs.amazon_html = cleaned;
      }
      const response = await fetch("/api/dify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNum: step.num, inputs: execInputs }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRunError(data.error || "実行中にエラーが発生しました");
      } else {
        setOutputText(data.output || "");
        await onSaveInput(step.num, execInputs);
      }
    } catch (e) {
      setRunError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg("コピーしました");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>
            STEP{step.num}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#1a1a2e",
              margin: "0 0 6px",
              letterSpacing: "-0.02em"
            }}
          >
            {step.title}
          </h1>
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

      <Card style={{ marginBottom: 24, background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
          このステップの進め方
        </div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 2 }}>
          {step.type === "chat" ? (
            <>
              <span style={{ fontWeight: 700, color: "#2563eb" }}>①</span>{" "}
              下の「入力データ」に情報を入力して保存する<br />
              <span style={{ fontWeight: 700, color: "#2563eb" }}>②</span>{" "}
              「AIツールを開く」ボタンでツールにアクセスして対話する<br />
              <span style={{ fontWeight: 700, color: "#2563eb" }}>③</span>{" "}
              会話結果をコピー →「出力データ」に貼り付けて保存する
            </>
          ) : (
            <>
              <span style={{ fontWeight: 700, color: "#2563eb" }}>①</span>{" "}
              下の「入力データ」に情報を入力する
              {step.inputs.some((f) => f.source) && "（前ステップの出力を貼り付け）"}<br />
              <span style={{ fontWeight: 700, color: "#2563eb" }}>②</span>{" "}
              「実行する」ボタンを押す → AIが処理して結果が自動で表示される<br />
              <span style={{ fontWeight: 700, color: "#2563eb" }}>③</span>{" "}
              出力内容を確認して保存する
            </>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 8, lineHeight: 1.6 }}>
          出力はそのまま使うことも、自分で修正したり、AIチャット（Claude・ChatGPT等）で整えてから使うこともできます。
        </div>
      </Card>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#2563eb",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700
            }}
          >
            ①
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>入力データ</h2>
        </div>

        {validationErrors.length > 0 && (
          <div
            style={{
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 13,
              color: "#dc2626",
              fontWeight: 500
            }}
          >
            必須項目が未入力です。入力してから「入力データを保存」または「入力データをコピー」を押してください。
          </div>
        )}

        {step.inputs.some((f) => f.source) && (
          <div
            style={{
              fontSize: 12.5,
              color: "#555",
              marginBottom: 12,
              padding: "8px 12px",
              background: "rgba(59,130,246,0.04)",
              border: "1px solid rgba(59,130,246,0.1)",
              borderRadius: 6,
              lineHeight: 1.7
            }}
          >
            左メニューの「保存データ」から前のステップの出力をコピーし、各欄に貼り付けてください。
          </div>
        )}

        {step.inputs.map((field) => {
          const hasError = validationErrors.includes(field.name);
          return (
            <div key={field.name} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13.5, fontWeight: 600, color: hasError ? "#dc2626" : "#333" }}>
                  {field.label}
                </label>
                {field.required && <RequiredMark />}
                <SourceLabel
                  source={field.source}
                  autoFill={field.autoFill}
                  onAutoFill={() => {
                    const srcNum = parseInt(field.source.replace("STEP", ""), 10);
                    const srcOutput = allSteps?.[srcNum]?.outputText;
                    if (srcOutput) handleInputChange(field.name, srcOutput);
                  }}
                  onShowRef={() => {
                    const srcNum = parseInt(field.source.replace("STEP", ""), 10);
                    const srcOutput = allSteps?.[srcNum]?.outputText || "（保存済みデータがありません）";
                    setRefModal({ stepNum: srcNum, text: srcOutput });
                  }}
                />
                {hasError && (
                  <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
                    ← 入力してください
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{field.desc}</div>

              {field.type === "text" ? (
                <input
                  type="text"
                  value={inputs[field.name] || ""}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.label}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: hasError ? "2px solid #dc2626" : "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 6,
                    outline: "none",
                    boxSizing: "border-box",
                    background: hasError ? "#fef2f2" : "#fff"
                  }}
                />
              ) : (
                <textarea
                  value={inputs[field.name] || ""}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.label}
                  rows={field.name.includes("html") ? 6 : 4}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: hasError ? "2px solid #dc2626" : "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 6,
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                    fontFamily: "inherit",
                    background: hasError ? "#fef2f2" : "#fff"
                  }}
                />
              )}

              {false && step.num === 2 && field.name === "amazon_html" && inputs.amazon_html && (
                <HtmlCleanerInline
                  html={inputs.amazon_html}
                  onCleaned={(cleaned) => handleInputChange("amazon_html", cleaned)}
                />
              )}
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveInput}>入力データを保存</BtnPrimary>
          {saveInputMsg && (
            <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ 保存しました</span>
          )}
          {step.type === "chat" && (
            <>
              <BtnSecondary
                onClick={() => {
                  const errors = validateInputs();
                  if (errors.length > 0) return;
                  const text = step.inputs.map((f) => `【${f.label}】\n${inputs[f.name] || ""}`).join("\n\n");
                  handleCopy(text);
                }}
              >
                入力データをコピー
              </BtnSecondary>
              <span style={{ fontSize: 12, color: "#888" }}>※ コピーしてAIツールに貼り付けてください</span>

            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#2563eb",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700
            }}
          >
            ②
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>AIで実行する</h2>
        </div>
        <Card style={{ background: "rgba(37,99,235,0.03)", border: "1px solid rgba(37,99,235,0.12)" }}>
          {step.type === "chat" ? (
            <div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8, marginBottom: 12 }}>
                このステップは対話型です。下のボタンからAIツールを開いて会話してください。
                入力データ欄の内容をコピーしてからツールに貼り付けてください。
              </div>
              <a
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 24px",
                  background: "#2563eb",
                  color: "#fff",
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: "none",
                  transition: "background 0.15s",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.3)"
                }}
              >
                AIツールを開く ↗
              </a>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8, marginBottom: 12 }}>
                入力データを確認して「実行」を押してください。結果が下の出力欄に自動で表示されます。
              </div>
              {runError && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, marginBottom: 12, fontSize: 13, color: "#dc2626" }}>
                  {runError}
                </div>
              )}
              <button
                onClick={handleRunDify}
                disabled={isRunning}
                style={{
                  padding: "12px 32px",
                  background: isRunning ? "#93c5fd" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: isRunning ? "default" : "pointer",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
                  transition: "background 0.15s"
                }}
              >
                {isRunning ? "実行中..." : "▶ 実行する"}
              </button>
              {isRunning && (
                <span style={{ fontSize: 13, color: "#2563eb", marginLeft: 12 }}>
                  AIが処理しています。少々お待ちください...
                </span>
              )}
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#2563eb",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700
            }}
          >
            ③
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>出力データ</h2>
        </div>
        <div style={{ fontSize: 12.5, color: "#555", marginBottom: 10, lineHeight: 1.7 }}>
          {step.type === "chat" ? (
            <>
              AIツールの会話結果をコピーして、下の欄に貼り付けてください。
              {nextStep && ` この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}
            </>
          ) : (
            <>
              AIの実行結果が自動で表示されます。内容を確認してから保存してください。
              {nextStep && ` この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}
            </>
          )}
          <br />
          出力はそのまま使っても、自分で修正したり、AIチャットで整えてから使うこともできます。
        </div>
        <textarea
          value={outputText}
          onChange={(e) => setOutputText(e.target.value)}
          placeholder={step.type === "chat" ? "AIツールの会話結果をここに貼り付けてください" : "実行するボタンを押すと結果が自動で表示されます"}
          rows={10}
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: 14,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 6,
            outline: "none",
            boxSizing: "border-box",
            resize: "vertical",
            fontFamily: "inherit",
            background: "#fff",
            lineHeight: 1.7
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveOutput}>出力データを保存</BtnPrimary>
          {saveOutputMsg && (
            <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ 保存しました</span>
          )}
          <BtnSecondary onClick={() => { navigator.clipboard.writeText(outputText); setCopyOutputMsg(true); setTimeout(() => setCopyOutputMsg(false), 2000); }}>出力データをコピー</BtnSecondary>
          {copyOutputMsg && (
            <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ コピーしました</span>
          )}
          <span style={{ fontSize: 12, color: "#888" }}>
            ※ 次のステップの入力に使ったり、修正用にコピーできます
          </span>
          {nextStep && (
            <BtnSecondary
              onClick={() => onNavigate(`step_${nextStep.num}`)}
              style={{
                background: "rgba(34,197,94,0.08)",
                color: "#16a34a",
                border: "1px solid rgba(34,197,94,0.2)"
              }}
            >
              STEP{nextStep.num}へ進む →
            </BtnSecondary>
          )}
          {!nextStep && (
            <BtnSecondary
              onClick={() => onNavigate("saved")}
              style={{
                background: "rgba(34,197,94,0.08)",
                color: "#16a34a",
                border: "1px solid rgba(34,197,94,0.2)"
              }}
            >
              完了 → 保存データを見る
            </BtnSecondary>
          )}
        </div>
      </div>

      {step.help && step.help.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            onClick={() => setHelpOpen(!helpOpen)}
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "#555",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 0"
            }}
          >
            <span
              style={{
                transform: helpOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
                display: "inline-block"
              }}
            >
              ▶
            </span>
            操作のポイント
          </div>
          {helpOpen && (
            <Card style={{ background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.05)" }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#666", lineHeight: 1.8 }}>
                {step.help.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
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
        {STEPS.map((s) => {
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
                  <BtnSecondary onClick={() => onNavigate(`step_${s.num}`)} style={{ fontSize: 12, padding: "6px 12px" }}>
                    開く
                  </BtnSecondary>
                  {sd.outputText && (
                    <BtnSecondary onClick={() => handleCopy(sd.outputText)} style={{ fontSize: 12, padding: "6px 12px" }}>
                      コピー
                    </BtnSecondary>
                  )}
                </div>
              </div>
              {sd.outputText && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    color: "#888",
                    lineHeight: 1.5,
                    maxHeight: 60,
                    overflow: "hidden"
                  }}
                >
                  {sd.outputText.slice(0, 150)}
                  {sd.outputText.length > 150 ? "..." : ""}
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
      {refModal && (
        <div style={{ margin: "16px 0", border: "1.5px solid #2563eb", borderRadius: 10, background: "#f0f6ff", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>STEP{refModal.stepNum}の出力（参照）</span>
            <button onClick={() => setRefModal(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888", lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", background: "#fff", borderRadius: 8, padding: 12, fontSize: 13, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12, border: "1px solid #dbeafe" }}>
            {refModal.text}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(refModal.text); setRefModal(null); }}
            style={{ padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            コピーして閉じる
          </button>
        </div>
      )}
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

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 16 }}>AI出版プロデューサーの3つの特徴</h2>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>① コンセプトを固めてから書く — 手戻りが少ない理由</div>
          <svg width="100%" viewBox="0 0 680 220" xmlns="http://www.w3.org/2000/svg">
            <defs><marker id="ga1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
            <rect x="20" y="60" width="104" height="56" rx="8" fill="#E6F1FB" stroke="#185FA5" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#0C447C" x="72" y="87" textAnchor="middle">STEP1-2</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#185FA5" x="72" y="105" textAnchor="middle">テーマ・市場</text>
            <line x1="124" y1="88" x2="148" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
            <rect x="152" y="60" width="104" height="56" rx="8" fill="#E1F5EE" stroke="#0F6E56" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#085041" x="204" y="87" textAnchor="middle">STEP3-4</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#0F6E56" x="204" y="105" textAnchor="middle">読者・素材</text>
            <line x1="256" y1="88" x2="280" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
            <rect x="284" y="60" width="104" height="56" rx="8" fill="#EEEDFE" stroke="#534AB7" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#3C3489" x="336" y="87" textAnchor="middle">STEP5-8</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#534AB7" x="336" y="105" textAnchor="middle">設計・構成</text>
            <line x1="388" y1="88" x2="412" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
            <rect x="416" y="60" width="104" height="56" rx="8" fill="#FAEEDA" stroke="#854F0B" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#633806" x="468" y="87" textAnchor="middle">STEP9</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#854F0B" x="468" y="105" textAnchor="middle">本文執筆</text>
            <line x1="520" y1="88" x2="544" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga1)"/>
            <rect x="548" y="60" width="112" height="56" rx="8" fill="#EAF3DE" stroke="#3B6D11" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#27500A" x="604" y="87" textAnchor="middle">STEP10</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#3B6D11" x="604" y="105" textAnchor="middle">Amazon出版</text>
            <rect x="20" y="140" width="632" height="1" fill="#ccc"/>
            <text fontFamily="sans-serif" fontSize="11" fill="#666" x="72" y="162" textAnchor="middle">コンセプト確定</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#666" x="204" y="162" textAnchor="middle">差別化の核を発見</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#666" x="336" y="162" textAnchor="middle">設計図が揃う</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#666" x="468" y="162" textAnchor="middle">書くだけの状態</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#666" x="604" y="162" textAnchor="middle">完成</text>
            <rect x="284" y="182" width="240" height="22" rx="4" fill="#f0f0f0"/>
            <text fontFamily="sans-serif" fontSize="11" fill="#444" x="404" y="197" textAnchor="middle">ここまでが「設計」— 本文前に固める</text>
          </svg>
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>設計フェーズ（STEP1〜8）を先に固めることで、本文執筆に入ってから大幅な方向転換が起きにくくなります。</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>② 市場勝率診断でテーマを外しにくい</div>
          <svg width="100%" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="ga2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker>
              <marker id="ga2g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#22863a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker>
              <marker id="ga2r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker>
            </defs>
            <rect x="20" y="70" width="130" height="56" rx="8" fill="#F1EFE8" stroke="#5F5E5A" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#444441" x="85" y="92" textAnchor="middle">テーマ候補</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#5F5E5A" x="85" y="110" textAnchor="middle">気になる2語</text>
            <line x1="150" y1="98" x2="178" y2="98" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga2)"/>
            <rect x="182" y="50" width="160" height="96" rx="8" fill="#E6F1FB" stroke="#185FA5" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#0C447C" x="262" y="78" textAnchor="middle">市場勝率診断</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#185FA5" x="262" y="96" textAnchor="middle">Amazonデータで判定</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#185FA5" x="262" y="114" textAnchor="middle">競合・レビュー分析</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#185FA5" x="262" y="132" textAnchor="middle">狙い目の切り口発見</text>
            <line x1="342" y1="78" x2="378" y2="58" stroke="#22863a" strokeWidth="1.5" markerEnd="url(#ga2g)"/>
            <line x1="342" y1="118" x2="378" y2="148" stroke="#E24B4A" strokeWidth="1.5" markerEnd="url(#ga2r)"/>
            <rect x="382" y="32" width="140" height="52" rx="8" fill="#EAF3DE" stroke="#3B6D11" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#27500A" x="452" y="52" textAnchor="middle">勝率あり</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#3B6D11" x="452" y="70" textAnchor="middle">次のステップへ進む</text>
            <rect x="382" y="122" width="140" height="52" rx="8" fill="#FCEBEB" stroke="#A32D2D" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#791F1F" x="452" y="142" textAnchor="middle">勝率が低い</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#A32D2D" x="452" y="160" textAnchor="middle">テーマを再検討</text>
            <path d="M452 174 Q452 188 340 188 Q220 188 85 188 Q85 180 85 126" fill="none" stroke="#aaa" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#ga2)"/>
            <text fontFamily="sans-serif" fontSize="11" fill="#888" x="300" y="184" textAnchor="middle">テーマを変えてやり直せる</text>
          </svg>
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Amazonの実データで市場を診断します。勝率が低ければテーマを変えてやり直せるため、「書き終えてから気づく」失敗を防げます。</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>③ AIは素材を出す — 判断するのは人間</div>
          <svg width="100%" viewBox="0 0 680 180" xmlns="http://www.w3.org/2000/svg">
            <defs><marker id="ga3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
            <rect x="20" y="60" width="160" height="56" rx="8" fill="#EEEDFE" stroke="#534AB7" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#3C3489" x="100" y="82" textAnchor="middle">AIが素材を出す</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#534AB7" x="100" y="100" textAnchor="middle">叩き台・候補・草案</text>
            <line x1="180" y1="88" x2="208" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga3)"/>
            <rect x="212" y="44" width="176" height="88" rx="8" fill="#FAEEDA" stroke="#854F0B" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#633806" x="300" y="72" textAnchor="middle">人間が判断する</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#854F0B" x="300" y="90" textAnchor="middle">これでいい？違う？</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#854F0B" x="300" y="108" textAnchor="middle">どう修正する？</text>
            <line x1="388" y1="88" x2="416" y2="88" stroke="#555" strokeWidth="1.5" markerEnd="url(#ga3)"/>
            <rect x="420" y="60" width="160" height="56" rx="8" fill="#EAF3DE" stroke="#3B6D11" strokeWidth="0.5"/>
            <text fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#27500A" x="500" y="82" textAnchor="middle">修正・確定する</text>
            <text fontFamily="sans-serif" fontSize="11" fill="#3B6D11" x="500" y="100" textAnchor="middle">自分でもAIチャットでも</text>
            <rect x="20" y="148" width="160" height="20" rx="4" fill="#f0f0f0"/>
            <text fontFamily="sans-serif" fontSize="11" fill="#555" x="100" y="162" textAnchor="middle">10ツール全てが対象</text>
            <rect x="420" y="148" width="160" height="20" rx="4" fill="#f0f0f0"/>
            <text fontFamily="sans-serif" fontSize="11" fill="#555" x="500" y="162" textAnchor="middle">Claude・ChatGPT等を活用</text>
          </svg>
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>各ツールの出力は叩き台です。そのまま使うことも、自分で修正することも、AIチャットで整えることもできます。</div>
        </div>
      </div>

      <Section title="全体の流れ">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>STEP1からSTEP10まで順番に進めます</li>
          <li>前のステップの出力を次のステップの入力に使います</li>
          <li>途中で止まっても、保存データからいつでも再開できます</li>
        </ul>
      </Section>

      <Section title="操作方法（ワークフロー型：STEP2・3・5〜10）">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>① 入力データ欄に情報を入力して「入力データを保存」を押す</li>
          <li>② 「実行する」ボタンを押すとAIが自動で処理し、結果が出力欄に表示される</li>
          <li>③ 内容を確認して「出力データを保存」を押す</li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#888" }}>
          コピー＆ペーストは不要です。ボタンを押すだけで結果が表示されます。
        </div>
      </Section>

      <Section title="操作方法（チャット型：STEP1・4）">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>① 入力データ欄に情報を入力して「入力データを保存」を押す</li>
          <li>② 「入力データをコピー」でコピーして「AIツールを開く」でツールにアクセスし、貼り付けて対話する</li>
          <li>③ 会話結果をコピーして出力データ欄に貼り付け「出力データを保存」を押す</li>
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
          <li>STEP2の入力欄に貼り付けて「実行する」を押す</li>
        </ol>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#888" }}>
          「実行する」を押すと自動でクリーニングしてAIに渡します。クリーニング操作は不要です。
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
          {STEPS.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#2563eb", minWidth: 48 }}>STEP{s.num}</span>
              <span style={{ color: "#333", flex: 1 }}>{s.title}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontSize: 12 }}>
                開く ↗
              </a>
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

  const [pendingInputs, setPendingInputs] = useState({});

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
          const updated = {
            ...existing,
            inputData: inputs,
            status: existing.status === "completed" ? "completed" : "in_progress",
            updatedAt: new Date().toISOString()
          };
          saveStepData(num, updated);
          return { ...prev, [num]: updated };
        });
      });
      return {};
    });
    setPage(p);
    if (p.startsWith("step_")) {
      const num = parseInt(p.replace("step_", ""), 10);
      setProject((prev) => {
        const updated = { ...prev, currentStep: num };
        saveProject(updated);
        return updated;
      });
    }
    window.scrollTo?.(0, 0);
  }, []);

  const handleSaveInput = useCallback(
    async (num, inputData) => {
      const existing = allSteps[num] || defaultStepData(num);
      const updated = {
        ...existing,
        inputData,
        status: existing.status === "completed" ? "completed" : "in_progress",
        updatedAt: new Date().toISOString()
      };
      await saveStepData(num, updated);
      setAllSteps((prev) => ({ ...prev, [num]: updated }));
      setProject((prev) => {
        const p = { ...prev, lastUpdatedStep: num };
        saveProject(p);
        return p;
      });
    },
    [allSteps]
  );

  const handleSaveOutput = useCallback(
    async (num, outputText) => {
      const existing = allSteps[num] || defaultStepData(num);
      const updated = {
        ...existing,
        outputText,
        status: "completed",
        isSaved: true,
        updatedAt: new Date().toISOString()
      };
      await saveStepData(num, updated);
      setAllSteps((prev) => ({ ...prev, [num]: updated }));
      setProject((prev) => {
        const completedCount = Object.values({ ...allSteps, [num]: updated }).filter(
          (s) => s.status === "completed"
        ).length;
        const p = { ...prev, lastUpdatedStep: num, completedCount };
        saveProject(p);
        return p;
      });
    },
    [allSteps]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "'Noto Sans JP', sans-serif",
          color: "#888"
        }}
      >
        読み込み中...
      </div>
    );
  }

  const renderPage = () => {
    if (page === "home") return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={navigate} />;
    if (page === "guide") return <GuidePage onNavigate={navigate} />;
    if (page === "saved") return <SavedPage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={navigate} />;
    if (page.startsWith("step_")) {
      const num = parseInt(page.replace("step_", ""), 10);
      const step = STEPS[num - 1];
      const sd = allSteps[num] || defaultStepData(num);
      return (
        <StepPage
          step={step}
          stepData={sd}
          project={project}
          onNavigate={navigate}
          onSaveInput={handleSaveInput}
          onSaveOutput={handleSaveOutput}
          onUpdateProject={setProject}
          onInputChange={handlePendingInputChange}
          allSteps={allSteps}
        />
      );
    }
    return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={navigate} />;
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Noto Sans JP', sans-serif",
        background: "#f0f2f5"
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <SideMenu currentPage={page} onNavigate={navigate} stepStatuses={stepStatuses} />
      <div style={{ marginLeft: 380, flex: 1, padding: "32px 40px", maxWidth: 860, boxSizing: "border-box" }}>
        {renderPage()}
      </div>
    </div>
  );
}