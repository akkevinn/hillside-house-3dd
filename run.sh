#!/usr/bin/env bash
# Serve the 3D house locally. ES modules need http:// (file:// is blocked by CORS).
cd "$(dirname "$0")"
PORT="${1:-8123}"
echo "  House 3D  →  http://localhost:${PORT}"
echo "  (Ctrl+C to stop)"
python3 -m http.server "$PORT"
