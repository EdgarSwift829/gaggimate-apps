"""LLM連携サービス（LM Studio / OpenAI互換API）."""

from __future__ import annotations

import logging
from typing import Any

from openai import AsyncOpenAI

from app.config import settings
from app.services.analysis import ShotAnalysis
from app.services.prompt_manager import render_shot_improvement, render_recipe_customize

logger = logging.getLogger("llm")

client = AsyncOpenAI(
    base_url=settings.lm_studio_base_url,
    api_key="not-needed",
)


async def get_improvement_suggestion(
    analysis: ShotAnalysis,
    feedback: str,
    grind_clicks: int | None = None,
    bean_info: str | None = None,
    past_shots_summary: str | None = None,
) -> str:
    """ショット分析 + フィードバックから改善提案を生成."""
    system_prompt, user_content = render_shot_improvement(
        analysis=analysis,
        feedback=feedback,
        grind_clicks=grind_clicks,
        bean_info=bean_info,
        past_shots_summary=past_shots_summary,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.lm_studio_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
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
    system_prompt, user_content = render_recipe_customize(
        request=request,
        base_recipe=base_recipe,
        past_shots=past_shots,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.lm_studio_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        return response.choices[0].message.content or "レシピを生成できませんでした。"
    except Exception as e:
        logger.error("LLM recipe request failed: %s", e)
        return f"LLM接続エラー: {e}"
