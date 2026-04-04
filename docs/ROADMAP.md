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
- [ ] DB マイグレーション基盤（Alembic）
- [x] FastAPI サーバー雛形
  - [x] WebSocket クライアント（GaggiMate接続・データ受信）
  - [ ] MQTT 購読・バッファリング
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
- [x] REST API
  - [x] ショットログ CRUD
  - [x] 豆マスター CRUD
  - [x] レシピ一覧・お気に入り・ソート
  - [x] LLM提案履歴取得
- [x] シミュレーターとの結合テスト

### 1.3 フロントエンド（React + Vite）

- [x] プロジェクト初期化（React + Vite + TypeScript）
- [ ] UIコンポーネントライブラリ選定（shadcn/ui or MUI）
- [x] ルーティング設定（React Router）
- [x] 画面実装
  - [x] ① ホーム（温度・圧力・状態 / レシピ選択 / スタート）
  - [x] ② 抽出中（リアルタイムグラフ / タイマー / ストップ）
  - [x] ③ 抽出後（結果サマリー / フィードバック入力フォーム）
  - [x] ④ 改善提案（LLM提案テキスト — ③に統合）
  - [x] ⑤ レシピ（一覧 / お気に入り / ソート / カスタマイズ依頼）
  - [x] ⑥ ログ（ショット一覧 / 豆別フィルター）
  - [x] ⑦ 設定（接続設定 / LM Studio / 通知）
- [x] グラフライブラリ導入（Recharts）
- [x] WebSocket接続ロジック（シミュレーター対応）
- [x] API クライアント（FastAPIとの通信）

### 1.4 開発環境・インフラ

- [x] monorepo構成整理（backend / frontend / simulator）
- [x] Docker Compose（FastAPI + シミュレーター + フロントエンド）
- [ ] LM Studio 導入・Qwen2.5:14B ダウンロード・動作確認
- [x] CI/CD 基盤（GitHub Actions: lint + test + integration）

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
- [ ] LINE Notify 連携（任意）

---

## Phase 3 ― 安定稼働後（拡張）

### 3.1 ハードウェア拡張

- [ ] BooKoo Themis スケール導入・重量制御連携

### 3.2 分析・UI強化

- [ ] 長期ログ分析ダッシュボード
- [ ] 圧力カーブ比較グラフ（複数ショット重ね表示）
- [ ] 豆別・レシピ別パフォーマンストレンド

### 3.3 LLMレシピ機能

- [ ] LLM によるレシピ自動生成 UI
- [ ] レシピカスタマイズ対話 UI
- [ ] コミュニティレシピ取り込み・微調整

### 3.4 マルチプラットフォーム

- [ ] React Native スマホアプリ化（iOS / Android）
- [ ] クラウド DB 移行（PostgreSQL or Firebase）
- [ ] マルチデバイス同期

---

## 優先度ガイド

| 優先度 | タスク群 | 理由 |
|---|---|---|
| **最優先** | シミュレーター + SQLiteスキーマ + FastAPI雛形 | 実機なしで開発・テスト可能にする |
| **高** | React全画面モック + グラフ | UI/UXを先に固める |
| **高** | LLM連携モジュール | プロンプト設計は実機不要で検証可能 |
| **中** | 数値分析モジュール | シミュレーターデータで検証 |
| **低（Phase 2）** | 実機接続・通知 | 機体到着後 |
| **低（Phase 3）** | スマホアプリ・クラウド | 安定稼働後 |
