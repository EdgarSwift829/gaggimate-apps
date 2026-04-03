"""Numerical analysis for espresso shots (rule-based, no LLM)."""

from ..models import TimeseriesPoint


def analyze_shot(
    timeseries: list[TimeseriesPoint],
    duration: float | None,
    dose_g: float | None,
    yield_g: float | None,
) -> dict:
    """Analyze shot data and return metrics + flags."""

    result: dict = {
        "duration_s": duration,
        "dose_g": dose_g,
        "yield_g": yield_g,
        "ratio": None,
        "peak_pressure_bar": None,
        "avg_pressure_bar": None,
        "avg_temp_c": None,
        "flags": [],
    }

    # Brew ratio
    if dose_g and yield_g and dose_g > 0:
        result["ratio"] = round(yield_g / dose_g, 2)

    # Pressure analysis
    pressures = [p.pressure for p in timeseries if p.pressure is not None]
    if pressures:
        result["peak_pressure_bar"] = round(max(pressures), 1)
        result["avg_pressure_bar"] = round(sum(pressures) / len(pressures), 1)

    # Temperature analysis
    temps = [p.temp for p in timeseries if p.temp is not None]
    if temps:
        result["avg_temp_c"] = round(sum(temps) / len(temps), 1)

    # ── Flags (anomaly detection) ──────────────────────

    # Duration check
    if duration is not None:
        if duration < 20:
            result["flags"].append(
                f"抽出時間が短すぎます（{duration:.0f}秒）。グラインドを細かくするか、ドーズを増やしてください。"
            )
        elif duration > 35:
            result["flags"].append(
                f"抽出時間が長すぎます（{duration:.0f}秒）。グラインドを粗くするか、ドーズを減らしてください。"
            )

    # Brew ratio check
    ratio = result["ratio"]
    if ratio is not None:
        if ratio < 1.5:
            result["flags"].append(
                f"収率が低いです（1:{ratio}）。抽出量を増やすか、グラインドを細かくしてください。"
            )
        elif ratio > 3.0:
            result["flags"].append(
                f"収率が高すぎます（1:{ratio}）。過抽出の可能性があります。"
            )

    # Peak pressure check
    peak = result["peak_pressure_bar"]
    if peak is not None:
        if peak > 10:
            result["flags"].append(
                f"ピーク圧力が高すぎます（{peak} bar）。チャネリングの原因になります。"
            )
        elif peak < 6:
            result["flags"].append(
                f"ピーク圧力が低すぎます（{peak} bar）。グラインドを細かくするか、ドーズを増やしてください。"
            )

    # Temperature check
    avg_temp = result["avg_temp_c"]
    if avg_temp is not None:
        if avg_temp < 88:
            result["flags"].append(
                f"平均抽出温度が低いです（{avg_temp}℃）。温度を上げてください。"
            )
        elif avg_temp > 96:
            result["flags"].append(
                f"平均抽出温度が高すぎます（{avg_temp}℃）。焦げた味の原因になります。"
            )

    return result
