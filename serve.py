#!/usr/bin/env python3
"""Minimal static server that avoids os.getcwd() (blocked in some sandboxes).
Serves the house3d directory on the given port (default 8123)."""
import http.server
import socketserver
import functools
import sys

DIRECTORY = "/Users/antoniokevin/Documents/playground-ops/house3d"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIRECTORY)


class Server(socketserver.TCPServer):
    allow_reuse_address = True


with Server(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving {DIRECTORY} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
