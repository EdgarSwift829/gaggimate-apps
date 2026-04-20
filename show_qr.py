#!/usr/bin/env python3
"""
起動後にスマホ用QRコードをターミナルに表示するスクリプト。
依存: qrcode (pip install qrcode)
"""
import os
import socket
import sys


def get_local_ip() -> str:
    """LAN側のIPアドレスを取得する。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def generate_qr_ansi(url: str) -> str | None:
    """
    ANSIカラーコードで背景色を明示してQRを描画する。
    ターミナルの配色（黒背景/白背景）に関わらず正しく表示・スキャン可能。
    """
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_M

        qr = qrcode.QRCode(
            version=None,
            error_correction=ERROR_CORRECT_M,
            box_size=1,
            border=4,  # 規格準拠のクワイエットゾーン
        )
        qr.add_data(url)
        qr.make(fit=True)

        matrix = qr.get_matrix()

        # \033[40m  = 黒背景2文字（QRの暗モジュール）
        # \033[107m = 明るい白背景2文字（QRの明モジュール）
        DARK  = "\033[40m  \033[0m"
        LIGHT = "\033[107m  \033[0m"

        lines = []
        for row in matrix:
            lines.append("".join(DARK if cell else LIGHT for cell in row))
        return "\n".join(lines)

    except ImportError:
        return None


def install_and_retry(url: str) -> str | None:
    """qrcode が無ければ自動インストールして再試行。"""
    import subprocess
    print("qrcode をインストール中...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "qrcode", "-q"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return generate_qr_ansi(url)


def _enable_ansi_windows() -> None:
    """Windows CMD で VirtualTerminalProcessing を有効化する。"""
    try:
        import ctypes
        import ctypes.wintypes
        ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
        STD_OUTPUT_HANDLE = -11
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(STD_OUTPUT_HANDLE)
        mode = ctypes.wintypes.DWORD()
        kernel32.GetConsoleMode(handle, ctypes.byref(mode))
        kernel32.SetConsoleMode(handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        os.system("")  # フォールバック


def main():
    if sys.platform == "win32":
        _enable_ansi_windows()

    port = sys.argv[1] if len(sys.argv) > 1 else "5174"
    ip = get_local_ip()
    url = f"http://{ip}:{port}"

    sep = "=" * 52

    qr_text = generate_qr_ansi(url)
    if qr_text is None:
        qr_text = install_and_retry(url)

    print()
    print(sep)
    print(f"  [スマホ] {url}")
    print(sep)

    if qr_text:
        print()
        print(qr_text)
        print()
        print("  カメラでQRコードをスキャンしてください")
    else:
        print("  QR生成に失敗しました。URLを手動で入力してください。")

    print(sep)
    print()


if __name__ == "__main__":
    main()
