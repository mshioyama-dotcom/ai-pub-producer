# cleanup-old-dify-keys.ps1
# リネーム前の旧 env var を Preview / Production 両方から一括削除する。
#
# 削除対象（リネーム後は不要・かつそもそも未使用も含む）:
#   - DIFY_API_KEY_STEP00_A     -> DIFY_API_KEY_STEP0 にリネーム済
#   - DIFY_API_KEY_STEP01       -> DIFY_API_KEY_STEP1 にリネーム済
#   - DIFY_API_KEY_STEP02       -> そもそも未使用（コード参照削除済）
#   - DIFY_API_KEY_STEP02A      -> DIFY_API_KEY_STEP2A にリネーム済
#   - DIFY_API_KEY_STEP02B      -> DIFY_API_KEY_STEP2B にリネーム済
#   - DIFY_API_KEY_STEP03       -> DIFY_API_KEY_STEP4 にリネーム済（チャット型）
#   - DIFY_API_KEY_STEP03_REVIEW-> DIFY_API_KEY_STEP3_REVIEW にリネーム済
#   - DIFY_API_KEY_STEP_CONFIRM -> DIFY_API_KEY_STEP3_CONFIRM にリネーム済
#   - DIFY_API_KEY_STEP04       -> DIFY_API_KEY_STEP5 にリネーム済
#   - DIFY_API_KEY_STEP05       -> DIFY_API_KEY_STEP6 にリネーム済
#   - DIFY_API_KEY_STEP06       -> DIFY_API_KEY_STEP7 にリネーム済
#   - DIFY_API_KEY_STEP07       -> DIFY_API_KEY_STEP8 にリネーム済
#   - DIFY_API_KEY_STEP08       -> DIFY_API_KEY_STEP9 にリネーム済
#   - DIFY_API_KEY_STEP09       -> DIFY_API_KEY_STEP10 にリネーム済
#
# 注意:
#   - 先に sync-dify-keys.ps1 を実行し新名 env var を全て登録してから本スクリプトを実行
#   - 各 env var の削除前にユーザーに最終確認を求める（一括 Yes 可）
#   - 削除しても問題ない: 新名で値は登録済 + コードは新名のみ参照

$ErrorActionPreference = "Continue"

$oldVars = @(
    "DIFY_API_KEY_STEP00_A",
    "DIFY_API_KEY_STEP01",
    "DIFY_API_KEY_STEP02",
    "DIFY_API_KEY_STEP02A",
    "DIFY_API_KEY_STEP02B",
    "DIFY_API_KEY_STEP03",
    "DIFY_API_KEY_STEP03_REVIEW",
    "DIFY_API_KEY_STEP_CONFIRM",
    "DIFY_API_KEY_STEP04",
    "DIFY_API_KEY_STEP05",
    "DIFY_API_KEY_STEP06",
    "DIFY_API_KEY_STEP07",
    "DIFY_API_KEY_STEP08",
    "DIFY_API_KEY_STEP09"
)

Write-Host ""
Write-Host "============================================================"
Write-Host "  旧 Dify env var クリーンアップツール（リネーム後）"
Write-Host "============================================================"
Write-Host ""
Write-Host "以下の 14 個の旧 env var を Preview / Production から削除します:"
foreach ($v in $oldVars) {
    Write-Host "  - $v"
}
Write-Host ""
Write-Host "★ 前提条件:"
Write-Host "  - sync-dify-keys.ps1 で新名（STEP0 / STEP1 / STEP2A / STEP2B /"
Write-Host "    STEP3_REVIEW / STEP3_CONFIRM / STEP4-10）を全て登録済であること"
Write-Host "  - コードを最新版にデプロイ済（新名のみ参照）であること"
Write-Host ""
Write-Host "★ STEP11 / STEP12 / STEP13 / DISCUSS は名前変更なし -> 削除対象外"
Write-Host ""
$confirmAll = Read-Host "全 14 個を確認なしで一括削除しますか？ (y/N)"
$bulkMode = ($confirmAll -eq "y" -or $confirmAll -eq "Y")

$successCount = 0
$skipCount = 0
$failCount = 0

foreach ($varName in $oldVars) {
    Write-Host ""
    Write-Host "------------------------------------------------------------"
    Write-Host "  削除対象: $varName"

    if (-not $bulkMode) {
        $confirm = Read-Host "  削除しますか？ (y/N/q=中止)"
        if ($confirm -eq "q" -or $confirm -eq "Q") {
            Write-Host "  中止しました" -ForegroundColor Yellow
            break
        }
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "  -> SKIP"
            $skipCount++
            continue
        }
    }

    # Preview から削除
    Write-Host "  Preview 削除中..."
    & vercel env rm $varName preview --yes --scope masashio 2>&1 | Out-Null
    $previewExit = $LASTEXITCODE
    Start-Sleep -Milliseconds 300

    # Production から削除
    Write-Host "  Production 削除中..."
    & vercel env rm $varName production --yes --scope masashio 2>&1 | Out-Null
    $prodExit = $LASTEXITCODE

    # exit code 0 でなくても、env var が「もともと存在しない」だけのケースが多いので
    # 厳密判定はせず、進行優先（vercel CLI は存在しない var の削除でも exit 0 を返すことが多い）
    if ($previewExit -eq 0 -and $prodExit -eq 0) {
        Write-Host "  OK 削除完了" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  WARN 削除結果不明（Preview:$previewExit / Production:$prodExit）" -ForegroundColor Yellow
        Write-Host "        ※ もともと存在しない場合もこの表示が出ます。Vercel ダッシュボードで確認してください。"
        $failCount++
    }
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  完了サマリー"
Write-Host "============================================================"
Write-Host "  OK   削除成功: $successCount 個" -ForegroundColor Green
Write-Host "  WARN 結果不明: $failCount 個" -ForegroundColor Yellow
Write-Host "  -    スキップ: $skipCount 個"
Write-Host ""
Write-Host "次のアクション:"
Write-Host "  1. Vercel ダッシュボードで env vars を確認:"
Write-Host "     https://vercel.com/masashio/ai-pub-producer-v2/settings/environment-variables"
Write-Host "  2. 残っている DIFY_API_KEY_* が新名のみ（STEP0-13 + DISCUSS）か確認"
Write-Host "  3. Production を Redeploy:"
Write-Host "     ★ Use existing Build Cache のチェックを外す"
Write-Host ""
