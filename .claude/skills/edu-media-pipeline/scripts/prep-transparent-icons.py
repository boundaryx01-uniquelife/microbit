"""Make white-background icon PNGs transparent.

Usage: python3 prep-transparent-icons.py <in_dir> <out_dir> [--max 640] [--thresh 28] [--glob 'icon_*.png']
Flood-fills near-white background from the borders -> transparent (inner whites kept),
soft edge, trims to content + small pad, resizes so the long side <= --max. Needs Pillow only.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--max', type=int, default=640)
ap.add_argument('--thresh', type=int, default=28)
ap.add_argument('--glob', default='icon_*.png')
a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
MAGENTA = (255, 0, 255)
for f in sorted(Path(a.src).glob(a.glob)):
    src = Image.open(f).convert('RGBA')
    w, h = src.size
    im = src.convert('RGB')
    mark = im.copy()
    # treat already-transparent pixels as white so they stay transparent
    sa = src.getchannel('A').load(); mp = mark.load()
    for y in range(h):
        for x in range(w):
            if sa[x, y] < 16: mp[x, y] = (255, 255, 255)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        if sum(mark.getpixel(s)) >= 3 * 236:
            ImageDraw.floodfill(mark, s, MAGENTA, thresh=a.thresh)
    mp = mark.load()
    bg = Image.new('L', (w, h), 0); bp = bg.load()
    for y in range(h):
        for x in range(w):
            if mp[x, y] == MAGENTA: bp[x, y] = 255
    alpha = bg.point(lambda v: 255 - v).filter(ImageFilter.GaussianBlur(0.8))
    alpha = Image.composite(alpha, Image.new('L', (w, h), 0), Image.new('L', (w, h), 255))
    # keep original transparency too
    alpha = Image.eval(alpha, lambda v: v)
    ap_ = alpha.load()
    for y in range(h):
        for x in range(w):
            if sa[x, y] < ap_[x, y]: ap_[x, y] = sa[x, y]
    rgba = im.copy(); rgba.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        print(f.name, 'empty, skipped'); continue
    pad = 6
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
    rgba = rgba.crop(box); rgba.thumbnail((a.max, a.max), Image.LANCZOS)
    rgba.save(out / f.name, optimize=True)
    print(f.name, rgba.size)
