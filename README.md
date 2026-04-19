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

## 使い方ガイド

### 基本的な抽出フロー

```
1. ホーム画面でレシピを選択
2. 「スタート」ボタンで抽出開始
3. 抽出中画面でリアルタイムグラフを確認
4. 抽出完了 → 自動でフィードバック画面へ
5. 豆・グラインド・感想・スコアを入力して「保存 & LLM分析」
6. AIが次のショットの改善提案を表示
```

**手動操作はスタートボタンとフィードバック入力の2回だけ。** 抽出データの取得・保存・分析は全て自動です。

### 画面ごとの使い方

#### ホーム (`/`)
- マシンの温度・圧力・状態をリアルタイム表示
- ドロップダウンからレシピを選択
- 「スタート」で抽出開始 → 自動で抽出中画面へ遷移

#### 抽出中 (`/brewing`)
- 圧力/フロー・重量/温度の2分割リアルタイムグラフ
- 目標重量を設定したレシピでは進捗バーを表示
- 「抽出停止」ボタンで手動停止も可能
- 抽出完了すると自動でフィードバック画面へ

#### 抽出結果 (`/shot/:id`)
- 抽出時間・収量・収率のサマリー
- 圧力/フロー、重量/温度の2段グラフ
- フィードバック入力フォーム:
  - 豆の種類（既存豆から選択 or 新規入力で自動登録）
  - ドーズ量 / 抽出量 / コマンダンテ クリック数
  - 5段階スコア（★★★★★）
  - 感想（自由記述: 「酸っぱかった」「甘みが出た」など）
- 「保存 & LLM分析」ボタンで:
  1. フィードバックをDBに保存
  2. Python数値分析（収率・圧力・時間の異常検知）
  3. ローカルLLMが改善提案を生成（3つ以内）

#### レシピ (`/recipes`)
- **一覧**: ソート（評価順/使用頻度順/作成日順）、★でお気に入り
- **タブ切替**: すべて / オリジナル / コミュニティ / アーカイブ
- **ビジュアルエディタ**: レシピをクリックで展開
  - 温度スライダー（85〜100°C）
  - フェーズごとの圧力/時間/フロー設定
  - ドーズ量・目標抽出量の設定
  - 圧力プロファイルのプレビューバー
- **削除**: ショット履歴がある場合は警告 → アーカイブ推奨
- **LLMカスタマイズ**: テキストで要望を入力（例:「甘みをもっと出したい」）

#### AIレシピ (`/recipe-ai`)
3つのタブ:
- **生成**: 「エチオピア浅煎り用のフルーティーなレシピ」→ AIがプロファイルJSON生成
- **チャット**: AIと対話しながらレシピを調整（マルチターン対話）
- **インポート**: DiscordコミュニティのレシピJSONを貼り付けて取り込み

#### ログ (`/log`)
- ショット一覧テーブル（日時・豆・レシピ・時間・収量・スコア）
- 豆別・レシピ別フィルター
- 行クリックでショット詳細画面へ
- チェックボックスで2-3件選択 → 比較画面へ

#### 分析 (`/dashboard`)
- 総ショット数・平均スコア・お気に入り豆・最も使うレシピ
- スコア推移の折れ線グラフ

#### 比較 (`/compare`)
- 2-3件のショットを選んで圧力カーブを重ね表示
- 色分けされたグラフ + ショット詳細テーブル

#### トレンド (`/trends`)
- 豆別 or レシピ別にパフォーマンスを集計
- 棒グラフ（平均スコア）+ テーブル（抽出時間・ショット数）

#### スマホ連携 (`/mobile`)
- QRコードを表示 → スマホで読み取ってLAN接続
- 同じWiFi内ならスマホのブラウザからアクセス可能

#### 設定 (`/settings`)
- **接続状態**: バックエンド・GaggiMate・LM Studioの接続状態
- **GaggiMate設定**: ホスト・WebSocketポート
- **LM Studio設定**: API URL・モデル名・接続テストボタン
- **デフォルトドーズ**: 16g / 18g / 25g のワンタッチ設定
- **通知設定**: Web Push ON/OFF、LINE Notify トークン設定
- **設定保存**: 全設定が `config.json` に永続化

### LLMの改善提案について

LLMは以下の情報を総合して改善提案を生成します:

| 入力 | 担当 | 例 |
|---|---|---|
| 圧力・温度・時間の計算 | Python（自動） | 収率2.0x、ピーク9.1bar |
| 異常検知 | Python（自動） | 「抽出時間が目標より11秒短い」 |
| 味の感想 | ユーザー入力 | 「酸っぱかった」 |
| グラインド設定 | ユーザー入力 | クリック数22 |
| 過去ショット比較 | Python（自動） | 同じ豆の前回成功ショット |
| **改善提案の生成** | **ローカルLLM** | **「グラインドを1クリック細かく（21）」** |

**良い提案を得るコツ:**
- 具体的な感想を書く（「まあまあ」より「酸味が強く、ボディが薄い」）
- グラインド情報を入力する（クリック数があると具体的な調整値を提案）
- 豆情報を登録する（同じ豆の過去データが比較に使われる）

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

## 設定・環境変数

### config.json（バックエンド設定）

`backend/config.json` で設定を管理。設定画面から変更可能。

```json
{
  "gaggimate_host": "localhost",
  "gaggimate_ws_port": 8765,
  "lm_studio_base_url": "http://localhost:1234/v1",
  "lm_studio_model": "local-model",
  "mqtt_broker": "localhost",
  "mqtt_port": 1883,
  "mqtt_enabled": false,
  "line_notify_token": null,
  "db_path": "data/gaggimate.db"
}
```

| 設定項目 | デフォルト値 | 説明 |
|---|---|---|
| `gaggimate_host` | `localhost` | GaggiMate ProのIPまたはホスト名 |
| `gaggimate_ws_port` | `8765` | WebSocketポート |
| `lm_studio_base_url` | `http://localhost:1234/v1` | LM StudioのAPI URL |
| `lm_studio_model` | `local-model` | 使用するLLMモデル名 |
| `mqtt_enabled` | `false` | MQTT購読を有効にするか |
| `mqtt_broker` | `localhost` | MQTTブローカーのホスト |
| `line_notify_token` | `null` | LINE Notify のアクセストークン |
| `db_path` | `data/gaggimate.db` | SQLiteデータベースのパス |

### 環境変数オーバーライド（Docker対応）

Docker環境では環境変数で `config.json` の値をオーバーライドできます:

```bash
GAGGIMATE_HOST=gaggimate.local
GAGGIMATE_WS_PORT=8765
LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1
LM_STUDIO_MODEL=local-model
MQTT_ENABLED=true
DB_PATH=/app/data/gaggimate.db
```

### GaggiMate実機への接続

シミュレーターから実機に切り替える場合:

1. 設定画面で「GaggiMate ホスト」を実機のIP（例: `192.168.1.100`）に変更
2. または `config.json` の `gaggimate_host` を変更
3. Webhook URL は GaggiMate Pro の設定で `http://<PCのIP>:8000/webhook` に設定

### LM Studio の設定

1. [LM Studio](https://lmstudio.ai/) をダウンロード・インストール
2. モデルをダウンロード（推奨: gemma-4-e4b または Qwen2.5:14B）
3. 「Local Server」タブ → 「Start Server」をクリック
4. デフォルトで `http://localhost:1234` で起動
5. アプリの設定画面で「LM Studio 接続テスト」ボタンで確認

**GPU推奨スペック:**
| モデル | VRAM | 速度 |
|---|---|---|
| gemma-4-e4b | 8GB+ | 快適 |
| Qwen2.5:14B | 12GB+ | 快適（RTX 4080推奨） |
| Qwen2.5:7B | 6GB+ | 軽量 |

### LINE Notify の設定

1. [LINE Notify](https://notify-bot.line.me/) でトークンを取得
2. 設定画面の「LINE Notify トークン」に入力
3. 「テスト送信」ボタンで動作確認
4. 「設定を保存」で永続化

## ドキュメント

- [開発仕様書](docs/SPEC.md)
- [ロードマップ](docs/ROADMAP.md)
- [LLMプロンプト設計書](docs/PROMPT_DESIGN.md)

## ライセンス

MIT
