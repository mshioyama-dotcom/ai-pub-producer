// DiagramStepPage
// STEP9（本文作成）の後段に位置する独立ページ。
// 本文を読み込み → 章ごとに Mermaid 記法で図解を作成 → Word/PNG で出力。
//
// 設計判断:
//   - STEP番号を持たない独立ページ（旧 step_confirm パターン）
//   - 入力ソース3種：STEP9出力引き継ぎ／ファイルアップロード／直接貼付
//   - 章境界（=== タイトル === / 第◯章）を自動検出して章リストを表示
//   - 各章末に図解を自動配置（マーカー不要・章境界だけで決まる）
//   - 出力：①本文+図解Word ②図解のみWord ③PNG ZIP
//   - localStorage 永続化（key: aipub:diagram_step_chapters）

import { useEffect, useMemo, useRef, useState } from "react";
import { extractTextFromFile, buildSourceText, ACCEPTED_EXTENSIONS } from "./utils/extractText";

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
  greenLight: "#eaf3ed",
  red:        "#b52b1e",
};

// 図解テンプレート
const DIAGRAM_TEMPLATES = {
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
    subgraph Before["Before（読了前）"]
        a1[漠然とした不安]
        a2[行動できない]
    end
    subgraph After["After（読了後）"]
        b1[現在地が明確]
        b2[次の一歩が見える]
    end`,
  },
  hierarchy: {
    label: "階層図（要素分解）",
    code: `graph TD
    Root[ライフデザイン] --> A[気づき]
    Root --> B[計画]
    Root --> C[行動]
    A --> A1[違和感を認める]
    B --> B1[5年後を描く]
    C --> C1[小さく始める]`,
  },
  timeline: {
    label: "時系列図（年表）",
    code: `timeline
    title 著者の50年
    20代 : 仕事に没頭
         : 結婚・子育て
    30代 : 起業・失敗
    40代 : 立て直し
    50代 : 障がい者グループホーム立ち上げ`,
  },
};

const DIAGRAMS_STORAGE_KEY = "aipub:diagram_step_chapters";

// localStorage から章×図解の状態を取り出す
function loadStoredChapters() {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(DIAGRAMS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch { return {}; }
}

function saveStoredChapters(state) {
  try {
    if (typeof window !== "undefined") localStorage.setItem(DIAGRAMS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.error(e); }
}

// 本文テキストから章ブロックを抽出する。
// 「=== タイトル ===」or「第◯章 タイトル」or「# タイトル」を章境界とみなす。
// 戻り値: [{ title, body, key }]
function extractChapters(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/);
  const chapters = [];
  let current = null;

  const flush = () => {
    if (current) {
      current.body = current.body.replace(/^\s+|\s+$/g, "");
      chapters.push(current);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const t = line.trim();
    // 章境界の判定（優先順位順）
    let chapTitle = null;
    const m1 = t.match(/^===\s*(.+?)\s*===$/);
    if (m1) chapTitle = m1[1].trim();
    if (!chapTitle) {
      const m2 = t.match(/^#\s+(.+)$/);
      if (m2) chapTitle = m2[1].trim();
    }
    if (!chapTitle && /^第[0-9０-９一二三四五六七八九十百千]+章/.test(t)) {
      chapTitle = t;
    }
    if (chapTitle) {
      flush();
      current = { title: chapTitle, body: "", key: `ch_${chapters.length}_${chapTitle.slice(0, 30)}` };
      continue;
    }
    // 章セパレーター「---」は無視
    if (/^-{3,}$/.test(t)) continue;
    if (current) {
      current.body += rawLine + "\n";
    } else {
      // 最初の章境界が来る前の段落は「序文」として扱う
      if (chapters.length === 0 && !current) {
        current = { title: "(章前の本文)", body: "", key: "preamble" };
      }
      current.body += rawLine + "\n";
    }
  }
  flush();
  return chapters;
}

// 章本文を「段落」単位に分割する（空行区切り）。Word出力時の挿入位置指定に使う。
// 戻り値: [{ index: 1, text: "..." }, ...]  (index は 1 始まり)
function extractParagraphs(body) {
  if (!body || !body.trim()) return [];
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((s, i) => ({ index: i + 1, text: s.replace(/^\s+|\s+$/g, "") }))
    .filter((p) => p.text.length > 0);
}

// 段落プレビュー用：最初の N 文字を切り取る
function paragraphPreview(text, max = 18) {
  const t = (text || "").replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// Mermaid → PNG dataURL（堅牢化版）
// 改善ポイント:
//   1. SVG の width/height を viewBox から復元（mermaid が省略するケース対応）
//   2. blob URL ではなく data URL（base64エンコード）で Image にロード（CORS/汚染回避）
//   3. encodeURIComponent + btoa の組み合わせで日本語にも対応
//   4. 各段階で詳細ログ（失敗箇所が console に出るように）
async function renderMermaidToPng(code, options = {}) {
  if (!code || !code.trim()) return null;
  try {
    const mermaidModule = await import("mermaid");
    const mermaid = mermaidModule.default || mermaidModule;
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    const id = `mermaid-export-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let svg;
    try {
      const result = await mermaid.render(id, code);
      svg = result.svg;
    } catch (e) {
      console.error("[diagram] Mermaid render failed:", e);
      return null;
    }
    if (!svg) {
      console.error("[diagram] Mermaid returned empty SVG");
      return null;
    }

    // SVG をパースして width/height を取り出す（無ければ viewBox から補う）
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgRoot = svgDoc.documentElement;
    if (svgRoot.tagName.toLowerCase() !== "svg") {
      console.error("[diagram] root element is not <svg>:", svgRoot.tagName);
      return null;
    }
    let width = parseFloat(svgRoot.getAttribute("width") || "") || 0;
    let height = parseFloat(svgRoot.getAttribute("height") || "") || 0;
    if (!width || !height) {
      const viewBox = svgRoot.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.trim().split(/\s+/);
        if (parts.length === 4) {
          if (!width) width = parseFloat(parts[2]) || 0;
          if (!height) height = parseFloat(parts[3]) || 0;
        }
      }
    }
    if (!width) width = 600;
    if (!height) height = 400;
    // SVGに明示的に width/height を設定
    svgRoot.setAttribute("width", String(width));
    svgRoot.setAttribute("height", String(height));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRoot);
    // 日本語などUTF-8文字を含むSVGを安全にdataURL化
    const svgDataUrl = "data:image/svg+xml;charset=utf-8;base64," +
      btoa(unescape(encodeURIComponent(svgString)));

    const img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error("SVGをImageに読み込めませんでした"));
        img.src = svgDataUrl;
      });
    } catch (e) {
      console.error("[diagram] Image load failed:", e);
      return null;
    }

    const scale = options.scale || 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      console.error("[diagram] drawImage failed:", e);
      return null;
    }

    let dataUrl;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch (e) {
      console.error("[diagram] toDataURL failed (canvas may be tainted):", e);
      return null;
    }
    return { dataUrl, width: canvas.width, height: canvas.height };
  } catch (e) {
    console.error("[diagram] renderMermaidToPng top-level failure:", e);
    return null;
  }
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = (dataUrl || "").split(",")[1] || "";
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// Mermaid プレビューカード（編集時のリアルタイム表示用）
const MermaidPreview = ({ code, error, setError }) => {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!ref.current || !code?.trim()) {
        if (ref.current) ref.current.innerHTML = "";
        setError("");
        return;
      }
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default || mermaidModule;
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
        const id = `mermaid-prev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { svg } = await mermaid.render(id, code);
        if (cancelled) return;
        if (ref.current) {
          ref.current.innerHTML = svg;
          setError("");
        }
      } catch (e) {
        if (cancelled) return;
        setError(String(e?.message || e || "プレビュー失敗"));
      }
    }
    render();
    return () => { cancelled = true; };
  }, [code, setError]);
  return error ? (
    <div style={{ fontSize: 11, color: C.red, lineHeight: 1.6, padding: 8 }}>⚠ Mermaid構文エラー：<br/>{error}</div>
  ) : (
    <div ref={ref} style={{ textAlign: "center", padding: 8 }} />
  );
};

// 1つの図解編集パネル
const DiagramEditor = ({ diagram, onChange, onDelete, chapterTitle, figNumber, paragraphs }) => {
  const [previewError, setPreviewError] = useState("");
  // position: 0 (=章末) または 1〜N (=段落Nの後)
  const position = typeof diagram.position === "number" ? diagram.position : 0;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, padding: 12, marginBottom: 10, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
          図 {figNumber}：{diagram.caption || "(キャプション未設定)"}
        </div>
        <button onClick={onDelete} style={{ fontSize: 11, padding: "4px 10px", background: "#fef2f2", color: C.red, border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
          🗑 削除
        </button>
      </div>

      {/* 挿入位置の指定 */}
      <div style={{ marginBottom: 10, padding: "8px 10px", background: C.goldPale, border: `1px solid ${C.goldLight}`, borderRadius: 3 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: C.navy, display: "block", marginBottom: 4 }}>
          挿入位置：
        </label>
        <select
          value={position}
          onChange={(e) => onChange({ ...diagram, position: parseInt(e.target.value, 10) })}
          style={{ fontSize: 12, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, maxWidth: "100%" }}
        >
          <option value={0}>章末（デフォルト）</option>
          {paragraphs.map((p) => (
            <option key={p.index} value={p.index}>
              段落 {p.index} の後：「{paragraphPreview(p.text, 24)}」
            </option>
          ))}
        </select>
        <div style={{ marginTop: 4, fontSize: 10.5, color: C.textLight, lineHeight: 1.5 }}>
          ※ 「段落」は本文の空行区切りで判定されます。挿入位置はWord出力時に反映されます。
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>Mermaid 記法（編集可能）</div>
          <textarea
            value={diagram.code}
            onChange={(e) => onChange({ ...diagram, code: e.target.value })}
            rows={8}
            spellCheck={false}
            style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "Consolas, Menlo, monospace", border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5, background: C.white }}
          />
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>プレビュー</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, minHeight: 120, maxHeight: 280, overflow: "auto" }}>
            <MermaidPreview code={diagram.code} error={previewError} setError={setPreviewError} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11, color: C.textLight, display: "block", marginBottom: 4 }}>
          キャプション（Word出力時に画像の下に表示）
        </label>
        <input
          value={diagram.caption || ""}
          onChange={(e) => onChange({ ...diagram, caption: e.target.value })}
          placeholder={`例: ${chapterTitle.slice(0, 20)} の変化プロセス`}
          style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", background: C.white }}
        />
      </div>
    </div>
  );
};

// 章セクション（章タイトル＋既存図解一覧＋追加ボタン）
const ChapterSection = ({ chapter, chapterIndex, diagrams, onChange, onDelete, onAdd }) => {
  // 章本文を段落単位に分解（挿入位置プルダウン用）
  const paragraphs = useMemo(() => extractParagraphs(chapter.body), [chapter.body]);
  return (
    <div style={{ marginBottom: 18, padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 4, background: C.white }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
        📖 {chapter.title}
      </div>
      <div style={{ fontSize: 11, color: C.textLight, marginBottom: 10 }}>
        この章：{paragraphs.length} 段落 / 図解：{diagrams.length} 個
      </div>
      {diagrams.length === 0 && (
        <div style={{ fontSize: 12, color: C.textLight, padding: "10px 12px", border: `1px dashed ${C.border}`, borderRadius: 3, textAlign: "center", marginBottom: 10 }}>
          まだ図解はありません。下のボタンから追加してください。
        </div>
      )}
      {diagrams.map((d, i) => (
        <DiagramEditor
          key={d.id}
          diagram={d}
          figNumber={`${chapterIndex + 1}-${i + 1}`}
          chapterTitle={chapter.title}
          paragraphs={paragraphs}
          onChange={(next) => onChange(d.id, next)}
          onDelete={() => onDelete(d.id)}
        />
      ))}
      <div style={{ fontSize: 12, color: C.text, marginTop: 4, marginBottom: 6 }}>この章に図解を追加（テンプレートから）：</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(DIAGRAM_TEMPLATES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => onAdd(key)}
            style={{ fontSize: 11.5, padding: "5px 10px", background: C.navy, color: C.white, border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
          >
            + {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const DiagramStepPage = ({ onNavigate, allSteps }) => {
  // 本文ソース
  const [sourceText, setSourceText] = useState("");
  const [sourceMode, setSourceMode] = useState("none"); // "none" | "step9" | "file" | "paste"
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [pasteText, setPasteText] = useState("");

  // 章×図解の永続化マップ：{ [chapterKey]: [{id, code, caption}] }
  const [byChapter, setByChapter] = useState(() => loadStoredChapters());

  // 出力状態
  const [outputMsg, setOutputMsg] = useState("");
  const [outputError, setOutputError] = useState("");

  // 本文ソースから章を抽出
  const chapters = useMemo(() => extractChapters(sourceText), [sourceText]);

  // STEP9 の出力データが利用可能か
  const step9Output = (allSteps?.[9]?.outputText || "").trim();

  // 章別図解の更新ヘルパー
  const updateDiagrams = (chapterKey, updater) => {
    setByChapter((prev) => {
      const list = prev[chapterKey] || [];
      const next = { ...prev, [chapterKey]: updater(list) };
      saveStoredChapters(next);
      return next;
    });
  };

  const handleAddDiagram = (chapterKey, templateKey) => {
    const t = DIAGRAM_TEMPLATES[templateKey] || DIAGRAM_TEMPLATES.flow;
    const newDiagram = { id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, type: templateKey, code: t.code, caption: "" };
    updateDiagrams(chapterKey, (list) => [...list, newDiagram]);
  };

  const handleChangeDiagram = (chapterKey, id, updated) => {
    updateDiagrams(chapterKey, (list) => list.map((d) => (d.id === id ? updated : d)));
  };

  const handleDeleteDiagram = (chapterKey, id) => {
    if (!window.confirm("この図解を削除します。続行しますか？")) return;
    updateDiagrams(chapterKey, (list) => list.filter((d) => d.id !== id));
  };

  // 本文の取り込み
  const handleUseStep9 = () => {
    if (!step9Output) {
      alert("STEP9 の出力データがまだ保存されていません。STEP9 で本文を生成・保存してから戻ってきてください。");
      return;
    }
    setSourceText(step9Output);
    setSourceMode("step9");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setFileError("");
    try {
      const text = await extractTextFromFile(file);
      const cleaned = buildSourceText(text || "");
      setSourceText(cleaned);
      setSourceMode("file");
    } catch (err) {
      setFileError(`ファイル読み込みに失敗：${err?.message || err}`);
    } finally {
      setFileLoading(false);
      e.target.value = "";
    }
  };

  const handleUsePaste = () => {
    if (!pasteText.trim()) {
      alert("テキストを貼り付けてください。");
      return;
    }
    setSourceText(pasteText);
    setSourceMode("paste");
  };

  const handleClearSource = () => {
    if (!window.confirm("読み込み済みの本文をクリアします。章ごとに作成した図解はそのまま残りますが、本文と紐づけできなくなります。続行しますか？")) return;
    setSourceText("");
    setSourceMode("none");
    setPasteText("");
  };

  // 出力①：本文+図解 Word
  const handleExportFullDocx = async () => {
    setOutputError("");
    if (!sourceText.trim() || chapters.length === 0) {
      setOutputError("本文が読み込まれていません。先に本文を取り込んでください。");
      return;
    }
    setOutputMsg("⏳ 本文+図解 Word を生成中…");
    try {
      const docxModule = await import("docx");
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun } = docxModule;
      const children = [];

      // 表紙
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [new TextRun({ text: "本文＋図解（AI出版プロデューサー）", bold: true, size: 32 })],
      }));

      // 図解を1つ分の Paragraph 配列に変換するヘルパー（章末・段落間共通）
      const buildDiagramParagraphs = async (d, figLabel) => {
        const out = [];
        const png = await renderMermaidToPng(d.code, { scale: 2 });
        if (!png) {
          out.push(new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: `[図 ${figLabel} の生成に失敗（Mermaid 構文を確認してください）]`, italics: true, color: "b52b1e", size: 20 })],
          }));
          return out;
        }
        // 表示サイズ：min 400 / max 680 px に収める（小さい図解は拡大、大きい図解は縮小）
        // canvas は scale=2 で生成しているので半分にしてから min/max を適用
        const minW = 400;
        const maxW = 680;
        let dispW = png.width / 2;
        let dispH = png.height / 2;
        if (dispW < minW) {
          const r = minW / dispW;
          dispW = minW;
          dispH = Math.round(dispH * r);
        } else if (dispW > maxW) {
          const r = maxW / dispW;
          dispW = maxW;
          dispH = Math.round(dispH * r);
        }
        out.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 80 },
          children: [new ImageRun({
            data: dataUrlToUint8Array(png.dataUrl),
            transformation: { width: dispW, height: dispH },
          })],
        }));
        const caption = `図 ${figLabel}${d.caption ? `：${d.caption}` : ""}`;
        out.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 },
          children: [new TextRun({ text: caption, italics: true, size: 18, color: "666666" })],
        }));
        return out;
      };

      let isFirst = true;
      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        // 章タイトル（最初の章を除いて改ページ）
        const titleRuns = [];
        if (!isFirst) titleRuns.push(new TextRun({ children: [new PageBreak()] }));
        titleRuns.push(new TextRun({ text: ch.title, bold: true, size: 36 }));
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 200 },
          children: titleRuns,
        }));
        isFirst = false;

        // 章本文を段落単位（空行区切り）に分解。各段落の終わりで挿入位置とマッチング
        const chDiagrams = byChapter[ch.key] || [];
        const paragraphsForCh = extractParagraphs(ch.body);

        // 段落 N の後に入れる図解をグルーピング
        // grouped: { [paragraphIndex]: [diagrams ...] } 、0 = 章末
        const grouped = { 0: [] };
        for (let di = 0; di < chDiagrams.length; di++) {
          const d = chDiagrams[di];
          const pos = typeof d.position === "number" ? d.position : 0;
          const validPos = pos > 0 && pos <= paragraphsForCh.length ? pos : 0;
          if (!grouped[validPos]) grouped[validPos] = [];
          grouped[validPos].push({ diagram: d, originalIndex: di });
        }

        // 段落を順番に Paragraph 化しつつ、その段落の後に紐づく図解を挿入
        for (let pi = 0; pi < paragraphsForCh.length; pi++) {
          const para = paragraphsForCh[pi];
          // 段落内の改行（複数行段落）を1段落として保持しつつ、各行を解釈
          const lines = para.text.split(/\r?\n/);
          for (const line of lines) {
            const t = line.trim();
            if (!t) {
              children.push(new Paragraph({ children: [] }));
              continue;
            }
            if (/^[（(]\s*[0-9０-９]+\s*[)）]/.test(t)) {
              children.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 240, after: 120 },
                children: [new TextRun({ text: t, bold: true, size: 28 })],
              }));
              continue;
            }
            if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(t)) {
              children.push(new Paragraph({
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 },
                children: [new TextRun({ text: t, bold: true, size: 24 })],
              }));
              continue;
            }
            children.push(new Paragraph({
              spacing: { before: 100, after: 100, line: 360 },
              children: [new TextRun({ text: t, size: 22 })],
            }));
          }
          // 段落間に空行を1つ入れる
          children.push(new Paragraph({ children: [] }));

          // この段落の後に挿入する図解があれば配置
          const inserts = grouped[para.index] || [];
          for (const { diagram: d, originalIndex } of inserts) {
            const figLabel = `${ci + 1}-${originalIndex + 1}`;
            const paras = await buildDiagramParagraphs(d, figLabel);
            for (const p of paras) children.push(p);
          }
        }

        // 章末に入れる図解（position=0 または無効値）
        const endInserts = grouped[0] || [];
        for (const { diagram: d, originalIndex } of endInserts) {
          const figLabel = `${ci + 1}-${originalIndex + 1}`;
          const paras = await buildDiagramParagraphs(d, figLabel);
          for (const p of paras) children.push(p);
        }
      }

      const doc = new Document({
        creator: "AI出版プロデューサー",
        title: "本文+図解",
        styles: { default: { document: { run: { font: { name: "Yu Gothic", hint: "eastAsia" } } } } },
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `AI出版_本文と図解_${timestamp()}.docx`);
      setOutputMsg("✓ 本文+図解 Word をダウンロードしました");
      setTimeout(() => setOutputMsg(""), 4000);
    } catch (e) {
      console.error(e);
      setOutputError(`Word 生成失敗：${e?.message || e}`);
      setOutputMsg("");
    }
  };

  // 出力②：図解のみ Word
  const handleExportDiagramsOnlyDocx = async () => {
    setOutputError("");
    setOutputMsg("⏳ 図解のみ Word を生成中…");
    try {
      const docxModule = await import("docx");
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun } = docxModule;
      const children = [];
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [new TextRun({ text: "図解集（AI出版プロデューサー）", bold: true, size: 32 })],
      }));
      let hasAny = false;
      let isFirst = true;
      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        const diagrams = byChapter[ch.key] || [];
        if (diagrams.length === 0) continue;
        const titleRuns = [];
        if (!isFirst) titleRuns.push(new TextRun({ children: [new PageBreak()] }));
        titleRuns.push(new TextRun({ text: ch.title, bold: true, size: 32 }));
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 200 },
          children: titleRuns,
        }));
        isFirst = false;
        for (let di = 0; di < diagrams.length; di++) {
          const d = diagrams[di];
          const png = await renderMermaidToPng(d.code, { scale: 2 });
          if (!png) continue;
          // min/max 幅で読みやすいサイズに調整
          const minW = 400;
          const maxW = 680;
          let dispW = png.width / 2;
          let dispH = png.height / 2;
          if (dispW < minW) { const r = minW / dispW; dispW = minW; dispH = Math.round(dispH * r); }
          else if (dispW > maxW) { const r = maxW / dispW; dispW = maxW; dispH = Math.round(dispH * r); }
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 80 },
            children: [new ImageRun({ data: dataUrlToUint8Array(png.dataUrl), transformation: { width: dispW, height: dispH } })],
          }));
          const caption = `図 ${ci + 1}-${di + 1}${d.caption ? `：${d.caption}` : ""}`;
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 240 },
            children: [new TextRun({ text: caption, italics: true, size: 18, color: "666666" })],
          }));
          hasAny = true;
        }
      }
      if (!hasAny) {
        setOutputError("出力可能な図解が1つもありません。各章で図解を追加してから再実行してください。");
        setOutputMsg("");
        return;
      }
      const doc = new Document({
        creator: "AI出版プロデューサー",
        title: "図解集",
        styles: { default: { document: { run: { font: { name: "Yu Gothic", hint: "eastAsia" } } } } },
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `AI出版_図解集_${timestamp()}.docx`);
      setOutputMsg("✓ 図解のみ Word をダウンロードしました");
      setTimeout(() => setOutputMsg(""), 4000);
    } catch (e) {
      console.error(e);
      setOutputError(`Word 生成失敗：${e?.message || e}`);
      setOutputMsg("");
    }
  };

  // 出力③：PNG ZIP
  const handleExportPngZip = async () => {
    setOutputError("");
    setOutputMsg("⏳ PNG ZIP を生成中…");
    try {
      const jszipModule = await import("jszip");
      const JSZip = jszipModule.default || jszipModule;
      const zip = new JSZip();
      let count = 0;
      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        const diagrams = byChapter[ch.key] || [];
        for (let di = 0; di < diagrams.length; di++) {
          const d = diagrams[di];
          const png = await renderMermaidToPng(d.code, { scale: 2 });
          if (!png) continue;
          const blob = dataUrlToBlob(png.dataUrl);
          const safeTitle = ch.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
          const safeCaption = (d.caption || "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
          const fname = `図${ci + 1}-${di + 1}_${safeTitle}${safeCaption ? `_${safeCaption}` : ""}.png`;
          zip.file(fname, blob);
          count += 1;
        }
      }
      if (count === 0) {
        setOutputError("出力可能な図解が1つもありません。各章で図解を追加してから再実行してください。");
        setOutputMsg("");
        return;
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `AI出版_図解PNG_${timestamp()}.zip`);
      setOutputMsg(`✓ PNG ${count} 枚を ZIP でダウンロードしました`);
      setTimeout(() => setOutputMsg(""), 4000);
    } catch (e) {
      console.error(e);
      setOutputError(`PNG ZIP 生成失敗：${e?.message || e}`);
      setOutputMsg("");
    }
  };

  // 合計図解数
  const totalDiagrams = Object.values(byChapter).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4, letterSpacing: "0.08em" }}>DIAGRAM STEP</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 6px", letterSpacing: "-0.01em" }}>📊 図解作成</h1>
          <p style={{ fontSize: 13.5, color: C.textSub, margin: 0, lineHeight: 1.7 }}>
            本文の章ごとに Mermaid 記法で図解を作成し、Word／PNG として出力します。AI も外部API も使いません（完全にブラウザ内で動作）。
          </p>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, ${C.goldLight}, transparent)`, width: "100%", opacity: 0.9, marginBottom: 20 }} />

      {/* ① 本文の読み込み */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 10 }}>① 本文を読み込む</h2>
        {sourceMode === "none" ? (
          <div style={{ background: "#eef2f7", border: "1px solid #c8d4e0", borderRadius: 4, padding: 14 }}>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.7 }}>
              本文を3つの方法から読み込めます：
            </div>

            <div style={{ marginBottom: 12, padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                A. STEP9（本文作成）の出力を引き継ぐ
              </div>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8 }}>
                {step9Output
                  ? `STEP9 で保存済みの本文（${step9Output.length.toLocaleString()} 文字）を使います。`
                  : "STEP9 でまだ本文を保存していません。"}
              </div>
              <button onClick={handleUseStep9} disabled={!step9Output}
                style={{ fontSize: 12.5, padding: "6px 14px", background: step9Output ? C.navy : "rgba(0,0,0,0.2)", color: C.white, border: "none", borderRadius: 3, cursor: step9Output ? "pointer" : "default", fontWeight: 600 }}>
                📋 STEP9 の出力を取り込む
              </button>
            </div>

            <div style={{ marginBottom: 12, padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                B. ファイルをアップロード（.docx / .pdf / .txt / .md）
              </div>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8 }}>
                手元で編集した完成版 Word をアップロードできます。{ACCEPTED_EXTENSIONS}
              </div>
              <input type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileUpload} disabled={fileLoading}
                style={{ fontSize: 12 }} />
              {fileLoading && <div style={{ fontSize: 11.5, color: C.navy, marginTop: 6 }}>⏳ ファイル読み込み中…</div>}
              {fileError && <div style={{ fontSize: 11.5, color: C.red, marginTop: 6 }}>⚠ {fileError}</div>}
            </div>

            <div style={{ padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                C. テキストを直接貼り付ける
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                placeholder={`本文を貼り付けてください。\n章境界は「=== 第1章 ◯◯ ===」「第1章 ◯◯」「# 第1章 ◯◯」のいずれかで検出されます。`}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }}
              />
              <button onClick={handleUsePaste}
                style={{ marginTop: 6, fontSize: 12.5, padding: "6px 14px", background: C.navy, color: C.white, border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
                📋 この本文を取り込む
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: C.greenLight, border: `1px solid rgba(45,122,79,0.25)`, borderRadius: 4, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: C.green, fontWeight: 600 }}>
              ✓ 本文を取り込み済み（{sourceMode === "step9" ? "STEP9から" : sourceMode === "file" ? "ファイルから" : "直接貼付"}・{sourceText.length.toLocaleString()} 文字・{chapters.length} 章を検出）
            </div>
            <button onClick={handleClearSource}
              style={{ fontSize: 11.5, padding: "5px 12px", background: C.white, color: C.navy, border: `1px solid ${C.navy}`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
              🔄 本文を再読込
            </button>
          </div>
        )}
      </div>

      {/* ② 章ごとに図解を作成 */}
      {chapters.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 10 }}>
            ② 章ごとに図解を作成
            <span style={{ marginLeft: 10, fontSize: 11, color: C.textLight, fontWeight: 400 }}>
              （現在 {totalDiagrams} 個の図解 / {chapters.length} 章）
            </span>
          </h2>
          {chapters.map((ch, idx) => (
            <ChapterSection
              key={ch.key}
              chapter={ch}
              chapterIndex={idx}
              diagrams={byChapter[ch.key] || []}
              onAdd={(tplKey) => handleAddDiagram(ch.key, tplKey)}
              onChange={(id, updated) => handleChangeDiagram(ch.key, id, updated)}
              onDelete={(id) => handleDeleteDiagram(ch.key, id)}
            />
          ))}
        </div>
      )}

      {/* ③ 出力 */}
      {chapters.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 10 }}>③ 出力</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={handleExportFullDocx}
              style={{ fontSize: 13, padding: "8px 16px", background: C.gold, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
              title="章末に図解を自動配置した完成版 Word">
              📥 本文+図解 Word を出力
            </button>
            <button onClick={handleExportDiagramsOnlyDocx}
              style={{ fontSize: 13, padding: "8px 16px", background: C.navy, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
              title="図解だけをまとめた Word（既存 Word に手で挿入する用）">
              📥 図解のみ Word を出力
            </button>
            <button onClick={handleExportPngZip}
              style={{ fontSize: 13, padding: "8px 16px", background: C.navy, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
              title="図解PNGを個別ファイルでZIPに固める（PowerPointなど他ツール用）">
              📥 PNG 一括 ZIP
            </button>
          </div>
          {outputMsg && <div style={{ marginTop: 10, fontSize: 12, color: C.green, fontWeight: 600 }}>{outputMsg}</div>}
          {outputError && <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef2f2", border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 3, fontSize: 12, color: C.red, lineHeight: 1.6 }}>{outputError}</div>}
        </div>
      )}

      {/* 戻る導線 */}
      <div style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => onNavigate("step_9")}
          style={{ fontSize: 12.5, padding: "6px 14px", background: C.white, color: C.navy, border: `1px solid ${C.navy}`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
          ← STEP9（本文作成）に戻る
        </button>
        <button onClick={() => onNavigate("step_10")}
          style={{ fontSize: 12.5, padding: "6px 14px", background: C.white, color: C.navy, border: `1px solid ${C.navy}`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}>
          STEP10（Amazon説明文）へ進む →
        </button>
      </div>
    </div>
  );
};

export default DiagramStepPage;
