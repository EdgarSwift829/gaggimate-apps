# GaggiMate 連携アプリ 開発仕様書 v2.0

**Gaggia Classic E24 + GaggiMate Pro + ローカルLLM連携**

---

## 1. 背景と目的

Gaggia Classic E24にGaggiMate Proを導入し、温度・圧力プロファイル制御を実現する。GaggiMate標準Web UIは操作・抽出の基本機能を持つが、以下の機能が不足している。自前アプリで補完し、長期的なショット品質の向上と再現性を実現することが目的。

| 不足機能 | 対応方法 | 備考 |
|---|---|---|
| ログの永続化 | Python + SQLite | FW更新で消失するバグあり（Issue #571） |
| 豆・グラインド情報の紐付け | 入力フォーム + DB | 数値に意味を持たせる |
| 改善提案・レシピ最適化 | ローカルLLM（LM Studio） | フィードバック後に実行 |
| レシピのお気に入り・ソート | SQLクエリ | LLM不要 |
| 抽出完了通知 | Web Push or LINE Notify | |

> ※ レシピ管理・作成・共有はGaggiMateのDiscordコミュニティとインポート機能で対応済み。自前実装不要。

---

## 2. システム構成

### 2-1. 全体アーキテクチャ

```
Gaggia Classic E24
  └── GaggiMate Pro（ESP32）
        ├── WebSocket API  → リアルタイムデータ・コマンド送信
        ├── MQTT           → センサーデータストリーム
        └── Webhook        → ショット終了イベント（v1.6.0〜）

Windows PC
  ├── Python / FastAPI（バックエンドサーバー）
  │   ├── WebSocket接続・データ受信
  │   ├── MQTT購読・バッファリング
  │   ├── Webhook受信・ショット境界検知
  │   ├── 数値分析（収率・圧力・時間）
  │   ├── SQLiteにショットログ保存
  │   └── LM StudioにHTTP APIで問い合わせ
  │
  └── LM Studio（ローカルLLMサーバー）
        ├── OpenAI互換API（localhost:1234）
        └── 推奨モデル：Qwen2.5:14B（RTX 4080で快適動作）

フロントエンド（React Web → 将来React Native）
  ├── ホーム：温度・圧力・状態表示 + スタートボタン
  ├── 抽出中：リアルタイムグラフ
  ├── 抽出後：結果サマリー + フィードバック入力
  ├── レシピ：一覧・お気に入り・ソート・カスタマイズ
  └── ログ：ショット一覧・比較グラフ
```

### 2-2. 役割分担

| コンポーネント | 役割 | 備考 |
|---|---|---|
| GaggiMate Pro | 抽出制御・レシピ実行・PID制御 | 完全ローカル。ネット切断でも抽出継続 |
| Python / FastAPI | データ収集・数値分析・LLM連携・通知 | Windowsで常時起動 |
| LM Studio | 改善提案・レシピ最適化の言語化 | RTX 4080 / 14Bモデル推奨 |
| React フロントエンド | 操作UI・可視化 | ブラウザ経由。後でアプリ化 |
| SQLite | ショットログ・レシピ・豆情報の永続保存 | 後でPostgreSQL or Firebaseに移行可 |

### 2-3. 既存OSS活用

| プロジェクト | 活用方法 | URL |
|---|---|---|
| gaggimate-mcp（julianleopold） | ベースとして拡張 | github.com/julianleopold/gaggimate-mcp |
| gaggimate-mcp（matvey-kuk） | 参考実装 | github.com/matvey-kuk/gaggimate-mcp |

> ※ gaggimate-mcpはクラウドLLM前提。LM StudioのエンドポイントURLに差し替えるだけでローカル動作に切り替え可能。

---

## 3. 通信仕様

### 3-1. GaggiMate WebSocket API

| 方向 | 種別 | 内容 |
|---|---|---|
| GaggiMate → アプリ | リアルタイムデータ | 温度・圧力・重量・フロー・抽出状態を1秒間隔 |
| アプリ → GaggiMate | レシピ送信 | JSON一括送信（分割送信ではない） |
| アプリ → GaggiMate | コマンド | 抽出開始・停止 |
| GaggiMate → Python | Webhook（POST） | ショット終了イベント。v1.6.0〜対応済み |

### 3-2. LM Studio API（ローカルLLM）

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="local-model",
    messages=[
        {"role": "system", "content": "あなたはエスプレッソの専門家です。"},
        {"role": "user", "content": f"ショットデータ:{shot_data}\nフィードバック:{feedback}"}
    ]
)
```

> ※ LM Studioを起動してLocal Serverをオンにするだけで動作。推奨モデル：Qwen2.5:14B（RTX 4080で快適動作）。

---

## 4. ショットログ設計

### 4-1. ショットレコード構造

```
ショット1件
  ├── 抽出データ（GaggiMateから自動取得）
  │   ├── 圧力カーブ（時系列）
  │   ├── 温度推移（時系列）
  │   ├── 重量推移（時系列）
  │   ├── フロー推移（時系列）
  │   └── 抽出時間・収率
  ├── 使用レシピ（バージョン付きスナップショット）
  └── ユーザー入力（抽出後フィードバック）
      ├── 豆の種類・ロースター・焙煎日
      ├── ドーズ量（g）
      ├── コマンダンテ クリック数
      ├── 感想（「酸っぱかった」「苦み強い」など自由記述）
      └── スコア（1〜5 ★）
```

### 4-2. SQLiteスキーマ

| テーブル | 主なカラム | 説明 |
|---|---|---|
| shots | id / timestamp / duration / recipe_id / bean_id / score / feedback | ショット1件のマスター |
| shot_timeseries | shot_id / t / pressure / temp / weight / flow | 1秒ごとの時系列データ |
| beans | id / name / roaster / roast_date / origin / notes | 豆マスター |
| grind_settings | shot_id / clicks / dose_g / yield_g | グラインド情報 |
| recipes | id / name / json / version / is_favorite / avg_score / use_count / created_at | レシピ。バージョン管理・お気に入り含む |
| llm_suggestions | shot_id / prompt / response / created_at | LLMの提案履歴 |

---

## 5. 抽出フロー

### 5-1. 通常の抽出フロー

| 手順 | 操作 | 主体 | 処理内容 |
|---|---|---|---|
| 1 | レシピ選択・スタートボタン | ユーザー（手動） | レシピJSONをGaggiMateに送信 + ログ収集開始 |
| 2 | 抽出中 | 自動 | 1秒ごとにデータ受信・バッファ |
| 3 | 重量到達 or タイムアウト | 自動（GaggiMate） | 自動停止 + Webhookで終了通知 |
| 4 | ログ自動保存 | 自動（Python） | バッファをSQLiteに保存 |
| 5 | フィードバック入力 | ユーザー（手動） | 感想・スコア・豆情報・グラインドを入力して保存 |
| 6 | Python数値分析 | 自動（Python） | 収率・抽出時間・圧力カーブを分析 |
| 7 | LLMに投げる | 自動（Python → LM Studio） | 数値分析結果 + ユーザーフィードバック → 改善提案生成 |
| 8 | 改善提案を表示 | 自動（アプリ） | 次のショットへの具体的なアクションを表示 |

> ※ 手動操作はスタートボタンとフィードバック入力の2回のみ。LLMへの投げるタイミングは保存ボタン押下がトリガー。

### 5-2. LLMの役割分担

| 処理 | 担当 | 具体例 |
|---|---|---|
| 収率・抽出時間・圧力の計算 | Python（ルールベース） | 収率67%・抽出18秒・ピーク8.2barを数値で検出 |
| 異常検知 | Python（ルールベース） | 「抽出時間が目標より7秒短い」などをフラグ |
| 原因推定・改善提案の言語化 | LLM（LM Studio） | 「酸っぱい+18秒 → グラインドを19クリックに」 |
| 過去ショットとの比較分析 | LLM（LM Studio） | 同じ豆の前回成功ショットとの差分から提案 |
| レシピ生成・カスタマイズ | LLM（LM Studio） | 「甘みを出したい」→ お気に入りをベースに調整 |

---

## 6. レシピ管理

### 6-1. レシピ一覧・ソート機能

SQLクエリで対応。LLM不要。

| 機能 | 実装方法 |
|---|---|
| お気に入り登録 | recipesテーブルのis_favoriteフラグをトグル |
| 評価順ソート | avg_scoreカラムをSHOT集計で自動更新・降順ソート |
| 豆別フィルター | shots.bean_idで絞り込み。どの豆にどのレシピが合うか |
| 使用頻度順 | use_countカラムで管理・降順ソート |
| 最終使用日順 | shots.timestampから最新ショットを集計 |

### 6-2. LLMによるレシピカスタマイズ

| 操作 | LLMの動作 |
|---|---|
| 「このエチオピアに合うレシピ作って」 | 過去の同系統豆ショットログ + コミュニティレシピを参照して生成 |
| 「甘みをもっと出したい」 | お気に入りレシピをベースに温度・プレインフュージョンを調整 |
| 「前回成功したレシピに戻したい」 | recipesテーブルのバージョン履歴から該当レシピを取得 |
| コミュニティレシピのカスタマイズ | Discord共有JSONを取り込み、自分の過去データに合わせて微調整 |

> ※ LLMが生成したレシピはJSONとして出力し、確認後にGaggiMateにWebSocket送信する。自動送信はしない。

---

## 7. 画面設計

| 画面 | 主な要素 | 備考 |
|---|---|---|
| ① ホーム | 温度・圧力・状態 / レシピ選択 / スタートボタン | GaggiMateの準備状態確認 |
| ② 抽出中 | 圧力・温度・重量リアルタイムグラフ / 時間 / ストップ | スタート後に自動遷移 |
| ③ 抽出後 | 結果サマリー / 豆情報 / グラインド / 感想 / スコア | 保存がLLM分析のトリガー |
| ④ 改善提案 | LLMの提案テキスト / 推奨レシピ調整案 | 保存後に自動表示（数秒後） |
| ⑤ レシピ | 一覧 / お気に入り / ソート / カスタマイズ依頼 | LLMへのカスタマイズ依頼もここから |
| ⑥ ログ | ショット一覧 / 豆別フィルター / 圧力カーブ比較 | 長期分析の起点 |
| ⑦ 設定 | GaggiMate接続 / LM Studio接続 / 通知設定 | |

### 7-1. 抽出後フィードバック入力フォーム

- 豆の種類（テキスト or 既存豆から選択）
- 焙煎日（日付ピッカー）
- ドーズ量（g）
- コマンダンテ クリック数
- 感想（自由記述：「酸っぱかった」「苦みが強い」など）
- スコア（1〜5 ★）
- **保存ボタン → LLM分析トリガー**

---

## 8. 技術スタック

| レイヤー | 技術 | 選定理由 |
|---|---|---|
| フロントエンド（Phase 1） | React + Vite | 後でReact Nativeに移行しやすい |
| スマホアプリ（Phase 3） | React Native | iOS/Android同時対応 |
| バックエンド | Python / FastAPI | FXシステムと同じ環境。既存スキル活用 |
| リアルタイム通信 | WebSocket + MQTT | WebSocket: コマンド / MQTT: データストリーム |
| ローカルLLM | LM Studio + Qwen2.5:14B | RTX 4080で快適動作。OpenAI互換API |
| DB（Phase 1） | SQLite | ローカル・設定不要 |
| DB（Phase 3〜） | PostgreSQL or Firebase | マルチデバイス同期時に移行 |
| 通知 | Web Push or LINE Notify | 抽出完了・LLM提案完了通知 |

---

## 9. 開発ロードマップ

### Phase 1 ― 機体到着前（待ち時間で完成させる）

- GaggiMate WebSocket API仕様書（websocket-api.yaml）を読む
- gaggimate-mcp（julianleopold）のコードを読んでデータ構造把握
- SQLiteスキーマ設計・実装
- FastAPIサーバー雛形作成（MQTT購読・Webhook受信）
- LM Studio導入・Qwen2.5:14Bをダウンロード・動作確認
- Reactフロントエンド：モックデータで全画面を完成させる
- LLMプロンプト設計（数値データ + フィードバックを渡す形式）

### Phase 2 ― GaggiMate導入後（実機で繋ぐ）

- WebSocket接続・実データ受信確認
- ショット境界検知ロジックの実装・調整
- SQLiteへの自動保存動作確認
- フィードバック入力フォーム動作確認
- LLM改善提案の動作確認・プロンプト調整
- プッシュ通知実装

### Phase 3 ― 安定稼働後

- BooKoo Themisスケール導入・重量制御
- 長期ログ分析・圧力カーブ比較グラフ
- LLMによるレシピ自動生成・カスタマイズUI
- React Nativeでスマホアプリ化
- クラウド同期（任意）

---

## 10. 参考リンク

| リソース | URL |
|---|---|
| GaggiMate 公式ドキュメント | docs.gaggimate.eu |
| GaggiMate GitHub（本体） | github.com/jniebuhr/gaggimate |
| WebSocket API仕様書 | github.com/jniebuhr/gaggimate/blob/master/docs/websocket-api.yaml |
| gaggimate-mcp（julianleopold） | github.com/julianleopold/gaggimate-mcp |
| gaggimate-mcp（matvey-kuk） | github.com/matvey-kuk/gaggimate-mcp |
| GaggiMate Shop | shop.gaggimate.eu |
| GaggiMate Discord | delta2.eu/discord |
| LM Studio | lmstudio.ai |

---

## 11. GaggiMate ダミーシミュレーター

実機到着前の開発・テスト用に、GaggiMate ProのWebSocket API / Webhookをローカルで模擬するPythonシミュレーターを用意。

### 11-1. 機能

| 機能 | 対応状況 |
|---|---|
| WebSocket `sub:status` ステータス配信（1-2秒間隔） | 対応済み |
| ボイラー加熱シミュレーション（PID的な温度変化） | 対応済み |
| 抽出シミュレーション（プロファイルのフェーズに従った圧力・フロー・重量変化） | 対応済み |
| `req:brew:start` / `req:brew:stop` コマンド | 対応済み |
| `req:profiles:list` / `select` / `save` / `delete` / `favorite` | 対応済み |
| ショット完了Webhook（POST） | 対応済み |
| センサーノイズ（リアルな揺らぎ） | 対応済み |
| MQTT | 未実装（Phase 2で必要に応じて追加） |

### 11-2. 起動方法

```bash
# 依存インストール
pip install -r simulator/requirements.txt

# シミュレーター起動
python simulator/gaggimate_sim.py --ws-port 8765 --webhook-url http://localhost:8000/webhook

# テストクライアントで動作確認
python simulator/test_client.py --url ws://localhost:8765
```

### 11-3. デフォルトプロファイル

- **Classic Espresso**: 93°C / 5s preinfusion @ 2bar → 25s extraction @ 9bar
- **Long Preinfusion**: 92°C / 8s bloom @ 2.5bar → ramp → 15s main @ 8.5bar → 5s decline

---

> 本仕様書はGaggiMate公式情報・GitHubリポジトリ・コミュニティ情報をもとに整理したものです。
