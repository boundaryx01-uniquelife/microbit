// 지도 라이브러리(순수 데이터·함수, DOM 없음) — 교구와 무관. props.js 의 소품 모델을 씀.
//  map = { id, title, level(1~4), size{w,h}, props{boxes,objects,chips,tracks}, start{x,y,heading}, source, note, tiles? }
//  좌표는 props.js 와 같음(cm, x 오른쪽 · y 아래 · heading 0=위 시계 +).
import { normalizeProps, trackPreset, pointAlong, trackLength, startOnTrack, emptyProps } from './props.js';

const RAD = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;

export const LEVELS = { 1: '레벨 1 · 입문', 2: '레벨 2 · 기본 곡선', 3: '레벨 3 · 끊긴 선·교차로·급커브', 4: '레벨 4 · 대회형 연습장' };
export const RCJ_URL = 'https://www.robocupap.org/RCAP2025_Rules/Rescue-Line-Entry-Rules-2025.pdf';
export const RCJ_LABEL = '규칙 문서(RoboCupJunior Rescue Line Entry 2025, RCAP) 수치로 재구성한 연습장 — 공식 대회 맵 아님';
export const RCJ = { tile: 30, lineWidth: 1.8, marker: 2.5, gapMax: 20, gapStraightMin: 5, edgeMin: 10 };

// ------------------------------------------------------------
// 타일 (한 칸 = 30cm). 조각은 칸 안 좌표(0..30), r = 시계 방향 90° 회전 횟수
// ------------------------------------------------------------
const arcPts = (cx, cy, a0, a1, rad = 15, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * RAD; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
export const TILE_TYPES = [
  { id: 'empty', code: '.', ko: '빈칸', pieces: [] },
  { id: 'line', code: 'I', ko: '직선', pieces: [[[15, 0], [15, 30]]] },
  { id: 'curve', code: 'C', ko: '곡선', pieces: [arcPts(30, 0, 180, 90)] },
  { id: 'gap', code: 'G', ko: '끊긴 직선', pieces: [[[15, 0], [15, 7]], [[15, 23], [15, 30]]] },
  { id: 'tee', code: 'T', ko: 'T 교차로', pieces: [[[0, 15], [30, 15]], [[15, 15], [15, 30]]] },
  { id: 'cross', code: 'X', ko: '+ 교차로', pieces: [[[15, 0], [15, 30]], [[0, 15], [30, 15]]] },
  { id: 'zigzag', code: 'Z', ko: '지그재그', pieces: [[[15, 0], [15, 6], [6, 11], [24, 19], [15, 24], [15, 30]]] },
  { id: 'start', code: 'S', ko: '시작', pieces: [[[15, 15], [15, 0]]] },
  { id: 'goal', code: 'E', ko: '도착', pieces: [[[15, 0], [15, 15]]] },
];
const TT = Object.fromEntries(TILE_TYPES.map(t => [t.id, t]));
const BY_CODE = Object.fromEntries(TILE_TYPES.map(t => [t.code, t.id]));
const rot = (p, r) => { let [x, y] = p; for (let i = 0; i < ((r % 4) + 4) % 4; i++) [x, y] = [30 - y, x]; return [x, y]; };

// 글자 격자 → 칸 배열. 예: ['S1 I1 G1', '. . .'] (코드+회전)
export function parseGrid(rows) {
  const cells = rows.map(row => row.trim().split(/\s+/).map(tok => (tok === '.' ? { t: 'empty', r: 0 } : { t: BY_CODE[tok[0]] || 'empty', r: +tok.slice(1) || 0 })));
  return { cols: Math.max(...cells.map(r => r.length)), rows: cells.length, cells };
}
export function emptyGrid(cols, rows) { return { cols, rows, cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ t: 'empty', r: 0 }))) }; }
export function normalizeGrid(g) {
  if (!g || !Array.isArray(g.cells)) return null;
  const rows = Math.min(12, g.cells.length), cols = Math.min(12, Math.max(...g.cells.map(r => (Array.isArray(r) ? r.length : 0)), 0));
  if (!rows || !cols) return null;
  const out = emptyGrid(cols, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const c = (g.cells[y] || [])[x]; if (c && TT[c.t]) out.cells[y][x] = { t: c.t, r: ((+c.r || 0) % 4 + 4) % 4 }; }
  return out;
}

// 작은 조각들을 끝점이 같으면 하나의 선으로 이음(끝점에 딱 2개만 만날 때). 시작과 끝이 만나면 닫힌 선
function mergePieces(pieces) {
  const list = pieces.map(p => p.map(q => q.slice())), same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;
  const degree = (pt) => list.reduce((n, p) => n + (same(p[0], pt) ? 1 : 0) + (same(p[p.length - 1], pt) ? 1 : 0), 0);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      for (const [ra, rb] of [[false, false], [false, true], [true, false], [true, true]]) {
        const A = ra ? list[i].slice().reverse() : list[i], B = rb ? list[j].slice().reverse() : list[j];
        if (same(A[A.length - 1], B[0]) && degree(A[A.length - 1]) === 2) { list[i] = A.concat(B.slice(1)); list.splice(j, 1); changed = true; break outer; }
      }
    }
  }
  return list.map(p => { const closed = p.length > 3 && same(p[0], p[p.length - 1]); return { pts: (closed ? p.slice(0, -1) : p).map(q => [r2(q[0]), r2(q[1])]), closed }; });
}
// 칸 격자 → { size, tracks, chips, start }. 선은 칸 가장자리 가운데에서 이어짐
export function compileTiles(grid, { tile = 30, width = 1.8 } = {}) {
  const k = tile / 30, pieces = [], chips = [];
  let start = null;
  grid.cells.forEach((row, cy) => row.forEach((c, cx) => {
    const T = TT[c.t]; if (!T || c.t === 'empty') return;
    const map = (p) => { const q = rot(p, c.r); return [(cx * 30 + q[0]) * k, (cy * 30 + q[1]) * k]; };
    for (const pc of T.pieces) pieces.push(pc.map(map));
    if (c.t === 'start' && !start) { const m = map([15, 15]); start = { x: m[0], y: m[1], heading: (c.r % 4) * 90 }; }
    if (c.t === 'goal') { const m = map([15, 15]); chips.push({ x: r2(m[0] - 6 * k), y: r2(m[1] - 6 * k), w: 12 * k, h: 12 * k, color: 'blue' }); }
  }));
  const tracks = mergePieces(pieces).map(t => ({ pts: t.pts, closed: t.closed, width }));
  if (!start && tracks.length) start = startOnTrack(tracks[0]) || { x: tracks[0].pts[0][0], y: tracks[0].pts[0][1], heading: 0 };
  return { size: { w: grid.cols * tile, h: grid.rows * tile }, tracks, chips, start: start || { x: grid.cols * tile / 2, y: grid.rows * tile / 2, heading: 0 } };
}

// 초록 표식(2.5cm): 교차로 중심(cx,cy) 바로 앞(접근 방향 heading), 돌 쪽(side 'L'|'R') 선 옆에 붙여 놓은 칩
export function greenMarker(cx, cy, heading, side, { lineWidth = RCJ.lineWidth, size = RCJ.marker } = {}) {
  const dx = Math.sin(heading * RAD), dy = -Math.cos(heading * RAD), nx = side === 'L' ? dy : -dy, ny = side === 'L' ? -dx : dx;
  const back = lineWidth / 2 + 1.6 + size / 2, lat = lineWidth / 2 + 0.5 + size / 2;
  return { x: r2(cx - dx * back + nx * lat - size / 2), y: r2(cy - dy * back + ny * lat - size / 2), w: size, h: size, color: 'green' };
}

// ------------------------------------------------------------
// 내장 지도
// ------------------------------------------------------------
const T = (pts, width = 4, closed = false) => ({ pts, closed, width });
const fromPreset = (kind, w, h, frac) => {
  const t = trackPreset(kind, w, h, { width: 4, steps: 6 });
  const start = frac != null ? pointAlong(t, trackLength(t) * frac) : startOnTrack(t);
  return { size: { w, h }, props: { tracks: [t] }, start: { x: r2(start.x), y: r2(start.y), heading: r2(start.heading) } };
};
const fromTiles = (rows, extra) => {
  const g = parseGrid(rows), c = compileTiles(g, RCJ);
  const ex = extra ? extra(g) : {};
  return { size: c.size, props: { tracks: c.tracks, chips: c.chips.concat(ex.chips || []), boxes: ex.boxes || [] }, start: c.start, tiles: g };
};
const RCJ_NOTE = `${RCJ_LABEL}. 칸 30cm, 하얀 바닥, 검은 선 1.8cm(규칙 1~2cm), 선은 가장자리에서 10cm 이상, 초록 표식 25mm×25mm. 포니봇 컬러 센서는 한 점이라 선 옆 표식은 로봇이 옆으로 비껴야 보여요.`;

export const MAP_DEFS = [
  { id: 'l1-straight', level: 1, title: '직선 달리기', build: () => ({ size: { w: 100, h: 240 }, props: { tracks: [T([[50, 215], [50, 25]])] }, start: { x: 50, y: 195, heading: 0 } }) },
  { id: 'l1-oval', level: 1, title: '큰 타원', build: () => fromPreset('oval', 240, 160) },
  { id: 'l2-figure8', level: 2, title: '8자', build: () => fromPreset('figure8', 240, 160, 0.1) },
  { id: 'l2-scurve', level: 2, title: 'S자 곡선', build: () => fromPreset('scurve', 200, 260) },
  { id: 'l2-square', level: 2, title: '직각 코너 사각형', build: () => fromPreset('square', 200, 200) },
  { id: 'l3-gaps', level: 3, title: '끊긴 선 (틈 18cm)', note: '틈 앞뒤에 곧은 선이 60cm쯤 있어요. 틈에서는 라인 센서가 0,0 이에요 — 직진해서 건너 보세요.',
    build: () => ({ size: { w: 100, h: 300 }, props: { tracks: [T([[50, 280], [50, 210]]), T([[50, 192], [50, 130]]), T([[50, 112], [50, 25]])] }, start: { x: 50, y: 262, heading: 0 } }) },
  { id: 'l3-cross', level: 3, title: '직각 교차로 (표식 없으면 직진)', note: '교차로에는 초록 표식이 없어요 → 그냥 직진해야 해요. 끝은 파란 칸.',
    build: () => ({ size: { w: 200, h: 240 }, props: { tracks: [T([[100, 225], [100, 20]]), T([[20, 110], [180, 110]])], chips: [{ x: 94, y: 20, w: 12, h: 12, color: 'blue' }] }, start: { x: 100, y: 200, heading: 0 } }) },
  { id: 'l3-zigzag', level: 3, title: '지그재그·급커브', build: () => ({ size: { w: 240, h: 200 }, props: { tracks: [T([[30, 175], [30, 120], [90, 120], [90, 60], [150, 60], [150, 135], [210, 135], [210, 30]])] }, start: { x: 30, y: 160, heading: 0 } }) },
  { id: 'l4-rcj-a', level: 4, title: 'RCJ Entry 연습 A · 끊긴 선과 곡선', source: RCJ_URL, note: RCJ_NOTE,
    build: () => fromTiles(['. . . . .', 'S1 I1 G1 I1 C2', '. . . . I0', 'E1 I1 I1 I1 C3']) },
  { id: 'l4-rcj-b', level: 4, title: 'RCJ Entry 연습 B · T 교차로와 초록 표식', source: RCJ_URL, note: RCJ_NOTE + ' T 교차로 앞 왼쪽에 초록 표식 하나 = 왼쪽(위)으로 꺾기. 마지막 + 교차로는 표식이 없어 직진.',
    build: () => fromTiles(['. . C1 I1 C2 .', '. . I0 . I0 .', 'S1 I1 T2 I1 X .', '. . . . E0 .'], () => ({ chips: [greenMarker(75, 75, 90, 'L')] })) },
  { id: 'l4-rcj-c', level: 4, title: 'RCJ Entry 연습 C · 장애물과 초록 표식', source: RCJ_URL, note: RCJ_NOTE + ' 선 위 장애물(10×10cm, 가장자리·다른 선에서 25cm 이상)을 비켜 가고, + 교차로 앞 오른쪽 표식 하나 = 오른쪽(아래)으로 꺾기.',
    build: () => fromTiles(['. . . . . . .', 'S1 I1 I1 I1 X . .', '. . . . I0 . .', '. . E3 I1 C3 . .'], () => ({ chips: [greenMarker(135, 45, 90, 'R')], boxes: [{ x: 70, y: 40, w: 10, h: 10 }] })) },
];
export const MAP_LIST = MAP_DEFS.map(d => ({ id: d.id, level: d.level, title: d.title }));

export function buildMap(id) {
  const d = MAP_DEFS.find(x => x.id === id); if (!d) return null;
  const m = d.build();
  return { id: d.id, title: d.title, level: d.level, size: m.size, props: normalizeProps({ ...emptyProps(), ...m.props }), start: m.start, source: d.source || '', note: d.note || '', tiles: m.tiles || null };
}

// ------------------------------------------------------------
// 지도 글(JSON) — 선생님이 파일로 나눌 때
// ------------------------------------------------------------
export function normalizeMap(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sz = raw.size || {}, w = +sz.w, h = +sz.h;
  if (!(w >= 40 && w <= 1000 && h >= 40 && h <= 1000)) return null;
  const s = raw.start || {};
  const ok = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  return {
    id: String(raw.id || 'custom').slice(0, 40), title: String(raw.title || '내 지도').slice(0, 40), level: 0, size: { w, h },
    props: normalizeProps(raw.props || raw), start: { x: ok(s.x, w / 2), y: ok(s.y, h / 2), heading: ok(s.heading, 0) },
    source: typeof raw.source === 'string' ? raw.source.slice(0, 300) : '', note: typeof raw.note === 'string' ? raw.note.slice(0, 600) : '', tiles: normalizeGrid(raw.tiles),
  };
}
export const mapToJSON = (m) => JSON.stringify({ kind: 'sim-map', v: 1, id: m.id, title: m.title, size: m.size, start: m.start, source: m.source || '', note: m.note || '', tiles: m.tiles || null, props: m.props }, null, 1);
export function parseMapJSON(text) {
  let o; try { o = JSON.parse(String(text)); } catch (e) { return { ok: false, error: '글자를 읽을 수 없어요 (JSON 형식이 아니에요)' }; }
  const m = normalizeMap(o);
  return m ? { ok: true, map: m } : { ok: false, error: '지도 데이터가 아니에요 (크기가 없거나 범위를 벗어났어요)' };
}

// ------------------------------------------------------------
// 내 지도(이름으로 여러 개) — localStorage. 막혀 있어도 오류 없이 false/빈 목록
// ------------------------------------------------------------
export const CUSTOM_KEY = 'sim-maps.custom.v1';
const readAll = () => { try { const o = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
export const listCustom = () => Object.keys(readAll());
export function saveCustom(name, map) {
  name = String(name || '').trim().slice(0, 30); if (!name) return false;
  try { const all = readAll(); all[name] = JSON.parse(mapToJSON({ ...map, id: 'custom', title: name })); localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
}
export function loadCustom(name) { const o = readAll()[name]; const m = o && normalizeMap(o); if (m) m.title = name; return m || null; }
export function deleteCustom(name) { try { const all = readAll(); if (!(name in all)) return false; delete all[name]; localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
