# GaggiMate 連携アプリ 開発ロードマップ & タスク管理

## 進捗凡例

- [ ] 未着手
- [x] 完了
- [~] 進行中

---

## Phase 1 ― 機体到着前（事前準備）

### 1.1 仕様調査・設計

- [x] 開発仕様書 v2.0 作成
- [x] GaggiMate WebSocket API 仕様調査
- [x] gaggimate-mcp（julianleopold / matvey-kuk）コード調査
- [x] GaggiMate ダミーシミュレーター作成
- [x] LLMプロンプト設計書作成（docs/PROMPT_DESIGN.md）

### 1.2 バックエンド（Python / FastAPI）

- [x] プロジェクト初期化（pyproject.toml）
- [x] SQLiteスキーマ実装（shots / shot_timeseries / beans / grind_settings / recipes / llm_suggestions / push_subscriptions）
- [x] DB マイグレーション基盤（Alembic） — alembic.ini + env.py + 初期マイグレーション追加済み
- [x] FastAPI サーバー雛形
  - [x] WebSocket クライアント（GaggiMate接続・データ受信）
  - [x] MQTT 購読・バッファリング（services/mqtt_client.py — MQTT_ENABLED=true で有効化）
  - [x] Webhook エンドポイント（ショット終了受信）
  - [x] ショット境界検知・自動保存ロジック
- [x] 数値分析モジュール
  - [x] 収率計算（yield / dose）
  - [x] 抽出時間・圧力カーブ分析
  - [x] 異常検知（目標との乖離フラグ）
- [x] LLM連携モジュール
  - [x] LM Studio クライアント（OpenAI互換API）
  - [x] 改善提案生成エンドポイント
  - [x] レシピカスタマイズ生成エンドポイント
  - [x] プロンプトテンプレート管理（ファイルベース + REST API）
  - [x] LLMプロンプトを英語化（gemma-4-e4b対応）
- [x] REST API
  - [x] ショットログ CRUD
  - [x] 豆マスター CRUD
  - [x] レシピ一覧・お気に入り・ソート
  - [x] レシピ編集・削除・アーカイブ（is_archived フラグ）
  - [x] レシピ削除の安全化（shots参照チェック + 409 + force=true でソフト削除）
  - [x] LLM提案履歴取得
  - [x] 設定永続化（GET/PUT /api/settings → config.json 読み書き）
  - [x] AI レシピ生成・チャット・コミュニティインポート
  - [x] 分析ダッシュボード・トレンド・ショット比較
- [x] シミュレーターとの結合テスト（31/31 PASS）

### 1.3 フロントエンド（React + Vite）

- [x] プロジェクト初期化（React + Vite + TypeScript）
- [x] ルーティング設定（React Router）
- [x] 画面実装
  - [x] ① ホーム（温度・圧力・状態 / レシピ選択 / スタート）
  - [x] ② 抽出中（リアルタイムグラフ2分割 / タイマー / ストップ / 目標重量プログレスバー）
  - [x] ③ 抽出後（結果サマリー / フィードバック入力フォーム / LLM提案3状態表示）
  - [x] ④ レシピ（ビジュアルエディタ / アーカイブ / タブ切替 / LLMカスタマイズ）
  - [x] ⑤ AI レシピ（生成 / チャット / コミュニティインポート + プレビュー）
  - [x] ⑥ ログ（ショット一覧 / 豆別・レシピ別フィルター / 行クリックで詳細 / 比較選択）
  - [x] ⑦ 分析（ダッシュボード / トレンド / ショット比較）
  - [x] ⑧ 設定（接続設定 / LM Studio / 通知 / 設定永続化）
  - [x] ⑨ スマホ連携（MobileConnect / QRコード表示）
- [x] グラフライブラリ導入（Recharts・2分割デュアルY軸）
- [x] WebSocket接続ロジック（シミュレーター対応）
- [x] API クライアント（FastAPIとの通信・型定義整備）
- [x] 抽出完了後 ShotResult へ自動遷移（最新ショットID取得）
- [x] E2Eテスト（Playwright 10/10 PASS）

### 1.4 開発環境・インフラ

- [x] monorepo構成整理（backend / frontend / simulator）
- [x] Docker Compose（FastAPI + シミュレーター + フロントエンド）
- [x] CI/CD 基盤（GitHub Actions: lint + test + integration）
- [x] 起動バッチ作成（start.bat / stop.bat — 全サービス一括起動・停止）
- [x] スマホLANアクセス対応（CORS allow_origins=* + api.ts 動的ホスト + vite host:0.0.0.0）
- [x] QRコードエンドポイント（/api/qr — LAN IP自動取得・PNG返却）
- [x] 日本語README作成・更新（README.ja.md）
- [ ] LM Studio 導入・推奨モデル（Qwen2.5:14B）動作確認 — 現在 gemma-4-e4b で動作中

---

## Phase 2 ― GaggiMate 導入後（実機接続）

### 2.1 実機接続・調整

- [ ] GaggiMate Pro WebSocket 実接続確認
- [ ] MQTT ブローカー設定・実データ受信確認
- [ ] Webhook 受信確認（v1.6.0+）
- [ ] ショット境界検知ロジック調整（実データベース）
- [ ] SQLite 自動保存の動作確認

### 2.2 フィードバック・LLM連携

- [ ] フィードバック入力フォーム実データ動作確認
- [ ] LLM 改善提案の品質検証・プロンプト調整
- [ ] 過去ショット比較分析の動作確認

### 2.3 通知

- [x] Web Push 通知実装（抽出完了 + LLM提案完了）
- [x] LINE Notify 連携（services/line_notify.py + /api/notifications/line-test + 設定画面UI）
- [ ] LINE Notify トークン実機テスト

---

## Phase 3 ― 安定稼働後（拡張）

### 3.1 ハードウェア拡張

- [x] BooKoo Themis スケール対応UI（stop_on_weight / dose_g / yield_g / 進捗バー）
  - GaggiMate Pro 本体が重量到達で自動停止（本体任せ）
  - アプリ側: ビジュアルエディタで stop_on_weight 設定 + 抽出中に進捗バー表示

### 3.2 分析・UI強化

- [x] 長期ログ分析ダッシュボード（Dashboard ページ + /api/analytics/dashboard）
- [x] 圧力カーブ比較グラフ（複数ショット重ね表示）（Compare ページ + /api/analytics/compare）
- [x] 豆別・レシピ別パフォーマンストレンド（Trends ページ + /api/analytics/trends）

### 3.3 LLMレシピ機能

- [x] LLM によるレシピ自動生成 UI（RecipeAI 生成タブ + /api/recipes/ai/generate）
- [x] レシピカスタマイズ対話 UI（RecipeAI チャットタブ + /api/recipes/ai/chat）
- [x] コミュニティレシピ取り込み・プレビュー（RecipeAI インポートタブ + /api/recipes/import）
- [x] LLMプロンプト英語化（gemma-4-e4b 対応・max_tokens 最適化）

### 3.4 レシピ管理強化

- [x] ビジュアルエディタ（圧力/時間/フロー/温度スライダー・タッチ対応）
- [x] 希望グラムでのレシピ変換（dose_g/yield_g → 抽出比率自動計算）
- [x] アーカイブ機能（is_archived フラグ / shots履歴保持）
- [x] タブ切替UI（すべて / オリジナル / コミュニティ / アーカイブ）
- [x] 削除の安全化（shots参照チェック + 警告モーダル）
- [ ] バージョン管理（recipe_versions テーブル・履歴閲覧・ロールバック）— レシピ増加後
- [ ] タグ機能（#ethiopia など）— レシピ50件超えたら

---

## 優先度ガイド

| 優先度 | タスク群 | 理由 |
|---|---|---|
| **最優先（Phase 2）** | GaggiMate 実機接続・調整 | 実機到着次第すぐ着手 |
| **高（Phase 2）** | LLM提案品質検証・プロンプト調整 | 実データで検証 |
| **中（Phase 3後半）** | レシピバージョン管理 | 破壊的編集の救済策 |
| **低（将来）** | タグ機能・クラウド同期 | レシピ50件超えたら |
