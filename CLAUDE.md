# CLAUDE.md — ai-pub-producer プロジェクトでの作業ルール

このリポジトリで Claude（または他のAIエージェント）が作業する際の必須手順。
新しいセッションは必ず最初にこのファイルを読んでください。

## 🚨 セッション開始時の必須手順

1. **作業ディレクトリ確認**：必ず `C:\Users\mshio\Projects\ai-pub-producer` で作業する。
   `Downloads\Dify\.claude\worktrees\` 配下は worktree（一時コピー）で **実体ではない**。

2. **リモートとの同期確認**：
   ```bash
   git fetch origin phase1
   git status
   git log --oneline HEAD..origin/phase1 -10   # origin が進んでいるか確認
   ```

3. **origin が進んでいたら必ず取り込む**：
   ```bash
   git pull --rebase origin phase1
   ```
   コンフリクトが出たら手動で解決してから作業を再開する。

4. **直近セッションの作業状況を把握**：
   - `docs/SESSION_HANDOFF.md` を読む
   - 特に **「🚧 進行中リファクタ宣言」** セクションを確認
   - 別セッションが進行中の改修と同じファイルを触らない

## 🚧 大規模改修を始めるときのルール

複数ファイルにまたがる方針転換（例：STEP2 を再設計、Dify YML を大幅変更、StepPage の構造変更 等）を始めるときは：

1. **方針宣言を先に書く**：`docs/SESSION_HANDOFF.md` の「🚧 進行中リファクタ宣言」セクションに、
   - 改修の方針（What・Why）
   - 期間の見込み
   - 影響ファイル一覧

   を、コードを変える前にまず追記して push する。

2. **改修コミットの最初に方針宣言コミットを置く**（任意・推奨）：
   ```
   chore(plan): STEP2 を Keepa 廃止して整合性チェック型に再設計する方針宣言

   このコミット以降、STEP2 YML と Step2Page を書き換える。
   別セッションは触らないこと。完了後にこのコメントを取り消す。
   ```

3. **改修中の commit には方針との対応を明示**：「fix(step2): ...」「refactor(step2): ...」のように
   どの改修の一部か分かるスコープを付ける。

4. **改修完了後の後始末**：
   - 「進行中リファクタ宣言」セクションから該当エントリを削除
   - SESSION_HANDOFF.md の主要部分（変更履歴 / 現状 / 残タスク）に結果を反映
   - 必要なら全体設計書（`docs/LifeBookNavigator_全体設計書_2.md`）も更新

## 🔒 自動安全装置

`.claude/settings.json` で `git push` 実行前に **origin を自動 fetch して差分検出** する hook が設定されている（`.claude/hooks/push-precheck.sh`）。

- リモートに新コミットがある状態で push しようとすると、hook が exit 2 で push を中断
- ユーザーに `git pull --rebase` を促すメッセージが出る
- これで「別セッションの作業を上書きする」事故が構造的に防げる

意図的に分岐させたい場合（backup ブランチからの復元など）は、Claude Code の外でターミナルから push するか、フックを一時的に無効化する。

## 🧪 ユニットテスト運用ルール（必須）

純関数のバグ（章抽出・キーワード抽出・本文ヘッダー重複など）が過去に何度も発生したため、回帰防止としてユニットテストを必須運用にしている。**push 前に必ずパスさせる。**

### コマンド

```bash
npm run test         # 一回実行（push前に必須）
npm run test:watch   # 開発中の watch モード
npm run build        # TypeScript型チェック＋Vite本番ビルド（push前に必須）
```

### コード変更時の必須フロー

1. **修正前**: `npm run test` で**現状のテストがパスしている**ことを確認
2. **バグ修正の場合**: 先に再現テスト（失敗するテスト）を書く → 修正でテストが通る形にする（TDD）
3. **新規純関数の追加**: `src/lib/textUtils.js` に export 追加 → `src/lib/__tests__/textUtils.test.js` に最低3件のテストを追加
4. **push 前の最終確認**: `npm run test && npm run build` で**両方とも緑**を確認

### App.jsx と textUtils.js の同期（重要）

`src/App.jsx` には純関数の inline 定義があり、`src/lib/textUtils.js` には**同じ関数の独立コピー**がある（二重実装）。これは過渡的な状態で、リファクタの計画とリスクを切り分けるための意図的な選択。

- **どちらか一方だけ更新すると挙動が乖離する**ため、純関数を修正するときは**両ファイル必ず同時更新**すること
- 修正後は `npm run test` でテスト側の修正版を検証
- ビルドは App.jsx 側を使うため、本番動作は App.jsx 側の修正で決まる

### テスト失敗時の判断軸

| 状況 | 対応 |
|---|---|
| 既存テストが赤い | **変更が既存仕様を壊している可能性大**。本当に仕様変更したいか／回帰バグか判断。仕様変更ならテスト側も更新 |
| 新規テストを書いて赤い → 修正で緑にした | 期待通り（TDD） |
| 新規追加した純関数にテストが無い | **NG**。最低3件は書く |

### テストファイルの場所

- `src/lib/textUtils.js` — テスト対象（純関数）
- `src/lib/__tests__/textUtils.test.js` — 回帰テスト（過去バグごとに describe を分け、コメントで該当コミットを明記）

### 既知の対象範囲

| 対象 | 内容 |
|---|---|
| `extractChapters` | 章抽出（ラッパー優先＋inline fallback） |
| `extractSections` | 節・項抽出 |
| `dedupeBodyHeaders` | 本文ヘッダー重複除去（commit 4bb3316） |
| `dedupeOutputSections` | 章重複除去（commit 5b9fe86） |
| `normalizeChapterKey` | 章タイトル正規化 |
| `parseOutputSections` | === title === パース |
| `upsertChapterInOutput` | 章単位 upsert |
| `extractKeywords3Axes` | キーワード3軸抽出（旧/新形式両対応・commit 3085f1f） |
| `parseWorkProfileKeywords` | kw1/kw2 抽出 |

## 📂 リポジトリの基本ルール

- **作業ブランチ**: `phase1`（Vercel 自動デプロイ対象、本番反映用）
- main へのマージは行わない（モニター期間中）
- すべての commit は phase1 に積む
- **commit したら明示指示なしに `git push origin phase1` まで実行する**（feedback メモリーで指示済み）
- **push 前に必ず `npm run test && npm run build` で両方緑を確認**（🧪 セクション参照）
- API キーは絶対に画面・チャット・commit メッセージに貼らない

## 📚 主要ドキュメント

- `docs/SESSION_HANDOFF.md`：直近セッションの作業状況・進行中リファクタ宣言・残タスク
- `docs/LifeBookNavigator_全体設計書_2.md`：全体設計書（最終更新 2026-05-14）
- `dify/`：Dify Cloud のワークフロー YML（STEP0〜9 + 補助ワークフロー）
- `src/App.jsx`：React 19 メインアプリ（StepPage / Step0Page / Step1Page / Step2Page 等）
- `src/DiscussionPanel.jsx`：外部AI 相談プロンプト生成パネル（全STEP共通）
- `src/lib/textUtils.js`：純関数ユーティリティ（テスト対象・App.jsxと同期）
- `src/lib/__tests__/textUtils.test.js`：回帰テスト（vitest・37件）
- `api/dify.js`：workflow 型 STEP の Dify API プロキシ
- `api/dify-chat.js`：chat 型 STEP（STEP4 等）の Dify API プロキシ

## 🧭 技術スタック

- React 19 + Vite + Vercel Functions
- Dify Cloud（Anthropic Claude Sonnet 4.6 / OpenAI GPT-5.2）
- ブラウザ localStorage でユーザーデータ保持
- 相談機能は外部AI（ChatGPT Plus / Claude Pro）プロンプト生成方式

## ❓ 困ったとき

- ローカルとリモートが分岐した → `git log --oneline --graph --all -20` で構造把握
- push が hook で止められた → 表示メッセージに従って `git pull --rebase origin phase1` を実行
- 「設計と実装がズレている」と感じた → `docs/LifeBookNavigator_全体設計書_2.md` と `docs/SESSION_HANDOFF.md` の両方を確認
