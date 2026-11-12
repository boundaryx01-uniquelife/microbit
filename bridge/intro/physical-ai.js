// 인트로 모션 "Physical AI with micro:bit" — 보고 · 생각하고 · 움직이는 AI (14초 + 카드 자리로 정리 1초)
// 마이크로비트 5×5 LED 점 25개가 처음부터 끝까지 주인공: 불씨 → 보드 → 눈(감지) → 신경망(생각) → 로봇에 신호(움직임) → 웃는 로고.
//  0.0–1.6  Spark  빨간 LED 하나가 켜지고 나머지 24개가 물결처럼 → 선으로 그린 마이크로비트 보드
//  1.6–4.4  See    보드가 왼쪽으로, 카메라·초음파·라인 센서 → 데이터 알갱이가 LED로 → LED가 눈 모양
//  4.4–7.4  Think  LED 점이 떠올라 신경망(7-8-7-3)의 노드가 됨 → 초록 카드를 보고 '출발' 노드가 켜짐
//  7.4–10.4 Move   신호가 오른쪽으로 → 로보독(알약 머리·LED 눈, 걷기)·포니봇(메카넘 바퀴, 옆으로 미끄러지기)
// 10.4–14.0 Title  점이 모여 웃는 5×5 LED 마크 + "Physical AI / with micro:bit" + 한국어 부제, 정지
// 14.0–15.0 (카드 모드) 로고가 첫 화면 위쪽 자리(target)로 작아지며 옮겨 가고 배경이 걷힘 → 아래 교구 카드
// render(t)는 시간 t만의 순수 함수(시드 고정 난수만 씀). 가상 폭 1920(가로) / 1080(세로), 높이는 실제 비율.
export const DUR = 14, OUT = 1.0;

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const C = {
  bg: '#f4f6fa', ink: '#111827', muted: '#566077', faint: '#9aa3b5', line: '#e1e6ef', line2: '#cfd6e2',
  accent: '#2456e5', soft: '#e8eefe', red: '#e5484d', yellow: '#f2b300', green: '#1fa463', off: '#dde2eb', node: '#1f2937',
};
const SIG = [C.red, C.yellow, C.green];
const RGB = { red: [229, 72, 77], off: [221, 226, 235], node: [31, 41, 55], accent: [36, 86, 229], yellow: [242, 179, 0], green: [31, 164, 99] };

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOut3 = (x) => 1 - (1 - x) ** 3;
const eOut5 = (x) => 1 - (1 - x) ** 5;
const eExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eIn3 = (x) => x * x * x;
const eIO5 = (x) => (x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2);
const eIO3 = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eBack = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.5, y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; };
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mix = (a, b, k) => `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
const TAU = Math.PI * 2;

// ---------- 5×5 패턴 ----------
const SMILE = ['.....', '.#.#.', '.....', '#...#', '.###.'];
const eyeOn = (r, c, pupil) => (r === 1 || r === 3 ? c >= 1 && c <= 3 : r === 2 ? c === 0 || c === 4 || c === pupil : false);
const pupilAt = (t) => (t < 3.8 ? 2 : t < 4.0 ? 1 : t < 4.2 ? 3 : 2);

// ---------- 신경망 ----------
const LAYERS = [7, 8, 7, 3];
const NODE = [];   // 노드 j → {l, k, n}
LAYERS.forEach((n, l) => { for (let k = 0; k < n; k++) NODE.push({ l, k, n }); });
// 점 i(=r*5+c) → 노드: 왼쪽 열부터 차례로 층을 채우고 층 안에서는 위→아래
const DOT_NODE = new Array(25), NODE_DOT = new Array(25);
{
  const order = [...Array(25).keys()].sort((a, b) => ((a % 5) * 10 + ((a / 5) | 0)) - ((b % 5) * 10 + ((b / 5) | 0)));
  let p = 0;
  LAYERS.forEach((n, l) => {
    const grp = order.slice(p, p + n).sort((a, b) => (((a / 5) | 0) * 5 + (a % 5)) - (((b / 5) | 0) * 5 + (b % 5)));
    grp.forEach((d, k) => { const j = p + k; DOT_NODE[d] = j; NODE_DOT[j] = d; }); p += n;
  });
}
const EDGES = [];   // [from, to, layer, active, colorIdx]
{
  let base = 0, e = 0;
  for (let l = 0; l < LAYERS.length - 1; l++) {
    const n0 = LAYERS[l], n1 = LAYERS[l + 1];
    for (let a = 0; a < n0; a++) for (let b = 0; b < n1; b++, e++) {
      const last = l === LAYERS.length - 2;
      const act = last ? (b === 2 && rnd(e + 50) < .7) : rnd(e + 50) < .32;
      const col = last ? 2 : (rnd(e + 90) < .6 ? 2 : rnd(e + 91) < .5 ? 1 : 0);
      EDGES.push([base + a, base + n0 + b, l, act, col]);
    }
    base += n0;
  }
}
const OUT_LABEL = ['멈춤', '천천히', '출발'];

// ---------- 보드(단위 좌표, 가운데 0,0) ----------
const BW = 560, BH = 440, BR = 34, PITCH = 56, MY = -18;

export function createIntro(canvas, opts = {}) {
  const G0 = canvas.getContext('2d'); let g = G0;
  const LAYER = document.createElement('canvas'), LG = LAYER.getContext('2d');   // 로봇이 사라질 때 한 덩어리로 흐리게
  const target = opts.target || null;          // () => {x,y,w,h} CSS px(캔버스 기준) — 카드 모드에서 로고가 갈 자리
  let hero = false;                            // true: 캔버스 자체가 첫 화면 위쪽 자리 → 로고만 그림
  let W = 1920, H = 1080, px = 1, k = 1, portrait = false, cw = 1, ch = 1;
  let cur = 0, raf = 0, t0 = 0, running = false, onDone = null, stopAt = DUR;
  const DASH = [0, 0], NODASH = [];

  // ---- 미리 그린 빛(글로) 스프라이트 ----
  const GLOW = {};
  for (const [name, col] of [['red', RGB.red], ['accent', RGB.accent], ['green', RGB.green], ['yellow', RGB.yellow]]) {
    const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
    const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, `rgba(${col},.55)`); gr.addColorStop(.35, `rgba(${col},.22)`); gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, s, s); GLOW[name] = c;
  }
  const glow = (name, x, y, r, a) => { if (a <= .01) return; g.globalAlpha = a; g.drawImage(GLOW[name], x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };
  // 아주 옅은 점 격자(공책 느낌)
  let GRID = null;
  { const s = 48, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.fillStyle = '#dfe4ec'; x.beginPath(); x.arc(s / 2, s / 2, 1.3, 0, TAU); x.fill(); GRID = g.createPattern(c, 'repeat'); }

  // 글자 폭(100px 기준) 캐시 — 글꼴이 준비되면 refresh()로 다시 잼
  let TW = null;
  function measure() {
    const m = (txt, w, ls) => { g.font = `${w} 100px ${FONT}`; g.letterSpacing = ls + 'px'; const v = g.measureText(txt).width; g.letterSpacing = '0px'; return v; };
    TW = { p: m('Physical ', 800, -3), ai: m('AI', 800, -3), w: m('with micro:bit', 500, -1), ko: m('보고 · 생각하고 · 움직이는 인공지능 교실', 600, -1) };
  }

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = canvas.clientWidth || innerWidth; ch = canvas.clientHeight || innerHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr)); LAYER.width = canvas.width; LAYER.height = canvas.height;
    portrait = !hero && ch > cw * 1.05; W = portrait ? 1080 : 1920; px = canvas.width / W; H = canvas.height / px; k = cw / W;
  }
  const V = () => g.setTransform(px, 0, 0, px, 0, 0);

  // ================= 레이아웃 =================
  // 보드 위치·크기
  let BX = 0, BY = 0, BS = 1;
  function board(t) {
    const m = eIO5(prog(t, 1.72, 2.5));
    if (portrait) { BX = W / 2; BY = lerp(H * .42, H * .25, m); BS = lerp(1.28, .98, m); }
    else { BX = lerp(W / 2, 520, m); BY = lerp(H * .47, H * .46, m); BS = lerp(1.0, .80, m); }
    BS *= lerp(1, .9, eIO3(prog(t, 4.45, 5.0)));
  }
  // 신경망 노드 위치(그룹 변환 포함)
  const NX = new Float32Array(25), NY = new Float32Array(25);
  let NCX = 0, NCY = 0, GS = 1, GX = 0, GY = 0, CARDX = 0, CARDY = 0;
  function net(t) {
    let cx, cy;
    if (portrait) {
      cx = W / 2; cy = H * .5; const dy = 190, y0 = cy - 1.5 * dy + 70;
      for (let j = 0; j < 25; j++) { const n = NODE[j], gap = n.l === 3 ? 250 : 118; NX[j] = cx + (n.k - (n.n - 1) / 2) * gap; NY[j] = y0 + n.l * dy; }
      CARDX = cx; CARDY = y0 - 330; NCX = cx; NCY = y0 + 1.5 * dy;
    } else {
      cx = W * .52; cy = H * .47; const dx = 190, x0 = cx - 1.5 * dx;
      for (let j = 0; j < 25; j++) { const n = NODE[j], gap = n.l === 3 ? 120 : 74; NX[j] = x0 + n.l * dx; NY[j] = cy + (n.k - (n.n - 1) / 2) * gap; }
      CARDX = x0 - 330; CARDY = cy; NCX = x0 + 1.5 * dx; NCY = cy;
    }
    // Move 장면: 망을 작게 줄여 왼쪽(세로: 위)으로
    const m = eIO5(prog(t, 7.4, 8.15));
    GS = lerp(1, portrait ? .46 : .52, m);
    GX = lerp(NCX, portrait ? W / 2 : 330, m); GY = lerp(NCY, portrait ? H * .13 : H * .46, m);
  }
  const nx = (j) => GX + (NX[j] - NCX) * GS, ny = (j) => GY + (NY[j] - NCY) * GS;

  // 로보독·포니봇 자리
  let DOGX = 0, DOGY = 0, DOGS = 1, PONX = 0, PONY = 0, PONS = 1;
  function robots() {
    if (portrait) { DOGX = W / 2 - 20; DOGY = H * .465; DOGS = 2.2; PONX = W / 2 + 10; PONY = H * .705; PONS = 2.0; }
    else { DOGX = 1030; DOGY = H * .66; DOGS = 2.05; PONX = 1530; PONY = H * .69; PONS = 1.85; }
  }

  // 로고(마크 + 글자) 배치: box 안에서 가운데. side=가로 배치
  const LK = { mx: 0, my: 0, m: 0, tx1: 0, ty1: 0, s1: 0, tx2: 0, ty2: 0, s2: 0, tx3: 0, ty3: 0, s3: 0 };
  const LA = { ...LK }, LB = { ...LK };
  function lockLayout(o, x, y, w, h, m, side) {
    if (!TW) measure();
    if (side) {
      const s1 = m * .44, s2 = m * .2, s3 = m * .118, gap = m * .2;
      const tw = Math.max((TW.p + TW.ai) * s1, TW.w * s2, TW.ko * s3) / 100;
      const left = x + (w - (m + gap + tw)) / 2, top = y + (h - m) / 2;
      o.mx = left + m / 2; o.my = top + m / 2; o.m = m;
      o.tx1 = o.tx2 = o.tx3 = left + m + gap;
      o.s1 = s1; o.s2 = s2; o.s3 = s3; o.ty1 = top + m * .44; o.ty2 = top + m * .72; o.ty3 = top + m * .97;
    } else {
      const s1 = m * .5, s2 = m * .235, s3 = m * .15;
      const total = m + m * .28 + s1 * .78 + s2 * 1.25 + s3 * 1.9;
      const top = y + (h - total) / 2;
      o.mx = x + w / 2; o.my = top + m / 2; o.m = m; o.s1 = s1; o.s2 = s2; o.s3 = s3;
      o.ty1 = top + m + m * .28 + s1 * .78; o.ty2 = o.ty1 + s2 * 1.4; o.ty3 = o.ty2 + s3 * 2.0;
      o.tx1 = x + w / 2 - (TW.p + TW.ai) * s1 / 200; o.tx2 = x + w / 2 - TW.w * s2 / 200; o.tx3 = x + w / 2 - TW.ko * s3 / 200;
    }
  }
  // 카드 모드 목표(CSS px) → 가상 좌표
  function targetLayout(o, r) {
    const side = r.w >= 640;
    let m;
    if (side) { m = clamp(r.h * .52, 84, 150); if (!TW) measure(); const need = (wd) => m + m * .2 + (TW.p + TW.ai) * m * .44 / 100; while (need() > r.w - 40 && m > 60) m -= 4; }
    else m = clamp(Math.min(r.w * .24, r.h * .34), 60, 112);
    lockLayout(o, r.x / k, r.y / k, r.w / k, r.h / k, m / k, side);
    if (!side) { const minS3 = 14 / k; if (o.s3 < minS3) { const d = minS3 - o.s3; o.s3 = minS3; o.ty3 += d * 1.2; o.tx3 = (r.x + r.w / 2) / k - TW.ko * o.s3 / 200; } }
  }
  function lockup(t) {
    if (hero) { targetLayout(LK, { x: 0, y: 0, w: cw, h: ch }); return 1; }
    if (portrait) lockLayout(LA, 0, H * .06, W, H * .82, 330, false);
    else lockLayout(LA, 0, -10, W, H, 270, true);
    const out = target ? eIO5(prog(t, DUR, DUR + OUT)) : 0;
    if (out > 0) { targetLayout(LB, target()); for (const key in LK) LK[key] = lerp(LA[key], LB[key], out); }
    else for (const key in LK) LK[key] = LA[key];
    return out;
  }
  // 마크 안 점 i 자리
  const markX = (i) => LK.mx + ((i % 5) - 2) * LK.m * .158, markY = (i) => LK.my + (((i / 5) | 0) - 2) * LK.m * .158;

  // ================= 그리기 부품 =================
  const rrect = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  // 가운데 위에서 좌우로 동시에 그려지는 둥근 사각형(가운데 0,0)
  function rrDraw(w, h, r, p, col, lw, a) {
    const L = w + h - 4 * r + Math.PI * r;
    for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(sd * (w / 2 - r), -h / 2); g.arcTo(sd * w / 2, -h / 2, sd * w / 2, -h / 2 + r, r);
      g.lineTo(sd * w / 2, h / 2 - r); g.arcTo(sd * w / 2, h / 2, sd * (w / 2 - r), h / 2, r); g.lineTo(0, h / 2);
      strokeP(p, L, col, lw, a);
    }
  }
  const dash = (p, len) => { if (p >= 1) { g.setLineDash(NODASH); return; } DASH[0] = Math.max(.001, p * len); DASH[1] = len + 10; g.setLineDash(DASH); };
  function strokeP(p, len, col = C.ink, lw = 3, a = 1) {
    if (p <= 0 || a <= 0) return; g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    dash(p, len); g.stroke(); g.setLineDash(NODASH); g.globalAlpha = 1;
  }
  function text(s, x, y, size, weight, col, a, opt = {}) {
    if (a <= .005) return;
    g.save(); g.globalAlpha = a; g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = opt.align || 'left'; g.textBaseline = 'alphabetic';
    g.letterSpacing = (opt.ls || 0) + 'px'; g.fillText(s, x, y); g.restore();
  }

  // ---- 마이크로비트 보드(선 그림) ----
  function drawBoard(t) {
    const a = 1 - eOut3(prog(t, 4.45, 4.95)); if (a <= 0) return;
    const p1 = eIO3(prog(t, .62, 1.45)), p2 = eOut3(prog(t, 1.0, 1.6));
    g.save(); g.translate(BX, BY); g.scale(BS, BS);
    const lw = 3 / Math.max(BS, .6);
    rrDraw(BW, BH, BR, p1, C.ink, lw, a);
    text('micro:bit', 0, BH / 2 + 58, 34, 700, C.muted, a * eOut3(prog(t, 1.3, 1.75)), { align: 'center', ls: -.3 });
    // 단추 A·B
    for (const sx of [-1, 1]) {
      const x = sx * 196, y = MY;
      rrect(x - 34, y - 34, 68, 68, 12); strokeP(p2, 280, C.line2, lw * .8, a);
      g.beginPath(); g.arc(x, y, 21, 0, TAU); strokeP(p2, 140, C.ink, lw, a);
      text(sx < 0 ? 'A' : 'B', x, y - 52, 26, 800, C.ink, a * eOut3(prog(t, 1.25, 1.6)), { align: 'center' });
    }
    // 아래쪽 가장자리 커넥터: 큰 패드 5개(구멍) + 사이 얇은 핀
    const yc = BH / 2 - 62;
    for (let i = 0; i < 5; i++) {
      const x = -212 + i * 106, pp = eOut3(prog(t, 1.05 + i * .06, 1.45 + i * .06));
      g.beginPath(); g.moveTo(x - 30, BH / 2); g.lineTo(x - 30, yc + 12); g.arcTo(x - 30, yc, x - 18, yc, 12); g.lineTo(x + 18, yc); g.arcTo(x + 30, yc, x + 30, yc + 12, 12); g.lineTo(x + 30, BH / 2);
      strokeP(pp, 170, C.ink, lw * .85, a);
      g.beginPath(); g.arc(x, yc + 26, 11, 0, TAU); strokeP(pp, 70, C.ink, lw * .85, a);
      if (i < 4) for (let q = 0; q < 4; q++) { const fx = x + 44 + q * 6; g.beginPath(); g.moveTo(fx, BH / 2); g.lineTo(fx, BH / 2 - 26); strokeP(pp, 26, C.line2, 2.4, a); }
    }
    g.restore();
  }

  // ---- 센서(선 그림) ----
  function sensorPos(i, out) {   // i: 0 카메라, 1 초음파, 2 라인
    if (portrait) return [200 + i * 340, H * .56 + out * 40];
    return [1260 + out * 60, H * .47 + (i - 1) * 215];
  }
  const SENS_T = [2.35, 2.55, 2.75];
  function drawSensors(t) {
    const out = eIn3(prog(t, 4.35, 4.75)); if (out >= 1 || t < 2.1) return;
    const a0 = 1 - out;
    for (let i = 0; i < 3; i++) {
      const s0 = SENS_T[i], p = eIO3(prog(t, s0, s0 + .55)), fa = eOut3(prog(t, s0 + .3, s0 + .7));
      if (p <= 0) continue;
      const [x, y] = sensorPos(i, out), sc = portrait ? 1.3 : 1;
      g.save(); g.translate(x, y); g.scale(sc, sc);
      if (i === 0) {   // 카메라 눈: 홍채가 좌우를 훑음
        g.beginPath(); g.moveTo(-74, 0); g.quadraticCurveTo(0, -66, 74, 0); g.quadraticCurveTo(0, 66, -74, 0); g.closePath();
        if (fa > 0) { g.globalAlpha = a0 * fa; g.fillStyle = '#fff'; g.fill(); g.globalAlpha = 1; }
        strokeP(p, 340, C.ink, 3, a0);
        const ix = 18 * (-eIO3(prog(t, 3.72, 3.86)) + 2 * eIO3(prog(t, 3.92, 4.08)) - eIO3(prog(t, 4.12, 4.26)));   // LED 눈동자(가운데→왼→오른→가운데)와 맞춤
        g.save(); g.beginPath(); g.moveTo(-74, 0); g.quadraticCurveTo(0, -66, 74, 0); g.quadraticCurveTo(0, 66, -74, 0); g.clip();
        g.globalAlpha = a0 * fa;
        g.fillStyle = C.soft; g.beginPath(); g.arc(ix, 0, 28, 0, TAU); g.fill();
        g.strokeStyle = C.accent; g.lineWidth = 3; g.stroke();
        g.fillStyle = C.ink; g.beginPath(); g.arc(ix, 0, 12, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ix + 5, -5, 3.5, 0, TAU); g.fill();
        g.restore(); g.globalAlpha = 1;
      } else if (i === 1) {   // 초음파: 원 두 개 + 퍼지는 호
        rrect(-66, -36, 132, 72, 14); if (fa > 0) { g.globalAlpha = a0 * fa; g.fillStyle = '#fff'; g.fill(); g.globalAlpha = 1; } strokeP(p, 420, C.ink, 3, a0);
        for (const sx of [-30, 30]) {
          g.beginPath(); g.arc(sx, 0, 22, 0, TAU); strokeP(p, 140, C.ink, 3, a0);
          g.globalAlpha = a0 * fa; g.fillStyle = C.line2; g.beginPath(); g.arc(sx, 0, 11, 0, TAU); g.fill(); g.globalAlpha = 1;
        }
        if (t > 2.85) for (let j = 0; j < 3; j++) {
          const f = ((t - 2.85) * .9 + j / 3) % 1, rr = 30 + f * 70;
          g.beginPath(); g.arc(portrait ? 0 : -60, portrait ? -40 : 0, rr, portrait ? -Math.PI / 2 - .55 : Math.PI - .55, portrait ? -Math.PI / 2 + .55 : Math.PI + .55);
          strokeP(1, 1, C.accent, 3, a0 * (1 - f) * .8 * prog(t, 2.85, 3.1));
        }
      } else {   // 라인 센서: 검은 길 위에서 읽기
        const dy = 16 * Math.sin(Math.max(0, t - 2.9) * 2.6) * prog(t, 2.9, 3.2);
        g.save(); g.beginPath(); g.rect(-100, 4, 200, 60); g.clip();
        g.beginPath(); for (let q = -100; q <= 100; q += 10) { const yy = 34 + dy + 10 * Math.sin(q * .03 + t * 2.4); q === -100 ? g.moveTo(q, yy) : g.lineTo(q, yy); }
        strokeP(p, 260, C.ink, 13, a0 * (.25 + .75 * fa));
        g.restore();
        rrect(-46, -40, 92, 30, 9); if (fa > 0) { g.globalAlpha = a0 * fa; g.fillStyle = '#fff'; g.fill(); g.globalAlpha = 1; } strokeP(p, 260, C.ink, 3, a0);
        for (const sx of [-18, 18]) {
          const lineY = 34 + dy + 10 * Math.sin(sx * .03 + t * 2.4), on = Math.abs(lineY - 34) < 9 ? 1 : 0;
          g.globalAlpha = a0 * fa * .5; g.strokeStyle = on ? C.green : C.line2; g.lineWidth = 2; g.setLineDash([3, 5]);
          g.beginPath(); g.moveTo(sx, -10); g.lineTo(sx, lineY - 8); g.stroke(); g.setLineDash(NODASH);
          g.globalAlpha = a0 * fa; g.fillStyle = on ? C.green : C.line2; g.beginPath(); g.arc(sx, -25, 6, 0, TAU); g.fill(); g.globalAlpha = 1;
        }
      }
      g.restore();
      const lab = ['카메라', '초음파 센서', '라인 센서'][i], la = eOut3(prog(t, s0 + .45, s0 + .85)) * a0;
      if (portrait) text(lab, x, y + 150, 36, 650, C.muted, la, { align: 'center' });
      else text(lab, x + 112, y + 9, 26, 650, C.muted, la);
    }
  }
  // 센서 → LED 데이터 알갱이
  function drawParticles(t) {
    if (t < 2.95 || t > 4.3) return;
    for (let q = 0; q < 42; q++) {
      const si = q % 3, b = 3.0 + (q / 42) * .85 + rnd(q + 7) * .1, f = prog(t, b, b + .6);
      if (f <= 0 || f >= 1) continue;
      const [sx0, sy0] = sensorPos(si, 0);
      const sx = portrait ? sx0 : sx0 - 92, sy = portrait ? sy0 - 110 : sy0;
      const d = (rnd(q + 3) * 25) | 0, tx = BX + ((d % 5) - 2) * PITCH * BS, ty = BY + ((((d / 5) | 0) - 2) * PITCH + MY) * BS;
      const cx = (sx + tx) / 2 + (portrait ? (rnd(q) - .5) * 200 : 0), cy = (sy + ty) / 2 + (portrait ? 0 : (rnd(q) - .5) * 220);
      for (let k2 = 3; k2 >= 0; k2--) {
        const ff = eIO3(Math.max(0, f - k2 * .04)), a = (1 - ff * .2) * (k2 ? .16 * (4 - k2) : 1) * (f < .9 ? 1 : (1 - f) * 10);
        const x = (1 - ff) * (1 - ff) * sx + 2 * (1 - ff) * ff * cx + ff * ff * tx, y = (1 - ff) * (1 - ff) * sy + 2 * (1 - ff) * ff * cy + ff * ff * ty;
        g.globalAlpha = a; g.fillStyle = C.accent; g.beginPath(); g.arc(x, y, k2 ? 3.4 : 4.6, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  // ---- 카드(초록) + 뷰파인더 ----
  function drawCard(t) {
    const pin = eExpo(prog(t, 4.95, 5.6)), out = eIn3(prog(t, 7.4, 7.75));
    if (pin <= 0 || out >= 1) return;
    const a = pin * (1 - out), x = CARDX - (1 - pin) * (portrait ? 0 : 120), y = CARDY - (portrait ? (1 - pin) * 120 : 0), rot = (1 - pin) * -.14 - .035;
    const w = 168, h = 224;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.globalAlpha = a; g.shadowColor = 'rgba(16,24,40,.14)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
    rrect(-w / 2, -h / 2, w, h, 20); g.fillStyle = C.green; g.fill(); g.shadowColor = 'transparent';
    rrect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 12); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2.5; g.stroke();
    g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.strokeStyle = '#fff'; g.lineWidth = 9; g.stroke();
    g.restore(); g.globalAlpha = 1;
    // 뷰파인더 모서리 + 훑는 선
    const vf = eOut5(prog(t, 5.35, 5.8)) * (1 - out);
    if (vf > 0) {
      const ox = w / 2 + 30 + (1 - vf) * 30, oy = h / 2 + 30 + (1 - vf) * 30, L = 30;
      g.save(); g.translate(CARDX, CARDY); g.globalAlpha = vf; g.strokeStyle = C.accent; g.lineWidth = 4; g.lineCap = 'round';
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(sx * ox, sy * (oy - L)); g.lineTo(sx * ox, sy * oy); g.lineTo(sx * (ox - L), sy * oy); g.stroke(); }
      const sp = prog(t, 5.5, 6.1);
      if (sp > 0 && sp < 1) { const yy = -h / 2 - 10 + sp * (h + 20); g.globalAlpha = vf * Math.sin(sp * Math.PI) * .9; g.lineWidth = 3; g.beginPath(); g.moveTo(-w / 2 - 14, yy); g.lineTo(w / 2 + 14, yy); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
    }
  }

  // ---- 신경망 선·신호 ----
  const WAVE = [5.85, 6.2, 6.55], WD = .42;
  function nodeAct(j, t) {   // 신호가 도착한 정도(0~1, 잠깐 빛남)
    const l = NODE[j].l; if (l === 0) return Math.exp(-Math.pow((t - 5.85) / .18, 2));
    const ta = WAVE[l - 1] + WD; let hit = 0;
    for (let e = 0; e < EDGES.length; e++) if (EDGES[e][1] === j && EDGES[e][3]) { hit = 1; break; }
    return hit * Math.exp(-Math.pow((t - ta) / .2, 2));
  }
  function drawNet(t) {
    const fadeA = 1 - eOut3(prog(t, 10.35, 10.85)); if (t < 4.9 || fadeA <= 0) return;
    const lineA = lerp(1, .55, eIO3(prog(t, 7.4, 8.1))) * fadeA;
    // 카드 → 입력 노드
    const cp = eOut3(prog(t, 5.45, 5.95)) * (1 - eIn3(prog(t, 7.4, 7.7)));
    if (cp > 0) for (let j = 0; j < 7; j++) {
      g.beginPath(); g.moveTo(CARDX + (portrait ? 0 : 116), CARDY + (portrait ? 140 : 0)); g.lineTo(nx(j), ny(j));
      g.setLineDash([2, 7]); g.globalAlpha = cp * .8; g.strokeStyle = C.faint; g.lineWidth = 1.6; g.stroke(); g.setLineDash(NODASH); g.globalAlpha = 1;
    }
    for (let e = 0; e < EDGES.length; e++) {
      const [a, b, l] = EDGES[e], p = eIO3(prog(t, 5.0 + l * .17 + rnd(e) * .12, 5.45 + l * .17 + rnd(e) * .12));
      if (p <= 0) continue;
      const x0 = nx(a), y0 = ny(a), x1 = nx(b), y1 = ny(b);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(lerp(x0, x1, p), lerp(y0, y1, p));
      g.globalAlpha = lineA; g.strokeStyle = C.line2; g.lineWidth = 1.3; g.stroke(); g.globalAlpha = 1;
    }
    // 앞으로 흐르는 신호
    for (let e = 0; e < EDGES.length; e++) {
      const E = EDGES[e]; if (!E[3]) continue;
      const f = prog(t, WAVE[E[2]] + rnd(e + 3) * .08, WAVE[E[2]] + WD + rnd(e + 3) * .08); if (f <= 0 || f >= 1) continue;
      const x0 = nx(E[0]), y0 = ny(E[0]), x1 = nx(E[1]), y1 = ny(E[1]), col = ['red', 'yellow', 'green'][E[4]];
      for (let q = 3; q >= 0; q--) {
        const ff = eIO3(Math.max(0, f - q * .05)), x = lerp(x0, x1, ff), y = lerp(y0, y1, ff);
        g.globalAlpha = q ? .14 * (4 - q) : 1; g.fillStyle = SIG[E[4]]; g.beginPath(); g.arc(x, y, q ? 3.2 : 4.6, 0, TAU); g.fill();
      }
      g.globalAlpha = 1; glow(col, lerp(x0, x1, eIO3(f)), lerp(y0, y1, eIO3(f)), 16, .9);
    }
    // 출력 이름표
    const la = eOut3(prog(t, 5.7, 6.1)) * fadeA;
    for (let q = 0; q < 3; q++) {
      const j = 22 + q, lit = q === 2 ? eOut3(prog(t, 6.97, 7.25)) : 0, keep = q === 2 ? 1 : 1 - eOut3(prog(t, 7.4, 7.8));
      const sz = (portrait ? 34 : 26) * lerp(1, 1.0, 0), x = nx(j) + (portrait ? 0 : 30 * GS + 4), y = ny(j) + (portrait ? 64 * GS + 18 : 9);
      const s = portrait ? sz * Math.max(GS, .8) : sz * Math.max(GS, .75);
      text(OUT_LABEL[q], x, y, s, lit > .5 ? 800 : 650, lit > .5 ? C.green : C.muted, la * keep * (lit > .5 ? 1 : lerp(1, .55, prog(t, 6.97, 7.2))), { align: portrait ? 'center' : 'left' });
    }
  }

  // ---- Move: 출력 노드 → 로봇 신호선 ----
  function sigPath(i, f) {   // i: 0 로보독, 1 포니봇. 2차 곡선
    const x0 = nx(24), y0 = ny(24);
    const tx = i ? PONX + (portrait ? 0 : -10) : DOGX + (portrait ? 30 : 40), ty = i ? PONY - 120 * PONS : DOGY - 150 * DOGS;
    const cx = portrait ? lerp(x0, tx, .5) + (i ? 260 : -260) : lerp(x0, tx, .5), cy = portrait ? lerp(y0, ty, .5) : Math.min(y0, ty) - (i ? 200 : 120);
    const u = 1 - f; return [u * u * x0 + 2 * u * f * cx + f * f * tx, u * u * y0 + 2 * u * f * cy + f * f * ty];
  }
  function drawSignals(t) {
    const a = 1 - eOut3(prog(t, 10.3, 10.7)); if (t < 7.85 || a <= 0) return;
    for (let i = 0; i < 2; i++) {
      const p = eIO3(prog(t, 7.9 + i * .12, 8.5 + i * .12));
      g.beginPath(); for (let s = 0; s <= 24; s++) { const [x, y] = sigPath(i, s / 24 * p); s ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.setLineDash([3, 8]); g.globalAlpha = .7 * a; g.strokeStyle = C.accent; g.lineWidth = 2; g.lineCap = 'round'; g.stroke(); g.setLineDash(NODASH); g.globalAlpha = 1;
      for (let q = 0; q < 4; q++) {
        const b = 8.2 + i * .12 + q * .42, f = prog(t, b, b + .55); if (f <= 0 || f >= 1) continue;
        const [x, y] = sigPath(i, eIO3(f));
        glow('green', x, y, 22, a); g.globalAlpha = a; g.fillStyle = C.green; g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      // 도착 고리
      const hit = prog(t, 8.75 + i * .12, 9.35 + i * .12);
      if (hit > 0 && hit < 1) { const [x, y] = sigPath(i, 1); g.beginPath(); g.arc(x, y, 8 + hit * 46, 0, TAU); strokeP(1, 1, C.green, 3, (1 - hit) * a); }
    }
  }

  // ================= 3D 로봇(정투영 + 면 변환) =================
  let OX = 0, OY = 0, S = 1, EXX = 0, EXY = 0, EYY = 0, EZX = 0, EZY = 0, VX = 0, VY = 0, VZ = 0, PX = 0, PY = 0;
  function camera(ox, oy, s, psi, phi) {
    OX = ox; OY = oy; S = s;
    EXX = Math.cos(psi); EXY = Math.sin(psi) * Math.sin(phi); EYY = -Math.cos(phi); EZX = -Math.sin(psi); EZY = Math.cos(psi) * Math.sin(phi);
    VX = Math.sin(psi) * Math.cos(phi); VY = Math.sin(phi); VZ = Math.cos(psi) * Math.cos(phi);
  }
  let LIFT = 0;
  const pj = (X, Y, Z) => { PX = OX + S * (X * EXX + Z * EZX); PY = OY + S * (X * EXY + (Y + LIFT) * EYY + Z * EZY); };
  // 면 변환: 지역 (a,b) → 세계 원점 + a*U + b*V. axis: 'z'(앞면: a=+X, b=-Y) 'x'(옆면: a=+Z, b=-Y) 'y'(윗면: a=+X, b=+Z)
  function face(axis, X, Y, Z) {
    pj(X, Y, Z);
    let ux, uy, vx, vy;
    if (axis === 'z') { ux = EXX; uy = EXY; vx = 0; vy = -EYY; }
    else if (axis === 'x') { ux = EZX; uy = EZY; vx = 0; vy = -EYY; }
    else { ux = EXX; uy = EXY; vx = EZX; vy = EZY; }
    g.setTransform(px * S * ux, px * S * uy, px * S * vx, px * S * vy, px * PX, px * PY);
  }
  let FA = 1, RA = 1, TT = 0;   // 부품 불투명도, 로봇 전체 알파, 현재 시각
  // 조립: 부품마다 시작 시각 → 위에서 내려앉으며 나타남
  function part(t0) { const p = prog(TT, t0, t0 + .42); FA = eOut3(p); LIFT = (1 - eOut5(p)) * 34; return FA > 0; }
  function paint(fill, lw = 1.4) {
    V(); if (FA <= 0) return;
    g.globalAlpha = RA * FA; g.fillStyle = fill; g.fill();
    g.globalAlpha = RA * FA * .22; g.strokeStyle = C.ink; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
    g.globalAlpha = 1;
  }
  function quad(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3) {
    g.beginPath(); pj(x0, y0, z0); g.moveTo(PX, PY); pj(x1, y1, z1); g.lineTo(PX, PY); pj(x2, y2, z2); g.lineTo(PX, PY); pj(x3, y3, z3); g.lineTo(PX, PY); g.closePath();
  }
  function box(x0, x1, y0, y1, z0, z1, cTop, cFront, cSide) {
    quad(x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0); paint(cSide);   // 오른쪽(+X)
    quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1); paint(cFront);  // 앞(+Z)
    quad(x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1); paint(cTop);    // 위(+Y)
  }
  function shadow(rx, rz, a) {
    face('y', 0, 0, 0); g.beginPath(); g.ellipse(0, 0, rx, rz, 0, 0, TAU); V();
    g.globalAlpha = a * RA; g.fillStyle = 'rgba(17,24,39,.09)'; g.fill(); g.globalAlpha = 1;
  }
  // 메카넘 바퀴(축 = X). 보이는 면은 X = xc + hw
  function wheel(xc, yc, zc, r, hw, outer, twist, spin) {
    const xb = xc - hw, xf = xc + hw;
    // 두 원(앞·뒤 면)의 외곽 접선으로 원기둥 실루엣
    const Ux = EZX, Uy = EZY, Vx = 0, Vy = -EYY, dX = (xf - xb) * EXX, dY = (xf - xb) * EXY;
    const th0 = Math.atan2(Vx * dY - Vy * dX, Ux * dY - Uy * dX);
    const m = th0 + Math.PI / 2, away = (Math.cos(m) * Ux + Math.sin(m) * Vx) * dX + (Math.cos(m) * Uy + Math.sin(m) * Vy) * dY < 0;
    const a0 = away ? th0 : th0 + Math.PI;
    g.beginPath(); face('x', xb, yc, zc); g.arc(0, 0, r, a0, a0 + Math.PI); face('x', xf, yc, zc); g.arc(0, 0, r, a0 + Math.PI, a0 + TAU); g.closePath();
    paint('#262a31', 1.8);
    // 대각선 롤러(보이는 쪽만): 회색 틈 + 끝의 흰 캡
    if (FA > .05) {
      const N = 10;
      for (let q = 0; q < N; q++) {
        const th = spin + q * TAU / N, mid = th + twist / 2;
        if (-Math.sin(mid) * VY + Math.cos(mid) * VZ < .08) continue;
        face('x', xb, yc, zc); const bx = Math.cos(th) * r, by = Math.sin(th) * r;
        g.beginPath(); g.moveTo(bx, by); face('x', xf, yc, zc); g.lineTo(Math.cos(th + twist) * r, Math.sin(th + twist) * r);
        V(); g.globalAlpha = RA * FA; g.strokeStyle = '#4d535d'; g.lineWidth = 1.5 * S / 2; g.stroke();
        face('x', xf, yc, zc); g.beginPath(); g.ellipse(Math.cos(th + twist) * r * .96, Math.sin(th + twist) * r * .96, 2.6, 1.7, th + twist + Math.PI / 2, 0, TAU);
        V(); g.fillStyle = '#d9dde3'; g.fill(); g.globalAlpha = 1;
      }
    }
    // 보이는 면
    face('x', xf + .2, yc, zc);
    if (outer) {   // 바깥 면: 건메탈 테두리(8개 홈) + 무늬 가운데 + 허브
      g.beginPath();
      for (let q = 0; q <= 32; q++) { const an = q / 32 * TAU + spin * .0, rr = r * (q % 4 === 0 ? .74 : .82); q ? g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : g.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      g.closePath(); paint('#7c838f', 1.6);
      face('x', xf + .3, yc, zc); g.beginPath(); g.arc(0, 0, r * .56, 0, TAU); paint('#b4bac3', 1.2);
      face('x', xf + .4, yc, zc); g.beginPath(); g.arc(0, 0, r * .23, 0, TAU); paint('#555c67', 1.2);
      face('x', xf + .5, yc, zc); g.beginPath(); for (let q = 0; q < 6; q++) { const an = spin + q * TAU / 6; g.moveTo(Math.cos(an) * r * .3, Math.sin(an) * r * .3); g.lineTo(Math.cos(an) * r * .5, Math.sin(an) * r * .5); }
      V(); g.globalAlpha = RA * FA * .55; g.strokeStyle = '#8d949e'; g.lineWidth = 1.4; g.stroke(); g.globalAlpha = 1;
    } else { g.beginPath(); g.arc(0, 0, r * .8, 0, TAU); paint('#3a3f48', 1.4); }
  }

  // ---- 포니봇(검은 낮은 차체, 앞 배터리 상자, 앞 초음파, 메카넘 바퀴 4개) ----
  // 조립 순서: 바퀴 → 아래 판·기둥 → 위 판 → 배터리 → 초음파 → 마이크로비트(신호가 닿는 곳)
  const PT = 7.95;
  function drawPonybot(t) {
    const out = eOut3(prog(t, 10.3, 10.75));
    if (t < PT || out >= 1) return;
    TT = t; RA = 1;
    const go = prog(t, 9.05, 9.35), tt = Math.max(0, t - 9.05);
    const X = 28 * Math.sin(tt * 2.3) * go;
    camera(PONX, PONY + out * 20, PONS * (1 - out * .06), .72, .52);
    LIFT = 0; shadow(70, 92, eOut3(prog(t, PT, PT + .5)));
    // 옆으로 이동 화살표(바닥, 차체 앞)
    const ar = eOut3(prog(t, 9.05, 9.4)) * RA;
    if (ar > 0) {
      g.beginPath(); pj(-84, 0, 150); g.moveTo(PX, PY); pj(84, 0, 150); g.lineTo(PX, PY);
      for (const sx of [-1, 1]) { pj(sx * 84, 0, 150); g.moveTo(PX, PY); pj(sx * 70, 0, 160); g.lineTo(PX, PY); pj(sx * 84, 0, 150); g.moveTo(PX, PY); pj(sx * 70, 0, 140); g.lineTo(PX, PY); }
      V(); g.globalAlpha = ar * .75; g.strokeStyle = C.accent; g.lineWidth = 3; g.lineCap = 'round'; g.stroke(); g.globalAlpha = 1;
    }
    OX += S * X * EXX; OY += S * X * EXY;   // 옆으로(+X) 미끄러짐 — 바퀴는 돌고 차체는 옆으로
    const r = 33, hw = 13, spin = -X / r;
    if (part(PT)) wheel(-62, r, -58, r, hw, false, .7, -spin);
    if (part(PT + .08)) wheel(-62, r, 58, r, hw, false, -.7, spin);
    if (part(PT + .2)) { box(-46, 46, 22, 27, -80, 84, '#2a2f38', '#14171c', '#1c2027'); for (const [bx, bz] of [[-40, -70], [40, -70], [-40, 70], [40, 70]]) box(bx - 2.5, bx + 2.5, 27, 42, bz - 2.5, bz + 2.5, '#e2c57a', '#c9a24a', '#b38c39'); }
    if (part(PT + .3)) box(-42, 42, 42, 46, -76, 74, '#30353f', '#16191f', '#1f232a');
    if (part(PT + .62)) {   // 마이크로비트(뒤쪽에 세움, 부품 면이 앞)
      box(-25, 25, 46, 88, -66, -63, '#2b3038', '#1d222a', '#151820');
      face('z', -25, 52, -63); g.beginPath(); g.rect(4, -1, 42, 5); paint('#d6a531', 1);
      face('z', -25, 88, -63); g.beginPath(); g.rect(14, 10, 9, 9); g.rect(28, 12, 7, 7); paint('#0e1115', 1);
    }
    if (part(PT + .4)) {   // 배터리 상자, 가운데 홈
      box(-27, 27, 46, 70, -40, 64, '#343a44', '#1a1d23', '#23272e');
      face('y', -27, 70, -40); g.beginPath(); g.moveTo(27, 6); g.lineTo(27, 98); paint('#1a1d23', 1.2);
      face('z', -27, 70, 64); g.beginPath(); g.roundRect(17, 4, 20, 12, 3); paint('#2a2f37', 1);
    }
    if (part(PT + .5)) {   // 앞 초음파 센서
      box(-36, 36, 8, 30, 80, 90, '#2a2f38', '#15181d', '#1d2026');
      for (const sx of [-17, 17]) {
        face('z', sx, 19, 90.2); g.beginPath(); g.arc(0, 0, 8.6, 0, TAU); paint('#d3d8df', 1.2);
        face('z', sx, 19, 90.4); g.beginPath(); g.arc(0, 0, 6.2, 0, TAU); paint('#2d323a', 1);
        face('z', sx, 19, 90.5); g.beginPath(); g.arc(-1.6, -1.6, 1.6, 0, TAU); paint('rgba(255,255,255,.35)', .5);
      }
    }
    if (part(PT + .12)) wheel(62, r, -58, r, hw, true, -.7, spin);
    if (part(PT + .16)) wheel(62, r, 58, r, hw, true, .7, -spin);
    FA = RA = 1; LIFT = 0;
  }

  // ---- 로보독(알약형 머리 + LED 눈, 네 다리 걷기) ----
  const EYE_OPEN = ['.###.', '#####', '#####', '#####', '.###.'];
  const EYE_HAPPY = ['.....', '..#..', '.#.#.', '#...#', '.....'];
  function pill(w, h) { g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h / 2); }
  function leg(hx, hz, ph, amp, col) {
    const a = -.42 + .34 * Math.cos(ph) * amp, kb = .88 + .5 * Math.max(0, Math.sin(ph)) * amp, L1 = 34, L2 = 36, hy = 68;
    const kz = hz + Math.sin(a) * L1, ky = hy - Math.cos(a) * L1, fz = kz + Math.sin(a + kb) * L2, fy = ky - Math.cos(a + kb) * L2;
    g.beginPath(); pj(hx, hy, hz); g.moveTo(PX, PY); pj(hx, ky, kz); g.lineTo(PX, PY); pj(hx, fy, fz); g.lineTo(PX, PY);
    V(); const sa = RA * FA;
    g.globalAlpha = sa; g.strokeStyle = col; g.lineWidth = 8.5 * S; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
    pj(hx, Math.max(fy, 3.5), fz); g.fillStyle = '#0b0e14'; g.beginPath(); g.arc(PX, PY, 4.6 * S, 0, TAU); g.fill();
    pj(hx, ky, kz); g.fillStyle = '#3a4252'; g.beginPath(); g.arc(PX, PY, 4.2 * S, 0, TAU); g.fill(); g.globalAlpha = 1;
  }
  const DT = 7.75;
  function drawRobodog(t) {
    const out = eOut3(prog(t, 10.3, 10.75));
    if (t < DT || out >= 1) return;
    TT = t; RA = 1;
    const amp = prog(t, 8.9, 9.25), ph = Math.max(0, t - 8.9) * TAU * 1.5, bob = 1.6 * Math.sin(ph * 2) * amp;
    camera(DOGX, DOGY + out * 20, DOGS * (1 - out * .06), .5, .4);
    LIFT = 0; shadow(44, 78, eOut3(prog(t, DT, DT + .5)));
    OY -= bob * S * .5;
    if (part(DT)) { leg(-27, 40, ph + Math.PI, amp, '#4a5263'); leg(-27, -58, ph, amp, '#4a5263'); }
    if (part(DT + .14)) {
      box(-27, 27, 60, 86, -66, 44, '#2f3644', '#1e2430', '#252b37');
      box(-30, -22, 58, 76, 30, 50, '#363d4b', '#262c38', '#2c3340');
      box(22, 31, 58, 76, 30, 50, '#3a4250', '#262c38', '#2c3340');
      box(22, 31, 58, 76, -70, -50, '#3a4250', '#262c38', '#2c3340');
      box(-16, 16, 86, 88.5, -52, -6, '#3d4452', '#2a303c', '#323947');
    }
    if (part(DT + .06)) { leg(27, 40, ph, amp, '#262c38'); leg(27, -58, ph + Math.PI, amp, '#262c38'); }
    if (part(DT + .3)) {
      // 머리: 알약 모양을 뒤→앞으로 겹쳐 두께를 만들고 앞면에 눈판
      const hy = 104, zb = 36, zf = 64;
      for (let q = 0; q <= 10; q++) { face('z', 0, hy, lerp(zb, zf, q / 10)); pill(96, 54); V(); g.globalAlpha = RA * FA; g.fillStyle = '#0d1016'; g.fill(); g.globalAlpha = 1; }
      face('z', 0, hy, zf + .2); pill(96, 54); paint('#0b0e14', 1.8);
      face('z', 0, hy, zf + .3); pill(88, 46); paint('#1b2231', 1.2);
      const lit = eOut3(prog(t, 8.82, 9.05)), happy = t > 9.6 && t < 10.3 && !(t > 9.95 && t < 10.03), blink = t > 9.42 && t < 9.5;
      for (const ex of [-21, 21]) {
        face('z', ex, hy, zf + .4); g.beginPath(); g.roundRect(-15, -15, 30, 30, 6); paint('#090c13', 1);
        const P = happy ? EYE_HAPPY : EYE_OPEN;
        face('z', ex, hy, zf + .5);
        g.beginPath(); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { g.moveTo((c - 2) * 5.4 + 1.75, (r - 2) * 5.4); g.arc((c - 2) * 5.4, (r - 2) * 5.4, 1.75, 0, TAU); }
        V(); g.globalAlpha = RA * FA; g.fillStyle = '#232a38'; g.fill();
        if (lit > 0 && !blink) {
          face('z', ex, hy, zf + .55);
          g.beginPath(); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (P[r][c] === '#') { g.moveTo((c - 2) * 5.4 + 1.75, (r - 2) * 5.4); g.arc((c - 2) * 5.4, (r - 2) * 5.4, 1.75, 0, TAU); }
          V(); g.globalAlpha = RA * FA * lit; g.fillStyle = '#fff4c8'; g.fill();
        }
        g.globalAlpha = 1;
      }
      face('z', 0, hy - 4, zf + .4); g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); paint('#2e3850', .8);
      if (lit > 0) { pj(0, hy, zf); glow('accent', PX, PY, 70 * S / 2, .22 * lit * RA); }
    }
    FA = RA = 1; LIFT = 0;
  }

  // ---- 자막 ----
  const CAPS = [[2.5, 4.3, '01', 'See', '보기'], [4.95, 7.3, '02', 'Think', '생각하기'], [7.95, 10.25, '03', 'Move', '움직이기']];
  function drawCaption(t) {
    for (let i = 0; i < 3; i++) {
      const [a, b, n, en, ko] = CAPS[i]; if (t < a || t > b + .4) continue;
      const out = eIn3(prog(t, b, b + .35));
      const x = portrait ? 90 : 140, y = H - (portrait ? 190 : 120), big = portrait ? 104 : 84;
      g.save(); g.beginPath(); g.rect(0, y - big * 1.25, W, big * 1.6); g.clip();
      const e1 = eOut5(prog(t, a, a + .7)), e2 = eOut5(prog(t, a + .1, a + .8)), e3 = eOut5(prog(t, a + .22, a + .92));
      const lift = -out * big * .5;
      text(n, x, y - big * .78 + (1 - e1) * 30 + lift, big * .3, 750, C.accent, e1 * (1 - out), { ls: 2 });
      g.globalAlpha = e1 * (1 - out); g.fillStyle = C.accent; g.fillRect(x + big * .52, y - big * .87 + (1 - e1) * 30 + lift, big * .5 * e1, 3); g.globalAlpha = 1;
      text(en, x - 4, y + (1 - e2) * big * .8 + lift, big, 800, C.ink, e2 * (1 - out), { ls: -2 });
      g.font = `800 ${big}px ${FONT}`; g.letterSpacing = '-2px'; const w = g.measureText(en).width; g.letterSpacing = '0px';
      text(ko, x + w + big * .26, y + (1 - e3) * big * .8 + lift, big * .46, 650, C.muted, e3 * (1 - out));
      g.restore();
    }
    // 단계 표시(가는 선 3칸)
    const pa = eOut3(prog(t, 2.35, 2.75)) * (1 - eOut3(prog(t, 10.2, 10.5)));
    if (pa > 0) {
      const x = portrait ? 90 : 140, y = H - (portrait ? 110 : 62), w = portrait ? 120 : 86;
      for (let i = 0; i < 3; i++) {
        const f = prog(t, CAPS[i][0] - .1, i < 2 ? CAPS[i + 1][0] - .1 : 10.2);
        g.globalAlpha = pa; g.fillStyle = C.line; g.fillRect(x + i * (w + 10), y, w, 3);
        g.fillStyle = C.accent; g.fillRect(x + i * (w + 10), y, w * f, 3); g.globalAlpha = 1;
      }
    }
  }

  // ================= 25개 점 =================
  const nodeR = (isOut) => (isOut ? 13 : 10.5) * (portrait ? 1.25 : 1) * (.55 + .45 * GS);
  function drawDots(t, outA) {
    const order = (i) => (i % 5) * 5 + ((i / 5) | 0);
    for (let i = 0; i < 25; i++) {
      const r = (i / 5) | 0, c = i % 5, j = DOT_NODE[i], isOut = j >= 22, oq = j - 22;
      // A: 보드 위
      const ax = BX + (c - 2) * PITCH * BS, ay = BY + ((r - 2) * PITCH + MY) * BS;
      const dist = Math.hypot(r - 2, c - 2), born = i === 12 ? eBack(prog(t, .08, .55)) : eBack(prog(t, .58 + dist * .13, .98 + dist * .13));
      if (born <= 0) continue;
      // 켜짐(빨강) 정도
      let on = 1;
      if (t > 3.3) { const tt = t - (c * .035); const pu = pupilAt(tt); on = lerp(1, eyeOn(r, c, pu) ? 1 : 0, eOut3(prog(tt, 3.35, 3.5))); if (tt > 3.7) on = eyeOn(r, c, pu) ? 1 : 0; }
      // B: 노드로 날아감
      const tl = 4.55 + order(i) * .016, f = eIO5(prog(t, tl, tl + .9));
      const bx = nx(j), by = ny(j);
      // D: 마크로
      const td = 10.42 + order(i) * .01, fd = eIO5(prog(t, td, td + .85));
      const dx = markX(i), dy = markY(i);
      let x, y, rad, col, ringCol = null;
      if (f <= 0) { x = ax; y = ay; rad = 12.5 * BS * born; col = mix(RGB.off, RGB.red, on); }
      else if (fd <= 0) {
        const lift = Math.sin(f * Math.PI) * (portrait ? 0 : -60), side = Math.sin(f * Math.PI) * (portrait ? -60 : 0);
        x = lerp(ax, bx, f) + side; y = lerp(ay, by, f) + lift;
        const nr = nodeR(isOut);
        rad = lerp(12.5 * BS, nr, f);
        col = isOut ? mix(lerp(0, 1, on) > .5 ? RGB.red : RGB.off, oq === 0 ? RGB.red : oq === 1 ? RGB.yellow : RGB.green, f) : mix(on > .5 ? RGB.red : RGB.off, RGB.node, f);
        if (isOut && f > .6) ringCol = SIG[oq];
      } else {
        const sm = SMILE[r][c] === '#';
        x = lerp(bx, dx, fd) + Math.sin(fd * Math.PI) * (portrait ? 0 : 0); y = lerp(by, dy, fd) - Math.sin(fd * Math.PI) * 40;
        rad = lerp(nodeR(isOut), LK.m * .052, fd);
        const lightUp = eOut3(prog(t, 11.35 + c * .04, 11.65 + c * .04));
        const base = isOut ? (oq === 0 ? RGB.red : oq === 1 ? RGB.yellow : RGB.green) : RGB.node;
        col = fd < 1 ? mix(base, RGB.off, fd) : mix(RGB.off, RGB.red, sm ? lightUp : 0);
        if (fd >= 1 && sm) { const blink = (r === 1) && t > 13.1 && t < 13.22 && !hero; if (blink) col = mix(RGB.off, RGB.red, .15); }
      }
      // 노드 활성
      let act = 0;
      if (f >= 1 && fd <= 0) act = nodeAct(j, t);
      const greenLit = isOut && oq === 2 ? eOut3(prog(t, 6.97, 7.25)) * (1 - eOut3(prog(t, 10.45, 10.8))) : 0;
      // 그리기
      if (f <= 0 && on > .3) glow('red', x, y, rad * 3.2 * born, on * (i === 12 && t < .9 ? 1 + .6 * Math.exp(-Math.pow((t - .6) / .12, 2)) : .8));
      if (fd >= 1 && SMILE[r][c] === '#') glow('red', x, y, rad * 3, eOut3(prog(t, 11.35 + c * .04, 11.7 + c * .04)) * .7 * outA);
      if (act > .02) glow('accent', x, y, rad * 3.4, act);
      if (greenLit > 0) glow('green', x, y, rad * 4.5, greenLit);
      g.globalAlpha = outA;
      if (ringCol && fd <= 0) {   // 출력 노드: 고리 → 켜지면 채움
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
        g.strokeStyle = ringCol; g.lineWidth = 3.2; g.stroke();
        const fill = oq === 2 ? greenLit : 0;
        if (fill > 0) { g.fillStyle = ringCol; g.beginPath(); g.arc(x, y, rad * (.4 + .6 * fill) * (1 + .25 * Math.sin(fill * Math.PI)), 0, TAU); g.fill(); }
      } else {
        g.fillStyle = col; g.beginPath(); g.arc(x, y, rad * (1 + act * .25), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  // ================= 로고 글자·틀 =================
  function drawLockup(t, outA) {
    const fr = hero ? 1 : eIO3(prog(t, 10.75, 11.45));
    if (fr > 0) {
      const m = LK.m, s = m * 1.0;
      g.save(); g.translate(LK.mx, LK.my); rrDraw(s, s, m * .2, fr, C.ink, Math.max(2, m * .014), outA); g.restore();
    }
    const e1 = hero ? 1 : eOut5(prog(t, 11.6, 12.3)), e2 = hero ? 1 : eOut5(prog(t, 11.85, 12.55)), e3 = hero ? 1 : eOut5(prog(t, 12.1, 12.8));
    if (e1 > 0) {
      text('Physical ', LK.tx1, LK.ty1 + (1 - e1) * LK.s1 * .35, LK.s1, 800, C.ink, e1 * outA, { ls: -LK.s1 * .03 });
      text('AI', LK.tx1 + TW.p * LK.s1 / 100, LK.ty1 + (1 - e1) * LK.s1 * .35, LK.s1, 800, C.accent, e1 * outA, { ls: -LK.s1 * .03 });
    }
    text('with micro:bit', LK.tx2, LK.ty2 + (1 - e2) * LK.s2 * .5, LK.s2, 500, C.muted, e2 * outA, { ls: -LK.s2 * .01 });
    text('보고 · 생각하고 · 움직이는 인공지능 교실', LK.tx3, LK.ty3 + (1 - e3) * LK.s3 * .6, LK.s3, 600, C.ink, e3 * outA * .82, { ls: -LK.s3 * .01 });
  }

  // ================= 한 장면 =================
  function render(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    V();
    const out = lockup(t);
    const bgA = hero ? 0 : 1 - out;
    if (bgA > 0) {
      g.globalAlpha = bgA; g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      g.globalAlpha = bgA * .7; g.fillStyle = GRID; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    }
    if (hero || t >= DUR) { drawDotsFinal(); drawLockup(t, 1); return; }
    board(t); net(t); robots();
    drawBoard(t);
    drawSensors(t);
    drawParticles(t);
    drawCard(t);
    drawNet(t);
    drawSignals(t);
    const ro = 1 - eOut3(prog(t, 10.3, 10.75));
    if (ro >= 1) { drawRobodog(t); drawPonybot(t); }
    else if (ro > 0) {
      g = LG; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, LAYER.width, LAYER.height); V();
      drawRobodog(t); drawPonybot(t);
      g = G0; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = ro; g.drawImage(LAYER, 0, 0); g.globalAlpha = 1; V();
    }
    drawDots(t, 1);
    drawLockup(t, 1);
    drawCaption(t);
  }
  function drawDotsFinal() {
    for (let i = 0; i < 25; i++) {
      const r = (i / 5) | 0, c = i % 5, sm = SMILE[r][c] === '#', x = markX(i), y = markY(i), rad = LK.m * .052;
      if (sm) glow('red', x, y, rad * 3, .7);
      g.fillStyle = sm ? C.red : C.off; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
  }

  // ================= 재생 =================
  const loop = (now) => {
    if (!running) return;
    cur = (now - t0) / 1000;
    if (cur >= stopAt) { cur = stopAt; running = false; render(cur); const f = onDone; onDone = null; f && f(); return; }
    render(cur); raf = requestAnimationFrame(loop);
  };
  const api = {
    DUR, OUT,
    render: (t) => { cur = t; render(t); },
    play(done, { from = 0, card = !!target } = {}) { cancelAnimationFrame(raf); hero = false; onDone = done || null; stopAt = card ? DUR + OUT : DUR; running = true; cur = from; fit(); t0 = performance.now() - from * 1000; raf = requestAnimationFrame(loop); },
    seek(s) { cancelAnimationFrame(raf); running = false; hero = false; cur = s; fit(); render(s); },
    hero() { cancelAnimationFrame(raf); running = false; hero = true; fit(); render(DUR + OUT); },
    stop() { cancelAnimationFrame(raf); running = false; onDone = null; },
    resize() { fit(); render(hero ? DUR + OUT : cur); },
    refresh() { TW = null; api.resize(); },
    get time() { return cur; }, get running() { return running; }, get isHero() { return hero; },
  };
  fit();
  return api;
}
