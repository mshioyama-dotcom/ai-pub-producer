# sync-dify-keys.ps1
# Dify から取得した API キーを、Vercel の Preview と Production に
# まとめて新名で登録する PowerShell スクリプト（v2 リネーム後の全 Dify 鍵対応・17個）。
#
# v2 (2026-06): env var 名を新 STEP 番号に統一。
#   旧: DIFY_API_KEY_STEP00_A / STEP01 / STEP02A / STEP02B / STEP03 /
#       STEP03_REVIEW / STEP_CONFIRM / STEP04〜09
#   新: DIFY_API_KEY_STEP0 / STEP1 / STEP2A / STEP2B / STEP3_REVIEW /
#       STEP3_CONFIRM / STEP4 / STEP5 / STEP6 / STEP7 / STEP8 / STEP9 / STEP10
#   STEP11 / STEP12 / STEP13 / DISCUSS は変更なし。
#
# 使い方:
#   1. Dify ダッシュボード（https://cloud.dify.ai/apps）で各アプリの API キーを準備
#   2. このスクリプトを実行: powershell.exe -ExecutionPolicy Bypass -File sync-dify-keys.ps1
#   3. プロンプトに沿って順番にキーを貼り付ける（不明な鍵は空 Enter でスキップ）
#   4. 自動で Preview と Production の両方が更新される
#   5. 完了後、cleanup-old-dify-keys.ps1 で旧 env var を一括削除
#   6. Vercel ダッシュボードで Production を Redeploy
#
# 安全性:
#   - キーは画面に表示されない（SecureString 入力 → ターミナルに *** 表示）
#   - スクリプト終了時にメモリ上の値を破棄
#   - ファイルには保存しない
#   - 全て Sensitive フラグ付きで Vercel に登録

$ErrorActionPreference = "Continue"

# 新名での env var 定義（優先度順）
$keys = @(
    # === CRITICAL（最重要・新名で確実に登録したい） ===
    @{Var = "DIFY_API_KEY_DISCUSS";       App = "STEP_共通_出力相談";       UseFor = "全STEP共通の出力相談チャット";      Priority = "CRITICAL"; Type = "Chatflow"},
    @{Var = "DIFY_API_KEY_STEP4";         App = "STEP4 エピソードインタビュー"; UseFor = "STEP4 エピソードインタビュー（チャット型）"; Priority = "CRITICAL"; Type = "Chatflow"},
    @{Var = "DIFY_API_KEY_STEP5";         App = "STEP5 タイトル";            UseFor = "STEP5 タイトル・サブタイトル作成";    Priority = "CRITICAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP6";         App = "STEP6 目次";                UseFor = "STEP6 目次作成";                     Priority = "CRITICAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP7";         App = "STEP7 章構成";              UseFor = "STEP7 章構成作成";                   Priority = "CRITICAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP8";         App = "STEP8 詳細プロット";         UseFor = "STEP8 詳細プロット作成";              Priority = "CRITICAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP9";         App = "STEP9 本文";                UseFor = "STEP9 本文作成";                     Priority = "CRITICAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP10";        App = "STEP10 Amazon説明文";        UseFor = "STEP10 Amazon説明文作成";             Priority = "CRITICAL"; Type = "Workflow"},

    # === HIGH ===
    @{Var = "DIFY_API_KEY_STEP0";         App = "STEP0 著者プロファイル";     UseFor = "STEP0 著者プロファイル生成";          Priority = "HIGH"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP1";         App = "STEP1 書籍プロファイル草案"; UseFor = "STEP1 書籍プロファイル草案";          Priority = "HIGH"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP2A";        App = "STEP2 キーワード生成";       UseFor = "STEP2 AIキーワード10個生成";          Priority = "HIGH"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP2B";        App = "STEP2 スコア判定";           UseFor = "STEP2 LLMスコア判定";                Priority = "HIGH"; Type = "Workflow"},

    # === NORMAL ===
    @{Var = "DIFY_API_KEY_STEP3_REVIEW";  App = "STEP3 競合レビュー";         UseFor = "STEP3 競合レビュー分析";              Priority = "NORMAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP3_CONFIRM"; App = "STEP3 書籍プロファイル確定"; UseFor = "STEP3末尾 確定アクション";            Priority = "NORMAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP11";        App = "STEP11 X投稿生成";           UseFor = "STEP11 X投稿生成";                   Priority = "NORMAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP12";        App = "STEP12 改善提案";            UseFor = "STEP12 本の改善提案";                Priority = "NORMAL"; Type = "Workflow"},
    @{Var = "DIFY_API_KEY_STEP13";        App = "STEP13 著者プロファイル更新"; UseFor = "STEP13 著者プロファイル更新";         Priority = "NORMAL"; Type = "Workflow"}
)

Write-Host ""
Write-Host "============================================================"
Write-Host "  Dify API Keys -> Vercel リネーム同期ツール (新名・17個)"
Write-Host "============================================================"
Write-Host ""
Write-Host "新しい env var 名（新 STEP 番号に揃えたクリーン名）で Preview / Production に登録します。"
Write-Host ""
Write-Host "全 17 個（STEP11/12/13 と DISCUSS は名前変更なしだが、整合性のため一緒に再登録）"
Write-Host ""
Write-Host "Dify URL: https://cloud.dify.ai/apps"
Write-Host ""
Write-Host "ヒント:"
Write-Host "  - 不明な鍵は空 Enter でスキップ可能（既に新名で登録済の場合スキップ推奨）"
Write-Host "  - 途中で Ctrl+C で中断可能（中断時点まで反映）"
Write-Host "  - 完了後、cleanup-old-dify-keys.ps1 を実行して旧名 env var を一括削除"
Write-Host ""
$confirm = Read-Host "準備できたら Enter を押してください（中止は Ctrl+C）"

$successCount = 0
$failCount = 0
$skipCount = 0

foreach ($keyInfo in $keys) {
    $varName = $keyInfo.Var
    $appName = $keyInfo.App
    $useFor = $keyInfo.UseFor
    $priority = $keyInfo.Priority
    $appType = $keyInfo.Type

    Write-Host ""
    Write-Host "------------------------------------------------------------"
    switch ($priority) {
        "CRITICAL" { Write-Host "  [CRITICAL] $varName" -ForegroundColor Red }
        "HIGH"     { Write-Host "  [HIGH] $varName" -ForegroundColor Yellow }
        "NORMAL"   { Write-Host "  [NORMAL] $varName" }
    }
    Write-Host "  Dify アプリ名: $appName"
    Write-Host "  アプリタイプ: $appType（Difyで確認）"
    Write-Host "  用途: $useFor"
    Write-Host "------------------------------------------------------------"

    $secureKey = Read-Host "Dify API キーを貼り付け（空 Enter でスキップ）" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if (-not $plainKey -or $plainKey.Length -lt 5) {
        Write-Host "  -> SKIP (no key entered)"
        $skipCount++
        continue
    }

    # --- Preview を更新 ---
    Write-Host "  Preview [rm] 既存削除中..."
    & vercel env rm $varName preview --yes --scope masashio 2>&1 | Out-Null
    Start-Sleep -Milliseconds 400

    Write-Host "  Preview [add] 新規登録中..."
    $retryAdd = 0
    do {
        $retryAdd++
        $plainKey | & vercel env add $varName preview --scope masashio --sensitive 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        if ($retryAdd -lt 3) {
            Write-Host "    Preview add リトライ $retryAdd/3 ..." -ForegroundColor DarkYellow
            Start-Sleep -Seconds 2
        }
    } while ($retryAdd -lt 3)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARN Preview の更新に失敗（$retryAdd 回試行）" -ForegroundColor Yellow
        $failCount++
        $plainKey = $null
        continue
    }

    # --- Production を更新 ---
    Write-Host "  Production [rm] 既存削除中..."
    & vercel env rm $varName production --yes --scope masashio 2>&1 | Out-Null
    Start-Sleep -Milliseconds 400

    Write-Host "  Production [add] 新規登録中..."
    $retryAddProd = 0
    do {
        $retryAddProd++
        $plainKey | & vercel env add $varName production --scope masashio --sensitive 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        if ($retryAddProd -lt 3) {
            Write-Host "    Production add リトライ $retryAddProd/3 ..." -ForegroundColor DarkYellow
            Start-Sleep -Seconds 2
        }
    } while ($retryAddProd -lt 3)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARN Production の更新に失敗（$retryAddProd 回試行）" -ForegroundColor Yellow
        $failCount++
    } else {
        Write-Host "  OK Preview + Production の両方に反映完了" -ForegroundColor Green
        $successCount++
    }

    $plainKey = $null
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  完了サマリー"
Write-Host "============================================================"
Write-Host "  OK   成功: $successCount 個" -ForegroundColor Green
Write-Host "  WARN 失敗: $failCount 個" -ForegroundColor Yellow
Write-Host "  -    スキップ: $skipCount 個"
Write-Host ""
Write-Host "次のアクション:"
Write-Host "  1. 旧 env var を削除: powershell.exe -ExecutionPolicy Bypass -File cleanup-old-dify-keys.ps1"
Write-Host "  2. Production を Redeploy:"
Write-Host "     https://vercel.com/masashio/ai-pub-producer-v2/deployments"
Write-Host "     ★ Use existing Build Cache のチェックを外す"
Write-Host ""
