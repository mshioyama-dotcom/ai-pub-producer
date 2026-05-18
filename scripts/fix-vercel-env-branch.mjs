#!/usr/bin/env node
/**
 * Vercel 環境変数のブランチ制限を一括解除するスクリプト
 *
 * 目的:
 *   Vercel プロジェクトで「Production Branch を phase1 に切り替えたい」が、
 *   "phase1 ブランチ専用の Preview" でスコープ固定された環境変数があり、
 *   "Cannot set Git branch 'phase1' as Production Branch" エラーで切り替えできない問題を解決する。
 *
 * 動作:
 *   1. Vercel REST API でプロジェクトの全環境変数を取得
 *   2. gitBranch フィールドに値が入っている env var を抽出
 *   3. それらを PATCH してブランチ制限を解除（gitBranch を空にする）
 *   4. 同時に target に production を追加（Production スコープも有効化）
 *
 * 使い方:
 *   1. Vercel personal access token を取得（一度だけ）:
 *      https://vercel.com/account/tokens
 *      → 「Create Token」→ 名前を付けて作成（スコープは Full Account / Read-Write）
 *      → 表示されたトークンをコピー
 *
 *   2. プロジェクト ID を取得:
 *      Vercel ダッシュボード → プロジェクト → Settings → General
 *      → 一番下の「Project ID」をコピー
 *
 *   3. このスクリプトを実行（プロジェクトルートで）:
 *      VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=xxx node scripts/fix-vercel-env-branch.mjs
 *
 *   4. ドライラン（変更せずに対象だけ表示）:
 *      DRY_RUN=1 VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=xxx node scripts/fix-vercel-env-branch.mjs
 *
 * 注意:
 *   - 実行前に必ず DRY_RUN=1 で対象を確認することを推奨
 *   - 個人アクセストークンは決して commit / 共有しないこと
 *   - スコープに含めるべき target は Production/Preview/Development の3つ
 */

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID; // チームプロジェクトの場合のみ必要
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!TOKEN || !PROJECT_ID) {
  console.error("❌ 環境変数が不足しています：");
  console.error("   VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=xxx node scripts/fix-vercel-env-branch.mjs");
  console.error("\nトークン取得: https://vercel.com/account/tokens");
  console.error("プロジェクトID取得: Vercelダッシュボード → プロジェクト → Settings → General → Project ID");
  process.exit(1);
}

const API_BASE = "https://api.vercel.com";
const teamQuery = TEAM_ID ? `?teamId=${TEAM_ID}` : "";
const teamQueryAmp = TEAM_ID ? `&teamId=${TEAM_ID}` : "";

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}${path.includes("?") ? teamQueryAmp : teamQuery}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status} ${path}: ${errText.slice(0, 500)}`);
  }
  return await response.json();
}

async function listEnvVars() {
  // GET /v10/projects/:id/env で env var 一覧取得
  const data = await apiFetch(`/v10/projects/${PROJECT_ID}/env`);
  return data.envs || [];
}

async function patchEnvVar(envId, body) {
  // PATCH /v9/projects/:id/env/:envId で更新
  return await apiFetch(`/v9/projects/${PROJECT_ID}/env/${envId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function describeScope(env) {
  const targets = (env.target || []).join("/");
  const branch = env.gitBranch ? ` (branch: ${env.gitBranch})` : "";
  return `${targets}${branch}`;
}

async function main() {
  console.log(`🔍 プロジェクト ${PROJECT_ID} の環境変数を取得中...`);
  if (DRY_RUN) console.log("   [DRY RUN モード：変更は行いません]");

  const envs = await listEnvVars();
  console.log(`   合計 ${envs.length} 個の環境変数があります。\n`);

  // ブランチ制限がある env var を抽出
  const branchRestricted = envs.filter((e) => e.gitBranch);

  if (branchRestricted.length === 0) {
    console.log("✅ ブランチ制限のある環境変数はありません。問題はありません。");
    return;
  }

  console.log(`⚠ ブランチ制限のある環境変数：${branchRestricted.length} 個`);
  for (const env of branchRestricted) {
    console.log(`   - ${env.key.padEnd(40)} → ${describeScope(env)}`);
  }
  console.log();

  if (DRY_RUN) {
    console.log("ℹ DRY_RUN モードのため変更は行いません。");
    console.log("  本実行: VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=xxx node scripts/fix-vercel-env-branch.mjs");
    return;
  }

  console.log("🔧 ブランチ制限を解除し、Production/Preview/Development の全環境に有効化します...\n");

  let success = 0;
  let failed = 0;
  for (const env of branchRestricted) {
    try {
      await patchEnvVar(env.id, {
        gitBranch: null, // ブランチ制限を解除
        target: ["production", "preview", "development"], // 全環境で有効化
      });
      console.log(`  ✓ ${env.key}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${env.key} → ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`  成功: ${success} 件`);
  if (failed > 0) console.log(`  失敗: ${failed} 件`);
  console.log(`\n次のステップ:`);
  console.log(`  1. Vercel ダッシュボード → Settings → Environments → Production`);
  console.log(`  2. Branch Tracking を main → phase1 に変更 → Save`);
  console.log(`  3. エラーなく Save できれば成功`);
}

main().catch((err) => {
  console.error("❌ エラー:", err.message);
  process.exit(1);
});
