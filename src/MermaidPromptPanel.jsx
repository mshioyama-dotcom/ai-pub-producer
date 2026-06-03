// MermaidPromptPanel
// 「本文を見せて、外部AI（ChatGPT/Claude/Gemini）に：
//   (1) どこを図解化したらいいかを提案させる
//   (2) 各箇所の Mermaid 記法を作らせる
// ためのプロンプトを生成して、クリップボードにコピーするだけのパネル」
//
// 設計判断:
//   - サーバAPI不使用・APIキー不要（プロンプトをコピーするだけ）
//   - ユーザーは ChatGPT/Claude.ai/Gemini を自分で開いて貼る（無料）
//   - 受け取った Mermaid 記法は mermaid.live でレンダリング → PNG → Word に手で貼る
//   - これが「サーバ側で図解化＆Word埋め込み」を諦めた上での最も確実な代替

import { useState } from "react";

const C = {
  navy:       "#243d5c",
  navyMid:    "#345578",
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

function buildPrompt({ bodyText, authorProfile, workProfile, stepNum, stepName }) {
  const body = (bodyText || "").trim();
  const ap = (authorProfile || "").trim();
  const wp = (workProfile || "").trim();
  const stepLabel = stepNum && stepName ? `STEP${stepNum}「${stepName}」` : "本文";

  return `あなたは書籍編集者です。以下の${stepLabel}を分析し、読者の理解を深めるために図解（Mermaid 記法）を入れると効果的な箇所を **3〜5個** 提案してください。

━━━━━━━━━━━
【出力ルール（厳守）】
━━━━━━━━━━━

提案は以下の形式で **3〜5個** 出力する。挨拶・前置き・解説は一切書かない。
各提案は \`==案N==\` で開始する。

==案1==
場所：[本文の該当箇所を 20〜40字程度引用]
種類：[フロー図 / 比較図(Before/After) / 階層図 / 時系列図 のいずれか]
意図：[この図解で何を伝えたいか・1〜2行で]
キャプション：[Word の画像下に表示する短い説明・10〜30字]
\`\`\`mermaid
（ここに実際の Mermaid 記法）
\`\`\`

==案2==
（同様に5項目）

==案3==
（同様に5項目）

... 案5まで

━━━━━━━━━━━
【Mermaid 記法のルール】
━━━━━━━━━━━

- 日本語ノードは \`A[読者の悩み]\` のように **角括弧 [ ] で囲む**
- ノードIDは **半角英数**（A, B, C... または node1, node2...）
- ノード名の中に [ ] や " を入れない（記法が壊れる）
- 矢印は \`-->\` のみ
- 図解の種類別:
  - **フロー図**: \`graph LR\` または \`graph TD\`（ノード3〜6個）
  - **比較図 Before/After**: \`graph TB\` に \`subgraph Before["前"] ... end\` と \`subgraph After["後"] ... end\`（各2〜4ノード）
  - **階層図**: \`graph TD\`（ルート1個、第1階層2〜4個、第2階層0〜3個）
  - **時系列図**: \`timeline\` 記法（3〜6個の節目）
- 1案あたり **3〜8 ノード** に抑える（多すぎると見づらい）

━━━━━━━━━━━
【提案の選び方】
━━━━━━━━━━━

以下のような箇所が図解化のチャンス：
- **プロセスの説明**：「Aの次にBで、その後Cになる」のような時間的・論理的流れ
- **対比構造**：「Beforeはこう、Afterはこう」「思い込み vs 実態」
- **要素の分解**：「これは3つの要素から成る」のような階層構造
- **時系列・経歴**：「20代でこう、30代でこう」のような年代別の節目
- **読者の変化プロセス**：本書を読んだ読者がどう変わるかのステップ

避けるべき箇所:
- 抽象的な感情・心情の描写（図解しても意味が薄い）
- 既に文章で十分わかりやすい箇所
- 1つの概念だけで完結する箇所（図解の意味がない）

━━━━━━━━━━━
【本文（${stepLabel}）】
━━━━━━━━━━━

${body || "（本文未入力）"}

${ap ? `\n━━━━━━━━━━━\n【参考：著者プロファイル】\n━━━━━━━━━━━\n\n${ap.slice(0, 1000)}\n` : ""}${wp ? `\n━━━━━━━━━━━\n【参考：書籍プロファイル】\n━━━━━━━━━━━\n\n${wp.slice(0, 1500)}\n` : ""}

━━━━━━━━━━━

出力は \`==案1==\` から始めてください。挨拶や説明文は不要です。
`;
}

const MermaidPromptPanel = ({ stepNum, stepName, bodyText, authorProfile, workProfile }) => {
  const [open, setOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const hasBody = !!(bodyText || "").trim();
  const prompt = buildPrompt({ bodyText, authorProfile, workProfile, stepNum, stepName });

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopyMsg("✓ プロンプトをコピーしました（ChatGPT/Claude/Gemini に貼り付けてください）");
      setTimeout(() => setCopyMsg(""), 4500);
    }).catch(() => {
      setCopyMsg("⚠ コピーに失敗しました。下のテキストを手動でコピーしてください");
      setTimeout(() => setCopyMsg(""), 4500);
    });
  };

  return (
    <div style={{ marginTop: 16, marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 6, background: C.white }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 14px",
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
          🎨 図解化案を作る用プロンプトを取得（外部AI用）
        </div>
        <div style={{ fontSize: 12, color: C.textSub }}>{open ? "▲ 閉じる" : "▼ 開く"}</div>
      </div>

      {open && (
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7, marginBottom: 10, padding: "8px 12px", background: "#fff7e6", border: "1px solid #ffd591", borderRadius: 4 }}>
            <strong>使い方</strong>：
            <ol style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
              <li>下の「📋 プロンプトをコピー」をクリック</li>
              <li>ChatGPT / Claude.ai / Gemini を開いて貼り付ける（どれも無料アカウントでOK）</li>
              <li>図解化すべき箇所 <strong>3〜5案</strong> と各案の <strong>Mermaid 記法</strong> が返ってくる</li>
              <li>気に入った案の Mermaid 記法を <a href="https://mermaid.live/" target="_blank" rel="noreferrer" style={{ color: C.navyMid, fontWeight: 700 }}>mermaid.live</a> に貼り付け</li>
              <li>右ペインで描画される図を「Actions」→「PNG」でダウンロード</li>
              <li>Word の該当箇所に画像として貼り付け → サイズ・位置調整</li>
            </ol>
            <div style={{ marginTop: 6, fontSize: 11.5, color: C.text }}>
              💡 <strong>このフローのメリット</strong>：API キー不要・無料・図解サイズ自由（mermaid.live → PNG → Word で大きさ調整可能）
            </div>
          </div>

          {!hasBody && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 4, marginBottom: 12, fontSize: 13, color: C.red }}>
              先に本文を生成してから図解化案を取得してください。
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <button
              onClick={handleCopy}
              disabled={!hasBody}
              style={{
                fontSize: 13,
                padding: "8px 16px",
                background: hasBody ? C.navy : "rgba(0,0,0,0.15)",
                color: C.white,
                border: "none",
                borderRadius: 3,
                cursor: hasBody ? "pointer" : "default",
                fontWeight: 700,
              }}
            >
              📋 プロンプトをコピー
            </button>
            {copyMsg && (
              <span style={{ fontSize: 12, color: copyMsg.startsWith("✓") ? C.green : C.red, fontWeight: 600 }}>
                {copyMsg}
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>プロンプトプレビュー（参考・編集不可）：</div>
          <textarea
            value={prompt}
            readOnly
            rows={10}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 11.5,
              fontFamily: "Consolas, Menlo, monospace",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              lineHeight: 1.5,
              background: "#fafafa",
              color: C.text,
            }}
          />

          <div style={{ marginTop: 10, padding: "8px 12px", background: "#eef7ee", border: `1px solid rgba(45,122,79,0.3)`, borderRadius: 4, fontSize: 12, color: C.navyMid, lineHeight: 1.7 }}>
            <strong>💡 補足</strong>：mermaid.live で図を作ると、Word 側で「右クリック → サイズ変更」「テキストの折り返し」「中央揃え」など細かい調整が可能です。Word の中で図解の見え方を整えるのが、結果的に一番きれいに仕上がります。
          </div>
        </div>
      )}
    </div>
  );
};

export default MermaidPromptPanel;
