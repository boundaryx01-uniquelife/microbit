// 장면 소품(props) 모듈 — 교구와 무관한 공용 부품 (의존성 없음, ES 모듈)
// 좌표: 월드 cm, x 오른쪽 · y 아래 · heading 0=위 시계 +. 박스·칩의 (x,y) 는 '왼쪽 위 모서리', 물체의 (x,y) 는 '중심'.
//
//   box    {x,y,w,h,label?}        장애물(움직임을 막고 거리 광선에 맞음)
//   object {x,y,r,color}           서 있는 색 물체(둥글고 장애물. 카메라형 색 감지용)
//   chip   {x,y,w,h,color}         바닥에 붙은 색 칩(장애물 아님. 아래를 보는 색 센서용)
//   track  {pts:[[x,y]..],closed,width}  바닥의 검은 선(여러 개 가능)
//
// 순수 함수(맨 위~"자동 설정")는 DOM 없이 node 에서 돌아가고, DOM 코드(attachEditor)는 맨 아래에 있다.

const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

// ------------------------------------------------------------
// 색 표 (한 곳)
// ------------------------------------------------------------
export const COLORS = {
  red:    { ko: '빨강', adj: '빨간',  rgb: [215, 45, 45] },
  yellow: { ko: '노랑', adj: '노란',  rgb: [235, 200, 40] },
  green:  { ko: '초록', adj: '초록',  rgb: [50, 165, 80] },
  blue:   { ko: '파랑', adj: '파란',  rgb: [50, 90, 200] },
  black:  { ko: '검정', adj: '검은',  rgb: [22, 22, 22] },
  white:  { ko: '흰색', adj: '흰',    rgb: [235, 235, 235] },
};
export const COLOR_NAMES = Object.keys(COLORS);
export const FLOOR_DEFAULT = [235, 235, 235];
export const colorRGB = (name) => (COLORS[name] || COLORS.white).rgb;
export const colorKo = (name) => (COLORS[name] || COLORS.white).ko;

// ------------------------------------------------------------
// 데이터 모델
// ------------------------------------------------------------
export const emptyProps = () => ({ boxes: [], objects: [], chips: [], tracks: [] });
export const cloneProps = (p) => normalizeProps(JSON.parse(JSON.stringify(p || {})));
export const isEmpty = (p) => !p.boxes.length && !p.objects.length && !p.chips.length && !p.tracks.length;

const COORD = 3000;
// 아무 값(불러온 글·옛 형식)이든 안전한 소품 묶음으로 고침. 숫자·색·개수를 제한한다.
export function normalizeProps(raw) {
  const out = emptyProps();
  if (!raw || typeof raw !== 'object') return out;
  const list = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  const C = (v) => clamp(num(v), -COORD, COORD);
  const col = (c, d) => (COLORS[c] ? c : d);
  for (const b of list(raw.boxes, 300)) {
    if (!b || typeof b !== 'object') continue;
    const o = { x: C(b.x), y: C(b.y), w: clamp(num(b.w, 12), 1, 400), h: clamp(num(b.h, 12), 1, 400) };
    if (typeof b.label === 'string' && b.label) o.label = b.label.slice(0, 12);
    out.boxes.push(o);
  }
  for (const b of list(raw.objects, 300)) {
    if (!b || typeof b !== 'object') continue;
    out.objects.push({ x: C(b.x), y: C(b.y), r: clamp(num(b.r, 4.5), 1, 40), color: col(b.color, 'red') });
  }
  for (const b of list(raw.chips, 300)) {
    if (!b || typeof b !== 'object') continue;
    out.chips.push({ x: C(b.x), y: C(b.y), w: clamp(num(b.w, 8), 1, 100), h: clamp(num(b.h, 8), 1, 100), color: col(b.color, 'red') });
  }
  for (const t of list(raw.tracks, 30)) {
    if (!t || !Array.isArray(t.pts)) continue;
    const pts = t.pts.slice(0, 800).filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]) && typeof p[0] === 'number' && typeof p[1] === 'number').map(p => [C(p[0]), C(p[1])]);
    if (pts.length < 2) continue;
    out.tracks.push({ pts, closed: !!t.closed && pts.length >= 3, width: clamp(num(t.width, 4), 1, 20) });
  }
  return out;
}
// 같은 묶음 객체를 유지한 채 내용만 바꿈(월드가 props 객체를 계속 들고 있으므로)
export function assignProps(dst, src) {
  const s = normalizeProps(src);
  for (const k of ['boxes', 'objects', 'chips', 'tracks']) dst[k] = s[k];
  return dst;
}

// ------------------------------------------------------------
// 기하 도우미
// ------------------------------------------------------------
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function trackSegs(t) {
  const out = [], n = t.pts.length;
  for (let i = 0; i < n - 1; i++) out.push([t.pts[i], t.pts[i + 1]]);
  if (t.closed && n > 2) out.push([t.pts[n - 1], t.pts[0]]);
  return out;
}
export function trackLength(t) { return trackSegs(t).reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0); }
export function distToTrack(t, x, y) { let b = Infinity; for (const [p, q] of trackSegs(t)) b = Math.min(b, distSeg(x, y, p[0], p[1], q[0], q[1])); return b; }
// 선 위 가장 가까운 점: {x,y,d,s(처음부터 길이),seg,t}
export function nearestOnTrack(t, x, y) {
  let best = { d: Infinity }, acc = 0, i = 0;
  for (const [a, b] of trackSegs(t)) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9, len = Math.sqrt(l2);
    const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1), qx = a[0] + u * dx, qy = a[1] + u * dy, d = Math.hypot(x - qx, y - qy);
    if (d < best.d) best = { x: qx, y: qy, d, s: acc + u * len, seg: i, t: u };
    acc += len; i++;
  }
  return best;
}
// 선을 따라 s cm 간 자리 {x,y,heading,seg}. 닫힌 선은 돌아 감, 열린 선은 끝에서 멈춤
export function pointAlong(t, s) {
  const segs = trackSegs(t), L = trackLength(t);
  if (!segs.length) return null;
  s = t.closed ? ((s % L) + L) % L : clamp(s, 0, L);
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + len || i === segs.length - 1) {
      const u = len ? clamp((s - acc) / len, 0, 1) : 0, dx = b[0] - a[0], dy = b[1] - a[1];
      return { x: a[0] + u * dx, y: a[1] + u * dy, heading: Math.atan2(dx, -dy) / RAD, seg: i };
    }
    acc += len;
  }
  return null;
}
function circleRectDist(cx, cy, rx, ry, rw, rh) {   // 원 중심 ~ 사각형(안이면 0)
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  return Math.hypot(cx - nx, cy - ny);
}
// 소품 한 개가 원(cx,cy,rad)과 겹치는가
export function propOverlapsCircle(kind, p, cx, cy, rad) {
  if (kind === 'object') return Math.hypot(cx - p.x, cy - p.y) < rad + p.r;
  if (kind === 'box' || kind === 'chip') return circleRectDist(cx, cy, p.x, p.y, p.w, p.h) < rad;
  return false;
}
export const propCenter = (kind, p) => (kind === 'object' ? { x: p.x, y: p.y } : { x: p.x + p.w / 2, y: p.y + p.h / 2 });
export function setPropCenter(kind, p, x, y) { if (kind === 'object') { p.x = x; p.y = y; } else { p.x = x - p.w / 2; p.y = y - p.h / 2; } }

// ------------------------------------------------------------
// 센서가 읽는 값
// ------------------------------------------------------------
// 바닥 한 점. 칩 > 검은 선 > 바닥색. line = 선 위인가(칩이 덮어도 선 센서는 선으로 읽음)
export function onLine(props, x, y) {
  for (const t of props.tracks) if (distToTrack(t, x, y) <= t.width / 2) return true;
  return false;
}
export function colorAt(props, x, y, bg = FLOOR_DEFAULT) {
  const line = onLine(props, x, y);
  for (let i = props.chips.length - 1; i >= 0; i--) {
    const c = props.chips[i];
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return { name: c.color, rgb: colorRGB(c.color), line, chip: c.color };
  }
  if (line) return { name: 'black', rgb: COLORS.black.rgb, line: true, chip: null };
  return { name: 'floor', rgb: bg, line: false, chip: null };
}
// 둥근 로봇(x,y,r)이 박스·물체에 닿는가 (벽은 월드가 따로)
export function obstacleHit(props, x, y, r) {
  for (const b of props.boxes) if (circleRectDist(x, y, b.x, b.y, b.w, b.h) < r) return true;
  for (const o of props.objects) if (Math.hypot(x - o.x, y - o.y) < r + o.r) return true;
  return false;
}
function slab(ox, oy, dx, dy, minx, miny, maxx, maxy) {
  let t0 = 0, t1 = Infinity;
  for (const [o, d, mn, mx] of [[ox, dx, minx, maxx], [oy, dy, miny, maxy]]) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return Infinity; continue; }
    let a = (mn - o) / d, b = (mx - o) / d; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
  }
  return t0;
}
function circleHit(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy, b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;                         // 시작점이 이미 안
  const disc = b * b - c; if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc); return t >= 0 ? t : Infinity;
}
// 광선: (x,y) 에서 heading 쪽으로 startOff 만큼 앞에서 시작(센서 위치). 돌려주는 거리는 그 시작점 기준. 못 맞히면 Infinity
export function raycastHit(props, x, y, heading, startOff = 0, max = 1e4) {
  const dx = Math.sin(heading * RAD), dy = -Math.cos(heading * RAD), ox = x + dx * startOff, oy = y + dy * startOff;
  let best = { d: Infinity, kind: null, prop: null };
  for (const b of props.boxes) { const t = slab(ox, oy, dx, dy, b.x, b.y, b.x + b.w, b.y + b.h); if (t < best.d) best = { d: t, kind: 'box', prop: b }; }
  for (const o of props.objects) { const t = circleHit(ox, oy, dx, dy, o.x, o.y, o.r); if (t < best.d) best = { d: t, kind: 'object', prop: o }; }
  if (best.d > max) return { d: Infinity, kind: null, prop: null };
  return best;
}
export const raycast = (props, x, y, heading, startOff = 0, max = 1e4) => raycastHit(props, x, y, heading, startOff, max).d;
// 카메라가 보는 색 물체(가까운 것부터). d = 겉면까지 거리, bearing = 정면 기준 각(시계 +). 상자에 가려지면 제외
export function objectsInView(props, x, y, heading, fovDeg = 60, maxCm = 200, occlude = true) {
  const out = [];
  for (const o of props.objects) {
    const dx = o.x - x, dy = o.y - y, dist = Math.hypot(dx, dy), surf = Math.max(0, dist - o.r);
    if (surf > maxCm) continue;
    let bearing = Math.atan2(dx, -dy) / RAD - heading; bearing = ((bearing + 540) % 360) - 180;
    const half = fovDeg / 2 + (dist > o.r ? Math.asin(Math.min(1, o.r / dist)) / RAD : 90);
    if (Math.abs(bearing) > half) continue;
    if (occlude) {
      const h = Math.atan2(dx, -dy) / RAD, hit = raycastHit({ boxes: props.boxes, objects: [] }, x, y, h, 0, surf);
      if (isFinite(hit.d)) continue;
    }
    out.push({ obj: o, color: o.color, dist: surf, bearing });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

// ------------------------------------------------------------
// 선 프리셋
// ------------------------------------------------------------
// 둥근 사각 닫힌 선(시계 방향, 왼쪽 변 아래에서 시작해 위로). 처음 점이 끝 점과 겹치지 않게 뺌
export function roundedRectTrack(x0, y0, x1, y1, r, steps = 4, width = 4) {
  const pts = [];
  const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= steps; i++) { const a = (a0 + (a1 - a0) * i / steps) * RAD; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  pts.push([x0, y1 - r]);
  arc(x0 + r, y0 + r, 180, 270); arc(x1 - r, y0 + r, 270, 360); arc(x1 - r, y1 - r, 0, 90); arc(x0 + r, y1 - r, 90, 180);
  pts.pop();
  return { pts: pts.map(p => [round2(p[0]), round2(p[1])]), closed: true, width };
}
const round2 = (v) => Math.round(v * 100) / 100;
export const TRACK_KINDS = [['oval', '타원'], ['figure8', '8자'], ['scurve', 'S자'], ['straight', '직선'], ['square', '사각']];
export function trackPreset(kind, w, h, opts = {}) {
  const width = opts.width || 4, steps = opts.steps || 4;
  const mx = w * 0.15, my = h * 0.2, iw = w - 2 * mx, ih = h - 2 * my, cx = w / 2, cy = h / 2;
  const R = (a) => a.map(p => [round2(p[0]), round2(p[1])]);
  switch (kind) {
    case 'figure8': {
      const pts = [], n = 32, tall = h > w * 1.2;
      for (let i = 0; i < n; i++) {
        const t = i / n * 2 * Math.PI, a = Math.sin(t), b = Math.sin(2 * t);
        pts.push(tall ? [cx + iw / 2 * b, cy + ih / 2 * a] : [cx + iw / 2 * a, cy + ih / 2 * b]);
      }
      return { pts: R(pts), closed: true, width };
    }
    case 'scurve': {
      const pts = [], n = 16, tall = h > w;
      for (let i = 0; i <= n; i++) {
        const u = i / n, off = Math.sin(u * 2 * Math.PI);
        pts.push(tall ? [cx + iw * 0.22 * off, h - my - ih * u] : [mx + iw * u, cy + ih * 0.3 * off]);
      }
      return { pts: R(pts), closed: false, width };
    }
    case 'straight': return { pts: R(h > w ? [[cx, h - my], [cx, my]] : [[mx, cy], [w - mx, cy]]), closed: false, width };
    case 'square': return { pts: R([[mx, h - my], [mx, my], [w - mx, my], [w - mx, h - my]]), closed: true, width };
    case 'oval': default:
      return roundedRectTrack(mx, my, w - mx, h - my, Math.min(ih / 3, iw / 3), steps, width);
  }
}
// 선 위 출발 자리 {x,y,heading} (선을 따라 앞을 봄). 닫힌 선은 첫 긴 변의 가운데, 열린 선은 시작에서 15cm
export function startOnTrack(t) {
  const segs = trackSegs(t);
  if (!segs.length) return null;
  if (!t.closed) return pointAlong(t, Math.min(15, trackLength(t) / 2));
  let acc = 0;
  for (const [a, b] of segs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len >= 10) return pointAlong(t, acc + len / 2);
    acc += len;
  }
  return pointAlong(t, 0);
}

// ------------------------------------------------------------
// 편집용 순수 함수
// ------------------------------------------------------------
export const DEFAULT_SIZE = { box: 12, chip: 8, objectR: 4.5 };
// (x,y) 를 중심으로 소품을 추가하고 돌려줌
export function addProp(props, kind, x, y, o = {}) {
  if (kind === 'box') { const w = o.w || DEFAULT_SIZE.box, h = o.h || DEFAULT_SIZE.box, b = { x: x - w / 2, y: y - h / 2, w, h }; props.boxes.push(b); return b; }
  if (kind === 'object') { const b = { x, y, r: o.r || DEFAULT_SIZE.objectR, color: COLORS[o.color] ? o.color : 'red' }; props.objects.push(b); return b; }
  if (kind === 'chip') { const w = o.w || DEFAULT_SIZE.chip, h = o.h || DEFAULT_SIZE.chip, b = { x: x - w / 2, y: y - h / 2, w, h, color: COLORS[o.color] ? o.color : 'red' }; props.chips.push(b); return b; }
  if (kind === 'track') { const t = { pts: o.pts || [[x, y]], closed: !!o.closed, width: o.width || 4 }; props.tracks.push(t); return t; }
  return null;
}
const LIST = { box: 'boxes', object: 'objects', chip: 'chips', track: 'tracks' };
export function removeProp(props, kind, prop) {
  const a = props[LIST[kind]]; const i = a ? a.indexOf(prop) : -1;
  if (i < 0) return false; a.splice(i, 1); return true;
}
export function insertTrackPoint(t, x, y) {   // 가장 가까운 변 위에 점을 끼워 넣고 그 번호를 돌려줌
  const n = nearestOnTrack(t, x, y), i = n.seg + 1;
  t.pts.splice(i, 0, [round2(n.x), round2(n.y)]);
  return i;
}
// 점 제거. 남은 점이 모자라면 선을 없앰. 반환: 'point' | 'track' | false
export function removeTrackPoint(props, t, idx) {
  if (idx < 0 || idx >= t.pts.length) return false;
  t.pts.splice(idx, 1);
  if (t.pts.length <= 2) t.closed = false;
  if (t.pts.length < 2) { removeProp(props, 'track', t); return 'track'; }
  return 'point';
}
// 무엇이 눌렸나. items: 물체·상자·칩 검사, points: 선의 점 검사. 위에 그려진 것(나중에 추가한 것)이 먼저
export function hitTest(props, x, y, tol = 3, { items = true, points = false } = {}) {
  if (items) {
    for (let i = props.objects.length - 1; i >= 0; i--) { const o = props.objects[i]; if (Math.hypot(x - o.x, y - o.y) <= Math.max(o.r, tol * 0.8)) return { kind: 'object', prop: o, part: 'body' }; }
    for (let i = props.boxes.length - 1; i >= 0; i--) { const b = props.boxes[i]; if (circleRectDist(x, y, b.x, b.y, b.w, b.h) <= tol * 0.3) return { kind: 'box', prop: b, part: 'body' }; }
    for (let i = props.chips.length - 1; i >= 0; i--) { const b = props.chips[i]; if (circleRectDist(x, y, b.x, b.y, b.w, b.h) <= tol * 0.3) return { kind: 'chip', prop: b, part: 'body' }; }
  }
  if (points) {
    for (let k = props.tracks.length - 1; k >= 0; k--) {
      const t = props.tracks[k]; let bi = -1, bd = tol;
      t.pts.forEach((p, i) => { const d = Math.hypot(x - p[0], y - p[1]); if (d <= bd) { bd = d; bi = i; } });
      if (bi >= 0) return { kind: 'track', prop: t, part: 'point', index: bi };
    }
  }
  for (let k = props.tracks.length - 1; k >= 0; k--) {
    const t = props.tracks[k], n = nearestOnTrack(t, x, y);
    if (n.d <= t.width / 2 + tol * 0.6) return { kind: 'track', prop: t, part: points ? 'seg' : 'body', index: n.seg };
  }
  return null;
}

// ------------------------------------------------------------
// 자동 설정: 코드가 필요로 하는 환경을 '없을 때만' 채움. 사용자가 놓은 것은 지우지도 옮기지도 않음
//  needs: 'distance' | 'line' | 'color:red'(바닥 칩) | 'object:red'(서 있는 물체)
//  robot: {x,y,heading,radius?}  world: {size:{w,h}, walls?, start?, raycast?(ox,oy,heading,max)}
//  새 선을 깔면 로봇(과 world.start)을 선 위로 옮김. 반환: 한글 안내 목록
// ------------------------------------------------------------
export function ensureFor(needs, props, robot, world = {}, opts = {}) {
  const notes = [], size = world.size || { w: 300, h: 200 }, rr = robot.radius || opts.robotRadius || 9, margin = 6;
  const uniq = [...new Set((needs || []).map(String))];
  const inField = (x, y, m = margin) => x >= m && y >= m && x <= size.w - m && y <= size.h - m;
  const free = (x, y, rad) => {
    if (!inField(x, y)) return false;
    if (Math.hypot(x - robot.x, y - robot.y) < rr + rad + 2) return false;
    for (const [k, list] of [['box', props.boxes], ['object', props.objects], ['chip', props.chips]]) for (const p of list) if (propOverlapsCircle(k, p, x, y, rad + 1)) return false;
    return true;
  };
  const offTracks = (x, y, rad, extra = 0) => props.tracks.every(t => distToTrack(t, x, y) > rad + extra + t.width / 2 + 2);
  const fwd = (d, lat = 0) => { const hx = Math.sin(robot.heading * RAD), hy = -Math.cos(robot.heading * RAD); return [robot.x + hx * d - hy * lat, robot.y + hy * d + hx * lat]; };
  const moveRobot = (pose) => { robot.x = pose.x; robot.y = pose.y; robot.heading = pose.heading; if (world.start) world.start = { ...world.start, x: pose.x, y: pose.y, heading: pose.heading }; };

  if (uniq.includes('line') && !props.tracks.length) {
    let pick = null;
    for (const kind of ['oval', 'square', 'figure8', 'straight']) {
      const t = trackPreset(kind, size.w, size.h, { width: opts.lineWidth || 4 });
      const clash = [...props.boxes.map(b => ['box', b]), ...props.objects.map(o => ['object', o])].some(([k, p]) => t.pts.some(([x, y]) => { const c = propCenter(k, p); return Math.hypot(x - c.x, y - c.y) < 8; }) || trackSegs(t).some(([a, b]) => { const c = propCenter(k, p), d = distSeg(c.x, c.y, a[0], a[1], b[0], b[1]); return d < (k === 'object' ? p.r : Math.min(p.w, p.h) / 2) + t.width / 2; }));
      if (!pick || !clash) pick = { kind, t }; if (!clash) break;
    }
    props.tracks.push(pick.t);
    const st = startOnTrack(pick.t); if (st) moveRobot(st);
    const ko = (TRACK_KINDS.find(k => k[0] === pick.kind) || [0, '타원'])[1];
    notes.push(`검은 선 트랙(${ko})을 바닥에 깔고 로봇을 선 위에 놓았어요 — '지도 설정'에서 모양을 바꾸고 점을 끌어 고칠 수 있어요`);
  }

  if (uniq.includes('distance')) {
    const seen = props.boxes.length || props.objects.length || (world.raycast ? isFinite(world.raycast(...fwd(0), robot.heading, 300)) : false)
      || (world.walls && world.size);
    if (!seen) {
      let done = false;
      for (const lat of [0, 25, -25, 45, -45]) {
        for (const d of opts.distanceSteps || [40, 55, 70, 90, 30]) {   // opts.distanceSteps: 교구마다 처음 놓을 거리 후보(cm)
          const [x, y] = fwd(d, lat), rad = DEFAULT_SIZE.box * 0.75;
          if (!free(x, y, rad) || !offTracks(x, y, rad, rr)) continue;
          addProp(props, 'box', x, y);
          notes.push(`상자를 ${lat ? '비스듬히 ' : ''}앞 ${d}cm에 놓았어요 — 끌어서 옮길 수 있어요`);
          done = true; break;
        }
        if (done) break;
      }
      if (!done) notes.push('거리를 잴 상자를 놓을 빈자리를 못 찾았어요 — 도구에서 상자를 직접 놓아 보세요');
    }
  }

  for (const need of uniq) {
    const m = /^(color|object):(\w+)$/.exec(need); if (!m) continue;
    const kind = m[1] === 'color' ? 'chip' : 'object', color = COLORS[m[2]] ? m[2] : 'red';
    if ((kind === 'chip' ? props.chips : props.objects).some(c => c.color === color)) continue;
    const adj = COLORS[color].adj, rad = kind === 'chip' ? DEFAULT_SIZE.chip * 0.7 : DEFAULT_SIZE.objectR + 1;
    let spot = null, onTrackNote = false;
    if (props.tracks.length) {
      let near = null; for (const t of props.tracks) { const n = nearestOnTrack(t, robot.x, robot.y); if (!near || n.d < near.n.d) near = { t, n }; }
      const here = pointAlong(near.t, near.n.s), sgn = Math.sin(here.heading * RAD) * Math.sin(robot.heading * RAD) + Math.cos(here.heading * RAD) * Math.cos(robot.heading * RAD) >= 0 ? 1 : -1;
      for (const step of [35, 60, 85, 110, 135]) {
        const s = near.n.s + sgn * step; if (!near.t.closed && (s < 0 || s > trackLength(near.t))) continue;
        const p = pointAlong(near.t, s);
        if (kind === 'chip' ? free(p.x, p.y, rad) : (free(p.x, p.y, rad) && offTracks(p.x, p.y, rad, rr))) { spot = { x: p.x, y: p.y, d: step }; onTrackNote = kind === 'chip'; break; }
      }
    }
    if (!spot) {
      for (const lat of kind === 'chip' ? [0, 20, -20, 40, -40] : [0, 18, -18, 36, -36]) {
        for (const d of kind === 'chip' ? [30, 45, 60, 80, 100] : [40, 55, 70, 90, 110]) {
          const [x, y] = fwd(d, lat);
          if (free(x, y, rad) && (kind === 'chip' ? offTracks(x, y, rad) : offTracks(x, y, rad, rr))) { spot = { x, y, d, lat }; break; }
        }
        if (spot) break;
      }
    }
    if (!spot) { notes.push(`${adj} ${kind === 'chip' ? '컬러칩' : '물체'}를 놓을 빈자리를 못 찾았어요 — 도구에서 직접 놓아 보세요`); continue; }
    addProp(props, kind, spot.x, spot.y, { color });
    const dd = Math.round(Math.hypot(spot.x - robot.x, spot.y - robot.y));
    notes.push(kind === 'chip'
      ? `${adj} 컬러칩을 앞 ${dd}cm${onTrackNote ? ' 선 위' : ''}에 놓았어요 — 끌어서 옮길 수 있어요`
      : `${adj} 물체를 앞 ${dd}cm에 세웠어요 — 끌어서 옮길 수 있어요`);
  }
  return notes;
}

// ------------------------------------------------------------
// 저장·불러오기 (글자 JSON)
// ------------------------------------------------------------
export function exportScene(props, meta = {}) { return JSON.stringify({ kind: 'sim-scene', v: 1, meta, props }, null, 1); }
export function parseScene(text) {
  let o; try { o = JSON.parse(String(text)); } catch (e) { return { ok: false, error: '글자를 읽을 수 없어요 (JSON 형식이 아니에요)' }; }
  if (!o || typeof o !== 'object' || (!o.props && !o.tracks && !o.boxes)) return { ok: false, error: '지도 데이터가 아니에요' };
  const src = o.props || o;
  return { ok: true, props: normalizeProps(src), meta: o.meta && typeof o.meta === 'object' ? o.meta : {} };
}
export function saveScene(key, props, meta = {}) { try { localStorage.setItem(key, exportScene(props, meta)); return true; } catch (e) { return false; } }
export function loadScene(key) {
  try { const t = localStorage.getItem(key); if (!t) return null; const r = parseScene(t); return r.ok ? { props: r.props, meta: r.meta } : null; } catch (e) { return null; }
}

// ------------------------------------------------------------
// 그리기(캔버스 2D, cm 좌표로 이미 scale 된 컨텍스트). 어느 뷰에서든 같은 모양
// ------------------------------------------------------------
const rgbS = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export function drawProps(g, props, { selected = null } = {}) {
  for (const t of props.tracks) {
    g.strokeStyle = '#161616'; g.lineWidth = t.width; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); t.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (t.closed) g.closePath(); g.stroke();
  }
  for (const c of props.chips) {
    g.fillStyle = rgbS(colorRGB(c.color)); g.fillRect(c.x, c.y, c.w, c.h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.4; g.strokeRect(c.x, c.y, c.w, c.h);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const o of props.boxes) {
    g.fillStyle = o.label ? '#6b4a2f' : '#9a7b55'; g.fillRect(o.x, o.y, o.w, o.h);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.4; g.strokeRect(o.x, o.y, o.w, o.h);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(o.x + 0.6, o.y + 0.6, Math.max(0, o.w - 1.2), Math.min(1.2, o.h));
    if (o.label) { g.fillStyle = '#222'; g.font = '4px system-ui, sans-serif'; g.fillText(o.label, o.x + o.w / 2, o.y + o.h + 4); }
  }
  for (const o of props.objects) {
    g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fillStyle = rgbS(colorRGB(o.color)); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 0.7; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.35; g.beginPath(); g.arc(o.x, o.y, o.r + 0.4, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.3, 0, 7); g.fill();
  }
  if (selected && selected.prop && selected.kind !== 'track') {
    const p = selected.prop; g.strokeStyle = '#2456e5'; g.lineWidth = 0.7; g.setLineDash([1.5, 1]);
    if (selected.kind === 'object') { g.beginPath(); g.arc(p.x, p.y, p.r + 1.6, 0, 7); g.stroke(); } else g.strokeRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
    g.setLineDash([]);
  }
}

// ============================================================
// 이하 DOM 편집기 (브라우저 전용)
// ============================================================
const STYLE_ID = 'sim-props-style';
const CSS = `
.pe-bar,.pe-map{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.pe-bar button,.pe-map button{min-height:40px;min-width:40px;padding:4px 10px;font:inherit;font-size:13.5px;border:1px solid var(--line-strong,#999);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#111);cursor:pointer}
.pe-bar button[aria-pressed="true"]{background:var(--accent,#2456e5);color:var(--accent-ink,#fff);border-color:var(--accent,#2456e5);font-weight:700}
.pe-colors{display:inline-flex;gap:4px;align-items:center}
.pe-colors button{width:34px;min-width:34px;height:34px;min-height:34px;padding:0;border-radius:50%}
.pe-colors button[aria-pressed="true"]{outline:3px solid var(--accent,#2456e5);outline-offset:1px}
.pe-msg{flex:1 1 100%;font-size:13px;color:var(--muted,#555);min-height:1.3em;overflow-wrap:anywhere}
.pe-map label{font-size:13.5px;display:inline-flex;gap:6px;align-items:center}
.pe-map input[type=range]{width:min(160px,40vw)}
.pe-map textarea{flex:1 1 100%;box-sizing:border-box;width:100%;min-height:90px;font:12px/1.4 var(--mono,monospace)}
.pe-map .pe-row{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
`;
function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); }
  for (const c of [].concat(kids)) if (c) e.appendChild(c);
  return e;
}
const TOOLS = [['select', '선택/이동'], ['box', '상자'], ['object', '색 물체'], ['chip', '컬러칩'], ['track', '선 편집'], ['erase', '지우개']];

export function attachEditor(canvas, opts) {
  const o = Object.assign({ getProps: () => emptyProps(), toWorld: () => ({ x: 0, y: 0 }), onChange() {}, getSize: null, robot: null, storageKey: () => 'sim-props.scene', getMeta: () => ({}), applyMeta() {}, onMessage() {} }, opts);
  const ed = { tool: 'select', color: 'red', sel: null, activeTrack: null, msgEl: null, bars: [], listeners: [], say: (t) => say(t) };
  const props = () => o.getProps();
  const robotNow = () => { const r = typeof o.robot === 'function' ? o.robot() : o.robot; return r ? { x: r.x, y: r.y, rad: r.radius || o.robotRadius || 9 } : null; };
  const size = () => (o.getSize ? o.getSize() : { w: 1e4, h: 1e4 });
  const say = (t) => { if (ed.msgEl) ed.msgEl.textContent = t; o.onMessage(t); };
  const fire = (reason, detail) => { refresh(); o.onChange(reason, detail); for (const f of ed.listeners) f(reason, detail); };
  const tolCm = (px) => {
    const r = canvas.getBoundingClientRect(); if (!r.width) return 3;
    const a = o.toWorld({ clientX: r.left, clientY: r.top }), b = o.toWorld({ clientX: r.left + 100, clientY: r.top });
    return Math.abs(b.x - a.x) / 100 * px;
  };
  const clampPt = (x, y) => { const s = size(); return { x: clamp(x, 0, s.w), y: clamp(y, 0, s.h) }; };
  const blockedByRobot = (kind, p) => { const r = robotNow(); return !!r && propOverlapsCircle(kind, p, r.x, r.y, r.rad); };
  const pressedTrack = () => ed.activeTrack && props().tracks.includes(ed.activeTrack) ? ed.activeTrack : (props().tracks[props().tracks.length - 1] || null);

  ed.setTool = (t) => { ed.tool = t; if (t !== 'select') ed.sel = null; refresh(); say(HINT[t] || ''); };
  ed.setColor = (c) => {
    if (!COLORS[c]) return; ed.color = c;
    if (ed.sel && (ed.sel.kind === 'object' || ed.sel.kind === 'chip')) { ed.sel.prop.color = c; fire('recolor', { kind: ed.sel.kind }); }
    refresh();
  };
  const HINT = { select: '끌어서 옮겨요. 빈 곳을 누르면 선택이 풀려요. Delete 키로 지워요.', box: '바닥을 눌러 상자(장애물)를 놓아요.', object: '바닥을 눌러 색 물체를 세워요. 아래에서 색을 고르세요.', chip: '바닥을 눌러 컬러칩을 붙여요. 아래에서 색을 고르세요.', track: '점을 끌어 옮겨요. 선을 두 번 누르거나 길게 누르면 점이 늘어요. 빈 곳을 누르면 끝에 점이 더해져요.', erase: '지울 소품을 눌러요. 선의 점을 누르면 그 점만, 선 몸을 누르면 선 전체가 지워져요.' };

  ed.addAt = (kind, x, y, color) => {
    const p = clampPt(x, y), prop = addProp(props(), kind, p.x, p.y, { color: color || ed.color });
    if (kind !== 'track' && blockedByRobot(kind, prop)) { removeProp(props(), kind, prop); say('로봇 위에는 놓을 수 없어요. 조금 옆에 놓아 보세요.'); return null; }
    ed.sel = { kind, prop, part: 'body' }; fire('add', { kind }); return prop;
  };
  ed.deleteSelected = () => {
    const s = ed.sel; if (!s) return false;
    const ok = removeProp(props(), s.kind, s.prop); ed.sel = null;
    if (ok) fire('remove', { kind: s.kind }); return ok;
  };
  ed.select = (s) => { ed.sel = s; if (s && s.kind === 'track') ed.activeTrack = s.prop; refresh(); };
  ed.activeTrackObj = pressedTrack;
  ed.setWidth = (w) => { const t = pressedTrack(); if (!t) return; t.width = clamp(+w || 4, 1, 20); fire('width'); };
  ed.setClosed = (c) => { const t = pressedTrack(); if (!t) return; t.closed = !!c && t.pts.length >= 3; if (c && t.pts.length < 3) say('점이 3개 이상이어야 닫을 수 있어요.'); fire('track'); };
  ed.preset = (kind) => {
    const s = size(), P = props(), w = (pressedTrack() || { width: 4 }).width;
    const t = trackPreset(kind, s.w, s.h, { width: w });
    P.tracks.length = 0; P.tracks.push(t); ed.activeTrack = t; ed.sel = { kind: 'track', prop: t, part: 'body' };
    const ko = (TRACK_KINDS.find(k => k[0] === kind) || [0, kind])[1];
    say(`${ko} 모양 선을 깔았어요. '선 편집'에서 점을 끌어 고칠 수 있어요.`);
    fire('preset', { kind, start: startOnTrack(t) });
  };
  ed.clearTracks = () => { props().tracks.length = 0; ed.activeTrack = null; if (ed.sel && ed.sel.kind === 'track') ed.sel = null; say('선을 모두 지웠어요.'); fire('track'); };
  ed.newTrack = () => { const t = addProp(props(), 'track', 0, 0, { pts: [] }); ed.activeTrack = t; ed.setTool('track'); say('새 선: 바닥을 눌러 점을 이어 가세요 (점 2개부터 보여요).'); };
  ed.save = () => { const ok = saveScene(o.storageKey(), props(), o.getMeta()); say(ok ? '이 브라우저에 지도를 저장했어요.' : '저장할 수 없어요 (브라우저 저장소가 막혀 있어요).'); return ok; };
  ed.load = () => {
    const r = loadScene(o.storageKey());
    if (!r) { say('저장된 지도가 없어요.'); return false; }
    assignProps(props(), r.props); o.applyMeta(r.meta || {}); ed.sel = null; ed.activeTrack = null; say('저장한 지도를 불러왔어요.'); fire('load'); return true;
  };
  ed.exportText = () => exportScene(props(), o.getMeta());
  ed.importText = (text) => {
    const r = parseScene(text);
    if (!r.ok) { say(r.error); return false; }
    assignProps(props(), r.props); o.applyMeta(r.meta || {}); ed.sel = null; ed.activeTrack = null; say('지도를 가져왔어요.'); fire('load'); return true;
  };

  // ---- 포인터 ----
  let drag = null, press = null, lastDown = { t: 0, x: 0, y: 0 };
  const startDragProp = (kind, prop, p) => { const c = propCenter(kind, prop); drag = { type: 'prop', kind, prop, dx: c.x - p.x, dy: c.y - p.y, moved: false }; };
  const down = (ev) => {
    if (ev.button > 0 || (ev.pointerType === 'mouse' && ev.buttons > 1)) return;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 시험 환경 */ }
    try { canvas.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
    const p = o.toWorld(ev), tol = tolCm(ev.pointerType === 'touch' ? 20 : 12), now = Date.now(), P = props();
    const dbl = now - lastDown.t < 420 && Math.hypot(p.x - lastDown.x, p.y - lastDown.y) < tol;
    lastDown = { t: now, x: p.x, y: p.y };
    const tool = ed.tool;
    if (tool === 'erase') {
      const h = hitTest(P, p.x, p.y, tol, { items: true, points: true });
      if (!h) { say('지울 것이 없어요.'); return; }
      if (h.kind === 'track' && h.part === 'point') { removeTrackPoint(P, h.prop, h.index); say('점을 지웠어요.'); fire('track'); }
      else { removeProp(P, h.kind, h.prop); if (ed.sel && ed.sel.prop === h.prop) ed.sel = null; say('지웠어요.'); fire('remove', { kind: h.kind }); }
      return;
    }
    if (tool === 'track') {
      const h = hitTest(P, p.x, p.y, tol, { items: false, points: true });
      if (h && h.part === 'point') { ed.activeTrack = h.prop; ed.sel = { kind: 'track', prop: h.prop, part: 'point', index: h.index }; drag = { type: 'point', t: h.prop, i: h.index, moved: false }; refresh(); return; }
      if (h && h.part === 'seg') {
        ed.activeTrack = h.prop; ed.sel = { kind: 'track', prop: h.prop, part: 'body' }; refresh();
        const ins = () => { const i = insertTrackPoint(h.prop, p.x, p.y); ed.sel.index = i; drag = { type: 'point', t: h.prop, i, moved: true }; fire('track'); };
        if (dbl) { ins(); return; }
        press = { x: p.x, y: p.y, tol, timer: setTimeout(() => { if (press) { press = null; ins(); } }, 550) };
        return;
      }
      // 빈 바닥: 끝에 점을 더함(없으면 새 선)
      const q = clampPt(p.x, p.y);
      let t = pressedTrack();
      if (!t) t = addProp(P, 'track', 0, 0, { pts: [] });
      t.pts.push([round2(q.x), round2(q.y)]); ed.activeTrack = t; ed.sel = { kind: 'track', prop: t, part: 'point', index: t.pts.length - 1 };
      drag = { type: 'point', t, i: t.pts.length - 1, moved: true }; fire('track');
      return;
    }
    // 선택/이동·놓기: 먼저 눌린 소품
    const h = hitTest(P, p.x, p.y, tol, { items: true, points: false });
    if (h) {
      ed.sel = { kind: h.kind, prop: h.prop, part: 'body' };
      if (h.kind === 'track') { ed.activeTrack = h.prop; drag = { type: 'track', t: h.prop, last: p, moved: false }; }
      else startDragProp(h.kind, h.prop, p);
      refresh(); return;
    }
    if (tool === 'box' || tool === 'object' || tool === 'chip') {
      const prop = ed.addAt(tool, p.x, p.y, ed.color);
      if (prop) startDragProp(tool, prop, p);
      return;
    }
    ed.sel = null; refresh();
  };
  const move = (ev) => {
    if (press) { const p = o.toWorld(ev); if (Math.hypot(p.x - press.x, p.y - press.y) > press.tol) { clearTimeout(press.timer); press = null; } }
    if (!drag) return;
    const p = o.toWorld(ev);
    if (drag.type === 'prop') {
      const c = clampPt(p.x + drag.dx, p.y + drag.dy), prop = drag.prop, old = propCenter(drag.kind, prop);
      setPropCenter(drag.kind, prop, c.x, c.y);
      if (blockedByRobot(drag.kind, prop)) { setPropCenter(drag.kind, prop, old.x, old.y); say('로봇 위에는 놓을 수 없어요.'); } else drag.moved = true;
    } else if (drag.type === 'point') {
      const c = clampPt(p.x, p.y); drag.t.pts[drag.i] = [round2(c.x), round2(c.y)]; drag.moved = true;
    } else if (drag.type === 'track') {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y; drag.last = p; drag.t.pts = drag.t.pts.map(([x, y]) => [round2(x + dx), round2(y + dy)]); drag.moved = true;
    }
  };
  const up = () => {
    if (press) { clearTimeout(press.timer); press = null; }
    if (drag && drag.moved) fire('move', { type: drag.type });
    drag = null;
  };
  canvas.style.touchAction = 'none';
  if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      const s = ed.sel;
      if (s && s.kind === 'track' && s.part === 'point') { removeTrackPoint(props(), s.prop, s.index); ed.sel = null; fire('track'); ev.preventDefault(); }
      else if (ed.deleteSelected()) ev.preventDefault();
    } else if (ev.key === 'Escape') { ed.sel = null; refresh(); }
  });

  // 뷰가 그린 뒤 얹는 겹쳐 그리기(cm 좌표 컨텍스트)
  ed.drawOverlay = (g) => {
    const showPts = ed.tool === 'track' || ed.tool === 'erase', act = pressedTrack();
    for (const t of props().tracks) {
      const isAct = t === act, sel = ed.sel && ed.sel.prop === t;
      if (sel || (ed.tool === 'track' && isAct)) { g.strokeStyle = 'rgba(36,86,229,.55)'; g.lineWidth = Math.max(0.6, t.width * 0.3); g.setLineDash([2, 1.5]); g.beginPath(); t.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (t.closed) g.closePath(); g.stroke(); g.setLineDash([]); }
      if (showPts) t.pts.forEach(([x, y], i) => {
        const on = sel && ed.sel.part === 'point' && ed.sel.index === i;
        g.beginPath(); g.arc(x, y, on ? 2.4 : 1.8, 0, 7); g.fillStyle = i === 0 ? '#1fa463' : '#fff'; g.fill(); g.strokeStyle = '#2456e5'; g.lineWidth = 0.6; g.stroke();
      });
    }
  };

  // ---- 화면 부품 ----
  function ensureStyle() { if (!document.getElementById(STYLE_ID)) { const s = el('style', { id: STYLE_ID }); s.textContent = CSS; document.head.appendChild(s); } }
  const toolBtns = [], colorBtns = [], panels = [];
  function refresh() {
    toolBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === ed.tool)));
    colorBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === ed.color)));
    for (const p of panels) p();
  }
  ed.refresh = refresh;
  ed.buildToolbar = (host) => {
    ensureStyle();
    const bar = el('div', { class: 'pe-bar', role: 'toolbar', 'aria-label': '장면 편집 도구' });
    for (const [id, label] of TOOLS) {
      const b = el('button', { type: 'button', 'data-tool': id, text: label, 'aria-pressed': 'false' });
      b.addEventListener('click', () => ed.setTool(id)); toolBtns.push(b); bar.appendChild(b);
    }
    const cols = el('span', { class: 'pe-colors', role: 'group', 'aria-label': '색 고르기' });
    for (const c of COLOR_NAMES) {
      const b = el('button', { type: 'button', 'data-color': c, 'aria-label': COLORS[c].ko, title: COLORS[c].ko, style: `background:${rgbS(COLORS[c].rgb)};border:2px solid ${c === 'white' ? '#999' : 'rgba(0,0,0,.35)'}` });
      b.addEventListener('click', () => ed.setColor(c)); colorBtns.push(b); cols.appendChild(b);
    }
    bar.appendChild(cols);
    const del = el('button', { type: 'button', text: '선택 지우기' }); del.addEventListener('click', () => { if (!ed.deleteSelected()) say('지울 소품을 먼저 선택하세요.'); }); bar.appendChild(del);
    ed.msgEl = el('span', { class: 'pe-msg', role: 'status', 'aria-live': 'polite' }); bar.appendChild(ed.msgEl);
    host.appendChild(bar); refresh(); say(HINT[ed.tool]); return bar;
  };
  ed.buildMapPanel = (host) => {
    ensureStyle();
    const box = el('div', { class: 'pe-map' });
    const row1 = el('div', { class: 'pe-row' }, [el('span', { text: '모양 고르기', style: 'font-size:13.5px;font-weight:700' })]);
    for (const [k, ko] of TRACK_KINDS) { const b = el('button', { type: 'button', text: ko, 'data-preset': k }); b.addEventListener('click', () => ed.preset(k)); row1.appendChild(b); }
    const row2 = el('div', { class: 'pe-row' });
    const wIn = el('input', { type: 'range', min: '2', max: '10', step: '0.5', value: '4', 'aria-label': '선 굵기(cm)', id: 'pe-width' }), wOut = el('span', { text: '4cm' });
    wIn.addEventListener('input', () => { ed.setWidth(wIn.value); wOut.textContent = wIn.value + 'cm'; });
    const cl = el('input', { type: 'checkbox', id: 'pe-closed', 'aria-label': '선을 닫기' });
    cl.addEventListener('change', () => ed.setClosed(cl.checked));
    row2.append(el('label', {}, [el('span', { text: '선 굵기' }), wIn, wOut]), el('label', {}, [cl, el('span', { text: '끝을 이어 닫기' })]));
    const row3 = el('div', { class: 'pe-row' });
    const mk = (text, fn, id) => { const b = el('button', { type: 'button', text, id }); b.addEventListener('click', fn); row3.appendChild(b); return b; };
    mk('선 점 편집', () => ed.setTool('track'), 'pe-edit'); mk('새 선 추가', () => ed.newTrack()); mk('선 모두 지우기', () => ed.clearTracks());
    const row4 = el('div', { class: 'pe-row' });
    const ta = el('textarea', { 'aria-label': '지도 글자(JSON)', spellcheck: 'false', hidden: '', id: 'pe-json' });
    const mk4 = (text, fn, id) => { const b = el('button', { type: 'button', text, id }); b.addEventListener('click', fn); row4.appendChild(b); return b; };
    mk4('💾 저장', () => ed.save(), 'pe-save'); mk4('📂 저장한 지도 불러오기', () => ed.load(), 'pe-load');
    mk4('내보내기', () => { ta.hidden = false; ta.value = ed.exportText(); ta.select(); say('글자를 복사해 두면 나중에 가져올 수 있어요.'); }, 'pe-export');
    mk4('가져오기', () => { if (ta.hidden) { ta.hidden = false; ta.value = ''; say('가져올 글자를 붙여 넣고 [가져오기]를 다시 누르세요.'); } else ed.importText(ta.value); }, 'pe-import');
    box.append(row1, row2, row3, row4, ta);
    panels.push(() => { const t = pressedTrack(); if (t) { wIn.value = String(t.width); wOut.textContent = t.width + 'cm'; cl.checked = !!t.closed; } });
    host.appendChild(box); refresh(); return box;
  };
  ed.destroy = () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); };
  Object.defineProperty(ed, 'selection', { get: () => ed.sel });
  return ed;
}
