// 純関数のテキスト処理ユーティリティ。
// App.jsx から抽出してテスト可能にした集合。状態を持たず、React/DOM 依存もない。
//
// 含まれる関数：
// - normalizeChapterKey         章タイトル正規化（重複検出用キー）
// - detectDuplicateSections     === タイトル === セクションの重複有無
// - parseOutputSections         === タイトル === で本文を区切る
// - upsertChapterInOutput       既存outputTextに章を追加/置換
// - dedupeOutputSections        重複セクションを除去
// - extractChapters             章配列の抽出（ラッパー優先 → inline fallback）
// - extractSections             節と項の抽出
// - dedupeBodyHeaders           章/節見出しの繰り返しを除去
// - stripChapterSection         (legacy) 章/節を先頭から削る
// - extractKeywords3Axes        書籍プロファイルから3軸キーワード抽出
// - parseWorkProfileKeywords    確定版から kw1/kw2 を取り出す

// --------------------------------------------------------
// 章タイトル正規化＋重複セクション検出
// --------------------------------------------------------

export function normalizeChapterKey(title) {
  return String(title || "")
    .replace(/[\s　]/g, "")
    .replace(/[：:]/g, "")
    .replace(/[*#\[\]【】「」]/g, "")
    .trim();
}

export function detectDuplicateSections(text) {
  if (!text || typeof text !== "string") return false;
  const matches = [...text.matchAll(/^===\s*(.+?)\s*===$/gm)].map((m) => normalizeChapterKey(m[1]));
  const seen = new Set();
  for (const k of matches) {
    if (!k) continue;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

// --------------------------------------------------------
// === タイトル === セクションのパース
// --------------------------------------------------------

export function parseOutputSections(text) {
  if (!text || typeof text !== "string") return { preamble: "", sections: [] };
  const lines = text.split("\n");
  const sections = [];
  let current = null;
  let preamble = "";
  for (const line of lines) {
    const m = line.match(/^===\s*(.+?)\s*===$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), header: line, body: "" };
    } else if (current) {
      current.body += line + "\n";
    } else {
      preamble += line + "\n";
    }
  }
  if (current) sections.push(current);
  // 各セクション末尾の余分な区切り（"---"のみの行）と空白を削る
  for (const s of sections) {
    s.body = s.body.replace(/\n+---\s*\n*$/, "").replace(/\s+$/, "");
  }
  return { preamble: preamble.replace(/\s+$/, ""), sections };
}

export function upsertChapterInOutput(outputText, chapterTitle, chapterContent, chapterOrderTitles) {
  const { preamble, sections } = parseOutputSections(outputText);
  const newSection = {
    title: chapterTitle,
    header: `=== ${chapterTitle} ===`,
    body: (chapterContent || "").trim(),
  };
  const existingIdx = sections.findIndex((s) => normalizeChapterKey(s.title) === normalizeChapterKey(chapterTitle));
  if (existingIdx >= 0) sections[existingIdx] = newSection;
  else sections.push(newSection);

  if (Array.isArray(chapterOrderTitles) && chapterOrderTitles.length > 0) {
    const orderMap = new Map(chapterOrderTitles.map((t, i) => [normalizeChapterKey(t), i]));
    sections.sort((a, b) => {
      const ka = orderMap.has(normalizeChapterKey(a.title)) ? orderMap.get(normalizeChapterKey(a.title)) : 9999;
      const kb = orderMap.has(normalizeChapterKey(b.title)) ? orderMap.get(normalizeChapterKey(b.title)) : 9999;
      return ka - kb;
    });
  }

  const body = sections.map((s) => `${s.header}\n\n${s.body}`).join("\n\n---\n\n");
  return (preamble ? preamble + "\n\n" : "") + body;
}

export function dedupeOutputSections(text) {
  if (!text || typeof text !== "string") return text;
  const lines = text.split("\n");
  const sections = [];
  let current = null;
  let preamble = "";
  for (const line of lines) {
    const m = line.match(/^===\s*(.+?)\s*===$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), header: line, body: "" };
    } else if (current) {
      current.body += line + "\n";
    } else {
      preamble += line + "\n";
    }
  }
  if (current) sections.push(current);

  const seen = new Map();
  const deduped = [];
  for (const s of sections) {
    const key = normalizeChapterKey(s.title);
    if (!key) { deduped.push(s); continue; }
    if (seen.has(key)) {
      const idx = seen.get(key);
      if (s.body.length > deduped[idx].body.length) deduped[idx] = s;
    } else {
      seen.set(key, deduped.length);
      deduped.push(s);
    }
  }

  const body = deduped.map((s) => `${s.header}\n${s.body.trimEnd()}`).join("\n\n---\n\n");
  return (preamble.trimEnd() ? preamble.trimEnd() + "\n\n" : "") + body;
}

// --------------------------------------------------------
// 章抽出（ラッパー優先 → inline fallback）
// --------------------------------------------------------

export function extractChapters(text) {
  if (!text || typeof text !== "string") return [];

  // ラッパー形式優先（STEP6/7/8 のバルク生成出力）
  if (/^===\s*.+?\s*===\s*$/m.test(text)) {
    const { sections } = parseOutputSections(text);
    if (sections.length > 0) {
      const seen = new Map();
      const deduped = [];
      for (const s of sections) {
        const key = normalizeChapterKey(s.title);
        if (!key) continue;
        if (seen.has(key)) {
          const idx = seen.get(key);
          if ((s.body || "").length > (deduped[idx].body || "").length) deduped[idx] = s;
        } else {
          seen.set(key, deduped.length);
          deduped.push(s);
        }
      }
      return deduped.map((s) => ({
        chapterTitle: s.title,
        body: s.body || "",
      }));
    }
  }

  // inline 検出（平文の目次）
  const stripDecoration = (s) =>
    String(s).replace(/^[\s　]*[\d０-９]+[.．、]?[\s　]*/, "")
             .replace(/[*#\[\]【】「」（）()"'`>～~・\s　]/g, "");
  const isChapterHeading = (line) => {
    if (!line) return false;
    const s = stripDecoration(line);
    if (!s) return false;
    if (s.length > 80) return false;
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
      const cleanTitle = trimmed.replace(/^[\s　]*[\d０-９]+[.．、]?[\s　]*/, "")
                                .replace(/[*#\[\]【】]/g, "")
                                .trim();
      current = { chapterTitle: cleanTitle, body: rawLine + "\n" };
    } else if (current) {
      current.body += rawLine + "\n";
    }
  }
  if (current && current.body.trim()) chapters.push(current);

  // 重複排除
  const seen = new Map();
  const deduped = [];
  for (const ch of chapters) {
    const key = normalizeChapterKey(ch.chapterTitle);
    if (!key) continue;
    if (seen.has(key)) {
      const idx = seen.get(key);
      if ((ch.body || "").length > (deduped[idx].body || "").length) {
        deduped[idx] = ch;
      }
    } else {
      seen.set(key, deduped.length);
      deduped.push(ch);
    }
  }
  return deduped;
}

// --------------------------------------------------------
// 節と項の抽出
// --------------------------------------------------------

export function extractSections(text) {
  if (!text || typeof text !== "string") return [];

  const stripDecoration = (s) =>
    String(s).replace(/^[\s　]*[#*>]+[\s　]*/, "").replace(/[*]+/g, "").trim();

  const sections = []; const lines = text.split("\n");
  const sectionRegex = /^[\(（]?\s*\d+\s*[\)）.．、]\s*.+$/;
  const itemRegex = /^[①-⑳][\s　]?.{2,100}$/;
  let currentSection = null;
  for (const rawLine of lines) {
    const line = stripDecoration(rawLine);
    if (!line) continue;
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

// --------------------------------------------------------
// 本文ヘッダー重複除去（章タイトル・節見出しを最初の1回だけに）
// --------------------------------------------------------

export function dedupeBodyHeaders(text) {
  if (!text || typeof text !== "string") return text;
  const lines = text.split("\n");
  const result = [];
  const seenChapterKeys = new Set();
  const seenSectionKeys = new Set();
  const isChapterHeading = (line) => {
    const t = line.trim();
    if (!t || t.length > 80) return false;
    if (/^はじめに\s*$/.test(t)) return true;
    if (/^おわりに\s*$/.test(t)) return true;
    if (/^第[0-9０-９零一二三四五六七八九十百]+章/.test(t)) return true;
    return false;
  };
  const isSectionHeading = (line) => {
    const t = line.trim();
    if (!t || t.length > 100) return false;
    return /^[（(][0-9０-９]+[）)]/.test(t);
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (isChapterHeading(line)) {
      if (seenChapterKeys.has(trimmed)) continue;
      seenChapterKeys.add(trimmed);
      result.push(line);
      continue;
    }
    if (isSectionHeading(line)) {
      if (seenSectionKeys.has(trimmed)) continue;
      seenSectionKeys.add(trimmed);
      result.push(line);
      continue;
    }
    result.push(line);
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n");
}

// legacy: 個別項出力から章+節の先頭を削るユーティリティ。
// dedupeBodyHeaders 導入後は dedupeBodyHeaders を優先利用。
export function stripChapterSection(output, isFirst) {
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

// --------------------------------------------------------
// 書籍プロファイルからキーワード抽出
// --------------------------------------------------------

export function extractKeywords3Axes(workProfileDraft) {
  if (!workProfileDraft) return { theme: "", reader: "", diff: "" };
  const pickFirst = (text) => {
    if (!text) return "";
    const cleaned = text.replace(/\*+/g, "").trim();
    return cleaned.split(/[、,]/)[0].trim();
  };
  const buildAxisRegex = (axis) => new RegExp(`(?:^|\\n)\\s*[\\-・*+▶▼●○◆◇■□]?\\s*${axis}\\s*[:：]\\s*(.+)`);
  const themeMatch = workProfileDraft.match(buildAxisRegex("主題軸"));
  const readerMatch = workProfileDraft.match(buildAxisRegex("読者軸"));
  const diffMatch = workProfileDraft.match(buildAxisRegex("差分軸"));
  let theme = themeMatch ? pickFirst(themeMatch[1]) : "";
  // 新形式「## 主要検索キーワード」セクションを fallback で見る
  if (!theme) {
    const sectionRe = /(?:^|\n)#{2,3}\s*(?:主要)?検索キーワード[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|\n*$)/;
    const sm = workProfileDraft.match(sectionRe);
    if (sm) {
      const firstBullet = sm[1].split(/\n/).map((l) => l.match(/^\s*[\-・*+]\s*(.+?)\s*$/)).find((b) => b);
      if (firstBullet) theme = pickFirst(firstBullet[1]);
    }
  }
  return {
    theme,
    reader: readerMatch ? pickFirst(readerMatch[1]) : "",
    diff: diffMatch ? pickFirst(diffMatch[1]) : "",
  };
}

export function parseWorkProfileKeywords(workProfile) {
  const empty = { keyword1: "", keyword2: "" };
  if (!workProfile) return empty;
  const axes = extractKeywords3Axes(workProfile);
  const themePhrase = (axes.theme || "").trim();
  const themeParts = themePhrase.split(/[\s　]+/).filter(Boolean);
  return { keyword1: themeParts[0] || "", keyword2: themeParts[1] || "" };
}
