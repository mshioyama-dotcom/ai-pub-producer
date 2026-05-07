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

### C. Dify Cloud で Prompt Caching を全アプリに有効化（**ユーザー作業・要対応**）

これが**最大のコスト削減策**です。Anthropic Prompt Caching を有効化すると、毎回同じ静的プロンプト（pre_prompt + author_profile + work_profile）がキャッシュ化され、2回目以降は**入力料金が約90%割引**になります。

**全11アプリに同じ設定を適用してください**（チャット型・ループ型は効果絶大、単発型でも再生成時に効く）。

**標準設定テンプレ（全アプリ共通）：**

| 項目 | 値 |
|---|---|
| Cache Message Flow Threshold | **1** |
| Cache System Message | **True** ✅ |
| Cache Images | True |
| Cache Documents | True |
| Cache Tool Definitions | True |
| Cache Tool Results | True |

**設定対象アプリ（チェックリスト）：**

- [ ] STEP0_著者プロファイル_パターンA
- [ ] STEP1_書籍プロファイル草案（チャット型・効果大）
- [ ] STEP2_市場検証_書籍プロファイル確定（GPT-5.2のため無効動作だがONにしても害なし）
- [ ] STEP3_エピソードインタビュー_C案（チャット型・効果大）
- [ ] STEP4_タイトル・サブタイトル作成_C案
- [ ] STEP5_目次作成_C案
- [ ] STEP6_章構成作成_C案
- [ ] STEP7_詳細プロット作成_C案
- [ ] STEP8_本文作成_C案（**ループ型・最重要・効果最大**）
- [ ] STEP9_Amazon説明文作成_C案
- [x] STEP_共通_出力相談（要確認）

**設定の流れ（1アプリあたり30秒〜1分）：**

1. Dify Cloud にログイン → 対象アプリを開く
2. **「設定（オーケストレーション）」タブ** → モデル設定パネル（歯車アイコンや「Model Settings」）を開く
3. 上記テンプレ通りトグルをON
4. **「保存」または「Update」**ボタンをクリック
5. **アプリ画面に戻り「公開する」を再クリック**（再公開しないと反映されない）

**動作確認：**

設定後、Preview URL で2往復以上のチャットを実行 → Dify Cloud のログで `cache_read_input_tokens` または `prompt_cache_hit_tokens` が記録されていることを確認。

**もしDify Cloudの管理画面に該当設定がない場合：**

- Difyのバージョンが古い可能性。最新版にアップグレード
- 当面は Caching なしでローンチして、サブスク本番化のタイミングで検討

**参考リンク：**
- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Dify公式ドキュメント: https://docs.dify.ai/

### D. コスト効果の試算

#### 相談機能（5往復1スレッドあたり）

| 設定 | 1往復コスト | 5往復コスト |
|---|---|---|
| 何もしない | $0.10 | $0.54 |
| work_profile軽量化のみ | $0.05 | $0.27 |
| 軽量化 + Prompt Caching | $0.02 | $0.10 |

#### STEP8 本文作成（1章あたり3〜5節を連続生成）

| 設定 | 1章コスト |
|---|---|
| キャッシュなし | $3〜$8 |
| キャッシュあり | **$1〜$3**（最大の削減ポイント） |

#### 1冊全体（モニター¥980/月想定）

| 設定 | 1冊原価 |
|---|---|
| キャッシュなし | ¥1,500〜¥2,800 |
| **キャッシュあり** | **¥800〜¥1,500**（黒字化ライン到達） |

→ サブスク¥980プランで月1冊書き上げても黒字を維持できるラインに到達。

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
