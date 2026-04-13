"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-12 00:00:00.000000

"""
from __future__ import annotations
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 豆マスター
    op.create_table(
        "beans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("roaster", sa.Text(), nullable=True),
        sa.Column("roast_date", sa.Text(), nullable=True),       # ISO 8601 (YYYY-MM-DD)
        sa.Column("origin", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.Text(),
            nullable=False,
            server_default=sa.text("(datetime('now'))"),
        ),
    )

    # レシピ（バージョン管理・お気に入り含む）
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("json", sa.Text(), nullable=False),           # GaggiMate プロファイルJSON
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_favorite", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("avg_score", sa.Real(), nullable=True),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_community", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.Text(),
            nullable=False,
            server_default=sa.text("(datetime('now'))"),
        ),
    )

    # ショット1件のマスター
    op.create_table(
        "shots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "timestamp",
            sa.Text(),
            nullable=False,
            server_default=sa.text("(datetime('now'))"),
        ),
        sa.Column("duration", sa.Real(), nullable=True),        # 抽出時間（秒）
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id"), nullable=True),
        sa.Column("bean_id", sa.Integer(), sa.ForeignKey("beans.id"), nullable=True),
        sa.Column("dose_g", sa.Real(), nullable=True),          # ドーズ量（g）
        sa.Column("yield_g", sa.Real(), nullable=True),         # 抽出量（g）
        sa.Column("yield_ratio", sa.Real(), nullable=True),     # 収率（yield / dose）
        sa.Column(
            "score",
            sa.Integer(),
            sa.CheckConstraint("score BETWEEN 1 AND 5"),
            nullable=True,
        ),
        sa.Column("feedback", sa.Text(), nullable=True),        # ユーザー感想（自由記述）
        sa.Column("webhook_payload", sa.Text(), nullable=True), # GaggiMateからの生Webhook JSON
        sa.Column(
            "created_at",
            sa.Text(),
            nullable=False,
            server_default=sa.text("(datetime('now'))"),
        ),
    )

    # 1秒ごとの時系列データ
    op.create_table(
        "shot_timeseries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "shot_id",
            sa.Integer(),
            sa.ForeignKey("shots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("t", sa.Real(), nullable=False),              # 経過時間（秒）
        sa.Column("pressure", sa.Real(), nullable=True),        # 圧力（bar）
        sa.Column("temp", sa.Real(), nullable=True),            # 温度（°C）
        sa.Column("weight", sa.Real(), nullable=True),          # 重量（g）
        sa.Column("flow", sa.Real(), nullable=True),            # フロー（ml/s）
    )
    op.create_index("idx_timeseries_shot", "shot_timeseries", ["shot_id"])

    # グラインド情報
    op.create_table(
        "grind_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "shot_id",
            sa.Integer(),
            sa.ForeignKey("shots.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("clicks", sa.Integer(), nullable=True),       # コマンダンテ クリック数
        sa.Column("dose_g", sa.Real(), nullable=True),          # ドーズ量（g）
        sa.Column("yield_g", sa.Real(), nullable=True),         # 抽出量（g）
    )

    # LLM提案履歴
    op.create_table(
        "llm_suggestions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "shot_id",
            sa.Integer(),
            sa.ForeignKey("shots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.Text(),
            nullable=False,
            server_default=sa.text("(datetime('now'))"),
        ),
    )
    op.create_index("idx_llm_shot", "llm_suggestions", ["shot_id"])

    # Web Push購読情報
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("subscription_json", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.Text(),
            nullable=False,
            server_default=sa.text("(datetime('now'))"),
        ),
    )


def downgrade() -> None:
    # 作成と逆順で削除
    op.drop_table("push_subscriptions")
    op.drop_index("idx_llm_shot", table_name="llm_suggestions")
    op.drop_table("llm_suggestions")
    op.drop_table("grind_settings")
    op.drop_index("idx_timeseries_shot", table_name="shot_timeseries")
    op.drop_table("shot_timeseries")
    op.drop_table("shots")
    op.drop_table("recipes")
    op.drop_table("beans")
