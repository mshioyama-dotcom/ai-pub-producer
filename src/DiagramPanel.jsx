// DiagramPanel
// 各STEPの本文に図解（Mermaid記法）を追加するためのパネル。
// 図解は本文（outputText）とは別のstateで管理し、localStorage に永続化する。
// 本文中には `[図解 N]` というマーカーを残し、Word保存時に該当する Mermaid を画像として埋め込む。
//
// 設計判断（Phase 2）:
//   - 図解タイプは Mermaid記法に一本化（フロー/比較/階層/時系列がすべて書ける）
//   - mermaid パッケージは動的importで読み込む（バンドル肥大化を避ける）
//   - パネルは折りたたみ可能（普段は閉じている）

import { useEffect, useRef, useState } from "react";

// 色トークン（App.jsxと同期）
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

// 図解テンプレート（種類別の初期Mermaid記法）
export const DIAGRAM_TEMPLATES = {
  flow: {
    label: "フロー図（読者の変化プロセス）",
    code: `graph LR
  A[今の自分] --> B[気づき]
  B --> C[小さな行動]
  C --> D[新しい景色]`,
  },
  compare: {
    label: "比較図（Before/After）",
    code: `graph TB
  subgraph Before
    a1[漠然とした不安]
    a2[行動できない]
  end
  subgraph After
    b1[現在地が明確]
    b2[次の一歩が見える]
  end`,
  },
  hierarchy: {
    label: "階層図（要素分解）",
    code: `graph TD
  Root[コア・ベネフィット] --> A[読者の悩み]
  Root --> B[本書の価値]
  Root --> C[読了後の状態]
  B --> B1[要素1]
  B --> B2[要素2]`,
  },
  timeline: {
    label: "時系列図",
    code: `timeline
  20代 : 自分探し
  30代 : 仕事に没頭
  40代 : 違和感
  50代 : ライフデザイン開始`,
  },
};

// 単一の図解カード
const DiagramCard = ({ diagram, index, onChange, onDelete, onInsertMarker }) => {
  const previewRef = useRef(null);
  const [renderError, setRenderError] = useState("");

  // mermaid を動的importしてプレビューをレンダリング
  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!previewRef.current || !diagram.code?.trim()) {
        if (previewRef.current) previewRef.current.innerHTML = "";
        setRenderError("");
        return;
      }
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default || mermaidModule;
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
        const id = `mermaid-preview-${diagram.id}-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram.code);
        if (cancelled) return;
        if (previewRef.current) {
          previewRef.current.innerHTML = svg;
          setRenderError("");
        }
      } catch (e) {
        if (cancelled) return;
        setRenderError(String(e?.message || e || "プレビューに失敗しました"));
        if (previewRef.current) previewRef.current.innerHTML = "";
      }
    }
    render();
    return () => { cancelled = true; };
  }, [diagram.code, diagram.id]);

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, padding: 12, marginBottom: 10, background: C.white }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
          図解 {index + 1}（本文では <code style={{ background: C.navyLight, padding: "1px 6px", borderRadius: 2 }}>[図解 {index + 1}]</code> として参照）
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onInsertMarker(index + 1)} style={{ fontSize: 11, padding: "4px 10px", background: C.gold, color: C.white, border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }} title="本文の末尾に [図解 N] マーカーを挿入します">
            📌 本文末尾に挿入
          </button>
          <button onClick={() => onDelete(diagram.id)} style={{ fontSize: 11, padding: "4px 10px", background: "#fef2f2", color: C.red, border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
            🗑 削除
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>Mermaid記法（編集可能）</div>
          <textarea
            value={diagram.code}
            onChange={(e) => onChange(diagram.id, { ...diagram, code: e.target.value })}
            rows={8}
            spellCheck={false}
            style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "Consolas, Menlo, monospace", border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5, background: "#fafafa" }}
          />
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>プレビュー</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 8, background: "#fafafa", minHeight: 120, overflow: "auto" }}>
            {renderError ? (
              <div style={{ fontSize: 11, color: C.red, lineHeight: 1.6 }}>⚠ Mermaid構文エラー：<br/>{renderError}</div>
            ) : (
              <div ref={previewRef} style={{ textAlign: "center" }} />
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11, color: C.textLight, display: "block", marginBottom: 4 }}>
          図解のキャプション（Word出力時に画像の下に表示・任意）
        </label>
        <input
          value={diagram.caption || ""}
          onChange={(e) => onChange(diagram.id, { ...diagram, caption: e.target.value })}
          placeholder="例: 読者の変化プロセス"
          style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box" }}
        />
      </div>
    </div>
  );
};

// 単一のAI提案カード（プレビュー＋採用ボタン）
const AiSuggestionCard = ({ suggestion, index, onAdopt }) => {
  const previewRef = useRef(null);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!previewRef.current || !suggestion.mermaid?.trim()) return;
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default || mermaidModule;
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
        const id = `mermaid-sug-${index}-${Date.now()}`;
        const { svg } = await mermaid.render(id, suggestion.mermaid);
        if (cancelled) return;
        if (previewRef.current) {
          previewRef.current.innerHTML = svg;
          setRenderError("");
        }
      } catch (e) {
        if (cancelled) return;
        setRenderError(String(e?.message || e || "プレビュー失敗"));
      }
    }
    render();
    return () => { cancelled = true; };
  }, [suggestion.mermaid, index]);

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, padding: 10, marginBottom: 8, background: C.white }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy }}>
          案{index + 1}{suggestion.title ? `：${suggestion.title}` : ""}
        </div>
        <button
          onClick={() => onAdopt(suggestion)}
          style={{ fontSize: 11, padding: "4px 10px", background: C.green, color: C.white, border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
        >
          ✓ この案で図解を追加
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: C.textLight, marginBottom: 2 }}>Mermaid記法</div>
          <pre style={{ margin: 0, padding: "6px 8px", fontSize: 11, fontFamily: "Consolas, Menlo, monospace", border: `1px solid ${C.border}`, borderRadius: 3, background: "#fafafa", overflow: "auto", maxHeight: 160, lineHeight: 1.4 }}>{suggestion.mermaid}</pre>
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: C.textLight, marginBottom: 2 }}>プレビュー</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 6, background: "#fafafa", minHeight: 100, overflow: "auto" }}>
            {renderError ? (
              <div style={{ fontSize: 10.5, color: C.red, lineHeight: 1.5 }}>⚠ {renderError}</div>
            ) : (
              <div ref={previewRef} style={{ textAlign: "center" }} />
            )}
          </div>
        </div>
      </div>
      {suggestion.caption && (
        <div style={{ marginTop: 6, fontSize: 11, color: C.textSub }}>
          📝 キャプション案：{suggestion.caption}
        </div>
      )}
    </div>
  );
};

const DiagramPanel = ({ diagrams, setDiagrams, onInsertMarkerToBody, outputText = "", authorProfile = "", workProfile = "" }) => {
  const [open, setOpen] = useState(false);

  // AI下書き生成用 state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBodyText, setAiBodyText] = useState("");
  const [aiHint, setAiHint] = useState("");
  const [aiType, setAiType] = useState("flow");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const handleGenerateAi = async () => {
    setAiError("");
    setAiSuggestions([]);
    if (!aiBodyText.trim() && !aiHint.trim()) {
      setAiError("「図解にしたい本文」または「ヒント」のどちらかは入力してください。");
      return;
    }
    setAiLoading(true);
    try {
      const response = await fetch("/api/diagram-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: aiBodyText,
          diagramType: aiType,
          hint: aiHint,
          authorProfile,
          workProfile,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAiError(data?.error || `生成に失敗しました（HTTP ${response.status}）`);
        return;
      }
      if (data.warning) setAiError(`⚠ ${data.warning}`);
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (e) {
      setAiError(`通信エラー：${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const adoptSuggestion = (suggestion) => {
    const newId = Date.now();
    const newDiagrams = [
      ...diagrams,
      { id: newId, type: aiType, code: suggestion.mermaid, caption: suggestion.caption || suggestion.title || "" },
    ];
    setDiagrams(newDiagrams);
    // 採用後は AI セクションをリセット（連続生成しやすく）
    setAiSuggestions([]);
    setAiBodyText("");
    setAiHint("");
  };

  const useCurrentBodyAsAiInput = () => {
    setAiBodyText((outputText || "").slice(0, 4000));
  };

  const addDiagram = (templateKey) => {
    const template = DIAGRAM_TEMPLATES[templateKey] || DIAGRAM_TEMPLATES.flow;
    const newId = Date.now();
    const newDiagrams = [...diagrams, { id: newId, type: templateKey, code: template.code, caption: "" }];
    setDiagrams(newDiagrams);
  };

  const updateDiagram = (id, updated) => {
    const newDiagrams = diagrams.map((d) => (d.id === id ? updated : d));
    setDiagrams(newDiagrams);
  };

  const deleteDiagram = (id) => {
    if (!window.confirm("この図解を削除します。本文中の対応するマーカー（[図解 N]）も手作業で削除してください。続行しますか？")) return;
    const newDiagrams = diagrams.filter((d) => d.id !== id);
    setDiagrams(newDiagrams);
  };

  const handleInsertMarker = (figNum) => {
    if (typeof onInsertMarkerToBody === "function") {
      onInsertMarkerToBody(`[図解 ${figNum}]`);
    }
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
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
          📊 図解を追加する（Mermaid記法・Word出力時に画像として埋め込まれます）
          {diagrams.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: C.gold, fontWeight: 600 }}>
              現在 {diagrams.length} 個
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.textSub }}>{open ? "▲ 閉じる" : "▼ 開く"}</div>
      </div>

      {open && (
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7, marginBottom: 12, padding: "8px 12px", background: "#fff7e6", border: "1px solid #ffd591", borderRadius: 4 }}>
            <strong>使い方</strong>：
            <ol style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
              <li>テンプレートから図解を追加（Mermaid記法で自動入力されます）</li>
              <li>記法を編集 → プレビューが自動更新されます</li>
              <li>「📌 本文末尾に挿入」で本文に <code>[図解 N]</code> マーカーが入る</li>
              <li>Word保存時、マーカーの位置に図解の画像が自動で埋め込まれます</li>
            </ol>
          </div>

          {/* テンプレート追加ボタン */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 6 }}>新しい図解を追加（テンプレートから）：</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(DIAGRAM_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => addDiagram(key)}
                  style={{ fontSize: 11.5, padding: "6px 12px", background: C.navy, color: C.white, border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
                >
                  + {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI下書き生成セクション */}
          <div style={{ marginBottom: 14, border: `1px solid ${C.goldLight}`, borderRadius: 4, background: C.goldPale }}>
            <div
              onClick={() => setAiOpen(!aiOpen)}
              style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gold }}>
                ✨ AIに下書きを作らせる（本文セクションから3案提案）
              </div>
              <div style={{ fontSize: 11.5, color: C.textSub }}>{aiOpen ? "▲ 閉じる" : "▼ 開く"}</div>
            </div>
            {aiOpen && (
              <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${C.goldLight}` }}>
                <div style={{ marginTop: 10, marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: C.textLight, display: "block", marginBottom: 4 }}>
                    図解にしたい本文（該当章・節の本文をペースト・最大4000字）
                  </label>
                  <textarea
                    value={aiBodyText}
                    onChange={(e) => setAiBodyText(e.target.value.slice(0, 4000))}
                    rows={5}
                    placeholder="本文の該当部分をペーストしてください（または『現在の本文を全部使う』ボタンで)"
                    style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5, background: C.white }}
                  />
                  <div style={{ marginTop: 4, fontSize: 10.5, color: C.textLight, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span>{aiBodyText.length} / 4000 字</span>
                    {outputText && outputText.trim() && (
                      <button
                        onClick={useCurrentBodyAsAiInput}
                        style={{ fontSize: 10.5, padding: "2px 8px", background: C.white, color: C.navy, border: `1px solid ${C.navy}`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
                      >
                        📋 現在の本文（先頭4000字）を取り込む
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: C.textLight, display: "block", marginBottom: 4 }}>
                    ヒント（任意・「Before/After を比較したい」「変化プロセスを見せたい」など）
                  </label>
                  <input
                    value={aiHint}
                    onChange={(e) => setAiHint(e.target.value)}
                    placeholder="例: 読者の不安が解消されるプロセスを段階的に示したい"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", background: C.white }}
                  />
                </div>
                <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: 11, color: C.textLight }}>図解タイプ：</label>
                  <select
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value)}
                    style={{ fontSize: 12, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.white }}
                  >
                    <option value="flow">フロー図</option>
                    <option value="compare">比較図（Before/After）</option>
                    <option value="hierarchy">階層図</option>
                    <option value="timeline">時系列図</option>
                  </select>
                  <button
                    onClick={handleGenerateAi}
                    disabled={aiLoading}
                    style={{ marginLeft: "auto", fontSize: 12, padding: "6px 14px", background: aiLoading ? "rgba(0,0,0,0.2)" : C.gold, color: C.white, border: "none", borderRadius: 3, cursor: aiLoading ? "default" : "pointer", fontWeight: 700 }}
                  >
                    {aiLoading ? "⏳ 生成中（最大30秒）…" : "✨ 3案を生成"}
                  </button>
                </div>
                {aiError && (
                  <div style={{ marginBottom: 10, padding: "8px 10px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 3, fontSize: 11.5, color: C.red, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {aiError}
                  </div>
                )}
                {aiSuggestions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                      生成された下書き案（{aiSuggestions.length} 個）：
                    </div>
                    {aiSuggestions.map((s, i) => (
                      <AiSuggestionCard key={i} suggestion={s} index={i} onAdopt={adoptSuggestion} />
                    ))}
                    <div style={{ fontSize: 10.5, color: C.textLight, marginTop: 4 }}>
                      💡 採用後は下の図解一覧に追加されます。記法を微調整したり、別の案を採用するときは再度「3案を生成」してください。
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 既存図解一覧 */}
          {diagrams.length === 0 ? (
            <div style={{ fontSize: 12, color: C.textLight, textAlign: "center", padding: "20px 0", border: `1px dashed ${C.border}`, borderRadius: 4 }}>
              まだ図解はありません。上のボタンから追加してください。
            </div>
          ) : (
            <div>
              {diagrams.map((d, i) => (
                <DiagramCard
                  key={d.id}
                  diagram={d}
                  index={i}
                  onChange={updateDiagram}
                  onDelete={deleteDiagram}
                  onInsertMarker={handleInsertMarker}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Mermaid記法を SVG → PNG（dataURL）に変換するユーティリティ。
// Word保存時に呼ばれる。動的importで mermaid を読み込むため async。
//
// 失敗ケース:
//   - Mermaid 構文エラー → null を返す
//   - canvas エラー → null を返す（呼び出し側でスキップ判定）
export async function renderMermaidToPng(code, options = {}) {
  if (!code || !code.trim()) return null;
  try {
    const mermaidModule = await import("mermaid");
    const mermaid = mermaidModule.default || mermaidModule;
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    const id = `mermaid-export-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { svg } = await mermaid.render(id, code);

    // SVG → Image → Canvas → PNG dataURL
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    img.src = svgUrl;
    await loaded;

    const scale = options.scale || 2;
    const canvas = document.createElement("canvas");
    canvas.width = (img.naturalWidth || 600) * scale;
    canvas.height = (img.naturalHeight || 400) * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(svgUrl);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (e) {
    console.error("renderMermaidToPng failed:", e);
    return null;
  }
}

export default DiagramPanel;
