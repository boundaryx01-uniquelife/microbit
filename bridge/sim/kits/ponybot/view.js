// 포니봇 2D 위에서 보기 + OLED·5x5 LED 그리기 (월드 좌표: x 오른쪽, y 아래, heading 0=위 시계 +, cm)
import { EST, WHEEL_XY, MOTOR_WHEEL } from './pony.js';
import { drawProps } from '../../props.js';

const RAD = Math.PI / 180;
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export class PonyView {
  constructor(canvas, world, robot) { this.cv = canvas; this.world = world; this.robot = robot; this.showBeam = true; this.pad = 14; this.editor = null; }
  fit() {   // 장면 크기에 맞게 비율·해상도를 맞춤
    const { w, h } = this.world.size, cv = this.cv;
    cv.style.aspectRatio = `${w} / ${h}`;
    cv.style.maxWidth = `calc(58vh * ${(w / h).toFixed(3)})`;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(200, Math.round(cv.clientWidth * dpr)), ch = Math.round(cw * h / w);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    this.k = cv.width / w;   // 1cm 당 화면 픽셀
  }
  toWorld(ev) {
    const r = this.cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * this.world.size.w, y: (ev.clientY - r.top) / r.height * this.world.size.h };
  }
  draw() {
    this.fit();
    const { cv, world: W, robot: R, k } = this, g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.scale(k, k);
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
    // 눈금자 10cm
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(4, h - 5, 10, 1); g.textAlign = 'left'; g.font = '3.6px system-ui, sans-serif'; g.fillText('10cm', 16, h - 4.5);
  }
  toScreen(x, y) {   // 월드 → 화면(clientX/Y). 시험·편집기용
    const r = this.cv.getBoundingClientRect();
    return { x: r.left + x / this.world.size.w * r.width, y: r.top + y / this.world.size.h * r.height };
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
    // 차체 (앞 = 위)
    g.fillStyle = '#2d353f'; g.strokeStyle = '#0e1216'; g.lineWidth = 0.5;
    g.beginPath(); g.roundRect(-EST.bodyWid / 2, -EST.bodyLen / 2, EST.bodyWid, EST.bodyLen, 1.5); g.fill(); g.stroke();
    g.fillStyle = '#4a90ff'; g.fillRect(-EST.bodyWid / 2 + 1, -EST.bodyLen / 2 - 0.4, EST.bodyWid - 2, 1.2);       // 앞(초음파 쪽)
    g.fillStyle = '#d7dce4'; g.beginPath(); g.arc(-2, -EST.bodyLen / 2 + 0.3, 1.5, 0, 7); g.arc(2, -EST.bodyLen / 2 + 0.3, 1.5, 0, 7); g.fill();  // 초음파 눈 2개
    g.fillStyle = '#111'; g.fillRect(-2.6, -2.5, 5.2, 4.2);  // 마이크로비트 자리
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
