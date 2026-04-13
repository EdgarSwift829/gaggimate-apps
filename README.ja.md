# GaggiMate 連携アプリ

Gaggia Classic E24 + GaggiMate Pro + ローカルLLM を繋ぐフルスタックアプリ。

ショットログの自動保存・豆/レシピ管理・ローカルLLMによる抽出改善提案を、一台の Windows PC 上で完結させる。

---

## 主な機能

| 機能 | 内容 |
|---|---|
| **リアルタイムグラフ** | 抽出中の圧力/フロー/重量/温度を2分割グラフで表示 |
| **ショット自動保存** | Webhook受信 → SQLiteに時系列データごと自動保存 |
| **フィードバック + LLM提案** | スコア・感想を入力するとローカルLLMが改善提案を生成 |
| **レシピ管理** | ビジュアルエディタ（スライダーUI）で圧力・温度・時間を直感的に編集 |
| **重量制御** | dose_g/yield_g 入力で抽出比率を自動計算、stop_on_weight を GaggiMate に設定 |
| **目標重量プログレスバー** | 抽出中に現在重量/目標重量の達成率をリアルタイム表示 |
| **レシピAI生成** | 自然言語でレシピをリクエスト → GaggiMate プロファイル JSON を自動生成 |
| **レシピチャット** | LLMとの対話でレシピを段階的にカスタマイズ |
| **コミュニティレシピ取込** | Discord共有JSONを貼り付けてインポート・プレビュー付き |
| **コミュニティレシピLLM変換** | インポート後にそのままLLMチャットへ遷移、自分向けにカスタマイズ |
| **ドーズクイック選択** | レシピエディタで16g/18g/25gをワンタップ選択。設定画面でデフォルト値を指定可 |
| **レシピアーカイブ** | 使わなくなったレシピをアーカイブ（shots履歴は保持） |
| **削除の安全化** | shots参照があるレシピは警告モーダル → アーカイブ推奨 |
| **ログフィルター** | 豆別・レシピ別フィルター + タブ切替（すべて/オリジナル/コミュニティ/アーカイブ） |
| **分析ダッシュボード** | 総ショット数・平均スコア・スコアトレンドグラフ |
| **ショット比較** | 複数ショットの圧力/温度カーブを重ねて比較 |
| **パフォーマンストレンド** | 豆別・レシピ別の平均スコア・抽出時間・収率 |
| **設定永続化** | GaggiMate接続先・LM Studio URL・LINE Notifyトークン・デフォルトドーズを UI から保存 |
| **スマホ対応** | LAN IP自動取得 + QRコード表示でスマホからアクセス |
| **LINE / Web Push通知** | 抽出完了・LLM提案完了を通知 |

---

## システム構成

```
Gaggia Classic E24
  └── GaggiMate Pro (ESP32)
        ├── WebSocket API → リアルタイム圧力・温度・重量データ
        ├── MQTT         → センサーデータストリーム
        └── Webhook      → ショット完了通知 (v1.6.0+)

Windows PC
  ├── FastAPI バックエンド (port 8000)
  │   ├── WebSocket接続・データ受信
  │   ├── Webhook受信・ショット自動保存
  │   ├── 数値分析（収率・圧力カーブ・異常検知）
  │   ├── SQLite ショットログ（Alembicマイグレーション）
  │   ├── LM Studio へ HTTP API 問い合わせ
  │   └── LINE Notify / Web Push 通知
  ├── React フロントエンド (port 5173)
  │   ├── ホーム（温度・圧力・レシピ選択・スタート）
  │   ├── 抽出中（リアルタイムグラフ・目標重量バー）
  │   ├── 抽出後（フィードバック入力 + LLM改善提案）
  │   ├── レシピ管理（ビジュアルエディタ・アーカイブ）
  │   ├── AI レシピ（生成・チャット・インポート）
  │   ├── ショットログ（フィルター・比較）
  │   ├── 分析（ダッシュボード・トレンド・比較）
  │   ├── スマホ連携（QRコード）
  │   └── 設定（接続先・LLM・通知）
  └── LM Studio (port 1234)
        └── google/gemma-4-e4b 使用中（Qwen2.5:14B も可）
```

---

## クイックスタート

### 起動（推奨）

```
start.bat をダブルクリック
```

シミュレーター・バックエンド・フロントエンドを一括起動。終了は `stop.bat`。

起動後に表示される URL：

```
[PC]
フロントエンド: http://localhost:5173
API Docs:      http://localhost:8000/docs

[スマホ / 同一WiFi内]
QRコードをスキャンしてアクセス
```

> ログは `logs/backend.log` / `logs/simulator.log` / `logs/frontend.log` に出力される。

---

### 手動起動

**ターミナル 1 — シミュレーター**
```bash
cd simulator
pip install -r requirements.txt
python gaggimate_sim.py --ws-port 8765 --webhook-url http://localhost:8000/webhook
```

**ターミナル 2 — バックエンド**
```bash
cd backend
pip install -e ".[dev]"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**ターミナル 3 — フロントエンド**
```bash
cd frontend
npm install
npm run dev
```

---

## 設定

### LM Studio 接続

1. LM Studio を起動 → Local Server をオン
2. モデルをロード（gemma-4-e4b / Qwen2.5:14B など）
3. アプリの「設定」画面から LM Studio URL とモデル名を入力して保存

または `backend/config.json` を直接編集：

```json
{
  "lm_studio_base_url": "http://localhost:1234/v1",
  "lm_studio_model": "google/gemma-4-e4b"
}
```

### GaggiMate 接続

「設定」画面から GaggiMate のホスト名/IPとポートを変更して保存。
実機到着前はシミュレーター（port 8765）で代替可能。

---

## テスト

```bash
# 統合テスト（バックエンド起動中に実行）
python tests/test_integration.py
# → 31/31 PASS

# E2E テスト（フロントエンド起動中に実行）
cd frontend
npx playwright test tests/e2e.spec.ts
# → 10/10 PASS
```

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript + Recharts |
| バックエンド | Python 3.11+ / FastAPI / aiosqlite |
| リアルタイム通信 | WebSocket + MQTT（aiomqtt） |
| ローカルLLM | LM Studio（OpenAI互換API）|
| データベース | SQLite + Alembicマイグレーション |
| 通知 | Web Push（pywebpush）/ LINE Notify |
| CI/CD | GitHub Actions |

---

## プロジェクト構成

```
gaggimate-apps/
├── start.bat             # 一括起動（Windows）
├── stop.bat              # 全サービス停止
├── show_qr.py            # LAN QRコード表示
├── docker-compose.yml    # Docker起動（オプション）
├── logs/                 # 実行ログ（gitignore済み）
├── backend/
│   ├── app/
│   │   ├── main.py           # エントリーポイント
│   │   ├── database.py       # SQLiteスキーマ・マイグレーション
│   │   ├── config.py         # 設定管理（config.json連動）
│   │   ├── routers/          # REST API
│   │   │   ├── shots.py      # ショットログ
│   │   │   ├── beans.py      # 豆マスター
│   │   │   ├── recipes.py    # レシピ管理
│   │   │   ├── recipe_ai.py  # LLM生成・チャット・インポート
│   │   │   ├── machine.py    # GaggiMate制御
│   │   │   ├── analytics.py  # 分析・トレンド
│   │   │   ├── settings.py   # 設定永続化
│   │   │   ├── llm_api.py    # LLM接続テスト・改善提案
│   │   │   ├── notifications.py # Web Push / LINE Notify
│   │   │   ├── prompts.py    # プロンプトテンプレート管理
│   │   │   ├── qr.py         # QRコード生成
│   │   │   └── webhook.py    # GaggiMate Webhook受信
│   │   ├── services/
│   │   │   ├── llm.py        # LLM呼び出し
│   │   │   ├── analysis.py   # ショット数値分析
│   │   │   ├── prompt_manager.py  # プロンプトテンプレート
│   │   │   ├── mqtt_client.py     # MQTT購読
│   │   │   └── line_notify.py     # LINE通知
│   │   └── prompts/          # LLMプロンプトテンプレート（英語）
│   ├── config.json           # 接続設定
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx          # ホーム・スタート
│       │   ├── Brewing.tsx       # 抽出中リアルタイム
│       │   ├── ShotResult.tsx    # 抽出後・フィードバック
│       │   ├── Log.tsx           # ショットログ
│       │   ├── Recipes.tsx       # レシピ管理（ビジュアルエディタ）
│       │   ├── RecipeAI.tsx      # AI生成・チャット・インポート
│       │   ├── Dashboard.tsx     # 分析ダッシュボード
│       │   ├── Compare.tsx       # ショット比較
│       │   ├── Trends.tsx        # パフォーマンストレンド
│       │   ├── Settings.tsx      # 設定
│       │   └── MobileConnect.tsx # スマホ連携・QR
│       ├── api.ts            # APIクライアント・型定義
│       └── App.tsx           # ルーティング
├── simulator/
│   └── gaggimate_sim.py      # GaggiMateダミーシミュレーター
├── tests/
│   └── test_integration.py   # 統合テスト（31テスト）
├── alembic/                  # DBマイグレーション
└── docs/
    ├── SPEC.md
    ├── ROADMAP.md
    ├── PROMPT_DESIGN.md
    └── VERIFICATION.md
```

---

## API エンドポイント

| カテゴリ | エンドポイント |
|---|---|
| ショット | `GET /api/shots` / `GET /api/shots/{id}` |
| フィードバック | `POST /api/shots/{id}/feedback` |
| 豆マスター | `GET/POST/PUT/DELETE /api/beans` |
| レシピ | `GET/POST/PUT/DELETE /api/recipes/{id}` |
| レシピ操作 | `PATCH /api/recipes/{id}/favorite` / `PATCH /api/recipes/{id}/archive` |
| レシピ使用確認 | `GET /api/recipes/{id}/usage` |
| AI レシピ | `POST /api/recipes/ai/generate` / `POST /api/recipes/ai/chat` |
| コミュニティ取込 | `POST /api/recipes/import` |
| マシン操作 | `GET /api/machine/status` / `POST /api/machine/brew/start` / `POST /api/machine/brew/stop` |
| LLM | `GET /api/llm/test` / `POST /api/llm/suggest` / `GET /api/llm/suggestions/{id}` |
| 分析 | `GET /api/analytics/dashboard` / `GET /api/analytics/trends` / `GET /api/analytics/compare` |
| 設定 | `GET/PUT /api/settings` |
| プロンプト | `GET/PUT /api/prompts/{name}` |
| 通知 | `GET /api/notifications/vapid-key` / `POST /api/notifications/subscribe` |
| QR | `GET /api/qr` |
| Webhook | `POST /webhook` |

---

## 前提条件

- **Python 3.11+**
- **Node.js 18+**
- **LM Studio**（ローカルLLMを使う場合）
  - 動作確認モデル: google/gemma-4-e4b（英語プロンプト最適化済み）
  - 推奨モデル: Qwen2.5:14B（RTX 4080で快適動作）
  - ポート: 1234（デフォルト）

---

## ドキュメント

- [開発仕様書](docs/SPEC.md)
- [ロードマップ](docs/ROADMAP.md)
- [LLMプロンプト設計書](docs/PROMPT_DESIGN.md)
- [検証一覧](docs/VERIFICATION.md)

---

## ライセンス

MIT
