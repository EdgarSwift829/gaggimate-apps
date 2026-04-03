"""
GaggiMate シミュレーター テストクライアント
============================================
シミュレーターに接続し、一連の操作を実行してログ出力する。

使い方:
    # 先にシミュレーターを起動:
    python gaggimate_sim.py

    # 別ターミナルでテスト実行:
    python test_client.py [--url ws://localhost:8765/ws]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid

import websockets


async def send_req(ws, tp: str, **kwargs) -> dict:
    rid = uuid.uuid4().hex[:8]
    msg = {"tp": tp, "rid": rid, **kwargs}
    print(f"\n>>> SEND: {json.dumps(msg, ensure_ascii=False)}")
    await ws.send(json.dumps(msg))
    # 応答を待つ（最大5秒）
    resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
    print(f"<<< RECV: {json.dumps(resp, ensure_ascii=False, indent=2)}")
    return resp


async def recv_status(ws, count: int = 3) -> None:
    """ステータスメッセージを指定回数受信して表示."""
    for i in range(count):
        raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
        data = json.loads(raw)
        if data.get("tp") == "sub:status":
            print(f"  [{i+1}/{count}] temp={data['current_temp']:.1f}°C "
                  f"pressure={data['pressure']:.1f}bar "
                  f"flow={data['flow']:.1f}ml/s "
                  f"weight={data['weight']:.1f}g "
                  f"mode={data['mode']} phase={data['phase']} "
                  f"elapsed={data['elapsed_time']:.1f}s")
        else:
            print(f"  [{i+1}/{count}] other: {data.get('tp')}")


async def run_test(url: str) -> None:
    print(f"Connecting to {url} ...")

    async with websockets.connect(url) as ws:
        # 1. 初回ステータス受信
        initial = json.loads(await ws.recv())
        print(f"\n=== Initial Status ===")
        print(f"  Mode: {initial.get('mode')}, Temp: {initial.get('current_temp')}°C")

        # 2. プロファイル一覧取得
        print(f"\n=== List Profiles ===")
        resp = await send_req(ws, "req:profiles:list")
        profiles = resp.get("profiles", [])
        for p in profiles:
            print(f"  - {p['id']}: {p['label']} (fav={p['is_favorite']})")

        # 3. ヒートアップ待ち（ステータス数回受信）
        print(f"\n=== Heating Up (waiting for status updates) ===")
        await recv_status(ws, count=3)

        # 4. 抽出開始
        print(f"\n=== Start Brew ===")
        await send_req(ws, "req:brew:start")

        # 5. 抽出中のステータス監視
        print(f"\n=== Brewing (monitoring) ===")
        brew_count = 0
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=60.0)
            data = json.loads(raw)
            if data.get("tp") == "sub:status":
                brew_count += 1
                mode = data["mode"]
                print(f"  [{brew_count:3d}] {data['elapsed_time']:5.1f}s | "
                      f"P={data['pressure']:5.2f}bar | "
                      f"T={data['current_temp']:5.1f}°C | "
                      f"F={data['flow']:4.2f}ml/s | "
                      f"W={data['weight']:5.1f}g | "
                      f"phase={data['phase']}")
                if mode == "standby":
                    print(f"\n=== Brew Complete! ({data['elapsed_time']:.1f}s, {data['weight']:.1f}g) ===")
                    break

        # 6. 完了後のステータス確認
        print(f"\n=== Post-Brew Status ===")
        await recv_status(ws, count=2)

        print(f"\n=== Test Complete ===")


def main() -> None:
    parser = argparse.ArgumentParser(description="GaggiMate Simulator Test Client")
    parser.add_argument("--url", default="ws://localhost:8765", help="Simulator WebSocket URL")
    args = parser.parse_args()
    asyncio.run(run_test(args.url))


if __name__ == "__main__":
    main()
