#!/usr/bin/env node
// 수업 슬라이드 JSON(bridge/lessons/data/<id>.json) → PowerPoint(.pptx)
// 사용법:
//   node tools/build-slides.mjs [id]                 # id 없으면 index.json 제외 모든 *.json
//   node tools/build-slides.mjs --in a.json --out b.pptx
// 형식 설명: bridge/lessons/SCHEMA.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'bridge/lessons/data');
const ASSETS = path.join(ROOT, 'bridge/lessons/assets');

// ---------- 디자인 상수 (2차시 승인본과 동일) ----------
const F = '맑은 고딕';
const P = '2456E5', INK = '111827', SUB = '566077', BG = 'F4F6FA', RED = 'E5484D', YEL = 'F2B300',
  GRN = '1FA463', ORG = 'F08A24', GRAY = '7A8499', TINT = 'E6EDFD', WH = 'FFFFFF', DARKCARD = '1F2937';
const COLORS = { blue: P, red: RED, yellow: YEL, green: GRN, orange: ORG, gray: GRAY, ink: INK };
const CYCLE = [P, ORG, GRN, RED, GRAY, YEL];
const X0 = 0.6, W = 12.1, TOP = 1.7, BOT = 6.8; // 본문 영역
const MIN_BODY = 20, MIN_TITLE = 32;

const col = (c, i = 0) => (c && COLORS[c]) || (c && /^[0-9A-Fa-f]{6}$/.test(c) ? c : CYCLE[i % CYCLE.length]);
const onCol = (c) => (c === YEL ? INK : WH);

// ---------- 글자 크기 맞춤 (한글 전각 기준 추정) ----------
function charW(ch, size, bold) {
  const c = ch.codePointAt(0);
  let em;
  if (c >= 0x1100 && (c <= 0x11ff || (c >= 0x2e80 && c <= 0xd7ff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xff60))) em = 1.0;
  else if (c === 32) em = 0.3;
  else if (/[0-9]/.test(ch)) em = 0.58;
  else if (/[A-Z]/.test(ch)) em = 0.66;
  else if (/[a-z]/.test(ch)) em = 0.55;
  else if (/[.,:;'"!|()\[\]·]/.test(ch)) em = 0.4;
  else if (c >= 0x2190 && c <= 0x2bff) em = 1.0; // 화살표·기호
  else em = 0.8;
  return (em * size * (bold ? 1.06 : 1) * 1.03) / 72;
}
const textW = (t, size, bold) => [...t].reduce((a, ch) => a + charW(ch, size, bold), 0);
function lineCount(t, size, bold, w) {
  let n = 0;
  for (const seg of String(t).split('\n')) {
    let cur = 0, lines = 1;
    for (const word of seg.split(' ')) {
      const ww = textW(word, size, bold), sp = charW(' ', size, bold);
      if (ww > w) { // 긴 낱말은 글자 단위로 줄바꿈
        for (const ch of word) { const cw = charW(ch, size, bold); if (cur + cw > w) { lines++; cur = 0; } cur += cw; }
        cur += sp;
      } else if (cur > 0 && cur + ww > w) { lines++; cur = ww + sp; }
      else cur += ww + sp;
    }
    n += lines;
  }
  return n;
}
const warns = [];
let curSlideLabel = '';
// parts: [{t, bold, d(글자 크기 차이), color, gap(pt)}] — 큰 글자부터 줄여 상자에 맞춤
function fit(parts, w, h, max, min, quiet = false) {
  parts = parts.filter((p) => p && p.t !== undefined && p.t !== '');
  const sizeOf = (p, s) => Math.max(min, s + (p.d || 0));
  const heightAt = (s) => parts.reduce((a, p, i) => {
    const sz = sizeOf(p, s);
    return a + lineCount(p.t, sz, p.bold, w) * sz * 1.22 / 72 + (i < parts.length - 1 ? (p.gap || 0) / 72 : 0);
  }, 0);
  let s = max;
  while (s > min && heightAt(s) > h) s--;
  const ok = heightAt(s) <= h + 0.02;
  if (!ok && !quiet) warns.push(`${curSlideLabel}: 글이 상자(${w.toFixed(1)}x${h.toFixed(1)})보다 길어요 → "${String(parts[0].t).slice(0, 20)}"`);
  return { s, parts, sizeOf, ok };
}

// ---------- 그림 크기 ----------
const dimCache = {};
function imgSize(name) {
  if (dimCache[name]) return dimCache[name];
  const f = path.join(ASSETS, name + '.png');
  if (!fs.existsSync(f)) { warns.push(`${curSlideLabel}: 그림 없음 ${name}.png`); return (dimCache[name] = null); }
  const b = fs.readFileSync(f);
  return (dimCache[name] = { f, w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
}

// ---------- 그리기 도구 ----------
function build(data) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: F, bodyFontFace: F };
  pres.title = data.title || data.id;
  const SH = pres.ShapeType;

  const clean = (o) => (typeof o === 'string' ? o.replace(/\*\*/g, '') : Array.isArray(o) ? o.map(clean) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, clean(v)])) : o);
  const slides = clean(data.slides || []);
  const chs = [...new Set(slides.map((s) => s.ch || 1))].sort((a, b) => a - b);
  for (const n of chs) {
    const ft = `피지컬 AI 교실 · ${n}차시`;
    for (const [style, bg, fc] of [['light', WH, SUB], ['cover', P, WH], ['dark', INK, 'C9D1E3']]) {
      pres.defineSlideMaster({
        title: `${style}${n}`, background: { color: bg },
        objects: [{ text: { text: ft, options: { x: 0.6, y: 6.98, w: 6, h: 0.32, fontFace: F, fontSize: 14, color: fc, margin: 0, valign: 'middle' } } }],
        slideNumber: { x: 11.73, y: 6.98, w: 1.0, h: 0.32, fontFace: F, fontSize: 14, color: fc, align: 'right' },
      });
    }
  }

  // 글 상자: parts 를 맞춤 크기로
  function T(s, parts, x, y, w, h, o = {}) {
    if (typeof parts === 'string') parts = [{ t: parts, bold: o.bold }];
    const f = fit(parts.map((p) => ({ bold: o.bold, ...p })), w, h, o.max || 28, o.min || MIN_BODY);
    const runs = f.parts.map((p, i) => ({
      text: String(p.t),
      options: {
        fontSize: f.sizeOf(p, f.s), bold: !!p.bold, color: p.color || o.color || INK, breakLine: i < f.parts.length - 1,
        paraSpaceAfter: i < f.parts.length - 1 ? (p.gap || 0) : 0,
      },
    }));
    s.addText(runs, {
      x, y, w, h, fontFace: F, lang: 'ko-KR', isTextBox: true, margin: 0, valign: o.valign || 'middle', align: o.align || 'left', fit: 'none',
    });
    return f.s;
  }
  // 글 + 작은 설명. 줄이 많아 칸이 낮으면(dense) 가로로 나란히
  const stackedOf = (text, sub) => [{ t: text, bold: true, gap: 2 }, { t: sub, d: -6, color: SUB }];
  const sideLw = (w) => (w - 0.3) * 0.48;
  const sideOk = (text, sub, w, h, max) =>
    fit([{ t: text, bold: true }], sideLw(w), h, max, MIN_BODY, true).ok && fit([{ t: sub, color: SUB }], w - sideLw(w) - 0.3, h, max - 4, MIN_BODY, true).ok;
  const rowOk = (text, sub, w, h, max = 30) =>
    !sub ? fit([{ t: text, bold: true }], w, h, max, MIN_BODY, true).ok : fit(stackedOf(text, sub), w, h, max, MIN_BODY, true).ok || sideOk(text, sub, w, h, max);
  function textSub(s, text, sub, x, y, w, h, dense, max = 30) {
    const stackedOk = fit(stackedOf(text, sub), w, h, max, MIN_BODY, true).ok;
    if (sub && (dense || (!stackedOk && sideOk(text, sub, w, h, max)))) {
      const lw = sideLw(w);
      T(s, [{ t: text, bold: true }], x, y, lw, h, { max });
      T(s, [{ t: sub, color: SUB }], x + lw + 0.3, y, w - lw - 0.3, h, { max: max - 4 });
    } else T(s, stackedOf(text, sub), x, y, w, h, { max });
  }
  const card = (s, x, y, w, h, fill = BG, o = {}) =>
    s.addShape(SH.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.15, ...o });
  // 동그라미(글자가 길면 알약 모양으로 늘어남). 만든 너비를 돌려줌
  function badge(s, t, x, y, d, fill, size = 28, maxW = 2.2) {
    t = String(t ?? '');
    const tc = onCol(fill);
    let sz = size, w = d;
    const need = (z) => textW(t, z, true) * 1.08 + 0.4;
    while (sz > MIN_BODY - 2 && need(sz) > Math.max(d, maxW)) sz--;
    if (t.length > 1) w = Math.min(Math.max(d, need(sz)), Math.max(d, maxW));
    const round = w > d + 0.01;
    s.addText(t, {
      shape: round ? SH.roundRect : SH.ellipse, rectRadius: d / 2, x, y, w, h: d, fill: { color: fill }, line: { color: fill, width: 0 },
      fontFace: F, lang: 'ko-KR', fontSize: sz, bold: true, color: tc, align: 'center', valign: 'middle', margin: 0, isTextBox: true, wrap: false,
    });
    return w;
  }
  const arrow = (s, x, y, w, h, c = P) => s.addShape(SH.rightArrow, { x, y, w, h, fill: { color: c }, line: { color: c, width: 0 } });
  const checkbox = (s, x, y, d, c = P) =>
    s.addShape(SH.roundRect, { x, y, w: d, h: d, fill: { color: WH }, line: { color: c, width: 3 }, rectRadius: 0.06 });

  function img(s, name, x, y, w, h, align = 'center') {
    const d = imgSize(name);
    if (!d) { card(s, x, y, w, h, BG); return null; }
    const pad = 0.06, aw = w - pad * 2, ah = h - pad * 2, r = d.w / d.h;
    let Wd = aw, Hd = aw / r;
    if (Hd > ah) { Hd = ah; Wd = ah * r; }
    const X = align === 'left' ? x + pad : align === 'right' ? x + w - pad - Wd : x + (w - Wd) / 2, Y = y + (h - Hd) / 2;
    s.addShape(SH.roundRect, {
      x: X - pad, y: Y - pad, w: Wd + pad * 2, h: Hd + pad * 2, fill: { color: WH }, line: { color: 'D5DBE8', width: 1 }, rectRadius: 0.08,
      shadow: { type: 'outer', color: '000000', opacity: 0.15, blur: 8, offset: 2, angle: 90 },
    });
    s.addImage({ path: d.f, x: X, y: Y, w: Wd, h: Hd, altText: name });
    return { X, Y, W: Wd, H: Hd };
  }
  function title(s, t, color = INK) {
    T(s, [{ t, bold: true }], X0, 0.4, W, 0.95, { max: 40, min: MIN_TITLE, color });
  }
  // 번호/글 줄 목록 (goals, core, checklist 목록형, points 공통)
  function rowGeom(n, availH, capOverride) {
    const gap = n > 4 ? 0.1 : 0.25;
    const cap = capOverride || (n <= 2 ? 1.9 : n === 3 ? 1.7 : 1.45);
    const h = Math.min(cap, (availH - gap * (n - 1)) / n);
    return { gap, h };
  }

  const R = {}; // 형식별 그리기

  R.cover = (s, d) => {
    const hasImg = !!d.image;
    const tw = hasImg ? 6.0 : 11.5;
    T(s, [{ t: d.title || '', bold: true }], 0.7, 1.9, tw, 2.3, { max: 54, min: MIN_TITLE, color: WH, valign: 'bottom' });
    if (d.sub) T(s, [{ t: d.sub }], 0.7, 4.4, tw, 1.2, { max: 30, color: 'DCE6FF', valign: 'top' });
    if (hasImg) img(s, d.image, 6.9, 1.35, 5.9, 4.4, 'center');
  };

  function numberedRows(s, items, { dark = false, x = X0, y0 = 1.75, w = W, availH = 5.0, max = 32, startColor = P } = {}) {
    const n = items.length, { gap, h } = rowGeom(n, availH);
    items.forEach((t, i) => {
      const y = y0 + i * (h + gap);
      card(s, x, y, w, h, dark ? DARKCARD : BG);
      const bd = Math.min(0.9, h - 0.3);
      badge(s, i + 1, x + 0.35, y + (h - bd) / 2, bd, startColor, Math.min(34, bd * 38));
      T(s, [{ t, bold: true }], x + 0.35 + bd + 0.4, y + 0.08, w - bd - 1.1, h - 0.16, { max, color: dark ? WH : INK });
    });
  }
  R.goals = (s, d) => { title(s, d.title || '오늘의 목표'); numberedRows(s, d.items || []); };
  R.core = (s, d) => { title(s, d.title || '오늘의 핵심', WH); numberedRows(s, d.items || [], { dark: true, max: 30 }); };

  R.points = (s, d) => {
    title(s, d.title);
    const items = d.items || [], n = items.length;
    const hasImg = !!d.image, left = d.imageSide === 'left';
    const footH0 = d.footer ? 0.85 : 0, rh0 = rowGeom(n, BOT - TOP - footH0, n <= 3 ? 1.6 : 1.4).h;
    let imgW = 5.4;
    if (hasImg) for (const iw of [5.4, 4.6, 4.0, 3.5]) { imgW = iw; const w = W - iw - 0.4 - 0.3 - 0.85 - 0.3 - 0.25; if (items.every((it) => rowOk(it.text, it.sub, w, rh0 - 0.12, 30))) break; }
    const listW = hasImg ? W - imgW - 0.4 : W;
    const listX = hasImg && left ? X0 + imgW + 0.4 : X0, imgX = left ? X0 : X0 + listW + 0.4;
    const footH = d.footer ? 0.85 : 0, availH = BOT - TOP - footH;
    const { gap, h } = rowGeom(n, availH, n <= 3 ? 1.6 : 1.4);
    const oy = hasImg ? Math.max(0, (availH - (h * n + gap * (n - 1))) / 2) : 0;
    items.forEach((it, i) => {
      const y = TOP + oy + i * (h + gap), c = col(it.color, i);
      card(s, listX, y, listW, h, BG);
      const bd = Math.min(0.85, h - 0.3);
      const bw = badge(s, it.badge ?? i + 1, listX + 0.3, y + (h - bd) / 2, bd, c, Math.max(20, Math.min(30, bd * 36)), 1.5);
      const tx = listX + 0.3 + bw + 0.3;
      textSub(s, it.text, it.sub, tx, y + 0.06, listX + listW - tx - 0.25, h - 0.12, false);
    });
    if (hasImg) img(s, d.image, imgX, TOP, imgW, availH, 'center');
    if (d.footer) {
      card(s, X0, BOT - 0.65, W, 0.65, TINT);
      T(s, [{ t: d.footer, bold: true }], X0 + 0.3, BOT - 0.65, W - 0.6, 0.65, { max: 24, color: P });
    }
  };

  R.cards = (s, d) => {
    title(s, d.title);
    const cs = d.cards || [], n = cs.length;
    const footH = d.footer ? 0.85 : 0, ch = BOT - TOP - footH + 0 - 0.05, gap = 0.3;
    const cw = (W - gap * (n - 1)) / n;
    cs.forEach((c, i) => {
      const x = X0 + i * (cw + gap), cl = col(c.color, i);
      card(s, x, TOP, cw, ch, BG);
      let y = TOP + 0.2;
      if (c.icon) {
        const di = imgSize(c.icon);
        if (di) { const ih = 1.0, iw = Math.min(cw - 0.6, ih * di.w / di.h); s.addImage({ path: di.f, x: x + (cw - iw) / 2, y, w: iw, h: ih, altText: c.head }); y += ih + 0.1; }
      }
      if (!c.icon && c.badge !== undefined && c.badge !== '') {
        const bd = 0.8, bw = badge(s, c.badge, x + (cw - bd) / 2, y, bd, cl, 30, cw - 0.4);
        // 알약이면 가운데 다시 맞춤
        if (bw > bd) { /* 위에서 x 고정 — 필요 시 좌측 정렬 */ }
        y += bd + 0.15;
      }
      const hasB = !c.icon && c.badge !== undefined && c.badge !== '';
      const need = lineCount(c.head, 30, true, cw - 0.6) * 30 * 1.22 / 72 + 0.3;
      const headH = Math.max(0.85, Math.min(hasB ? 1.05 : 1.3, need));
      s.addShape(SH.roundRect, { x: x + 0.2, y, w: cw - 0.4, h: headH, fill: { color: cl }, line: { color: cl, width: 0 }, rectRadius: 0.15 });
      T(s, [{ t: c.head, bold: true }], x + 0.3, y, cw - 0.6, headH, { max: 36, color: onCol(cl), align: 'center' });
      y += headH + 0.2;
      const lines = c.lines || [];
      if (lines.length) {
        const ly = y, lh = TOP + ch - 0.2 - ly;
        const gp = 8;
        const parts = lines.map((t) => ({ t, gap: gp }));
        T(s, parts, x + 0.25, ly, cw - 0.5, lh, { max: 28, valign: 'top', align: cw < 3.2 ? 'left' : 'center' });
      }
    });
    if (d.footer) {
      card(s, X0, BOT - 0.65, W, 0.65, TINT);
      T(s, [{ t: d.footer, bold: true }], X0 + 0.3, BOT - 0.65, W - 0.6, 0.65, { max: 24, color: P });
    }
  };

  R.flow = (s, d) => {
    title(s, d.title);
    const nodes = d.nodes || [], n = nodes.length;
    const strip = d.strip || [], hasStrip = strip.length > 0, hasImg = !!d.image;
    const x0 = n >= 5 ? 0.4 : X0, span = n >= 5 ? 12.5 : W, g = n >= 5 ? 0.35 : 0.55;
    const nw = (span - g * (n - 1)) / n;
    const extras = hasStrip || hasImg ? 2.15 : 0, loopH = d.loop ? 0.75 : 0;
    const nh = Math.min(3.4, BOT - 1.6 - extras - loopH);
    const ny = 1.6 + (extras ? 0 : Math.max(0, (BOT - 1.6 - loopH - nh) / 2));
    nodes.forEach((nd, i) => {
      const x = x0 + i * (nw + g), c = col(nd.color, i);
      s.addShape(SH.roundRect, { x, y: ny, w: nw, h: nh, fill: { color: BG }, line: { color: c, width: 3 }, rectRadius: 0.15 });
      let y = ny + 0.2;
      if (nd.tag) {
        const tw = Math.min(nw - 0.3, 2.2);
        const bw = badge(s, nd.tag, x + (nw - Math.min(nw - 0.3, Math.max(0.9, textW(nd.tag, 22, true) + 0.4))) / 2, y, 0.55, c, 22, nw - 0.3);
        void tw; void bw;
        y += 0.55 + 0.15;
      }
      T(s, [{ t: nd.label, bold: true, gap: 4 }, { t: nd.sub, d: -4, color: SUB }], x + 0.18, y, nw - 0.36, ny + nh - 0.15 - y, { max: 28, align: 'center' });
      if (i < n - 1) arrow(s, x + nw + 0.04, ny + nh / 2 - 0.2, g - 0.08, 0.4, P);
    });
    if (d.loop && n > 1) {
      const lx1 = x0 + (n - 1) * (nw + g) + nw / 2, lx0 = x0 + nw / 2, yb = ny + nh, yl = yb + 0.5;
      const ln = { color: P, width: 4 };
      s.addShape(SH.line, { x: lx1, y: yb, w: 0, h: 0.5, line: ln });
      s.addShape(SH.line, { x: lx0, y: yl, w: lx1 - lx0, h: 0, line: ln });
      s.addShape(SH.line, { x: lx0, y: yb, w: 0, h: 0.5, line: { ...ln, beginArrowType: 'triangle' } });
      const lw = 2.6, lt = d.loopLabel || '처음으로 돌아가요';
      s.addText(lt, { shape: SH.roundRect, rectRadius: 0.1, x: (lx0 + lx1) / 2 - lw / 2, y: yl - 0.27, w: lw, h: 0.54, fill: { color: WH }, line: { color: P, width: 2 }, fontFace: F, fontSize: 20, bold: true, color: P, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    }
    const sy = BOT - 1.85;
    if (hasStrip) {
      const sw = hasImg ? 8.4 : W, k = strip.length, ag = 0.55, pad = 0.25;
      card(s, X0, sy, sw, 1.85, TINT);
      const iw = (sw - pad * 2 - ag * (k - 1)) / k;
      strip.forEach((t, i) => {
        const x = X0 + pad + i * (iw + ag);
        T(s, [{ t, bold: true }], x, sy + 0.1, iw, 1.65, { max: 28, align: 'center' });
        if (i < k - 1) arrow(s, x + iw + 0.06, sy + 1.85 / 2 - 0.25, ag - 0.12, 0.5, P);
      });
      if (hasImg) img(s, d.image, 9.2, sy - 0.05, 3.5, 1.95, 'right');
    } else if (hasImg) img(s, d.image, X0, sy - 0.1, W, 2.0, 'center');
  };

  R.question = (s, d) => {
    title(s, d.title);
    const hasImg = !!d.image, cw = hasImg ? 6.0 : W, ch = BOT - TOP - 0.1;
    card(s, X0, TOP, cw, ch, P);
    const bigOnly = String(d.big).trim() === '?';
    const qd = bigOnly ? 0 : hasImg ? 1.2 : 1.4;
    if (!bigOnly) s.addText('?', { shape: SH.ellipse, x: X0 + (cw - qd) / 2, y: TOP + 0.3, w: qd, h: qd, fill: { color: WH }, line: { color: WH, width: 0 }, fontFace: F, fontSize: 60, bold: true, color: P, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    const by = TOP + 0.3 + (qd ? qd + 0.2 : 0), bh = TOP + ch - 0.3 - by;
    const subH = d.sub ? Math.min(1.1, bh * 0.3) : 0;
    T(s, [{ t: d.big, bold: true }], X0 + 0.4, by, cw - 0.8, bh - subH - (subH ? 0.1 : 0), { max: bigOnly ? 200 : hasImg ? 48 : 54, min: 28, color: WH, align: 'center' });
    if (d.sub) T(s, [{ t: d.sub }], X0 + 0.4, TOP + ch - 0.3 - subH, cw - 0.8, subH, { max: 26, color: 'DCE6FF', align: 'center' });
    if (hasImg) {
      const r = img(s, d.image, X0 + cw + 0.4, TOP, W - cw - 0.4, ch, 'center');
      if (r && d.caption) {
        const cy = r.Y + r.H - 1.15;
        s.addText(d.caption, { shape: SH.roundRect, rectRadius: 0.12, x: r.X + 0.2, y: cy, w: r.W - 0.4, h: 0.95, fill: { color: INK }, line: { color: INK, width: 0 }, fontFace: F, lang: 'ko-KR', fontSize: 24, bold: true, color: WH, align: 'center', valign: 'middle', margin: 0.05, isTextBox: true });
      }
    }
  };

  R.image = (s, d) => {
    title(s, d.title);
    const pts = d.points || [], hasSide = pts.length > 0 || !!d.callout, ah = BOT - TOP - 0.05;
    if (!hasSide) { img(s, d.image, X0, TOP, W, ah, 'center'); return; }
    const many = pts.length >= 5, gap = many ? 0.12 : 0.2;
    const iw = many ? 5.0 : pts.length >= 4 ? 5.2 : pts.length >= 3 ? 6.0 : 7.5, sx = X0 + iw + 0.4, sw = W - iw - 0.4;
    if (many) {
      // 줄이 많으면: 왼쪽에 그림+강조 글, 오른쪽에 체크 목록
      const ch = d.callout ? 1.0 : 0;
      img(s, d.image, X0, TOP, iw, ah - (ch ? ch + 0.2 : 0), 'center');
      if (ch) {
        card(s, X0, TOP + ah - ch, iw, ch, P);
        T(s, [{ t: d.callout, bold: true }], X0 + 0.2, TOP + ah - ch + 0.05, iw - 0.4, ch - 0.1, { max: 26, color: WH, align: 'center' });
      }
      const n = pts.length, h = Math.min(1.1, (ah - gap * (n - 1)) / n);
      pts.forEach((t, i) => {
        const y = TOP + i * (h + gap);
        card(s, sx, y, sw, h, BG);
        const cd = Math.min(0.4, h - 0.2);
        checkbox(s, sx + 0.25, y + (h - cd) / 2, cd, P);
        T(s, [{ t, bold: true }], sx + 0.25 + cd + 0.25, y + 0.03, sw - cd - 0.75, h - 0.06, { max: 26 });
      });
      return;
    }
    img(s, d.image, X0, TOP, iw, ah, 'center');
    const ch = d.callout ? (pts.length >= 3 ? 1.2 : pts.length ? 1.7 : 2.4) : 0;
    const pa = ah - (ch ? ch + gap : 0);
    if (pts.length) {
      const n = pts.length, h = Math.min(1.3, (pa - gap * (n - 1)) / n);
      pts.forEach((t, i) => {
        const y = TOP + i * (h + gap);
        card(s, sx, y, sw, h, BG);
        s.addShape(SH.ellipse, { x: sx + 0.25, y: y + h / 2 - 0.13, w: 0.26, h: 0.26, fill: { color: col(null, i) }, line: { color: WH, width: 0 } });
        T(s, [{ t, bold: true }], sx + 0.7, y + 0.05, sw - 0.9, h - 0.1, { max: 26 });
      });
    }
    if (ch) {
      const y = TOP + ah - ch;
      card(s, sx, y, sw, ch, P);
      T(s, [{ t: d.callout, bold: true }], sx + 0.25, y + 0.1, sw - 0.5, ch - 0.2, { max: 30, color: WH, align: 'center' });
    }
  };

  R.table = (s, d) => {
    title(s, d.title);
    const rows = d.rows || [], n = rows.length, hasImg = !!d.image;
    const imgW = 5.3, rx = hasImg ? X0 + imgW + 0.4 : X0, rw = hasImg ? W - imgW - 0.4 : W;
    const gap = n > 4 ? 0.15 : 0.22, h = Math.min(1.3, (BOT - TOP - gap * (n - 1)) / n);
    const aw = 0.55, anyBadge = rows.some((r) => r.badge !== undefined && r.badge !== '');
    rows.forEach((r, i) => {
      const y = TOP + i * (h + gap), c = col(r.color, i);
      card(s, rx, y, rw, h, BG);
      const bd = Math.min(0.74, h - 0.3);
      let tx = rx + 0.25;
      if (anyBadge) { const bw = r.badge !== undefined && r.badge !== '' ? badge(s, r.badge, tx, y + (h - bd) / 2, bd, c, 26, 1.2) : 0; tx += (bw || bd) + 0.2; }
      const inner = rx + rw - 0.25 - tx, lw = (inner - aw - 0.3) * 0.38, rw2 = inner - aw - 0.3 - lw;
      T(s, [{ t: r.left, bold: true }], tx, y + 0.05, lw, h - 0.1, { max: 28 });
      arrow(s, tx + lw + 0.1, y + h / 2 - 0.18, aw, 0.36, SUB);
      T(s, [{ t: r.right, bold: true }], tx + lw + aw + 0.3, y + 0.05, rw2, h - 0.1, { max: 28 });
    });
    if (hasImg) img(s, d.image, X0, TOP, imgW, BOT - TOP, 'center');
  };

  R.code = (s, d) => {
    title(s, d.title);
    const steps = d.steps || [], n = steps.length, hasImg = !!d.image, hasTip = !!d.tip;
    const top = n >= 4 ? 1.5 : TOP;
    const tipH = hasTip ? 0.9 : 0, availH = BOT - top - (hasTip ? tipH + 0.2 : 0);
    const rh = rowGeom(n, availH, n <= 3 ? 1.5 : 1.25).h;
    let imgW = 5.8;
    if (hasImg) for (const iw of [5.8, 5.0, 4.4, 3.8]) { imgW = iw; const w = W - iw - 0.4 - 0.25 * 2 - 0.75 - 0.3 - 0.25; if (steps.every((st) => rowOk(st.text, st.sub, w, rh - 0.1, 28))) break; }
    const lw = hasImg ? W - imgW - 0.4 : W;
    const { gap, h } = rowGeom(n, availH, n <= 3 ? 1.5 : 1.25);
    steps.forEach((st, i) => {
      const y = top + i * (h + gap);
      card(s, X0, y, lw, h, BG);
      const bd = Math.min(0.75, h - 0.3);
      badge(s, i + 1, X0 + 0.25, y + (h - bd) / 2, bd, P, 28);
      textSub(s, st.text, st.sub, X0 + 0.25 + bd + 0.3, y + 0.05, lw - bd - 0.85, h - 0.1, false, 28);
    });
    if (hasImg) img(s, d.image, X0 + lw + 0.4, top, imgW, availH, 'center');
    if (hasTip) {
      const y = BOT - tipH;
      card(s, X0, y, W, tipH, TINT);
      const bw = badge(s, '팁', X0 + 0.3, y + (tipH - 0.6) / 2, 0.6, ORG, 22);
      T(s, [{ t: d.tip, bold: true }], X0 + 0.3 + bw + 0.3, y + 0.05, W - bw - 1.2, tipH - 0.1, { max: 26, color: INK });
    }
  };

  R.checklist = (s, d) => {
    title(s, d.title);
    const items = d.items || [], n = items.length;
    const grid = n >= 4, cols = grid ? 2 : 1, rowsN = Math.ceil(n / cols), gx = 0.3, gy = grid ? 0.3 : 0.25;
    const cw = (W - gx * (cols - 1)) / cols, avail = grid ? 5.0 : 5.0;
    const h = Math.min(grid ? 2.3 : 1.5, (avail - gy * (rowsN - 1)) / rowsN);
    items.forEach((t, i) => {
      const x = X0 + (i % cols) * (cw + gx), y = 1.75 + Math.floor(i / cols) * (h + gy);
      card(s, x, y, cw, h, BG);
      const cd = Math.min(0.8, h - 0.4);
      checkbox(s, x + 0.35, y + (h - cd) / 2, cd, P);
      T(s, [{ t, bold: true }], x + 0.35 + cd + 0.35, y + 0.08, cw - cd - 1.0, h - 0.16, { max: 30 });
    });
  };

  // ---------- 슬라이드 만들기 ----------
  slides.forEach((d, idx) => {
    const ch = d.ch || 1, type = d.type;
    curSlideLabel = `슬라이드 ${idx + 1}(${type})`;
    let r = R[type];
    if (!r) { warns.push(`${curSlideLabel}: 알 수 없는 type → 제목만 표시`); r = (s, dd) => title(s, dd.title || ''); }
    const style = type === 'cover' ? 'cover' : type === 'core' ? 'dark' : 'light';
    const s = pres.addSlide({ masterName: `${style}${ch}` });
    s.addNotes(d.notes || '');
    r(s, d);
  });
  return pres;
}

// ---------- 실행 ----------
async function run(inFile, outFile) {
  const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  warns.length = 0;
  const pres = build(data);
  const out = outFile || path.join(ROOT, 'materials', data.pkg || data.id, `${data.id}_수업슬라이드.pptx`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await pres.writeFile({ fileName: out });
  console.log(`${path.relative(process.cwd(), out)}  (${(data.slides || []).length}장)`);
  for (const w of warns) console.warn('  주의: ' + w);
}

const args = process.argv.slice(2);
let inF, outF, id;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--in') inF = args[++i];
  else if (args[i] === '--out') outF = args[++i];
  else id = args[i];
}
if (inF) await run(path.resolve(inF), outF && path.resolve(outF));
else {
  const ids = id ? [id] : fs.readdirSync(DATA).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.replace(/\.json$/, ''));
  if (!ids.length) { console.error('data 폴더에 슬라이드 JSON 이 없어요: ' + DATA); process.exit(1); }
  for (const i of ids) await run(path.join(DATA, i + '.json'));
}
