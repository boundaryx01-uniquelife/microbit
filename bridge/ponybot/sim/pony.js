// AI 포니봇(boundaryX · micro:bit 메카넘 4바퀴) 시뮬레이터 — 로봇 모델 + 블록 API + 실행기
// 기준 소스: github.com/boundary-x/ai_ponybot_basic v1.3.1 (kits/ponybot/blocks.json). 구현(PWM 표)을 읽어 만들었음.
// ※ 움직임(속도·가감속·크기·센서 위치)은 실물 측정값이 아닌 '추정'입니다. 실측하면 EST 만 고치면 됩니다.
import { Runner, addAsyncNs } from '../../sim/runtime.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;

// ------------------------------------------------------------
// 추정 상수 (한 곳에 모음 — 실물 측정 후 교체하고 화면의 "추정" 표시를 지운다)
// ------------------------------------------------------------
export const EST = {
  maxCmPerSec: 30,    // 속도 255일 때 바퀴 선속도(cm/s) — 추정
  accel: 120,         // 바퀴 가속·감속(cm/s²) — 추정 (0이면 즉시)
  deadband: 0,        // 이 속도값(0~255) 미만이면 모터가 안 도는지 — 모름(0 = 없음으로 가정)
  bodyLen: 16, bodyWid: 10,   // 차체 길이(앞뒤)·폭(좌우) cm — 추정
  axle: 10,           // 앞뒤 바퀴 중심 간격 cm — 추정
  track: 13,          // 좌우 바퀴 중심 간격 cm — 추정
  wheelLen: 6.4, wheelWid: 2.6,
  radius: 9,          // 충돌 반경(원) cm — 추정
  sonarOffset: 8,     // 몸 중심 → 초음파 센서(앞면) cm — 추정
  sonarMin: 2, sonarRealMax: 400, // 실제 HC-SR04류가 읽는 범위 cm — 추정 (ping 의 maxCmDistance 와 별개)
  lineForward: 7, lineHalfGap: 2.5,   // 라인 센서 2개의 위치(몸 중심 앞쪽, 좌우 간격의 절반) cm — 추정
  lineOnBlack: true,  // 검은 선 위에서 1 을 읽는다고 가정 — 확인 필요(소스는 핀 값만 돌려줌)
  colorForward: 3,    // 컬러 센서 위치(몸 중심 앞쪽) cm — 추정
  clearBase: 3000, clearRange: 17000, // 컬러센서 '밝기(B)' 원시값 추정(검정≈3000, 흰색≈20000)
};
// 대각선(두 바퀴만 도는) 이동·회전 계산에 쓰는 k = (좌우 + 앞뒤 간격)/2
EST.k = (EST.track + EST.axle) / 2;

// ------------------------------------------------------------
// 모터 번호 → 바퀴 위치 (확장 PWM 표에서 푼 결과 — 실물 확인 필요)
//  근거(main.ts): ↖(LeftForward)에서 M1+M3 만 전진 = 대각선 쌍 {FR,RL},
//  ↗ 에서 M2+M4 = {FL,RR}. DirectionControl.Clockwise 에서 M1·M2 전진·M3·M4 후진 → M1·M2 = 왼쪽, M3·M4 = 오른쪽
//  (이름 'Clockwise' 를 믿는 가정. 화살표 글자는 ↶ 로 반대라 실물 확인이 필요).
//  ⇒ M1=뒤왼쪽(RL), M2=앞왼쪽(FL), M3=앞오른쪽(FR), M4=뒤오른쪽(RR)
// ------------------------------------------------------------
export const MOTOR_WHEEL = { 1: 'RL', 2: 'FL', 3: 'FR', 4: 'RR' };
export const WHEELS = ['FL', 'FR', 'RL', 'RR'];
export const WHEEL_XY = () => ({   // 몸 좌표(오른쪽 +x, 앞 +y)
  FL: [-EST.track / 2, EST.axle / 2], FR: [EST.track / 2, EST.axle / 2],
  RL: [-EST.track / 2, -EST.axle / 2], RR: [EST.track / 2, -EST.axle / 2],
});

// runMecanum / runNormal 의 PWM 표 (main.ts 에서 옮김). 값 = 모터 M1..M4 의 방향(+1 전진 / -1 후진 / 0 정지)
const MECANUM = {
  1: [1, 0, 1, 0], 2: [1, 1, 1, 1], 3: [0, 1, 0, 1], 4: [1, -1, 1, -1], 5: [0, 0, 0, 0],
  6: [-1, 1, -1, 1], 7: [0, -1, 0, -1], 8: [-1, -1, -1, -1], 9: [-1, 0, -1, 0],
};
const NORMAL = { 1: [1, 1, 1, 1], 2: [-1, -1, -1, -1], 3: [1, 1, -1, -1], 4: [-1, -1, 1, 1] };

// ------------------------------------------------------------
// 열거형 (kits/ponybot/blocks.json 에서 생성 — 자동 번호 포함). 학생 코드는 aiPonybot.Mecanum.Forward 처럼 씀
// ------------------------------------------------------------
export const ENUMS = {
  Mecanum: { LeftForward: 1, Forward: 2, RightForward: 3, Left: 4, Stop: 5, Right: 6, LeftBackward: 7, Backward: 8, RightBackward: 9 },
  DirectionControl: { Forward: 1, Backward: 2, Clockwise: 3, CounterClockwise: 4 },
  Stepper: { Stepper42: 1, Stepper28: 2 },
  Servo: { Servo1: 1, Servo2: 2, Servo3: 3, Servo4: 4, Servo5: 5, Servo6: 6, Servo7: 7, Servo8: 8 },
  Motor: { Motor4: 4, Motor1: 1, Motor3: 3, Motor2: 2 },
  Direction: { Clockwise: 1, CounterClockwise: -1 },
  StepperPair: { Motors1And2: 1, Motors3And4: 2 },
  TwoLineState: { OffOff: 0, OnOn: 1, OnOff: 2, OffOn: 3 },
  LineState: { Off: 0, On: 1 },
  LineSensorChannel: { Left: 1, Right: 2 },
  PingUnit: { MicroSeconds: 0, Centimeters: 1, Inches: 2 },
  DetectedColor: { Red: 0, Green: 1, Blue: 2, Yellow: 3 },
  SensorVersion: { V1: 1, V2: 2 },
  Display: { On: 1, Off: 0 },
  UARTDataType: { X: 0, Y: 1, W: 2, H: 3, D: 4 },
  ColorDataType: { R: 0, G: 1, B: 2, I: 3 },
  ReturnFormat: { String: 0, Number: 1 },
  FaceDataType: { X: 0, Y: 1, Z: 2, Yaw: 3, Pitch: 4, Mouth: 5, LeftEye: 6, RightEye: 7, Roll: 8, Smile: 9, Visible: 10 },
  HandDataType: { LeftDir: 0, LeftSpeed: 1, RightDir: 2, RightSpeed: 3 },
};

// ------------------------------------------------------------
// 월드: 바닥(색·검은 선·컬러칩) + 장애물 + 핀 + 벽. 좌표 x 오른쪽, y 아래, heading 0=위 시계 +, 단위 cm
// ------------------------------------------------------------
const WHITE = [235, 235, 235], BLACK = [22, 22, 22];
export const CHIP_RGB = { red: [215, 45, 45], yellow: [235, 200, 40], green: [50, 165, 80], blue: [50, 90, 200] };

function roundedLoop(x0, y0, x1, y1, r, n = 8) {   // 시계 방향 둥근 사각 경로 (왼쪽 변 아래쪽에서 시작해 위로)
  const pts = [];
  const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * RAD; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  pts.push([x0, y1 - r]);
  arc(x0 + r, y0 + r, 180, 270);       // 왼쪽 위
  arc(x1 - r, y0 + r, 270, 360);       // 오른쪽 위
  arc(x1 - r, y1 - r, 0, 90);          // 오른쪽 아래
  arc(x0 + r, y1 - r, 90, 180);        // 왼쪽 아래
  return pts;
}
function distToPolyline(px, py, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

export const SCENES = {
  bowling: {
    title: '볼링 레인 (스트라이크!)', w: 140, h: 260, walls: true, start: { x: 70, y: 238, heading: 0 }, floor: [226, 205, 160],
    hint: '핀 6개를 향해 똑바로 달려 보세요. 오른쪽으로 치우치면 어떤 바퀴가 문제일까요?',
    build(w) {
      w.pins = [];
      [[-10, 52], [0, 52], [10, 52], [-5, 40], [5, 40], [0, 28]].forEach(([dx, y]) => w.pins.push({ x: 70 + dx, y, r: 3.5, down: false }));
      w.floor.marks.push({ type: 'line', x0: 10, y0: 222, x1: 130, y1: 222, label: '출발선' });
    },
  },
  circuit: {
    title: '컬러칩 서킷 (검은 선 + 컬러칩)', w: 240, h: 160, walls: true, start: { x: 40, y: 104, heading: 0 }, floor: [235, 235, 235],
    hint: '두 라인 센서로 검은 선을 따라가 보세요. 컬러칩(빨강·노랑·초록) 위에서는 색 값이 바뀌어요.',
    build(w) {
      w.floor.tracks.push({ pts: roundedLoop(40, 35, 200, 125, 30), width: 4 });
      w.floor.chips.push({ x: 106, y: 31, w: 8, h: 8, color: 'red', onLine: true });
      w.floor.chips.push({ x: 196, y: 76, w: 8, h: 8, color: 'yellow', onLine: true });
      w.floor.chips.push({ x: 106, y: 121, w: 8, h: 8, color: 'green', onLine: true });
    },
  },
  relay: {
    title: '거리 릴레이 (책/벽과의 거리)', w: 120, h: 260, walls: true, start: { x: 60, y: 224, heading: 0 }, floor: [235, 235, 235],
    hint: '책 앞면까지의 거리를 ping 으로 재고, 가까울수록 느리게 가도록 코드를 써 보세요.',
    build(w) {
      w.obstacles.push({ x: 38, y: 20, w: 44, h: 2.5, kind: 'book', label: '책' });
      w.floor.zones.push({ y0: 22.5, y1: 32.5, color: 'rgba(229,72,77,.18)', label: '10cm 이하' });
      w.floor.zones.push({ y0: 32.5, y1: 42.5, color: 'rgba(235,190,40,.2)', label: '10~20cm' });
      w.floor.zones.push({ y0: 42.5, y1: 260, color: 'rgba(60,170,90,.1)', label: '20cm 초과' });
      w.floor.marks.push({ type: 'line', x0: 10, y0: 240, x1: 110, y1: 240, label: '출발선' });
    },
  },
  free: {
    title: '넓은 빈 바닥 (벽 없음)', w: 300, h: 200, walls: false, start: { x: 150, y: 100, heading: 0 }, floor: [240, 240, 240],
    hint: '벽이 없어서 앞에 아무것도 없으면 거리는 500(최댓값)으로 읽혀요.',
    build() {},
  },
};

export class PonyWorld {
  constructor() { this.userBoxes = []; this.loadScene('bowling'); }
  loadScene(id) {
    const sc = SCENES[id] || SCENES.free;
    this.sceneId = SCENES[id] ? id : 'free';
    this.scene = sc;
    this.size = { w: sc.w, h: sc.h };
    this.walls = sc.walls;
    this.start = { ...sc.start };
    this.obstacles = [];
    this.pins = [];
    this.floor = { bg: sc.floor, tracks: [], chips: [], zones: [], marks: [] };
    this.userBoxes = [];
    sc.build(this);
  }
  addBox(x, y) { const b = { x: x - 6, y: y - 6, w: 12, h: 12, kind: 'box', user: true }; this.obstacles.push(b); this.userBoxes.push(b); return b; }
  removeBoxAt(x, y) {
    const i = this.obstacles.findIndex(o => o.user && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
    if (i < 0) return false; this.obstacles.splice(i, 1); return true;
  }
  clearBoxes() { this.obstacles = this.obstacles.filter(o => !o.user); }
  resetPins() { this.pins.forEach(p => { p.down = false; }); }
  pinsDown() { return this.pins.filter(p => p.down).length; }

  outside(x, y, r) { return x < r || y < r || x > this.size.w - r || y > this.size.h - r; }
  collides(x, y, r) {
    if (this.walls && this.outside(x, y, r)) return true;
    return this.obstacles.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
  }
  // 광선(해석적): 장애물 사각형 + 서 있는 핀(원) + 벽. 못 맞히면 Infinity. 거리 단위 cm
  raycast(ox, oy, heading, maxLen = 1e4) {
    const dx = Math.sin(heading * RAD), dy = -Math.cos(heading * RAD);
    let best = Infinity;
    const slab = (minx, miny, maxx, maxy) => {
      let t0 = 0, t1 = Infinity;
      for (const [o, d, mn, mx] of [[ox, dx, minx, maxx], [oy, dy, miny, maxy]]) {
        if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return Infinity; continue; }
        let a = (mn - o) / d, b = (mx - o) / d; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
      }
      return t0;
    };
    for (const o of this.obstacles) best = Math.min(best, slab(o.x, o.y, o.x + o.w, o.y + o.h));
    for (const p of this.pins) {
      if (p.down) continue;
      const fx = ox - p.x, fy = oy - p.y, b = fx * dx + fy * dy, c = fx * fx + fy * fy - p.r * p.r, disc = b * b - c;
      if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t >= 0) best = Math.min(best, t); }
    }
    if (this.walls) {
      const t = slabInside(ox, oy, dx, dy, this.size.w, this.size.h);
      best = Math.min(best, t);
    }
    return best <= maxLen ? best : Infinity;
  }
  // 바닥 한 점: {rgb, line} — line = 검은 선(또는 선 위에 놓인 칩) 위인가
  floorAt(x, y) {
    const f = this.floor;
    for (const c of f.chips) {
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return { rgb: CHIP_RGB[c.color] || WHITE, line: !!c.onLine, chip: c.color };
    }
    for (const t of f.tracks) if (distToPolyline(x, y, t.pts) <= t.width / 2) return { rgb: BLACK, line: true };
    return { rgb: f.bg, line: false };
  }
}
function slabInside(ox, oy, dx, dy, W, H) {   // 상자 안쪽에서 벽까지 거리
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (W - ox) / dx); else if (dx < -1e-9) t = Math.min(t, (0 - ox) / dx);
  if (dy > 1e-9) t = Math.min(t, (H - oy) / dy); else if (dy < -1e-9) t = Math.min(t, (0 - oy) / dy);
  return Math.max(0, t);
}

// ------------------------------------------------------------
// 로봇: 모터 4개 PWM → 바퀴 4개 속도 → 메카넘 순기구학
// ------------------------------------------------------------
export class PonyRobot {
  constructor(world) { this.world = world; this.reset(); }
  reset() {
    const s = this.world.start;
    this.x = s.x; this.y = s.y; this.heading = s.heading;
    this.pwm = [0, 0, 0, 0];                         // M1..M4 부호 있는 PWM(-4095..4095, +=전진)
    this.w = { FL: 0, FR: 0, RL: 0, RR: 0 };         // 실제 바퀴 선속도 cm/s (가감속 반영)
    this.vx = 0; this.vy = 0; this.omega = 0;        // 몸 좌표 속도 cm/s, 각속도 rad/s(시계 +)
    this.servo = new Array(8).fill(null);            // 서보 각도(명령값)
    this.trail = []; this.bumped = false; this.t = 0;
    this.colorVersion = 1;
    this.world.resetPins && this.world.resetPins();
  }
  setMotor(m, pwm) { this.pwm[m - 1] = clamp(Number.isFinite(pwm) ? pwm : 0, -4095, 4095); }
  stopAll() { this.pwm = [0, 0, 0, 0]; }
  // 명령 → 목표 바퀴 속도(cm/s). PWM/16 = 속도값(0~255)
  targetSpeed(wheel) {
    const m = +Object.keys(MOTOR_WHEEL).find(k => MOTOR_WHEEL[k] === wheel);
    const u = this.pwm[m - 1] / 16;
    if (Math.abs(u) < EST.deadband) return 0;
    return u / 255 * EST.maxCmPerSec;
  }
  step(dt) {
    let left = dt;
    while (left > 1e-9) { const h = Math.min(left, 0.01); this._sub(h); left -= h; }
  }
  _sub(dt) {
    const a = EST.accel > 0 ? EST.accel * dt : Infinity;
    for (const n of WHEELS) { const t = this.targetSpeed(n); this.w[n] += clamp(t - this.w[n], -a, a); }
    const w = this.w;
    const vx = (w.FL - w.FR - w.RL + w.RR) / 4;            // 오른쪽(+) 옆 이동
    const vy = (w.FL + w.FR + w.RL + w.RR) / 4;            // 앞(+)
    const om = (w.FL - w.FR + w.RL - w.RR) / (4 * EST.k);  // rad/s, 시계 +
    this.vx = vx; this.vy = vy; this.omega = om;
    const dh = om * dt;
    const mid = this.heading * RAD + dh / 2, c = Math.cos(mid), s = Math.sin(mid);
    const dx = (vx * c + vy * s) * dt, dy = (vx * s - vy * c) * dt;
    this.heading += dh / RAD;
    const r = EST.radius, W = this.world;
    if (!W.collides(this.x + dx, this.y + dy, r)) { this.x += dx; this.y += dy; this.bumped = false; }
    else if (!W.collides(this.x + dx, this.y, r)) { this.x += dx; this.bumped = true; }
    else if (!W.collides(this.x, this.y + dy, r)) { this.y += dy; this.bumped = true; }
    else this.bumped = true;
    this.t += dt;
    // 핀 쓰러뜨리기(가벼운 핀: 막지 않고 쓰러짐)
    for (const p of W.pins) if (!p.down && Math.hypot(p.x - this.x, p.y - this.y) < r + p.r) p.down = true;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last[0] - this.x, last[1] - this.y) > 1) { this.trail.push([this.x, this.y]); if (this.trail.length > 1500) this.trail.shift(); }
  }
  // 몸 좌표 (오른쪽 u, 앞 v) → 월드 좌표
  toWorld(u, v) {
    const c = Math.cos(this.heading * RAD), s = Math.sin(this.heading * RAD);
    return [this.x + u * c + v * s, this.y + u * s - v * c];
  }
  // 초음파: 미리 재 둔 참 거리(cm). 반사 없으면 Infinity
  sonarTrue() {
    const [ox, oy] = this.toWorld(0, EST.sonarOffset);
    const d = this.world.raycast(ox, oy, this.heading, EST.sonarRealMax);
    return d;
  }
  lineRaw(i) {   // i: 0 왼쪽(P16), 1 오른쪽(P15)  → 0/1
    const [px, py] = this.toWorld(i === 0 ? -EST.lineHalfGap : EST.lineHalfGap, EST.lineForward);
    const on = this.world.floorAt(px, py).line;
    return (on === EST.lineOnBlack) ? 1 : 0;
  }
  colorRGB() {
    const [px, py] = this.toWorld(0, EST.colorForward);
    return this.world.floorAt(px, py).rgb;
  }
}

// ------------------------------------------------------------
// OLED 128x64 (SSD1306) — 확장의 화면 버퍼·글자 그리기·스크롤을 그대로 옮김
//  screen = 메모리 버퍼, shown = 실제 화면. pixel() 은 buffer 만 바꾸고 draw() 때 화면에 나옴(확장과 같음)
// ------------------------------------------------------------
const FONT_HEX = '000000000000005F00000007000700147F147F14242A072A12231308646237495522500005030000001C2241000041221C00082A1C2A0808083E080800503000000808080808006060000020100804023E5149453E00427F400042615149462141454B311814127F1027454545393C4A49493001710905033649494936064949291E003636000000563600000008142241141414141441221408000201510906324979413E7E1111117E7F494949363E414141227F4141221C7F494949417F090901013E414151327F0808087F00417F41002040413F017F081422417F404040407F0204027F7F0408107F3E4141413E7F090909063E4151215E7F09192946464949493101017F01013F4040403F1F2040201F7F2018207F63140814630304780403615149454300007F4141020408102041417F000004020102044040404040000102040020545454787F484444383844444420384444487F3854545418087E090102081454543C7F0804047800447D40002040443D00007F10284400417F40007C041804787C0804047838444444387C14141408081414187C7C080404084854545420043F4440203C4040207C1C2040201C3C4030403C44281028440C5050503C4464544C44000836410000007F000000413608000201020402';
const FONT = Uint8Array.from((FONT_HEX.match(/../g) || []).map(h => parseInt(h, 16)));

export class Oled {
  constructor(warn) { this.warn = warn || (() => {}); this.reset(); }
  reset() {
    this.screen = new Uint8Array(1024); this.shown = new Uint8Array(1024);
    this.on = true; this.inverted = false; this.cx = 0; this.cy = 0; this.drawEnabled = 1; this.version = 0;
  }
  _changed() { this.version++; }
  draw(data) { if (data > 0) { this.shown.set(this.screen); this._changed(); } }
  invert(on) { this.inverted = !!on; this._changed(); }
  display(on) { this.on = !!on; this._changed(); }
  clear() { this.cx = this.cy = 0; this.screen.fill(0); this.draw(1); }
  pixel(x, y, color = 1) {
    const page = y >> 3, sh = ((y % 8) + 8) % 8, idx = x + page * 128;
    if (idx < 0 || idx > 1023) return;
    this.screen[idx] = color ? (this.screen[idx] | (1 << sh)) : (this.screen[idx] & ~(1 << sh));
  }
  drawChar(ch, col, row, color = 1) {
    const code = ch.charCodeAt(0);
    if (code > 126) this.warn('oled-nonascii', 'OLED 화면은 영문·숫자·기호만 나와요 (한글 등은 빈칸으로 보여요)');
    const pos = (Math.min(127, Math.max(code, 32)) - 32) * 5;
    const idx = col + row * 128;
    for (let i = 0; i < 5; i++) {
      const f = FONT[pos + i] || 0;
      const v = (color > 0 ? f : f ^ 0xFF) & 0xFF;
      if (idx + i >= 0 && idx + i < 1024) { this.screen[idx + i] = v; this.shown[idx + i] = v; }
    }
    const m = color > 0 ? 0 : 0xFF;
    if (idx + 5 >= 0 && idx + 5 < 1024) { this.screen[idx + 5] = m; this.shown[idx + 5] = m; }
    this._changed();
  }
  showString(text, column, row, color = 1) {
    text = String(text);
    for (let n = 0; n < text.length; n++) { this.drawChar(text.charAt(n), column, row, color); column += 6; }
  }
  showNumber(number, column, row, color = 1) { this.showString(String(number), column, row, color); }
  scroll() {
    this.cx = 0; this.cy += 1;
    if (this.cy > 7) { this.cy = 7; this.screen.copyWithin(0, 128); this.screen.fill(0, 896); this.draw(1); }
  }
  printString(text, newline = true) {
    text = String(text);
    for (let n = 0; n < text.length; n++) {
      this.drawChar(text.charAt(n), this.cx, this.cy, 1);
      this.cx += 6;
      if (this.cx > 120) this.scroll();
    }
    if (newline) this.scroll();
  }
  printNumber(number, newline = true) { this.printString(String(number), newline); }
  horizontalLine(x, y, length, color = 1) {
    const saved = this.drawEnabled;
    if (y < 0 || y > 63) return;
    this.drawEnabled = 0;
    for (let i = x; i < x + length; i++) if (i >= 0 && i <= 127) this.pixel(i, y, color);
    this.drawEnabled = saved; this.draw(this.drawEnabled);
  }
  verticalLine(x, y, length, color = 1) {
    this.drawEnabled = 0;                       // (확장 원본이 범위 밖일 때 되돌리지 않는 점까지 그대로)
    if (x < 0 || x > 127) return;
    for (let i = y; i < y + length; i++) if (i >= 0 && i <= 63) this.pixel(x, i, color);
    this.drawEnabled = 1; this.draw(1);
  }
  rectangle(x1, y1, x2, y2, color = 1) {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    this.drawEnabled = 0;
    this.horizontalLine(x1, y1, x2 - x1 + 1, color);
    this.horizontalLine(x1, y2, x2 - x1 + 1, color);
    this.verticalLine(x1, y1, y2 - y1 + 1, color);
    this.verticalLine(x2, y1, y2 - y1 + 1, color);
    this.drawEnabled = 1; this.draw(1);
  }
  // 그리기용: 화면에 보이는 (x,y) 켜짐 여부
  lit(x, y) { return (this.shown[x + (y >> 3) * 128] >> (y & 7)) & 1; }
  textRows() {   // 시험용: 한 줄(page)을 6px 글자 칸으로 읽어 문자열로 되돌림
    const rev = new Map(); for (let c = 32; c < 127; c++) rev.set(Array.from(FONT.slice((c - 32) * 5, (c - 32) * 5 + 5)).join(','), String.fromCharCode(c));
    const rows = [];
    for (let p = 0; p < 8; p++) {
      let s = '';
      for (let col = 0; col < 126; col += 6) s += rev.get(Array.from(this.shown.slice(p * 128 + col, p * 128 + col + 5)).join(',')) || '?';
      rows.push(s.replace(/\s+$/, ''));
    }
    return rows;
  }
}

// ------------------------------------------------------------
// aiPonybot 블록 동작 (확장 ai_ponybot_basic 1.3.1). R=PonyRobot, h={warnOnce, oled}
// ------------------------------------------------------------
export function makePonybotApi(R, h) {
  const pwmOf = (speed) => {
    let p = Number(speed) * 16;          // 255 → 4080 (확장: speed*16)
    if (!(p === p)) p = 0;
    if (p >= 4096) p = 4095;
    if (p <= -4096) p = -4095;
    return p;
  };
  const apply = (row, pwm) => row.forEach((d, i) => R.setMotor(i + 1, d * pwm));
  const reading = (v) => v;
  return {
    // --- 모터 ---
    runMecanum: (direction, speed) => {
      const row = MECANUM[direction]; if (!row) return;       // 확장의 switch 는 default 없음: 아무 것도 안 바꿈
      let p = pwmOf(speed); if (p < 0) p = 0;                 // 음수 PWM 은 PCA9685 에서 '꺼짐'(상위 바이트 0xFF → 완전 끔)으로 읽힘(추정)
      apply(row, p);
    },
    runNormal: (direction, speed) => {
      const row = NORMAL[direction]; if (!row) return;
      let p = pwmOf(speed); if (p < 0) p = 0;
      apply(row, p);
    },
    runMotor: (index, direction, speed) => {
      if (index > 4 || index <= 0) return;
      // 확장: M3·M4 는 방향을 뒤집고 핀도 반대라 결과적으로 같다 → Direction.Clockwise(1) = 그 바퀴 전진
      R.setMotor(index, pwmOf(speed * direction));
    },
    stopMotor: (index) => { if (index >= 1 && index <= 4) R.setMotor(index, 0); },
    stopAllMotors: () => { R.stopAll(); },
    servo: (index, degree) => { if (index >= 1 && index <= 8) R.servo[index - 1] = degree; },
    // --- 라인 센서 (왼쪽 P16, 오른쪽 P15) ---
    readLineSensor: (ch) => R.lineRaw(ch === 1 ? 0 : 1),
    checkSingleLineSensor: (ch, state) => R.lineRaw(ch === 1 ? 0 : 1) === state,
    checkTwoLineState: (state) => {
      const l = R.lineRaw(0), r = R.lineRaw(1);
      switch (state) {
        case 0: return l === 0 && r === 0;
        case 1: return l === 1 && r === 1;
        case 2: return l === 1 && r === 0;
        case 3: return l === 0 && r === 1;
        default: return false;
      }
    },
    // --- 초음파: 반사 없으면 0 이 아니라 maxCmDistance(기본 500)를 돌려줌 ---
    ping: (unit, maxCmDistance = 500) => {
      const d = R.sonarTrue();                                  // cm, 없으면 Infinity
      const us = Math.floor(Math.max(d, EST.sonarMin) * 58);    // 에코 펄스 길이(µs)
      const timeout = maxCmDistance * 58;
      const noEcho = !isFinite(d) || us === 0 || us > timeout;
      if (noEcho) {
        if (unit === 1) return maxCmDistance;
        if (unit === 2) return Math.floor(maxCmDistance * 100 / 254);
        return maxCmDistance * 58;
      }
      if (unit === 1) return Math.floor(us / 58);
      if (unit === 2) return Math.floor(us / 148);
      return us;
    },
    // --- 컬러 센서 (TCS3472) ---
    initColorSensor: (version) => { R.colorVersion = version; },
    getLight: () => { const [r, g, b] = R.colorRGB(); return Math.round(EST.clearBase + (r + g + b) / 765 * EST.clearRange); },
    getRed: () => Math.round(R.colorRGB()[0]),
    getGreen: () => Math.round(R.colorRGB()[1]),
    getBlue: () => Math.round(R.colorRGB()[2]),
    isColorAdvanced: (color, threshold = 40) => {
      const [r, g, b] = R.colorRGB();
      if (r + g + b < 60) return false;
      switch (color) {
        case 0: return (r > g && r > b && r > g * 1.5);
        case 3: return (r > b && g > b && r > g && r <= g * 1.5);
        case 1: return (g > r && g >= b && g > r * 1.4);
        case 2: return (b > r && b > g);
        default: return false;
      }
    },
    isColorInRange: (minR, maxR, minG, maxG, minB, maxB) => {
      const [r, g, b] = R.colorRGB();
      return r > minR && r < maxR && g > minG && g < maxG && b > minB && b < maxB;
    },
    // --- OLED ---
    invert: (on = true) => h.oled.invert(on),
    clear: () => h.oled.clear(),
    display: (on) => h.oled.display(on),
    pixel: (x, y, c = 1) => h.oled.pixel(x, y, c),
    showString: (t, c, r, col = 1) => h.oled.showString(t, c, r, col),
    showNumber: (n, c, r, col = 1) => h.oled.showNumber(n, c, r, col),
    printString: (t, nl = true) => h.oled.printString(t, nl),
    printNumber: (n, nl = true) => h.oled.printNumber(n, nl),
    horizontalLine: (x, y, l, c = 1) => h.oled.horizontalLine(x, y, l, c),
    verticalLine: (x, y, l, c = 1) => h.oled.verticalLine(x, y, l, c),
    rectangle: (a, b, c2, d, col = 1) => h.oled.rectangle(a, b, c2, d, col),
    // --- AI 데이터 파서·스테퍼: 시뮬레이터에 데이터가 없음 → 경고(아래 프록시가 처리) ---
  };
}

// ------------------------------------------------------------
// 실행기: 로보독용 Runner 를 이어받아 aiPonybot 환경만 갈아 끼움
// ------------------------------------------------------------
addAsyncNs('aiPonybot', 'neopixel');   // 확장 네임스페이스(없으면 콜백 async 승격이 안 될 수 있음)

export class PonyRunner extends Runner {
  constructor(robot, ui) {
    super(robot, ui);
    this.oled = new Oled((k, m) => this.warnOnce(k, m));
  }
  stop() {
    super.stop();
    this.robot.stopAll();           // 정지 뒤에도 바퀴가 계속 도는 것 방지
  }
  async start(src) {
    this.oled.reset();
    return super.start(src);
  }
  buildEnv() {
    const env = super.buildEnv();
    const self = this;
    const warnProxy = (ns, impl) => new Proxy(impl, {
      get(t, p) {
        if (p in t) return t[p];
        if (typeof p === 'symbol') return undefined;
        return (...a) => { self.warnOnce(ns + '.' + String(p), `시뮬레이터에서 지원하지 않는 블록: ${ns}.${String(p)} (무시됨)`); return 0; };
      },
    });
    const api = makePonybotApi(this.robot, { oled: this.oled });
    // 열거형은 MakeCode 처럼 aiPonybot.Mecanum.Forward 로 씀(네임스페이스 안)
    env.aiPonybot = warnProxy('aiPonybot', Object.assign({}, api, ENUMS));
    // 맨 이름(Mecanum.Forward)은 MakeCode 에서 오류 → 시뮬레이터도 알려 줌
    for (const name of Object.keys(ENUMS)) {
      if (name in env) continue;
      env[name] = new Proxy({}, { get(t, p) { if (typeof p === 'symbol') return undefined; throw new Error(`${name} 은(는) aiPonybot.${name}.${String(p)} 처럼 써야 해요`); } });
    }
    env.robodog = warnProxy('robodog', {});     // 로보독 블록은 포니봇에 없음
    delete env.deflib;
    // 조명(neopixel, ws2812b) 확장: 아직 모양이 없음 → 경고만. strip.메서드() 사슬이 깨지지 않게 속이 빈 객체를 돌려줌
    const ghost = () => new Proxy(function () {}, {
      get(t, p) { if (typeof p === 'symbol' || p === 'then') return undefined; self.warnOnce('neopixel', '조명(네오픽셀) 블록은 이 시뮬레이터에서 아직 지원하지 않아요 (무시됨)'); return ghost(); },
      apply() { self.warnOnce('neopixel', '조명(네오픽셀) 블록은 이 시뮬레이터에서 아직 지원하지 않아요 (무시됨)'); return ghost(); },
    });
    env.neopixel = ghost();
    env.NeoPixelColors = new Proxy({}, { get: (t, p) => (typeof p === 'symbol' ? undefined : 0) });
    return env;
  }
}
