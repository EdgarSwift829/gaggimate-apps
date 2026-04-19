# GaggiMate Integration App

Gaggia Classic E24 + GaggiMate Pro + ローカルLLM連携アプリ

ショットログの永続化、豆・グラインド情報の管理、ローカルLLMによる改善提案・レシピ最適化を実現するフルスタックアプリケーション。

## システム構成

```
Gaggia Classic E24
  └── GaggiMate Pro (ESP32)
        ├── WebSocket API → リアルタイムデータ
        ├── MQTT → センサーデータストリーム
        └── Webhook → ショット完了通知

Windows PC
  ├── FastAPI バックエンド
  │   ├── WebSocket接続・データ受信
  │   ├── MQTT購読・バッファリング
  │   ├── Webhook受信・ショット自動保存
  │   ├── 数値分析（収率・圧力・温度・異常検知）
  │   ├── SQLiteにショットログ永続保存
  │   ├── LM StudioにHTTP API問い合わせ
  │   ├── Web Push / LINE Notify 通知
  │   └── QRコードでスマホLAN接続
  ├── React フロントエンド
  │   ├── ホーム（温度・圧力・スタート）
  │   ├── 抽出中（リアルタイムグラフ2分割・目標重量プログレスバー）
  │   ├── 抽出後（フィードバック + LLM提案3状態表示）
  │   ├── レシピ管理（ビジュアルエディタ・アーカイブ・タブ切替）
  │   ├── AIレシピ（生成・対話・コミュニティインポート）
  │   ├── 分析ダッシュボード + 圧力カーブ比較 + トレンド
  │   ├── ショットログ（フィルター・比較選択）
  │   └── 設定（接続・LM Studio・通知・永続化）
  └── LM Studio (ローカルLLM)
        └── gemma-4-e4b / Qwen2.5:14B
```

## 機能一覧

### 抽出管理
- リアルタイム圧力・温度・重量・フローグラフ（2分割デュアルY軸）
- レシピ選択 → ワンタッチ抽出開始
- 目標重量プログレスバー（BooKoo Themisスケール対応）
- ショット完了時にWebhookで自動ログ保存
- 抽出完了後に自動でShotResult画面へ遷移
- Web Push / LINE Notify 通知

### フィードバック & LLM分析
- 抽出後に豆・グラインド・感想・スコアを入力
- Python数値分析（収率・圧力・時間の異常検知）
- ローカルLLMが具体的な改善アクションを3つ提案
- 過去ショットとの比較分析
- LLM提案の3状態表示（分析中 / 提案表示 / エラー）

### レシピ管理
- ビジュアルエディタ（圧力/時間/フロー/温度スライダー・タッチ対応）
- お気に入り・ソート（評価順/使用頻度順/作成日順）
- タブ切替UI（すべて / オリジナル / コミュニティ / アーカイブ）
- アーカイブ機能（ショット履歴を保持したまま非表示化）
- 削除の安全化（shots参照チェック + 警告モーダル）
- 希望グラムでのレシピ変換（dose_g/yield_g → 抽出比率自動計算）

### AIレシピ
- LLMによるレシピ自動生成（豆・フレーバー指定）
- AIとの対話型レシピカスタマイズ（マルチターン）
- コミュニティレシピJSON取り込み + プレビュー

### 分析 & トレンド
- ダッシュボード（総ショット数・平均スコア・スコア推移）
- 複数ショットの圧力カーブ重ね表示
- 豆別・レシピ別パフォーマンストレンド

### 設定 & 接続
- GaggiMate / LM Studio 接続テスト
- 設定永続化（config.json 読み書き）
- QRコードでスマホからLAN接続
- Push通知ON/OFFトグル

## クイックスタート

### Windows バッチ起動

```bash
# 全サービス一括起動
start.bat

# 全サービス一括停止
stop.bat
```

### 手動起動

```bash
# 1. シミュレーター起動
cd simulator
pip install -r requirements.txt
python gaggimate_sim.py --ws-port 8765 --webhook-url http://localhost:8000/webhook

# 2. バックエンド起動（別ターミナル）
cd backend
pip install -e ".[dev]"
python -m uvicorn app.main:app --port 8000

# 3. フロントエンド起動（別ターミナル）
cd frontend
npm install
npm run dev

# 4. ブラウザで http://localhost:5173 を開く
```

### Docker Compose

```bash
docker compose up --build
# http://localhost:5173 でアクセス
```

### LM Studio（ローカルLLM）

1. [LM Studio](https://lmstudio.ai/) をインストール
2. gemma-4-e4b または Qwen2.5:14B モデルをダウンロード
3. Local Server をオンにする（デフォルト: localhost:1234）
4. 設定画面で「LM Studio 接続テスト」ボタンで確認

### テスト実行

```bash
# 結合テスト（シミュレーター + バックエンド起動状態で）
python tests/test_integration.py

# E2Eテスト（Playwright）
cd frontend && npx playwright test
```

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript + Recharts |
| バックエンド | Python / FastAPI |
| リアルタイム通信 | WebSocket + MQTT |
| ローカルLLM | LM Studio (OpenAI互換API) |
| データベース | SQLite + Alembic |
| 通知 | Web Push API + LINE Notify |
| CI/CD | GitHub Actions |
| コンテナ | Docker Compose |
| E2Eテスト | Playwright |

## API エンドポイント

| カテゴリ | エンドポイント |
|---|---|
| ショット | `GET/POST /api/shots`, `POST /api/shots/{id}/feedback`, `GET /api/shots/{id}/timeseries` |
| 豆 | `GET/POST/PUT/DELETE /api/beans` |
| レシピ | `GET/POST/PUT/DELETE /api/recipes`, `PATCH /api/recipes/{id}/favorite`, `PATCH /api/recipes/{id}/archive` |
| レシピカスタマイズ | `POST /api/recipes/customize` |
| AIレシピ | `POST /api/recipes/ai/generate`, `POST /api/recipes/ai/chat`, `POST /api/recipes/import` |
| マシン | `GET /api/machine/status`, `POST /api/machine/brew/start`, `POST /api/machine/brew/stop` |
| 分析 | `GET /api/analytics/dashboard`, `GET /api/analytics/compare`, `GET /api/analytics/trends` |
| LLM | `GET /api/llm/test`, `POST /api/llm/suggest`, `GET /api/llm/suggestions/{id}` |
| プロンプト | `GET /api/prompts`, `GET/PUT /api/prompts/{name}` |
| 通知 | `GET /api/notifications/vapid-key`, `POST /api/notifications/subscribe`, `POST /api/notifications/line-test` |
| 設定 | `GET/PUT /api/settings` |
| QRコード | `GET /api/qr` |
| ヘルス | `GET /api/health` |

## 画面一覧

| 画面 | パス | 説明 |
|---|---|---|
| ホーム | `/` | マシン状態・レシピ選択・抽出開始 |
| 抽出中 | `/brewing` | リアルタイムグラフ2分割・目標重量バー・ストップ |
| 抽出結果 | `/shot/:id` | サマリー・フィードバック入力・LLM提案 |
| レシピ | `/recipes` | ビジュアルエディタ・お気に入り・タブ切替・アーカイブ |
| AIレシピ | `/recipe-ai` | AI生成・対話カスタマイズ・コミュニティインポート |
| ログ | `/log` | ショット一覧・フィルター・比較選択 |
| 分析 | `/dashboard` | ダッシュボード・スコア推移 |
| 比較 | `/compare` | 圧力カーブ重ね表示 |
| トレンド | `/trends` | 豆別・レシピ別パフォーマンス |
| スマホ連携 | `/mobile` | QRコード表示 |
| 設定 | `/settings` | 接続設定・LM Studio・通知・設定永続化 |

## プロジェクト構成

```
gaggimate-apps/
├── backend/              # FastAPI バックエンド
│   ├── app/
│   │   ├── main.py               # エントリーポイント + WS/MQTT中継
│   │   ├── database.py           # SQLiteスキーマ（8テーブル）
│   │   ├── config.py             # 設定（環境変数 + config.json永続化）
│   │   ├── routers/
│   │   │   ├── shots.py          # ショットCRUD + フィードバック
│   │   │   ├── beans.py          # 豆マスターCRUD
│   │   │   ├── recipes.py        # レシピCRUD + お気に入り + アーカイブ
│   │   │   ├── recipe_ai.py      # AI生成・対話・インポート
│   │   │   ├── analytics.py      # ダッシュボード・比較・トレンド
│   │   │   ├── machine.py        # マシン制御
│   │   │   ├── webhook.py        # Webhook受信
│   │   │   ├── llm_api.py        # LLM接続テスト・提案
│   │   │   ├── notifications.py  # Web Push + LINE Notify
│   │   │   ├── prompts.py        # プロンプトテンプレート管理
│   │   │   ├── settings.py       # 設定永続化API
│   │   │   └── qr.py             # QRコード生成
│   │   ├── services/
│   │   │   ├── gaggimate_ws.py   # GaggiMate WebSocketクライアント
│   │   │   ├── mqtt_client.py    # MQTT購読クライアント
│   │   │   ├── llm.py            # LM Studio連携
│   │   │   ├── analysis.py       # 数値分析・異常検知
│   │   │   ├── notification.py   # Web Push送信
│   │   │   ├── line_notify.py    # LINE Notify送信
│   │   │   └── prompt_manager.py # テンプレート管理
│   │   └── prompts/              # LLMプロンプトテンプレート（英語化済み）
│   ├── alembic/                  # DBマイグレーション
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/             # React フロントエンド
│   ├── src/
│   │   ├── pages/                # 11画面
│   │   ├── api.ts                # APIクライアント + 型定義
│   │   └── App.tsx               # ルーティング
│   ├── public/sw.js              # Service Worker（Push通知）
│   ├── e2e/                      # Playwright E2Eテスト
│   └── Dockerfile
├── simulator/            # GaggiMateダミーシミュレーター
│   ├── gaggimate_sim.py          # WebSocket + Webhook送信
│   ├── test_client.py            # テストクライアント
│   └── Dockerfile
├── tests/
│   └── test_integration.py       # 結合テスト
├── docs/
│   ├── SPEC.md                   # 開発仕様書 v2.0
│   ├── ROADMAP.md                # ロードマップ
│   └── PROMPT_DESIGN.md          # LLMプロンプト設計書
├── start.bat / stop.bat          # Windows一括起動・停止
├── docker-compose.yml
├── .github/workflows/ci.yml
└── .env.example
```

## ドキュメント

- [開発仕様書](docs/SPEC.md)
- [ロードマップ](docs/ROADMAP.md)
- [LLMプロンプト設計書](docs/PROMPT_DESIGN.md)

## ライセンス

MIT
