"""ショットデータの数値分析（ルールベース）."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ShotAnalysis:
    duration: float
    dose_g: float
    yield_g: float
    yield_ratio: float
    avg_pressure: float
    peak_pressure: float
    avg_temp: float
    avg_flow: float
    flags: list[str]


def analyze_shot(
    timeseries: list[dict],
    dose_g: float = 16.0,
    yield_g: float | None = None,
    target_duration: float = 27.0,
    target_yield_ratio: float = 2.0,
) -> ShotAnalysis:
    """時系列データからショットを数値分析する."""
    if not timeseries:
        return ShotAnalysis(0, dose_g, 0, 0, 0, 0, 0, 0, ["no_data"])

    duration = timeseries[-1].get("t", 0) - timeseries[0].get("t", 0)
    pressures = [d.get("pressure", 0) for d in timeseries if d.get("pressure")]
    temps = [d.get("temp", d.get("temperature", 0)) for d in timeseries if d.get("temp") or d.get("temperature")]
    flows = [d.get("flow", 0) for d in timeseries if d.get("flow")]
    weights = [d.get("weight", 0) for d in timeseries if d.get("weight")]

    actual_yield = yield_g or (max(weights) if weights else 0)
    yield_ratio = actual_yield / dose_g if dose_g > 0 else 0

    avg_pressure = sum(pressures) / len(pressures) if pressures else 0
    peak_pressure = max(pressures) if pressures else 0
    avg_temp = sum(temps) / len(temps) if temps else 0
    avg_flow = sum(flows) / len(flows) if flows else 0

    # 異常検知フラグ
    flags: list[str] = []
    time_diff = duration - target_duration
    if time_diff < -5:
        flags.append(f"抽出時間が目標より{abs(time_diff):.0f}秒短い（チャネリングの可能性）")
    elif time_diff > 8:
        flags.append(f"抽出時間が目標より{time_diff:.0f}秒長い（挽き目が細すぎる可能性）")

    if yield_ratio < 1.7:
        flags.append(f"収率が低い（{yield_ratio:.2f}x）— ドーズ過多 or 抽出不足")
    elif yield_ratio > 2.5:
        flags.append(f"収率が高い（{yield_ratio:.2f}x）— 過抽出の可能性")

    if peak_pressure > 10.5:
        flags.append(f"ピーク圧力が高い（{peak_pressure:.1f}bar）— パック詰まり")
    elif avg_pressure < 6.0 and duration > 5:
        flags.append(f"平均圧力が低い（{avg_pressure:.1f}bar）— 挽き目が粗い可能性")

    return ShotAnalysis(
        duration=round(duration, 1),
        dose_g=dose_g,
        yield_g=round(actual_yield, 1),
        yield_ratio=round(yield_ratio, 2),
        avg_pressure=round(avg_pressure, 2),
        peak_pressure=round(peak_pressure, 2),
        avg_temp=round(avg_temp, 1),
        avg_flow=round(avg_flow, 2),
        flags=flags,
    )
