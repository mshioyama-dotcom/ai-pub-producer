import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { extractTextFromFile, buildSourceText, ACCEPTED_EXTENSIONS } from "./utils/extractText";
import { extractBookEssence, formatEssenceAsText } from "./utils/extractEssence";
import DiscussionPanel from "./DiscussionPanel";

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
  blue:       "#2a4468",
  blueLight:  "rgba(42,68,104,0.1)",
  green:      "#1e6b3a",
  greenLight: "rgba(30,107,58,0.1)",
  red:        "#b52b1e",
  redLight:   "rgba(181,43,30,0.08)",
};

const STEPS = [
  {
    id: "step_01", num: 1, title: "書籍プロファイル草案",
    description: "仮テーマと著者プロファイルから「書籍プロファイル草案」を生成します。続くSTEP2（キーワード絞り込み）・STEP3（競合レビュー評価）の市場検証を経て、確定アクションで書籍プロファイル確定版に進化させます。",
    category: "企画設計", type: "custom",
    url: "",
    inputs: [
      { name: "theme", label: "仮テーマ", desc: "書きたい本のテーマを一文で", source: null, required: true, type: "text", maxChars: 200 },
      { name: "motivation", label: "動機・きっかけ", desc: "なぜ自分がこのテーマを書くのか", source: null, required: true, type: "textarea", maxChars: 1000 },
      { name: "reader_hypothesis", label: "想定読者の仮説（任意）", desc: "書ける範囲でOK。空欄ならAIが推論", source: null, required: false, type: "textarea", maxChars: 1000 }
    ],
    outputTitle: "書籍プロファイル草案",
    help: [
      "仮テーマ・動機・想定読者を入力すると、著者プロファイル（STEP0で生成）と組み合わせて書籍プロファイル草案を生成します",
      "STEP2（キーワード絞り込み）・STEP3（競合レビュー評価）で市場検証し、確定アクションで書籍プロファイル確定版へ進化させます",
      "STEP2/3から「STEP1に戻る」で戻ってきた場合、市場検証からのフィードバックが画面上部に表示され、その示唆を踏まえて草案を再生成できます"
    ]
  },
  {
    id: "step_02", num: 2, title: "キーワード絞り込み",
    description: "STEP1の書籍プロファイル草案から、Amazon Kindle で読者が実際に検索しそうなキーワード候補10個をAIが生成し、Real-Time Amazon Data API で各キーワードの市場データを取得して3軸（需要・競合の弱さ・意図合致）でスコアリングします。AIが上位1〜2個に推奨マークを付け、合計スコアが低い場合はSTEP1に戻って草案を調整するよう示唆します。",
    category: "企画設計", type: "custom",
    url: "",
    inputs: [],
    outputTitle: "キーワード絞り込み結果",
    help: [
      "ボタンを押すだけでAIがキーワード候補10個生成・Amazon検索・スコアリングまで自動で行います（1〜2分かかります）",
      "推奨キーワードが0個（合計スコア18点未満）の場合は、STEP1に戻ってコンセプトを調整することを推奨します",
      "推奨キーワードが1〜2個出たら、それを選定してSTEP3「競合レビュー評価」に進みます",
      "STEP2には外部AI相談機能はありません（客観データ分析のためAI判定アシストが代替機能になります）"
    ]
  },
  {
    id: "step_03", num: 3, title: "競合レビュー評価",
    description: "STEP2で選定したキーワードの上位本3冊のAmazonレビューを分析し、読者の共通不満点・既存本がカバーできていない切り口・本企画の差別化ポイント・注意すべき落とし穴を抽出します。AI判定で「差別化ポイントが2個以下」と出た場合は、STEP1に戻ってコンセプトを調整することを推奨します。",
    category: "企画設計", type: "custom",
    url: "",
    inputs: [],
    outputTitle: "競合レビュー評価結果",
    help: [
      "STEP2で選定したキーワードの上位本3冊のAmazonレビューを取得・分析します（1〜2分かかります）",
      "出力：読者の共通不満点／既存本がカバーできていない切り口／本企画の差別化ポイント／注意すべき落とし穴",
      "差別化ポイントが3個以上明確なら確定アクションへ、2個以下ならSTEP1に戻ってコンセプトを調整しましょう",
      "STEP3には外部AI相談機能はありません（客観データ分析のためAI判定アシストが代替機能になります）"
    ]
  },
  {
    id: "step_04", num: 4, title: "エピソードインタビュー",
    description: "AIがあなたに質問しながら、本の素材となる体験談やエピソードを引き出します。書籍プロファイルから読者像は把握済みなので、すぐに質問が始まります。他の本にはない差別化ポイントが、ここで集まる素材から生まれます。",
    category: "企画設計", type: "chat",
    url: "https://udify.app/chat/qbB9SNU5UG3gryYp",
    inputs: [],
    outputTitle: "インタビュー要約",
    help: [
      "「開始」「準備できました」など、内容は何でも送信するとAIが質問1から始めます",
      "AIは1回に1つだけ質問します。焦らず具体的に答えてください",
      "「数字は出せない」場合は「体感では◯◯くらい」でOKです",
      "質問が終わったら、AIが要約を出してくれます。その要約を保存してSTEP5以降で使います"
    ]
  },
  {
    id: "step_05", num: 5, title: "タイトル・サブタイトル作成",
    description: "Amazonで検索されやすく、かつ読者がクリックしたくなるタイトル案を複数作ります。STEP2で選定したキーワードは必ずタイトルかサブタイトルに含まれます。",
    category: "企画設計", type: "workflow",
    url: "https://udify.app/workflow/z7djuT4RLqfAbEqY",
    inputs: [
      { name: "keyword1", label: "検索キーワード1", desc: "STEP2で選定した1語目", source: "STEP2", required: true, type: "text", autoFill: false, maxChars: 256 },
      { name: "keyword2", label: "検索キーワード2", desc: "STEP2で選定した2語目", source: "STEP2", required: true, type: "text", autoFill: false, maxChars: 256 },
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
    description: "本全体の章構成（章タイトル）と目次（節見出し）を一気に作ります。書籍プロファイルから章構造を設計し、エピソードから節見出しの具体性を出します。デフォルトは7章構成。",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/tcqNIyr8wpCBAJhb",
    inputs: [
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "STEP4のインタビュー要約を貼り付け（「自動振り分け」で自動入力）", source: "STEP4", required: true, type: "textarea", autoFill: true, maxChars: 5000 }
    ],
    outputTitle: "完成目次（章構造＋節見出し）",
    help: [
      "「はじめに」と「おわりに」は自動で付きます",
      "デフォルトは7章構成（章タイトル＋各章4〜5節）",
      "特定の章だけ修正したい場合は、出力をAIチャットに貼り付けて指示してください",
      "目次が気に入らない場合は、書籍プロファイル確定版（確定アクション）を見直すと改善することがあります"
    ]
  },
  {
    id: "step_07", num: 7, title: "章構成作成",
    description: "目次の各節に「この節で何を書くか」の要約を付けます。本文執筆前の最後の設計図になります。",
    category: "執筆設計", type: "workflow",
    url: "https://udify.app/workflow/4KDXsPKSlgk5qMu8",
    inputs: [
      { name: "toc_text", label: "目次作成のアウトプット", desc: "STEP6の目次を貼り付け（「自動振り分け」で自動入力）", source: "STEP6", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
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
      { name: "chapter_outline_text", label: "1章分のアウトライン", desc: "STEP7の出力から、今回分解したい1章分だけをコピーして貼り付けてください。", source: "STEP7", required: true, type: "textarea", autoFill: false, maxChars: 2048 }
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
      { name: "detailed_plot_text", label: "詳細プロット作成のアウトプット（1章分）", desc: "STEP8の詳細プロットから1章分だけを選択してください。", source: "STEP8", required: true, type: "textarea", autoFill: false, maxChars: 5000 },
      { name: "target_section", label: "執筆対象の節（1節分）", desc: "今回書きたい節を1つ選びます。下の「STEP8から節を抽出」ボタンを押すと、節の候補が一覧表示されます。", source: "STEP8", required: true, type: "text", autoFill: false, maxChars: 256 }
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
      { name: "interview_text", label: "エピソードインタビューのアウトプット", desc: "STEP4のインタビュー要約を貼り付け（「自動振り分け」で自動入力）", source: "STEP4", required: true, type: "textarea", autoFill: true, maxChars: 5000 },
      { name: "outline_text", label: "章構成作成のアウトプット", desc: "STEP7の章構成を貼り付け（「自動振り分け」で自動入力）", source: "STEP7", required: true, type: "textarea", autoFill: true, maxChars: 20000 }
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

const STORAGE_KEY = "aipub:project";
const STEPS_KEY_PREFIX = "aipub:step:";
const AUTHOR_PROFILE_KEY = "aipub:author_profile";
const WORK_PROFILE_KEY = "aipub:work_profile_draft";
const WORK_PROFILE_CONFIRMED_KEY = "aipub:work_profile_confirmed";
const WORK_PROFILE_STEP2_FULL_KEY = "aipub:work_profile_step2_full";
const STEP0_INPUTS_KEY = "aipub:step0_inputs";
const STEP1_PENDING_KEY = "aipub:step1_pending_inputs";
const STEP1_INPUTS_KEY = "aipub:step1_inputs";
const STEP2_INPUTS_KEY = "aipub:step2_inputs";
const TITLE_CONFIRMED_KEY = "aipub:title_confirmed";
const SUBTITLE_CONFIRMED_KEY = "aipub:subtitle_confirmed";
// v4新規：新STEP2/3から戻ってきた時にSTEP1上部に表示する市場検証フィードバック
// 形式: { from: "STEP2" | "STEP3", content: string (markdown), generated_at: ISO string }
const RETURN_FEEDBACK_KEY = "aipub:return_feedback";

// v4新規：新STEP2「キーワード絞り込み」の分析結果（api/step2 の戻り値そのまま）
// 形式: { keywords, market_data, scored, judgment_text, ai_recommendation, return_feedback_for_step1, warnings }
const STEP2_ANALYSIS_KEY = "aipub:step2_analysis";
// v4新規：新STEP2で著者が選定したキーワード（1〜2個）。STEP3 と確定アクションへ引き渡す。
const STEP2_SELECTED_KEYWORDS_KEY = "aipub:step2_selected_keywords";
// v4新規：新STEP3「競合レビュー評価」の分析結果（api/step3 の戻り値そのまま）
// 形式: { analyzed_books, analysis_text, ai_recommendation, differentiation_count, return_feedback_for_step1, warnings }
const STEP3_ANALYSIS_KEY = "aipub:step3_analysis";

// 出版目標のチェックボックス選択肢（マーケティング観点の主要ゴール）
const PUBLISHING_GOAL_OPTIONS = [
  { value: "longseller", label: "ロングセラー化（長期で読まれ続ける）" },
  { value: "leadmagnet", label: "リードマグネット（自社サービス・コミュニティへの誘導）" },
  { value: "authority", label: "権威付け（専門家としての立場確立）" },
  { value: "lecture", label: "講演・登壇依頼の獲得" },
  { value: "community", label: "読者コミュニティの形成" },
  { value: "subsidiary", label: "別事業（コーチング・コンサル等）への送客" },
];

// 出版目標を STEP1 Dify に送る形式の文字列に変換する。
// 例：「☑ ロングセラー化（長期で読まれ続ける）\n☑ リードマグネット...\n\n補足：...」
function buildPublishingGoalText(goals, customGoal) {
  const parts = [];
  const checked = (goals || []).map((g) => {
    const opt = PUBLISHING_GOAL_OPTIONS.find((o) => o.value === g);
    return opt ? `☑ ${opt.label}` : "";
  }).filter(Boolean);
  if (checked.length > 0) parts.push(checked.join("\n"));
  if ((customGoal || "").trim()) parts.push(`補足：${customGoal.trim()}`);
  return parts.join("\n\n");
}

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

// localStorage マイグレーション (v1)
// 旧 STEP4-10 を 新 STEP3-9 に詰める。旧 STEP3（読者・価値設計）は破棄。
// 起動時に 1 回だけ実行（aipub:migration:v1 フラグで管理）。
const MIGRATION_KEY_V1 = "aipub:migration:v1";
function migrateLocalStorageV1() {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATION_KEY_V1) === "done") return;

    const get = (k) => localStorage.getItem(k);
    const set = (k, v) => { if (v !== null && v !== undefined) localStorage.setItem(k, v); };
    const del = (k) => localStorage.removeItem(k);

    // 旧 step:4..10 のデータを退避
    const buffered = {};
    for (let i = 4; i <= 10; i++) {
      const key = STEPS_KEY_PREFIX + i;
      const v = get(key);
      if (v !== null) buffered[i] = v;
    }
    // 旧 step:3（読者・価値設計）を削除
    del(STEPS_KEY_PREFIX + 3);
    // 旧 step:4..10 → 新 step:3..9
    for (let i = 4; i <= 10; i++) {
      const newIdx = i - 1;
      if (buffered[i] !== undefined) {
        set(STEPS_KEY_PREFIX + newIdx, buffered[i]);
      } else {
        del(STEPS_KEY_PREFIX + newIdx);
      }
    }
    // 旧 step:10 を片付け
    del(STEPS_KEY_PREFIX + 10);

    // currentStep / lastUpdatedStep を持つプロジェクトデータも調整
    try {
      const raw = get(STORAGE_KEY);
      if (raw) {
        const proj = JSON.parse(raw);
        if (proj.currentStep === 3) proj.currentStep = 1; // 旧STEP3にいた場合はSTEP1に戻す（読者・価値設計は廃止）
        else if (typeof proj.currentStep === "number" && proj.currentStep >= 4 && proj.currentStep <= 10) proj.currentStep = proj.currentStep - 1;
        if (proj.lastUpdatedStep === 3) proj.lastUpdatedStep = null;
        else if (typeof proj.lastUpdatedStep === "number" && proj.lastUpdatedStep >= 4 && proj.lastUpdatedStep <= 10) proj.lastUpdatedStep = proj.lastUpdatedStep - 1;
        set(STORAGE_KEY, JSON.stringify(proj));
      }
    } catch (e) { console.error("migration: project parse failed", e); }

    localStorage.setItem(MIGRATION_KEY_V1, "done");
    console.log("[MIGRATION v1] STEP3 廃止 + STEP4-10→STEP3-9 番号繰り上げを完了");
  } catch (e) {
    console.error("migrateLocalStorageV1 failed:", e);
  }
}
if (typeof window !== "undefined") migrateLocalStorageV1();

// v4 番号繰り上げ用のlocalStorageマイグレーション（冪等）。
// 旧STEP3〜9 (v1適用後の状態) を 新STEP4〜10 にずらす。
// 既存ユーザーが作業中のSTEPデータを保持したまま、新しいSTEP番号体系に移行する。
// 既に migration_v4_done フラグが立っていれば何もしない。
const MIGRATION_V4_KEY = "aipub:migration:v4";
function migrateLocalStorageV4() {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATION_V4_KEY) === "done") return;

    // 旧key:9 → 新key:10、旧key:8 → 新key:9、... 旧key:3 → 新key:4 の順で移動
    // （上から下へ移動して、移動前のkeyが上書きされないよう逆順で処理）
    for (let oldN = 9; oldN >= 3; oldN--) {
      const newN = oldN + 1;
      const oldKey = STEPS_KEY_PREFIX + oldN;
      const newKey = STEPS_KEY_PREFIX + newN;
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal === null) continue; // データなしならスキップ
      const newVal = localStorage.getItem(newKey);
      if (newVal !== null) {
        // 既に新keyにデータがある（先行マイグレーション実行orユーザーが先に新STEPを使い始めた）
        // 安全側に倒し、旧keyのデータを失わないようスキップする
        continue;
      }
      // 旧 → 新 に移動して旧を削除
      localStorage.setItem(newKey, oldVal);
      localStorage.removeItem(oldKey);
    }

    // currentStep / lastUpdatedStep もシフトする
    // 旧STEP3〜9 のいずれかにいた場合は +1 する。旧STEP2 にいた場合は新STEP2 (キーワード絞り込み・新規) なので未着手化を兼ねて STEP1 に戻す。
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const proj = JSON.parse(raw);
        if (typeof proj.currentStep === "number" && proj.currentStep >= 3 && proj.currentStep <= 9) {
          proj.currentStep = proj.currentStep + 1;
        } else if (proj.currentStep === 2) {
          // 旧STEP2(市場検証→確定)は廃止。新STEP2はキーワード絞り込みなのでSTEP1に戻す（任意で実行可能）
          proj.currentStep = 1;
        }
        if (typeof proj.lastUpdatedStep === "number" && proj.lastUpdatedStep >= 3 && proj.lastUpdatedStep <= 9) {
          proj.lastUpdatedStep = proj.lastUpdatedStep + 1;
        } else if (proj.lastUpdatedStep === 2) {
          proj.lastUpdatedStep = null;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(proj));
      }
    } catch (e) { console.error("migration v4: project parse failed", e); }

    localStorage.setItem(MIGRATION_V4_KEY, "done");
    console.log("[MIGRATION] v4 localStorage migration completed");
  } catch (e) {
    console.error("migrateLocalStorageV4 failed:", e);
  }
}
if (typeof window !== "undefined") migrateLocalStorageV4();

async function loadProject() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function saveProject(proj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(proj)); } catch (e) { console.error(e); }
}
async function loadStepData(num) {
  try { const raw = localStorage.getItem(STEPS_KEY_PREFIX + num); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function sendDebugLog(label, data) {
  if (typeof window === "undefined") return;
  if (!window.__DEBUG_LOGS) window.__DEBUG_LOGS = [];
  window.__DEBUG_LOGS.push({ timestamp: new Date().toLocaleTimeString(), label, data });
  console.log(`[DEBUG] ${label}`, data);
  try {
    fetch("/api/debug-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: window.__DEBUG_SESSION_ID || "unknown", label, data, userAgent: navigator.userAgent || "" }) }).catch(() => {});
  } catch (e) {}
}

// 出力データの会話的ノイズ（前置き・相槌・受け止め要約）を取り除く。
// 1) <<<出力データ>>> ... <<<出力データここまで>>> マーカーがあれば中身のみ抽出
//    ただし誤検出を避けるため、以下のガードを設ける：
//    - マーカーは独立した行（行頭・行末で他のテキストと混ざらない）にあること
//    - 抽出結果が元テキストの 30% 未満ならマーカーは「本文に偶然紛れ込んだ」とみなして抽出しない
// 2) なければ単純に trim（既存挙動を壊さない）
function cleanOutputText(text) {
  if (typeof text !== "string") return text;
  let cleaned = text.replace(/\r\n/g, "\n").trim();
  // マーカーは行頭・行末を要求（本文中に偶然混ざった「<<<出力データ>>>」を抽出しない）
  const markerRe = /(?:^|\n)\s*<<<\s*出力データ\s*>>>\s*\n([\s\S]*?)\n\s*<<<\s*出力データここまで\s*>>>\s*(?:\n|$)/;
  const m = cleaned.match(markerRe);
  if (m) {
    const extracted = m[1].trim();
    // 抽出結果が元テキストの 30% 以上を占める場合のみ採用。
    // 極端に短い抽出（本文中に紛れ込んだマーカー由来の誤検出）は無視して元テキストを残す。
    if (extracted.length >= Math.max(cleaned.length * 0.3, 50)) {
      cleaned = extracted;
    }
  }
  return cleaned;
}

async function saveStepData(num, data) {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STEPS_KEY_PREFIX + num, serialized);
    sendDebugLog(`SAVE STEP${num}`, { outputTextLength: (data?.outputText || "").length, serializedLength: serialized.length });
  } catch (e) { console.error(e); sendDebugLog(`SAVE_ERROR STEP${num}`, { error: e.message }); }
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
    // マイグレーションフラグもリセット（次回 mount 時に旧データがあれば再マイグレーション可能）
    localStorage.removeItem(MIGRATION_V4_KEY);
    localStorage.removeItem(AUTHOR_PROFILE_KEY);
    localStorage.removeItem(WORK_PROFILE_KEY);
    localStorage.removeItem(WORK_PROFILE_CONFIRMED_KEY);
    localStorage.removeItem(WORK_PROFILE_STEP2_FULL_KEY);
    localStorage.removeItem(STEP1_PENDING_KEY);
    localStorage.removeItem(STEP1_INPUTS_KEY);
    localStorage.removeItem(STEP2_INPUTS_KEY);
    localStorage.removeItem(RETURN_FEEDBACK_KEY);
    localStorage.removeItem(STEP2_ANALYSIS_KEY);
    localStorage.removeItem(STEP2_SELECTED_KEYWORDS_KEY);
    localStorage.removeItem(STEP3_ANALYSIS_KEY);
  } catch (e) { console.error(e); }
}

async function loadAuthorProfile() {
  try { return localStorage.getItem(AUTHOR_PROFILE_KEY) || ""; } catch { return ""; }
}
async function saveAuthorProfile(text) {
  try { localStorage.setItem(AUTHOR_PROFILE_KEY, text || ""); } catch (e) { console.error(e); }
}

async function loadWorkProfile() {
  try { return localStorage.getItem(WORK_PROFILE_KEY) || ""; } catch { return ""; }
}
async function saveWorkProfile(text) {
  try { localStorage.setItem(WORK_PROFILE_KEY, text || ""); } catch (e) { console.error(e); }
}

async function loadWorkProfileConfirmed() {
  try { return localStorage.getItem(WORK_PROFILE_CONFIRMED_KEY) || ""; } catch { return ""; }
}
async function saveWorkProfileConfirmed(text) {
  try { localStorage.setItem(WORK_PROFILE_CONFIRMED_KEY, text || ""); } catch (e) { console.error(e); }
}

const STEP1_FIELD_MAP = {
  "仮テーマ": "theme",
  "動機": "motivation",
  "動機・きっかけ": "motivation",
  "想定読者": "readerHypothesis",
  "想定読者の仮説": "readerHypothesis",
};

function applyToStep1Pending(title, proposal) {
  if (!title || !proposal) return;
  const field = STEP1_FIELD_MAP[title.trim()];
  if (!field) return;
  try {
    const existing = JSON.parse(localStorage.getItem(STEP1_PENDING_KEY) || "{}");
    existing[field] = proposal;
    localStorage.setItem(STEP1_PENDING_KEY, JSON.stringify(existing));
  } catch (e) { console.error(e); }
}

function consumeStep1Pending() {
  try {
    const raw = localStorage.getItem(STEP1_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    localStorage.removeItem(STEP1_PENDING_KEY);
    return data;
  } catch { return null; }
}

function getAutoInjectedProfiles() {
  try {
    if (typeof window === "undefined") return {};
    const authorProfile = localStorage.getItem(AUTHOR_PROFILE_KEY) || "";
    const workProfile = localStorage.getItem(WORK_PROFILE_CONFIRMED_KEY)
      || localStorage.getItem(WORK_PROFILE_KEY)
      || "";
    const titleConfirmed = localStorage.getItem(TITLE_CONFIRMED_KEY) || "";
    const subtitleConfirmed = localStorage.getItem(SUBTITLE_CONFIRMED_KEY) || "";
    const out = {};
    if (authorProfile) out.author_profile = authorProfile;
    if (workProfile) out.work_profile = workProfile;
    // STEP5で確定したタイトル・サブタイトルはSTEP6以降の全STEPで参照される
    if (titleConfirmed) out.title = titleConfirmed;
    if (subtitleConfirmed) out.subtitle = subtitleConfirmed;
    return out;
  } catch {
    return {};
  }
}

// STEP4の単一案テキストから「メインタイトル」「サブタイトル」を抽出する。
// 以下の3パターンに対応：
//   1. 「メインタイトル: xxx」「メインタイトル：xxx」（同行）
//   2. 「メインタイトル\n\nxxx」（次の非空行）
//   3. 「**メインタイトル**\n\nxxx」（装飾付き）
// 外部AIからコピペされた多様なフォーマットでも抽出できるよう柔軟に。
function extractTitleSubtitleFromStep4Case(caseText) {
  if (!caseText || typeof caseText !== "string") return { title: "", subtitle: "" };
  const tryExtract = (label) => {
    // 同行記法: "メインタイトル: xxx" / "メインタイトル：xxx"
    const inline = caseText.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]+)`));
    if (inline && inline[1].trim()) return inline[1];
    // 別行記法: "メインタイトル\n\nxxx"（**装飾**や行頭#も許容）
    const block = caseText.match(new RegExp(`(?:^|\\n)\\s*[#*]*\\s*${label}\\s*[#*]*\\s*\\n+\\s*([^\\n]+)`));
    if (block && block[1].trim()) return block[1];
    return "";
  };
  const clean = (s) => (s || "").replace(/^[\s*【】「」"'：:]+|[\s*【】「」"']+$/g, "").trim();
  return {
    title: clean(tryExtract("メインタイトル")),
    subtitle: clean(tryExtract("サブタイトル")),
  };
}

function parseStep1Suggestions(text) {
  if (!text) return [];
  const items = [];
  // 装飾フリー: 「### xxx」「## xxx」「**xxx**」「### **xxx**」など、見出しレベルや装飾の有無に依存せず検出
  const blockRegex = /(?:^|\n)\s*[#*]+\s*([^\n#*]+?)\s*[*]*\s*\n([\s\S]*?)(?=\n\s*[#*]+\s*\S|$)/g;
  // ラベル行: 行頭の任意の箇条書き記号（-、・、*、+ など）に依存しない
  const buildLabelRegex = (label) =>
    new RegExp(`(?:^|\\n)\\s*[\\-・*+]?\\s*${label}\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*[\\-・*+]?\\s*(?:現状|提案|根拠)\\s*[:：]|$)`);
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();
    if (!title || !body) continue;
    const currentMatch = body.match(buildLabelRegex("現状"));
    const proposalMatch = body.match(buildLabelRegex("提案"));
    const reasonMatch = body.match(buildLabelRegex("根拠"));
    // 現状・提案・根拠のいずれもなければ提案ブロックではないので除外
    if (!currentMatch && !proposalMatch && !reasonMatch) continue;
    items.push({
      title,
      current: currentMatch ? currentMatch[1].trim() : "",
      proposal: proposalMatch ? proposalMatch[1].trim() : "",
      reason: reasonMatch ? reasonMatch[1].trim() : "",
    });
  }
  return items;
}

function isUnchanged(proposal) {
  if (!proposal) return true;
  const normalized = proposal.replace(/[*\s（）()]/g, "");
  return /変更なし|変更不要|変更なし$/.test(normalized);
}

function splitStep2Output(text) {
  if (!text) return { market: "", suggestions: "", confirmed: "", competitors: "", raw: text || "" };
  // 見出しレベル（##/###）や装飾（**）の有無に依存せず、見出しテキストの一致で抽出する。
  // 次の見出し行（行頭が #/* で始まる、または同レベル見出し）まで本文として取得。
  const extract = (heading) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // パターン: 行頭の任意の装飾(##, ###, **)+ 見出しテキスト + 改行 + 本文 ... + 次の装飾見出しまで
    const re = new RegExp(`(?:^|\\n)\\s*[#*]+\\s*${escaped}\\s*[*]*\\s*\\n([\\s\\S]*?)(?=\\n\\s*[#*]+\\s*\\S|$)`);
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  const marketParts = [];
  // 新プロンプト（Keepa廃止版）の見出し + 旧プロンプトの見出しを後方互換で両方拾う
  ["市場像", "整合性診断", "市場勝率診断", "狙い目の切り口", "書籍プロファイル需要診断", "総合勝率診断"].forEach((h) => {
    const content = extract(h);
    if (content) marketParts.push(`### ${h}\n\n${content}`);
  });
  return {
    market: marketParts.join("\n\n"),
    suggestions: extract("STEP1修正提案"),
    confirmed: extract("書籍プロファイル確定版"),
    competitors: extract("検証で参照した上位本（参考）") || extract("検証で参照した上位本") || extract("📚 検証で参照した競合本（Keepa取得）") || extract("検証で参照した競合本"),
    raw: text,
  };
}

// 行頭の「【案N】」「## 【案N】」「### 【案N】」「**【案N】**」など
// 見出しレベルや装飾を問わずに位置を返す。見つからなければ -1。
function findCaseHeaderIdx(text, label) {
  const re = new RegExp(`(^|\\n)\\s*[#*]*\\s*${label}`);
  const m = text.match(re);
  if (!m) return -1;
  return m.index + (m[1] ? m[1].length : 0);
}

// STEP4 タイトル・サブタイトル作成の出力（3案併記Markdown）をパースして、
// ヘッダー / 案1 / 案2 / 案3 / 推し案フッター に分解する。
// 見出しの装飾（## や ** など）の有無に依存しない。
// パースに失敗（フォーマット崩れ等）した場合は null を返す。
function parseStep4CaseStructure(text) {
  if (!text || typeof text !== "string") return null;
  const case1Idx = findCaseHeaderIdx(text, "【案1】");
  const case2Idx = findCaseHeaderIdx(text, "【案2】");
  const case3Idx = findCaseHeaderIdx(text, "【案3】");
  const oshiIdx = findCaseHeaderIdx(text, "【推し案】");
  // 3案すべて存在し、順序が正しいことを確認
  if (case1Idx === -1 || case2Idx === -1 || case3Idx === -1) return null;
  if (!(case1Idx < case2Idx && case2Idx < case3Idx)) return null;
  // 推し案がある場合は案3より後ろであることも確認（崩れ検出）
  if (oshiIdx !== -1 && oshiIdx < case3Idx) return null;
  return {
    header: text.slice(0, case1Idx).trim(),
    cases: {
      "1": text.slice(case1Idx, case2Idx).trim(),
      "2": text.slice(case2Idx, case3Idx).trim(),
      "3": text.slice(case3Idx, oshiIdx === -1 ? text.length : oshiIdx).trim(),
    },
    footer: oshiIdx === -1 ? "" : text.slice(oshiIdx).trim(),
  };
}

// パース済み構造から完全な3案併記出力を再構築する。
function buildStep4FullOutput(parsed) {
  if (!parsed) return "";
  const sep = "\n\n---\n\n";
  const parts = [];
  if (parsed.header) parts.push(parsed.header);
  parts.push(parsed.cases["1"]);
  parts.push(parsed.cases["2"]);
  parts.push(parsed.cases["3"]);
  if (parsed.footer) parts.push(parsed.footer);
  return parts.join(sep);
}

// 完全な3案併記出力の中で、特定の案だけを新しい内容に置き換える。
// パース失敗時は新しい内容をそのまま返す（フォールバック）。
function mergeStep4Case(fullText, caseNum, newCaseContent) {
  const parsed = parseStep4CaseStructure(fullText);
  if (!parsed) return newCaseContent;
  parsed.cases[caseNum] = (newCaseContent || "").trim();
  return buildStep4FullOutput(parsed);
}

// 完全な3案併記出力から、特定の案だけを抽出する。
// パース失敗時は元の全文を返す（フォールバック）。
function extractStep4Case(fullText, caseNum) {
  const parsed = parseStep4CaseStructure(fullText);
  if (!parsed || !parsed.cases[caseNum]) return fullText;
  return parsed.cases[caseNum];
}

// 相談機能（DiscussionPanel）に渡す書籍プロファイルの軽量版を抽出。
// STEP2の出力は60KB相当になるが、相談AIに必要なのは「核メッセージ・想定読者・狙い目」程度。
// 市場分析データ（市場像・需要診断・勝率診断・参照競合）は除外して入力トークンを大幅削減する。
//
// 効果: 60KB → 10〜15KB 程度（約1/4〜1/6）に軽量化
//       Anthropic Prompt Caching と併用で1往復あたり数十円の節約
//
// 入力が STEP1 の書籍プロファイル草案の場合は短いのでそのまま返す（フォールバック）。
function extractDiscussionContext(workProfile) {
  if (!workProfile) return "";
  const text = workProfile;

  // STEP2の出力（確定版）かを判定：装飾フリーで「書籍プロファイル確定版」見出しを検出
  const hasConfirmed = /(?:^|\n)\s*[#*]+\s*書籍プロファイル確定版/.test(text);
  if (!hasConfirmed) {
    // STEP1草案の場合はサイズが小さいのでそのまま渡す
    return text;
  }

  // STEP2出力から「核となる」セクションだけを抽出（見出しレベル/装飾の有無に依存しない）
  const extractSection = (heading) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\n)\\s*[#*]+\\s*${escaped}\\s*[*]*\\s*\\n([\\s\\S]*?)(?=\\n\\s*[#*]+\\s*\\S|$)`);
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };

  const sections = [];
  const confirmed = extractSection("書籍プロファイル確定版");
  const intent = extractSection("検索者の意図（仮説）");
  const market = extractSection("狙い目の切り口");

  if (confirmed) sections.push(`## 書籍プロファイル確定版\n\n${confirmed}`);
  if (intent) sections.push(`## 検索者の意図（仮説）\n\n${intent}`);
  if (market) sections.push(`## 狙い目の切り口\n\n${market}`);

  // 何も抽出できなかった場合は念のため原文返却
  if (sections.length === 0) return text;
  return sections.join("\n\n---\n\n");
}

function extractMotivation(workProfileDraft) {
  if (!workProfileDraft) return "";
  // 「動機」セクションを抽出（装飾記号 ■▲●◆□▼○◇ や **/##/### に依存しない）
  // 次のセクション見出し（同種の記号 or # で始まる行）または末尾まで
  const match = workProfileDraft.match(/(?:^|\n)\s*[■▲●◆□▼○◇#*]+\s*動機[\s*]*\s*\n([\s\S]*?)(?=\n\s*[■▲●◆□▼○◇#*]+\s*\S|$)/);
  return match ? match[1].trim() : "";
}

function extractKeywords3Axes(workProfileDraft) {
  if (!workProfileDraft) return { theme: "", reader: "", diff: "" };
  // 「、」「,」で区切られた複数候補がある場合は最初のフレーズだけを採用（Amazon検索のため）
  // **や太字記号も除去
  const pickFirst = (text) => {
    if (!text) return "";
    const cleaned = text.replace(/\*+/g, "").trim();
    return cleaned.split(/[、,]/)[0].trim();
  };
  // 装飾フリー: 行頭の任意の箇条書き記号 (-/・/*/+/▶/▼/●/○/◆/◇/■/□) のあとに「軸名: xxx」
  // 装飾なし「主題軸: xxx」も検出。コロンは半角/全角どちらでも可。
  const buildAxisRegex = (axis) => new RegExp(`(?:^|\\n)\\s*[\\-・*+▶▼●○◆◇■□]?\\s*${axis}\\s*[:：]\\s*(.+)`);
  const themeMatch = workProfileDraft.match(buildAxisRegex("主題軸"));
  const readerMatch = workProfileDraft.match(buildAxisRegex("読者軸"));
  const diffMatch = workProfileDraft.match(buildAxisRegex("差分軸"));
  return {
    theme: themeMatch ? pickFirst(themeMatch[1]) : "",
    reader: readerMatch ? pickFirst(readerMatch[1]) : "",
    diff: diffMatch ? pickFirst(diffMatch[1]) : "",
  };
}

// 書籍プロファイル確定版から検索キーワード3軸（主題軸の最初2語）を抽出
// 新STEP4（タイトル作成）の自動振り分けで keyword1 / keyword2 に流し込む
function parseWorkProfileKeywords(workProfile) {
  const empty = { keyword1: "", keyword2: "" };
  if (!workProfile) return empty;
  const axes = extractKeywords3Axes(workProfile);
  const themePhrase = (axes.theme || "").trim();
  const themeParts = themePhrase.split(/[\s　]+/).filter(Boolean);
  return { keyword1: themeParts[0] || "", keyword2: themeParts[1] || "" };
}

function parseStep2Output(text) {
  if (!text) return { keyword1: "", keyword2: "", intent: "", markets: [] };

  // keyword1/keyword2：装飾フリーで「主題軸: A B」を検出。失敗時はタイトル行 `# 〇〇 × △△` をフォールバック
  let keyword1 = "";
  let keyword2 = "";
  const themeAxisMatch = text.match(/(?:^|\n)\s*[\-・*+▶▼●○◆◇■□]?\s*主題軸\s*[:：]\s*([^\n]+)/);
  if (themeAxisMatch) {
    const parts = themeAxisMatch[1].replace(/\*+/g, "").trim().split(/[\s　]+/).filter(Boolean);
    keyword1 = parts[0] || "";
    keyword2 = parts[1] || "";
  } else {
    const titleMatch = text.match(/^#[^#].*[:：]\s*(.+?)\s*[×x×]\s*(.+?)\s*$/m);
    if (titleMatch) { keyword1 = titleMatch[1].trim(); keyword2 = titleMatch[2].trim(); }
  }

  // 検索意図：装飾フリーで「検索者の意図（仮説）」見出しを検出（## / ### / ** / 絵文字あり/なし いずれもOK）
  const intentMatch = text.match(/(?:^|\n)\s*[#*]+\s*[^\n]*検索者の意図[（(]仮説[）)][^\n]*\n([\s\S]*?)(?=\n\s*[#*]+\s*\S|\n---|$)/);
  const intent = (intentMatch?.[1] || "").trim();

  // 狙い目の切り口：装飾フリーで見出しを検出。旧フォーマットの `【狙い目の切り口】` もフォールバック
  const marketMatchNew = text.match(/(?:^|\n)\s*[#*]+\s*[^\n]*狙い目の切り口[^\n]*\n([\s\S]*?)(?=\n\s*[#*]+\s*\S|\n---|$)/);
  const marketMatchOld = text.match(/【狙い目の切り口】\s*\n([\s\S]*?)(?=\n---|\n##|\n【|$)/);
  const marketSection = (marketMatchNew?.[1] || marketMatchOld?.[1] || "").trim();
  let markets = [];
  if (marketSection) {
    // `- **切り口名**：説明` の箇条書きを切り口ごとに1ブロックとして抽出
    const lines = marketSection.split("\n");
    const blocks = [];
    let current = [];
    const flush = () => { if (current.length) blocks.push(current.join("\n").trim()); current = []; };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { continue; }
      if (/^[-・*•]\s/.test(trimmed) || /^\d+[.\s]/.test(trimmed)) { flush(); current.push(trimmed); }
      else { current.push(trimmed); }
    }
    flush();
    markets = blocks.filter(Boolean);
    if (markets.length === 0) markets.push(marketSection);
  }

  return { keyword1, keyword2, intent, markets };
}

// STEP6（章構成作成）の出力テキストから、章単位の配列を抽出する。
// AIや外部AIとのやり取り次第で章見出しのフォーマットが揺れる前提で、
// 装飾記号（[]・**・##・【】・番号付きリスト・スペース等）を一旦除去してから
// 「はじめに」「第N章...」「おわりに」のキーワード一致で判定する。
//
// サポートする例:
//   [はじめに] / **はじめに** / ## はじめに / はじめに
//   [第1章：xxx] / 第1章：xxx / ## 第1章: xxx / **第3章 xxx** / 1. 第1章 xxx
//   [おわりに] / **おわりに** / おわりに
function extractChapters(text) {
  if (!text || typeof text !== "string") return [];

  // 章タイトルかどうか判定するヘルパー：装飾記号を全部除去した文字列でキーワード判定する
  const stripDecoration = (s) =>
    String(s).replace(/^[\s　]*[\d０-９]+[.．、]?[\s　]*/, "") // 行頭の番号付きリスト記号 (1. 2. 等)
             .replace(/[*#\[\]【】「」（）()"'`>～~・\s　]/g, ""); // 装飾記号と空白を全部除去
  const isChapterHeading = (line) => {
    if (!line) return false;
    const s = stripDecoration(line);
    if (!s) return false;
    if (s.length > 80) return false; // 章タイトルは80文字以内
    if (/^はじめに/.test(s)) return true;
    if (/^おわりに/.test(s)) return true;
    if (/^第[\d０-９]+章/.test(s)) return true;
    return false;
  };

  const lines = text.split("\n");
  const chapters = [];
  let current = null;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (isChapterHeading(trimmed)) {
      if (current && current.body.trim()) chapters.push(current);
      // 表示用に装飾記号を取り除いたタイトル（コロン・全角文字は残す）
      const cleanTitle = trimmed.replace(/^[\s　]*[\d０-９]+[.．、]?[\s　]*/, "")
                                .replace(/[*#\[\]【】]/g, "")
                                .trim();
      current = { chapterTitle: cleanTitle, body: rawLine + "\n" };
    } else if (current) {
      current.body += rawLine + "\n";
    }
  }
  if (current && current.body.trim()) chapters.push(current);
  return chapters;
}

// STEP7（詳細プロット）の出力から節 (1)(2)... と項①②③... を抽出する。
// AI議論でフォーマットが揺れる前提で、装飾記号を除去してから判定。
// サポートする節見出し: (1) / （1） / 1. / 1) / 1． / 1、 / **(1) xxx**
function extractSections(text) {
  if (!text || typeof text !== "string") return [];

  // 装飾を除去するヘルパー（行頭の #/*/> 等と途中の **）
  const stripDecoration = (s) =>
    String(s).replace(/^[\s　]*[#*>]+[\s　]*/, "").replace(/[*]+/g, "").trim();

  const sections = []; const lines = text.split("\n");
  // 節見出し: (1) / （1） / 1. / 1) / 1）/ 1． / 1、 など、装飾フリーで検出
  const sectionRegex = /^[\(（]?\s*\d+\s*[\)）.．、]\s*.+$/;
  const itemRegex = /^[\u2460-\u2473][\s　]?.{2,100}$/;
  let currentSection = null;
  for (const rawLine of lines) {
    const line = stripDecoration(rawLine);
    if (!line) continue;
    // 節見出しは80文字以下（長文は本文の可能性）
    if (line.length <= 80 && sectionRegex.test(line)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { sectionTitle: line, items: [] };
    } else if (itemRegex.test(line)) {
      if (currentSection) { if (!currentSection.items.includes(line)) currentSection.items.push(line); }
      else { currentSection = { sectionTitle: "（節見出しなし）", items: [line] }; }
    }
  }
  if (currentSection) sections.push(currentSection);
  return sections.filter((s) => s.items.length > 0);
}

function stripChapterSection(output, isFirst) {
  if (isFirst) return output;
  if (!output || typeof output !== "string") return output;
  const lines = output.split("\n"); const result = [];
  let removedChapter = false; let removedSection = false; let sawContent = false;
  const chapterRegex = /^第[0-9零一二三四五六七八九十百]+章/;
  const sectionRegex = /^\([0-9]+\)/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!sawContent && !removedChapter && chapterRegex.test(trimmed)) { removedChapter = true; continue; }
    if (!sawContent && removedChapter && !removedSection && sectionRegex.test(trimmed)) { removedSection = true; continue; }
    if (!sawContent && removedChapter && removedSection && !trimmed) continue;
    if (!sawContent && removedChapter && !removedSection && !trimmed && result.length === 0) continue;
    if (trimmed) sawContent = true;
    result.push(line);
  }
  if (!removedChapter && !removedSection) return output;
  return result.join("\n").replace(/^\n+/, "");
}

const Badge = ({ status }) => (
  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 3, background: STATUS_COLORS[status].bg, color: STATUS_COLORS[status].text, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
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
          <button onClick={onReselect} style={{ fontSize: 11, color: C.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>選び直す</button>
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
            style={{ padding: "12px 14px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 13, color: C.text, lineHeight: 1.7 }}>
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

const SectionSelector = ({ sections, selected, onSelect, onReselect }) => {
  if (!sections || sections.length === 0) return null;
  if (selected !== null && sections[selected]) {
    const sec = sections[selected];
    return (
      <div style={{ marginTop: 8, padding: "12px 14px", background: C.greenLight, borderRadius: 4, border: `1px solid rgba(30,107,58,0.25)` }}>
        <div style={{ fontSize: 12, color: C.green, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600 }}>✓ 選択中の節（{sec.items.length}項を一括生成）</span>
          <button onClick={onReselect} style={{ fontSize: 11, color: C.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>選び直す</button>
        </div>
        <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, lineHeight: 1.6, marginBottom: 6 }}>{sec.sectionTitle}</div>
        <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
          {sec.items.map((item, i) => <div key={i} style={{ paddingLeft: 8 }}>{item}</div>)}
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.gold, fontWeight: 600, marginBottom: 8 }}>執筆する節を1つ選んでください（{sections.length}節を検出）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", padding: 2 }}>
        {sections.map((sec, i) => (
          <div key={i} onClick={() => onSelect(i, sec)}
            style={{ padding: "10px 14px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4, lineHeight: 1.5 }}>{sec.sectionTitle}</div>
            <div style={{ fontSize: 11, color: C.textLight }}>{sec.items.length}項を一括生成 ／ 実行時間の目安：{Math.ceil(sec.items.length * 0.7)}〜{sec.items.length}分程度</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ChapterSelector - STEP6の章構成出力から1章を選んで textarea にセットするUI。
// 「STEP6から章を抽出」ボタン押下後、章タイトル一覧を表示し、選択すると章本文がプレフィルされる。
const ChapterSelector = ({ chapters, selected, onSelect, onReselect }) => {
  if (!chapters || chapters.length === 0) return null;
  if (selected !== null && chapters[selected]) {
    const ch = chapters[selected];
    return (
      <div style={{ marginTop: 8, padding: "12px 14px", background: C.greenLight, borderRadius: 4, border: `1px solid rgba(30,107,58,0.25)` }}>
        <div style={{ fontSize: 12, color: C.green, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600 }}>✓ 選択中の章（下のテキストエリアに転記済み・必要なら編集してください）</span>
          <button onClick={onReselect} style={{ fontSize: 11, color: C.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>選び直す</button>
        </div>
        <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, lineHeight: 1.6 }}>{ch.chapterTitle}</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.gold, fontWeight: 600, marginBottom: 8 }}>分解する章を1つ選んでください（{chapters.length}章を検出）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", padding: 2 }}>
        {chapters.map((ch, i) => (
          <div key={i} onClick={() => onSelect(i, ch)}
            style={{ padding: "10px 14px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4, lineHeight: 1.5 }}>{ch.chapterTitle}</div>
            <div style={{ fontSize: 11, color: C.textLight }}>{ch.body.trim().length.toLocaleString()}文字</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// SourceLabel - フィールドの「データ源」と操作ボタンを表示。
// autoFill === true は「ページ表示時に自動投入される」フィールド。ボタンは「再転記」（最新の出力で上書き）。
// onAutoFillParsed はSTEP4キーワード等の特殊抽出ボタン。
const SourceLabel = ({ source, autoFill, onAutoFill, onRef, onAutoFillParsed, isAutoFilled }) =>
  source ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: C.navyMid, background: C.blueLight, padding: "2px 7px", borderRadius: 3 }}>← {source}の出力</span>
      {autoFill === true && isAutoFilled && (
        <span style={{ fontSize: 11, color: C.green, background: C.greenLight, padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>✓ 自動投入済み</span>
      )}
      {onAutoFillParsed ? (
        <button onClick={onAutoFillParsed} style={{ fontSize: 11, color: C.white, background: C.gold, border: "none", borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>自動振り分け</button>
      ) : autoFill === true ? (
        <button onClick={onAutoFill} title={`${source}の最新出力で再投入`} style={{ fontSize: 11, color: C.navyMid, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontWeight: 500 }}>↻ 再転記</button>
      ) : (
        <button onClick={onRef} style={{ fontSize: 11, color: C.navyMid, background: C.blueLight, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>参照</button>
      )}
    </span>
  ) : null;

const RequiredMark = () => <span style={{ color: C.red, fontSize: 12, marginLeft: 4 }}>必須</span>;

const BtnPrimary = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding: "10px 20px", background: disabled ? "#ccc" : C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 600, fontSize: 14, cursor: disabled ? "default" : "pointer", letterSpacing: "0.03em", ...style }}>
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
  <div onClick={onClick} style={{ background: C.white, borderRadius: 6, border: `1px solid ${C.border}`, padding: 20, ...style }}>{children}</div>
);

const StepBadge = ({ num }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: C.navy, color: C.white, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{num}</span>
);

// STEP3+ で AI に自動転記される「著者プロファイル」「書籍プロファイル確定版」を可視化するパネル
// デフォルトは折りたたみ。展開時は全文を表示
// stepNum を渡すと、STEP5+ で「タイトル・サブタイトル未確定」の警告を出す
const AutoInjectedProfilesPanel = ({ onNavigate, stepNum }) => {
  const [expanded, setExpanded] = useState(false);
  const [authorProfile, setAuthorProfile] = useState("");
  const [workProfile, setWorkProfile] = useState("");
  const [workProfileSource, setWorkProfileSource] = useState(""); // "confirmed" | "draft" | ""
  const [titleConfirmed, setTitleConfirmed] = useState("");
  const [subtitleConfirmed, setSubtitleConfirmed] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = localStorage.getItem(AUTHOR_PROFILE_KEY) || "";
    const wpConfirmed = localStorage.getItem(WORK_PROFILE_CONFIRMED_KEY) || "";
    const wpDraft = localStorage.getItem(WORK_PROFILE_KEY) || "";
    setAuthorProfile(a);
    if (wpConfirmed) { setWorkProfile(wpConfirmed); setWorkProfileSource("confirmed"); }
    else if (wpDraft) { setWorkProfile(wpDraft); setWorkProfileSource("draft"); }
    else { setWorkProfile(""); setWorkProfileSource(""); }
    setTitleConfirmed(localStorage.getItem(TITLE_CONFIRMED_KEY) || "");
    setSubtitleConfirmed(localStorage.getItem(SUBTITLE_CONFIRMED_KEY) || "");
  }, [expanded]);

  const hasAuthor = !!authorProfile.trim();
  const hasWork = !!workProfile.trim();
  const hasTitle = !!(titleConfirmed && subtitleConfirmed);
  // STEP5以降ではタイトル・サブタイトル確定が必要
  const needsTitle = stepNum && stepNum >= 5;

  return (
    <div style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 4, background: C.bg }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.navyMid }}>
          📎 自動転記される参照情報（AIに渡されます）
          <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textLight, fontWeight: 400 }}>
            著者プロファイル: {hasAuthor ? "✓" : "未設定"} ／ 書籍プロファイル: {hasWork ? (workProfileSource === "confirmed" ? "✓ 確定版" : "△ 草案のみ") : "未設定"}
            {needsTitle && <> ／ タイトル: <span style={{ color: hasTitle ? C.green : C.red, fontWeight: 600 }}>{hasTitle ? "✓ 確定済み" : "⚠ 未確定"}</span></>}
          </span>
        </span>
        <span style={{ fontSize: 13, color: C.textLight }}>{expanded ? "▲ 閉じる" : "▼ 展開"}</span>
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 14px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 12, marginBottom: 10, lineHeight: 1.7 }}>
            このSTEPでは、入力欄の内容に加えて、以下の2つの情報も自動的にAIに渡されます。内容を確認・編集したい場合は元のSTEPに戻ってください。
          </div>

          {/* 著者プロファイル */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>【著者プロファイル】</span>
              <button onClick={() => onNavigate?.("step_0")}
                style={{ fontSize: 11.5, color: C.navyMid, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer" }}>
                STEP0 で編集 ›
              </button>
            </div>
            {hasAuthor ? (
              <pre style={{ fontSize: 12, color: C.textSub, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: "10px 12px", margin: 0, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", lineHeight: 1.6 }}>
                {authorProfile}
              </pre>
            ) : (
              <div style={{ fontSize: 12.5, color: C.red, padding: "10px 12px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.2)`, borderRadius: 3 }}>
                ⚠ 未設定。STEP0で著者プロファイルを生成してください。
              </div>
            )}
          </div>

          {/* 書籍プロファイル */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                【書籍プロファイル{workProfileSource === "confirmed" ? "確定版（STEP2）" : workProfileSource === "draft" ? "草案（STEP1）" : ""}】
              </span>
              <button onClick={() => onNavigate?.(workProfileSource === "draft" ? "step_1" : "step_2")}
                style={{ fontSize: 11.5, color: C.navyMid, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer" }}>
                {workProfileSource === "draft" ? "STEP1 で編集" : "STEP2 で編集"} ›
              </button>
            </div>
            {hasWork ? (
              <>
                {workProfileSource === "draft" && (
                  <div style={{ fontSize: 11.5, color: C.gold, marginBottom: 6, padding: "6px 10px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 3 }}>
                    ⚠ STEP2 を未実行のため、STEP1 草案が使われます。市場検証で精度を上げるため STEP2 を実行することを推奨します。
                  </div>
                )}
                <pre style={{ fontSize: 12, color: C.textSub, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: "10px 12px", margin: 0, maxHeight: 480, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", lineHeight: 1.6 }}>
                  {workProfile}
                </pre>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: C.red, padding: "10px 12px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.2)`, borderRadius: 3 }}>
                ⚠ 未設定。STEP1〜2 で書籍プロファイルを生成してください。
              </div>
            )}
          </div>

          {/* タイトル・サブタイトル（STEP5で確定）。STEP5以降は必須 */}
          {(stepNum && stepNum >= 4) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                  【タイトル・サブタイトル（STEP4で確定）】
                </span>
                <button onClick={() => onNavigate?.("step_4")}
                  style={{ fontSize: 11.5, color: C.navyMid, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer" }}>
                  STEP4 で確定 ›
                </button>
              </div>
              {hasTitle ? (
                <pre style={{ fontSize: 12, color: C.textSub, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: "10px 12px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", lineHeight: 1.7 }}>
{`メインタイトル: ${titleConfirmed}
サブタイトル: ${subtitleConfirmed}`}
                </pre>
              ) : (
                <div style={{ fontSize: 12.5, color: needsTitle ? C.red : C.textLight, padding: "10px 12px", background: needsTitle ? "#fef2f2" : "#f5f5f5", border: `1px solid ${needsTitle ? "rgba(192,57,43,0.2)" : C.border}`, borderRadius: 3 }}>
                  {needsTitle ? "⚠ 未確定。STEP4 で 1案を採用→確定してください。タイトルが渡らないと目次や本文が散漫になります。" : "（任意）STEP4 で 1案を確定すると、ここに表示されます。"}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Amazon検索結果HTMLから「検索結果ブロック全体」を抽出して残す（旧仕様で ASIN だけを抽出していたのを改修）。
// 新 STEP2 は Keepa を使わず HTMLパースで上位本のタイトル・著者・評価・価格 を抽出する設計のため、
// 検索結果ブロック内の本文タグ（h2/a/span 等）も保持する必要がある。
// ただし script/style/svg/iframe など重い装飾要素は除去して通信サイズを抑える。
function cleanHtmlMinimal(html) {
  if (!html) return "";

  // 1. script/style/noscript/svg/iframe を除去（本文情報には無関係で重い）
  let text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // 2. スポンサー広告枠を除去（s-search-result 抽出より先に消す）
  text = text.replace(/<div[^>]*class="[^"]*(?:AdHolder|ad-feedback|s-ad-feedback)[^"]*"[\s\S]*?<\/div>/gi, "");

  // 3. 検索結果ブロック（data-component-type="s-search-result" を持つ div）を ASIN ごとに抽出
  //    各ブロックは「次の s-search-result」または「</body>」または末尾までを含む。
  const blocks = [];
  const seenAsins = new Set();
  const blockRegex = /<div[^>]*data-component-type="s-search-result"[^>]*data-asin="([A-Za-z0-9]{10})"[\s\S]*?(?=<div[^>]*data-component-type="s-search-result"|<\/body>|$)/gi;
  let m;
  while ((m = blockRegex.exec(text)) !== null) {
    const asin = m[1];
    if (seenAsins.has(asin)) continue;
    seenAsins.add(asin);
    // ブロック内の冗長な属性を削減（class, style, data-* の長い値）してサイズを抑える
    let block = m[0]
      .replace(/\s+class="[^"]*"/gi, "")
      .replace(/\s+style="[^"]*"/gi, "")
      .replace(/\s+data-(?!asin|component-type)[a-z-]+="[^"]*"/gi, "")
      .replace(/\s+aria-(?!label)[a-z-]+="[^"]*"/gi, "")
      .replace(/\s+role="[^"]*"/gi, "")
      .replace(/\s+id="[^"]*"/gi, "");
    blocks.push(block);
  }

  // 4. 検索結果ブロックが取れなかった場合のフォールバック（古い形式や DOM 差分）：
  //    /dp/ASIN リンクを含む div ブロックを ASIN ごとに抽出
  if (blocks.length === 0) {
    const dpLinkBlockRegex = /<div[^>]*>[\s\S]{0,3000}?\/dp\/([A-Za-z0-9]{10})[\s\S]{0,3000}?<\/div>/gi;
    let m2;
    while ((m2 = dpLinkBlockRegex.exec(text)) !== null) {
      const asin = m2[1];
      if (seenAsins.has(asin)) continue;
      seenAsins.add(asin);
      blocks.push(m2[0]);
    }
  }

  return blocks.join("\n\n");
}

const Step2HtmlHelper = ({ inputs, currentHtml }) => {
  const [showGuide, setShowGuide] = useState(true);
  const kw1 = (inputs.keyword1 || "").trim();
  const kw2 = (inputs.keyword2 || "").trim();
  const canOpenAmazon = kw1.length > 0 && kw2.length > 0;
  const handleOpenAmazon = () => {
    if (!canOpenAmazon) return;
    const query = encodeURIComponent(`${kw1} ${kw2}`);
    window.open(`https://www.amazon.co.jp/s?i=digital-text&k=${query}`, "_blank", "noopener,noreferrer");
  };
  const hasHtml = currentHtml.length > 0;
  const looksLikeHtml = /data-asin|<div|<html|<!DOCTYPE/i.test(currentHtml);
  const isCleanedFormat = /^\s*<div\s+data-asin/i.test(currentHtml);
  let statusLabel = "", statusColor = C.textLight, statusBg = "rgba(0,0,0,0.04)";
  if (!hasHtml) { statusLabel = "未入力"; }
  else if (isCleanedFormat) { statusLabel = "✓ HTML検知（整形済み）"; statusColor = C.green; statusBg = C.greenLight; }
  else if (looksLikeHtml) { statusLabel = "✓ HTML検知"; statusColor = C.green; statusBg = C.greenLight; }
  else { statusLabel = "⚠ HTMLではない可能性"; statusColor = C.gold; statusBg = C.goldPale; }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ padding: "14px 16px", background: canOpenAmazon ? "#eef2f7" : "rgba(0,0,0,0.03)", border: `1px solid ${canOpenAmazon ? "#c8d4e0" : C.border}`, borderRadius: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Amazon側でやること</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleOpenAmazon} disabled={!canOpenAmazon}
            style={{ padding: "9px 18px", background: canOpenAmazon ? C.navy : "rgba(0,0,0,0.1)", color: canOpenAmazon ? C.white : C.textLight, border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: canOpenAmazon ? "pointer" : "default", flexShrink: 0 }}>
            🔍 AmazonでKindle検索を開く
          </button>
          <div style={{ fontSize: 12, color: C.textSub, flex: 1, minWidth: 200, lineHeight: 1.6 }}>
            {canOpenAmazon ? <>検索後、ページ上で<strong>右クリック→「ページのソースを表示」→全選択してコピー</strong>してください。</> : <>上の「キーワード1・2」を入力すると、このボタンから検索ページを開けます。</>}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div onClick={() => setShowGuide(!showGuide)} style={{ fontSize: 12.5, color: C.navyMid, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 0", fontWeight: 600 }}>
          <span style={{ transform: showGuide ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
          詳しい手順図
        </div>
        {showGuide && (
          <div style={{ marginTop: 8, padding: "14px 16px", background: "#f4f3ef", border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <svg width="100%" viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg">
              <defs><marker id="ha2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
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
              <line x1="300" y1="209" x2="350" y2="209" stroke="#555" strokeWidth="1.5" markerEnd="url(#ha2)"/>
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 12px", background: statusBg, borderRadius: 4, border: `1px solid ${hasHtml ? (isCleanedFormat || looksLikeHtml ? "rgba(45,122,79,0.2)" : "rgba(184,146,42,0.3)") : C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>⬇ 下の欄にHTMLを貼り付け</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, marginLeft: "auto" }}>{statusLabel}</span>
      </div>
    </div>
  );
};

const SideMenu = ({ currentPage, onNavigate, stepStatuses, confirmStatus }) => {
  const menuItem = (label, page, status) => {
    const active = currentPage === page;
    return (
      <div key={page} onClick={() => onNavigate(page)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 18px", cursor: "pointer", background: active ? "rgba(26,46,74,0.08)" : "transparent", color: active ? C.navy : "#3d3d3d", fontWeight: active ? 700 : 400, fontSize: 13, lineHeight: 1.3, borderLeft: active ? `2px solid ${C.gold}` : "2px solid transparent", borderBottom: "1px solid rgba(0,0,0,0.05)", whiteSpace: "nowrap", overflow: "hidden", transition: "background 0.1s, color 0.1s" }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", marginRight: 8 }}>{label}</span>
        {status && <Badge status={status} />}
      </div>
    );
  };
  const catLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.white, letterSpacing: "0.06em", padding: "7px 18px", background: C.navy, borderTop: "1px solid rgba(255,255,255,0.06)" }}>{text}</div>
  );
  return (
    <div style={{ width: 300, minWidth: 300, height: "100vh", overflowY: "auto", background: C.navy, display: "flex", flexDirection: "column", boxSizing: "border-box", position: "fixed", left: 0, top: 0, zIndex: 10, borderRight: `2px solid ${C.gold}` }}>
      <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            <div style={{ width: 20, height: 2.5, background: C.gold, borderRadius: 1 }} />
            <div style={{ width: 15, height: 2.5, background: `rgba(184,146,42,0.6)`, borderRadius: 1 }} />
            <div style={{ width: 18, height: 2.5, background: `rgba(184,146,42,0.35)`, borderRadius: 1 }} />
          </div>
          <div style={{ width: 1.5, height: 42, background: C.gold, flexShrink: 0, opacity: 0.6 }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", letterSpacing: "0.01em", lineHeight: 1.25, fontFamily: "'Noto Sans JP', sans-serif", whiteSpace: "nowrap" }}>AI出版プロデューサー</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 5, letterSpacing: "0.04em", fontFamily: "'Noto Sans JP', sans-serif" }}>Kindle出版を10ステップで進める</div>
          </div>
        </div>
        <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, rgba(184,146,42,0.2), transparent)` }} />
      </div>
      <div style={{ flex: 1, background: "#f4f3ef" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.white, letterSpacing: "0.06em", padding: "7px 18px", background: C.navy }}>ホーム</div>
        {menuItem("ダッシュボード", "home", null)}
        {menuItem("使い方", "guide", null)}
        {/* phase1ブランチではSTEP0を再表示してテスト可能にする（mainは非表示維持） */}
        {catLabel("著者プロファイル")}
        {menuItem("STEP0　著者プロファイル", "step_0", null)}
        {CATEGORIES.map((cat) => (
          <div key={cat.label}>
            {catLabel(cat.label)}
            {cat.steps.map((n) => {
              const s = STEPS[n - 1];
              const item = menuItem(`STEP${n}　${s.title}`, `step_${n}`, stepStatuses[n]);
              // v4: STEP3 (競合レビュー評価) と STEP4 (エピソードインタビュー) の間に
              // 「書籍プロファイル確定」アクションを挿入する。サイドナビからもアクセス可能に。
              if (n === 3) {
                return (
                  <div key={`stepwrap_${n}`}>
                    {item}
                    {menuItem("　　確定　書籍プロファイル確定", "step_confirm", confirmStatus)}
                  </div>
                );
              }
              return item;
            })}
          </div>
        ))}
        {catLabel("データ管理")}
        {menuItem("保存データ", "saved", null)}
      </div>
    </div>
  );
};

const HomePage = ({ project, stepStatuses, allSteps, onNavigate }) => {
  const completedCount = Object.values(stepStatuses).filter((s) => s === "completed").length;
  const currentStep = project.currentStep || 1;
  const lastUpdated = project.lastUpdatedStep;
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", marginBottom: 6 }}>DASHBOARD</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.navy, margin: "0 0 8px", letterSpacing: "-0.01em" }}>AI出版プロデューサー</h1>
        <p style={{ fontSize: 14, color: C.textSub, margin: "0 0 16px", lineHeight: 1.7 }}>10のツールで、書籍プロファイル設計から本文執筆・Amazon掲載まで進めます</p>
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
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{completedCount}<span style={{ fontSize: 13, color: C.textLight, fontWeight: 500 }}> / 10</span></div>
        </Card>
      </div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12, letterSpacing: "0.03em" }}>進行中のステップ</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* STEP0（著者プロファイル）— 専用ページ。STEPS配列には含まれないので個別レンダリング */}
          <div key="step_0" onClick={() => onNavigate("step_0")}
            style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, cursor: "pointer", transition: "box-shadow 0.12s" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, fontSize: 12, fontWeight: 700, background: stepStatuses[0] === "completed" ? C.greenLight : "rgba(0,0,0,0.04)", color: stepStatuses[0] === "completed" ? C.green : C.textLight, marginRight: 14, flexShrink: 0 }}>0</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: C.text }}>著者プロファイル</span>
            <Badge status={stepStatuses[0]} />
            <span style={{ marginLeft: 12, fontSize: 12, color: C.gold, fontWeight: 600 }}>開く →</span>
          </div>
          {STEPS.map((s) => (
            <div key={s.id} onClick={() => onNavigate(`step_${s.num}`)}
              style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, cursor: "pointer", transition: "box-shadow 0.12s" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, fontSize: 12, fontWeight: 700, background: stepStatuses[s.num] === "completed" ? C.greenLight : stepStatuses[s.num] === "in_progress" ? C.blueLight : "rgba(0,0,0,0.04)", color: stepStatuses[s.num] === "completed" ? C.green : stepStatuses[s.num] === "in_progress" ? C.navyMid : C.textLight, marginRight: 14, flexShrink: 0 }}>{s.num}</span>
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

const BookSlotInput = ({ slot, idx, onChange, onClear, onEditEssence }) => {
  const inputId = `book-slot-${idx}`;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");

  const handleEditOpen = () => {
    setDraftText(slot?.essenceText || "");
    setEditing(true);
    setExpanded(true);
  };
  const handleEditSave = () => {
    onEditEssence?.(idx, draftText);
    setEditing(false);
  };
  const handleEditCancel = () => {
    setDraftText("");
    setEditing(false);
  };

  const stats = slot?.essence?.stats;
  const ratioPct = stats ? Math.round(stats.ratio * 100) : null;

  return (
    <div style={{ marginBottom: 8, padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 4, background: C.white }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, minWidth: 60 }}>📎 書籍{idx + 1}</span>
        {(!slot || (slot.status !== "extracting" && slot.status !== "essence_extracting")) && (
          <label htmlFor={inputId} style={{ fontSize: 12.5, padding: "6px 14px", background: C.navyLight, color: C.navyMid, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
            {slot ? "別のファイルを選択" : "ファイルを選択"}
          </label>
        )}
        <input id={inputId} type="file" accept={ACCEPTED_EXTENSIONS}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(idx, file);
            e.target.value = "";
          }} />
        {slot && (
          <>
            <span style={{ fontSize: 12.5, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slot.filename}</span>
            {slot.status === "extracting" && <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>テキスト抽出中...</span>}
            {slot.status === "essence_extracting" && <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>要素抽出中...</span>}
            {slot.status === "done" && stats && (
              <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>
                ✓ {stats.originalChars.toLocaleString()}字 → {stats.extractedChars.toLocaleString()}字 ({ratioPct}%)
              </span>
            )}
            {slot.status === "error" && <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>⚠ 失敗</span>}
            <button onClick={() => onClear(idx)} style={{ fontSize: 11, color: C.textLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, padding: "3px 8px", cursor: "pointer" }}>削除</button>
          </>
        )}
      </div>
      {slot && slot.status === "error" && (
        <div style={{ marginTop: 6, fontSize: 12, color: C.red, lineHeight: 1.6 }}>{slot.error}</div>
      )}

      {/* 抽出結果プレビュー（done状態のみ） */}
      {slot && slot.status === "done" && slot.essence && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: C.greenLight, border: `1px solid rgba(45,122,79,0.25)`, borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 6 }}>
            抽出された要素：
            {slot.essence.intro && " ✓ はじめに/序章 "}
            {slot.essence.toc && slot.essence.toc.length > 0 && ` ✓ 目次(${slot.essence.toc.length}項目) `}
            {slot.essence.chapterEnds && slot.essence.chapterEnds.length > 0 && ` ✓ 章末まとめ × ${slot.essence.chapterEnds.length} `}
            {slot.essence.ending && " ✓ おわりに/終章"}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setExpanded(!expanded)}
              style={{ fontSize: 11, color: C.navyMid, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
              {expanded ? "▲ 内容を閉じる" : "▼ 内容を確認"}
            </button>
            {!editing && (
              <button onClick={handleEditOpen}
                style={{ fontSize: 11, color: C.navyMid, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
                ✎ 抽出結果を編集
              </button>
            )}
          </div>
          {expanded && !editing && (
            <pre style={{ marginTop: 8, padding: "10px 12px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 11.5, color: C.text, maxHeight: 320, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", lineHeight: 1.7 }}>
              {slot.essenceText || "(抽出結果なし)"}
            </pre>
          )}
          {editing && (
            <div style={{ marginTop: 8 }}>
              <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)}
                rows={14}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
              <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                <button onClick={handleEditSave}
                  style={{ fontSize: 12, fontWeight: 700, color: C.white, background: C.navy, border: "none", borderRadius: 3, padding: "6px 14px", cursor: "pointer" }}>
                  保存
                </button>
                <button onClick={handleEditCancel}
                  style={{ fontSize: 12, color: C.textLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, padding: "6px 14px", cursor: "pointer" }}>
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Step0Page = ({ savedProfile, onSaveProfile, onNavigate }) => {
  // localStorage から保存済みの入力テキストを復元
  // 注意：書籍ファイル（File オブジェクト）は保存できないので、テキスト入力のみ復元する
  const savedInputs = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP0_INPUTS_KEY) : null;
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch { return {}; }
  })();

  const [bookSlots, setBookSlots] = useState([null, null, null]);
  const [postsText, setPostsText] = useState(savedInputs.postsText || "");
  const [profileText, setProfileText] = useState(savedInputs.profileText || "");
  const [existingProfile, setExistingProfile] = useState(savedInputs.existingProfile || "");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [outputText, setOutputText] = useState(savedProfile || "");
  const [saveMsg, setSaveMsg] = useState(false);
  const [saveInputMsg, setSaveInputMsg] = useState(false);

  const handleSaveInputs = () => {
    try {
      const data = {
        postsText,
        profileText,
        existingProfile,
      };
      localStorage.setItem(STEP0_INPUTS_KEY, JSON.stringify(data));
      setSaveInputMsg(true);
      setTimeout(() => setSaveInputMsg(false), 2500);
    } catch (e) {
      console.warn("STEP0 inputs save failed:", e);
      alert("入力データの保存に失敗しました。ブラウザのストレージ容量を確認してください。");
    }
  };

  const handleFileChange = async (slotIdx, file) => {
    // フェーズ1: ファイルからテキスト抽出
    setBookSlots((slots) => {
      const next = [...slots];
      next[slotIdx] = { filename: file.name, text: "", status: "extracting", error: "" };
      return next;
    });
    try {
      const text = await extractTextFromFile(file);
      // フェーズ2: 著者プロファイル素材としての要素抽出（はじめに／おわりに／章末まとめ／目次）
      setBookSlots((slots) => {
        const next = [...slots];
        next[slotIdx] = { filename: file.name, text, status: "essence_extracting", error: "" };
        return next;
      });
      // 同期処理だが UI 更新を確実にするため次のtickへ
      await new Promise((r) => setTimeout(r, 0));
      const essence = extractBookEssence(text);
      const essenceText = formatEssenceAsText(essence);
      setBookSlots((slots) => {
        const next = [...slots];
        next[slotIdx] = {
          filename: file.name,
          text,
          essence,
          essenceText,
          status: "done",
          error: "",
        };
        return next;
      });
    } catch (e) {
      setBookSlots((slots) => {
        const next = [...slots];
        next[slotIdx] = { filename: file.name, text: "", status: "error", error: e.message || "抽出に失敗しました" };
        return next;
      });
    }
  };

  // ユーザーが抽出結果プレビューを編集した時に呼ばれる
  const handleEditEssence = (slotIdx, newText) => {
    setBookSlots((slots) => {
      const next = [...slots];
      if (next[slotIdx]) {
        next[slotIdx] = { ...next[slotIdx], essenceText: newText };
      }
      return next;
    });
  };

  const handleClearSlot = (slotIdx) => {
    setBookSlots((slots) => {
      const next = [...slots];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleGenerate = async () => {
    setRunError("");
    // 各書籍は要素抽出済みテキスト（はじめに／おわりに／章末まとめ／目次のみ）を使う。
    // ユーザーが編集していればその編集後テキストが essenceText に入っている。
    const books = bookSlots
      .filter((b) => b && b.status === "done" && (b.essenceText || "").trim())
      .map((b) => ({ filename: b.filename, essenceText: b.essenceText }));
    const sourceText = buildSourceText({ books, posts: postsText, profile: profileText });
    if (!sourceText.trim() && !existingProfile.trim()) {
      setRunError("素材が何も入力されていません。書籍ファイル・Note/X投稿・プロフィールのいずれかを入力してください。");
      return;
    }
    setIsRunning(true);
    try {
      const response = await fetch("/api/dify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepNum: 0,
          inputs: { source_text: sourceText, existing_profile: existingProfile },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRunError(data.error || "生成中にエラーが発生しました。少し時間をおいて再度お試しください。");
      } else {
        setOutputText(data.output || "");
      }
    } catch (e) {
      setRunError(`通信エラーが発生しました：${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveProfile = async () => {
    const cleaned = cleanOutputText(outputText);
    if (!cleaned.trim()) return;
    if (cleaned !== outputText) setOutputText(cleaned);
    await onSaveProfile(cleaned);
    setSaveMsg(true);
    setTimeout(() => setSaveMsg(false), 2500);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>STEP 0</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>著者プロファイル</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0, lineHeight: 1.7 }}>過去の出版物・SNS投稿などからAIが著者の作家性を抽出します。生成したプロファイルはSTEP1〜9の各ステップで自動的に活用されます。</p>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      <Card style={{ marginBottom: 24, background: "#eef2f7", border: `1px solid #c8d4e0` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>このステップの進め方</div>
        <div style={{ fontSize: 13.5, color: "#2a2a2a", lineHeight: 2.1 }}>
          <span style={{ fontWeight: 700, color: C.navy }}>①</span> 書籍ファイル（最大3冊）またはNote/X投稿テキストなどの素材を入力<br />
          <span style={{ fontWeight: 700, color: C.navy }}>②</span> 「プロファイルを生成する」を押す（30秒〜1分ほどかかります）<br />
          <span style={{ fontWeight: 700, color: C.navy }}>③</span> 生成結果を確認・必要に応じて編集してから「プロファイルを保存」
        </div>
        <div style={{ fontSize: 12.5, color: "#555555", marginTop: 8, lineHeight: 1.7 }}>素材はすべて任意です。書籍ファイル・投稿テキスト・プロフィールのいずれか1つ以上を入力してください。</div>
      </Card>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>素材を入力する</h2>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>書籍ファイル（最大3冊・任意）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 8, lineHeight: 1.7 }}>
            過去に出版した書籍があれば添付してください。対応形式：.txt .md .pdf .docx
            <br />
            <span style={{ fontSize: 12, color: C.textLight }}>
              ※ アップロード後、AI が著者プロファイル生成に有用な要素（<strong>はじめに／おわりに／章末まとめ／目次</strong>）を自動抽出します。書籍全文ではなく抽出済み素材だけがAIに渡されます。
            </span>
          </div>
          {bookSlots.map((slot, idx) => (
            <BookSlotInput key={idx} slot={slot} idx={idx} onChange={handleFileChange} onClear={handleClearSlot} onEditEssence={handleEditEssence} />
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>Note・X投稿記事（任意）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>NoteやXの投稿テキストを貼り付けてください。複数ある場合は連続でOKです。</div>
          <textarea value={postsText} onChange={(e) => setPostsText(e.target.value)}
            placeholder="Note記事 / Xポストの本文をコピーして貼り付け"
            rows={6}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>プロフィール・著者ページ（任意）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>X/Noteのプロフィール文、Amazon著者ページ等の自己紹介テキストがあれば貼り付けてください。</div>
          <textarea value={profileText} onChange={(e) => setProfileText(e.target.value)}
            placeholder="プロフィール文・著者ページのテキスト"
            rows={4}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>既存の著者プロファイル（任意・更新時のみ）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>過去に生成した【著者プロファイル】を貼り付けると、新素材で進化型更新します。新規作成時は空欄でOKです。</div>
          <textarea value={existingProfile} onChange={(e) => setExistingProfile(e.target.value)}
            placeholder="【著者プロファイル】... を貼り付け"
            rows={4}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
        </div>

        {/* 入力データ保存ボタン */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <BtnPrimary onClick={handleSaveInputs}>入力データを保存</BtnPrimary>
          {saveInputMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました（次回ページを開いた時に復元されます）</span>}
          <span style={{ fontSize: 11.5, color: C.textLight, marginLeft: 4 }}>※書籍ファイルは再アップロードが必要です（テキスト入力のみ保存）</span>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="②" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>AIで生成する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.8 }}>素材を入力したら下のボタンを押してください。生成には30秒〜1分ほどかかります。</div>
          <BtnPrimary onClick={handleGenerate} disabled={isRunning}>{isRunning ? "生成中..." : "▶ プロファイルを生成する"}</BtnPrimary>
          {runError && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
        </Card>
      </div>

      <div id="output-section" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="③" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>生成された著者プロファイル</h2>
        </div>
        <textarea value={outputText} onChange={(e) => setOutputText(e.target.value)}
          rows={20}
          placeholder="ここにAIが生成した著者プロファイルが表示されます。手動で編集も可能です。"
          style={{ width: "100%", padding: "12px 14px", fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.85 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveProfile} disabled={!outputText.trim()}>プロファイルを保存</BtnPrimary>
          {saveMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました（STEP1〜9で利用できます）</span>}
        </div>
      </div>

      {/* 外部AIで相談するためのプロンプト生成パネル（STEP0用） */}
      <DiscussionPanel
        stepNum={0}
        stepName="著者プロファイル"
        stepOutput={outputText}
        authorProfile={outputText}
        workProfile=""
      />
    </div>
  );
};

const Step1Page = ({ savedAuthorProfile, savedWorkProfile, onSaveWorkProfile, onNavigate, pendingApply, project }) => {
  // pendingApply は親 App が navigate 時に 1 回だけ consume したものを props で受け渡す
  const pending = pendingApply || {};

  // localStorage から永続化された入力データを読む（pendingApply > localStorage > "" の優先順位）
  const savedInputs = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP1_INPUTS_KEY) : null;
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch { return {}; }
  })();

  const [theme, setTheme] = useState(pending.theme || savedInputs.theme || "");
  const [motivation, setMotivation] = useState(pending.motivation || savedInputs.motivation || "");
  const [readerHypothesis, setReaderHypothesis] = useState(pending.readerHypothesis || savedInputs.readerHypothesis || "");
  // 出版目標：チェックボックスで選択した主要ゴールの value 配列
  const [publishingGoals, setPublishingGoals] = useState(Array.isArray(savedInputs.publishingGoals) ? savedInputs.publishingGoals : []);
  // 出版目標：補足の自由記述
  const [customPublishingGoal, setCustomPublishingGoal] = useState(savedInputs.customPublishingGoal || "");
  const [inputSaveMsg, setInputSaveMsg] = useState(false);

  // v4新規：新STEP2/3から戻ってきた時のフィードバック表示
  // localStorage RETURN_FEEDBACK_KEY から読み込む。閉じると null になる。
  const [returnFeedback, setReturnFeedback] = useState(() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(RETURN_FEEDBACK_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const handleCloseReturnFeedback = () => {
    try { localStorage.removeItem(RETURN_FEEDBACK_KEY); } catch (e) { console.error(e); }
    setReturnFeedback(null);
  };

  // 入力欄の変更を localStorage に自動保存（debounce 不要・小さなテキストなので直書きでOK）
  useEffect(() => {
    try {
      localStorage.setItem(STEP1_INPUTS_KEY, JSON.stringify({ theme, motivation, readerHypothesis, publishingGoals, customPublishingGoal }));
    } catch (e) { console.error(e); }
  }, [theme, motivation, readerHypothesis, publishingGoals, customPublishingGoal]);

  const handleSaveInputs = () => {
    try {
      localStorage.setItem(STEP1_INPUTS_KEY, JSON.stringify({ theme, motivation, readerHypothesis, publishingGoals, customPublishingGoal }));
      setInputSaveMsg(true);
      setTimeout(() => setInputSaveMsg(false), 2500);
    } catch (e) { console.error(e); }
  };

  const togglePublishingGoal = (value) => {
    setPublishingGoals((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [outputText, setOutputText] = useState(savedWorkProfile || "");
  const [saveMsg, setSaveMsg] = useState(false);
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false);
  const [pendingAppliedFields, setPendingAppliedFields] = useState(() => {
    const applied = [];
    if (pending.theme) applied.push("仮テーマ");
    if (pending.motivation) applied.push("動機・きっかけ");
    if (pending.readerHypothesis) applied.push("想定読者の仮説");
    return applied;
  });

  const hasAuthorProfile = !!(savedAuthorProfile || "").trim();

  const handleGenerate = async () => {
    setRunError("");
    if (!hasAuthorProfile) {
      setRunError("先にSTEP0で著者プロファイルを生成・保存してください。");
      return;
    }
    if (!theme.trim()) {
      setRunError("仮テーマを入力してください（必須）。");
      return;
    }
    if (!motivation.trim()) {
      setRunError("動機・きっかけを入力してください（必須）。");
      return;
    }
    setIsRunning(true);
    try {
      const response = await fetch("/api/dify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepNum: 1,
          inputs: {
            theme: theme.trim(),
            motivation: motivation.trim(),
            reader_hypothesis: readerHypothesis.trim(),
            author_profile: savedAuthorProfile || "",
            publishing_goal: buildPublishingGoalText(publishingGoals, customPublishingGoal),
            // v4新規：新STEP2/3からの戻り時フィードバックがあればDifyに渡す（無ければ空文字）
            return_feedback: (returnFeedback && returnFeedback.content) ? returnFeedback.content : "",
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRunError(data.error || "生成中にエラーが発生しました。少し時間をおいて再度お試しください。");
      } else {
        setOutputText(data.output || "");
      }
    } catch (e) {
      setRunError(`通信エラーが発生しました：${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = async () => {
    const cleaned = cleanOutputText(outputText);
    if (!cleaned.trim()) return;
    if (cleaned !== outputText) setOutputText(cleaned);
    await onSaveWorkProfile(cleaned);
    setSaveMsg(true);
    setTimeout(() => setSaveMsg(false), 2500);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>STEP 1</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>書籍プロファイル草案</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0, lineHeight: 1.7 }}>仮テーマと著者プロファイルから、本のプロファイル草案を生成します。STEP2で市場検証して確定版に進化させます。</p>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      {/* v4新規：新STEP2/3 から戻ってきた時に表示される市場検証フィードバック */}
      {returnFeedback && returnFeedback.content && (
        <Card style={{ marginBottom: 16, background: "#fff8e6", border: `1px solid ${C.gold}` }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
            📊 {returnFeedback.from || "STEP2/3"} の分析からのフィードバック
          </div>
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 10, lineHeight: 1.7 }}>
            市場検証の結果から、書籍コンセプトの改善示唆が届いています。下の入力欄（仮テーマ・想定読者・動機）を必要に応じて修正してから、AIに再生成させてください。再生成時、このフィードバックも自動でAIに渡されます。
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px", maxHeight: 360, overflow: "auto", fontSize: 12.5, color: C.text, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
            {returnFeedback.content}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={handleCloseReturnFeedback} style={{ fontSize: 11.5, padding: "4px 10px", background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer" }}>このフィードバックを閉じる</button>
            {returnFeedback.generated_at && (
              <span style={{ fontSize: 11, color: C.textLight }}>生成日時: {new Date(returnFeedback.generated_at).toLocaleString("ja-JP")}</span>
            )}
          </div>
        </Card>
      )}

      {pendingAppliedFields.length > 0 && (
        <Card style={{ marginBottom: 16, background: "#e7f5ec", border: `1px solid ${C.green}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 6 }}>
            ✨ STEP2の修正提案を反映しました
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7 }}>
            反映されたフィールド：<strong>{pendingAppliedFields.join("、")}</strong><br />
            内容を確認・必要なら微修正してから、下の「書籍プロファイル草案を生成する」をクリックして再生成してください。
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setPendingAppliedFields([])} style={{ fontSize: 11.5, padding: "4px 10px", background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer" }}>このメッセージを閉じる</button>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 24, background: hasAuthorProfile ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasAuthorProfile ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
          📌 現在の著者プロファイル：{hasAuthorProfile ? "✓ 設定済み（自動転記されます）" : "⚠ 未設定"}
        </div>
        {hasAuthorProfile ? (
          <div>
            <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.7, marginBottom: 8 }}>
              書籍プロファイル草案の生成時に、著者プロファイルが自動でAIに渡されます。ユーザが手で貼り付ける必要はありません。
            </div>
            <button onClick={() => setProfilePreviewOpen(!profilePreviewOpen)} style={{ background: "none", border: `1px solid ${C.border}`, padding: "4px 12px", borderRadius: 4, fontSize: 12, color: C.navy, cursor: "pointer" }}>
              {profilePreviewOpen ? "閉じる" : "プレビュー表示"}
            </button>
            {profilePreviewOpen && (
              <div style={{ marginTop: 10, padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12.5, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}>
                {savedAuthorProfile}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.7, marginBottom: 8 }}>
              STEP1を使うには、先にSTEP0で著者プロファイルを生成しておく必要があります。
            </div>
            <BtnPrimary onClick={() => onNavigate("step_0")}>STEP0で著者プロファイルを生成する →</BtnPrimary>
          </div>
        )}
      </Card>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>仮テーマと動機を入力する</h2>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>仮テーマ（必須）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>書きたい本のテーマを一文で書いてください。</div>
          <input value={theme} onChange={(e) => setTheme(e.target.value)}
            placeholder="例：会社員のためのChatGPT活用術"
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: C.white }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>動機・きっかけ（必須）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>なぜ「自分が」このテーマを書くのか・きっかけ・きっかけを書いてください。著者プロファイルと仮テーマをつなぐ橋渡しの情報です。</div>
          <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)}
            placeholder="例：自社で社員研修をした際に「もっと早く知りたかった」と多数言われた。中堅会社員が業務でつまずいているポイントを体系化したい。"
            rows={4}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>想定読者の仮説（任意）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>書ける範囲でOK。空欄ならAIが著者プロファイルと仮テーマから推論します。</div>
          <textarea value={readerHypothesis} onChange={(e) => setReaderHypothesis(e.target.value)}
            placeholder="例：30代会社員・忙しくてAIに踏み出せていない人"
            rows={3}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
        </div>

        <div style={{ marginBottom: 20, padding: "14px 16px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 4 }}>
          <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>📌 出版目標（複数選択可）</label>
          <div style={{ fontSize: 13, color: "#444444", marginBottom: 10, lineHeight: 1.7 }}>
            この本を出版することで達成したい目標を選んでください。後段のSTEP（タイトル設計／目次／本文／Amazon説明文）のレビューで「この目標と整合しているか」が自動チェックされます。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {PUBLISHING_GOAL_OPTIONS.map((opt) => {
              const checked = publishingGoals.includes(opt.value);
              return (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.text, cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: checked ? "rgba(184,146,42,0.08)" : "transparent" }}>
                  <input type="checkbox" checked={checked} onChange={() => togglePublishingGoal(opt.value)} style={{ cursor: "pointer", accentColor: C.gold }} />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.navy, display: "block", marginBottom: 4 }}>補足（任意）</label>
          <textarea value={customPublishingGoal} onChange={(e) => setCustomPublishingGoal(e.target.value)}
            placeholder="例：Note→Kindle→無料相談の導線設計を本書で完成させたい。Life Book Navigator への流入を最大化する位置付け。"
            rows={2}
            style={{ width: "100%", padding: "9px 12px", fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <BtnPrimary onClick={handleSaveInputs}>入力データを保存</BtnPrimary>
          {inputSaveMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました</span>}
          <span style={{ fontSize: 11.5, color: C.textLight }}>※ 入力中も自動保存されます</span>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="②" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>AIで生成する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.8 }}>仮テーマと動機を入力したら下のボタンを押してください。生成には30秒〜1分ほどかかります。</div>
          <BtnPrimary onClick={handleGenerate} disabled={isRunning || !hasAuthorProfile}>{isRunning ? "生成中..." : "▶ 書籍プロファイル草案を生成する"}</BtnPrimary>
          {runError && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
        </Card>
      </div>

      <div id="output-section" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="③" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>生成された書籍プロファイル草案</h2>
        </div>
        <textarea value={outputText} onChange={(e) => setOutputText(e.target.value)}
          rows={20}
          placeholder="ここに生成された書籍プロファイル草案が表示されます。手動で編集も可能です。"
          style={{ width: "100%", padding: "12px 14px", fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.85 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSave} disabled={!outputText.trim()}>書籍プロファイル草案を保存</BtnPrimary>
          {saveMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました（STEP2で使えます）</span>}
        </div>
      </div>

      {/* 外部AIで相談するためのプロンプト生成パネル */}
      <DiscussionPanel
        stepNum={1}
        stepName="書籍プロファイル草案"
        stepOutput={outputText}
        authorProfile={savedAuthorProfile || ""}
        workProfile=""
      />
    </div>
  );
};

const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {}
      document.body.removeChild(ta);
    });
  };
  return (
    <button onClick={handleCopy} style={{ padding: "6px 12px", background: copied ? C.green : C.navy, color: C.white, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
      {copied ? "✓ コピーしました" : `📋 ${label || "コピー"}`}
    </button>
  );
};

const ApplyToStep1Button = ({ title, proposal, onApply }) => {
  const [applied, setApplied] = useState(false);
  const field = STEP1_FIELD_MAP[(title || "").trim()];
  if (!field) return null;
  const handleApply = () => {
    applyToStep1Pending(title, proposal); // 後方互換: localStorage
    onApply?.({ [field]: proposal }); // 直接 App.state も更新
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };
  return (
    <button onClick={handleApply} style={{ padding: "6px 12px", background: applied ? C.green : C.gold, color: C.white, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
      {applied ? "✓ STEP1に保留しました" : "✨ STEP1に反映"}
    </button>
  );
};

// v4新規：新STEP2「キーワード絞り込み」のページコンポーネント
// 旧STEP2（市場検証→書籍プロファイル確定・Amazon HTML 手動貼付）は廃止された。
// 新STEP2 は api/step2.js を呼んでAmazon API経由でキーワード10個を機械的にスコアリングし、
// 1〜2個に絞り込むだけのSTEPになる。書籍プロファイル確定は後工程の「確定アクション」で行う。
// 相談機能（DiscussionPanel）は無し（客観データ分析のためAI判定アシストで代替）。
// v4実装指示書 §4 を参照。
const Step2Page = ({ savedAuthorProfile, savedWorkProfileDraft, onNavigate, project }) => {
  // 既存の分析結果（あれば復元）
  const initialAnalysis = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP2_ANALYSIS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const initialSelected = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP2_SELECTED_KEYWORDS_KEY) : null;
      return raw ? (JSON.parse(raw) || []) : [];
    } catch { return []; }
  })();
  // STEP1 入力欄で別途保存されている publishing_goal を取り込む（あれば）
  const savedPublishingGoal = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP1_INPUTS_KEY) : null;
      if (!raw) return "";
      const parsed = JSON.parse(raw) || {};
      return buildPublishingGoalText(parsed.publishingGoals || [], parsed.customPublishingGoal || "");
    } catch { return ""; }
  })();

  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [selectedKeywords, setSelectedKeywords] = useState(Array.isArray(initialSelected) ? initialSelected : []);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [stageMsg, setStageMsg] = useState(""); // 「進捗表示」用：いまどの段階か
  const [authorPreviewOpen, setAuthorPreviewOpen] = useState(false);
  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false);

  const hasAuthorProfile = !!(savedAuthorProfile || "").trim();
  const hasDraft = !!(savedWorkProfileDraft || "").trim();

  const handleToggleKeyword = (kw) => {
    setSelectedKeywords((prev) => {
      const exists = prev.includes(kw);
      if (exists) return prev.filter((k) => k !== kw);
      if (prev.length >= 2) return prev; // 最大2個
      return [...prev, kw];
    });
  };

  // 選定キーワードを localStorage に自動保存
  useEffect(() => {
    try { localStorage.setItem(STEP2_SELECTED_KEYWORDS_KEY, JSON.stringify(selectedKeywords || [])); } catch (e) { console.error(e); }
  }, [selectedKeywords]);

  const handleRunAnalysis = async () => {
    setRunError("");
    if (!hasAuthorProfile) { setRunError("先にSTEP0で著者プロファイルを生成してください。"); return; }
    if (!hasDraft) { setRunError("先にSTEP1で書籍プロファイル草案を生成してください。"); return; }

    setIsRunning(true);
    setStageMsg("キーワード10個を生成中（AI）…");
    // クライアント側タイムアウト（4分）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);
    // 段階表示用の擬似進捗（実際の段階区切りはサーバ側だが、ユーザーに目安を見せる）
    const stageTicker = setTimeout(() => setStageMsg("Amazon検索データを取得中（10並列）…"), 8000);
    const stageTicker2 = setTimeout(() => setStageMsg("スコアを計算してAIで意図合致判定中…"), 35000);
    try {
      const response = await fetch("/api/step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          work_profile_draft: savedWorkProfileDraft || "",
          author_profile: savedAuthorProfile || "",
          publishing_goal: savedPublishingGoal || "",
          // 戻り時フィードバックの再消費は本ボタンではしない（STEP1で消費済み想定）
          return_feedback: "",
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        setRunError(`サーバから非JSON応答（${response.status}）：${text.slice(0, 300)}`);
        return;
      }
      if (!response.ok) {
        const missing = Array.isArray(data?.missingEnv) && data.missingEnv.length > 0
          ? `\n\n未設定の環境変数：${data.missingEnv.join(", ")}\n→ Vercelの環境変数設定をご確認ください。`
          : "";
        setRunError((data?.error || `HTTP ${response.status} エラー`) + missing);
        return;
      }
      // 成功
      setAnalysis(data);
      try { localStorage.setItem(STEP2_ANALYSIS_KEY, JSON.stringify(data)); } catch (e) {}
      // 既存の選定は分析が変わったらリセット
      setSelectedKeywords([]);
    } catch (e) {
      if (e.name === "AbortError") {
        setRunError("4分以上応答がなかったため処理を中断しました。もう一度「キーワード分析実行」を押してみてください。");
      } else {
        setRunError(`通信エラーが発生しました：${e.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(stageTicker);
      clearTimeout(stageTicker2);
      setStageMsg("");
      setIsRunning(false);
    }
  };

  // 「STEP1に戻る」：戻り推奨フィードバックを RETURN_FEEDBACK_KEY に保存してSTEP1へ
  const handleReturnToStep1 = () => {
    const content = analysis?.return_feedback_for_step1 || analysis?.judgment_text || "";
    if (!content.trim()) {
      // フィードバックが無い場合（手動戻り）でも空文字で保存しておく
      try { localStorage.removeItem(RETURN_FEEDBACK_KEY); } catch (e) {}
    } else {
      const payload = {
        from: "STEP2",
        content,
        generated_at: new Date().toISOString(),
      };
      try { localStorage.setItem(RETURN_FEEDBACK_KEY, JSON.stringify(payload)); } catch (e) { console.error(e); }
    }
    onNavigate("step_1");
  };

  // 「STEP3へ進む」：選定キーワードを保存してSTEP3へ
  const handleProceedToStep3 = () => {
    if (selectedKeywords.length === 0) {
      setRunError("STEP3へ進む前に、キーワードを1つ以上選定してください。");
      return;
    }
    onNavigate("step_3");
  };

  const recommendsReturn = analysis?.ai_recommendation === "return_to_step1";
  const recommendsProceed = analysis?.ai_recommendation === "proceed_to_step3";
  const generatedKeywords = Array.isArray(analysis?.keywords) ? analysis.keywords : [];

  // 分析結果と選定キーワードを localStorage に再保存（手動）
  const [saveMsg, setSaveMsg] = useState(false);
  const handleSaveAnalysis = () => {
    try {
      if (analysis) localStorage.setItem(STEP2_ANALYSIS_KEY, JSON.stringify(analysis));
      localStorage.setItem(STEP2_SELECTED_KEYWORDS_KEY, JSON.stringify(selectedKeywords || []));
      setSaveMsg(true);
      setTimeout(() => setSaveMsg(false), 2500);
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>STEP 2</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>キーワード絞り込み</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0, lineHeight: 1.7 }}>AIが書籍プロファイル草案から検索キーワード候補10個を生成し、Amazon Kindle の実データで3軸スコアリング（需要・競合の弱さ・意図合致）。1〜2個に絞り込んでSTEP3「競合レビュー評価」へ進みます。</p>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      {/* 著者プロファイル / 書籍プロファイル草案の存在チェック */}
      <Card style={{ marginBottom: 16, background: hasAuthorProfile ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasAuthorProfile ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
          📌 著者プロファイル：{hasAuthorProfile ? "✓ 設定済み（自動転記）" : "⚠ 未設定"}
        </div>
        {hasAuthorProfile && (
          <button onClick={() => setAuthorPreviewOpen(!authorPreviewOpen)} style={{ background: "none", border: `1px solid ${C.border}`, padding: "3px 10px", borderRadius: 4, fontSize: 11.5, color: C.navy, cursor: "pointer" }}>
            {authorPreviewOpen ? "閉じる" : "プレビュー"}
          </button>
        )}
        {authorPreviewOpen && hasAuthorProfile && (
          <div style={{ marginTop: 8, padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
            {savedAuthorProfile}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 24, background: hasDraft ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasDraft ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
          📋 書籍プロファイル草案（STEP1）：{hasDraft ? "✓ 設定済み（自動転記）" : "⚠ 未設定"}
        </div>
        {hasDraft ? (
          <div>
            <button onClick={() => setDraftPreviewOpen(!draftPreviewOpen)} style={{ background: "none", border: `1px solid ${C.border}`, padding: "3px 10px", borderRadius: 4, fontSize: 11.5, color: C.navy, cursor: "pointer" }}>
              {draftPreviewOpen ? "閉じる" : "プレビュー"}
            </button>
            {draftPreviewOpen && (
              <div style={{ marginTop: 8, padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                {savedWorkProfileDraft}
              </div>
            )}
          </div>
        ) : (
          <div>
            <BtnPrimary onClick={() => onNavigate("step_1")}>STEP1で書籍プロファイル草案を生成する →</BtnPrimary>
          </div>
        )}
      </Card>

      {/* ① 分析実行 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>キーワード分析を実行する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.8 }}>
            ボタンを押すと、AIがキーワード候補10個を生成→Real-Time Amazon Data API で各キーワードの市場データを並列取得→需要・競合の弱さ・意図合致の3軸でスコアリングします。1〜2分かかります。
          </div>
          <BtnPrimary onClick={handleRunAnalysis} disabled={isRunning || !hasAuthorProfile || !hasDraft}>
            {isRunning ? "分析中..." : "▶ キーワード分析を実行"}
          </BtnPrimary>
          {isRunning && stageMsg && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12.5, color: C.navy, fontWeight: 600 }}>
              ⏳ {stageMsg}
            </div>
          )}
          {runError && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
          {Array.isArray(analysis?.warnings) && analysis.warnings.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff8e1", border: `1px solid ${C.gold}`, borderRadius: 4, fontSize: 12, color: C.navyMid, lineHeight: 1.7 }}>
              <strong>⚠ 警告：</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
                {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* ② 分析結果表示 */}
      {analysis && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="②" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>分析結果（スコア表＋AI総合判定）</h2>
          </div>
          <Card style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word", fontFamily: "inherit", fontSize: 13, lineHeight: 1.85, color: C.text }}>{analysis.judgment_text || "（出力なし）"}</pre>
          </Card>
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <BtnPrimary onClick={handleSaveAnalysis}>分析結果＋選定キーワードを保存</BtnPrimary>
            {saveMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました（次回もここから再開できます）</span>}
            <span style={{ fontSize: 11.5, color: C.textLight }}>※ 分析実行直後にも自動保存されています</span>
          </div>
        </div>
      )}

      {/* ③ AI判定アシスト：戻り推奨 or 進行推奨 */}
      {analysis && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="③" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>AI判定アシスト</h2>
          </div>
          {recommendsReturn && (
            <Card style={{ background: "#fff8e1", border: `1px solid ${C.gold}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>⚠ STEP1に戻ってコンセプトを調整することを推奨します</div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>
                合計スコア18点以上の推奨キーワードが0個でした。市場検証からのフィードバック（上の②に含まれます）を踏まえて、STEP1で草案を修正してから再度STEP2を実行してください。フィードバックは戻り先のSTEP1で表示されます。
              </div>
              <BtnPrimary onClick={handleReturnToStep1}>← STEP1に戻る（フィードバックを引き継ぐ）</BtnPrimary>
            </Card>
          )}
          {recommendsProceed && (
            <Card style={{ background: "#eef7ee", border: `1px solid ${C.green}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 6 }}>✓ STEP3「競合レビュー評価」へ進むことを推奨します</div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7 }}>
                推奨キーワードが1個以上ありました。下の④で1〜2個を選定してSTEP3へ進んでください。
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ④ キーワード選定 UI */}
      {analysis && generatedKeywords.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="④" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>キーワードを選定（1〜2個）</h2>
          </div>
          <Card style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 10, lineHeight: 1.7 }}>
              STEP3「競合レビュー評価」で深掘りするキーワードを最大2個まで選択してください。AIが「★AI推奨」マークを付けたものを優先的に選ぶのがおすすめです。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {generatedKeywords.map((kw) => {
                const isSelected = selectedKeywords.includes(kw);
                const atMax = !isSelected && selectedKeywords.length >= 2;
                return (
                  <label key={kw} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: atMax ? C.textLight : C.text, cursor: atMax ? "not-allowed" : "pointer", padding: "6px 10px", borderRadius: 4, background: isSelected ? "rgba(184,146,42,0.08)" : "transparent", border: `1px solid ${isSelected ? C.gold : "transparent"}` }}>
                    <input type="checkbox" checked={isSelected} disabled={atMax} onChange={() => handleToggleKeyword(kw)} style={{ cursor: atMax ? "not-allowed" : "pointer", accentColor: C.gold }} />
                    <span style={{ fontFamily: "monospace", fontSize: 13.5 }}>{kw}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: C.textLight }}>
              選定中: {selectedKeywords.length}/2 個
            </div>
          </Card>
        </div>
      )}

      {/* ⑤ 次のアクション */}
      {analysis && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="⑤" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>次のステップ</h2>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <BtnSecondary onClick={handleReturnToStep1}>← STEP1に戻る</BtnSecondary>
            <BtnPrimary onClick={handleProceedToStep3} disabled={selectedKeywords.length === 0}>
              STEP3「競合レビュー評価」へ進む →
            </BtnPrimary>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.textLight, lineHeight: 1.7 }}>
            ※ 新STEP2には外部AI相談機能（DiscussionPanel）はありません。客観データ分析のため、上のAI判定アシストが相談機能の代替として機能します（v4設計）。
          </div>
        </div>
      )}
    </div>
  );
};

// v4新規：新STEP3「競合レビュー評価」のページコンポーネント。
// STEP2 で選定したキーワードの上位本3冊の Amazon レビューを Node オーケストレータ (api/step3.js)
// 経由で取得し、Dify LLM で読者の共通不満点・差別化ポイント・落とし穴を分析する。
// 相談機能（DiscussionPanel）は無し（v4 §9-2 のとおり、客観データ分析のためAI判定アシストで代替）。
// 確定アクション（優先度4）への遷移は本ページ完了後に行う。
const Step3Page = ({ savedAuthorProfile, savedWorkProfileDraft, onNavigate, project }) => {
  // STEP2 関連データの取得（無ければ STEP2 へ戻る案内）
  const step2Analysis = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP2_ANALYSIS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const selectedKeywords = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP2_SELECTED_KEYWORDS_KEY) : null;
      return raw ? (JSON.parse(raw) || []) : [];
    } catch { return []; }
  })();
  // STEP1 入力欄から publishing_goal を再構築
  const savedPublishingGoal = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP1_INPUTS_KEY) : null;
      if (!raw) return "";
      const parsed = JSON.parse(raw) || {};
      return buildPublishingGoalText(parsed.publishingGoals || [], parsed.customPublishingGoal || "");
    } catch { return ""; }
  })();

  // 既存の STEP3 分析結果（あれば復元）
  const initialAnalysis = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP3_ANALYSIS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [stageMsg, setStageMsg] = useState("");

  const hasDraft = !!(savedWorkProfileDraft || "").trim();
  const hasSelectedKeywords = Array.isArray(selectedKeywords) && selectedKeywords.length > 0;
  const hasStep2Data = !!step2Analysis && Array.isArray(step2Analysis.scored);

  // STEP2 の選定キーワードに紐づく上位本データを取得（api/step3.js への入力用）
  const selectedBooks = useMemo(() => {
    if (!hasStep2Data || !hasSelectedKeywords) return [];
    const scored = step2Analysis.scored || [];
    const books = [];
    for (const kw of selectedKeywords) {
      const entry = scored.find((s) => s.keyword === kw);
      if (entry && Array.isArray(entry.top_books)) {
        for (const b of entry.top_books) {
          if (b && b.asin && !books.find((x) => x.asin === b.asin)) {
            books.push({ ...b, is_released: true });
          }
        }
      }
    }
    return books;
  }, [hasStep2Data, hasSelectedKeywords, selectedKeywords, step2Analysis]);

  const canRunAnalysis = hasDraft && hasSelectedKeywords && selectedBooks.length > 0;

  const handleRunAnalysis = async () => {
    setRunError("");
    if (!canRunAnalysis) {
      setRunError("STEP3を実行するには、書籍プロファイル草案・STEP2 選定キーワード・上位本データの3つが必要です。");
      return;
    }
    setIsRunning(true);
    setStageMsg("競合本3冊のAmazonレビューを並列取得中…");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);
    const stageTicker = setTimeout(() => setStageMsg("レビューデータをLLMで分析中（不満点・差別化抽出）…"), 12000);
    try {
      const response = await fetch("/api/step3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          work_profile_draft: savedWorkProfileDraft || "",
          author_profile: savedAuthorProfile || "",
          publishing_goal: savedPublishingGoal || "",
          selected_keywords: selectedKeywords,
          selected_books: selectedBooks,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        setRunError(`サーバから非JSON応答（${response.status}）：${text.slice(0, 300)}`);
        return;
      }
      if (!response.ok) {
        const missing = Array.isArray(data?.missingEnv) && data.missingEnv.length > 0
          ? `\n\n未設定の環境変数：${data.missingEnv.join(", ")}\n→ Vercelの環境変数設定をご確認ください。`
          : "";
        setRunError((data?.error || `HTTP ${response.status} エラー`) + missing);
        return;
      }
      setAnalysis(data);
      try { localStorage.setItem(STEP3_ANALYSIS_KEY, JSON.stringify(data)); } catch (e) {}
    } catch (e) {
      if (e.name === "AbortError") {
        setRunError("4分以上応答がなかったため処理を中断しました。もう一度「深掘り分析実行」を押してみてください。");
      } else {
        setRunError(`通信エラーが発生しました：${e.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(stageTicker);
      setStageMsg("");
      setIsRunning(false);
    }
  };

  const handleReturnToStep1 = () => {
    const content = analysis?.return_feedback_for_step1 || analysis?.analysis_text || "";
    if (!content.trim()) {
      try { localStorage.removeItem(RETURN_FEEDBACK_KEY); } catch (e) {}
    } else {
      const payload = { from: "STEP3", content, generated_at: new Date().toISOString() };
      try { localStorage.setItem(RETURN_FEEDBACK_KEY, JSON.stringify(payload)); } catch (e) { console.error(e); }
    }
    onNavigate("step_1");
  };

  // v4: 「書籍プロファイル確定アクション」専用画面へ遷移
  const handleProceedToConfirm = () => {
    onNavigate("step_confirm");
  };

  const recommendsReturn = analysis?.ai_recommendation === "return_to_step1";
  const recommendsProceed = analysis?.ai_recommendation === "proceed_to_confirmation";

  // 分析結果を localStorage に再保存（手動）
  const [saveMsg, setSaveMsg] = useState(false);
  const handleSaveAnalysis = () => {
    try {
      if (analysis) localStorage.setItem(STEP3_ANALYSIS_KEY, JSON.stringify(analysis));
      setSaveMsg(true);
      setTimeout(() => setSaveMsg(false), 2500);
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>STEP 3</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>競合レビュー評価</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0, lineHeight: 1.7 }}>STEP2で選定したキーワードの上位本3冊のAmazonレビューを取得・分析し、読者の共通不満点・差別化ポイント・落とし穴を抽出します。差別化ポイントが3個以上なら確定アクションへ、2個以下ならSTEP1に戻ってコンセプトを調整しましょう。</p>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      {/* 前提条件チェック */}
      <Card style={{ marginBottom: 16, background: hasDraft ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasDraft ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
          📋 書籍プロファイル草案（STEP1）：{hasDraft ? "✓ 設定済み" : "⚠ 未設定"}
        </div>
        {!hasDraft && (
          <BtnPrimary onClick={() => onNavigate("step_1")}>STEP1で書籍プロファイル草案を生成する →</BtnPrimary>
        )}
      </Card>

      <Card style={{ marginBottom: 16, background: hasSelectedKeywords ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasSelectedKeywords ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
          🔑 STEP2で選定したキーワード：{hasSelectedKeywords ? `✓ ${selectedKeywords.length}個` : "⚠ 未選定"}
        </div>
        {hasSelectedKeywords ? (
          <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7 }}>
            {selectedKeywords.map((k) => <span key={k} style={{ display: "inline-block", padding: "2px 8px", margin: "2px 4px 2px 0", background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "monospace" }}>{k}</span>)}
          </div>
        ) : (
          <BtnPrimary onClick={() => onNavigate("step_2")}>STEP2でキーワードを絞り込む →</BtnPrimary>
        )}
      </Card>

      {/* 分析対象本 */}
      {selectedBooks.length > 0 && (
        <Card style={{ marginBottom: 24, background: C.white, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
            📚 分析対象（上位3冊のレビューを取得します）
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.text, lineHeight: 1.85 }}>
            {selectedBooks.slice(0, 3).map((b) => (
              <li key={b.asin}>{b.product_title || "（タイトル不明）"} <span style={{ color: C.textLight, fontFamily: "monospace" }}>(ASIN: {b.asin})</span></li>
            ))}
          </ul>
          {selectedBooks.length > 3 && (
            <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 8 }}>※ 全 {selectedBooks.length} 冊の候補からレビュー数の多い順に上位3冊を分析対象にします</div>
          )}
        </Card>
      )}

      {/* ① 分析実行 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>深掘り分析を実行する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.8 }}>
            ボタンを押すと、上位3冊のAmazonレビューを並列取得→★分布と本文をLLMで分析→「読者の共通不満点／既存本がカバーできていない切り口／本企画が差別化できるポイント／注意すべき落とし穴」を抽出します。1〜2分かかります。
          </div>
          <BtnPrimary onClick={handleRunAnalysis} disabled={isRunning || !canRunAnalysis}>
            {isRunning ? "分析中..." : "▶ 深掘り分析を実行"}
          </BtnPrimary>
          {isRunning && stageMsg && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12.5, color: C.navy, fontWeight: 600 }}>
              ⏳ {stageMsg}
            </div>
          )}
          {runError && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
          {Array.isArray(analysis?.warnings) && analysis.warnings.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff8e1", border: `1px solid ${C.gold}`, borderRadius: 4, fontSize: 12, color: C.navyMid, lineHeight: 1.7 }}>
              <strong>⚠ 警告：</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
                {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* ② 分析結果 */}
      {analysis && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="②" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>分析結果（不満点／差別化ポイント／落とし穴）</h2>
          </div>
          <Card style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word", fontFamily: "inherit", fontSize: 13, lineHeight: 1.85, color: C.text }}>{analysis.analysis_text || "（出力なし）"}</pre>
          </Card>
          {Number.isFinite(analysis.differentiation_count) && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textLight }}>抽出された差別化ポイント数: <strong style={{ color: C.navy }}>{analysis.differentiation_count} 個</strong></div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <BtnPrimary onClick={handleSaveAnalysis}>分析結果を保存</BtnPrimary>
            {saveMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました（次回もここから再開できます）</span>}
            <span style={{ fontSize: 11.5, color: C.textLight }}>※ 分析実行直後にも自動保存されています</span>
          </div>
        </div>
      )}

      {/* ③ AI判定アシスト */}
      {analysis && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="③" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>AI判定アシスト</h2>
          </div>
          {recommendsReturn && (
            <Card style={{ background: "#fff8e1", border: `1px solid ${C.gold}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>⚠ STEP1に戻ってコンセプトを調整することを推奨します</div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>
                差別化ポイントが {analysis.differentiation_count || 0} 個と少なめでした。市場検証からのフィードバックを踏まえてSTEP1で草案を修正→STEP2/3を再実行することを推奨します。フィードバックは戻り先のSTEP1で表示されます。
              </div>
              <BtnPrimary onClick={handleReturnToStep1}>← STEP1に戻る（フィードバックを引き継ぐ）</BtnPrimary>
            </Card>
          )}
          {recommendsProceed && (
            <Card style={{ background: "#eef7ee", border: `1px solid ${C.green}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 6 }}>✓ 書籍プロファイル確定アクションへ進むことを推奨します</div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7 }}>
                差別化ポイントが {analysis.differentiation_count || 0} 個明確に抽出できました。書籍プロファイル確定版を生成して STEP4 以降の制作フェーズに進みましょう。
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ④ 次のアクション */}
      {analysis && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StepBadge num="④" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>次のステップ</h2>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <BtnSecondary onClick={handleReturnToStep1}>← STEP1に戻る</BtnSecondary>
            <BtnSecondary onClick={() => onNavigate("step_2")}>← STEP2に戻る</BtnSecondary>
            <BtnPrimary onClick={handleProceedToConfirm} disabled={!recommendsProceed}>
              書籍プロファイル確定アクションへ →
            </BtnPrimary>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.textLight, lineHeight: 1.7 }}>
            ※ STEP3には外部AI相談機能（DiscussionPanel）はありません。客観データ分析のため、上のAI判定アシストが相談機能の代替として機能します（v4設計）。<br />
            ※ 「書籍プロファイル確定アクション」では STEP1主観コンセプト × STEP2/3客観データ を統合した確定版を生成し、外部AIで最終レビューしてからSTEP4以降の制作フェーズに進めます。
          </div>
        </div>
      )}

      {/* 分析が未実行の場合のフォールバック導線 */}
      {!analysis && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BtnSecondary onClick={() => onNavigate("step_2")}>← STEP2に戻る</BtnSecondary>
          <BtnSecondary onClick={() => onNavigate("step_1")}>← STEP1に戻る</BtnSecondary>
        </div>
      )}
    </div>
  );
};

// v4新規：書籍プロファイル確定アクションのページコンポーネント。
// STEP3 完了後、受講生の明示的なボタン押下によって、書籍プロファイル確定版を生成する。
// STEP1草案+STEP2選定キーワード+上位本+STEP3分析 を api/work-profile-confirm.js で統合。
// プレビュー画面で受講生が編集可能。「保存」で確定 → STEP4へ進む。
// 相談機能 DiscussionPanel あり（stepNum="confirm"、6観点）。
// v4実装指示書 §6 を参照。
const ConfirmActionPage = ({ savedAuthorProfile, savedWorkProfileDraft, onSaveWorkProfileConfirmed, savedWorkProfileConfirmed, onNavigate, project }) => {
  // 前提データ取得
  const step2Analysis = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP2_ANALYSIS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const selectedKeywords = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP2_SELECTED_KEYWORDS_KEY) : null;
      return raw ? (JSON.parse(raw) || []) : [];
    } catch { return []; }
  })();
  const step3Analysis = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP3_ANALYSIS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const savedPublishingGoal = (() => {
    try {
      const raw = (typeof window !== "undefined") ? localStorage.getItem(STEP1_INPUTS_KEY) : null;
      if (!raw) return "";
      const parsed = JSON.parse(raw) || {};
      return buildPublishingGoalText(parsed.publishingGoals || [], parsed.customPublishingGoal || "");
    } catch { return ""; }
  })();

  // STEP2 の選定キーワードに紐づく上位本（コンテキスト用・最大10冊）
  const selectedBooksForContext = useMemo(() => {
    if (!step2Analysis || !Array.isArray(step2Analysis.scored)) return [];
    const books = [];
    for (const kw of selectedKeywords) {
      const entry = step2Analysis.scored.find((s) => s.keyword === kw);
      if (entry && Array.isArray(entry.top_books)) {
        for (const b of entry.top_books) {
          if (b && b.asin && !books.find((x) => x.asin === b.asin)) {
            books.push(b);
          }
        }
      }
    }
    return books;
  }, [step2Analysis, selectedKeywords]);

  const [confirmedText, setConfirmedText] = useState(savedWorkProfileConfirmed || "");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [saveMsg, setSaveMsg] = useState(false);

  const hasDraft = !!(savedWorkProfileDraft || "").trim();
  const hasSelectedKeywords = Array.isArray(selectedKeywords) && selectedKeywords.length > 0;
  const hasStep3Analysis = !!step3Analysis && !!step3Analysis.analysis_text;
  const canGenerateConfirmed = hasDraft && hasSelectedKeywords && hasStep3Analysis;

  const handleGenerateConfirmed = async () => {
    setRunError("");
    if (!canGenerateConfirmed) {
      setRunError("確定版を生成するには、STEP1草案・STEP2選定キーワード・STEP3分析結果の3つすべてが必要です。前提条件を満たしてから再実行してください。");
      return;
    }
    setIsRunning(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);
    try {
      const response = await fetch("/api/work-profile-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          work_profile_draft: savedWorkProfileDraft || "",
          author_profile: savedAuthorProfile || "",
          publishing_goal: savedPublishingGoal || "",
          selected_keywords: selectedKeywords,
          selected_books_for_context: selectedBooksForContext,
          step3_analysis_text: step3Analysis.analysis_text || "",
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        setRunError(`サーバから非JSON応答（${response.status}）：${text.slice(0, 300)}`);
        return;
      }
      if (!response.ok) {
        const missing = Array.isArray(data?.missingEnv) && data.missingEnv.length > 0
          ? `\n\n未設定の環境変数：${data.missingEnv.join(", ")}\n→ Vercelの環境変数設定をご確認ください。`
          : "";
        setRunError((data?.error || `HTTP ${response.status} エラー`) + missing);
        return;
      }
      setConfirmedText(data.work_profile_final || "");
    } catch (e) {
      if (e.name === "AbortError") {
        setRunError("4分以上応答がなかったため処理を中断しました。もう一度ボタンを押してみてください。");
      } else {
        setRunError(`通信エラーが発生しました：${e.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsRunning(false);
    }
  };

  // 確定版だけ保存（STEP4 へ進まない・編集→保存→外部AIで再相談のループに使う）
  const handleSaveOnly = async () => {
    const cleaned = cleanOutputText(confirmedText);
    if (!cleaned.trim()) {
      setRunError("確定版が空のままです。先に「確定版を生成」を実行してください。");
      return;
    }
    setRunError("");
    if (cleaned !== confirmedText) setConfirmedText(cleaned);
    await onSaveWorkProfileConfirmed(cleaned);
    setSaveMsg(true);
    setTimeout(() => setSaveMsg(false), 2500);
  };

  const handleSaveAndProceed = async () => {
    const cleaned = cleanOutputText(confirmedText);
    if (!cleaned.trim()) {
      setRunError("確定版が空のままです。先に「確定版を生成」を実行してください。");
      return;
    }
    setRunError("");
    if (cleaned !== confirmedText) setConfirmedText(cleaned);
    await onSaveWorkProfileConfirmed(cleaned);
    setSaveMsg(true);
    setTimeout(() => {
      setSaveMsg(false);
      onNavigate("step_4");
    }, 1500);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>CONFIRM ACTION</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>書籍プロファイル確定アクション</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0, lineHeight: 1.7 }}>STEP1の主観コンセプトとSTEP2/3の客観データを統合し、STEP4以降のすべてのSTEPが参照する「書籍プロファイル確定版」を生成します。確定後は STEP4 エピソードインタビュー以降の制作フェーズに進めます。</p>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      {/* 前提条件チェック */}
      <Card style={{ marginBottom: 16, background: hasDraft ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasDraft ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>📋 STEP1 書籍プロファイル草案：{hasDraft ? "✓ 設定済み" : "⚠ 未設定"}</div>
        {!hasDraft && <BtnPrimary onClick={() => onNavigate("step_1")}>STEP1へ →</BtnPrimary>}
      </Card>
      <Card style={{ marginBottom: 16, background: hasSelectedKeywords ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasSelectedKeywords ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>🔑 STEP2 選定キーワード：{hasSelectedKeywords ? `✓ ${selectedKeywords.length}個（${selectedKeywords.join("、")}）` : "⚠ 未選定"}</div>
        {!hasSelectedKeywords && <BtnPrimary onClick={() => onNavigate("step_2")}>STEP2へ →</BtnPrimary>}
      </Card>
      <Card style={{ marginBottom: 24, background: hasStep3Analysis ? "#eef7ee" : "#fff7e6", border: `1px solid ${hasStep3Analysis ? "#c8d4c8" : "#e0c8a0"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>📝 STEP3 競合レビュー分析：{hasStep3Analysis ? `✓ 設定済み（差別化ポイント ${step3Analysis.differentiation_count || "?"} 個）` : "⚠ 未実行"}</div>
        {!hasStep3Analysis && <BtnPrimary onClick={() => onNavigate("step_3")}>STEP3へ →</BtnPrimary>}
      </Card>

      {/* ① 確定版生成 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>確定版を生成する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.8 }}>
            STEP1草案 + STEP2選定キーワード + STEP3分析結果を AI が統合し、後段STEP4〜10 がそのまま参照できる「書籍プロファイル確定版」をマークダウン構造で生成します。30秒〜1分かかります。
          </div>
          <BtnPrimary onClick={handleGenerateConfirmed} disabled={isRunning || !canGenerateConfirmed}>
            {isRunning ? "生成中..." : "▶ 書籍プロファイル確定版を生成"}
          </BtnPrimary>
          {runError && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
        </Card>
      </div>

      {/* ② プレビュー・編集 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="②" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>確定版プレビュー（編集可能）</h2>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8, lineHeight: 1.7 }}>
          AIが生成した確定版を確認してください。受講生の判断で内容を編集できます。マークダウン構造（## 見出し）は崩さないでください（後段STEPが見出しで構造抽出するため）。
        </div>
        <textarea value={confirmedText} onChange={(e) => setConfirmedText(e.target.value)}
          rows={24}
          placeholder="確定版生成後にここにマークダウンが表示されます。手動編集も可能です。"
          style={{ width: "100%", padding: "12px 14px", fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.85 }} />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveOnly} disabled={!confirmedText.trim()}>確定版を保存（STEP4に進まない）</BtnPrimary>
          {saveMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました</span>}
          <span style={{ fontSize: 11.5, color: C.textLight }}>※ 外部AI相談 → textarea で編集 → 保存 → 再相談 のループに使えます</span>
        </div>
      </div>

      {/* ③ 外部AI相談（v4新規・確定アクション専用6観点） */}
      <DiscussionPanel
        stepNum="confirm"
        stepName="書籍プロファイル確定アクション"
        stepOutput={confirmedText}
        authorProfile={savedAuthorProfile || ""}
        workProfile={savedWorkProfileDraft || ""}
      />

      {/* ④ 保存して次STEPへ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="④" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>確定して次STEPへ進む</h2>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BtnSecondary onClick={() => onNavigate("step_3")}>← STEP3に戻る</BtnSecondary>
          <BtnSecondary onClick={() => onNavigate("step_1")}>← STEP1に戻る</BtnSecondary>
          <BtnPrimary onClick={handleSaveAndProceed} disabled={!confirmedText.trim()}>
            書籍プロファイルを確定保存してSTEP4へ進む →
          </BtnPrimary>
        </div>
        {saveMsg && <div style={{ marginTop: 8, fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 確定版を保存しました。STEP4に移動します...</div>}
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.textLight, lineHeight: 1.7 }}>
          ※ 保存すると STEP4 エピソードインタビュー以降のすべてのSTEPがこの確定版を「書籍プロファイル」として参照するようになります。<br />
          ※ 保存後も本ページに戻れば内容を修正・再生成できますが、STEP4 以降の出力には反映されない場合があります。
        </div>
      </div>
    </div>
  );
};

// STEP5専用（v4で「STEP4」から番号繰り上げ）：「タイトル・サブタイトルを確定する」UI。
// 想定する2つのワークフロー：
//   A. 3案出す → 外部AIで相談 → 1案に決める → 出力欄に貼り付け（1案構造）
//      → 出力全体からタイトル/サブタイトルを直接抽出してプレフィル
//   B. 3案出す → そのまま採用案を選ぶ（3案構造）
//      → 案ボタンで選択
// どちらのフォーマットでも対応。完全手動入力もできる。
// 確定後はSTEP6以降の入力欄（title_text / subtitle_text）に自動転記される。
// 注：コンポーネント名は Step4ConfirmPanel のままにしている（履歴との混乱を避けるため）。
// 機能は STEP5 タイトル・サブタイトル作成の確定 UI。
const Step4ConfirmPanel = ({ outputText }) => {
  // 3案構造としてパースを試みる（成功すれば案ボタン表示）
  const parsed = useMemo(() => parseStep4CaseStructure(outputText), [outputText]);
  // 1案構造（AI議論後の結果）として直接抽出を試みる（パース失敗時のフォールバック）
  const singleExtracted = useMemo(() => {
    if (parsed) return null;
    if (!outputText) return null;
    const r = extractTitleSubtitleFromStep4Case(outputText);
    return (r.title || r.subtitle) ? r : null;
  }, [outputText, parsed]);

  // 既に確定済みの内容を初期表示
  const initialTitle = (typeof window !== "undefined") ? (localStorage.getItem(TITLE_CONFIRMED_KEY) || "") : "";
  const initialSubtitle = (typeof window !== "undefined") ? (localStorage.getItem(SUBTITLE_CONFIRMED_KEY) || "") : "";

  const [selectedCase, setSelectedCase] = useState(null); // "1" | "2" | "3" | null
  const [titleInput, setTitleInput] = useState(initialTitle);
  const [subtitleInput, setSubtitleInput] = useState(initialSubtitle);
  const [savedMsg, setSavedMsg] = useState(false);
  const [autoFilledFromSingle, setAutoFilledFromSingle] = useState(false);

  // 1案構造でタイトル/サブタイトルが抽出できた場合、入力欄が空ならプレフィル。
  // 既に手動入力された値は上書きしない。
  useEffect(() => {
    if (!singleExtracted) return;
    let filled = false;
    if (singleExtracted.title && !titleInput) { setTitleInput(singleExtracted.title); filled = true; }
    if (singleExtracted.subtitle && !subtitleInput) { setSubtitleInput(singleExtracted.subtitle); filled = true; }
    if (filled) setAutoFilledFromSingle(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleExtracted]);

  // 案ボタンを押したら、その案からタイトル/サブタイトルを抽出してプレフィル
  const handleSelectCase = (caseNum) => {
    setSelectedCase(caseNum);
    if (parsed && parsed.cases[caseNum]) {
      const { title, subtitle } = extractTitleSubtitleFromStep4Case(parsed.cases[caseNum]);
      if (title) setTitleInput(title);
      if (subtitle) setSubtitleInput(subtitle);
    }
  };

  const handleConfirm = () => {
    if (!titleInput.trim() || !subtitleInput.trim()) {
      alert("タイトルとサブタイトルの両方を入力してください。");
      return;
    }
    try {
      localStorage.setItem(TITLE_CONFIRMED_KEY, titleInput.trim());
      localStorage.setItem(SUBTITLE_CONFIRMED_KEY, subtitleInput.trim());
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {
      alert("確定の保存に失敗しました。ブラウザのストレージ容量を確認してください。");
    }
  };

  const isConfirmed = !!(initialTitle && initialSubtitle);
  const totalLen = (titleInput || "").length + (subtitleInput || "").length;
  const isOverLimit = totalLen > 200;

  return (
    <div style={{ marginTop: 24, marginBottom: 16, padding: 16, border: `2px solid ${C.gold}`, borderRadius: 6, background: C.goldPale }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>⭐ 採用する案を確定する</span>
        {isConfirmed && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 確定済み（STEP5以降に自動転記されます）</span>}
      </div>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.7 }}>
        STEP5（目次）以降では、ここで確定したタイトル・サブタイトルが本の核となります。
        3案から1つ選ぶか、自分で書いた内容を直接入力してください。
      </div>

      {/* パターンB: 3案構造を検出 → 案ボタン表示 */}
      {parsed && (
        <>
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 8 }}>
            ✓ 3案構造を検出しました。下のボタンで採用する案を選んでください。
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {["1", "2", "3"].map((n) => (
              <button key={n} onClick={() => handleSelectCase(n)}
                style={{
                  fontSize: 13, fontWeight: 600,
                  color: selectedCase === n ? C.white : C.gold,
                  background: selectedCase === n ? C.gold : C.white,
                  border: `1.5px solid ${C.gold}`,
                  borderRadius: 3, padding: "8px 16px", cursor: "pointer",
                }}>
                📋 案{n}を採用
              </button>
            ))}
          </div>
        </>
      )}

      {/* パターンA: 1案構造（AI議論後の貼り付け）→ 自動抽出済みのお知らせ */}
      {!parsed && autoFilledFromSingle && (
        <div style={{ padding: "8px 12px", background: C.greenLight, border: `1px solid rgba(45,122,79,0.25)`, borderRadius: 3, fontSize: 12.5, color: C.green, marginBottom: 10, fontWeight: 600 }}>
          ✓ 出力欄から「メインタイトル」「サブタイトル」を自動取得しました。内容を確認して、必要なら編集してから確定してください。
        </div>
      )}

      {/* 抽出は成功したが既存値があり上書きされなかった → 上書きボタンを提示 */}
      {!parsed && !autoFilledFromSingle && singleExtracted && (
        ((singleExtracted.title && singleExtracted.title !== titleInput) ||
         (singleExtracted.subtitle && singleExtracted.subtitle !== subtitleInput)) && (
          <div style={{ padding: "10px 12px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 3, fontSize: 12.5, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ lineHeight: 1.7 }}>
              📋 出力欄から新しいタイトル／サブタイトルを検出しました（下の欄には前回の確定値が残っています）。上書きしますか？
            </div>
            <button onClick={() => {
              if (singleExtracted.title) setTitleInput(singleExtracted.title);
              if (singleExtracted.subtitle) setSubtitleInput(singleExtracted.subtitle);
              setAutoFilledFromSingle(true);
            }} style={{
              fontSize: 12.5, fontWeight: 700, color: C.white, background: C.gold,
              border: "none", borderRadius: 3, padding: "7px 14px", cursor: "pointer", flexShrink: 0,
            }}>
              📥 出力欄の値で上書き
            </button>
          </div>
        )
      )}

      {/* どちらでもない: 完全手動入力を促す（抽出本当に失敗のときだけ表示） */}
      {!parsed && !singleExtracted && outputText && (
        <div style={{ padding: "8px 12px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12.5, color: C.textSub, marginBottom: 10 }}>
          ※ 出力欄からタイトル・サブタイトルを自動取得できませんでした。下のフォームに手動で入力してください。
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: C.navy, display: "block", marginBottom: 4 }}>メインタイトル</label>
        <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)}
          placeholder="案ボタンで自動入力、または手動で入力"
          style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", background: C.white }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: C.navy, display: "block", marginBottom: 4 }}>サブタイトル</label>
        <input type="text" value={subtitleInput} onChange={(e) => setSubtitleInput(e.target.value)}
          placeholder="案ボタンで自動入力、または手動で入力"
          style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", background: C.white }} />
      </div>

      <div style={{ fontSize: 12, color: isOverLimit ? C.red : C.textLight, marginBottom: 10 }}>
        合計文字数: {totalLen} / 200（Amazon KDP制限）{isOverLimit && " ← 超過しています"}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={handleConfirm}
          disabled={!titleInput.trim() || !subtitleInput.trim()}
          style={{
            fontSize: 13, fontWeight: 700, color: C.white,
            background: (titleInput.trim() && subtitleInput.trim()) ? C.gold : "rgba(0,0,0,0.15)",
            border: "none", borderRadius: 3, padding: "10px 22px",
            cursor: (titleInput.trim() && subtitleInput.trim()) ? "pointer" : "default",
          }}>
          ⭐ タイトル・サブタイトルを確定する
        </button>
        {savedMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 確定しました（STEP5以降で利用できます）</span>}
      </div>
    </div>
  );
};

const StepPage = ({ step, stepData, project, onNavigate, onSaveInput, onSaveOutput, onUpdateProject, onInputChange, allSteps, onRefPanel }) => {
  const [inputs, setInputs] = useState(stepData.inputData || {});
  const [outputText, setOutputText] = useState(stepData.outputText || "");
  const [saveInputMsg, setSaveInputMsg] = useState(false);
  const [saveOutputMsg, setSaveOutputMsg] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [charErrors, setCharErrors] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
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
  const [sectionOptions, setSectionOptions] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionProgress, setSectionProgress] = useState(null);
  // STEP7（詳細プロット作成）の章選択用
  const [chapterOptions, setChapterOptions] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  // STEP7 全章一括生成の進捗
  const [chapterStockProgress, setChapterStockProgress] = useState(null);
  // 自動投入済みフィールドの展開状態（デフォルト：折りたたみ）
  const [expandedFields, setExpandedFields] = useState({});
  // フォーカスモード（案ごと表示切替）は、外部AIプロンプト生成方式への移行に伴い廃止しました。
  // 関連していた parseStep4CaseStructure / mergeStep4Case / extractStep4Case ユーティリティ関数は
  // 将来用途のためコード上は維持していますが、ここでは未使用です。

  useEffect(() => {
    setInputs(stepData.inputData || {}); setOutputText(stepData.outputText || "");
    setHelpOpen(false); setValidationErrors([]); setCharErrors({}); setRunError("");
    setMarketOptions([]); setSelectedMarket(null);
    setSectionOptions([]); setSelectedSection(null); setSectionProgress(null);
    setChapterOptions([]); setSelectedChapter(null); setChapterStockProgress(null);
    setChatMessages([]); setChatInput(""); setChatLoading(false);
    setChatConversationId(""); setChatError(""); setChatCopyMsg(false); setChatTransferMsg(false); setChatSelectOptions([]); setChatSelectMsg(false);
    setExpandedFields({});
  }, [step.num]);

  // STEP7/STEP8 専用: ページを開いた瞬間に前STEP出力から章を自動抽出してプレビュー表示する。
  // STEP6 は STEP5（目次）から章を抽出して章ごとに章構成を生成、
  // STEP7 は STEP6（章構成）から章を抽出して章ごとに詳細プロットを生成。
  useEffect(() => {
    if (step.num !== 7 && step.num !== 8) return;
    const srcNum = step.num === 7 ? 6 : 7;
    const srcOutput = allSteps?.[srcNum]?.outputText;
    if (!srcOutput) { setChapterOptions([]); return; }
    const extracted = extractChapters(srcOutput);
    setChapterOptions(extracted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.num, allSteps]);

  // 自動投入: autoFill: true で source 定義のあるフィールドが空欄なら、前STEPの outputText で自動補完。
  // 永続化された stepData.inputData を見て判定する（局所 state の inputs を見ると
  // ページ遷移直後の React state 更新タイミングで誤判定するため）。
  // 既に保存値があれば上書きしない（ユーザーの手動編集を尊重）。
  useEffect(() => {
    if (!step.inputs || !allSteps) return;
    const baseInputs = stepData?.inputData || {};
    const updates = {};
    step.inputs.forEach((field) => {
      if (field.autoFill !== true || !field.source) return;
      if ((baseInputs[field.name] || "").trim()) return; // 永続化された値があればスキップ
      const srcMatch = field.source.match(/^STEP(\d+)$/);
      if (!srcMatch) return;
      const srcNum = parseInt(srcMatch[1], 10);
      const srcOutput = allSteps?.[srcNum]?.outputText;
      if (srcOutput) updates[field.name] = srcOutput;
    });
    if (Object.keys(updates).length === 0) return;
    setInputs((prev) => {
      // 局所 state 側も空欄のものだけ投入（既にユーザーが入力中なら邪魔しない）
      const merged = { ...prev };
      Object.entries(updates).forEach(([k, v]) => {
        if (!(merged[k] || "").trim()) merged[k] = v;
      });
      onInputChange?.(step.num, merged);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.num, allSteps, stepData]);

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
    const cleaned = cleanOutputText(outputText);
    if (cleaned !== outputText) setOutputText(cleaned);
    await onSaveOutput(step.num, cleaned);
    setSaveOutputMsg("saved"); setTimeout(() => setSaveOutputMsg(false), 2000);
  };

  const handleRunDify = async () => {
    if (validateInputs().length > 0) return;
    setIsRunning(true); setRunError("");
    if (step.num === 9) {
      const sectionToRun = selectedSection !== null ? sectionOptions[selectedSection] : null;
      if (!sectionToRun || !sectionToRun.items || sectionToRun.items.length === 0) {
        setRunError("執筆する節が選ばれていません。\n\n上の「📋 STEP8から節を抽出」ボタンを押して、書きたい節を1つ選んでください。");
        setIsRunning(false); return;
      }
      const items = sectionToRun.items; const total = items.length; const results = [];
      try {
        for (let i = 0; i < total; i++) {
          const currentItem = items[i];
          setSectionProgress({ total, current: i + 1, currentItemName: currentItem });
          const response = await fetch("/api/dify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepNum: 9, inputs: { ...getAutoInjectedProfiles(), detailed_plot_text: inputs.detailed_plot_text || "", target_heading: currentItem } }) });
          const data = await response.json();
          if (!response.ok) {
            setRunError(`節の生成中にエラーが発生しました。\n\n${total}項目中、${i + 1}項目目（${currentItem}）の生成で失敗しました。途中までの生成結果は破棄されます。\n\n少し時間をおいてから、もう一度「実行する」を押してください。\n\n（エラー詳細：${data.error || "不明なエラー"}）`);
            setSectionProgress(null); setIsRunning(false); return;
          }
          results.push(data.output || "");
        }
        const cleaned = results.map((out, idx) => stripChapterSection(out, idx === 0));
        setOutputText(cleaned.join("\n\n"));
        await onSaveInput(step.num, { detailed_plot_text: inputs.detailed_plot_text || "", target_section: sectionToRun.sectionTitle });
        setSectionProgress(null);
      } catch (e) {
        setRunError(`通信エラーが発生しました。途中までの生成結果は破棄されました。\n\nインターネット接続を確認して、少し時間をおいてからもう一度「実行する」を押してください。\n\n（エラー詳細：${e.message}）`);
        setSectionProgress(null);
      } finally { setIsRunning(false); }
      return;
    }
    try {
      let execInputs = { ...inputs };
      if (step.num === 2 && execInputs.amazon_html) { const cleaned = cleanHtmlMinimal(execInputs.amazon_html); if (cleaned) execInputs.amazon_html = cleaned; }
      if (step.num >= 3) { execInputs = { ...getAutoInjectedProfiles(), ...execInputs }; }
      const response = await fetch("/api/dify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepNum: step.num, inputs: execInputs }) });
      const data = await response.json();
      sendDebugLog(`RECV STEP${step.num}`, { length: (data.output || "").length, tail: (data.output || "").slice(-30) });
      if (!response.ok) { setRunError(data.error || "実行中にエラーが発生しました。少し時間をおいてからもう一度お試しください。"); }
      else {
        setOutputText(data.output || "");
        await onSaveInput(step.num, execInputs);
        setTimeout(async () => {
          const reloaded = await loadStepData(step.num);
          sendDebugLog(`STORED STEP${step.num}`, { length: (reloaded?.outputText || "").length, tail: (reloaded?.outputText || "").slice(-30) });
        }, 500);
      }
    } catch (e) { setRunError("通信エラーが発生しました。インターネット接続を確認して、少し時間をおいてからもう一度お試しください。"); }
    finally { setIsRunning(false); }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput(""); setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const chatInputs = chatConversationId ? {} : getAutoInjectedProfiles();
      const response = await fetch("/api/dify-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepNum: step.num, message: text, conversation_id: chatConversationId, inputs: chatInputs }) });
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

  // STEP6 専用: 抽出された全章を順次 Dify に投げて、各章の章構成（節リスト＋要約）を生成し
  // outputText に結合して蓄積する。Dify Cloud の iteration ノードが Flask app_context エラーで
  // 動かないため、フロント側でループする STEP7 と同じパターンを採用。
  const handleRunAllChaptersForStep6 = async () => {
    if (step.num !== 6) return;
    if (!chapterOptions || chapterOptions.length === 0) {
      alert("STEP5（目次）の出力から章を検出できませんでした。STEP5の出力をご確認ください。");
      return;
    }
    const interviewText = (inputs.interview_text || "").trim();
    if (!interviewText) {
      alert("「エピソードインタビューのアウトプット」が未入力です。先に STEP3 を完了させて自動投入してください。");
      return;
    }
    if ((outputText || "").trim()) {
      const ok = window.confirm("現在の出力データは上書きされます。続行しますか？");
      if (!ok) return;
    }
    setIsRunning(true);
    setRunError("");
    setChapterStockProgress({ total: chapterOptions.length, current: 0, currentItemName: "" });
    const results = [];
    try {
      for (let i = 0; i < chapterOptions.length; i++) {
        const ch = chapterOptions[i];
        setChapterStockProgress({ total: chapterOptions.length, current: i + 1, currentItemName: ch.chapterTitle });
        const execInputs = {
          ...getAutoInjectedProfiles(),
          // ai-pub-producer のキー名は toc_text、/api/dify.js が refined_toc にマップする。
          // ここには「1章分のテキスト」だけを詰めて送る。
          toc_text: ch.body.trim(),
          interview_text: interviewText,
        };
        const response = await fetch("/api/dify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepNum: 7, inputs: execInputs }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(`「${ch.chapterTitle}」の生成で失敗：${data.error || "不明なエラー"}`);
        }
        const out = (data.output || "").trim();
        if (!out || out.length < 30) {
          throw new Error(`「${ch.chapterTitle}」で有効な出力が返りませんでした（${out.length}文字）`);
        }
        results.push({ title: ch.chapterTitle, content: out });
        if (i < chapterOptions.length - 1) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      const combined = results.map((r) => `=== ${r.title} ===\n\n${r.content}`).join("\n\n---\n\n");
      setOutputText(combined);
      setChapterStockProgress(null);
    } catch (e) {
      setRunError(e.message + "\n\n途中までの結果は破棄されます。少し時間をおいてから「全章を順次生成」をもう一度お試しください。");
      setChapterStockProgress(null);
    } finally {
      setIsRunning(false);
    }
  };

  // STEP7 専用: 抽出された全章を順次 Dify に投げて、結果を outputText に蓄積する。
  // 章間に短いウェイトを入れてレートリミット対策（Anthropic 30K input tokens/min）。
  const handleRunAllChaptersForStep7 = async () => {
    if (step.num !== 8) return;
    if (!chapterOptions || chapterOptions.length === 0) {
      alert("先に「📋 STEP6から章を抽出」を押して章を抽出してください。");
      return;
    }
    // 既存の出力があれば上書き確認
    if ((outputText || "").trim()) {
      const ok = window.confirm("現在の出力データは上書きされます。続行しますか？");
      if (!ok) return;
    }
    setIsRunning(true);
    setRunError("");
    setChapterStockProgress({ total: chapterOptions.length, current: 0, currentItemName: "" });
    const results = [];
    try {
      for (let i = 0; i < chapterOptions.length; i++) {
        const ch = chapterOptions[i];
        setChapterStockProgress({ total: chapterOptions.length, current: i + 1, currentItemName: ch.chapterTitle });
        const execInputs = {
          ...getAutoInjectedProfiles(),
          chapter_outline_text: ch.body.trim(),
        };
        const response = await fetch("/api/dify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepNum: 8, inputs: execInputs }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(`第${i + 1}章「${ch.chapterTitle}」の生成で失敗：${data.error || "不明なエラー"}`);
        }
        const out = (data.output || "").trim();
        if (!out || out.length < 50) {
          throw new Error(`第${i + 1}章「${ch.chapterTitle}」で有効な出力が返りませんでした（${out.length}文字）`);
        }
        results.push({ title: ch.chapterTitle, content: out });
        // レート制御: 最後の章以外は3秒ウェイト
        if (i < chapterOptions.length - 1) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      // 全章を結合（章ごとに区切り目を挿入）
      const combined = results.map((r) => `=== ${r.title} ===\n\n${r.content}`).join("\n\n---\n\n");
      setOutputText(combined);
      setChapterStockProgress(null);
    } catch (e) {
      setRunError(e.message + "\n\n途中までの結果は破棄されます。少し時間をおいてから「全章を順次生成」をもう一度お試しください。");
      setChapterStockProgress(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
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

      {step.num === 1 && (
        <Card style={{ marginBottom: 16, background: C.goldPale, border: `1px solid ${C.goldLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4 }}>すでにキーワードが決まっている方へ</div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7 }}>狙う2語キーワードが明確な場合は、STEP1をスキップしてSTEP2から始められます。</div>
            </div>
            <button onClick={() => onNavigate("step_2")} style={{ fontSize: 12.5, background: C.gold, color: C.white, border: "none", borderRadius: 3, padding: "9px 18px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>STEP2から始める →</button>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 24, background: "#eef2f7", border: `1px solid #c8d4e0` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>このステップの進め方</div>
        <div style={{ fontSize: 13.5, color: "#2a2a2a", lineHeight: 2.1 }}>
          {step.type === "chat" ? (
            <><span style={{ fontWeight: 700, color: C.navy }}>①</span> 下の「入力データ」に情報を入力して保存する<br /><span style={{ fontWeight: 700, color: C.navy }}>②</span> チャット欄でAIと対話する（このページを離れずに会話できます）<br /><span style={{ fontWeight: 700, color: C.navy }}>③</span> 会話が終わったら結果をコピー →「出力データ」に貼り付けて保存する</>
          ) : (
            <><span style={{ fontWeight: 700, color: C.navy }}>①</span> 下の「入力データ」に情報を入力する{step.inputs.some((f) => f.source) && "（前ステップの出力を貼り付け）"}<br /><span style={{ fontWeight: 700, color: C.navy }}>②</span> 「実行する」ボタンを押す → AIが処理して結果が自動で表示される<br /><span style={{ fontWeight: 700, color: C.navy }}>③</span> 出力内容を確認して保存する</>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#555555", marginTop: 8, lineHeight: 1.7 }}>出力はそのまま使うことも、自分で修正したり、AIチャット（Claude・ChatGPT等）で整えてから使うこともできます。</div>
      </Card>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="①" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>入力データ</h2>
        </div>
        {step.num >= 3 && <AutoInjectedProfilesPanel onNavigate={onNavigate} stepNum={step.num} />}
        {validationErrors.length > 0 && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red, fontWeight: 500 }}>必須の項目がまだ空欄です。赤くなっている欄を入力してから、もう一度お試しください。</div>
        )}
        {step.num === 5 && (
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12, padding: "10px 14px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 4, lineHeight: 1.8 }}>
            💡 「検索キーワード1・2」の欄にある<span style={{ fontWeight: 700, color: C.gold }}>「自動振り分け」</span>ボタンを押すと、書籍プロファイル確定版（確定アクションで保存済み）の主要検索キーワードを自動で入力してくれます。
          </div>
        )}
        {step.num !== 5 && step.inputs.some((f) => f.source) && (
          <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12, padding: "8px 12px", background: C.blueLight, border: `1px solid rgba(42,68,104,0.12)`, borderRadius: 4, lineHeight: 1.7 }}>左メニューの「保存データ」から前のステップの出力をコピーし、各欄に貼り付けてください。</div>
        )}

        {step.inputs.map((field) => {
          const hasError = validationErrors.includes(field.name);
          const currentLen = (inputs[field.name] || "").length;
          const isOverLimit = field.maxChars && currentLen > field.maxChars;
          const isKeywordParsedField = step.num === 5 && (field.name === "keyword1" || field.name === "keyword2");
          const handleAutoFillParsed = isKeywordParsedField ? () => {
            // 書籍プロファイル確定版／草案／STEP2全文 から主題軸キーワードを抽出
            const wp = (typeof window !== "undefined")
              ? (localStorage.getItem(WORK_PROFILE_CONFIRMED_KEY) || localStorage.getItem(WORK_PROFILE_KEY) || "")
              : "";
            let parsed = wp ? parseWorkProfileKeywords(wp) : { keyword1: "", keyword2: "" };
            if (!parsed.keyword1 || !parsed.keyword2) {
              const step2Output = allSteps?.[2]?.outputText || "";
              if (step2Output) {
                const fromStep2 = parseStep2Output(step2Output);
                if (!parsed.keyword1) parsed.keyword1 = fromStep2.keyword1 || "";
                if (!parsed.keyword2) parsed.keyword2 = fromStep2.keyword2 || "";
              }
            }
            if (!parsed.keyword1 && !parsed.keyword2) { alert("書籍プロファイル確定版（またはSTEP2出力）からキーワードを抽出できませんでした。\n\nSTEP2を実行して保存してから、もう一度お試しください。"); return; }
            if (field.name === "keyword1") { if (parsed.keyword1) handleInputChange("keyword1", parsed.keyword1); else alert("「主題軸キーワード1」が見つかりませんでした。手動で入力してください。"); }
            if (field.name === "keyword2") { if (parsed.keyword2) handleInputChange("keyword2", parsed.keyword2); else alert("「主題軸キーワード2」が見つかりませんでした。手動で入力してください。"); }
          } : undefined;

          // STEP8「詳細プロット（1章分）」専用UI:
          // STEP8 の全章プロット（=== 第N章 === 区切り）から1章を選択して詳細プロットtextarea に転記する。
          // STEP8 と同じ extractChapters + ChapterSelector を流用。
          if (field.name === "detailed_plot_text") {
            const hasErr = validationErrors.includes(field.name);
            const currentLen = (inputs[field.name] || "").length;
            const isOver = field.maxChars && currentLen > field.maxChars;
            return (
              <div key={field.name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: hasErr ? C.red : C.navy }}>{field.label}</label>
                  {field.required && <RequiredMark />}
                  <SourceLabel source={field.source} autoFill={false} onAutoFill={() => {}}
                    onRef={() => { const s = allSteps?.[8]?.outputText; if (s) onRefPanel({ stepNum: 8, text: s, targetField: "detailed_plot_text" }); else alert("STEP8の出力データがまだ保存されていません。"); }} />
                  {hasErr && <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>← 章を選んでください</span>}
                </div>
                <div style={{ fontSize: 13, color: "#444444", marginBottom: 8 }}>{field.desc}</div>
                <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => {
                    const srcOutput = allSteps?.[7]?.outputText;
                    if (!srcOutput) { alert("STEP8の出力データがまだ保存されていません。\n\nSTEP8を完了して「出力データを保存」ボタンを押してから、もう一度お試しください。"); return; }
                    const extracted = extractChapters(srcOutput);
                    if (extracted.length === 0) { alert("STEP8の出力から「第N章: xxx」「はじめに」「おわりに」形式の章を検出できませんでした。STEP8の出力をもう一度確認してください。"); return; }
                    setChapterOptions(extracted); setSelectedChapter(null); handleInputChange("detailed_plot_text", "");
                    // 章を変えたら節も選び直し
                    setSectionOptions([]); setSelectedSection(null); handleInputChange("target_section", "");
                  }} style={{ fontSize: 12.5, fontWeight: 600, color: C.white, background: C.gold, border: "none", borderRadius: 3, padding: "7px 14px", cursor: "pointer" }}>
                    📋 STEP8から章を抽出
                  </button>
                  {chapterOptions.length > 0 && (
                    <button onClick={() => { setChapterOptions([]); setSelectedChapter(null); handleInputChange("detailed_plot_text", ""); }}
                      style={{ fontSize: 12, color: C.textLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, padding: "6px 12px", cursor: "pointer" }}>
                      抽出結果をクリア
                    </button>
                  )}
                </div>
                {chapterOptions.length > 0 && (
                  <ChapterSelector chapters={chapterOptions} selected={selectedChapter}
                    onSelect={(i, ch) => {
                      setSelectedChapter(i);
                      handleInputChange("detailed_plot_text", ch.body.trim());
                      // 章を選んだら節も選び直し
                      setSectionOptions([]); setSelectedSection(null); handleInputChange("target_section", "");
                    }}
                    onReselect={() => { setSelectedChapter(null); handleInputChange("detailed_plot_text", ""); setSectionOptions([]); setSelectedSection(null); handleInputChange("target_section", ""); }} />
                )}
                {/* 選択後の textarea（編集可） */}
                {(selectedChapter !== null || (inputs[field.name] || "").trim()) && (
                  <div style={{ marginTop: 12 }}>
                    <textarea id={`field-${field.name}`} value={inputs[field.name] || ""} onChange={(e) => { setSelectedChapter(null); handleInputChange(field.name, e.target.value); }}
                      placeholder="選択した章の詳細プロット（編集可能）"
                      rows={8}
                      style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: hasErr ? `2px solid ${C.red}` : isOver ? `2px solid ${C.gold}` : `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: hasErr ? "#fef2f2" : C.white, lineHeight: 1.7 }} />
                    <div style={{ fontSize: 11, color: isOver ? C.red : C.textLight, textAlign: "right", marginTop: 3 }}>
                      {currentLen.toLocaleString()} / {field.maxChars.toLocaleString()}文字
                      {isOver && " ← 上限を超過しています。1章分だけになるよう編集してください。"}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // STEP7「1章分のアウトライン」専用UI:
          // 入力データセクションには「STEP6から自動取得」の案内バナーのみ表示し、
          // 章プレビュー／全章生成ボタン／進捗バーは「②AIで実行する」セクション側に集約する
          // （STEP7 と統一。入力データを保存ボタンとの操作順を自然に保つため）。
          if (field.name === "chapter_outline_text") {
            return (
              <div key={field.name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: C.navy }}>STEP7の章構成（自動取得）</label>
                  <SourceLabel source={field.source} autoFill={false} onAutoFill={() => {}}
                    onRef={() => { const s = allSteps?.[7]?.outputText; if (s) onRefPanel({ stepNum: 7, text: s, targetField: "chapter_outline_text" }); else alert("STEP7の出力データがまだ保存されていません。"); }} />
                </div>
                <div style={{ fontSize: 13, color: "#444444", marginBottom: 4, lineHeight: 1.7 }}>
                  STEP7 の章構成から章を自動で抽出します。全章の詳細プロットは「②AIで実行する」セクションの「🚀 全章を順次生成」ボタンで一括処理してください。
                </div>
                {!allSteps?.[7]?.outputText && (
                  <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginTop: 8, fontSize: 13, color: C.red }}>
                    ⚠ STEP7 の出力データがまだ保存されていません。STEP7 で「出力データを保存」を押してから戻ってきてください。
                  </div>
                )}
                {allSteps?.[7]?.outputText && chapterOptions.length > 0 && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: C.greenLight, border: `1px solid rgba(45,122,79,0.25)`, borderRadius: 3, fontSize: 12.5, color: C.green, fontWeight: 600 }}>
                    ✓ {chapterOptions.length}章を自動抽出しました
                  </div>
                )}
              </div>
            );
          }

          if (field.name === "target_section") {
            const hasSectionErr = validationErrors.includes(field.name);
            return (
              <div key={field.name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: hasSectionErr ? C.red : C.navy }}>{field.label}</label>
                  {field.required && <RequiredMark />}
                  <SourceLabel source={field.source} autoFill={false} onAutoFill={() => {}}
                    onRef={() => { const s = allSteps?.[8]?.outputText; if (s) onRefPanel({ stepNum: 8, text: s, targetField: "target_section" }); else alert("STEP7の出力データがまだ保存されていません。"); }} />
                  {hasSectionErr && <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>← 節を選んでください</span>}
                </div>
                <div style={{ fontSize: 13, color: "#444444", marginBottom: 8 }}>{field.desc}</div>
                <div style={{ marginBottom: 10 }}>
                  <button onClick={() => {
                    const srcOutput = allSteps?.[7]?.outputText;
                    if (!srcOutput) { alert("STEP7の出力データがまだ保存されていません。\n\nSTEP7を完了して「出力データを保存」ボタンを押してから、もう一度お試しください。"); return; }
                    const extracted = extractSections(srcOutput);
                    if (extracted.length === 0) { alert("STEP7の出力から「(1)(2)(3)...」形式の節を検出できませんでした。STEP7の出力をもう一度確認してください。"); return; }
                    setSectionOptions(extracted); setSelectedSection(null); handleInputChange("target_section", "");
                  }} style={{ fontSize: 12.5, fontWeight: 600, color: C.white, background: C.gold, border: "none", borderRadius: 3, padding: "7px 14px", cursor: "pointer" }}>
                    📋 STEP7から節を抽出
                  </button>
                  {sectionOptions.length > 0 && (
                    <button onClick={() => { setSectionOptions([]); setSelectedSection(null); handleInputChange("target_section", ""); }}
                      style={{ fontSize: 12, color: C.textLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, padding: "6px 12px", cursor: "pointer", marginLeft: 8 }}>
                      抽出結果をクリア
                    </button>
                  )}
                </div>
                {sectionOptions.length > 0 && (
                  <SectionSelector sections={sectionOptions} selected={selectedSection}
                    onSelect={(i, sec) => { setSelectedSection(i); handleInputChange("target_section", sec.sectionTitle); }}
                    onReselect={() => { setSelectedSection(null); handleInputChange("target_section", ""); }} />
                )}
              </div>
            );
          }

          // 自動投入済みかどうか（現在のフィールド値が前STEP outputText と一致するか）
          const isFieldAutoFilled = (() => {
            if (field.autoFill !== true || !field.source) return false;
            const m = field.source.match(/^STEP(\d+)$/);
            if (!m) return false;
            const srcOutput = allSteps?.[parseInt(m[1], 10)]?.outputText;
            return !!(srcOutput && inputs[field.name] === srcOutput);
          })();

          // 自動投入済み & 未展開 → 折りたたみバナーだけ表示（編集する時だけ展開）
          const isCollapsed = isFieldAutoFilled && !expandedFields[field.name];
          if (isCollapsed) {
            const srcNum = parseInt(field.source.replace("STEP", ""), 10);
            const valueLength = (inputs[field.name] || "").length;
            return (
              <div key={field.name} style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setExpandedFields((prev) => ({ ...prev, [field.name]: true }))}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: C.greenLight, border: `1px solid rgba(45,122,79,0.25)`,
                    borderRadius: 4, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>✓ {field.label}</span>
                  <span style={{ fontSize: 12, color: C.textSub }}>STEP{srcNum}から自動投入済み（{valueLength.toLocaleString()}文字）</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: C.textLight }}>▼ 内容を確認・編集</span>
                </button>
              </div>
            );
          }

          return (
            <div key={field.name} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13.5, fontWeight: 600, color: hasError ? C.red : C.navy }}>{field.label}</label>
                {field.required && <RequiredMark />}
                <SourceLabel source={field.source} autoFill={field.autoFill}
                  isAutoFilled={isFieldAutoFilled}
                  onAutoFill={() => {
                    const srcNum = parseInt(field.source.replace("STEP", ""), 10);
                    const srcOutput = allSteps?.[srcNum]?.outputText;
                    sendDebugLog(`AUTOFILL from STEP${srcNum} to STEP${step.num}.${field.name}`, { length: (srcOutput || "").length, tail: (srcOutput || "").slice(-30) });
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
                {isFieldAutoFilled && expandedFields[field.name] && (
                  <button onClick={() => setExpandedFields((prev) => ({ ...prev, [field.name]: false }))}
                    style={{ fontSize: 11, color: C.textSub, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}>
                    ▲ 折りたたむ
                  </button>
                )}
                {hasError && <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>← 入力してください</span>}
              </div>
              <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>{field.desc}</div>
              {step.num === 2 && field.name === "amazon_html" && <Step2HtmlHelper inputs={inputs} currentHtml={inputs.amazon_html || ""} />}
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
                // 入力欄がある場合はその内容、ない場合は「開始」を送って質問1から始めさせる
                const text = step.inputs.length > 0
                  ? (step.inputs.length === 1 ? (inputs[step.inputs[0].name] || "") : step.inputs.map((f) => `【${f.label}】\n${inputs[f.name] || ""}`).join("\n\n"))
                  : "開始";
                if (!text.trim()) return;
                setChatTransferMsg(true); setTimeout(() => setChatTransferMsg(false), 2500);
                setChatError(""); setChatMessages((prev) => [...prev, { role: "user", content: text }]); setChatLoading(true);
                try {
                  const chatInputs = chatConversationId ? {} : getAutoInjectedProfiles();
                  const response = await fetch("/api/dify-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepNum: step.num, message: text, conversation_id: chatConversationId, inputs: chatInputs }) });
                  const data = await response.json();
                  if (!response.ok) { setChatError(data.error || "送信に失敗しました"); }
                  else { if (data.conversation_id) setChatConversationId(data.conversation_id); setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer }]); setTimeout(() => { if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight; }, 50); }
                } catch (e) { setChatError("通信エラーが発生しました。"); }
                finally { setChatLoading(false); }
              }} style={{ fontSize: 13 }}>{step.inputs.length > 0 ? "チャットに転記して開始" : "チャットを開始"}</BtnSecondary>
              {chatTransferMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ {step.inputs.length > 0 ? "チャットに転記しました" : "チャットを開始しました"}</span>}
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="②" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>AIで実行する</h2>
        </div>
        <Card style={{ background: "#eef2f7", border: "1px solid #c8d4e0" }}>
          {step.type === "chat" ? (
            <div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>入力データを保存したら、下のチャット欄でAIと対話してください。このページを離れずに会話できます。</div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", background: C.white }}>
                <div ref={chatAreaRef} style={{ height: 340, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10, background: C.navyLight }}>
                  {chatMessages.length === 0 && <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", marginTop: 60 }}>メッセージを入力して送信してください</div>}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ fontSize: 11, color: C.textLight, marginBottom: 3, paddingLeft: msg.role === "user" ? 0 : 4, paddingRight: msg.role === "user" ? 4 : 0 }}>{msg.role === "user" ? "あなた" : "AI"}</div>
                      <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: msg.role === "user" ? C.navy : C.white, color: msg.role === "user" ? C.white : C.text, fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", border: msg.role === "user" ? "none" : `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>{msg.content}</div>
                    </div>
                  ))}
                  {chatLoading && <div style={{ display: "flex", alignItems: "flex-start" }}><div style={{ padding: "10px 16px", borderRadius: "12px 12px 12px 3px", background: C.white, border: `1px solid ${C.border}`, fontSize: 13, color: C.textLight }}>考え中...</div></div>}
                  <div ref={chatBottomRef} />
                </div>
                {chatError && <div style={{ padding: "8px 14px", background: "#fef2f2", borderTop: `1px solid rgba(192,57,43,0.2)`, fontSize: 12.5, color: C.red }}>{chatError}</div>}
                <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.white }}>
                  <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    placeholder="メッセージを入力（送信は右の「送信」ボタンを押してください）" rows={3}
                    style={{ flex: 1, padding: "12px 14px", fontSize: 13.5, border: "none", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.65, boxSizing: "border-box" }} />
                  <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                    style={{ width: 80, background: chatLoading || !chatInput.trim() ? "#ccc" : C.navy, color: C.white, border: "none", fontWeight: 700, fontSize: 13, cursor: chatLoading || !chatInput.trim() ? "default" : "pointer", flexShrink: 0 }}>送信</button>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => {
                    const lastAI = [...chatMessages].reverse().find((m) => m.role === "assistant");
                    if (!lastAI) return;
                    const cleaned = cleanOutputText(lastAI.content);
                    const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
                    const candidates = lines.filter((l) => l.includes("×") || l.includes("x") || l.includes("X"));
                    if (candidates.length > 1) { setChatSelectOptions(candidates); }
                    else { setOutputText(cleaned); setChatCopyMsg(true); setTimeout(() => setChatCopyMsg(false), 2000); }
                  }} disabled={!chatMessages.some((m) => m.role === "assistant")}
                    style={{ fontSize: 13, fontWeight: 700, color: chatMessages.some((m) => m.role === "assistant") ? C.white : C.textLight, background: chatMessages.some((m) => m.role === "assistant") ? C.gold : "rgba(0,0,0,0.06)", border: "none", borderRadius: 3, padding: "8px 18px", cursor: chatMessages.some((m) => m.role === "assistant") ? "pointer" : "default" }}>
                    ↓ 最後の回答を出力データへ転記
                  </button>
                  {chatCopyMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 転記しました</span>}
                  {chatSelectOptions.length > 0 && (
                    <div style={{ marginTop: 10, padding: "12px 14px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 6, width: "100%", boxSizing: "border-box" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>出力データに転記するキーワードを1つ選んでください</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {chatSelectOptions.map((opt, i) => (
                          <button key={i} onClick={() => { setOutputText(opt); setChatSelectOptions([]); setChatSelectMsg(true); setTimeout(() => setChatSelectMsg(false), 2000); }}
                            style={{ textAlign: "left", padding: "8px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13.5, fontWeight: 600, color: C.navy, cursor: "pointer" }}>{opt}</button>
                        ))}
                        <button onClick={() => setChatSelectOptions([])} style={{ textAlign: "left", padding: "4px 8px", background: "none", border: "none", fontSize: 12, color: C.textLight, cursor: "pointer" }}>キャンセル</button>
                      </div>
                    </div>
                  )}
                  {chatSelectMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 転記しました</span>}
                </div>
                <div>
                  <button onClick={() => { setChatMessages([]); setChatConversationId(""); setChatError(""); setChatInput(""); }}
                    style={{ fontSize: 12, color: C.textLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 10px", cursor: "pointer" }}>会話をリセット</button>
                  <span style={{ fontSize: 11.5, color: C.textLight, marginLeft: 8 }}>新しいテーマで試すときはリセットしてください</span>
                </div>
              </div>
            </div>
          ) : step.num === 7 ? (
            // STEP6 は STEP5（目次）から章を抽出し、章ごとに章構成を生成して結果を結合する。
            // Dify Cloud の iteration ノードが Flask app_context エラーで動かないため、
            // フロント側でループ実行する（STEP7 と同じパターン）。
            <div>
              {runError && <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
              {chapterStockProgress ? (
                <div style={{ padding: "12px 14px", background: C.navyLight, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12.5, color: C.navyMid, fontWeight: 600 }}>
                    <span>章の一括生成中：{chapterStockProgress.current} / {chapterStockProgress.total} 章</span>
                    <span>{Math.round((chapterStockProgress.current / chapterStockProgress.total) * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(chapterStockProgress.current / chapterStockProgress.total) * 100}%`, height: "100%", background: C.navy, transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>⏳ 生成中：<span style={{ color: C.text, fontWeight: 600 }}>{chapterStockProgress.currentItemName}</span></div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>
                    STEP5 の目次から章を自動抽出し、章ごとに Dify を呼び出して全章分の章構成を一括生成します。
                    章間に3秒のウェイトを挟むため、章数 × 約30秒〜1分程度かかります。
                  </div>
                  {!allSteps?.[5]?.outputText && (
                    <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>
                      ⚠ STEP5 の出力データがまだ保存されていません。STEP5 で「出力データを保存」を押してから戻ってきてください。
                    </div>
                  )}
                  {allSteps?.[5]?.outputText && chapterOptions.length === 0 && (
                    <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red, lineHeight: 1.7 }}>
                      ⚠ STEP5 の出力から章を検出できませんでした。「はじめに」「第N章: xxx」「おわりに」のような章見出しが含まれているか、STEP5 の出力を確認してください。
                    </div>
                  )}
                  {chapterOptions.length > 0 && (
                    <>
                      <button onClick={handleRunAllChaptersForStep6} disabled={isRunning}
                        title="検出された全ての章を順番にDifyに投げて、全章分の章構成を一気に生成します。"
                        style={{ padding: "12px 36px", background: isRunning ? "#93c5fd" : C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: isRunning ? "default" : "pointer", letterSpacing: "0.04em" }}>
                        🚀 全章を順次生成（{chapterOptions.length}章）
                      </button>
                      <div style={{ marginTop: 12, padding: "10px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>
                          検出された章（{chapterOptions.length}章 — 全て順次処理されます）：
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: C.text, lineHeight: 1.9 }}>
                          {chapterOptions.map((ch, i) => (
                            <li key={i} style={{ wordBreak: "break-word" }}>
                              {ch.chapterTitle}
                              <span style={{ fontSize: 11, color: C.textLight, marginLeft: 6 }}>（{ch.body.trim().length.toLocaleString()}文字）</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : step.num === 8 ? (
            // STEP7 は STEP6（章構成）から章を抽出し、章ごとに詳細プロットを生成して結合する。
            // STEP6 と同じ「②AIで実行する」セクション集約パターンに統一。
            <div>
              {runError && <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{runError}</div>}
              {chapterStockProgress ? (
                <div style={{ padding: "12px 14px", background: C.navyLight, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12.5, color: C.navyMid, fontWeight: 600 }}>
                    <span>章の一括生成中：{chapterStockProgress.current} / {chapterStockProgress.total} 章</span>
                    <span>{Math.round((chapterStockProgress.current / chapterStockProgress.total) * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(chapterStockProgress.current / chapterStockProgress.total) * 100}%`, height: "100%", background: C.navy, transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>⏳ 生成中：<span style={{ color: C.text, fontWeight: 600 }}>{chapterStockProgress.currentItemName}</span></div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>
                    STEP6 の章構成から章を自動抽出し、章ごとに Dify を呼び出して全章分の詳細プロットを一括生成します。
                    章間に3秒のウェイトを挟むため、章数 × 約30秒〜1分程度かかります。
                  </div>
                  {!allSteps?.[6]?.outputText && (
                    <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>
                      ⚠ STEP6 の出力データがまだ保存されていません。STEP6 で「出力データを保存」を押してから戻ってきてください。
                    </div>
                  )}
                  {allSteps?.[6]?.outputText && chapterOptions.length === 0 && (
                    <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red, lineHeight: 1.7 }}>
                      ⚠ STEP6 の出力から章を検出できませんでした。「はじめに」「第N章: xxx」「おわりに」のような章見出しが含まれているか、STEP6 の出力を確認してください。
                    </div>
                  )}
                  {chapterOptions.length > 0 && (
                    <>
                      <button onClick={handleRunAllChaptersForStep7} disabled={isRunning}
                        title="検出された全ての章を順番にDifyに投げて、全章分の詳細プロットを一気に生成します。"
                        style={{ padding: "12px 36px", background: isRunning ? "#93c5fd" : C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: isRunning ? "default" : "pointer", letterSpacing: "0.04em" }}>
                        🚀 全章を順次生成（{chapterOptions.length}章）
                      </button>
                      <div style={{ marginTop: 12, padding: "10px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>
                          検出された章（{chapterOptions.length}章 — 全て順次処理されます）：
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: C.text, lineHeight: 1.9 }}>
                          {chapterOptions.map((ch, i) => (
                            <li key={i} style={{ wordBreak: "break-word" }}>
                              {ch.chapterTitle}
                              <span style={{ fontSize: 11, color: C.textLight, marginLeft: 6 }}>（{ch.body.trim().length.toLocaleString()}文字）</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>入力データが揃ったら「実行する」ボタンを押してください。AIが処理して、結果が下の出力欄に自動で表示されます。</div>
              {runError && <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>{runError}</div>}
              {step.num === 9 && sectionProgress && (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: C.navyLight, border: `1px solid rgba(42,68,104,0.2)`, borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12.5, color: C.navyMid, fontWeight: 600 }}>
                    <span>節の一括生成中：{sectionProgress.current} / {sectionProgress.total} 項</span>
                    <span>{Math.round((sectionProgress.current / sectionProgress.total) * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(sectionProgress.current / sectionProgress.total) * 100}%`, height: "100%", background: C.navy, transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>⏳ 生成中：<span style={{ color: C.text, fontWeight: 600 }}>{sectionProgress.currentItemName}</span></div>
                </div>
              )}
              <button onClick={handleRunDify} disabled={isRunning}
                style={{ padding: "12px 36px", background: isRunning ? "#93c5fd" : C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: isRunning ? "default" : "pointer", letterSpacing: "0.04em" }}>
                {isRunning ? (step.num === 9 ? "節を生成中..." : "実行中...") : "▶ 実行する"}
              </button>
              {isRunning && step.num !== 8 && <span style={{ fontSize: 13, color: C.navyMid, marginLeft: 12 }}>AIが処理しています。少々お待ちください...</span>}
            </div>
          )}
        </Card>
      </div>

      <div id="output-section" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <StepBadge num="③" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>出力データ</h2>
        </div>
        <div style={{ fontSize: 13, color: "#444444", marginBottom: 10, lineHeight: 1.8 }}>
          {step.type === "chat" ? <>チャットの会話から得た結果をコピーして、下の欄に貼り付けてください。{nextStep && ` この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}</> : <>AIの実行結果が自動で表示されます。内容を確認してから保存してください。{nextStep && ` この出力は次のステップ（STEP${nextStep.num}）の入力になります。`}</>}
          <br />出力はそのまま使っても、自分で修正したり、AIチャットで整えてから使うこともできます。
        </div>
        {/* 外部AIで相談したユーザー向けの導線案内（初めての人にも分かりやすく） */}
        {(outputText || "").trim() && step.num >= 1 && (
          <div style={{ padding: "10px 14px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 4, marginBottom: 10, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            💡 <strong style={{ color: C.gold }}>外部AI（ChatGPT/Claude.ai）で相談した結果を反映するには：</strong>
            <ol style={{ margin: "4px 0 0 0", paddingLeft: 22 }}>
              <li>外部AIから受け取った<strong>確定版テキスト</strong>を全文コピー</li>
              <li>下の出力データ欄を全選択して削除</li>
              <li>コピーした確定版を貼り付け</li>
              <li>「<strong>出力データを保存</strong>」ボタンを押す</li>
            </ol>
          </div>
        )}
        <textarea value={outputText} onChange={(e) => setOutputText(e.target.value)}
          placeholder={step.type === "chat" ? "チャットで得た結果をここに貼り付けてください" : "実行するボタンを押すと結果が自動で表示されます"} rows={10}
          style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", background: C.white, lineHeight: 1.7, minHeight: 220 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={handleSaveOutput}>出力データを保存</BtnPrimary>
          {saveOutputMsg === "saved" && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ 保存しました</span>}
          <BtnSecondary onClick={() => { if (!outputText) return; navigator.clipboard.writeText(outputText); setSaveOutputMsg("copy"); setTimeout(() => setSaveOutputMsg(false), 2000); }} style={{ fontSize: 13 }}>出力をコピー</BtnSecondary>
          {saveOutputMsg === "copy" && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ コピーしました</span>}
          {nextStep && <BtnSecondary onClick={() => onNavigate(`step_${nextStep.num}`)} style={{ background: C.greenLight, color: C.green, border: `1px solid rgba(45,122,79,0.25)` }}>STEP{nextStep.num}へ進む →</BtnSecondary>}
          {!nextStep && <BtnSecondary onClick={() => onNavigate("saved")} style={{ background: C.greenLight, color: C.green, border: `1px solid rgba(45,122,79,0.25)` }}>完了 → 保存データを見る</BtnSecondary>}
        </div>
      </div>

      {/* STEP4 専用：採用案を確定する UI */}
      {step.num === 5 && <Step4ConfirmPanel outputText={outputText} />}

      {/* 外部AIで相談するためのプロンプト生成パネル（全STEP共通） */}
      {/* workProfile は軽量化版を渡す：STEP2の出力60KBから市場分析データを除き、相談に必要な核情報のみに圧縮 */}
      <DiscussionPanel
        stepNum={step.num}
        stepName={step.title}
        stepOutput={outputText}
        authorProfile={getAutoInjectedProfiles().author_profile || ""}
        workProfile={extractDiscussionContext(getAutoInjectedProfiles().work_profile || "")}
      />

      {step.help && step.help.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div onClick={() => setHelpOpen(!helpOpen)} style={{ fontSize: 13, fontWeight: 600, color: C.textSub, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
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
              {sd.outputText && <div style={{ marginTop: 10, fontSize: 12, color: C.textLight, lineHeight: 1.5, maxHeight: 48, overflow: "hidden" }}>{sd.outputText.slice(0, 120)}{sd.outputText.length > 120 ? "..." : ""}</div>}
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
      <Section title="全体の流れ">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>STEP1からSTEP9まで順番に進めます</li>
          <li>前のステップの出力を次のステップの入力に使います</li>
          <li>途中で止まっても、保存データからいつでも再開できます</li>
        </ul>
      </Section>
      <Section title="操作方法（ワークフロー型:STEP1〜2・4〜9）">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>① 入力データ欄に情報を入力する。「自動転記」「参照」「自動振り分け」ボタンを活用してください</li>
          <li style={{ marginTop: 4 }}><span style={{ fontWeight: 700 }}>自動転記（ネイビー）</span>：押すと前のSTEPの出力が自動で入力欄に入る</li>
          <li style={{ marginTop: 4 }}><span style={{ fontWeight: 700 }}>参照（薄ネイビー）</span>：押すと画面右側に前のSTEPの出力が表示される</li>
          <li style={{ marginTop: 4 }}><span style={{ fontWeight: 700 }}>自動振り分け（ゴールド）</span>：STEP4のキーワード入力欄専用。書籍プロファイル確定版（STEP2）から主題軸キーワードを自動抽出</li>
          <li style={{ marginTop: 8 }}>② 「実行する」ボタンを押すとAIが自動で処理し、結果が出力欄に表示される</li>
          <li>③ 内容を確認・修正して「出力データを保存」を押す</li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#b8922a", fontWeight: 600 }}>⚠️ 出力を修正した場合も必ず「出力データを保存」を押してから次のステップへ。</div>
      </Section>
      <Section title="操作方法（チャット型:STEP3）">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>① 入力データ欄に情報を入力して「入力データを保存」を押す</li>
          <li>② 「チャットに転記して開始」を押すと入力データがそのまま送信され、AIから最初の質問が届く</li>
          <li>③ AIの質問に答えながら会話を進める</li>
          <li>④ 会話が終わったら「↓ 最後の回答を出力データへ転記」を押す</li>
          <li>⑤ 出力データ欄の内容を確認して「出力データを保存」を押す</li>
        </ul>
      </Section>
      <Section title="データの保存について">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>各ステップの入力・出力は「保存」ボタンでブラウザに保存されます</li>
          <li>同じブラウザで再度開けば、保存したデータはそのまま残っています</li>
          <li>別のブラウザや別のPC・スマホからはデータを引き継げません</li>
          <li>ブラウザのキャッシュをクリアするとデータが消えるため、大事な出力はコピーして別途保管してください</li>
        </ul>
      </Section>
      <Section title="STEP2 市場検証のHTML取得方法">
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>AmazonのKindleストアで主題軸キーワードを検索（必要に応じて読者軸・差分軸も）</li>
          <li>検索結果ページで右クリック→「ページのソースを表示」</li>
          <li>Ctrl+A → Ctrl+C で全選択コピー</li>
          <li>STEP2の各軸の入力欄に貼り付けて「実行する」を押す</li>
        </ol>
        <div style={{ marginTop: 8, fontSize: 12.5, color: C.textLight }}>「実行する」を押すと自動でクリーニングしてAIに渡します。最低でも主題軸の1軸が必須・読者軸/差分軸は任意。</div>
      </Section>
      <BtnSecondary onClick={() => onNavigate("home")}>ホームへ戻る</BtnSecondary>
    </div>
  );
};

// ============================================================
// メインアプリ（isTrialMode・ブロック画面を全削除済み）
// ============================================================

export default function App() {
  const [page, setPage] = useState("home");
  const [project, setProject] = useState(defaultProject());
  const [allSteps, setAllSteps] = useState({});
  const [authorProfile, setAuthorProfile] = useState("");
  const [workProfile, setWorkProfile] = useState("");
  const [workProfileConfirmed, setWorkProfileConfirmed] = useState("");
  const [loading, setLoading] = useState(true);
  // STEP2→STEP1 への pending（user click 時に navigate 内で1回だけ consume するので StrictMode 二重 mount でも安全）
  const [step1PendingApply, setStep1PendingApply] = useState(null);

  if (typeof window !== "undefined") {
    window.__DEBUG_LOGS = window.__DEBUG_LOGS || [];
    if (!window.__DEBUG_SESSION_ID) {
      window.__DEBUG_SESSION_ID = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    }
  }

  useEffect(() => {
    (async () => {
      // 注: v1/v4 のlocalStorageマイグレーションはモジュール読込時に既に実行済み（上のmigrateLocalStorageV1/V4参照）。
      const p = await loadProject();
      if (p) setProject(p); else await saveProject(defaultProject());
      const steps = await loadAllSteps();
      setAllSteps(steps);
      const ap = await loadAuthorProfile();
      setAuthorProfile(ap);
      const wp = await loadWorkProfile();
      setWorkProfile(wp);
      const wpc = await loadWorkProfileConfirmed();
      setWorkProfileConfirmed(wpc);
      setLoading(false);
      const summary = {};
      for (let i = 1; i <= 10; i++) { const t = steps[i]?.outputText || ""; summary[`STEP${i}`] = { length: t.length, tail: t.slice(-30) }; }
      sendDebugLog("INIT loadAllSteps", summary);
    })();
  }, []);

  const handleSaveAuthorProfile = useCallback(async (text) => {
    await saveAuthorProfile(text);
    setAuthorProfile(text);
  }, []);

  const handleSaveWorkProfile = useCallback(async (text) => {
    await saveWorkProfile(text);
    setWorkProfile(text);
  }, []);

  const handleSaveWorkProfileConfirmed = useCallback(async (text) => {
    await saveWorkProfileConfirmed(text);
    setWorkProfileConfirmed(text);
  }, []);

  const stepStatuses = {};
  for (let i = 1; i <= 10; i++) stepStatuses[i] = allSteps[i]?.status || "not_started";
  // v4: 書籍プロファイル確定アクションの進捗ステータス（サイドナビ表示用）
  // workProfileConfirmed (localStorage の確定版テキスト) が空でなければ「completed」扱い。
  const confirmStatus = (workProfileConfirmed || "").trim() ? "completed" : "not_started";
  // STEP0 は専用ページ（Step0Page）で著者プロファイルを localStorage に保存する設計のため、
  // ステータスは aipub:author_profile の有無で判定する。
  stepStatuses[0] = (typeof window !== "undefined" && (localStorage.getItem(AUTHOR_PROFILE_KEY) || "").trim())
    ? "completed"
    : "not_started";

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
    // STEP1 へ遷移する瞬間に pending を一度だけ消費して props 化（user click は1回なので StrictMode 二重 mount でも安全）
    if (p === "step_1") {
      const pending = consumeStep1Pending();
      setStep1PendingApply(pending && Object.keys(pending).length > 0 ? pending : null);
    } else {
      setStep1PendingApply(null);
    }
    setPage(p);
    if (p.startsWith("step_")) {
      const num = parseInt(p.replace("step_", ""), 10);
      if (num >= 1 && num <= 10) {
        setProject((prev) => { const updated = { ...prev, currentStep: num }; saveProject(updated); return updated; });
      }
    }
    window.scrollTo?.(0, 0);
  }, []);

  const handleApplyToStep1Pending = useCallback((apply) => {
    if (!apply) return;
    setStep1PendingApply((prev) => {
      const merged = { ...(prev || {}) };
      Object.entries(apply).forEach(([k, v]) => { if (v) merged[k] = v; });
      return Object.keys(merged).length > 0 ? merged : null;
    });
  }, []);

  const handleSaveInput = useCallback(async (num, inputData) => {
    const existing = allSteps[num] || defaultStepData(num);
    const updated = { ...existing, inputData, status: existing.status === "completed" ? "completed" : "in_progress", updatedAt: new Date().toISOString() };
    await saveStepData(num, updated);
    setAllSteps((prev) => ({ ...prev, [num]: updated }));
    setProject((prev) => { const p = { ...prev, lastUpdatedStep: num }; saveProject(p); return p; });
  }, [allSteps]);

  const handleSaveOutput = useCallback(async (num, outputText) => {
    const cleaned = cleanOutputText(outputText);
    const existing = allSteps[num] || defaultStepData(num);
    const updated = { ...existing, outputText: cleaned, status: "completed", isSaved: true, updatedAt: new Date().toISOString() };
    await saveStepData(num, updated);
    setAllSteps((prev) => ({ ...prev, [num]: updated }));
    setProject((prev) => {
      const completedCount = Object.values({ ...allSteps, [num]: updated }).filter((s) => s.status === "completed").length;
      const p = { ...prev, lastUpdatedStep: num, completedCount }; saveProject(p); return p;
    });
  }, [allSteps]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const navigateAndClose = useCallback(async (p) => {
    setMenuOpen(false);
    await navigate(p);
  }, [navigate]);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "inherit", color: C.textLight }}>読み込み中...</div>;
  }

  const renderPage = () => {
    const nav = isMobile ? navigateAndClose : navigate;
    if (page === "home") return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={nav} />;
    if (page === "guide") return <GuidePage onNavigate={nav} />;
    if (page === "saved") return <SavedPage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={nav} />;
    if (page === "step_0") return <Step0Page savedProfile={authorProfile} onSaveProfile={handleSaveAuthorProfile} onNavigate={nav} />;
    if (page === "step_1") return <Step1Page savedAuthorProfile={authorProfile} savedWorkProfile={workProfile} onSaveWorkProfile={handleSaveWorkProfile} onNavigate={nav} pendingApply={step1PendingApply} project={project} />;
    if (page === "step_2") return <Step2Page savedAuthorProfile={authorProfile} savedWorkProfileDraft={workProfile} onNavigate={nav} project={project} />;
    if (page === "step_3") return <Step3Page savedAuthorProfile={authorProfile} savedWorkProfileDraft={workProfile} onNavigate={nav} project={project} />;
    if (page === "step_confirm") return <ConfirmActionPage savedAuthorProfile={authorProfile} savedWorkProfileDraft={workProfile} savedWorkProfileConfirmed={workProfileConfirmed} onSaveWorkProfileConfirmed={handleSaveWorkProfileConfirmed} onNavigate={nav} project={project} />;
    if (page.startsWith("step_")) {
      const num = parseInt(page.replace("step_", ""), 10);
      const step = STEPS[num - 1];
      const sd = allSteps[num] || defaultStepData(num);
      return <StepPage step={step} stepData={sd} project={project} onNavigate={nav} onSaveInput={handleSaveInput} onSaveOutput={handleSaveOutput} onUpdateProject={setProject} onInputChange={handlePendingInputChange} allSteps={allSteps} onRefPanel={setRefPanel} />;
    }
    return <HomePage project={project} stepStatuses={stepStatuses} allSteps={allSteps} onNavigate={nav} />;
  };

  const MobileHeader = () => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: C.navy, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", boxSizing: "border-box", borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5 }}>
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
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>AI出版プロデューサー</div>
        </div>
      </div>
    </div>
  );

  const MobileDrawer = () => (
    <>
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }} />}
      <div style={{ position: "fixed", top: 56, left: 0, bottom: 0, width: 280, background: C.navy, zIndex: 300, overflowY: "auto", transform: menuOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease" }}>
        <SideMenu currentPage={page} onNavigate={navigateAndClose} stepStatuses={stepStatuses} confirmStatus={confirmStatus} />
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
          <div style={{ padding: "20px 16px", maxWidth: 800, margin: "0 auto" }}>{renderPage()}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Noto Sans JP', sans-serif", background: C.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <SideMenu currentPage={page} onNavigate={navigate} stepStatuses={stepStatuses} confirmStatus={confirmStatus} />
      <div style={{ marginLeft: 300, flex: 1, padding: "20px 44px 36px", maxWidth: refPanel ? 560 : 820, boxSizing: "border-box", transition: "max-width 0.2s" }}>
        {renderPage()}
      </div>
      {refPanel && (
        <div style={{ position: "sticky", top: 0, width: 320, minWidth: 320, height: "100vh", background: C.white, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: 20, boxSizing: "border-box", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>STEP{refPanel.stepNum}の出力（参照）</span>
            <button onClick={() => setRefPanel(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.textLight, lineHeight: 1, padding: "0 4px" }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 8, lineHeight: 1.5 }}>テキストを選択してコピーできます。選択なしで「コピー」を押すと全文がコピーされます。</div>
          <textarea readOnly value={refPanel.text}
            style={{ flex: 1, overflowY: "auto", background: C.navyLight, borderRadius: 4, padding: 12, fontSize: 12.5, color: C.text, lineHeight: 1.7, border: `1px solid ${C.border}`, marginBottom: 12, resize: "none", fontFamily: "'Noto Sans JP', sans-serif", whiteSpace: "pre-wrap", wordBreak: "break-all", cursor: "text" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => {
              const sel = window.getSelection()?.toString();
              navigator.clipboard.writeText(sel && sel.length > 0 ? sel : refPanel.text);
              if (refPanel.targetField) {
                setTimeout(() => { const target = document.getElementById(`field-${refPanel.targetField}`); if (target) { target.focus(); target.scrollIntoView({ behavior: "smooth", block: "center" }); } }, 100);
              }
            }} style={{ flex: 1, padding: "10px", background: C.navy, color: C.white, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>コピー</button>
            <button onClick={() => setRefPanel(null)} style={{ flex: 1, padding: "10px", background: "transparent", color: C.textLight, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13, cursor: "pointer" }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}　
