#!/usr/bin/env python3
"""Serveur HTTPS de développement (la caméra exige HTTPS sur iPhone).

Usage : python3 tools/serve.py [port]   → https://<ip-du-pc>:8443
Le certificat auto-signé est généré dans tools/.cert/ au premier lancement.
"""
import http.server
import socket
import ssl
import subprocess
import sys
from functools import partial
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CERT_DIR = Path(__file__).resolve().parent / ".cert"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443


def ip_locale():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("192.0.2.1", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def certificat(ip):
    CERT_DIR.mkdir(exist_ok=True)
    cert, cle = CERT_DIR / "cert.pem", CERT_DIR / "key.pem"
    if not cert.exists():
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825",
             "-keyout", str(cle), "-out", str(cert), "-subj", "/CN=chasse-aux-betes-dev",
             "-addext", f"subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost"],
            check=True, capture_output=True,
        )
    return cert, cle


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json",
                      ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    ip = ip_locale()
    cert, cle = certificat(ip)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, cle)
    serveur = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), partial(Handler, directory=str(RACINE)))
    serveur.socket = ctx.wrap_socket(serveur.socket, server_side=True)
    print(f"https://{ip}:{PORT}  (et https://localhost:{PORT})")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
