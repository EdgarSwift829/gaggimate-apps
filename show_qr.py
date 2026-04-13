#!/usr/bin/env python3
"""
起動後にスマホ用QRコードをターミナルに表示するスクリプト。
依存: qrcode (pip install qrcode)
"""
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


def generate_qr_text(url: str) -> str:
    """qrcode ライブラリでターミナル用QRを生成する。"""
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_L

        qr = qrcode.QRCode(
            version=1,
            error_correction=ERROR_CORRECT_L,
            box_size=1,
            border=1,
        )
        qr.add_data(url)
        qr.make(fit=True)

        lines = []
        matrix = qr.get_matrix()
        for row in matrix:
            line = ""
            for cell in row:
                line += "##" if cell else "  "
            lines.append(line)
        return "\n".join(lines)

    except ImportError:
        return None


def install_and_retry(url: str) -> str:
    """qrcode が無ければ自動インストールして再試行。"""
    import subprocess
    print("qrcode をインストール中...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "qrcode", "-q"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return generate_qr_text(url)


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else "5173"
    ip = get_local_ip()
    url = f"http://{ip}:{port}"

    sep = "=" * 50

    qr_text = generate_qr_text(url)
    if qr_text is None:
        qr_text = install_and_retry(url)

    print()
    print(sep)
    print(f"  [smartphone] {url}")
    print(sep)

    if qr_text:
        print()
        sys.stdout.buffer.write((qr_text + "\n").encode("utf-8"))
        sys.stdout.buffer.flush()
        print()
        print("  Scan QR code with your smartphone camera")
    else:
        print("  QR generation failed. Please enter the URL manually.")

    print(sep)
    print()


if __name__ == "__main__":
    main()
