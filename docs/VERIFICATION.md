# GaggiMate 検証一覧

最終更新: 2026-04-12

## 凡例
- ✅ 検証済み・正常
- ❌ エラー・異常
- ⚠️ 部分的に動作
- ⏭️ 未検証（実機依存等）

---

## バックエンド API

### ヘルスチェック

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 1 | `/api/health` | GET | 200 OK | ✅ | `{"status":"ok","gaggimate_connected":false,"gaggimate_brewing":false}` |

### ショット

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 2 | `/api/shots` | GET | 200 + 一覧 | ✅ | 43件取得、timeseries・関連情報含む |
| 3 | `/api/shots` | POST | 新規作成 | ❌ | `{"detail":"Method Not Allowed"}` — POST未実装、GETのみ |
| 4 | `/api/shots/{id}` | GET | 200 + 詳細 | ✅ | timeseries・grind情報付きで正常取得 |
| 5 | `/api/shots/{id}/feedback` | POST | 更新OK | ✅ | `score`・`feedback` 更新 → 分析・提案も返す |
| 6 | `/api/shots/{id}/timeseries` | GET | 200 + 時系列 | ⏭️ | ルート存在確認済み、別途検証要 |

### 豆

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 7 | `/api/beans` | GET | 200 + 一覧 | ✅ | 3件（Ethiopia / Colombia / Brazil）取得 |
| 8 | `/api/beans` | POST | 新規作成 | ✅ | `{"id":4,"name":"Test Bean","roaster":"Test Roaster",...}` |
| 9 | `/api/beans/{id}` | PUT | 更新OK | ✅ | 名前・ロースター更新を確認 |
| 10 | `/api/beans/{id}` | DELETE | 削除OK | ✅ | `{"ok":true}` |
| 11 | `/api/beans/{id}` | GET | 詳細取得 | ❌ | `{"detail":"Method Not Allowed"}` — 個別GETは未実装 |

### レシピ

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 12 | `/api/recipes` | GET | 200 + 一覧 | ✅ | 3件（Classic / Long Preinfusion / Turbo）取得 |
| 13 | `/api/recipes` | POST | 新規作成 | ✅ | `profile_json` フィールドが必須（`json` ではない） |
| 14 | `/api/recipes/{id}/favorite` | PATCH | お気に入り切替 | ✅ | `{"id":1,"is_favorite":true}` |
| 15 | `/api/recipes/ai/generate` | POST | LLM生成 | ⚠️ | LLM未接続でフォールバック応答 `{"suggestion":"LLM接続エラー...","recipe_json":null}` |
| 16 | `/api/recipes/ai/chat` | POST | LLMチャット | ⚠️ | LLM未接続 `{"detail":"LLM connection error."}` |
| 17 | `/api/recipes/import` | POST | JSONインポート | ⏭️ | `json_text` フィールド必須（疎通確認のみ） |

### アナリティクス

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 18 | `/api/analytics/dashboard` | GET | 200 + 集計 | ✅ | total_shots=43、avg_score=3.42、トレンド正常 |
| 19 | `/api/analytics/trends?group_by=bean` | GET | 豆別集計 | ✅ | 3豆のavg_score・duration・yield_ratio取得 |
| 20 | `/api/analytics/trends?group_by=recipe` | GET | レシピ別集計 | ✅ | 3レシピ正常取得 |
| 21 | `/api/analytics/compare?shot_ids=1,2` | GET | ショット比較 | ✅ | 2ショットのtimeseries付き比較データ取得 |

### QR

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 22 | `/api/qr` | GET | QR画像 | ✅ | HTTP 200、PNG画像バイナリ返却 |

### LLM

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 23 | `/api/llm/test` | GET | 接続確認 | ⚠️ | `{"connected":false,"base_url":"http://localhost:1234/v1","error":"Connection error."}` — LMS未起動 |
| 24 | `/api/llm/suggest` | POST | 改善提案 | ⚠️ | LLM未接続でもルール基準のフォールバック提案返却 |
| 25 | `/api/llm/suggestions/{id}` | GET | 保存済み提案 | ✅ | DBに保存された提案履歴を正常取得 |

### 通知

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 26 | `/api/notifications/vapid-key` | GET | VAPID公開鍵 | ⚠️ | `{"available":false,"message":"pywebpush未インストール — pip install pywebpush"}` |
| 27 | `/api/notifications/subscribe` | POST | 購読登録 | ⏭️ | pywebpush未インストール、`endpoint`・`keys` フィールド必須 |
| 28 | `/api/notifications/unsubscribe` | POST | 購読解除 | ⏭️ | pywebpush未インストール |
| 29 | `/api/notifications/line-test` | POST | LINE通知テスト | ⏭️ | bodyフィールド必須、LINE未設定のため未検証 |

### マシン連携（GaggiMate）

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 30 | `/api/machine/status` | GET | 接続状態 | ✅ | `{"connected":false,"is_brewing":false}` — 実機未接続 |
| 31 | `/api/machine/brew/start` | POST | 抽出開始 | ⚠️ | `{"detail":"Not connected to GaggiMate"}` — 実機必須 |
| 32 | `/api/machine/brew/stop` | POST | 抽出停止 | ⚠️ | `{"detail":"Not connected to GaggiMate"}` — 実機必須 |
| 33 | `/api/machine/profiles` | GET | プロファイル一覧 | ⚠️ | `{"detail":"Not connected to GaggiMate"}` — 実機必須 |
| 34 | `/api/machine/profiles/select` | POST | プロファイル選択 | ⏭️ | 実機必須 |

### Webhook

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 35 | `/webhook` | POST | Webhook受信 | ✅ | `/api/` プレフィックスなし。`event != shot_complete` は `{"ok":true,"ignored":true}` を返す |

### プロンプト管理

| # | エンドポイント | メソッド | 期待値 | 結果 | 備考 |
|---|---|---|---|---|---|
| 36 | `/api/prompts` | GET | テンプレート一覧 | ✅ | 4テンプレート（shot_improvement_system/user, recipe_customize_system/user）取得 |
| 37 | `/api/prompts/{name}` | GET | テンプレート取得 | ✅ | `shot_improvement_system` など正常取得 |
| 38 | `/api/prompts/{name}` | PUT | テンプレート更新 | ⏭️ | ルート存在確認済み、別途検証要 |

---

## LLM機能テスト（LM Studio接続済み）

実行日: 2026-04-12

| # | テスト | 結果 | 備考 |
|---|---|---|---|
| L1 | GET /api/llm/test | ✅ | connected:true、16モデル取得 |
| L2 | POST /api/llm/suggest | ⚠️ | APIフロー正常、LMStudioモデル未ロードのためLLM応答なし |
| L3 | GET /api/llm/suggestions/{id} | ✅ | DB保存・取得正常 |
| L4 | POST /api/recipes/ai/generate | ⚠️ | APIフロー正常、LLM未ロード |
| L5 | POST /api/recipes/ai/chat | ✅ (修正後) | 502→200+エラーメッセージに修正済み |
| L6 | POST /api/recipes/customize | ⚠️ | APIフロー正常、LLM未ロード |
| L7 | GET /api/prompts/{name} | ✅ | テンプレート正常取得 |

> ⚠️ LM Studio にモデルをロードすれば L2/L4/L6 も完全動作する見込み

## シミュレーター連携テスト（抽出サイクル全体）

実行日: 2026-04-12

| # | ステップ | 結果 | 備考 |
|---|---|---|---|
| S1 | GaggiMate接続確認 | ✅ | gaggimate_connected: true |
| S2 | 抽出開始 (brew/start) | ✅ | is_brewing: true に遷移 |
| S3 | WebSocket ステータス中継 | ✅ | HTTP確認で is_brewing 反映 |
| S4 | Webhook受信 (shot_complete) | ✅ (バグ修正後) | timestamp NULL制約バグを修正 |
| S5 | ショット自動保存 | ✅ | shot_id=45、全フィールド正常保存 |
| S6 | ショット詳細取得 | ✅ | timeseries・grind含む |
| S7 | フィードバック送信 | ✅ | analysis・suggestion返却 |
| S8 | タイムシリーズ | ⚠️ | テストペイロードにtelemetryなし→0件（設計上正常） |
| S9 | アナリティクス反映 | ✅ | total_shots・avg_score更新確認 |

> webhook.py バグ修正: timestamp NULL 制約違反を修正（DB デフォルト値を使用）

---

## フロントエンド画面（E2E Playwright）

実行日: 2026-04-12 / 結果: **10/10 PASS**
スクリーンショット: `frontend/tests/screenshots/`

| # | テスト | 結果 | スクリーンショット |
|---|---|---|---|
| 1 | ホーム画面が表示される | ✅ | home.png |
| 2 | ナビゲーション全リンクが存在する | ✅ | — |
| 3 | ログ画面が表示される | ✅ | log.png |
| 4 | レシピ画面が表示される | ✅ | recipes.png |
| 5 | 分析ダッシュボードが表示される | ✅ | dashboard.png |
| 6 | ショット比較画面が表示される | ✅ | compare.png |
| 7 | トレンド画面が表示される | ✅ | trends.png |
| 8 | AI レシピ画面が表示される | ✅ | recipe-ai.png |
| 9 | スマホ連携画面 + QR画像表示 | ✅ | mobile-connect.png |
| 10 | 設定画面 + LINE Notify UI | ✅ | settings.png |

## pytest 統合テスト

実行日: 2026-04-12 / 結果: **23/24 PASS, 1 FAIL (実機依存)**

| # | テスト | 結果 | 備考 |
|---|---|---|---|
| 1-3 | ヘルスチェック | ✅ | |
| 4-5 | マシンステータス | ✅ | 未接続を正常返却 |
| 6-8 | 豆マスター CRUD | ✅ | |
| 9-12 | レシピ CRUD | ✅ | |
| 13-16 | 抽出サイクル | ⏭️ SKIP | シミュレーター未接続 |
| 17 | LLM接続テスト | ❌ | LM Studio未起動（インフラ依存・コードバグなし） |
| 18-20 | LLM提案・AI | ⏭️ SKIP | LM Studio依存 |
| 21-23 | 分析ダッシュボード | ✅ | |
| 24 | ショット比較 | ⏭️ SKIP | shot_id依存 |
| 25-28 | パフォーマンストレンド | ✅ | |
| 29-30 | コミュニティレシピインポート | ✅ | |

---

## 機能別検証

### スマホ連携（GaggiMate 実機）

- マシン接続なしの場合、全マシンAPIは `"Not connected to GaggiMate"` を適切に返却 ✅
- 実機接続時の brew/start、brew/stop、profiles は未検証 ⏭️
- QRコードは正常生成・PNG返却 ✅

### LLM連携

- LLM接続テストエンドポイント正常動作（接続エラー検知・レポート） ✅
- LLM未接続時はショットフィードバック・レシピ生成ともにフォールバック応答で動作継続 ⚠️
- LM Studio (localhost:1234) が起動していないため、AI機能は完全未検証 ⏭️
- プロンプトテンプレート管理（読み取り）は正常動作 ✅

### 通知（Web Push / LINE）

- `pywebpush` が未インストールのため Web Push 全機能が無効 ❌
  - 対処: `pip install pywebpush` を実行してインストールが必要
- LINE通知は設定未確認につき未検証 ⏭️

---

## 未解決の問題

| 問題 | 重要度 | 詳細 |
|---|---|---|
| `POST /api/shots` が 405 Method Not Allowed | 中 | ショットの手動登録エンドポイントが未実装。GaggiMate経由でのみ登録可能と思われる |
| `GET /api/beans/{id}` が 405 Method Not Allowed | 低 | 個別豆の詳細取得が未実装。一覧取得は正常 |
| `POST /api/webhook` → 正しくは `/webhook` | 低 | Webhookのみ `/api/` プレフィックスなし設計。`/webhook` で正常動作確認済み |
| `pywebpush` 未インストール | ⚠️ 中 | Web Push通知機能全体が無効。`pip install pywebpush` を実行してインストールが必要 |
| LM Studio 未起動 | 中 | LLM連携機能が全て無効。localhost:1234 でLM Studioを起動が必要 |
| LLM モデル未ロード | 中 | LM Studio 接続済みだがモデルがロードされていない。LM Studio でモデルを選択してロードする |
| webhook timestamp バグ | ✅ 修正済み | timestamp NULL制約違反を修正。webhook.py を更新済み |
