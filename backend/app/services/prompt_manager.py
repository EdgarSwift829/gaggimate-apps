"""プロンプトテンプレート管理."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("prompts")

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# 利用可能なテンプレート名
TEMPLATE_NAMES = [
    "shot_improvement_system",
    "shot_improvement_user",
    "recipe_customize_system",
    "recipe_customize_user",
]


def get_template(name: str) -> str:
    """テンプレートファイルを読み込む."""
    if name not in TEMPLATE_NAMES:
        raise ValueError(f"Unknown template: {name}")
    path = PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    return path.read_text(encoding="utf-8")


def update_template(name: str, content: str) -> None:
    """テンプレートファイルを更新する."""
    if name not in TEMPLATE_NAMES:
        raise ValueError(f"Unknown template: {name}")
    path = PROMPTS_DIR / f"{name}.txt"
    path.write_text(content, encoding="utf-8")
    logger.info("Template updated: %s", name)


def list_templates() -> list[dict]:
    """利用可能なテンプレート一覧を返す."""
    result = []
    for name in TEMPLATE_NAMES:
        path = PROMPTS_DIR / f"{name}.txt"
        result.append({
            "name": name,
            "exists": path.exists(),
            "size": path.stat().st_size if path.exists() else 0,
        })
    return result


def render_shot_improvement(
    analysis,
    feedback: str,
    grind_clicks: int | None = None,
    bean_info: str | None = None,
    past_shots_summary: str | None = None,
) -> tuple[str, str]:
    """改善提案プロンプトをレンダリングして (system, user) を返す."""
    system = get_template("shot_improvement_system")

    grind_line = f"- コマンダンテ クリック数: {grind_clicks}\n" if grind_clicks else ""
    bean_line = f"- 豆: {bean_info}\n" if bean_info else ""

    flags_section = ""
    if analysis.flags:
        flags_section = "## 自動検知された問題\n" + "\n".join(f"- ⚠️ {f}" for f in analysis.flags) + "\n"

    past_section = ""
    if past_shots_summary:
        past_section = f"## 過去ショットとの比較\n{past_shots_summary}\n"

    target_yield = round(analysis.dose_g * 2.0, 1)

    user = get_template("shot_improvement_user").format(
        duration=analysis.duration,
        dose_g=analysis.dose_g,
        yield_g=analysis.yield_g,
        yield_ratio=analysis.yield_ratio,
        avg_pressure=analysis.avg_pressure,
        peak_pressure=analysis.peak_pressure,
        avg_temp=analysis.avg_temp,
        avg_flow=analysis.avg_flow,
        target_yield=target_yield,
        grind_line=grind_line,
        bean_line=bean_line,
        flags_section=flags_section,
        past_section=past_section,
        feedback=feedback,
    )
    return system, user


def render_recipe_customize(
    request: str,
    base_recipe: dict | None = None,
    past_shots: list[dict] | None = None,
) -> tuple[str, str]:
    """レシピカスタマイズプロンプトをレンダリングして (system, user) を返す."""
    import json

    system = get_template("recipe_customize_system")

    base_recipe_section = ""
    if base_recipe:
        base_recipe_section = f"\n## ベースレシピ\n```json\n{json.dumps(base_recipe, ensure_ascii=False, indent=2)}\n```\n"

    past_shots_section = ""
    if past_shots:
        past_shots_section = f"\n## 過去ショット（直近{len(past_shots)}件）\n"
        for s in past_shots[:5]:
            past_shots_section += f"- {s.get('duration', '?')}秒 / {s.get('yield_ratio', '?')}x / スコア:{s.get('score', '?')} / {s.get('feedback', '')}\n"

    user = get_template("recipe_customize_user").format(
        request=request,
        base_recipe_section=base_recipe_section,
        past_shots_section=past_shots_section,
    )
    return system, user
