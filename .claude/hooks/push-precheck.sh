#!/usr/bin/env bash
# ai-pub-producer の Claude Code PreToolUse hook。
# Bash ツールが `git push` を実行しようとしたとき、自動で origin を fetch して
# 「origin にローカルに無いコミットがあるか」を確認する。あれば exit 2 で
# push を中断し、pull --rebase を促す。
#
# 防げる事故：
# - 別セッションが既に push 済みの状態で、こちらが古いベースの上で commit して
#   force push してしまう（相手の作業を上書き）
# - 別セッションの commit を取り込まずに push して non-fast-forward で reject される
#
# Claude Code の PreToolUse hook の仕様：
# - 標準入力に tool_input を含む JSON が来る
# - exit 0: 通常続行
# - exit 2: ツール実行をブロック（stderr の内容がアシスタントに渡る）
# - それ以外: 警告だがブロックはしない

set -euo pipefail

input="$(cat)"

# JSON 内の "command":"..." を grep で抽出（python/jq 非依存・Windows Git Bash でも動く）
# エスケープ済みのダブルクォートはここでは扱わない（実用上 git push のチェックには十分）
if ! echo "$input" | grep -qE '"command"[[:space:]]*:[[:space:]]*"[^"]*git[[:space:]]+push'; then
  exit 0
fi

# リポジトリルートに移動。git でない場所なら何もしない
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  exit 0
fi
cd "$repo_root"

# このフックは ai-pub-producer リポジトリのみで動作させる（他リポジトリへの誤動作を防ぐ）
case "$(basename "$repo_root")" in
  ai-pub-producer) ;;
  *) exit 0 ;;
esac

cb="$(git branch --show-current 2>/dev/null || true)"
if [ -z "$cb" ]; then
  exit 0
fi

# origin を fetch（オフライン等の失敗は許容）
git fetch origin "$cb" 2>/dev/null || true

# origin/<branch> にローカル HEAD にないコミットがいくつあるか
behind="$(git rev-list "HEAD..origin/$cb" --count 2>/dev/null || echo 0)"

if [ "${behind:-0}" -gt 0 ]; then
  preview="$(git log --oneline "HEAD..origin/$cb" 2>/dev/null | head -10)"
  cat >&2 <<EOF
⛔ push-precheck: origin/$cb に、ローカル HEAD にない ${behind} 件のコミットがあります。

別セッションがあなたが pull した後に新しい作業を push しています。このまま
push すると non-fast-forward で reject されるか、--force だと相手の作業を
上書きします。

直近の origin/$cb のコミット（先頭10件）:
${preview}

リトライ前の必須手順:
  1. git pull --rebase origin $cb        # ローカルを最新化
  2. コンフリクトがあれば手動解決
  3. git push origin $cb                  # 再実行

意図的に分岐させたい場合（例：backup ブランチからの復元など）は、Claude
Code の外でターミナルから push するか、このフックを一時的に無効化してください。
EOF
  exit 2
fi

exit 0
