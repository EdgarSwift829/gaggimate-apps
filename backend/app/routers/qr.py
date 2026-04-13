"""QRコード生成エンドポイント."""

from __future__ import annotations

import io
import socket
import subprocess
import sys
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_lan_ip() -> str:
    """LAN IPをsocketで自動取得する."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    finally:
        s.close()


def _generate_qr_png(data: str) -> bytes:
    """qrcodeライブラリでPNG画像を生成して返す。未インストール時は自動インストール後リトライ。"""
    for attempt in range(2):
        try:
            import qrcode  # type: ignore
            from PIL import Image  # noqa: F401 — pillow 依存確認用

            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(data)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            return buf.read()
        except ImportError:
            if attempt == 0:
                logger.info("qrcode/pillow が見つかりません。自動インストールを試みます...")
                subprocess.check_call(
                    [sys.executable, "-m", "pip", "install", "qrcode", "pillow"]
                )
            else:
                raise


@router.get("/api/qr")
async def get_qr(port: int = 5173):
    """サーバーのLAN IPとポートからURLを組み立て、QRコードPNG画像を返す."""
    try:
        ip = _get_lan_ip()
        url = f"http://{ip}:{port}"
        logger.info("QR生成 URL: %s", url)
        png_bytes = _generate_qr_png(url)
        return StreamingResponse(io.BytesIO(png_bytes), media_type="image/png")
    except Exception as exc:
        logger.exception("QR生成中にエラーが発生しました")
        return JSONResponse(status_code=500, content={"error": str(exc)})
