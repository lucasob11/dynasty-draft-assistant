#!/usr/bin/env python3
"""Same as `python3 -m http.server`, except every response gets
Cache-Control: no-store. Without this, browsers fall back to their own
heuristic caching (plain http.server sends no Cache-Control header at all),
which some browsers hold onto far more aggressively than others across
edits/reloads during active development — annoying when the app's files
change every few minutes.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8743


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving on http://localhost:{PORT} (Cache-Control: no-store on every response)")
        httpd.serve_forever()
