# セッション引き継ぎドキュメント

> 別チャットで作業を継続するためのコンテキスト一式。
> 新しいチャットを開いたら、このファイルの内容を最初に貼り付けて作業を再開してください。

最終更新コミット: `8f2bb15` (2026-05-09)

---

## 🚨 新セッションで最初に必ず確認すること（最重要）

### ✅ 正しいリポジトリパス
```
C:\Users\mshio\Projects\ai-pub-producer
```
すべての `git` / `npm` / ファイル操作はこのパスで行う。

### ❌ 間違えてはいけないパス（過去に混乱した実例あり）
- `C:\Users\mshio\Downloads\Dify\.claude\worktrees\zen-mahavira-667248`（古いworktree）
- `C:\Users\mshio\Downloads\Dify\.claude\worktrees\upbeat-wilbur-9f9b25`（前セッションのworktree）
- その他 `Downloads\Dify\` 配下のすべて

これらは **Claude Code のワークツリー機能で作られた一時ディレクトリ**であり、実体ではありません。
新セッションで `Downloads\Dify\` 配下を開いてしまうと、コミット履歴が分岐して混乱します。

### ✅ 確認コマンド（新セッションの最初に実行）
```bash
cd "C:\Users\mshio\Projects\ai-pub-producer"
git status
git log --oneline -5
git rev-parse HEAD
git branch --show-current
```

期待される結果：
- `git status`: clean（or 把握済みの未コミット変更のみ）
- `git log` 先頭: `8f2bb15 fix(review): 各STEPに「方向性ズレ」捕捉用の観点を追加（v5）`
- `git rev-parse HEAD`: `8f2bb15797e359a372b0ea8cb206e9ca5fcabb4a`
- `git branch --show-current`: `phase1`

### ✅ ブランチ運用
- 作業ブランチ: **`phase1`**（モニター期間用、本番デプロイ対象）
- `main` への merge は行わない（モニター期間中）
- すべての commit は `phase1` に積み、push する

---

## 🆕 直近セッション（2026-05-09）の主要変更まとめ

時系列で6つの大きな変更が入った。**v3 → v4 → v5** の段階的進化。

### Phase 1: 改善要望ループの完全廃止（commit `4293420`）

**背景**：以前のセッションで「外部AIで改善要望文を作る → Difyで再生成」というハイブリッドループを実装した（commit `fcc5ee3`, `c22335a`, `7a1939b`）が、API利用料暴走リスクからユーザーが廃止を決定。

**削除した機構**：
- `DiscussionPanel.jsx` プロンプトのセクション5（改善要望文）→ セクション6（修正版）を「5」に繰り上げ
- `App.jsx` Step1Page / Step2Page / StepPage の `improvementRequest` state, `handleRegenerateWithRequest` 関数, 「✨ 改善要望で Dify 再生成」UIブロック
- StepPage では STEP8 のループ再生成パスも削除（`getAutoInjectedProfiles` を使った各節再生成）

**残置（dormant）**：
- Dify YML（STEP1/2/5）の `previous_output` / `improvement_request` 入力変数とプロンプト内「改善要望機構」節は呼び出し経路が無くなったがそのまま残っている。動作上の害なし。クリーンアップ希望なら別タスクで実施可能。

### Phase 2: レビュー無限ループ対策 v4（commit `7e68210`）

**問題**：レビューを繰り返すと、AIが「指摘ゼロ＝仕事してない」という構造的バイアスにより、毎回別の角度から新しい指摘を生成し続けてしまう。合格水準の出力でも無限に修正版を作ろうとする。

**対策（A + B + C 三段構え）**：

#### A. 合格判定ルールをプロンプト先頭に追加
```
合格条件（両方満たせば「✅ 合格：このまま次STEPへ進んでOK」で終了）：
- 「✗ 致命的」が 0個
- かつ「△ 要改善」が 1個以下
```
さらに「△は後段全体に影響を及ぼす歪みのみ」「微調整レベルでは ✓ OK」を明示。

#### B. STEP別観点を3つに絞り込み（旧7観点 → 新3観点）
観点が多いほど必ず△が出るため、各STEPの核に絞った。

#### C. ループ警告UI
DiscussionPanel ヘッダーに「レビュー3回以上は過剰」「もう十分は著者判断で」を黄色警告で表示。

### Phase 3: UI使い方説明を圧縮（commit `b429532`, `87b2290`）

3つのボックス（黄「返答の流れ」／橙「ループ警告」／青「使い方の流れ8ステップ」、合計80行のJSX）→ 1ボックス（16行）に統合。冗長な8ステップ手順を削除。

### Phase 4: 検索キーワードを全軸2語厳守に統一（commit `c3b69c8`, `6878edd`）

**問題**：旧仕様は「主題軸=2語、読者軸=2〜3語、差分軸=2〜3語」でばらつきがあり、AIが「キャリア 棚卸し 40代」のように3語で出力していた。3語検索だとAmazon Kindleの結果が極端に少なくなり（実例で1冊のみ）、Keepa APIが市場データを取得できないリスク。

**修正**：
- `dify/STEP1_書籍プロファイル草案.yml`: 全軸を「ちょうど2語・3語禁止」に統一。NG例に3語パターン追加。セルフチェック項目0で語数チェック最優先化。Self-Refine 内部 Step B にも語数チェック追加。
- `dify/STEP2_市場検証_書籍プロファイル確定.yml`: 出力フォーマットに2語ルール明記。Self-Refine 自己批評項目10「検索キーワードの語数」追加。
- `src/DiscussionPanel.jsx`: STEP1/STEP2 のレビュー観点に「検索キーワードの語数（厳格2語）」追加。3語以上は「✗ 致命的」判定。

**運用注意**：年代を入れたい場合は他の語と入れ替える（追加ではなく置換）。例：「40代 キャリア 迷い」→「キャリア 迷い」or「40代 迷い」。

### Phase 5: 観点を増やして「合格しすぎ問題」に対応 v5（commit `8f2bb15` ← 現在のHEAD）

**問題**：v4で核3観点に絞った結果、「合格しか出ない」現象が発生。STEP3で「自己理解の本」のはずが「副業ノウハウ素材」が混入していても合格判定された。相談機能の存在意義が問われる状況に。

**対策**：各STEPに「方向性ズレ」「コンセプト整合」を捕捉する観点を1つずつ追加（4〜5観点に拡張）。

#### v5 の最新観点表
| STEP | 観点（4〜5個） |
|---|---|
| 0 | 強み・思想の具体性 / 書籍依存項目混入 / **文体・フレーズの再現性** / 素材有用性 |
| 1 | 読者像の一貫性 / コンセプトの一貫性 / 差別化 / **動機の整合性とスコープ** / 検索キーワード語数 |
| 2 | 市場像の中立性 / 確定版の進化 / コンセプト・読者像の一貫性 / **狙い目の切り口の有用性** / 検索キーワード語数 |
| 3 | 場面の具体性 / 差別化軸の絞り込み / 読者の思い込みの言語化 / **前STEPコンセプトとの整合** |
| 4 | KDP規約遵守 / kw1+kw2含有 / 差別化と3案の方向性差 / **コンセプトとの整合** |
| 5 | コンセプト・タイトル整合 / 章構造のロジック / 節タイトル具体性 / **導線役本判定と誘導臭リスク** |
| 6 | 節要約具体性 / インタビュー素材活用 / コンセプト・タイトル整合 / **読者の変化** |
| 7 | 項の具体性 / インタビュー素材活用 / **コンセプト・タイトル整合と章間連続性** / 形式規律 |
| 8 | コンセプト整合性 / 読者目線の分かりやすさ / 読者離脱リスク / **著者の文体・トーン整合性** |
| 9 | KDP NG語＋禁止表現 / 7段落構成 / 読者像とコンセプト整合 / **冒頭の離脱リスク** |

合格判定ルール（致命的0＋△1以下）は維持。**追加観点で「方向性ズレ」「コンセプト揺れ」を後段への致命的影響として捕捉**できるようにした。

---

## 🔥 次セッションで論点になっている未解決問題

### STEP3 の素材レベル方向性ズレ（v5 でも完全には捕捉できなかった）

**現状**：
- v5 観点で再評価しても「✅ 合格」が出る
- 理由：差別化軸の主張「動いた結果として人生が変わった軌跡」は確定版コンセプト「自己理解の入口」と論理的に整合している
- AIは「素材は混在しているが核は整合」と判断

**しかし、タイトル訴求素材レベルでは副業/出版ノウハウ素材が残っている**：
```
・Kindle出版20冊以上・累計印税300万円超
・「Note有料記事→Kindle出版」という再現可能な2ステップの移行ルート
・ビジネススキル本・副業ノウハウ本という題材ジャンルの実例
・AIを活用したノウハウ仕組み化という次のステップへの導線
```

**このまま STEP4 へ進むと**、タイトル設計AIが「累計300万円」「2ステップ」「Kindle出版」を前面に出す可能性が高い。

### 推奨対応（次セッション開始時のオプション）

#### A. 著者として STEP3 出力を手動で軽く修正してから STEP4 へ進む（推奨）
タイトル訴求素材から以下を削る or 後ろに置く：
- 「累計印税300万円超」（権威付けとして残すなら最後尾に）
- 「ビジネススキル本・副業ノウハウ本という題材」（削除推奨）
- 「AIを活用したノウハウ仕組み化」（本書の文脈と最も離れているので削除推奨）

#### B. STEP4 のレビューで「コンセプトとの整合」観点が機能するか観察
v5 で STEP4 にも「コンセプトとの整合」観点を追加済み。ここで副業寄りタイトルが捕捉されるか検証。

#### C. STEP3 観点をさらに具体化（v6）
「前STEPコンセプトとの整合」を「素材レベルでも混在チェック」に書き換え。ただし過剰解像度のリスクあり。

**著者の意思決定が必要**：A（手動修正）か B（自動チェックに任せる）か。

---

## ⚠️ Dify Cloud 再インポートが必要なファイル

以下を Dify Cloud にインポートし直さないと、最新の挙動になりません：

1. **`dify/STEP1_書籍プロファイル草案.yml`** — キーワード2語厳守ルール（commit `c3b69c8`）
2. **`dify/STEP2_市場検証_書籍プロファイル確定.yml`** — キーワード2語厳守ルール（commit `6878edd`）

その他のSTEP（4, 5, 6, 7, 8, 9）は前回セッションで再インポート済みであれば追加対応不要。
DiscussionPanel.jsx の変更（v5観点追加）は **Vercel自動デプロイで反映される**（再インポート不要）。

---

## 🚧 残タスク（優先度別）

### 優先度：高（次セッションで議論）
- STEP3 → STEP4 移行時の素材整理判断（前述）
- v5 観点追加後のレビュー挙動検証（合格判定が「適度に」出るか、過剰に厳しくなっていないか）

### 優先度：中
- Dify YML（STEP1/2/5）に残っている `previous_output` / `improvement_request` 入力変数のクリーンアップ
  - 呼び出し経路は無いため動作上の害はないが、YMLが膨らんでいる
  - クリーンアップする場合は3ファイル分の YML 修正＋ Dify Cloud 再インポートが必要

### 優先度：低
- `docs/LifeBookNavigator_全体設計書_2.md` の方針転換反映（plan `shimmying-toasting-moler.md` 未着手）
  - STEP10（A+コンテンツ）削除
  - STEP11（プレゼント企画）削除＋運用方針メモ追加
  - STEP12（X投稿）の依存切り替え（プレゼント情報をユーザー手動入力に）

---

## 🚀 デプロイ状態

- **GitHub**: `phase1` ブランチ HEAD = `8f2bb15` push済み
- **Vercel**: 自動デプロイ完了済み（commit時刻から1〜2分後に反映）
- **本番URL**: Vercel `ai-pub-producer-v2`

新セッション開始時にユーザーが UI を確認する場合、ブラウザで Ctrl+Shift+R（ハードリフレッシュ）が必要。

---

## 🗂 直近セッションのコミット一覧（時系列）

```
8f2bb15 fix(review): 各STEPに「方向性ズレ」捕捉用の観点を追加（v5）   ← 現在のHEAD
8432d49 docs(handoff): 直近セッションの変更を引き継ぎドキュメントに反映
6878edd fix(step2): 検索キーワード3軸の2語厳守ルールをSTEP2にも追加＋レビュー観点に語数チェックを追加
c3b69c8 fix(step1): 検索キーワード3軸を全て厳格に2語に統一（3語禁止）
87b2290 refactor(review): 使い方UIを最小限に圧縮
b429532 fix(review): 使い方の流れの説明文を最新仕様に追従
7e68210 fix(review): レビュー無限ループ対策（合格判定＋3観点絞り込み＋警告UI）
4293420 revert(discussion): 改善要望→Dify再生成ループを削除しAPIコスト暴走を防止
7a1939b fix(step5): 改善要望機構の変数参照が漏れていたため追加（旧設計の名残）
c22335a feat(regenerate): STEP1/STEP2 にも改善要望機構を追加（旧設計・後に廃止）
fcc5ee3 feat(regenerate): 外部AIレビュー → Dify再生成 のハイブリッド導線を実装（旧設計・後に廃止）
```

---

## 🎯 プロジェクト基本情報

- **プロジェクト名**: AI出版プロデューサー（Life Book Navigator）
- **リポジトリパス（正）**: `C:\Users\mshio\Projects\ai-pub-producer`
- **ブランチ**: `phase1`（モニター期間用、本番デプロイ対象）
- **GitHub**: `https://github.com/mshioyama-dotcom/ai-pub-producer.git`
- **本番URL**: Vercel `ai-pub-producer-v2`
- **技術スタック**: React 19 + Vite + Vercel Functions + Dify Cloud (Anthropic Claude Sonnet 4.6 / GPT-5.2)
- **現在のHEAD**: `8f2bb15` (`phase1` ブランチ)

> ⚠️ **絶対に間違えてはいけない**：`Downloads\Dify\.claude\worktrees\` 配下のディレクトリは Claude Code のworktree機能で作られた一時コピーであり、実体ではない。新セッション開始時は必ず `C:\Users\mshio\Projects\ai-pub-producer` で作業を開始すること。

---

## 📦 サブスク商品としての位置付け

- **モニタープラン**: ¥980/月、¥1980/月
- **正式プラン**: ¥5,000/月
- **ターゲット**: 40〜50代会社員、書籍を出して自分軸を見つけたい層

### 1冊あたりの推定原価（Prompt Caching有効時）

- ¥800〜¥1,500（キャッシュ有効・最適化後）
- ¥980プランで月1冊できれば収支ギリギリ黒字
- ¥5,000プランは月1〜2冊なら健全

---

## 🏗️ 9STEP構成

| STEP | 内容 | 型 | Dify YML |
|---|---|---|---|
| STEP0 | 著者プロファイル | workflow | `STEP0_著者プロファイル_パターンA.yml` |
| STEP1 | 書籍プロファイル草案 | **chat** | `STEP1_書籍プロファイル草案.yml` |
| STEP2 | 市場検証→書籍プロファイル確定 | workflow | `STEP2_市場検証_書籍プロファイル確定.yml` (GPT-5.2) |
| STEP3 | エピソードインタビュー | **chat** | `STEP3_エピソードインタビュー_C案.yml` |
| STEP4 | タイトル・サブタイトル作成 | workflow | `STEP4_タイトル・サブタイトル作成_C案.yml` |
| STEP5 | 目次作成 | workflow | `STEP5_目次作成_C案.yml` |
| STEP6 | 章構成作成 | workflow + iterator | `STEP6_章構成作成_C案.yml` |
| STEP7 | 詳細プロット作成 | workflow | `STEP7_詳細プロット作成_C案.yml` |
| STEP8 | 本文作成 | workflow + loop | `STEP8_本文作成_C案.yml` |
| STEP9 | Amazon説明文作成 | workflow | `STEP9_Amazon説明文作成_C案.yml` |

すべて Claude Sonnet 4.6 を使用（STEP2 のみ GPT-5.2）。

---

## ⚙️ 主要なコンポーネントとファイル

### フロントエンド

- `src/App.jsx` — メインReactアプリ（2700行〜）
  - `Step0Page` / `Step1Page` / `Step2Page` — 専用ページ
  - `StepPage` — STEP3〜9の汎用ページ
  - 関数: `extractDiscussionContext()` (work_profile軽量化)、`parseStep4CaseStructure()` 等（現在未使用、将来用途）
- `src/DiscussionPanel.jsx` — **外部AIプロンプト生成パネル**（次項で詳細）
- `src/utils/extractText.js` — ファイル読み込みヘルパー

### API

- `api/dify.js` — workflow型STEPのDify呼び出し
- `api/dify-chat.js` — chat型STEP（STEP1, 3）のDify呼び出し
- `api/discuss.js` — **現在未使用**（外部AI方式への移行で凍結。コードは残す）
- `api/debug-log.js` — デバッグ用

### Vercel環境変数

```
DIFY_API_KEY_STEP00_A
DIFY_API_KEY_STEP01
DIFY_API_KEY_STEP02
DIFY_API_KEY_STEP03  (STEP3エピソードインタビュー)
DIFY_API_KEY_STEP04  (STEP4タイトル)
DIFY_API_KEY_STEP05
DIFY_API_KEY_STEP06
DIFY_API_KEY_STEP07
DIFY_API_KEY_STEP08
DIFY_API_KEY_STEP09
DIFY_API_KEY_DISCUSS  ← 設定済みだが現在未使用
```

---

## 💬 DiscussionPanel（外部AIプロンプト生成パネル）

### 設計の経緯（重要）

1. **当初（Phase 1）**: 内蔵チャットでAIと議論する設計
2. **Phase 1.5**: ターン制限・work_profile軽量化・Prompt Caching
3. **Phase 2**: ✨「この方針で再生成」ボタン + 改善要望機構（YML側）
4. **方針転換**: ユーザーフィードバックで内蔵チャットを廃止
   - 理由：狭いテキストエリア、永遠のラリー、APIコスト発生
5. **現在**: **外部AI（ChatGPT/Claude.ai）用のプロンプトを生成**するパネルに変身
6. **最新調整**: 「相談スタンス」から「提案出しスタンス」へ
   - AIが質問返ししない
   - 方向性受け取ったら即・3案提示

### 現在の動作

```
ユーザー：STEP4で出力済み
  ↓
「📋 外部AIで相談する用プロンプトを取得」を開く
  ↓
表示されるプロンプト（textarea）をコピー
  ↓
ChatGPT or Claude.ai に貼り付けて送信
  ↓
「方向性を伝えてください」と促されるので
  「案2のサブを変えたい」等を入力
  ↓
AIが3つの改善案を完全な出力形式で返してくれる
  ↓
気に入った案 → 「2案目で確定」 → 確定版だけ再掲
  ↓
ユーザーがコピー → ツールの出力欄に貼り付け
  ↓
「出力データを保存」で確定
```

### STEPごとの役割定義

`src/DiscussionPanel.jsx` 内の `STEP_ROLE_HINTS` でSTEP別の役割と制約を定義。
特にSTEP4には「Amazon KDP規約違反語禁止」「kw1/kw2必須」等が含まれる。

---

## 🔧 残されている機能（凍結中・未削除）

将来用途のため残してある：

1. **YML側の改善要望機構** (`previous_output` `improvement_request` 入力変数)
   - STEP4〜9 のYML に組み込み済み
   - 現在のフロントから直接呼ぶことはないが、Dify Cloud で直接APIを叩く高度な使い方では使える

2. **`/api/discuss` エンドポイント**
   - DiscussionPanel が外部AI方式になったため未使用
   - コードは残してある（環境変数 `DIFY_API_KEY_DISCUSS` も設定済み）

3. **`parseStep4CaseStructure` / `mergeStep4Case` / `extractStep4Case`** ユーティリティ
   - 案ごとフォーカスモードで使っていたが、現在未使用
   - 将来「案単位の編集UI」を作る場合に流用可能

4. **`dify/STEP_共通_出力相談.yml`**
   - 内蔵チャット時代の Discussion Chatflow
   - 未使用だが Dify Cloud にimport済み

---

## 🚀 Dify Cloud側の状態

### 11アプリすべてに Prompt Caching を有効化済み

設定値：
- `Cache Message Flow Threshold: 1`
- `Cache System Message: True`
- `Cache Images / Documents / Tool Definitions / Tool Results: True`

これによりAPI原価が約1/5に削減されている。

### import済みYML

すべての最新YMLが Dify Cloud にimport・公開済み。
（Phase 2 の改善要望機構変更も反映済み）

---

## 🎯 残作業 / 今後の選択肢

### Phase 3: サブスク認証・DB（最優先・未着手）

- **Supabase Auth** でユーザー認証
- **Supabase Postgres** でユーザー・サブスク・使用量管理
- **Stripe** で決済・Webhook
- 各 `/api/*` エンドポイントでサーバー側の使用量制限
- 工数見積もり：**約11日（1人）**
- モニター開始は**招待制で先行**（並行でPhase 3開発）が推奨ルート

### その他の候補

- 動作確認の継続（STEP5〜9 の Phase 2 / 外部AIプロンプト方式テスト）
- プロンプトのチューニング（ユーザーフィードバック次第）
- STEP0/1/2 のDiscussionPanel 微調整
- 利用ログ収集の仕組み（モニター期間中にデータ蓄積）

### 設計書ベースの今後計画 STEP

- **STEP12（X投稿）**：Phase 3 として残す。プレゼント情報はユーザー手動入力欄で対応
- **STEP13（出版状況分析）**：Phase 2。Keepa API 統合で売れ行きベースの改善案生成
- **STEP14（次回作構想）**：Phase 2。STEP13 結果を元に次回作の方向性 + 著者プロファイル更新案を生成

### 計画から削除された機能

- ~~STEP10（A+コンテンツ）~~：中途半端な切り出しになるため計画から削除
- ~~STEP11（プレゼント企画）~~：サブスク会員特典として運営者が手動で作成・配布する運用に変更
  （詳細は `docs/LifeBookNavigator_全体設計書_2.md` セクション19「プレゼント特典の運用方針」参照）

---

## 📝 直近の意思決定の流れ

セッションの主な意思決定（時系列）：

1. STEP4 タイトル生成で「ベストセラー」が出る問題 → プロンプトに核メッセージ整合性ルール追加
2. Amazon KDPガイドラインを公式ソース付きでプロンプトに組み込み
3. 内蔵チャットでDiscussion機能を実装（Phase 1）
4. ターン上限・work_profile軽量化・Prompt Caching でコスト削減（Phase 1.5）
5. ✨「この方針で再生成」ボタン実装（Phase 2）
6. STEP6-9 にも改善要望機構を個別実装
7. **「内蔵チャットは過剰実装」と判断 → 外部AIプロンプト生成方式へリファクタ**
8. UI簡素化（フォーカスモード削除、外部AI起動ボタン削除）
9. プロンプトを「相談スタンス」から「提案出しスタンス」に変更（最新）

---

## 🛠️ よくある作業コマンド

```bash
# プロジェクトディレクトリへ
cd C:\Users\mshio\Projects\ai-pub-producer

# 状態確認
git status
git log --oneline -10
git branch --show-current  # phase1 のはず

# ビルド確認
npm run build

# 標準コミット & push
git add <files>
git commit -m "..."
git push origin phase1
```

### コミットメッセージのスタイル

```
<種類>(<スコープ>): <要約>

<詳細説明>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

種類: `feat` / `fix` / `refactor` / `simplify` / `docs` / `chore` / `tweak`
スコープ例: `discuss` / `STEP4` / `prompt` / `caching`

---

## 🚨 注意事項

- **作業は必ず `Projects\ai-pub-producer`** で行うこと（Downloads/Dify ではない）
- **branch: phase1** を維持
- main ブランチへのマージはまだ。phase1 で開発継続
- Vercel自動デプロイ（GitHub push連動）。デプロイ完了まで1〜2分
- API_KEYは絶対に画面・チャットに直接貼らない（Vercel browser経由で設定）
- 過去に **API キーが画面に映ってしまった事故あり**。再発防止のためダイアログ・コマンド入力時は注意

---

## 引き継ぎ時の最初のメッセージ例

新チャットでこう書けば即座に状況把握できます：

```
AI出版プロデューサー（Life Book Navigator）の作業継続。
リポジトリ: C:\Users\mshio\Projects\ai-pub-producer
ブランチ: phase1
最新コミット: 966c8df

docs/SESSION_HANDOFF.md を読んで状況把握してください。
そのあと、次にやるタスクを相談したい。
```
