# GaggiMate Integration App

Gaggia Classic E24 + GaggiMate Pro + ローカルLLM連携アプリ

ショットログの永続化、豆・グラインド情報の管理、ローカルLLMによる改善提案・レシピ最適化を実現するフルスタックアプリケーション。

## システム構成

```
Gaggia Classic E24
  └── GaggiMate Pro (ESP32)
        ├── WebSocket API → リアルタイムデータ
        └── Webhook → ショット完了通知

Windows PC
  ├── FastAPI バックエンド
  │   ├── WebSocket接続・データ受信
  │   ├── Webhook受信・ショット保存
  │   ├── 数値分析（収率・圧力・時間）
  │   ├── SQLiteにショットログ保存
  │   └── LM StudioにHTTP API問い合わせ
  ├── React フロントエンド
  │   ├── ホーム（温度・圧力・スタート）
  │   ├── 抽出中（リアルタイムグラフ）
  │   ├── 抽出後（フィードバック + LLM提案）
  │   ├── レシピ管理
  │   └── ショットログ
  └── LM Studio (ローカルLLM)
        └── Qwen2.5:14B 推奨
```

## クイックスタート

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

### テスト実行

```bash
python tests/test_integration.py
```

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript + Recharts |
| バックエンド | Python / FastAPI |
| リアルタイム通信 | WebSocket |
| ローカルLLM | LM Studio + Qwen2.5:14B (OpenAI互換API) |
| データベース | SQLite |
| 通知 | Web Push API |
| CI/CD | GitHub Actions |

## API エンドポイント

| カテゴリ | エンドポイント |
|---|---|
| ショット | `GET/POST /api/shots`, `POST /api/shots/{id}/feedback`, `GET /api/shots/{id}/timeseries` |
| 豆 | `GET/POST/PUT/DELETE /api/beans` |
| レシピ | `GET/POST /api/recipes`, `PATCH /api/recipes/{id}/favorite`, `POST /api/recipes/customize` |
| マシン | `GET /api/machine/status`, `POST /api/machine/brew/start`, `POST /api/machine/brew/stop` |
| LLM | `GET /api/llm/test`, `POST /api/llm/suggest`, `GET /api/llm/suggestions/{id}` |
| プロンプト | `GET/PUT /api/prompts/{name}` |
| 通知 | `GET /api/notifications/vapid-key`, `POST /api/notifications/subscribe` |

## プロジェクト構成

```
gaggimate-apps/
├── backend/          # FastAPI バックエンド
│   ├── app/
│   │   ├── main.py           # エントリーポイント
│   │   ├── database.py       # SQLite スキーマ
│   │   ├── config.py         # 設定（環境変数対応）
│   │   ├── routers/          # REST API ルーター
│   │   ├── services/         # ビジネスロジック
│   │   └── prompts/          # LLMプロンプトテンプレート
│   └── pyproject.toml
├── frontend/         # React フロントエンド
│   └── src/
│       ├── pages/            # 各画面
│       ├── api.ts            # APIクライアント
│       └── App.tsx           # ルーティング
├── simulator/        # GaggiMateダミーシミュレーター
├── tests/            # 結合テスト
├── docs/             # 仕様書・ロードマップ
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## ドキュメント

- [開発仕様書](docs/SPEC.md)
- [ロードマップ](docs/ROADMAP.md)
- [LLMプロンプト設計書](docs/PROMPT_DESIGN.md)

## ライセンス

MIT
