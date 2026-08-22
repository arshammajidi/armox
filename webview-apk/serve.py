#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
پیش‌نمایش محلی محتوای وب قبل از ساخت APK.
    python3 serve.py            # پوشه‌ی content.local_web_dir از config.json
    python3 serve.py --port 8080
سپس در گوشی (روی همان وای‌فای) آدرس http://IP:8080 را باز کنید.
"""
import argparse
import http.server
import json
import socket
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--dir")
    ap.add_argument("--config", default=str(ROOT / "config.json"))
    a = ap.parse_args()

    if a.dir:
        d = Path(a.dir)
    else:
        cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
        d = Path(cfg["content"]["local_web_dir"])
    if not d.is_absolute():
        d = (ROOT / d).resolve()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kw):
            super().__init__(*args, directory=str(d), **kw)

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", a.port), Handler) as httpd:
        print(f"سرو از: {d}\n  http://localhost:{a.port}\n  http://{local_ip()}:{a.port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
