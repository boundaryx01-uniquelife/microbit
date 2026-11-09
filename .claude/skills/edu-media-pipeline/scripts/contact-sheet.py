"""Tile images into one PNG for quick review.

Usage: python3 contact-sheet.py <out.png> <img1> <img2> ... [--cols 4] [--cell 400x300] [--label]
Images are fit inside each cell (aspect kept) on a checker-free grey background; --label adds filenames.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('imgs', nargs='+')
ap.add_argument('--cols', type=int, default=4)
ap.add_argument('--cell', default='400x300')
ap.add_argument('--label', action='store_true')
a = ap.parse_args()
cw, ch = map(int, a.cell.split('x'))
lab = 18 if a.label else 0
rows = (len(a.imgs) + a.cols - 1) // a.cols
sheet = Image.new('RGB', (a.cols * cw, rows * (ch + lab)), (60, 60, 64))
d = ImageDraw.Draw(sheet)
for i, p in enumerate(a.imgs):
    im = Image.open(p).convert('RGBA'); im.thumbnail((cw - 6, ch - 6), Image.LANCZOS)
    x, y = (i % a.cols) * cw, (i // a.cols) * (ch + lab)
    sheet.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2), im)
    if a.label: d.text((x + 4, y + ch + 3), Path(p).name[:cw // 6], fill=(230, 230, 230))
sheet.save(a.out); print(a.out, sheet.size)
