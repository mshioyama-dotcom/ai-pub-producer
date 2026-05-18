# CLAUDE.md — ai-pub-producer プロジェクトでの作業ルール

このリポジトリで Claude（または他のAIエージェント）が作業する際の必須手順。
新しいセッションは必ず最初にこのファイルを読んでください。

## 🚨 セッション開始時の必須手順

1. **作業ディレクトリ確認**：必ず `C:\Users\mshio\Projects\ai-pub-producer` で作業する。
   `Downloads\Dify\.claude\worktrees\` 配下は worktree（一時コピー）で **実体ではない**。

2. **作業ブランチの確認と同期**（2026-05-19 から dev が通常作業ブランチ）：
   ```bash
   git fetch origin
   git checkout dev                              # 必ず dev に居ること
   git status
   git log --oneline HEAD..origin/dev -10        # origin が進んでいるか確認
   ```

3. **origin が進んでいたら必ず取り込む**：
   ```bash
   git pull --rebase origin dev
   ```
   コンフリクトが出たら手動で解決してから作業を再開する。
   phase1 で直接作業しない（本番反映時のみ phase1 に触れる・「🔀 開発→本番フロー」セクション参照）。

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
- dev / phase1 のどちらの push でも同じく動作する

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

- **作業ブランチ**: `dev`（開発・Preview デプロイ対象）
- **本番ブランチ**: `phase1`（Vercel Production Branch・本番反映用）
- main へのマージは行わない（モニター期間中）
- すべての commit はまず dev に積む
- **commit したら明示指示なしに `git push origin dev` まで実行する**（feedback メモリーで指示済み・ブランチ名は dev に更新）
- **push 前に必ず `npm run test && npm run build` で両方緑を確認**（🧪 セクション参照）
- API キーは絶対に画面・チャット・commit メッセージに貼らない

## 🔀 開発 → 本番フロー（必須・2026-05-19 から運用）

「開発環境で修正 → 動作確認 OK → 本番反映」の二段階リリースに移行した。**直接 phase1 にコミットしない**。

### ブランチ構成

```
┌───────────────────────────────────────┐
│ dev ブランチ（Preview デプロイ）       │
│  - 通常作業はすべてここ                │
│  - push 毎に Preview URL が更新される │
│  - URL: ai-pub-producer-v2-git-dev-... │
└───────────────┬───────────────────────┘
                │ 動作確認 OK 後
                │ ユーザー指示で merge & push
                ↓
┌───────────────────────────────────────┐
│ phase1 ブランチ（Production デプロイ） │
│  - Vercel Production Branch            │
│  - dev からマージ専用                  │
│  - URL: ai-pub-producer-v2.vercel.app  │
└───────────────────────────────────────┘
```

### 通常作業（dev）

1. dev ブランチで作業：`git checkout dev`（最初に必ず確認）
2. 修正・テスト・ビルド：`npm run test && npm run build`
3. commit：従来通り
4. push：`git push origin dev` を明示指示なしで自動実行
5. Vercel Preview URL（`...-git-dev-...vercel.app`）で動作確認

### 本番反映（dev → phase1）

ユーザーが以下のいずれかを発言したら、AI は確認なしで dev → phase1 の昇格を実行する：

- 「本番反映」「本番に反映」「Production にデプロイ」「phase1 に反映」
- 「本番に上げて」「本番更新して」「リリースして」
- 「dev を phase1 にマージして」

**AI が実行するコマンド（dev の最新を phase1 に取り込んで push）**：

```bash
git -C C:/Users/mshio/Projects/ai-pub-producer fetch origin && \
git -C C:/Users/mshio/Projects/ai-pub-producer checkout phase1 && \
git -C C:/Users/mshio/Projects/ai-pub-producer pull --rebase origin phase1 && \
git -C C:/Users/mshio/Projects/ai-pub-producer merge --no-ff origin/dev -m "merge: dev → phase1 (本番反映)" && \
git -C C:/Users/mshio/Projects/ai-pub-producer push origin phase1 && \
git -C C:/Users/mshio/Projects/ai-pub-producer checkout dev
```

完了後、Vercel Production URL（`ai-pub-producer-v2.vercel.app`）の更新を確認するようユーザーに案内する。

### 緊急時の hotfix

本番だけ即座に直したい場合（dev で進行中の改修と分けたいケース）は：

```bash
git checkout phase1
git checkout -b hotfix/<内容>
# 修正
git commit
git checkout phase1 && git merge --no-ff hotfix/<内容>
git push origin phase1
# その後 dev にも取り込む
git checkout dev && git merge --no-ff phase1 && git push origin dev
```

ただしこれは例外運用。**通常はすべて dev 経由**。

### Vercel 側の設定（既設・確認用）

- Production Branch: `phase1`
- Preview Branches: すべてのブランチ（dev 含む）が自動 Preview デプロイ
- env var はすべてブランチ制限なし（`scripts/fix-vercel-env-branch.mjs` で 2026-05-19 に解除済み）

## 🔢 STEPS 配列を拡張するときのチェックリスト（必須）

新しい STEP を `src/App.jsx` の `STEPS` 配列に追加するとき、これ全部やらないと**本番で白画面が出る**（コミット `e39969c` の事故・STEP11追加で実際に発生）。

### コード側で対応すること

- [ ] `STEPS` 配列に新規 entry 追加（id / num / title / description / category / type / url / inputs / outputTitle / help）
- [ ] `CATEGORIES` 配列の該当 category の `steps` 配列に番号追加
- [ ] `api/dify.js` の `API_KEYS` map に `[新stepNum]: process.env.DIFY_API_KEY_STEP<NN>` を追加
- [ ] `api/dify.js` の `resolveApiKey` がその step を正しい環境変数にルーティングするか確認（新規 step では分岐追加が必要なことが多い）
- [ ] `api/dify.js` の `mapInputs` で必要なキーリマップを追加（YML 入力変数名と front 側変数名が違う場合）
- [ ] 入力フィールドに **新しい type（select 等）を使う場合**は、`StepPage` の field renderer に分岐を追加
- [ ] **`loadAllSteps` / `resetAllData` は `STEPS` 配列を動的に走査しているか確認**（ハードコード `1〜10` などにしないこと）
- [ ] **`Badge` コンポーネントは undefined-safe か**（`STATUS_COLORS[status]` の null チェック必須）

### Dify 側で対応すること

- [ ] `dify/STEP<NN>_<機能名>.yml` を新規作成（既存ワークフロー YML を参考に）
- [ ] Dify Cloud に DSL インポート → ワークフローを **公開**
- [ ] 公開後の API キー を取得

### Vercel 側で対応すること

- [ ] Vercel 環境変数に `DIFY_API_KEY_STEP<NN>` を追加（Production / Preview / Development 全部チェック）
- [ ] **環境変数追加だけでは反映されないため、必ず Redeploy する**（Build Cache のチェックを外す）

### 🔧 環境変数追加後の自動 Redeploy ルール（AI 側の運用）

**Vercel は env var をビルド時のみ注入する仕様**のため、env var を追加しても既存デプロイには反映されない。これは毎回踏むため、AI 側の運用で必ず自動化する：

- ユーザーが「env var を追加した」「Vercel に環境変数追加完了」「DIFY_API_KEY_STEP** を入れた」等を報告した直後、**AI は確認なしで以下を自動実行する**：

  ```bash
  # 開発 Preview 用（通常はこちら）
  git -C C:/Users/mshio/Projects/ai-pub-producer commit --allow-empty -m "chore: trigger redeploy to pick up DIFY_API_KEY_STEP<NN> env var" && git -C C:/Users/mshio/Projects/ai-pub-producer push origin dev
  ```

  本番にも env var を反映済みで Production を直ちに再デプロイしたい場合のみ、ユーザーが「本番反映」を明示してから phase1 にも空 commit を積む（dev → phase1 マージ経由ではなく phase1 直接の場合）。
- ユーザーに「Vercel ダッシュボードで Redeploy 押して」とは**もう案内しない**（手間を増やすだけ）。AI が代行する。
- これは新規 STEP 実装時の他、既存 STEP のキー追加・キー差し替え時にも同じく適用する。

### 動作確認

- [ ] サイドメニューに新 STEP が「未着手」で表示される
- [ ] 新 STEP をクリックしてページが開く
- [ ] **既存ユーザーの localStorage を持つ状態**でも白画面にならない（ハードリフレッシュ Ctrl+Shift+R で確認）
- [ ] 入力フィールドが正常に表示される
- [ ] `▶ 実行する` を押して Dify が応答する

## 📚 主要ドキュメント

- `docs/SESSION_HANDOFF.md`：直近セッションの作業状況・進行中リファクタ宣言・残タスク
- `docs/LifeBookNavigator_全体設計書_v4.md`：全体設計書（最新版・STEP11/12/13 実装反映済み・最終更新 2026-05-18）
- `docs/LifeBookNavigator_全体設計書_2.md`：旧設計書（参考・2026-05-14）
- `dify/`：Dify Cloud のワークフロー YML（STEP0〜13 + 補助ワークフロー）
- `src/App.jsx`：React 19 メインアプリ（StepPage / Step0Page〜Step13Page 等）
- `src/DiscussionPanel.jsx`：外部AI 相談プロンプト生成パネル（全STEP共通）
- `src/lib/textUtils.js`：純関数ユーティリティ（テスト対象・App.jsxと同期）
- `src/lib/__tests__/textUtils.test.js`：回帰テスト（vitest・37件）
- `api/dify.js`：workflow 型 STEP の Dify API プロキシ
- `api/dify-chat.js`：chat 型 STEP（STEP4 等）の Dify API プロキシ
- `api/step2.js`, `step2-add.js`, `step3.js`, `step12.js`, `step13.js`, `work-profile-confirm.js`：個別オーケストレータ（RapidAPI 統合・複雑なフロー専用）

## 🧭 技術スタック

- React 19 + Vite + Vercel Functions
- Dify Cloud（Anthropic Claude Sonnet 4.6 / OpenAI GPT-5.2）
- ブラウザ localStorage でユーザーデータ保持
- 相談機能は外部AI（ChatGPT Plus / Claude Pro）プロンプト生成方式

## ❓ 困ったとき

- ローカルとリモートが分岐した → `git log --oneline --graph --all -20` で構造把握
- push が hook で止められた → 表示メッセージに従って `git pull --rebase origin <現在のブランチ>` を実行（通常は dev）
- どのブランチに居るか分からない → `git branch --show-current`（通常は dev）
- Preview URL と Production URL の違い：
  - Preview = `ai-pub-producer-v2-git-dev-...vercel.app`（dev push で更新）
  - Production = `ai-pub-producer-v2.vercel.app`（phase1 push で更新）
- 「設計と実装がズレている」と感じた → `docs/LifeBookNavigator_全体設計書_v4.md` と `docs/SESSION_HANDOFF.md` の両方を確認
