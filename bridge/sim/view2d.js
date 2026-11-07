// 2D 화면: 위에서 본 책상(이동 경로·장애물) + 옆에서 본 다리 자세
import { EST, GEOM, HEAD } from './runtime.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export class View2D {
  constructor(topCanvas, sideCanvas, world, robot) {
    this.top = topCanvas; this.side = sideCanvas; this.world = world; this.robot = robot;
    this.placing = false;
    this.top.addEventListener('click', (e) => this.onClick(e));
  }
  scale() {
    const W = this.top.clientWidth, H = this.top.clientHeight, m = 16;
    const sx = (W - 2 * m) / this.world.table.w, sy = (H - 2 * m) / this.world.table.h;
    const s = Math.min(sx, sy);
    return { s, ox: (W - this.world.table.w * s) / 2, oy: (H - this.world.table.h * s) / 2 };
  }
  onClick(e) {
    if (!this.placing) return;
    const r = this.top.getBoundingClientRect(), { s, ox, oy } = this.scale();
    const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
    const i = this.world.obstacles.findIndex(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
    if (i >= 0) this.world.obstacles.splice(i, 1);
    else if (Math.hypot(x - this.robot.x, y - this.robot.y) > EST.radius + 6) this.world.obstacles.push({ x: x - 5, y: y - 5, w: 10, h: 10 });
  }
  fit(c) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
  }
  draw() {
    if (this.top.clientWidth < 60 || this.side.clientWidth < 60) return;   // 숨겨져 있을 때
    this.drawTop(); this.drawSide();
  }

  drawTop() {
    const c = this.top, ctx = this.fit(c), R = this.robot, W = this.world;
    const { s, ox, oy } = this.scale();
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    // 바닥/책상
    ctx.fillStyle = W.useTable ? css('--table') : css('--floor');
    ctx.fillRect(ox, oy, W.table.w * s, W.table.h * s);
    ctx.strokeStyle = W.useTable ? css('--table-edge') : css('--wall'); ctx.lineWidth = W.useTable ? 3 : 5;
    ctx.strokeRect(ox, oy, W.table.w * s, W.table.h * s);
    // 10cm 격자
    ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
    for (let x = 10; x < W.table.w; x += 10) { ctx.beginPath(); ctx.moveTo(ox + x * s, oy); ctx.lineTo(ox + x * s, oy + W.table.h * s); ctx.stroke(); }
    for (let y = 10; y < W.table.h; y += 10) { ctx.beginPath(); ctx.moveTo(ox, oy + y * s); ctx.lineTo(ox + W.table.w * s, oy + y * s); ctx.stroke(); }
    ctx.fillStyle = css('--muted'); ctx.font = '11px system-ui'; ctx.fillText(W.useTable ? '책상 120×80cm (칸 10cm)' : '바닥(벽 있음) 칸 10cm', ox + 6, oy + 14);
    // 장애물
    ctx.fillStyle = css('--obstacle');
    W.obstacles.forEach(o => ctx.fillRect(ox + o.x * s, oy + o.y * s, o.w * s, o.h * s));
    // 이동 경로
    ctx.strokeStyle = css('--trail'); ctx.lineWidth = 2; ctx.beginPath();
    R.trail.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * s, oy + p.y * s) : ctx.moveTo(ox + p.x * s, oy + p.y * s)));
    ctx.lineTo(ox + R.x * s, oy + R.y * s); ctx.stroke();
    // 거리센서 빔
    const d = R.tof(), rad = R.heading * Math.PI / 180;
    const bx = R.x + Math.sin(rad) * EST.bodyLen / 2, by = R.y - Math.cos(rad) * EST.bodyLen / 2;
    ctx.strokeStyle = 'rgba(255,80,80,.55)'; ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(ox + bx * s, oy + by * s); ctx.lineTo(ox + (bx + Math.sin(rad) * Math.min(d, 255)) * s, oy + (by - Math.cos(rad) * Math.min(d, 255)) * s); ctx.stroke(); ctx.setLineDash([]);
    // 로보독(위에서)
    ctx.save();
    ctx.translate(ox + R.x * s, oy + R.y * s); ctx.rotate(rad);
    // 공식 비율: 몸통 12.2×6cm, 머리 10×2.7cm(몸 중심에서 6.7cm 앞), 엉덩이 앞뒤 ±4.6cm
    const L = GEOM.bodyLen * s, Wd = GEOM.bodyWid * s;
    const feet = [[-1, -1], [-1, 1], [1, 1], [1, -1]];   // [좌우, 앞뒤]: 0 왼앞,1 왼뒤,2 오른뒤,3 오른앞
    R.legs.forEach((lg, i) => {
      const fx = feet[i][0] * (Wd / 2 + 0.9 * s), fy = feet[i][1] * (GEOM.hipGap / 2) * s - lg.fx * s;
      ctx.fillStyle = lg.raised ? css('--accent') : css('--leg');
      ctx.beginPath(); ctx.arc(fx, fy, Math.max(2.5, 0.8 * s), 0, Math.PI * 2); ctx.fill();
    });
    const [r, g, b] = R.bodyLed, lit = r + g + b > 0;
    ctx.fillStyle = css('--dog'); ctx.strokeStyle = lit ? `rgb(${r},${g},${b})` : css('--dog-edge'); ctx.lineWidth = lit ? 4 : 2;
    roundRect(ctx, -Wd / 2, -L / 2, Wd, L, GEOM.bodyH / 2 * s); ctx.fill(); ctx.stroke();
    // 마이크로비트(등 뒤쪽)
    ctx.fillStyle = '#111'; ctx.fillRect(-2.1 * s, 0.5 * s, 4.2 * s, 3.4 * s);
    // 머리(넓은 판)와 정면 표시
    const hz = -HEAD.fwd * s, hw = GEOM.headWid * s, hd = GEOM.headDepth * s;
    ctx.fillStyle = css('--dog-head'); roundRect(ctx, -hw / 2, hz - hd / 2, hw, hd, hd / 2); ctx.fill();
    ctx.fillStyle = '#f4f8ff'; ctx.fillRect(-hw * 0.42, hz - hd / 2 - 1.5, hw * 0.34, 2); ctx.fillRect(hw * 0.08, hz - hd / 2 - 1.5, hw * 0.34, 2);
    ctx.restore();
    // 말풍선
    if (R.bubble) {
      ctx.font = 'bold 14px system-ui'; const tw = ctx.measureText(R.bubble).width + 14;
      const x = ox + R.x * s + 14, y = oy + R.y * s - 34;
      ctx.fillStyle = css('--bubble'); ctx.strokeStyle = css('--line'); roundRect(ctx, x, y, tw, 24, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = css('--text'); ctx.fillText(R.bubble, x + 7, y + 17);
    }
    if (R.fallen) banner(ctx, c, '⚠ 로보독이 책상에서 떨어졌어요! [처음으로]를 누르세요', '#d43c3c');
    else if (R.bumped) banner(ctx, c, '쿵! 장애물에 부딪혔어요', '#c27c0e');
    if (this.placing) { ctx.fillStyle = css('--accent'); ctx.font = 'bold 12px system-ui'; ctx.fillText('장애물 놓기: 클릭하면 놓기/지우기', ox + 6, oy + W.table.h * s - 8); }
  }

  drawSide() {
    const c = this.side, ctx = this.fit(c), R = this.robot;
    const W = c.clientWidth, H = c.clientHeight;
    ctx.clearRect(0, 0, W, H);
    // 코코아팹 공식 다리 시뮬레이터와 같은 비율(px→cm 0.045)로 그린 오른쪽 옆모습
    const s = Math.min(W / 26, H / 21), ground = H - 10;   // 물구나무처럼 몸을 세워도 들어가도록
    ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.font = '11px system-ui'; ctx.fillText('옆에서 본 모습 (오른쪽이 앞)', 8, 14);
    const pose = R.bodyPose(), p = pose.pitch, cx = W / 2 - 1.2 * s;
    const hipDrop = (96 - 80.5) * 0.045;                         // 엉덩이: 몸 중심보다 0.7cm 아래
    const cy = ground - pose.center * s;                          // 몸 중심
    const toWorld = (dx, dy) => ({ x: cx + (dx * Math.cos(p) + dy * Math.sin(p)) * s, y: cy + (-dx * Math.sin(p) + dy * Math.cos(p)) * s });
    const front = toWorld(GEOM.hipGap / 2, hipDrop), rear = toWorld(-GEOM.hipGap / 2, hipDrop);
    const drawLeg = (hip, lg, c1, c2) => {
      const L1 = GEOM.upper * s, L2 = GEOM.lower * s;
      const k = { x: hip.x + L1 * Math.sin(lg.sh), y: hip.y + L1 * Math.cos(lg.sh) };
      const f = { x: k.x + L2 * Math.sin(lg.sh + lg.kn), y: k.y + L2 * Math.cos(lg.sh + lg.kn) };
      ctx.lineCap = 'round';
      ctx.strokeStyle = c1; ctx.lineWidth = Math.max(4, s * 1.5); ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(k.x, k.y); ctx.stroke();
      ctx.strokeStyle = c2; ctx.lineWidth = Math.max(3, s * 1.0); ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.fillStyle = '#1f242c'; ctx.beginPath(); ctx.arc(k.x, k.y, s * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hip.x, hip.y, s * 0.55, 0, Math.PI * 2); ctx.fill();
    };
    // 먼 쪽(왼쪽 다리)은 흐리게, 가까운 쪽(오른쪽 다리)은 진하게
    drawLeg(front, R.legs[0], css('--leg-far'), css('--leg-far')); drawLeg(rear, R.legs[1], css('--leg-far'), css('--leg-far'));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-p);
    const [r, g, b] = R.bodyLed, lit = r + g + b > 0;
    ctx.fillStyle = css('--dog'); ctx.strokeStyle = lit ? `rgb(${r},${g},${b})` : css('--dog-edge'); ctx.lineWidth = lit ? 4 : 1.5;
    roundRect(ctx, -GEOM.bodyLen / 2 * s, -GEOM.bodyH / 2 * s, GEOM.bodyLen * s, GEOM.bodyH * s, GEOM.bodyH / 2.2 * s); ctx.fill(); ctx.stroke();
    // 머리: 앞다리 바로 위 받침에 올린 알약형 머리(영상 장면), 앞면에 LED 판
    const hx = HEAD.fwd * s, hy = -HEAD.up * s, hw = GEOM.headDepth * s, hh = GEOM.headH * s;
    ctx.fillStyle = '#14181d'; ctx.fillRect(hx - 1.3 * s, -GEOM.bodyH / 2 * s - 0.4 * s, 2.6 * s, 0.6 * s);   // 머리 받침
    ctx.fillStyle = css('--dog-head'); roundRect(ctx, hx - hw / 2, hy - hh / 2, hw, hh, hw / 3); ctx.fill();
    const eyesOn = R.headFrame()[0].some(row => row.some(v => v));
    ctx.fillStyle = eyesOn ? '#f4f8ff' : '#3a414a'; ctx.fillRect(hx + hw / 2 - 1, hy - hh * 0.36, 3, hh * 0.72);
    ctx.restore();
    drawLeg(front, R.legs[3], css('--leg'), css('--leg2')); drawLeg(rear, R.legs[2], css('--leg'), css('--leg2'));
  }
}

// 로보독 얼굴 그리기 (홍보 영상 장면 기준): 진회색 테두리 안에 모서리가 둥근 LED 판 두 개,
// 가운데 위에 카메라, 그 아래 검은 거리센서 창. 앞에서 본 모습이므로 화면 왼쪽 = 로보독 오른눈.
export function drawFace(ctx, w, h, frames) {
  const on = (css('--eye-on') || '#eef6ff'), glow = (css('--eye-glow') || 'rgba(220,235,255,.55)');
  ctx.fillStyle = '#20262d'; roundRect(ctx, 0, 0, w, h, h * 0.42); ctx.fill();
  const pad = h * 0.1, mid = w * 0.12, pw = (w - 2 * pad - mid) / 2, ph = h - 2 * pad;
  const cell = Math.min(pw, ph) / 8.4;
  [frames[1], frames[0]].forEach((m, e) => {
    const px = pad + e * (pw + mid), py = pad;
    ctx.fillStyle = '#0d1014'; roundRect(ctx, px, py, pw, ph, ph * 0.22); ctx.fill();
    const gx = px + (pw - 8 * cell) / 2, gy = py + (ph - 8 * cell) / 2;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const lit = m[y][x];
      ctx.shadowBlur = lit ? cell * 0.8 : 0; ctx.shadowColor = glow;
      ctx.fillStyle = lit ? on : '#262c33';
      ctx.beginPath(); ctx.arc(gx + (x + 0.5) * cell, gy + (y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  });
  // 카메라(렌즈) + 거리센서 창
  const cx = w / 2, cw = mid * 0.62;
  ctx.fillStyle = '#0a0c0f'; roundRect(ctx, cx - cw / 2, pad + ph * 0.06, cw, cw, cw * 0.2); ctx.fill();
  ctx.fillStyle = '#1c232b'; ctx.beginPath(); ctx.arc(cx, pad + ph * 0.06 + cw / 2, cw * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a4a5c'; ctx.beginPath(); ctx.arc(cx - cw * 0.08, pad + ph * 0.06 + cw * 0.42, cw * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#050607'; roundRect(ctx, cx - cw * 0.55, pad + ph * 0.5, cw * 1.1, ph * 0.36, cw * 0.1); ctx.fill();
  ctx.fillStyle = '#7a5a20'; ctx.fillRect(cx - cw * 0.42, pad + ph * 0.6, cw * 0.12, cw * 0.2);
}

export function drawEyes(canvas, frames) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 60 || h < 30) return;   // 숨겨져 있을 때
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const fh = Math.min(h - 8, (w - 8) / 2.3), fw = fh * 2.3;
  ctx.save(); ctx.translate((w - fw) / 2, (h - fh) / 2); drawFace(ctx, fw, fh, frames); ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function banner(ctx, c, text, color) {
  ctx.font = 'bold 15px system-ui'; const w = ctx.measureText(text).width + 24;
  const x = (c.clientWidth - w) / 2;
  ctx.fillStyle = color; roundRect(ctx, x, 10, w, 30, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, x + 12, 30);
}
