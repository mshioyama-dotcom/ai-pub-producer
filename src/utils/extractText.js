// ============================================================
// ファイルからテキストを抽出するユーティリティ
// PDF: pdfjs-dist  /  DOCX: mammoth  /  TXT・MD: FileReader
// ============================================================

let pdfjsLibPromise = null;
let mammothPromise = null;

async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsLibPromise;
}

async function getMammoth() {
  if (!mammothPromise) {
    mammothPromise = import("mammoth");
  }
  return mammothPromise;
}

function getExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

async function extractFromPdf(file) {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str || "").join("");
    pageTexts.push(pageText);
  }
  return pageTexts.join("\n\n");
}

async function extractFromDocx(file) {
  const mammothMod = await getMammoth();
  const mammoth = mammothMod.default || mammothMod;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

async function extractFromText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("ファイル読み込み失敗"));
    reader.readAsText(file, "utf-8");
  });
}

// 1ファイルからテキストを抽出。失敗時は throw。
export async function extractTextFromFile(file) {
  if (!file) throw new Error("ファイルが指定されていません");
  const ext = getExtension(file.name);
  let text = "";
  if (ext === ".pdf") {
    text = await extractFromPdf(file);
  } else if (ext === ".docx") {
    text = await extractFromDocx(file);
  } else if (ext === ".txt" || ext === ".md") {
    text = await extractFromText(file);
  } else if (ext === ".doc") {
    throw new Error(".doc（旧Word形式）は非対応です。Wordで「.docx」形式に保存し直してから添付してください。");
  } else {
    throw new Error(`非対応のファイル形式です: ${ext || "（拡張子なし）"}`);
  }
  return (text || "").trim();
}

// 複数の入力ソースを受け取り、Dify送信用に1つのテキストに連結する。
// books: [{ filename, essenceText }]
//   - essenceText: extractBookEssence + formatEssenceAsText で圧縮済みのテキスト
//     （書籍の生テキストではなく、はじめに／おわりに／章末まとめ／目次に絞った要素抽出版）
//   - ユーザーがプレビューで編集している場合はその編集後テキスト
// posts: string  （Note/X投稿の貼付テキスト）
// profile: string  （プロフィール・著者ページの貼付テキスト）
export function buildSourceText({ books = [], posts = "", profile = "" }) {
  const blocks = [];
  books.forEach((b, idx) => {
    if (!b || !b.essenceText || !b.essenceText.trim()) return;
    const label = `=== 書籍${idx + 1}: ${b.filename || "(名称不明)"} から抽出した要素 ===`;
    blocks.push(`${label}\n\n${b.essenceText.trim()}`);
  });
  if (posts && posts.trim()) {
    blocks.push(`=== Note/X投稿 ===\n\n${posts.trim()}`);
  }
  if (profile && profile.trim()) {
    blocks.push(`=== プロフィール・著者ページ ===\n\n${profile.trim()}`);
  }
  return blocks.join("\n\n");
}

export const ACCEPTED_EXTENSIONS = ".txt,.md,.pdf,.docx";
