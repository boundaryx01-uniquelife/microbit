// 2D 화면: 위에서 본 책상(이동 경로·장애물) + 옆에서 본 다리 자세
import { EST } from './runtime.js';

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
    const L = EST.bodyLen * s, Wd = EST.bodyWid * s;
    // 다리(발 위치)
    const feet = [[-1, -1], [-1, 1], [1, 1], [1, -1]];   // [좌우, 앞뒤]: 0 왼앞,1 왼뒤,2 오른뒤,3 오른앞
    R.legs.forEach((lg, i) => {
      const fx = feet[i][0] * (Wd / 2 + 2), fy = feet[i][1] * (L / 2 - 2 * s) - lg.fx * s;
      ctx.fillStyle = lg.raised ? css('--accent') : css('--leg');
      ctx.beginPath(); ctx.arc(fx, fy, Math.max(3, 1.4 * s), 0, Math.PI * 2); ctx.fill();
    });
    const [r, g, b] = R.bodyLed, lit = r + g + b > 0;
    ctx.fillStyle = css('--dog'); ctx.strokeStyle = lit ? `rgb(${r},${g},${b})` : css('--dog-edge'); ctx.lineWidth = lit ? 4 : 2;
    roundRect(ctx, -Wd / 2, -L / 2, Wd, L, 4 * s / 3); ctx.fill(); ctx.stroke();
    // 머리와 눈 방향
    ctx.fillStyle = css('--dog-head'); roundRect(ctx, -Wd / 2.6, -L / 2 - 5 * s, Wd / 1.3, 6 * s, 3); ctx.fill();
    ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.moveTo(0, -L / 2 - 7.5 * s); ctx.lineTo(-2 * s, -L / 2 - 4.8 * s); ctx.lineTo(2 * s, -L / 2 - 4.8 * s); ctx.closePath(); ctx.fill();
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
    const s = Math.min(W / 40, H / 22), ground = H - 18;
    ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.font = '11px system-ui'; ctx.fillText('옆에서 본 모습 (오른쪽이 앞)', 8, 14);
    const pose = R.bodyPose(), cx = W / 2;
    const hipY = ground - pose.height * s;
    const half = EST.bodyLen / 2 * s;
    const front = { x: cx + half * Math.cos(pose.pitch), y: hipY - half * Math.sin(pose.pitch) };
    const rear = { x: cx - half * Math.cos(pose.pitch), y: hipY + half * Math.sin(pose.pitch) };
    const drawLeg = (hip, lg, color) => {
      const L1 = EST.upperLeg * s, L2 = EST.lowerLeg * s;
      const k = { x: hip.x + L1 * Math.sin(lg.sh), y: hip.y + L1 * Math.cos(lg.sh) };
      const f = { x: k.x + L2 * Math.sin(lg.sh + lg.kn), y: k.y + L2 * Math.cos(lg.sh + lg.kn) };
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, s * 1.1); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(k.x, k.y); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(k.x, k.y, s * 0.6, 0, Math.PI * 2); ctx.fill();
    };
    // 뒤쪽(왼쪽 다리)을 흐리게, 앞쪽(오른쪽 다리)을 진하게
    drawLeg(front, R.legs[0], css('--leg-far')); drawLeg(rear, R.legs[1], css('--leg-far'));
    // 몸통
    ctx.save(); ctx.translate(cx, hipY); ctx.rotate(-pose.pitch);
    const [r, g, b] = R.bodyLed, lit = r + g + b > 0;
    ctx.fillStyle = css('--dog'); ctx.strokeStyle = lit ? `rgb(${r},${g},${b})` : css('--dog-edge'); ctx.lineWidth = lit ? 4 : 2;
    roundRect(ctx, -half - s, -3.5 * s, 2 * half + 2 * s, 5 * s, s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css('--dog-head'); roundRect(ctx, half - s, -8 * s, 6 * s, 6 * s, s); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(half + 3.6 * s, -6.6 * s, 1.2 * s, 2.6 * s);
    ctx.restore();
    drawLeg(front, R.legs[3], css('--leg')); drawLeg(rear, R.legs[2], css('--leg'));
  }
}

export function drawEyes(canvas, frames) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 60 || h < 30) return;   // 숨겨져 있을 때
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, w, h);
  const cell = Math.min((w - 30) / 16, (h - 12) / 8), gap = 14;
  const x0 = (w - (16 * cell + gap)) / 2, y0 = (h - 8 * cell) / 2;
  // 로보독을 마주 본 모습: 화면 왼쪽 = 로보독 오른눈
  [frames[1], frames[0]].forEach((m, e) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = m[y][x] ? '#5fd3ff' : '#1d2730';
      ctx.beginPath(); ctx.arc(x0 + e * (8 * cell + gap) + (x + 0.5) * cell, y0 + (y + 0.5) * cell, cell * 0.38, 0, Math.PI * 2); ctx.fill();
    }
  });
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
