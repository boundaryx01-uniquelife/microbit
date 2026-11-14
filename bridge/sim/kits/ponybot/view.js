// 포니봇 2D 위에서 보기 + OLED·5x5 LED 그리기 (월드 좌표: x 오른쪽, y 아래, heading 0=위 시계 +, cm)
import { EST, WHEEL_XY, MOTOR_WHEEL } from './pony.js';
import { drawProps } from '../../props.js';

const RAD = Math.PI / 180;
const MAX_ZOOM = 10;
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export class PonyView {
  constructor(canvas, world, robot) {
    this.cv = canvas; this.world = world; this.robot = robot; this.showBeam = true; this.pad = 14; this.editor = null;
    // 보기(확대·이동): zoom 1 = 장면 전체, ox·oy = 화면 왼쪽 위의 월드 좌표(cm)
    this.zoom = 1; this.ox = 0; this.oy = 0; this.follow = false; this.userView = false;
    this.attachView();
  }
  fit() {   // 장면 크기에 맞게 비율·해상도를 맞춤
    const { w, h } = this.world.size, cv = this.cv;
    cv.style.aspectRatio = `${w} / ${h}`;
    cv.style.maxWidth = `calc(58vh * ${(w / h).toFixed(3)})`;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(200, Math.round(cv.clientWidth * dpr)), ch = Math.round(cw * h / w);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    this.k = cv.width / w;   // 1cm 당 화면 픽셀(확대 전)
  }
  clampView() {
    const { w, h } = this.world.size;
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, this.zoom));
    const vw = w / this.zoom, vh = h / this.zoom;
    this.ox = Math.min(Math.max(0, this.ox), w - vw); this.oy = Math.min(Math.max(0, this.oy), h - vh);
  }
  setZoom(z, fx = 0.5, fy = 0.5) {   // (fx,fy) = 화면 안 비율 위치(커서) — 그 아래 월드 점을 고정
    const { w, h } = this.world.size, p = { x: this.ox + fx * w / this.zoom, y: this.oy + fy * h / this.zoom };
    this.zoom = z; this.clampView();
    this.ox = p.x - fx * w / this.zoom; this.oy = p.y - fy * h / this.zoom; this.clampView();
  }
  reset() { this.zoom = 1; this.ox = this.oy = 0; this.follow = false; this.userView = true; this.autoApplied = false; this.syncBar(); }
  autoZoom() {   // 코드를 실행하면 로봇이 작아 보이지 않게 한 번 확대(직접 보기를 바꿨으면 건드리지 않음)
    if (this.userView || this.zoom > 1) return;
    this.zoom = Math.min(4, Math.max(1.5, this.world.size.w / 90)); this.follow = true; this.autoApplied = true; this.clampView(); this.syncBar();
  }
  toWorld(ev) {
    const r = this.cv.getBoundingClientRect(), { w, h } = this.world.size;
    return { x: this.ox + (ev.clientX - r.left) / r.width * w / this.zoom, y: this.oy + (ev.clientY - r.top) / r.height * h / this.zoom };
  }
  // ---- 확대·이동 조작: 휠 = 확대/축소(페이지는 스크롤되지 않음), 오른쪽·가운데 버튼 또는 Space+끌기 = 이동, 두 손가락 = 확대·이동
  attachView() {
    const cv = this.cv, pts = new Map(); let pan = null, space = false, pinch = null;
    const frac = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    const userChanged = () => { this.userView = true; this.syncBar(); };
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();   // 캔버스 위에서는 사이트 전체가 스크롤되지 않게
      const [fx, fy] = frac(e);
      this.setZoom(this.zoom * Math.exp(-Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100) * 0.25), this.follow ? 0.5 : fx, this.follow ? 0.5 : fy);
      userChanged();
    }, { passive: false });
    addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target && e.target.tagName) || '') && cv.matches(':hover')) { space = true; e.preventDefault(); cv.style.cursor = 'grab'; } });
    addEventListener('keyup', (e) => { if (e.code === 'Space') { space = false; cv.style.cursor = ''; } });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {   // 편집기보다 먼저(capture) 받아서 이동·핀치면 편집기에 넘기지 않음
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.holding = true;   // 누르고 있는 동안은 따라가기를 멈춤(물체를 끌 때 화면이 도망가지 않게)
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; pan = null; }
      if (e.button === 1 || e.button === 2 || space || pts.size >= 2) {
        e.stopImmediatePropagation(); e.preventDefault();
        if (pts.size < 2) pan = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy };
        try { cv.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
        cv.style.cursor = 'grabbing'; this.follow = false; userChanged();
      }
    }, true);
    cv.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = cv.getBoundingClientRect(), { w, h } = this.world.size;
      if (pinch && pts.size >= 2) {
        e.stopImmediatePropagation();
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.setZoom(pinch.z * d / Math.max(10, pinch.d), (cx - r.left) / r.width, (cy - r.top) / r.height);
        this.ox -= (cx - pinch.cx) / r.width * w / this.zoom; this.oy -= (cy - pinch.cy) / r.height * h / this.zoom; pinch.cx = cx; pinch.cy = cy; this.clampView(); userChanged();
      } else if (pan) {
        e.stopImmediatePropagation();
        this.ox = pan.ox - (e.clientX - pan.x) / r.width * w / this.zoom; this.oy = pan.oy - (e.clientY - pan.y) / r.height * h / this.zoom; this.clampView();
      }
    }, true);
    const up = (e) => { pts.delete(e.pointerId); if (!pts.size) this.holding = false; if (pts.size < 2) pinch = null; if (pan) { e.stopImmediatePropagation(); pan = null; cv.style.cursor = space ? 'grab' : ''; } };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
    cv.title = '마우스 휠 = 확대·축소 / 오른쪽(또는 가운데) 버튼 끌기·Space+끌기 = 이동 / 두 손가락 = 확대·이동';
  }
  // 단추 줄(− ＋ 전체 보기 · 로봇 따라가기)은 화면 위쪽 공용 줄(index.html)에서 부름
  zoomBy(f) { this.setZoom(this.zoom * f, 0.5, 0.5); this.userView = true; this.syncBar(); }
  setFollow(on) {
    this.follow = !!on; if (this.follow && this.zoom < 1.5) this.zoom = Math.min(4, Math.max(1.5, this.world.size.w / 90));
    this.userView = true; this.clampView(); this.syncBar();
  }
  // 코드 실행이 끝나면(자동 확대였을 때만) 전체 보기로 되돌림
  autoView(running) { if (this.autoApplied && !running && !this.userView) { this.zoom = 1; this.ox = this.oy = 0; this.follow = false; this.autoApplied = false; this.syncBar(); } }
  syncBar() { if (this.onChange) this.onChange(); }
  draw() {
    this.fit();
    const { cv, world: W, robot: R, k } = this, g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    if (this.follow && !this.holding) {   // 로봇을 화면 가운데로(부드럽게)
      const vw = W.size.w / this.zoom, vh = W.size.h / this.zoom;
      this.ox += (R.x - vw / 2 - this.ox) * 0.2; this.oy += (R.y - vh / 2 - this.oy) * 0.2;
    }
    this.clampView();
    const kz = k * this.zoom;
    g.scale(kz, kz); g.translate(-this.ox, -this.oy);
    const { w, h } = W.size;
    // 바닥
    g.fillStyle = rgb(W.floor.bg); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 0.15;
    for (let x = 10; x < w; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 10; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // 거리 구역(릴레이)
    g.font = '4px system-ui, sans-serif'; g.textBaseline = 'middle';
    for (const z of W.floor.zones) {
      g.fillStyle = z.color; g.fillRect(0, z.y0, w, Math.min(z.y1, h) - z.y0);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.textAlign = 'right'; g.fillText(z.label, w - 3, Math.min(z.y0 + 5, h - 3));
    }
    for (const m of W.floor.marks) {
      g.strokeStyle = 'rgba(30,30,30,.65)'; g.lineWidth = 1; g.setLineDash([3, 2]);
      g.beginPath(); g.moveTo(m.x0, m.y0); g.lineTo(m.x1, m.y1); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.textAlign = 'left'; g.fillText(m.label, m.x0 + 1, m.y0 - 3);
    }
    // 소품: 검은 선 → 컬러칩 → 상자 → 색 물체 (공용 그리기)
    drawProps(g, W.props, { selected: this.editor ? this.editor.selection : null });
    for (const p of W.pins) {
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7);
      if (p.down) { g.fillStyle = 'rgba(120,120,120,.45)'; g.fill(); }
      else { g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#d33'; g.lineWidth = 0.8; g.stroke(); }
    }
    // 벽
    if (W.walls) { g.strokeStyle = '#6b7686'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }
    else { g.strokeStyle = 'rgba(107,118,134,.6)'; g.lineWidth = 0.8; g.setLineDash([3, 3]); g.strokeRect(0, 0, w, h); g.setLineDash([]); }
    // 지나간 자리
    if (R.trail.length > 1) {
      g.strokeStyle = 'rgba(47,111,228,.6)'; g.lineWidth = 0.8; g.lineJoin = 'round';
      g.beginPath(); R.trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    this.drawRobot(g);
    if (this.editor) this.editor.drawOverlay(g);   // 선택 표시·선 점
    // 눈금자 10cm (화면 고정, 확대해도 실제 10cm 길이)
    g.setTransform(1, 0, 0, 1, 0, 0);
    const px = 10 * kz, fs = Math.max(11, cv.width / 60);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(fs * .6, cv.height - fs * 1.4, px, Math.max(2, fs * .2));
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `${fs}px system-ui, sans-serif`; g.fillText('10cm', fs * .6 + px + fs * .4, cv.height - fs * 1.2);
    this.syncBar();
  }
  toScreen(x, y) {   // 월드 → 화면(clientX/Y). 시험·편집기용
    const r = this.cv.getBoundingClientRect(), { w, h } = this.world.size;
    return { x: r.left + (x - this.ox) * this.zoom / w * r.width, y: r.top + (y - this.oy) * this.zoom / h * r.height };
  }
  drawRobot(g) {
    const R = this.robot, W = this.world;
    // 초음파 부채꼴 + 맞은 점
    if (this.showBeam) {
      const [ox, oy] = R.toWorld(0, EST.sonarOffset), d = R.sonarTrue(), len = isFinite(d) ? d : 70;
      const a0 = (R.heading - 15) * RAD, a1 = (R.heading + 15) * RAD;
      g.fillStyle = isFinite(d) ? 'rgba(36,86,229,.13)' : 'rgba(36,86,229,.06)';
      g.beginPath(); g.moveTo(ox, oy);
      g.lineTo(ox + Math.sin(a0) * len, oy - Math.cos(a0) * len); g.lineTo(ox + Math.sin(a1) * len, oy - Math.cos(a1) * len); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(36,86,229,.8)'; g.lineWidth = 0.5; g.setLineDash(isFinite(d) ? [] : [2, 2]);
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.sin(R.heading * RAD) * len, oy - Math.cos(R.heading * RAD) * len); g.stroke(); g.setLineDash([]);
      if (isFinite(d)) { g.fillStyle = '#2456e5'; g.beginPath(); g.arc(ox + Math.sin(R.heading * RAD) * d, oy - Math.cos(R.heading * RAD) * d, 1.2, 0, 7); g.fill(); }
    }
    g.save(); g.translate(R.x, R.y); g.rotate(R.heading * RAD);
    // 차체 — 사진(top.jpg) 모양: 검은 기판 + X 모양 덮개, 가운데 앞쪽 배터리 상자, 뒤쪽 OLED·마이크로비트 슬롯, 맨 앞 초음파 막대 (앞 = 위)
    const poly = (right, fill, stroke) => {
      const pts = [...right, ...right.slice().reverse().map(([u, v]) => [-u, v])];
      g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo(u, -v) : g.moveTo(u, -v))); g.closePath();
      g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.3; g.stroke(); }
    };
    poly([[4.4, -8.5], [4.6, -4], [5.4, -2], [5.4, 8.4], [5.0, 8.9]], '#15181c', '#05070a');             // 기판
    g.fillStyle = '#2a3038'; [[-4.2, -1.0], [-4.2, -0.3], [-4.2, 0.4], [-4.2, 1.1]].forEach(([u, v]) => { g.beginPath(); g.arc(u, -v, 0.3, 0, 7); g.fill(); });   // 둥근 구멍
    poly([[4.3, -8.5], [3.6, -6], [2.8, -4], [1.95, -2.5], [1.95, -0.8], [3.5, 2], [4.6, 4], [4.7, 8.8]], '#23272c', '#0b0d10');   // 덮개
    g.strokeStyle = '#0f1114'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-4.2, 8.3); g.lineTo(4.5, -8.4); g.moveTo(4.2, 8.3); g.lineTo(-4.5, -8.4); g.stroke();   // X 능선
    g.strokeStyle = '#6d747d'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-0.6, -3.7 + 8); g.lineTo(0.6, -4.9 + 8); g.moveTo(0.6, -3.7 + 8); g.lineTo(-0.6, -4.9 + 8); g.stroke();   // 작은 X 로고
    g.fillStyle = '#050607'; g.fillRect(-2.6, -(-4.9) - 0.35, 5.2, 0.7);                                   // 마이크로비트 슬롯
    g.fillStyle = '#8e86b4'; g.fillRect(-1.15, 7.0 - 0.6, 2.3, 1.2);                                       // OLED
    g.fillStyle = '#0b0c0e'; g.beginPath(); g.roundRect(-2, -9.3, 4, 9, 0.9); g.fill();                    // 배터리 상자
    g.strokeStyle = '#5a636e'; g.lineWidth = 0.35; g.stroke();
    g.fillStyle = '#111214'; g.fillRect(-1.35, -0.1, 2.7, 2.0);                                            // 둥근 거치대
    g.fillStyle = '#6f7378'; g.beginPath(); g.arc(0, 0.9, 0.8, 0, 7); g.fill(); g.fillStyle = '#0b0c0e'; g.beginPath(); g.arc(0, 0.9, 0.62, 0, 7); g.fill();
    g.fillStyle = '#16181b'; g.fillRect(-3.7, -9.55, 7.4, 1.3);                                             // 초음파 막대
    for (const u of [-1.75, 1.75]) { g.beginPath(); g.arc(u, -9.35, 0.85, 0, 7); g.fillStyle = '#cfd5da'; g.fill(); g.beginPath(); g.arc(u, -9.35, 0.62, 0, 7); g.fillStyle = '#24322f'; g.fill(); }
    g.fillStyle = '#d8d8d8'; [[3.4, -8.3], [-3.4, -8.3]].forEach(([u, v]) => g.fillRect(u - 0.3, v - 0.3, 0.6, 0.6));   // 앞 모서리 L1·L4 불빛
    // 바퀴 4개 (속도 부호로 색)
    const pos = WHEEL_XY();
    for (const name of ['FL', 'FR', 'RL', 'RR']) {
      const [wx, wy] = pos[name], v = R.w[name], t = Math.min(1, Math.abs(v) / EST.maxCmPerSec);
      g.save(); g.translate(wx, -wy);
      g.fillStyle = v > 0.05 ? `rgba(31,164,99,${0.35 + 0.65 * t})` : v < -0.05 ? `rgba(229,72,77,${0.35 + 0.65 * t})` : '#8a95a5';
      g.strokeStyle = '#0e1216'; g.lineWidth = 0.4;
      g.fillRect(-EST.wheelWid / 2, -EST.wheelLen / 2, EST.wheelWid, EST.wheelLen); g.strokeRect(-EST.wheelWid / 2, -EST.wheelLen / 2, EST.wheelWid, EST.wheelLen);
      // 롤러 사선 (X 배치, 추정 모양)
      const s = (name === 'FL' || name === 'RR') ? 1 : -1;
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 0.35;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-EST.wheelWid / 2, i * 1.9 - 0.8 * s); g.lineTo(EST.wheelWid / 2, i * 1.9 + 0.8 * s); g.stroke(); }
      g.restore();
    }
    // 라인 센서 2개 + 컬러 센서
    for (let i = 0; i < 2; i++) {
      const on = R.lineRaw(i);
      g.fillStyle = on ? '#ffd23f' : '#555'; g.strokeStyle = '#fff'; g.lineWidth = 0.3;
      g.beginPath(); g.arc((i ? 1 : -1) * EST.lineHalfGap, -EST.lineForward, 1.1, 0, 7); g.fill(); g.stroke();
    }
    const c = R.colorRGB();
    g.fillStyle = rgb(c); g.strokeStyle = '#fff'; g.lineWidth = 0.3;
    g.beginPath(); g.arc(0, -EST.colorForward, 1.3, 0, 7); g.fill(); g.stroke();
    g.restore();
    // 바퀴 이름 (회전하지 않게 글자는 월드 기준)
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '2.6px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const m of [1, 2, 3, 4]) {
      const name = MOTOR_WHEEL[m], [wx, wy] = pos[name], [px, py] = R.toWorld(wx * 0.62, wy * 0.9);
      g.fillText('M' + m, px, py);
    }
  }
}

// ---- OLED 128x64 ----
export function drawOled(cv, oled) {
  const g = cv.getContext('2d');
  const img = g.createImageData(128, 64), d = img.data;
  const on = oled.on, inv = oled.inverted;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    let lit = on ? oled.lit(x, y) : 0;
    if (on && inv) lit = lit ? 0 : 1;
    const i = (y * 128 + x) * 4;
    d[i] = lit ? 150 : 5; d[i + 1] = lit ? 215 : 8; d[i + 2] = lit ? 255 : 14; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ---- 마이크로비트 5x5 LED ----
export function drawLed5(cv, m) {
  const g = cv.getContext('2d'), s = cv.width / 5;
  g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    g.beginPath(); g.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.32, 0, 7);
    g.fillStyle = m[y][x] ? '#ff3b30' : '#3a1210'; g.fill();
    if (m[y][x]) { g.shadowColor = '#ff3b30'; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0; }
  }
}
