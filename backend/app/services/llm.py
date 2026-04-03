"""LLM連携サービス（LM Studio / OpenAI互換API）."""

from __future__ import annotations

import logging
from typing import Any

from openai import AsyncOpenAI

from app.config import settings
from app.services.analysis import ShotAnalysis

logger = logging.getLogger("llm")

client = AsyncOpenAI(
    base_url=settings.lm_studio_base_url,
    api_key="not-needed",
)

SYSTEM_PROMPT = """あなたはエスプレッソ抽出の専門家です。
ユーザーのショットデータ（圧力・温度・フロー・時間・収率）とフィードバック（味の感想）を分析し、
次のショットで改善すべき具体的なアクションを3つ以内で提案してください。

提案は以下の形式で:
1. 【アクション】具体的な操作（例: グラインドを1クリック細かく）
2. 【理由】なぜそう提案するか

使用グラインダー: コマンダンテ C40（クリック数で管理）
マシン: Gaggia Classic E24 + GaggiMate Pro（圧力プロファイル制御可能）
"""

RECIPE_SYSTEM_PROMPT = """あなたはエスプレッソレシピの専門家です。
GaggiMate Proのプロファイル形式（JSON）でレシピを提案してください。

プロファイル構造:
- label: レシピ名
- type: "pro"
- temperature: ボイラー温度（°C）
- phases: [{name, phase, valve, duration, pump: {pressure, flow}, transition: {type, duration}, targets: {pumped, weight}}]

過去のショットデータとユーザーの要望に基づいて、最適なプロファイルを生成してください。
レシピJSONは```json ... ```で囲んで出力してください。
"""


async def get_improvement_suggestion(
    analysis: ShotAnalysis,
    feedback: str,
    grind_clicks: int | None = None,
    bean_info: str | None = None,
    past_shots_summary: str | None = None,
) -> str:
    """ショット分析 + フィードバックから改善提案を生成."""
    user_content = f"""## ショットデータ
- 抽出時間: {analysis.duration}秒
- ドーズ: {analysis.dose_g}g → 抽出量: {analysis.yield_g}g（収率: {analysis.yield_ratio}x）
- 平均圧力: {analysis.avg_pressure}bar / ピーク: {analysis.peak_pressure}bar
- 平均温度: {analysis.avg_temp}°C
- 平均フロー: {analysis.avg_flow}ml/s
"""
    if grind_clicks is not None:
        user_content += f"- コマンダンテ クリック数: {grind_clicks}\n"
    if bean_info:
        user_content += f"- 豆: {bean_info}\n"
    if analysis.flags:
        user_content += f"\n## 自動検知された問題\n"
        for flag in analysis.flags:
            user_content += f"- ⚠️ {flag}\n"
    if past_shots_summary:
        user_content += f"\n## 過去ショットとの比較\n{past_shots_summary}\n"
    user_content += f"\n## ユーザーフィードバック\n{feedback}\n"

    try:
        response = await client.chat.completions.create(
            model=settings.lm_studio_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content or "提案を生成できませんでした。"
    except Exception as e:
        logger.error("LLM request failed: %s", e)
        return f"LLM接続エラー: {e}\n\n自動検知結果:\n" + "\n".join(f"- {f}" for f in analysis.flags)


async def generate_recipe_suggestion(
    request: str,
    past_shots: list[dict[str, Any]] | None = None,
    base_recipe: dict[str, Any] | None = None,
) -> str:
    """ユーザーの要望からレシピ提案を生成."""
    user_content = f"## リクエスト\n{request}\n"
    if base_recipe:
        import json
        user_content += f"\n## ベースレシピ\n```json\n{json.dumps(base_recipe, ensure_ascii=False, indent=2)}\n```\n"
    if past_shots:
        user_content += f"\n## 過去ショット（直近{len(past_shots)}件）\n"
        for shot in past_shots[:5]:
            user_content += f"- {shot.get('duration', '?')}秒 / {shot.get('yield_ratio', '?')}x / スコア:{shot.get('score', '?')} / {shot.get('feedback', '')}\n"

    try:
        response = await client.chat.completions.create(
            model=settings.lm_studio_model,
            messages=[
                {"role": "system", "content": RECIPE_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        return response.choices[0].message.content or "レシピを生成できませんでした。"
    except Exception as e:
        logger.error("LLM recipe request failed: %s", e)
        return f"LLM接続エラー: {e}"
