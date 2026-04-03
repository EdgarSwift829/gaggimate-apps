"""
GaggiMate シミュレーター ↔ バックエンド 結合テスト

起動方法:
  1. シミュレーター: cd simulator && python gaggimate_sim.py --ws-port 8765 --webhook-url http://localhost:8000/webhook
  2. バックエンド:   cd backend && pip install -e ".[dev]" && python -m uvicorn app.main:app --port 8000
  3. テスト実行:     python tests/test_integration.py

テスト内容:
  - ヘルスチェック
  - GaggiMate WebSocket接続確認
  - brew開始 → 完了 → Webhook → DB保存
  - ショットログ取得・時系列データ確認
  - 豆・レシピCRUD
  - フィードバック保存
"""

import asyncio
import sys
import time

import httpx

API = "http://localhost:8000"


class IntegrationTest:
    def __init__(self):
        self.client = httpx.Client(base_url=API, timeout=30)
        self.passed = 0
        self.failed = 0

    def check(self, name: str, condition: bool, detail: str = ""):
        if condition:
            print(f"  [PASS] {name}")
            self.passed += 1
        else:
            print(f"  [FAIL] {name} — {detail}")
            self.failed += 1

    def test_health(self):
        print("\n== 1. ヘルスチェック ==")
        r = self.client.get("/api/health")
        self.check("GET /api/health returns 200", r.status_code == 200)
        data = r.json()
        self.check("status is ok", data.get("status") == "ok")
        self.check("gaggimate_connected field exists", "gaggimate_connected" in data)
        return data.get("gaggimate_connected", False)

    def test_machine_status(self):
        print("\n== 2. マシンステータス ==")
        r = self.client.get("/api/machine/status")
        self.check("GET /api/machine/status returns 200", r.status_code == 200)
        data = r.json()
        self.check("connected field exists", "connected" in data)
        return data.get("connected", False)

    def test_beans_crud(self):
        print("\n== 3. 豆マスター CRUD ==")
        # Create
        r = self.client.post("/api/beans", json={
            "name": "Ethiopia Yirgacheffe",
            "roaster": "Onibus Coffee",
            "roast_date": "2026-03-20",
            "origin": "Ethiopia",
            "notes": "フルーティー、フローラル"
        })
        self.check("POST /api/beans returns 200", r.status_code == 200)
        bean = r.json()
        bean_id = bean.get("id")
        self.check("bean has id", bean_id is not None)

        # List
        r = self.client.get("/api/beans")
        self.check("GET /api/beans returns list", r.status_code == 200 and len(r.json()) > 0)

        return bean_id

    def test_recipes_crud(self):
        print("\n== 4. レシピ CRUD ==")
        r = self.client.post("/api/recipes", json={
            "name": "Classic Espresso",
            "profile_json": '{"phases":[{"name":"Preinfusion","pressure":2,"duration":5},{"name":"Extraction","pressure":9,"duration":25}]}',
            "version": 1,
        })
        self.check("POST /api/recipes returns 200", r.status_code == 200)
        recipe = r.json()
        recipe_id = recipe.get("id")
        self.check("recipe has id", recipe_id is not None)

        # List
        r = self.client.get("/api/recipes")
        self.check("GET /api/recipes returns list", r.status_code == 200 and len(r.json()) > 0)

        # Favorite toggle
        r = self.client.patch(f"/api/recipes/{recipe_id}/favorite")
        self.check("PATCH favorite returns 200", r.status_code == 200)
        self.check("is_favorite toggled", r.json().get("is_favorite") is True)

        return recipe_id

    def test_brew_cycle(self):
        print("\n== 5. 抽出サイクル (brew → webhook → DB) ==")

        # Start brew
        r = self.client.post("/api/machine/brew/start")
        if r.status_code == 503:
            print("  [SKIP] GaggiMateに未接続 — シミュレーターが起動していない可能性")
            return None
        self.check("POST brew/start returns 200", r.status_code == 200)
        data = r.json()
        self.check("response has rid", "rid" in data)

        # Wait for brew to complete (simulator default ~30s, use shorter timeout)
        print("  ... 抽出完了を待機中（最大45秒）...")
        initial_shots = self.client.get("/api/shots").json()
        initial_count = len(initial_shots)

        for i in range(45):
            time.sleep(1)
            shots = self.client.get("/api/shots").json()
            if len(shots) > initial_count:
                print(f"  ... {i+1}秒で新しいショットを検出")
                break
        else:
            self.check("new shot created within 45s", False, "timeout")
            return None

        shots = self.client.get("/api/shots").json()
        self.check("shot count increased", len(shots) > initial_count)
        new_shot = shots[0]  # latest shot (ordered by timestamp DESC)
        shot_id = new_shot["id"]
        self.check("shot has id", shot_id is not None)
        self.check("shot has duration", new_shot.get("duration") is not None)
        self.check("shot has yield_g", new_shot.get("yield_g") is not None)

        return shot_id

    def test_shot_detail(self, shot_id: int):
        print(f"\n== 6. ショット詳細 (shot_id={shot_id}) ==")
        r = self.client.get(f"/api/shots/{shot_id}")
        self.check("GET /api/shots/{id} returns 200", r.status_code == 200)
        data = r.json()
        self.check("has timeseries", len(data.get("timeseries", [])) > 0,
                    f"got {len(data.get('timeseries', []))} points")
        ts = data["timeseries"]
        if ts:
            self.check("timeseries has pressure", ts[0].get("pressure") is not None)
            self.check("timeseries has temp", ts[0].get("temp") is not None)
            print(f"  ... {len(ts)} timeseries points, duration={data.get('duration')}s")

    def test_shot_timeseries_endpoint(self, shot_id: int):
        print(f"\n== 7. 時系列データ専用エンドポイント ==")
        r = self.client.get(f"/api/shots/{shot_id}/timeseries")
        self.check("GET /api/shots/{id}/timeseries returns 200", r.status_code == 200)
        data = r.json()
        self.check("returns list of points", isinstance(data, list) and len(data) > 0)

    def test_feedback(self, shot_id: int, bean_id: int):
        print(f"\n== 8. フィードバック保存 (shot_id={shot_id}) ==")
        r = self.client.post(f"/api/shots/{shot_id}/feedback", json={
            "bean_name": "Ethiopia Yirgacheffe",
            "dose_g": 18.0,
            "yield_g": 36.0,
            "clicks": 22,
            "score": 4,
            "feedback": "バランス良い。フルーティー。少し酸味が強い。"
        })
        # LLM接続なしの場合でも200を返すはず（エラーメッセージが suggestion に入る）
        self.check("POST feedback returns 200", r.status_code == 200, f"status={r.status_code}, body={r.text[:200]}")
        if r.status_code == 200:
            data = r.json()
            self.check("response has suggestion", "suggestion" in data)
            self.check("response has analysis", "analysis" in data)
            if "analysis" in data:
                analysis = data["analysis"]
                print(f"  ... analysis: duration={analysis.get('duration')}s, "
                      f"ratio={analysis.get('yield_ratio')}, "
                      f"flags={analysis.get('flags')}")
            if data.get("suggestion"):
                preview = data["suggestion"][:100].replace("\n", " ")
                print(f"  ... suggestion: {preview}...")

    def run(self):
        print("=" * 60)
        print("GaggiMate 結合テスト")
        print("=" * 60)

        # Basic checks
        connected = self.test_health()
        machine_connected = self.test_machine_status()

        # CRUD
        bean_id = self.test_beans_crud()
        recipe_id = self.test_recipes_crud()

        # Brew cycle (requires simulator)
        if machine_connected:
            shot_id = self.test_brew_cycle()
            if shot_id:
                self.test_shot_detail(shot_id)
                self.test_shot_timeseries_endpoint(shot_id)
                self.test_feedback(shot_id, bean_id)
        else:
            print("\n== 5-8. 抽出サイクルテスト [SKIP] ==")
            print("  GaggiMateシミュレーターに未接続。接続テストをスキップします。")
            print("  シミュレーターを起動してください:")
            print("    cd simulator && python gaggimate_sim.py --ws-port 8765 --webhook-url http://localhost:8000/webhook")

        # Summary
        print("\n" + "=" * 60)
        total = self.passed + self.failed
        print(f"結果: {self.passed}/{total} passed, {self.failed} failed")
        if self.failed == 0:
            print("全テスト合格!")
        print("=" * 60)

        return self.failed == 0


if __name__ == "__main__":
    test = IntegrationTest()
    try:
        success = test.run()
    except httpx.ConnectError:
        print("\nERROR: バックエンドに接続できません。")
        print("  cd backend && pip install -e . && python -m uvicorn app.main:app --port 8000")
        sys.exit(1)
    sys.exit(0 if success else 1)
