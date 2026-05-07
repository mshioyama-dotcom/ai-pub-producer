# DiscussionPanel（出力相談機能）セットアップ手順

各STEPの出力に対して「💬 この出力について相談する」チャット機能を有効化するためのセットアップ手順です。

## 概要

| 構成要素 | ファイル |
|---|---|
| 共通Chatflow YML | `dify/STEP_共通_出力相談.yml` |
| API エンドポイント | `api/discuss.js` |
| Reactコンポーネント | `src/DiscussionPanel.jsx` |
| App.jsx 組み込み | `src/App.jsx`（StepPage コンポーネント内、全STEP共通） |

## セットアップ手順

### 1. Dify Cloud にChatflowをインポート

1. Dify Cloud にログイン
2. `アプリを作成 > インポート` を選び、`dify/STEP_共通_出力相談.yml` をアップロード
3. インポート後、アプリを開いて以下を確認：
   - モデル: `claude-sonnet-4-6`
   - モード: `agent-chat`
   - 入力変数: `step_num`, `step_name`, `step_rules`, `step_input_summary`, `step_output`, `author_profile`, `work_profile` の7つ
4. 「公開する」ボタンをクリックしてアプリを公開
5. 「APIアクセス」タブから API キーを発行・コピー

### 2. Vercel 環境変数を設定

Vercelプロジェクトの環境変数に以下を追加：

| Name | Value |
|---|---|
| `DIFY_API_KEY_DISCUSS` | （手順1.5でコピーしたAPIキー） |

設定後、Vercel側で再デプロイ（または次回のpushで自動反映）。

### 3. 動作確認

1. Preview URL（または本番）にアクセス
2. 任意のSTEPを実行して出力を生成
3. 出力エリアの直下に「💬 この出力について相談する」セクションが表示される
4. クリックして展開し、「気になる点を入力して送信してください」と表示されるテキストエリアに質問を入力
5. AIから返答が来れば成功

## トラブルシューティング

### 「DIFY_API_KEY_DISCUSS が設定されていません」エラー

→ Vercel環境変数 `DIFY_API_KEY_DISCUSS` が未設定。手順2を実施してから再デプロイ。

### 「Dify API error: ...」エラー

→ Dify側のChatflowが公開されていない／APIキーが間違っている。Dify Cloudで「公開」ボタンを押したか、コピーしたAPIキーが正しいかを確認。

### チャットが返答しない・空の返答が返る

→ Dify Cloud のアプリログを確認。モデル（Claude Sonnet 4.6）の認証が通っているか、トークン制限に達していないかを確認。

### 入力変数が一部空のままで送られる（warning が出る）

→ 仕様。`step_rules` `step_input_summary` `author_profile` `work_profile` は任意なので、空でも動作します。`step_num`, `step_name`, `step_output` だけは必須。

## Phase 1.5：コスト最適化（必読）

サブスク提供を見据え、相談機能のAPIコストを抑えるため以下が実装/設定されています。

### A. クライアント側のターン数制限（実装済み）

1スレッドあたり **5往復まで** に制限し、UIにカウンターを表示します（DiscussionPanel.jsx の `MAX_TURNS = 5`）。

- ユーザーは「残り3/5往復」のように表示で残数を把握できる
- 5往復に達したら送信欄が無効化される
- 続けたい場合は「相談履歴をリセット」してから新スレッドで開始

将来サブスクのプランごとに値を変えるなら、`MAX_TURNS` を props で受け取る設計に変更可能。

### B. work_profile の軽量化（実装済み）

DiscussionPanelに渡す書籍プロファイルから、相談に不要な部分を削除：

- ✅ 残す：`書籍プロファイル確定版` / `検索者の意図（仮説）` / `狙い目の切り口`
- ❌ 削る：`市場像` / `書籍プロファイル需要診断` / `総合勝率診断` / `STEP1修正提案` / `検証で参照した競合本`

`extractDiscussionContext()` 関数（src/App.jsx）で実装。STEP2 出力（60KB相当）が **10〜15KB** に圧縮されます。

### C. Dify Cloud で Prompt Caching を有効化（**ユーザー作業・要対応**）

これが**最大のコスト削減策**です。Anthropic Prompt Caching を有効化すると、毎回同じ静的プロンプト（pre_prompt + author_profile + work_profile）がキャッシュ化され、2回目以降は**入力料金が約90%割引**になります。

**設定手順（Dify Cloud）：**

1. Dify Cloud にログイン → 「STEP_共通_出力相談」アプリを開く
2. **「設定（オーケストレーション）」タブ → モデルプロバイダー設定**を開く
3. モデル設定の詳細（パラメーター）に **`extra_body` または `cache_control` の設定**があるか確認
   - Anthropic公式の Prompt Caching を有効化する設定項目
   - 一部のDifyバージョンでは「プロンプトキャッシュを有効化」のチェックボックスとして提供
4. 有効化したら、変更を保存して**アプリを再公開**（公開ボタンを再クリック）
5. 動作確認：相談を1往復実行 → Dify Cloud のログで「キャッシュトークン使用量」が記録されているか確認

**もしDify Cloudの管理画面に該当設定がない場合：**

- Difyのバージョンが古い可能性。最新版にアップグレード
- または、Anthropicの直接APIに切り替える（DifyからNG）
- 当面は Caching なしでローンチして、サブスク本番化のタイミングで検討

**参考リンク：**
- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Dify公式ドキュメント: https://docs.dify.ai/

### D. コスト効果の試算

| 設定 | 1往復コスト | 5往復コスト |
|---|---|---|
| 何もしない | $0.10 | $0.54 |
| work_profile軽量化のみ | $0.05 | $0.27 |
| 軽量化 + Prompt Caching | $0.02 | $0.10 |

→ **約5倍のコスト効率化**。サブスク¥980プランの黒字化に必須。

## Phase 2 で追加予定の機能

現状（Phase 1 + 1.5）では、AIの回答を「出力データへ転記」または「クリップボードにコピー」する運用です。Phase 2 では以下を予定：

- 「✨ この方針で再生成」ボタン：相談ログを自動要約して `improvement_request` に変換し、元のSTEP YMLの【6】改善要望機構に流し込んで再生成
- そのために、各STEP YML（STEP4〜9）に `previous_output` `improvement_request` の入力変数を追加（プロンプト【6】が機能するように）
- サーバー側でのユーザー単位の使用量制限（認証 + DB 導入後）

## アーキテクチャの設計判断（ふりかえり）

### なぜ共通Chatflow 1本にしたか

- 9本にすると保守が重い（プロンプト変更が9箇所）
- STEP固有のルール差は呼び出し時に `step_rules` 変数として注入すれば吸収できる
- Dify Cloudのアプリ管理がシンプル

### なぜ /api/dify-chat と別エンドポイントにしたか

- `/api/dify-chat` は STEP1, 3 のメインのチャット（インタビューや書籍プロファイル草案生成）用
- `/api/discuss` は出力後の相談用で、用途と APIキーが異なる
- 混ぜるとAPIキー管理と権限分離が難しくなる

### なぜ全STEPに表示するか

- 共通コンポーネントなので追加コストは0
- UXの一貫性（ユーザーが「このSTEPでは相談できる／できない」を覚える必要がない）
- チャット型STEPでも「最終出力サマリ」の再検討用に有用
