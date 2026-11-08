// 엔딩 모션 "별이 모여 눈이 되다" — '로보독의 첫 산책' 마지막 컷에서 바로 이어지는 8.2초 + 시작 카드 자리로 정리 0.9초.
// 1) 마지막 화면(언덕·보름달)에서 카메라가 달로 올라가며 같은 붓결의 그림책 하늘로 녹아듦
// 2) 별들이 소용돌이치며 날아와 8×8 LED 눈 두 개가 됨  3) 달 앞에 알약형 머리(실제 빅아이 로보독)가 역광 실루엣으로
// 4) 눈이 켜지고 두리번·깜빡·^^  5) 제목  6) (카드 모드) 달·로보독이 위로 올라가 아래 시작 카드에 자리를 내줌
// 시간 t의 순수 함수라 seek(초)로 어느 시각이든 같은 장면. 쓰는 곳: intro-logo.html(본편 렌더·미리 보기),
// index.html(인트로 영상 intro.mp4에는 본편까지 구워 넣고, 영상이 끝나면 여기서 카드 자리로 정리 + 시작 카드 뒤 배경)
export const DUR = 8.2, OUT = 0.9;

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const CREAM = '#fff4c8';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOut = (x) => 1 - Math.pow(1 - x, 3);
const eInOut = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eQuint = (x) => (x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2);
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const bump = (t, c, w) => Math.exp(-Math.pow((t - c) / w, 2));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// ---------- 공용 준비물(한 번만 만듦, 시드 고정) ----------
let SKY = null, MOONTEX = null, GRAINC = null;
function assets() {
  if (SKY) return;
  { // 그림책 하늘: 달을 감싸 도는 짧은 붓결 수천 개
    const w = 1280, h = 1280, [c, x] = mk(w, h), cx = w * .5, cy = h * .36;
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a6894'); gr.addColorStop(.5, '#1f5c88'); gr.addColorStop(1, '#16466e');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const cols = ['#3479a1', '#5d95ab', '#1a5a84', '#15435f', '#4c88a3', '#2b6b96', '#6fa3b6'];
    for (let i = 0; i < 5200; i++) {
      const r = 40 + Math.pow(rnd(i + 11), .8) * 900, a0 = rnd(i + 22) * Math.PI * 2, span = (.05 + rnd(i + 33) * .16) * (220 / (r + 120));
      const near = Math.max(0, 1 - r / 420);
      x.strokeStyle = near > .4 && rnd(i + 44) < near * .6 ? `rgba(240,228,180,${.10 + rnd(i + 55) * .14})` : cols[(rnd(i + 66) * cols.length) | 0];
      x.globalAlpha = .22 + rnd(i + 77) * .35; x.lineWidth = 1.5 + rnd(i + 88) * 3.5; x.lineCap = 'round';
      x.beginPath(); x.arc(cx, cy, r, a0, a0 + span); x.stroke();
    }
    x.globalAlpha = 1; SKY = c;
  }
  { // 크림색 달 + 흩어진 붓결(과녁 무늬·분화구 없음)
    const s = 512, [c, x] = mk(s, s), r = s / 2;
    const gr = x.createRadialGradient(r * .8, r * .75, r * .1, r, r, r); gr.addColorStop(0, '#fffbe6'); gr.addColorStop(.6, CREAM); gr.addColorStop(1, '#f6e7a8');
    x.fillStyle = gr; x.beginPath(); x.arc(r, r, r, 0, 7); x.fill();
    x.save(); x.beginPath(); x.arc(r, r, r - 1, 0, 7); x.clip();
    for (let i = 0; i < 1400; i++) {
      const ox = r + (rnd(i + 410) - .5) * r * .9, oy = r + (rnd(i + 420) - .5) * r * .9;
      const rr = 10 + rnd(i + 500) * r * .7, a0 = rnd(i + 600) * 7, span = .12 + rnd(i + 700) * .3, warm = rnd(i + 800) > .5;
      x.strokeStyle = warm ? `rgba(236,208,140,${.07 + rnd(i + 900) * .09})` : `rgba(255,252,236,${.10 + rnd(i + 950) * .12})`;
      x.lineWidth = 2 + rnd(i + 990) * 4; x.lineCap = 'round'; x.beginPath(); x.arc(ox, oy, rr, a0, a0 + span); x.stroke();
    }
    x.restore(); MOONTEX = c;
  }
  { // 종이·크레용 결
    const s = 420, [c, x] = mk(s, s);
    for (let i = 0; i < 9000; i++) {
      const X = rnd(i) * s, Y = rnd(i + 9e3) * s, a = -.35 + (rnd(i + 2e4) - .5) * 1.1, L = 3 + rnd(i + 3e4) * 9, light = rnd(i + 4e4) > .5;
      x.strokeStyle = light ? `rgba(255,248,225,${.05 + rnd(i + 5e4) * .09})` : `rgba(0,10,30,${.06 + rnd(i + 6e4) * .10})`;
      x.lineWidth = .8 + rnd(i + 7e4) * .9; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * L, Y + Math.sin(a) * L); x.stroke();
    }
    GRAINC = c;
  }
}

// 시작 화면에서 보름달 찾기: 위쪽 40%의 크림색 덩어리 → 중심·반지름(위가 잘린 달도 현의 길이로 계산)
export function findMoon(src) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  if (!sw || !sh) return null;
  const w = 200, h = Math.round(200 * sh / sw), [, x] = mk(w, h);
  x.drawImage(src, 0, 0, w, h);
  let d; try { d = x.getImageData(0, 0, w, Math.round(h * .4)).data; } catch (e) { return null; }
  const H4 = Math.round(h * .4); let yt = -1, yb = -1, best = 0, bestY = 0, sx = 0, n = 0;
  for (let y = 0; y < H4; y++) {
    let x0 = -1, x1 = -1;
    for (let i = 0; i < w; i++) { const k = (y * w + i) * 4, r = d[k], g = d[k + 1], b = d[k + 2]; if (r > 225 && g > 210 && b > 140 && r - b < 110) { if (x0 < 0) x0 = i; x1 = i; sx += i; n++; } }
    if (x0 >= 0 && x1 - x0 >= 2) { if (yt < 0) yt = y; yb = y; if (x1 - x0 > best) { best = x1 - x0; bestY = y; } }
  }
  if (n < 12 || yb < 0) return null;
  const cx = sx / n, k = sw / w;
  let r, cy;
  if (bestY <= 1 && yt <= 1) { const c = best / 2, hgt = Math.max(1, yb); r = (c * c + hgt * hgt) / (2 * hgt); cy = yb - r; }   // 위가 잘림
  else { r = best / 2; cy = bestY; }
  return { x: cx * k, y: cy * k, r: r * k };
}

// ---------- 로보독 머리·눈 (단위 좌표, 머리 가운데 0,0) ----------
const HEAD = { w: 560, h: 300 }, PITCH = 22, N = 8, EYE_X = 136;
const PAT = {
  off:   ['........', '........', '........', '........', '........', '........', '........', '........'],
  open:  ['........', '...##...', '..####..', '..####..', '..####..', '..####..', '...##...', '........'],
  blink: ['........', '........', '........', '........', '..####..', '........', '........', '........'],
  happy: ['........', '........', '...##...', '..#..#..', '.#....#.', '#......#', '........', '........'],
};
// [시각, 모양, 가로 이동(점)] — 켜짐 뒤 정지, 왼쪽, 천천히 오른쪽, 가운데, 깜빡, ^^
const KEYS = [[0, 'off', 0], [3.75, 'open', 0], [4.2, 'open', -2], [4.62, 'open', 2], [5.0, 'open', 0], [5.3, 'blink', 0], [5.42, 'open', 0], [5.68, 'happy', 0]];
const bit = (name, r, c) => { const row = PAT[name][r]; return c >= 0 && c < N && row[c] === '#' ? 1 : 0; };
function lit(r, c, t) {
  const tt = t - (t < 4 ? r * .03 : 0);
  let k = 0; for (let i = 0; i < KEYS.length; i++) if (tt >= KEYS[i][0]) k = i;
  const cur = KEYS[k], prev = KEYS[Math.max(0, k - 1)], m = prog(tt, cur[0], cur[0] + .06);
  return lerp(bit(prev[1], r, c - prev[2]), bit(cur[1], r, c - cur[2]), m);
}
const DOTS = [];
for (let e = 0; e < 2; e++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const i = DOTS.length;
  DOTS.push({ r, c, ux: (e ? EYE_X : -EYE_X) + (c - 3.5) * PITCH, uy: (r - 3.5) * PITCH,
    sx: rnd(i + 101), sy: rnd(i + 202), tw: .6 + rnd(i + 303) * .9, fly: 2.1 + rnd(i + 404) * .7, size: .8 + rnd(i + 505) * .7 });
}

// canvas: 그릴 캔버스, inset(): 아래쪽에 시작 카드가 덮는 비율(0~1, 카드 모드에서 씀)
export function createEnding(canvas, { inset = () => 0 } = {}) {
  assets();
  const g = canvas.getContext('2d');
  const GRAIN = g.createPattern(GRAINC, 'repeat');
  let W = 1920, H = 1080, px = 1, portrait = false;
  let IMG = null, MOON = { x: 425, y: -28, r: 70 }, cur = 0, raf = 0, t0 = 0, running = false, onDone = null, stopAt = DUR + OUT;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    portrait = ch > cw * 1.05; W = portrait ? 1080 : 1920; px = canvas.width / W; H = canvas.height / px;
  }
  // 시작 화면(마지막 프레임). 위쪽 가장자리는 하늘로 흐리게
  function setFrom(src) {
    IMG = null; if (!src) return;
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight; if (!w || !h) return;
    const [c, x] = mk(w, h); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'destination-in';
    const gr = x.createLinearGradient(0, 0, 0, h * .14); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h); IMG = c;
    const m = findMoon(src); MOON = m && m.r > w * .02 ? m : { x: w * .5, y: -h * .05, r: w * .055 };
  }

  function layout() {
    const L = portrait
      ? { mx: W / 2, my: H * .30, mr: 330, k: .74, eyebrowY: H * .53, titleY: H * .60, ts: 112, subY: H * .655, ss: 38, two: true, footY: H - 150, track: 0 }
      : { mx: W / 2, my: H * .335, mr: 296, k: .7, eyebrowY: H * .715, titleY: H * .818, ts: 120, subY: H * .895, ss: 38, two: false, footY: H - 34, track: 3 };
    // 카드 모드: 카드가 덮지 않는 위쪽 공간 가운데로 달·로보독을 옮겨 작게
    const free = H * (1 - clamp(inset(), 0, .8)), cr = Math.min(L.mr, free * (portrait ? .30 : .36));
    L.cmy = Math.max(cr + H * .06, free * .5); L.cmr = cr;
    return L;
  }

  function render(t) {
    const L = layout(), out = eInOut(prog(t, DUR, DUR + OUT));
    g.setTransform(px, 0, 0, px, 0, 0);
    const deep = eInOut(prog(t, .8, 3.2));

    // 카메라: 시작 화면 속 달을 붙잡고 가운데 위로 끌어오며 확대(달이 기준점)
    const iw = IMG ? IMG.width : 1280, ih = IMG ? IMG.height : 720;
    const s0 = Math.max(W / iw, H / ih), x0 = (W - iw * s0) / 2, y0 = (H - ih * s0) / 2;
    const M0x = x0 + MOON.x * s0, M0y = y0 + MOON.y * s0, r0 = MOON.r * s0;
    const cam = eQuint(prog(t, .25, 2.6));
    const breathe = 1 + .012 * Math.sin(Math.max(0, t - 6.2) * 1.6) * prog(t, 6.2, 6.8) * (1 - out);
    const tmr = lerp(L.mr, L.cmr, out), tmy = lerp(L.my, L.cmy, out);
    const mr = r0 * Math.pow(tmr / r0, cam) * breathe, mx = lerp(M0x, L.mx, cam), my = lerp(M0y, tmy, eInOut(prog(t, .25, 2.6)));
    const si = s0 * mr / r0, scale = mr / L.mr / breathe;

    // 1) 그림책 하늘(시차), 깊어지는 밤
    const ss = Math.max(W, H) / 1280 * (1.35 + cam * .25);
    g.drawImage(SKY, mx - SKY.width * .5 * ss, my - SKY.height * .36 * ss, SKY.width * ss, SKY.height * ss);
    g.fillStyle = `rgba(6,18,44,${.58 * deep})`; g.fillRect(0, 0, W, H);
    const pulse = bump(t, 6.2, .22);
    const halo = g.createRadialGradient(mx, my, mr * .8, mx, my, mr * 2.7);
    halo.addColorStop(0, `rgba(255,236,180,${.34 + .18 * pulse})`); halo.addColorStop(.4, 'rgba(255,225,160,.10)'); halo.addColorStop(1, 'rgba(255,225,160,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);

    // 2) 시작 화면: 달에 붙어 함께 움직이며 사라짐
    const imgA = 1 - eInOut(prog(t, .9, 2.3));
    if (IMG && imgA > 0) { g.globalAlpha = imgA; g.drawImage(IMG, mx - MOON.x * si, my - MOON.y * si, iw * si, ih * si); g.globalAlpha = 1; }

    // 3) 보름달
    const moonA = eOut(prog(t, .05, .6));
    if (moonA > 0) { g.save(); g.globalAlpha = moonA; g.shadowColor = 'rgba(255,236,170,.85)'; g.shadowBlur = 50 + 30 * pulse; g.drawImage(MOONTEX, mx - mr, my - mr, mr * 2, mr * 2); g.restore(); }

    // 4) 머리: 역광 실루엣, 점이 대부분 도착한 뒤 가운데에서 번지며
    const hk = L.k * scale, hx = mx, hy = my - mr * .04;
    const reveal = eOut(prog(t, 3.25, 3.8));
    if (reveal > 0) {
      g.save(); g.translate(hx, hy); g.scale(hk, hk);
      g.beginPath(); g.ellipse(0, 0, HEAD.w * .78 * reveal, HEAD.h * 1.2 * reveal, 0, 0, 7); g.clip();
      const pill = (x, y, w, h) => { const r = h / 2; g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(x + r, y + h); g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); };
      g.save(); g.shadowColor = 'rgba(255,236,170,.75)'; g.shadowBlur = 34; pill(-HEAD.w / 2, -HEAD.h / 2, HEAD.w, HEAD.h); g.fillStyle = '#0b0e14'; g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,244,200,.55)'; g.lineWidth = 3; pill(-HEAD.w / 2, -HEAD.h / 2, HEAD.w, HEAD.h); g.stroke();
      pill(-HEAD.w / 2 + 22, -HEAD.h / 2 + 22, HEAD.w - 44, HEAD.h - 44); g.fillStyle = '#181e2a'; g.fill();
      [-EYE_X, EYE_X].forEach((ex) => { g.beginPath(); g.roundRect(ex - 98, -98, 196, 196, 40); g.fillStyle = '#090c13'; g.fill(); });
      g.fillStyle = '#05070b'; g.beginPath(); g.arc(0, -22, 22, 0, 7); g.fill(); g.strokeStyle = '#2a3242'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(255,244,200,.7)'; g.beginPath(); g.arc(-7, -29, 5, 0, 7); g.fill();
      g.beginPath(); g.roundRect(-9, 16, 18, 34, 4); g.fillStyle = '#05070b'; g.fill(); g.fillStyle = '#e09a3c'; g.fillRect(-2.5, 36, 5, 7);
      g.restore();
    }

    // 5) 별 → LED 점
    for (let i = 0; i < DOTS.length; i++) {
      const d = DOTS[i], tx = hx + d.ux * hk, ty = hy + d.uy * hk, sx = d.sx * W, sy = d.sy * H * .9;
      const born = prog(t, d.tw, d.tw + .5); if (born <= 0) continue;
      const f = eInOut(prog(t, d.fly, d.fly + 1.0));
      const pos = (q) => {   // 시계방향 소용돌이(하늘 붓결과 같은 방향)
        const mxp = (sx + tx) / 2, myp = (sy + ty) / 2, dx = tx - sx, dy = ty - sy, cx = mxp - dy * .45, cy = myp + dx * .45;
        const a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q;
        return [a * sx + b * cx + c * tx, a * sy + b * cy + c * ty];
      };
      const [x, y] = pos(f);
      const landed = prog(t, d.fly + 1.0, d.fly + 1.4), on = reveal > 0 ? lit(d.r, d.c, t) : 0, tw = .7 + .3 * Math.sin(t * 5 + i * 1.7);
      const a = Math.max(born * (f < 1 ? (f > 0 ? 1 : tw) : lerp(1, .2, eOut(landed))), on);
      const rad = lerp(2.4 * d.size + 1.4, 7.6 * hk, f);
      if (f > 0 && f < 1) for (let k = 1; k <= 6; k++) { const [qx, qy] = pos(Math.max(0, f - k * .03)); g.fillStyle = `rgba(255,232,170,${.18 * (1 - k / 7)})`; g.beginPath(); g.arc(qx, qy, rad * (1 - k * .1), 0, 7); g.fill(); }
      if (on > .02) { g.shadowColor = 'rgba(255,222,140,1)'; g.shadowBlur = 18 * on * scale; }
      g.fillStyle = on > .02 ? `rgba(255,246,214,${a})` : f >= 1 ? `rgba(110,130,165,${a})` : `rgba(255,236,186,${a})`;
      g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.shadowBlur = 0;
    }
    for (let i = 0; i < 70; i++) {
      const a = prog(t, .8 + rnd(i + 900) * 1.2, 1.6 + rnd(i + 900) * 1.2) * (.3 + .3 * Math.sin(t * 2.4 + i * 2.1));
      if (a <= 0) continue; g.fillStyle = `rgba(255,240,205,${a})`; g.beginPath(); g.arc(rnd(i + 700) * W, rnd(i + 800) * H * .7, .9 + rnd(i + 1e3) * 1.6, 0, 7); g.fill();
    }

    // 6) 글자: ^^가 혼자 자리 잡은 뒤 차례로, 카드 모드에서는 물러남(카드가 문구를 이어받음)
    const fadeOut = 1 - eOut(prog(t, DUR, DUR + OUT * .6));
    const txt = (s, x, y, size, w, col, a, rise, track = 0) => {
      a *= fadeOut; if (a <= 0) return; g.save(); g.globalAlpha = a; g.font = `${w} ${size}px ${FONT}`; g.textAlign = 'center'; g.fillStyle = col;
      if (track) g.letterSpacing = track + 'px';
      g.shadowColor = 'rgba(4,14,32,.6)'; g.shadowBlur = 16; g.fillText(s, x, y + rise - out * 30); g.restore();
    };
    const e1 = eOut(prog(t, 6.0, 6.8)), e2 = eOut(prog(t, 6.1, 7.0)), e3 = eOut(prog(t, 6.55, 7.3)), e5 = eOut(prog(t, 6.7, 7.45)), e4 = eOut(prog(t, 6.95, 7.6));
    txt('로보독 AI 교실', L.mx, L.eyebrowY, 34, 700, '#f3d98f', e1, (1 - e1) * 14, portrait ? 4 : 6);
    txt('빅아이 로보독', L.mx, L.titleY, L.ts, 800, CREAM, e2, (1 - e2) * 24, L.track);
    if (L.two) {
      txt('AI가 보고, 마이크로비트가 전하고,', L.mx, L.subY, L.ss, 500, '#dbe5f5', e3, (1 - e3) * 12);
      txt('로보독이 움직여요', L.mx, L.subY + L.ss * 1.45, L.ss, 500, '#dbe5f5', e5, (1 - e5) * 12);
    } else txt('AI가 보고, 마이크로비트가 전하고, 로보독이 움직여요', L.mx, L.subY, L.ss, 500, '#dbe5f5', e3, (1 - e3) * 12);
    txt('코코아팹 협력', L.mx, L.footY, 28, 500, 'rgba(219,229,245,.85)', e4, 0);

    // 7) 종이 결: 1/12초마다 흔들림(손그림 보일링), 끝 0.5초부터 멈춤
    const j = Math.floor(Math.min(t, DUR - .5) * 12);
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .85;
    g.translate(rnd(j) * 420, rnd(j + 77) * 420); g.fillStyle = GRAIN; g.fillRect(-420, -420, W + 840, H + 840); g.restore();
    const v = g.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(2,10,26,${.5 * deep})`); g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  const loop = (now) => {
    if (!running) return;
    cur = (now - t0) / 1000;
    if (cur >= stopAt) { cur = stopAt; running = false; render(cur); const f = onDone; onDone = null; f && f(); return; }
    render(cur);
    if (cur >= DUR && onDone) { const f = onDone; onDone = null; f(); }   // 본편이 끝나면 카드를 부르고, 정리 동작은 계속
    raf = requestAnimationFrame(loop);
  };
  const api = {
    DUR, OUT,
    setFrom,
    play(done, { card = true, from = 0 } = {}) { cancelAnimationFrame(raf); onDone = done || null; stopAt = card ? DUR + OUT : DUR; running = true; t0 = performance.now() - from * 1000; fit(); raf = requestAnimationFrame(loop); },   // from: 그 시각부터(예: DUR → 카드 자리로 정리만)
    seek(s) { cancelAnimationFrame(raf); running = false; cur = s; fit(); render(s); },
    stop() { cancelAnimationFrame(raf); running = false; onDone = null; },
    resize() { fit(); render(cur); },
    get time() { return cur; }, get running() { return running; },
  };
  fit();
  return api;
}
