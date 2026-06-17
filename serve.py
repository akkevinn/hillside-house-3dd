#!/usr/bin/env python3
"""Minimal static server. Serves this script's own directory on the given port
(default 8123). ES modules need http:// — opening index.html as file:// is blocked by CORS."""
import http.server
import socketserver
import os
import sys

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=DIRECTORY, **k)

    def end_headers(self):
        # never cache during local dev, so code edits always show up on reload
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


with Server(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving {DIRECTORY} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
