// src/utils/cache.js のユニットテスト（Task#9: STEP2 キャッシュ機能）。
// vitest のデフォルト環境は node で localStorage が無いため、最小限のモックを差し込む。

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hashInputs,
  readCache,
  writeCache,
  clearCache,
  formatCacheAge,
  DEFAULT_TTL_MS,
} from "../cache.js";

// シンプルな in-memory localStorage モック
function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    _store: store,
  };
}

beforeEach(() => {
  const ls = makeLocalStorage();
  globalThis.window = { localStorage: ls };
  globalThis.localStorage = ls;
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.window;
  delete globalThis.localStorage;
});

describe("hashInputs", () => {
  it("同じ入力には同じハッシュを返す（決定的）", () => {
    expect(hashInputs("a", "b", "c")).toBe(hashInputs("a", "b", "c"));
  });

  it("入力が1つでも違えばハッシュが変わる", () => {
    expect(hashInputs("a", "b", "c")).not.toBe(hashInputs("a", "b", "C"));
  });

  it("null/undefined は空文字として正規化される", () => {
    expect(hashInputs(null, undefined, "")).toBe(hashInputs("", "", ""));
  });

  it("連結順・境界が違えば区別される（'ab','c' と 'a','bc'）", () => {
    expect(hashInputs("ab", "c")).not.toBe(hashInputs("a", "bc"));
  });
});

describe("read/write キャッシュ", () => {
  const KEY = "test:cache";

  it("書いた内容を同じハッシュで読み戻せる", () => {
    const hash = hashInputs("draft", "author", "goal");
    const data = { judgment_text: "結果", keywords: ["k1", "k2"] };
    writeCache(KEY, hash, data);
    const got = readCache(KEY, hash);
    expect(got).not.toBeNull();
    expect(got.data).toEqual(data);
    expect(typeof got.cachedAt).toBe("number");
  });

  it("ハッシュが一致しなければ null（入力が変わったら再実行される）", () => {
    writeCache(KEY, hashInputs("draft1"), { x: 1 });
    expect(readCache(KEY, hashInputs("draft2"))).toBeNull();
  });

  it("未保存なら null", () => {
    expect(readCache(KEY, hashInputs("nope"))).toBeNull();
  });

  it("TTL を過ぎたら null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const hash = hashInputs("a");
    writeCache(KEY, hash, { x: 1 });
    expect(readCache(KEY, hash)).not.toBeNull(); // 直後は有効
    // TTL + 1ms 進める
    vi.setSystemTime(new Date(Date.now() + DEFAULT_TTL_MS + 1));
    expect(readCache(KEY, hash)).toBeNull();
  });

  it("TTL 直前ギリギリは有効", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const hash = hashInputs("a");
    writeCache(KEY, hash, { x: 1 });
    vi.setSystemTime(new Date(Date.now() + DEFAULT_TTL_MS - 1000));
    expect(readCache(KEY, hash)).not.toBeNull();
  });

  it("破損 JSON は null（例外を投げない）", () => {
    localStorage.setItem(KEY, "{壊れたJSON");
    expect(readCache(KEY, hashInputs("a"))).toBeNull();
  });

  it("clearCache で削除できる", () => {
    const hash = hashInputs("a");
    writeCache(KEY, hash, { x: 1 });
    clearCache(KEY);
    expect(readCache(KEY, hash)).toBeNull();
  });
});

describe("formatCacheAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00Z"));
  });

  it("1分未満は『たった今』", () => {
    expect(formatCacheAge(Date.now() - 30 * 1000)).toBe("たった今");
  });
  it("分単位", () => {
    expect(formatCacheAge(Date.now() - 5 * 60 * 1000)).toBe("5分前");
  });
  it("時間単位", () => {
    expect(formatCacheAge(Date.now() - 3 * 60 * 60 * 1000)).toBe("3時間前");
  });
  it("日単位", () => {
    expect(formatCacheAge(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe("2日前");
  });
  it("数値以外は空文字", () => {
    expect(formatCacheAge(null)).toBe("");
  });
});
