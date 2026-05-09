// ============================================================
// 書籍テキストから著者プロファイル生成に有用な要素を抽出する
//
// 抽出対象：
//   1. 「はじめに」「序章」「序文」「プロローグ」セクション
//   2. 「おわりに」「終章」「エピローグ」セクション
//   3. 章末セクション（「まとめ」「ポイント」「アクションステップ」を含む）
//   4. 目次（章タイトル一覧）
//
// 設計意図：
//   書籍まるごとを Dify に渡すと数十万文字になりレートリミット・コスト的に
//   現実的でない。著者プロファイル生成に有用な「思想・文体・専門領域」が
//   特に滲むのは「はじめに／おわりに／章末まとめ」なので、そこだけ抽出して
//   元ファイルの 10〜20% 程度に圧縮する。
// ============================================================

// 装飾記号（**, ##, 【】, " ", 全角空白等）を除去するヘルパー
const stripDecoration = (s) =>
  String(s || "")
    .trim()
    .replace(/^[#*>＞]+\s*/, "")
    .replace(/[*\s　]+$/, "")
    .replace(/[*]+/g, "");

// 「はじめに／序章／序文／プロローグ」見出し判定
const isIntroHeading = (line) => {
  const t = stripDecoration(line).replace(/[\s　【】「」]/g, "");
  if (!t) return false;
  if (t.length > 30) return false; // 見出しは短い行
  return /^(はじめに|序章|序文|プロローグ|Introduction|Intro)/i.test(t);
};

// 「おわりに／終章／エピローグ」見出し判定
const isEndingHeading = (line) => {
  const t = stripDecoration(line).replace(/[\s　【】「」]/g, "");
  if (!t) return false;
  if (t.length > 30) return false;
  return /^(おわりに|終章|エピローグ|Conclusion|Epilogue)/i.test(t);
};

// 「第N章」「Chapter N」「N. xxx」等の章見出し判定
const isChapterHeading = (line) => {
  const t = stripDecoration(line).replace(/[\s　【】「」]/g, "");
  if (!t) return false;
  if (t.length > 80) return false;
  if (/^第[\d０-９〇一二三四五六七八九十百]+章/.test(t)) return true;
  if (/^[Cc]hapter\s*\d+/.test(t)) return true;
  // 「1. xxx」「1．xxx」「1）xxx」等の番号付きセクション
  if (/^[\d０-９]{1,2}[\.．、）)][^.．、）)]+$/.test(t) && t.length <= 50) return true;
  return false;
};

// 任意の見出し判定（イントロ/エンディング/章のいずれか）
const detectHeadingType = (line) => {
  if (isIntroHeading(line)) return "intro";
  if (isEndingHeading(line)) return "ending";
  if (isChapterHeading(line)) return "chapter";
  return null;
};

// 章末まとめキーワード（章本文の後半でこのキーワードを含む段落から終わりまでを取得）
const SUMMARY_KEYWORDS_RE = /(本章のまとめ|この章のまとめ|まとめ|ポイント|アクションステップ|チェックポイント|本章のポイント|今回のまとめ)/;

/**
 * 書籍テキストから著者プロファイル生成用に要素を抽出する。
 *
 * @param {string} rawText 書籍ファイルから抽出された生テキスト
 * @returns {object} { intro, ending, chapterEnds, toc, stats }
 */
export function extractBookEssence(rawText) {
  const empty = {
    intro: "",
    ending: "",
    chapterEnds: [],
    toc: [],
    stats: { originalChars: 0, extractedChars: 0, ratio: 0 },
  };
  if (!rawText || typeof rawText !== "string") return empty;

  const text = rawText.trim();
  const originalChars = text.length;
  if (originalChars === 0) return empty;

  // テキストが小さい場合（10,000字以下）は丸ごと返す（抽出する意味が薄いため）
  if (originalChars <= 10000) {
    return {
      intro: text,
      ending: "",
      chapterEnds: [],
      toc: [],
      stats: { originalChars, extractedChars: originalChars, ratio: 1 },
    };
  }

  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingType = detectHeadingType(line);
    if (headingType) {
      if (current) sections.push(current);
      current = {
        title: stripDecoration(line),
        type: headingType,
        lines: [line],
        startIdx: i,
      };
    } else if (current) {
      current.lines.push(line);
    }
    // current が null の状態でも見出し前の本文は無視（見出しが見つかるまで読み飛ばし）
  }
  if (current) sections.push(current);

  // 各セクションのテキストを生成（最大長制限あり）
  const sectionText = (s) => s.lines.join("\n").trim();

  // 1. はじめに（最初に見つかった intro セクション・最大8000字）
  const introSection = sections.find((s) => s.type === "intro");
  const intro = introSection
    ? truncate(sectionText(introSection), 8000)
    : "";

  // 2. おわりに（最後の ending セクション・最大5000字）
  const endingSections = sections.filter((s) => s.type === "ending");
  const endingSection = endingSections.length > 0 ? endingSections[endingSections.length - 1] : null;
  const ending = endingSection
    ? truncate(sectionText(endingSection), 5000)
    : "";

  // 3. 章末まとめ（各 chapter セクションから「まとめ」キーワード以降を抽出）
  const chapterSections = sections.filter((s) => s.type === "chapter");
  const chapterEnds = [];
  for (const ch of chapterSections) {
    const body = sectionText(ch);
    // 章本文の後半でキーワードがある段落を探す
    const match = body.match(SUMMARY_KEYWORDS_RE);
    if (match) {
      const startIdx = body.indexOf(match[0]);
      // キーワード以降を末尾まで取得（最大2000字）
      const excerpt = truncate(body.slice(startIdx), 2000);
      if (excerpt.trim().length >= 30) {
        chapterEnds.push({ title: ch.title, excerpt });
      }
    } else {
      // キーワードがなくても、章末の最後 800 字を「章末抜粋」として保存
      const tail = body.slice(Math.max(0, body.length - 800)).trim();
      if (tail && tail.length >= 100 && body.length > 2000) {
        chapterEnds.push({ title: ch.title, excerpt: tail, fallback: true });
      }
    }
  }

  // 4. 目次（intro / chapter / ending の各タイトル）
  const toc = [];
  if (introSection) toc.push(introSection.title);
  for (const ch of chapterSections) toc.push(ch.title);
  if (endingSection) toc.push(endingSection.title);

  // 統計
  const extractedChars =
    intro.length +
    ending.length +
    chapterEnds.reduce((sum, c) => sum + c.excerpt.length + (c.title?.length || 0), 0) +
    toc.reduce((sum, t) => sum + t.length, 0);

  return {
    intro,
    ending,
    chapterEnds,
    toc,
    stats: {
      originalChars,
      extractedChars,
      ratio: originalChars > 0 ? extractedChars / originalChars : 0,
    },
  };
}

// テキストを最大文字数に切り詰める（末尾に「…」を付ける）
function truncate(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n…（以降は省略）";
}

/**
 * 抽出結果を 1つの整形済みテキストにまとめる（Dify 送信用）。
 * @param {object} essence extractBookEssence の戻り値
 * @returns {string}
 */
export function formatEssenceAsText(essence) {
  if (!essence) return "";
  const blocks = [];
  if (essence.toc && essence.toc.length > 0) {
    blocks.push("【目次（章タイトル）】\n" + essence.toc.map((t, i) => `  ${i + 1}. ${t}`).join("\n"));
  }
  if (essence.intro) {
    blocks.push("【はじめに／序章】\n" + essence.intro);
  }
  if (essence.chapterEnds && essence.chapterEnds.length > 0) {
    const chapterBlocks = essence.chapterEnds.map((c) => {
      const label = c.fallback ? "（章末抜粋）" : "（章末まとめ）";
      return `■ ${c.title} ${label}\n${c.excerpt}`;
    });
    blocks.push("【章末まとめ／ポイント】\n\n" + chapterBlocks.join("\n\n"));
  }
  if (essence.ending) {
    blocks.push("【おわりに／終章】\n" + essence.ending);
  }
  return blocks.join("\n\n---\n\n");
}
