"""prepare_land_mask.py
生成本项目模拟范围内的真实陆地掩膜 GeoJSON (land_mask.geojson)

步骤:
1. 自动尝试下载 Natural Earth 10m Land 数据 (Public Domain)
   源: https://naturalearthdata.com 备份 S3: https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_land.zip
2. 解压 shapefile
3. 读取多边形并裁剪到给定经纬度范围 (默认与 simulate.py 中 lon0..lon1/lat0..lat1 一致: 120-122E, 30-32N)
4. 输出 GeoJSON，供 simulate.py --land_mask_geojson 使用。

依赖: shapely, pyshp (pip install shapely pyshp)
若下载失败: 请手动下载 ne_10m_land.zip 放到 data/ 目录再运行。
"""
from __future__ import annotations
import os, sys, zipfile, io, json, urllib.request, argparse
from pathlib import Path

DATA_URL = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_land.zip"
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)
ZIP_PATH = DATA_DIR / 'ne_10m_land.zip'

# 默认输出
DEFAULT_OUT = 'land_mask.geojson'

# 运行期注入的 bbox / 输出路径
RUNTIME_BBOX = (120.0, 30.0, 122.0, 32.0)
RUNTIME_OUT = Path(DEFAULT_OUT)

try:
    import shapefile  # pyshp
except Exception:
    print('缺少 pyshp: pip install pyshp', file=sys.stderr)
    shapefile = None
try:
    from shapely.geometry import shape, Polygon, MultiPolygon, box, mapping
    from shapely.ops import unary_union
except Exception:
    print('缺少 shapely: pip install shapely', file=sys.stderr)
    shape = None

def download():
    if ZIP_PATH.exists():
        print('已存在 zip: skip 下载')
        return True
    try:
        print('下载 Land 数据...', DATA_URL)
        with urllib.request.urlopen(DATA_URL, timeout=30) as r:
            data = r.read()
        ZIP_PATH.write_bytes(data)
        print('下载完成')
        return True
    except Exception as e:
        print('自动下载失败:', e)
        return False

def extract():
    shp_path = None
    try:
        with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
            for n in zf.namelist():
                if n.endswith('.shp'):
                    shp_path = DATA_DIR / n
                outp = DATA_DIR / n
                if not outp.exists():
                    outp.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(n) as r, open(outp, 'wb') as w:
                        w.write(r.read())
        return shp_path
    except Exception as e:
        print('解压失败:', e)
        return None

def build_mask(shp_file: Path):
    if shapefile is None or shape is None:
        print('缺少依赖，无法生成。')
        return False
    print('读取 Shapefile:', shp_file)
    r = shapefile.Reader(str(shp_file))
    print('总 shape 数:', len(r.shapes()))
    minlon, minlat, maxlon, maxlat = RUNTIME_BBOX
    region_box = box(minlon, minlat, maxlon, maxlat)
    geoms = []
    matched_count = 0
    for sh in r.shapes():
        try:
            pts = sh.points
            if not pts: continue
            # parts delim
            parts = list(sh.parts) + [len(pts)]
            for i in range(len(parts)-1):
                ring = pts[parts[i]:parts[i+1]]
                if len(ring) < 3: continue
                poly = Polygon(ring)
                if not poly.is_valid: poly = poly.buffer(0)
                if not poly.is_valid: continue
                if poly.bounds[2] < minlon or poly.bounds[0] > maxlon or poly.bounds[3] < minlat or poly.bounds[1] > maxlat:
                    continue
                inter = poly.intersection(region_box)
                if not inter.is_empty:
                    geoms.append(inter)
                    matched_count += 1
        except Exception:
            continue
    print('与 BBOX 相交的多边形数:', matched_count)
    if not geoms:
        print('未捕获任何陆地区域, 检查 BBOX 或数据版本')
        return False
    merged = unary_union(geoms)
    features = []
    def add_geom(g):
        if g.is_empty: return
        if isinstance(g, (Polygon,)):
            features.append({"type":"Feature","properties":{},"geometry":mapping(g)})
        elif isinstance(g, MultiPolygon):
            features.append({"type":"Feature","properties":{},"geometry":mapping(g)})
        else:
            for part in g.geoms:
                add_geom(part)
    add_geom(merged)
    gj = {"type":"FeatureCollection","features":features}
    RUNTIME_OUT.write_text(json.dumps(gj, ensure_ascii=False), encoding='utf-8')
    print('写出:', RUNTIME_OUT)
    return True

def parse_args():
    p = argparse.ArgumentParser(description="生成裁剪后的真实海岸线 GeoJSON (基于 Natural Earth 10m)")
    p.add_argument('--minlon', type=float, default=120.0)
    p.add_argument('--minlat', type=float, default=30.0)
    p.add_argument('--maxlon', type=float, default=122.0)
    p.add_argument('--maxlat', type=float, default=32.0)
    p.add_argument('-o', '--out', type=str, default=DEFAULT_OUT, help='输出 GeoJSON 路径')
    return p.parse_args()

def main():
    global RUNTIME_BBOX, RUNTIME_OUT
    args = parse_args()
    RUNTIME_BBOX = (args.minlon, args.minlat, args.maxlon, args.maxlat)
    RUNTIME_OUT = Path(args.out)
    print('BBox =', RUNTIME_BBOX, '输出 =', RUNTIME_OUT)
    if not ZIP_PATH.exists():
        download()
    shp = extract()
    if not shp or not shp.exists():
        print('缺少 shp 文件，终止')
        return 1
    try:
        ok = build_mask(shp)
    except Exception as e:
        import traceback
        print('构建掩膜异常:', e)
        traceback.print_exc()
        ok = False
    return 0 if ok else 2

if __name__ == '__main__':
    sys.exit(main())
