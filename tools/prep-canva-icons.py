"""Canva에서 생성·내보낸 아이콘(흰 바탕 정사각형 PNG)을 슬라이드용 투명 PNG로 다듬기.

사용법: python3 tools/prep-canva-icons.py <내보낸 PNG 폴더>
  - 폴더 안의 icon_*.png 를 읽어, 가장자리에서 이어지는 흰 바탕만 투명하게(배경 원·그림 속 흰색은 그대로)
  - 그림 크기에 맞춰 자르고 긴 변 640px로 줄여 bridge/lessons/assets/ 에 저장
Canva 원본: 디자인 'Blank square canvas'(DAHaVftXBJ4) 2~9쪽. 같은 그림체를 위해 생성할 때 기존 아이콘을 기준 이미지로 넣음.
코드로 그리는 도식 아이콘(글자·숫자 포함)은 tools/lesson-icons.html → tools/render-icons.js 로 만듦.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'bridge' / 'lessons' / 'assets'
MAX = 640

for f in sorted(SRC.glob('icon_*.png')):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    # 흰 바탕(밝기 높은 곳)을 가장자리에서부터 채워 배경 마스크 만들기
    mark = im.copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if sum(mark.getpixel(seed)) >= 3 * 236:
            ImageDraw.floodfill(mark, seed, (255, 0, 255), thresh=28)
    bg = Image.eval(mark.split()[1], lambda v: 0)  # 자리만 만들기
    px_m, px_b = mark.load(), bg.load()
    for y in range(h):
        for x in range(w):
            if px_m[x, y] == (255, 0, 255):
                px_b[x, y] = 255
    alpha = Image.eval(bg, lambda v: 255 - v).filter(ImageFilter.GaussianBlur(0.8))   # 가장자리 부드럽게
    rgba = im.copy(); rgba.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    pad = 6
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
    rgba = rgba.crop(box)
    rgba.thumbnail((MAX, MAX), Image.LANCZOS)
    rgba.save(OUT / f.name, optimize=True)
    print(f.name, rgba.size)
