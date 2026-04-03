"""LM Studio (local LLM) integration via OpenAI-compatible API."""

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

client = AsyncOpenAI(
    base_url=settings.LLM_BASE_URL,
    api_key="not-needed",
)

SYSTEM_PROMPT = """あなたはエスプレッソ抽出の専門家です。
Gaggia Classic E24 + GaggiMate Proを使ったエスプレッソ抽出について、
データに基づいた具体的な改善提案を日本語で行ってください。

ルール:
- 数値データに基づいて具体的なアクションを提案する
- グラインド設定はコマンダンテC40のクリック数で指示する
- 温度・圧力プロファイルの調整はGaggiMateレシピのパラメータで指示する
- 簡潔に、箇条書きで回答する
"""


async def get_shot_suggestion(
    analysis: dict,
    feedback: Optional[str],
    bean_info: Optional[dict],
    grind_info: Optional[dict],
    history: Optional[list[dict]] = None,
) -> str:
    """Generate improvement suggestion for a shot."""
    user_parts = []

    user_parts.append(f"## 抽出データ分析結果\n{json.dumps(analysis, ensure_ascii=False, indent=2)}")

    if feedback:
        user_parts.append(f"## ユーザーフィードバック\n{feedback}")

    if bean_info:
        user_parts.append(f"## 使用豆\n{json.dumps(bean_info, ensure_ascii=False, indent=2)}")

    if grind_info:
        user_parts.append(f"## グラインド設定\n{json.dumps(grind_info, ensure_ascii=False, indent=2)}")

    if history:
        user_parts.append(f"## 過去の同じ豆のショット（直近3件）\n{json.dumps(history, ensure_ascii=False, indent=2)}")

    user_parts.append("上記のデータに基づいて、次のショットの具体的な改善提案を3つ以内で挙げてください。")

    user_message = "\n\n".join(user_parts)

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content or "提案を生成できませんでした。"
    except Exception as e:
        logger.error("LLM request failed: %s", e)
        return f"LLMサーバーに接続できません: {e}"


async def get_recipe_suggestion(
    request: str,
    base_recipe: Optional[str] = None,
    bean_info: Optional[dict] = None,
    past_shots: Optional[list[dict]] = None,
) -> tuple[str, Optional[str]]:
    """Generate a recipe suggestion. Returns (text_suggestion, recipe_json_or_none)."""
    user_parts = [f"## リクエスト\n{request}"]

    if base_recipe:
        user_parts.append(f"## ベースレシピJSON\n{base_recipe}")

    if bean_info:
        user_parts.append(f"## 対象の豆\n{json.dumps(bean_info, ensure_ascii=False, indent=2)}")

    if past_shots:
        user_parts.append(f"## 過去のショットデータ\n{json.dumps(past_shots, ensure_ascii=False, indent=2)}")

    user_parts.append(
        "提案をテキストで説明した上で、GaggiMateで使えるレシピJSONも生成してください。"
        "JSONは```json```ブロックで囲んでください。"
    )

    user_message = "\n\n".join(user_parts)

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        text = response.choices[0].message.content or ""

        # Extract JSON block if present
        recipe_json = None
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            recipe_json = text[start:end].strip()

        return text, recipe_json
    except Exception as e:
        logger.error("LLM request failed: %s", e)
        return f"LLMサーバーに接続できません: {e}", None
