"""tile_cache_server.py
简易瓦片缓存服务器：本地缓存高德/OSM 瓦片，离线再次访问时直接读本地文件。
启动方式：被 app_streamlit.py 调用的 start_tile_cache_server。
"""
import threading
import os
import sys
import urllib.request
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from pathlib import Path
from urllib.parse import urlparse

CACHE_ROOT = Path('tile_cache')
CACHE_ROOT.mkdir(exist_ok=True)

GAODE_TEMPLATE = "https://webrd0{sub}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"
OSM_TEMPLATE = "https://{sub}.tile.openstreetmap.org/{z}/{x}/{y}.png"

UA = 'Mozilla/5.0 (TileCache/1.0)'
FETCH_TIMEOUT = 8
RETRY = 1

class TileCacheHandler(SimpleHTTPRequestHandler):
    """同时提供瓦片缓存与 tracks.geojson 访问的简单服务器。"""

    def log_message(self, format, *args):  # 静默日志
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == '/tracks.geojson':
            self._serve_tracks()
            return
        self._serve_tile(path)

    # -------------------- helpers --------------------
    def _serve_tracks(self):
        gj = Path('tracks.geojson')
        if not gj.exists():
            self.send_error(404, 'tracks.geojson not found')
            return
        data = gj.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

    def _serve_tile(self, path: str):
        parts = path.strip('/').split('/')
        if len(parts) != 4:
            self.send_error(404, 'unsupported path')
            return
        source, z, x, yfile = parts
        if not yfile.endswith('.png'):
            self.send_error(404, 'not png')
            return
        y = yfile[:-4]
        if not (z.isdigit() and x.isdigit() and y.isdigit()):
            self.send_error(400, 'bad z/x/y')
            return
        z_i, x_i, y_i = int(z), int(x), int(y)
        cache_dir = CACHE_ROOT / source / z / x
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = cache_dir / f"{y}.png"
        if cache_file.exists():
            self._send_tile(cache_file.read_bytes())
            return
        try:
            if source == 'gaode':
                sub = str((x_i + y_i) % 4 + 1)
                remote_url = GAODE_TEMPLATE.format(sub=sub, x=x_i, y=y_i, z=z_i)
            elif source == 'osm':
                sub = 'a'
                remote_url = OSM_TEMPLATE.format(sub=sub, x=x_i, y=y_i, z=z_i)
            else:
                self.send_error(404, 'unknown source')
                return
        except Exception:
            self.send_error(500, 'url build error')
            return
        data = None
        for attempt in range(RETRY + 1):
            try:
                req = urllib.request.Request(remote_url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        break
            except Exception:
                time.sleep(0.3)
        if data is None:
            self.send_error(502, 'upstream failed')
            return
        try:
            tmp = cache_file.with_suffix('.tmp')
            with open(tmp, 'wb') as f:
                f.write(data)
            os.replace(tmp, cache_file)
        except Exception:
            pass
        self._send_tile(data)

    def _send_tile(self, data: bytes):
        self.send_response(200)
        self.send_header('Content-Type', 'image/png')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'public, max-age=31536000')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

_server_instance = None

def start_tile_cache_server(port: int = 8001):
    global _server_instance
    if _server_instance is not None:
        return _server_instance
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), TileCacheHandler)
    except OSError:
        # 端口可能已被占用，直接返回（认为已有实例）
        return None
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    _server_instance = server
    return server

if __name__ == '__main__':
    print('Starting tile cache server on 127.0.0.1:8001 ...')
    start_tile_cache_server(8001)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass
