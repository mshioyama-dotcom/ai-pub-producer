// DiscussionPanel
// 各STEPの出力エリア下に表示する「外部AIで相談する用プロンプト生成」パネル。
//
// 設計判断（v3）:
//   - 当初は内蔵チャットUIで議論する設計だったが、ユーザーフィードバックで方針転換
//   - 内蔵チャットは「狭いテキストエリア」「永遠のラリー」「APIコスト発生」が課題
//   - 代わりに ChatGPT/Claude などの個人AIで議論してもらう運用に変更
//   - このパネルは「外部AIに渡すと最適に動くプロンプト」を生成して提示する
//   - 外部AIが返す改訂版は、ユーザーが直接出力textareaに貼り付ける
//
// 利点:
//   - ChatGPT/Claude のフル画面で快適に議論できる
//   - 我々のDify chat API料金がかからない
//   - サブスク商品としての差別化（「外部AIと連携するワークフロー」）

import { useState } from "react";

// 色トークン（App.jsxと同期）
const C = {
  navy:       "#243d5c",
  navyLight:  "#e8eef5",
  gold:       "#b8922a",
  goldLight:  "#f0d98a",
  goldPale:   "#fdf6e3",
  white:      "#ffffff",
  border:     "#d0cac0",
  text:       "#1a1a1a",
  textSub:    "#444444",
  textLight:  "#777777",
  green:      "#1e6b3a",
  red:        "#b52b1e",
};

// STEPごとに「外部AIに渡す役割」と「特有の制約」を定義
const STEP_ROLE_HINTS = {
  1: {
    role: "出版プロデューサーとして、書籍プロファイル草案（テーマ・想定読者・読了後の状態・狙い目の切り口）の改善を一緒に練ってください",
    constraints: "Amazon検索で実在するキーワード3軸（主題軸・読者軸・差分軸）を必ず維持してください",
  },
  2: {
    role: "出版プロデューサーとして、市場検証結果と書籍プロファイル確定版の改善を一緒に練ってください",
    constraints: "市場像・需要診断・勝率診断の数値や分析は維持し、確定版テキスト本文の改善に集中してください",
  },
  3: {
    role: "編集者として、エピソードインタビュー要約の改善を一緒に練ってください",
    constraints: "差別化軸・タイトル訴求素材・読者の思い込みなどの構造を維持してください",
  },
  4: {
    role: "Amazon Kindleタイトル設計に強い出版プロデューサーとして、タイトル・サブタイトル3案の改善を一緒に練ってください",
    constraints: "Amazon KDP規約違反語（「ベストセラー」「1位」「No.1」「無料」「セール」「期間限定」等）は事実述語であっても禁止です。タイトル＋サブタイトル合計200文字以下、kw1とkw2を必ず含むこと。",
  },
  5: {
    role: "シニア編集者として、目次（章構成＋節見出し）の改善を一緒に練ってください",
    constraints: "章タイトルは ** で囲んで太字に、節見出しは行頭に - を付ける形式を維持してください",
  },
  6: {
    role: "シニア編集者として、章構成（各章の節構成案）の改善を一緒に練ってください",
    constraints: "「章タイトル / ・節タイトル / > 構成案」というMarkdown形式と、1節80〜140文字程度の分量を維持してください",
  },
  7: {
    role: "シニア編集者として、詳細プロット（章→節→項の階層）の改善を一緒に練ってください",
    constraints: "章番号・節番号(1)(2)・項番号①②③のテキスト形式と階層構造を維持してください",
  },
  8: {
    role: "プロのライターとして、本文の改善を一緒に練ってください",
    constraints: "文字数は前回の±20%以内、文体・段落構成を維持しつつ改善してください",
  },
  9: {
    role: "Amazon説明文設計に強いコピーライターとして、本書の説明文の改善を一緒に練ってください",
    constraints: "7段落構成（読者の悩み→得られること→内容→著者の理由→価値→目次→プロフィール）を維持。「ベストセラー」「No.1」等の禁止語、URL、絵文字、ハッシュタグ、断定表現は使わないこと。",
  },
};

// 外部AIに渡すプロンプトを生成
function generateExternalAIPrompt({ stepNum, stepName, authorProfile, workProfile, currentOutput }) {
  const hint = STEP_ROLE_HINTS[stepNum] || {
    role: "出版プロデューサーとして、ユーザーの本作りを一緒に伴走してください",
    constraints: "（特になし）",
  };

  return `あなたは ${hint.role}。

【背景】
このセッションでは、AI出版プロデューサーというツールが既に生成した
**STEP${stepNum}「${stepName}」**の出力について、ユーザーがあなたと
一緒に改善方針を練ろうとしています。ユーザーは最終的に、あなたが返した
改訂版の完全な出力をツールの出力欄にそのまま貼り付けます。

そのため、あなたが最終出力を返す時は、**形式・順序・見出しレベル・
Markdown構造を完全に維持**してください（コピーアンドペーストできる必要があります）。


【著者プロファイル】

${(authorProfile || "（未登録）").trim()}


【書籍プロファイル】

${(workProfile || "（未登録）").trim()}


【現在の出力（議論対象・改善前）】

${(currentOutput || "（未生成）").trim()}


【対話ルール】

1. ユーザーの質問・懸念に丁寧に答える。一度に質問は1つまで（畳みかけない）。

2. 議論の早い段階で、改善方針を2〜3個の選択肢として提示し、トレードオフと共に並べる。

3. ユーザーが「これでOK」「最終版を出して」「採用する」と言ったら、改訂された完全な出力を **「現在の出力」と完全に同じ形式・順序・Markdown構造で** 出力する。

4. 修正不要な部分は、現在の出力からそのままコピーする（一字も変更しない）。

5. 修正対象の部分のみ、合意した方針に従って修正する。


【守ってほしい制約】

- 本書の核メッセージ（書籍プロファイルから読み取れる中心主張）と矛盾する改訂はしない
- 著者プロファイルから外れる改訂はしない
- ${hint.constraints}


【ユーザーの最初の発言】

ユーザーが現在の出力について、気になる点や改善したい方向性を伝えます。
ユーザーの発言を待ってから、対話を始めてください。
`;
}

export default function DiscussionPanel({
  stepNum,
  stepName,
  stepOutput,
  authorProfile = "",
  workProfile = "",
}) {
  const [open, setOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  // 生成されるプロンプト（毎回計算でOK・軽い）
  const generatedPrompt = generateExternalAIPrompt({
    stepNum,
    stepName,
    authorProfile,
    workProfile,
    currentOutput: stepOutput,
  });

  const handleCopyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt).then(() => {
      setCopyMsg("✓ プロンプトをコピーしました（外部AIに貼り付けてください）");
      setTimeout(() => setCopyMsg(""), 4000);
    }).catch(() => {
      setCopyMsg("⚠ コピーに失敗しました。テキストを手動で選択してコピーしてください");
      setTimeout(() => setCopyMsg(""), 4000);
    });
  };

  const hasOutput = !!(stepOutput || "").trim();

  return (
    <div style={{ marginTop: 24, marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 6, background: C.white }}>
      {/* ヘッダー（クリックで開閉） */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "12px 16px",
          background: "#f8f8f8",
          borderBottom: open ? `1px solid ${C.border}` : "none",
          borderRadius: open ? "6px 6px 0 0" : 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>
          📋 外部AIで相談する用プロンプトを取得
        </div>
        <div style={{ fontSize: 12, color: C.textSub }}>
          {open ? "▲ 閉じる" : "▼ 開く"}
        </div>
      </div>

      {open && (
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>
            出力を改善したい時は、ChatGPT や Claude.ai などの<strong>個人AI</strong>で深く議論できます。
            下のプロンプトをコピーして外部AIに貼り付け、議論を進めてください。
            最終的にAIが返す改訂版の出力を、上の出力データ欄にそのまま貼り付ければ反映できます。
          </div>

          {!hasOutput && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>
              先に出力データを生成してから、外部AIで相談してください。
            </div>
          )}

          {/* プロンプト表示エリア */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
              生成されたプロンプト（コピーして外部AIへ）：
            </div>
            <textarea
              value={generatedPrompt}
              readOnly
              rows={14}
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 12.5,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                lineHeight: 1.6,
                color: C.text,
                background: C.navyLight,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                whiteSpace: "pre",
                overflowX: "auto",
              }}
              onClick={(e) => e.target.select()}
            />
          </div>

          {/* アクションボタン群 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <button
              onClick={handleCopyPrompt}
              disabled={!hasOutput}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: hasOutput ? C.white : C.textLight,
                background: hasOutput ? C.navy : "rgba(0,0,0,0.06)",
                border: "none",
                borderRadius: 3,
                padding: "9px 22px",
                cursor: hasOutput ? "pointer" : "default",
                boxShadow: hasOutput ? "0 2px 4px rgba(36,61,92,0.25)" : "none",
              }}
            >
              📋 プロンプトをコピー
            </button>
            {copyMsg && <span style={{ fontSize: 12, color: copyMsg.startsWith("✓") ? C.green : C.red, fontWeight: 600 }}>{copyMsg}</span>}
          </div>

          {/* 使い方ガイド */}
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#eef2f7",
            border: "1px solid #c8d4e0",
            borderRadius: 4,
            fontSize: 12.5,
            color: C.text,
            lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>使い方の流れ</div>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>「📋 プロンプトをコピー」ボタンを押す</li>
              <li>ChatGPT または Claude.ai を開いて、コピーしたプロンプトを貼り付けて送信</li>
              <li>AIが「最初の発言を待っています」と応えるので、改善したい点を自由に書いて議論を進める</li>
              <li>議論が終わって最終版が出たら、それを上の「出力データ」欄に貼り付け</li>
              <li>「出力データを保存」ボタンで確定</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
