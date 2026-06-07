// ============================================================
// localStorage ベースの入力ハッシュ付きキャッシュ（TTL対応）
// ------------------------------------------------------------
// 目的：STEP2/3/12 のような RapidAPI を消費する重い分析を、
//       同じ入力に対しては再実行せずキャッシュから返すことで
//       API 消費（BASIC: 月100req）を 30〜50% 削減する。
//
// 設計：
//   - 1 つの storageKey につき 1 エントリ（最後の入力に対する結果）を保持。
//     入力が変わればハッシュが変わり、readCache が null を返すので
//     自動的に再実行される（=古い結果が誤って表示されない）。
//   - エントリ形式: { hash, cachedAt(ms), data }
//   - TTL は既定 7 日。期限切れは null 扱い。
// ============================================================

export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日間

// 任意個の入力パートから安定した短い文字列キーを生成（djb2 ハッシュ）。
// null/undefined は空文字に正規化し、 区切りで連結してから畳み込む。
export function hashInputs(...parts) {
  const str = parts.map((p) => (p == null ? "" : String(p))).join("");
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0; // h * 33 + c
  }
  return (h >>> 0).toString(36);
}

// キャッシュ読み出し。入力ハッシュ一致 かつ TTL 内 のときだけ
// { data, cachedAt } を返す。それ以外（未保存・入力変化・期限切れ・破損）は null。
export function readCache(storageKey, inputHash, ttlMs = DEFAULT_TTL_MS) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || entry.hash !== inputHash) return null;
    if (typeof entry.cachedAt !== "number") return null;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return { data: entry.data, cachedAt: entry.cachedAt };
  } catch {
    return null;
  }
}

// キャッシュ書き込み。失敗（容量超過など）は握りつぶしてログのみ。
export function writeCache(storageKey, inputHash, data) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const entry = { hash: inputHash, cachedAt: Date.now(), data };
    localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch (e) {
    console.error("cache write failed:", e);
  }
}

// キャッシュ削除（明示的な無効化が必要なとき用）。
export function clearCache(storageKey) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.removeItem(storageKey);
  } catch (e) {
    console.error("cache clear failed:", e);
  }
}

// 経過時間を「たった今 / N分前 / N時間前 / N日前」の日本語で返す（バナー表示用）。
export function formatCacheAge(cachedAt) {
  if (typeof cachedAt !== "number") return "";
  const diff = Date.now() - cachedAt;
  if (diff < 60 * 1000) return "たった今";
  const min = Math.floor(diff / (60 * 1000));
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(diff / (60 * 60 * 1000));
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(diff / (24 * 60 * 60 * 1000));
  return `${day}日前`;
}
