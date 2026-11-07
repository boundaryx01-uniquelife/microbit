// 로보독 × 마이크로비트 시뮬레이터 — 실행기 + 로봇 모델
// MakeCode JavaScript를 브라우저에서 실행합니다.
// ※ 걷는 속도·회전 속도·크기·거리센서 단위는 실물 측정값이 아닌 추정치입니다.

// ------------------------------------------------------------
// 상수 (추정치 — 실물 측정 후 조정)
// ------------------------------------------------------------
import { GEOM, HEAD, lengthToAngles, legFromAngles } from './legs.js';
export { GEOM, HEAD };

export const EST = {
  walkCmPerSecAt100: 15,   // 속도 100일 때 걷는 속도(cm/s) — 추정치
  turnDegPerSecAt100: 120, // 회전 빠르기 100일 때(°/s) — 추정치
  servoDegPerSec: 450,     // 관절이 움직이는 빠르기(MG90 서보 기준 추정)
  bodyLen: GEOM.bodyLen, bodyWid: GEOM.bodyWid,   // 비율은 공식 시뮬레이터, 절대 크기는 추정
  upperLeg: GEOM.upper, lowerLeg: GEOM.lower,
  noseOffset: HEAD.fwd + GEOM.headDepth / 2,       // 몸 중심 → 머리 앞면(거리센서) cm
  tofMax: 255,             // 거리센서 최대값(값 단위를 cm로 가정)
  radius: 7,               // 충돌 반경(cm)
};

// 다리 번호: 확장 소스의 순서 (0 왼앞, 1 왼뒤, 2 오른뒤, 3 오른앞)
export const LEG_NAMES = ['왼쪽 앞다리', '왼쪽 뒷다리', '오른쪽 뒷다리', '오른쪽 앞다리'];
const LEG_SEL = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 1]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mapRange = (v, a, b, c, d) => Math.round(c + ((clamp(v, a, b) - a) * (d - c)) / (b - a));

// ------------------------------------------------------------
// 5×5 글꼴, 아이콘, 8×8 눈 표정
// ------------------------------------------------------------
const F = (s) => s.split(' ').map(r => r.split('').map(Number));
const FONT = {
  '0': '01110 10011 10101 11001 01110', '1': '00100 01100 00100 00100 01110', '2': '11100 00010 01100 10000 11110',
  '3': '11110 00010 00100 10010 01100', '4': '00110 01010 10010 11111 00010', '5': '11111 10000 11110 00001 11110',
  '6': '00010 00100 01110 10001 01110', '7': '11111 00010 00100 01000 10000', '8': '01110 10001 01110 10001 01110',
  '9': '01110 10001 01110 00100 01000', 'A': '01100 10010 11110 10010 10010', 'B': '11100 10010 11100 10010 11100',
  'C': '01110 10000 10000 10000 01110', 'D': '11100 10010 10010 10010 11100', 'E': '11110 10000 11100 10000 11110',
  'F': '11110 10000 11100 10000 10000', 'G': '01110 10000 10011 10001 01110', 'H': '10010 10010 11110 10010 10010',
  'I': '11100 01000 01000 01000 11100', 'J': '11111 00010 00010 10010 01100', 'K': '10010 10100 11000 10100 10010',
  'L': '10000 10000 10000 10000 11110', 'M': '10001 11011 10101 10001 10001', 'N': '10001 11001 10101 10011 10001',
  'O': '01100 10010 10010 10010 01100', 'P': '11100 10010 11100 10000 10000', 'Q': '01100 10010 10010 01100 00110',
  'R': '11100 10010 11100 10010 10001', 'S': '01110 10000 01100 00010 11100', 'T': '11111 00100 00100 00100 00100',
  'U': '10010 10010 10010 10010 01100', 'V': '10001 10001 10001 01010 00100', 'W': '10001 10001 10101 11011 10001',
  'X': '10010 10010 01100 10010 10010', 'Y': '10001 01010 00100 00100 00100', 'Z': '11110 00100 01000 10000 11110',
  ' ': '00000 00000 00000 00000 00000', '!': '00100 00100 00100 00000 00100', '?': '01100 10010 00100 00000 00100',
  '.': '00000 00000 00000 00000 00100', '-': '00000 00000 01110 00000 00000', '+': '00000 00100 01110 00100 00000',
  ':': '00000 00100 00000 00100 00000', '=': '00000 01110 00000 01110 00000',
};
export function glyph(ch) {
  const c = String(ch).toUpperCase();
  return F(FONT[c] || FONT['?']);
}

const ICONS = {
  Heart: '01010 11111 11111 01110 00100', SmallHeart: '00000 01010 01110 00100 00000', Yes: '00000 00001 00010 10100 01000',
  No: '10001 01010 00100 01010 10001', Happy: '00000 01010 00000 10001 01110', Sad: '00000 01010 00000 01110 10001',
  Confused: '00000 01010 00000 01010 10101', Angry: '10001 01010 00000 11111 10101', Asleep: '00000 11011 00000 01110 00000',
  Surprised: '01010 00000 00100 01010 00100', Silly: '10001 00000 11111 00011 00011', Fabulous: '11111 11011 00000 01010 01110',
  Meh: '01010 00000 00010 00100 01000', Square: '11111 10001 10001 10001 11111', SmallSquare: '00000 01110 01010 01110 00000',
  Diamond: '00100 01010 10001 01010 00100', SmallDiamond: '00000 00100 01010 00100 00000', Target: '00100 01110 11011 01110 00100',
  Triangle: '00000 00100 01010 11111 00000', LeftTriangle: '10000 11000 10100 10010 11111', Chessboard: '01010 10101 01010 10101 01010',
  Skull: '01110 10101 11111 01110 01110', Ghost: '11111 10101 11111 11111 10101', House: '00100 01110 11111 01110 01010',
  Umbrella: '01110 11111 00100 10100 01100', QuarterNote: '00100 00100 00100 11100 11100', EigthNote: '00100 00110 00101 11100 11100',
  Butterfly: '11011 11111 00100 11111 11011', StickFigure: '00100 11111 00100 01010 10001', Duck: '01100 11100 01111 01110 00000',
  TShirt: '11011 11111 01110 01110 01110', Snake: '11000 11011 01010 01110 00000', Rabbit: '10100 10100 11110 11010 11110',
  Cow: '10001 10001 11111 01110 00100', Sword: '00100 00100 00100 01110 00100', Giraffe: '11000 01000 01000 01110 01010',
  Tortoise: '00000 01110 11111 01010 00000', Scissors: '11001 11010 00100 11010 11001', Pitchfork: '10101 10101 11111 00100 00100',
  Rollerskate: '00011 00011 11111 11111 01010',
};

const E8 = (rows) => rows.map(r => r.split('').map(Number));
const mirror8 = (m) => m.map(r => r.slice().reverse());
const EYE_OPEN = E8(['00111100', '01000010', '10000001', '10011001', '10011001', '10000001', '01000010', '00111100']);
const EYE_CLOSED = E8(['00000000', '00000000', '00000000', '10000001', '01000010', '00111100', '00000000', '00000000']);
const EYE_SPARK = E8(['00111100', '01111110', '11001111', '11001111', '11111111', '11111111', '01111110', '00111100']);
// 웃는 눈: 홍보 영상 장면처럼 두꺼운 ∩ 모양
const EYE_HAPPY = E8(['00111100', '01111110', '11100111', '11000011', '11000011', '00000000', '00000000', '00000000']);
// 기본 큰 눈: 홍보 영상 장면처럼 전부 켜고 가운데 작은 + 무늬만 끔
const EYE_FULL_PLUS = E8(['11111111', '11111111', '11101111', '11000111', '11101111', '11111111', '11111111', '11111111']);
const HEART = E8(['00000000', '01100110', '11111111', '11111111', '01111110', '00111100', '00011000', '00000000']);
const HEART_S = E8(['00000000', '00000000', '00100100', '01111110', '00111100', '00011000', '00000000', '00000000']);
const SPARROW = E8(['00000000', '00000000', '00011000', '00111100', '00111100', '00011000', '00000000', '00000000']);
const SHARP = E8(['00000000', '11000000', '01110000', '00111110', '00111110', '00011100', '00000000', '00000000']);
const INSECT = E8(['10101010', '01010101', '10101010', '01010101', '10101010', '01010101', '10101010', '01010101']);
const SNAKE = E8(['00111100', '01100110', '11100111', '11100111', '11100111', '11100111', '01100110', '00111100']);
const pupil = (x) => EYE_OPEN.map((r, y) => r.map((v, i) => (y >= 3 && y <= 4 && (i === x || i === x + 1)) ? 1 : (y >= 3 && y <= 4 && i > 1 && i < 6 ? 0 : v)));
const PIN = [
  E8(['00011000', '00011000', '00011000', '11111111', '11111111', '00011000', '00011000', '00011000']),
  E8(['11000011', '11100111', '01111110', '00111100', '00111100', '01111110', '11100111', '11000011']),
];
// 표정 번호(확장 enum 순서) → [왼눈, 오른눈] 프레임 함수(t: 초). 모양은 실제와 다를 수 있는 근사치.
export const EXPRESSIONS = [
  { name: '초롱초롱', f: () => [EYE_SPARK, mirror8(EYE_SPARK)] },
  { name: 'ILOVEYOU', f: (t) => (Math.floor(t * 2) % 2 ? [HEART_S, HEART_S] : [HEART, HEART]) },
  { name: '눈감기', f: () => [EYE_CLOSED, EYE_CLOSED] },
  { name: '감사', f: () => [EYE_HAPPY, EYE_HAPPY] },
  { name: '고마워요', f: (t) => { const s = Math.floor(t * 3) % 2; const m = s ? EYE_HAPPY.slice(1).concat([EYE_HAPPY[0]]) : EYE_HAPPY; return [m, m]; } },
  { name: '뱁새', f: () => [SPARROW, SPARROW] },
  { name: '좌우굴리기', f: (t) => { const x = [2, 3, 4, 3][Math.floor(t * 3) % 4]; return [pupil(x), pupil(x)]; } },
  { name: '찢눈', f: () => [SHARP, mirror8(SHARP)] },
  { name: '찢눈깜박임', f: (t) => (t % 2 > 1.7 ? [EYE_CLOSED, EYE_CLOSED] : [SHARP, mirror8(SHARP)]) },
  { name: '곤충', f: (t) => (Math.floor(t * 2) % 2 ? [INSECT, INSECT] : [mirror8(INSECT), mirror8(INSECT)]) },
  { name: '깜박', f: (t) => (t % 2.5 > 2.2 ? [EYE_CLOSED, EYE_CLOSED] : [pupil(3), pupil(3)]) },
  { name: '뱀눈', f: () => [SNAKE, SNAKE] },
  { name: '바람개비', f: (t) => { const p = PIN[Math.floor(t * 4) % 2]; return [p, p]; } },
  { name: '왕눈이', f: () => [EYE_FULL_PLUS, mirror8(EYE_FULL_PLUS)] },
];
const blank8 = () => Array.from({ length: 8 }, () => new Array(8).fill(0));
function char8(ch) {
  const g = glyph(ch), m = blank8();
  g.forEach((r, y) => r.forEach((v, x) => { m[y + 1][x + 2] = v; }));
  return m;
}
function parseImage(str, w, h) {
  const cells = String(str).replace(/[^#.01*]/g, '').split('');
  const m = Array.from({ length: h }, () => new Array(w).fill(0));
  for (let i = 0; i < w * h && i < cells.length; i++) m[Math.floor(i / w)][i % w] = (cells[i] === '#' || cells[i] === '1' || cells[i] === '*') ? 1 : 0;
  return m;
}

// ------------------------------------------------------------
// 소리 (Web Audio, 기본 꺼짐) — 효과음은 실제 소리가 아닌 비슷한 신호음
// ------------------------------------------------------------
export const SOUNDS = {
  1: ['멍멍!', [600, 400]], 2: ['으르렁…', [120, 110, 100]], 3: ['화난 소리!', [300, 200, 300]], 4: ['낑낑…', [700, 900, 700]],
  5: ['헥헥', [200, 200]], 11: ['안녕!', [500, 700]], 12: ['기다려!', [500, 500]], 13: ['비켜!', [800, 600]],
  14: ['출발!', [400, 600, 800]], 21: ['레이저~', [1500, 500]], 22: ['위잉~', [200, 400, 200]], 23: ['띠리리', [900, 1100, 900, 1100]],
  24: ['외계신호', [300, 1200, 600]], 25: ['동작음', [500]], 26: ['쾅!', [90]],
  31: ['도', [523]], 32: ['레', [587]], 33: ['미', [659]], 34: ['파', [698]], 35: ['솔', [784]], 36: ['라', [880]], 37: ['시', [988]], 38: ['높은 도', [1047]],
};
let audioCtx = null;
export function playTones(freqs, vol, enabled) {
  if (!enabled) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    for (const f of freqs) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = f < 150 ? 'sawtooth' : 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.04 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.2); t += 0.12;
    }
  } catch (e) { /* 소리 불가 환경 */ }
}

// ------------------------------------------------------------
// 로봇 상태와 물리 모델
// ------------------------------------------------------------
export class Robot {
  constructor(world) { this.world = world; this.reset(); }
  reset() {
    const w = this.world;
    this.x = w.start.x; this.y = w.start.y; this.heading = w.start.heading; // heading: 0=위쪽(북), 시계방향 +
    this.mode = 1;                       // 1 걷기, 2 다리, 3 모터, 4 자세
    this.walkH = [69, 69, 69, 69];       // 걷기 높이(내부값 20~90)
    this.legHF = [[69, 0], [69, 0], [69, 0], [69, 0]];
    this.motorA = [[0, 0], [0, 0], [0, 0], [0, 0]];
    this.posture = 0; this.postureT = 0;
    this.vel = 0;                        // -100~100
    this.rotTarget = null; this.rotVel = 0;
    this.controlYaw = 0;                 // 누적 방향(회전 목표 계산용)
    this.phase = 0;
    this.bodyLed = [0, 0, 0];
    this.headMode = 0;                   // 0 꺼짐, 1 그림, 2 표정, 3 문자
    this.headL = blank8(); this.headR = blank8(); this.expr = 0; this.exprT = 0;
    this.bubble = null; this.bubbleT = 0;
    this.fallen = false; this.bumped = false;
    this.trail = [{ x: this.x, y: this.y }];
    const stand = lengthToAngles(69, 0);
    this.joint = [0, 1, 2, 3].map(() => stand.slice());   // 지금 관절 각도 [어깨, 무릎](도)
    this.raised = [false, false, false, false];
    this.legs = this.joint.map(([s, e]) => legFromAngles(s, e));
  }
  setMode(m) {
    // 확장의 checkModeChange와 같이, 모드가 바뀌면 이동·회전 값이 초기화됨
    if (this.mode !== m) {
      this.mode = m;
      this.vel = 0; this.rotTarget = null;
      if (m === 1) this.walkH = [69, 69, 69, 69];
      if (m === 2) this.legHF = [[69, 0], [69, 0], [69, 0], [69, 0]];
      if (m === 3) this.motorA = [[0, 0], [0, 0], [0, 0], [0, 0]];
    }
  }
  headFrame() {
    if (this.headMode === 2) return EXPRESSIONS[this.expr] ? EXPRESSIONS[this.expr].f(this.exprT) : [blank8(), blank8()];
    if (this.headMode === 0) return [blank8(), blank8()];
    return [this.headL, this.headR];
  }
  rotDelta() {
    if (this.rotTarget === null) return 0;
    return this.rotTarget - this.controlYaw;
  }
  isWalking() {
    return this.mode === 1 && (this.vel !== 0 || (this.rotTarget !== null && Math.abs(this.rotDelta()) > 1));
  }
  // 모드별 목표 관절 각도 (다리 0 왼앞, 1 왼뒤, 2 오른뒤, 3 오른앞)
  targets(dt) {
    this.raised = [false, false, false, false];
    if (this.mode === 3) return this.motorA.map(([s, k]) => [s, k]);
    if (this.mode === 2) return this.legHF.map(([h, f]) => lengthToAngles(h, f));
    if (this.mode === 4) return [0, 1, 2, 3].map(i => this.postureTarget(i));
    // 걷기 모드
    if (this.isWalking()) {
      const spd = Math.max(Math.abs(this.vel), this.rotTarget !== null ? this.rotVel : 0) / 100;
      this.phase += dt * (4 + 6 * spd);
      const dir = this.vel > 0 ? 1 : this.vel < 0 ? -1 : 0;
      return [0, 1, 2, 3].map(i => {
        const off = (i === 0 || i === 2) ? 0 : Math.PI;      // 대각선 두 다리씩(트롯)
        const p = this.phase + off;
        // 제자리 회전은 좌우 다리가 반대로 움직임
        const turn = this.rotTarget !== null && dir === 0 ? (i < 2 ? 1 : -1) * Math.sign(this.rotDelta() || 1) : 0;
        const reach = -32 * Math.sin(p) * (dir || turn);      // 발끝(음수 = 앞)
        const lift = Math.max(0, Math.cos(p)) * 22;           // 앞으로 내딛는 동안 발을 듦
        return lengthToAngles(this.walkH[i] - lift, reach);
      });
    }
    return this.walkH.map(h => lengthToAngles(h, 0));
  }
  postureTarget(i) {
    const front = (i === 0 || i === 3);
    const P = this.posture, t = this.postureT;
    const L = (h, r) => lengthToAngles(h, r);
    if (P === 1) return front ? L(90, 0) : L(20, 0);                // 앉기 (근사)
    if (P === 2) {                                                  // 물구나무 (영상 장면 근사): 앞다리 접고 뒷다리는 위로 뻗음
      if (!front) { this.raised[i] = t > 0.4; return [-40, -80]; }
      return L(20, -30);
    }
    if (P === 3) return front ? L(30, -70) : L(90, 10);             // 기지개 (근사)
    if (P === 4) {                                                  // 인사 (근사): 앉은 채 오른 앞다리를 들어 흔들기
      if (i === 3 && t > 0.7) { this.raised[3] = true; return [90, -35 + Math.sin((t - 0.7) * 7) * 30]; }
      return front ? L(90, 0) : L(20, 0);
    }
    return L(69, 0);                                                // 준비
  }
  step(dt) {
    if (this.fallen) return;
    this.postureT += dt; this.exprT += dt;
    if (this.bubble) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; }
    // 회전
    if (this.mode === 1 && this.rotTarget !== null) {
      const d = this.rotDelta();
      const rate = EST.turnDegPerSecAt100 * this.rotVel / 100 * dt;
      const stepDeg = Math.sign(d) * Math.min(Math.abs(d), rate);
      this.controlYaw += stepDeg; this.heading += stepDeg;
    }
    // 이동
    this.bumped = false;
    if (this.mode === 1 && this.vel !== 0) {
      const v = EST.walkCmPerSecAt100 * this.vel / 100;
      const rad = this.heading * Math.PI / 180;
      const nx = this.x + Math.sin(rad) * v * dt, ny = this.y - Math.cos(rad) * v * dt;
      if (this.world.collides(nx, ny, EST.radius)) this.bumped = true;
      else { this.x = nx; this.y = ny; }
      const last = this.trail[this.trail.length - 1];
      if (Math.hypot(last.x - this.x, last.y - this.y) > 1) { this.trail.push({ x: this.x, y: this.y }); if (this.trail.length > 2000) this.trail.shift(); }
      if (this.world.offTable(this.x, this.y)) { this.fallen = true; this.vel = 0; }
    }
    // 관절: MG90 서보처럼 정해진 빠르기로 목표 각도를 따라감
    const tg = this.targets(dt), maxStep = EST.servoDegPerSec * dt;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
      const d = tg[i][k] - this.joint[i][k];
      this.joint[i][k] += Math.sign(d) * Math.min(Math.abs(d), maxStep);
    }
    this.legs = this.joint.map(([s, e], i) => Object.assign(legFromAngles(s, e), { raised: this.raised[i] }));
  }
  // 몸 높이·앞뒤 기울기(라디안). 들어 올린 다리는 몸을 받치지 않음
  // 반환: center = 몸 중심 높이(cm), pitch = 앞이 들리면 +, height = 엉덩이 높이(호환용)
  bodyPose() {
    const L = this.legs;
    const sup = [0, 1, 2, 3].filter(i => !L[i].raised);
    const avg = (ids) => ids.length ? ids.reduce((a, i) => a + L[i].h, 0) / ids.length : null;
    const fr = avg(sup.filter(i => i === 0 || i === 3)), r = avg(sup.filter(i => i === 1 || i === 2));
    let pitch = (fr !== null && r !== null) ? Math.atan2(fr - r, GEOM.hipGap) : 0;
    // 물구나무(영상 장면): 머리를 바닥에 대고 몸을 거의 세움, 뒷다리는 위로
    if (this.mode === 4 && this.posture === 2) pitch = pitch + (-70 * Math.PI / 180 - pitch) * Math.min(1, this.postureT / 1.2);
    const s = Math.sin(pitch), c = Math.cos(pitch);
    const rel = (dx, dy) => dx * s + dy * c;            // 몸 중심 기준 점(dx 앞, dy 위)의 높이
    const pts = [];
    sup.forEach(i => {                                    // 바닥을 딛는 발
      const front = i === 0 || i === 3;
      pts.push(rel((front ? 1 : -1) * GEOM.hipGap / 2 + L[i].fx, -0.7 - L[i].h) - 0.55);
    });
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => {   // 몸통 모서리, 머리 모서리
      pts.push(rel(a * GEOM.bodyLen / 2, b * GEOM.bodyH / 2));
      pts.push(rel(HEAD.fwd + a * GEOM.headDepth / 2, HEAD.up + b * GEOM.headH / 2));
    });
    const center = -Math.min(...pts);                    // 가장 낮은 점이 바닥에 닿도록
    return { center, pitch, height: center - 0.7 };
  }
  tof() {
    return this.world.raycast(this.x, this.y, this.heading, EST.noseOffset, EST.tofMax);
  }
}

// ------------------------------------------------------------
// 환경: 책상/바닥, 장애물
// ------------------------------------------------------------
export class World {
  constructor() {
    this.table = { w: 120, h: 80 };   // cm
    this.useTable = true;
    this.extra = [];                   // 군무용 추가 로봇들
    this.obstacles = [];               // {x,y,w,h}
    this.start = { x: 60, y: 55, heading: 0 };
  }
  offTable(x, y) { return this.useTable && (x < 0 || y < 0 || x > this.table.w || y > this.table.h); }
  collides(x, y, r) {
    if (!this.useTable && (x < r || y < r || x > this.table.w - r || y > this.table.h - r)) return true; // 바닥 모드: 벽
    return this.obstacles.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
  }
  raycast(x, y, heading, startOff, max) {
    const rad = heading * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
    for (let d = 0; d <= max; d += 0.5) {
      const px = x + dx * (startOff + d), py = y + dy * (startOff + d);
      if (!this.useTable && (px < 0 || py < 0 || px > this.table.w || py > this.table.h)) return Math.round(d);
      if (this.obstacles.some(o => px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h)) return Math.round(d);
    }
    return max;
  }
}

// ------------------------------------------------------------
// 코드 변환: TypeScript 타입 제거 + 협동 스케줄링(await) 삽입
// ------------------------------------------------------------
const ASYNC_NS = new Set(['basic', 'input', 'radio', 'loops', 'control', 'serial', 'robodog', 'pins', 'music', 'led', 'game']);
export function compile(src) {
  const wrapped = `async function __main() {\n${src}\n}`;
  const plugin = ({ types: t }) => {
    const isApiCallback = (path) => {
      const p = path.parentPath;
      if (!p || !p.isCallExpression()) return false;
      const c = p.node.callee;
      return c.type === 'MemberExpression' && c.object.type === 'Identifier' && ASYNC_NS.has(c.object.name);
    };
    const inAsync = (path) => { const f = path.getFunctionParent(); return !!(f && f.node.async); };
    const yieldStmt = () => t.expressionStatement(t.awaitExpression(t.callExpression(t.identifier('__yield'), [])));
    return {
      visitor: {
        FunctionDeclaration(path) { path.node.async = true; },
        'FunctionExpression|ArrowFunctionExpression'(path) { if (isApiCallback(path)) path.node.async = true; },
        CallExpression: {
          exit(path) {
            if (path.parentPath.isAwaitExpression() || !inAsync(path)) return;
            path.replaceWith(t.awaitExpression(path.node));
            path.skip();
          }
        },
        'WhileStatement|ForStatement|DoWhileStatement|ForOfStatement|ForInStatement'(path) {
          if (!inAsync(path)) return;
          const body = path.get('body');
          if (body.isBlockStatement()) body.unshiftContainer('body', yieldStmt());
          else body.replaceWith(t.blockStatement([yieldStmt(), body.node]));
        },
      }
    };
  };
  const out = window.Babel.transform(wrapped, {
    filename: 'main.ts',
    presets: [['typescript', { allExtensions: true }]],
    plugins: [plugin],
    sourceType: 'script',
  });
  return out.code + '\nreturn __main;';
}

// ------------------------------------------------------------
// 로보독 블록 동작 (확장 kocoafab/robodog 2.0.1을 따름). 어느 로봇에든 적용 가능 → 여러 대 군무에도 사용
// h: { warnOnce, sleep, soundOn, button, battery, tilt }
// ------------------------------------------------------------
export function makeRobodogApi(R, h) {
  return {
      gesture: (p) => { R.setMode(4); R.posture = clamp(p, 0, 4); R.postureT = 0; },
      legBend: (legs, height) => {
        R.setMode(1);
        const v = mapRange(height, 0, 100, 20, 90);
        const sets = { 0: [0, 1, 2, 3], 1: [0, 3], 2: [1, 2], 3: [0, 1], 4: [2, 3] }[legs] || [];
        sets.forEach(i => { R.walkH[i] = v; });
      },
      leg: (leg, height, fb) => {
        R.setMode(2);
        const h = mapRange(height, 0, 100, 20, 90), f = mapRange(fb, -100, 100, -90, 90);
        (LEG_SEL[leg] || []).forEach((on, i) => { if (on) R.legHF[i] = [h, f]; });
      },
      motor: (leg, deg1, deg2) => {
        R.setMode(3);
        (LEG_SEL[leg] || []).forEach((on, i) => { if (on) R.motorA[i] = [clamp(deg1, -90, 90), clamp(deg2, -90, 70)]; });
      },
      move: (dir, velocity) => {
        R.setMode(1);
        const v = clamp(velocity, -100, 100);
        R.vel = dir === 0 ? v : -v;
        if (Math.abs(v) > 30) h.warnOnce('fast', '책상 위에서는 속도 30 이하를 권장해요');
      },
      rotation: (dir, deg, velocity) => {
        R.setMode(1);
        const a = clamp(Math.abs(Math.round(deg)), 0, 360);
        R.rotTarget = R.controlYaw + (dir === 0 ? a : -a);
        R.rotVel = clamp(velocity, 10, 100);
      },
      stop: () => { R.setMode(1); R.vel = 0; },
      rotationAbsolute: async (angle = 0, velocity = 100) => {
        R.setMode(1);
        const norm = (v) => ((Math.round(v) % 360) + 360) % 360;
        let d = norm(norm(angle) - norm(R.controlYaw)); if (d > 180) d -= 360;
        R.rotTarget = R.controlYaw + d; R.rotVel = clamp(velocity, 10, 100);
        const t0 = performance.now();
        while (performance.now() - t0 < 3000 && Math.abs(R.rotDelta()) > 5) await h.sleep(20);
        R.rotTarget = null;
      },
      headLedExp: (exp) => { R.headMode = 2; R.expr = exp; R.exprT = 0; },
      headLedPrint: (what, ch) => {
        R.headMode = 3; const m = char8(String(ch).charAt(0) || ' ');
        if (what === 0 || what === 2) R.headL = m; if (what === 1 || what === 2) R.headR = m;
        if (/[^\x20-\x7e]/.test(String(ch))) h.warnOnce('korchar', '로보독 눈 LED에는 영문·숫자 한 글자만 표시돼요');
      },
      headLedDraw: (what, data) => {
        R.headMode = 1; const m = parseImage(data, 8, 8);
        if (what === 0 || what === 2) R.headL = m; if (what === 1 || what === 2) R.headR = m;
      },
      headLedImageLiteral: (s) => s,
      headLedClear: () => { R.headMode = 0; R.headL = blank8(); R.headR = blank8(); },
      bodyLed: (r, g, b) => { R.bodyLed = [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)]; },
      soundPlay: (what, volume) => {
        const s = SOUNDS[what] || ['소리', [440]];
        R.bubble = s[0]; R.bubbleT = 1.5;
        playTones(s[1], volume || 2, h.soundOn());
      },
      getButton: () => h.button(),
      getBattery: () => h.battery(),
      getTof: () => R.tof(),
      getTilt: (what) => h.tilt(what),
      getRotation: () => { let h = ((Math.round(R.heading) % 360) + 360) % 360; if (h > 180) h -= 360; return h; },
      // 무선 확장(kocoafab/robodog-radio)의 AI 카메라 블록: 시뮬레이터에는 카메라가 없어 '인식 없음' 값만 돌려줌
      rfBand: (band) => { h.warnOnce('rfband', `무선 확장: 밴드 ${band} (시뮬레이터에서는 라디오 없이 바로 움직여요)`); },
      aiDetection: () => { h.warnOnce('aicam', '로보독 AI 카메라(얼굴·색·QR)는 시뮬레이터에서 흉내만 내요. 값은 늘 "인식 없음"(0, "none")이에요. 실물에서 확인하세요.'); },
      faceTracking: () => { h.warnOnce('aicam', '로보독 AI 카메라(얼굴·색·QR)는 시뮬레이터에서 흉내만 내요. 값은 늘 "인식 없음"(0, "none")이에요. 실물에서 확인하세요.'); },
      getCameraAlive: () => true,
      getFaceClass: () => 0, getFaceTracking: () => 0, getColorDetect: () => 0,
      getQrCode: () => 'none',
      getAiPosition: () => 0,
  };
}

// ------------------------------------------------------------
// 실행기: 마이크로비트·로보독 API
// ------------------------------------------------------------
class StopSignal extends Error { constructor() { super('stopped'); } }

export class Runner {
  constructor(robot, ui) {
    this.robot = robot; this.ui = ui;   // ui: {log(msg, kind), onDisplay(), sound}
    this.running = false; this.gen = 0;
    this.display = Array.from({ length: 5 }, () => new Array(5).fill(0));
    this.buttons = { A: false, B: false };
    this.handlers = {}; this.radioGroup = 0;
    this.startTime = performance.now();
    this.warned = new Set();
    this.yieldCount = 0;
    this.battery = 100; this.tilt = [0, 0];
  }
  warnOnce(key, msg) { if (!this.warned.has(key)) { this.warned.add(key); this.ui.log(msg, 'warn'); } }
  check() { if (!this.running) throw new StopSignal(); }
  sleep(ms) {
    const g = this.gen;
    return new Promise((res, rej) => setTimeout(() => (this.running && g === this.gen ? res() : rej(new StopSignal())), Math.max(0, ms)));
  }
  async yieldNow() {
    this.check();
    if (++this.yieldCount % 100 === 0) await this.sleep(0);
  }
  spawn(fn, ...args) {
    const g = this.gen;
    Promise.resolve().then(() => fn(...args)).catch(e => this.onError(e, g));
  }
  onError(e, g) {
    if (e instanceof StopSignal || g !== this.gen) return;
    this.ui.log('코드 실행 오류: ' + (e && e.message ? e.message : e), 'error');
    console.error(e);
  }
  setDisplay(m) { this.display = m.map(r => r.slice()); this.ui.onDisplay(); }

  stop() {
    this.running = false; this.gen++;
    this.handlers = {};
    this.robot.vel = 0; this.robot.rotTarget = null;
  }

  async start(src) {
    this.stop();
    this.running = true; this.gen++;
    this.warned.clear(); this.handlers = {}; this.radioGroup = 0;
    this.startTime = performance.now();
    this.setDisplay(Array.from({ length: 5 }, () => new Array(5).fill(0)));
    let mainFactory;
    try {
      const code = compile(src);
      const env = this.buildEnv();
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      mainFactory = new Function(...names, code)(...names.map(n => env[n]));
    } catch (e) {
      this.running = false;
      this.ui.log('코드를 읽을 수 없어요: ' + e.message.split('\n')[0], 'error');
      return false;
    }
    // 실제 마이크로비트처럼: '무한 반복'은 등록 즉시 별도 흐름(fiber)으로 시작되어,
    // '시작하면'이 쉬는(pause·글자 표시) 동안에도 함께 실행됨 (pxt-microbit runForever → create_fiber)
    this.spawn(() => mainFactory());
    return true;
  }

  // ---- 외부 입력 ----
  press(btn) {
    if (!this.running) return;
    const list = this.handlers['btn' + btn] || [];
    list.forEach(h => this.spawn(h));
  }
  setButton(btn, down) { this.buttons[btn] = down; }
  radioReceive(n) {
    if (!this.running) return;
    (this.handlers.radioNum || []).forEach(h => this.spawn(h, n));
  }
  robotButton() { this.robotBtnUntil = performance.now() + 300; }

  // ---- 환경(전역 이름들) ----
  buildEnv() {
    const R = this.robot, self = this;
    const warnProxy = (nsName, impl) => new Proxy(impl, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'symbol') return undefined;
        return (...a) => { self.warnOnce(nsName + '.' + String(prop), `시뮬레이터에서 지원하지 않는 블록: ${nsName}.${String(prop)} (무시됨)`); return 0; };
      }
    });
    const enumProxy = (name, values) => new Proxy(values || {}, {
      get(t, p) { if (p in t) return t[p]; if (typeof p === 'symbol') return undefined; return String(p); }
    });

    const forever = (fn) => {
      const loop = async () => { for (;;) { self.check(); await fn(); await self.sleep(20); } };
      self.spawn(loop);
    };
    const showMatrix = async (m, ms) => { self.setDisplay(m); if (ms) await self.sleep(ms); };
    const scroll = async (text, interval = 150) => {
      const cols = [];
      String(text).split('').forEach(ch => {
        const g = glyph(ch);
        let w = 5; while (w > 1 && g.every(r => !r[w - 1])) w--;
        if (ch === ' ') w = 3;
        for (let x = 0; x < w; x++) cols.push(g.map(r => r[x])); cols.push([0, 0, 0, 0, 0]);
      });
      const pad = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
      const all = pad.concat(cols).concat(pad);
      for (let s = 0; s + 5 <= all.length; s++) {
        self.check();
        const frame = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => all[s + x][y]));
        self.setDisplay(frame); await self.sleep(interval);
      }
    };
    const showText = async (txt, interval) => {
      const s = String(txt);
      if (s.length === 1) { await showMatrix(glyph(s), 400); return; }
      await scroll(s, interval || 150);
    };

    const basic = warnProxy('basic', {
      forever,
      pause: (ms) => self.sleep(ms),
      showNumber: (n, i) => showText(String(Math.round(n * 100) / 100), i),
      showString: (s, i) => showText(s, i),
      showIcon: (name, ms) => showMatrix(F(ICONS[name] || ICONS.Confused), ms === undefined ? 600 : ms).then(() => { if (!ICONS[name]) self.warnOnce('icon' + name, `아이콘 ${name}는 시뮬레이터에 모양이 없어 대신 표시해요`); }),
      showLeds: (str, ms) => showMatrix(parseImage(str, 5, 5), ms === undefined ? 400 : ms),
      clearScreen: () => showMatrix(Array.from({ length: 5 }, () => new Array(5).fill(0))),
      showArrow: (d, ms) => showMatrix(F('00100 01110 10101 00100 00100'), ms === undefined ? 600 : ms),
    });
    const input = warnProxy('input', {
      onButtonPressed: (btn, h) => { (self.handlers['btn' + btn] = self.handlers['btn' + btn] || []).push(h); },
      buttonIsPressed: (btn) => btn === 'AB' || btn === 3 ? self.buttons.A && self.buttons.B : !!self.buttons[btn === 1 ? 'A' : btn === 2 ? 'B' : btn],
      runningTime: () => Math.round(performance.now() - self.startTime),
      runningTimeMicros: () => Math.round((performance.now() - self.startTime) * 1000),
      compassHeading: () => ((Math.round(R.heading) % 360) + 360) % 360,
      temperature: () => 22, lightLevel: () => 128, acceleration: () => 0, soundLevel: () => 0,
      onGesture: () => self.warnOnce('gesture', '움직임(흔들기 등) 블록은 시뮬레이터에서 동작하지 않아요'),
    });
    const radio = warnProxy('radio', {
      setGroup: (g) => { self.radioGroup = g; self.ui.onRadioGroup && self.ui.onRadioGroup(g); },
      setTransmitPower: () => {},
      sendNumber: (n) => self.ui.log(`라디오 보냄: ${n}`),
      sendString: (s) => self.ui.log(`라디오 보냄: "${s}"`),
      sendValue: (k, v) => self.ui.log(`라디오 보냄: ${k}=${v}`),
      onReceivedNumber: (h) => { (self.handlers.radioNum = self.handlers.radioNum || []).push(h); },
      onReceivedString: (h) => { (self.handlers.radioStr = self.handlers.radioStr || []).push(h); },
      onReceivedValue: (h) => { (self.handlers.radioVal = self.handlers.radioVal || []).push(h); },
    });
    const led = warnProxy('led', {
      plot: (x, y) => { const m = self.display.map(r => r.slice()); if (m[y] && x >= 0 && x < 5) m[y][x] = 1; self.setDisplay(m); },
      unplot: (x, y) => { const m = self.display.map(r => r.slice()); if (m[y] && x >= 0 && x < 5) m[y][x] = 0; self.setDisplay(m); },
      toggle: (x, y) => { const m = self.display.map(r => r.slice()); if (m[y] && x >= 0 && x < 5) m[y][x] ^= 1; self.setDisplay(m); },
      point: (x, y) => !!(self.display[y] && self.display[y][x]),
      plotBrightness: (x, y) => led.plot(x, y),
      setBrightness: () => {},
    });
    const loops = warnProxy('loops', {
      everyInterval: (ms, fn) => { const loop = async () => { for (;;) { await self.sleep(ms); await fn(); } }; self.spawn(loop); },
    });
    const control = warnProxy('control', {
      inBackground: (fn) => self.spawn(fn),
      waitMicros: (us) => self.sleep(us / 1000),
      reset: () => self.ui.log('control.reset: 다시 시작하려면 [실행]을 누르세요', 'warn'),
      millis: () => Math.round(performance.now() - self.startTime),
    });
    const serial = warnProxy('serial', {
      writeLine: (s) => self.ui.log('시리얼: ' + s), writeString: (s) => self.ui.log('시리얼: ' + s),
      writeNumber: (n) => self.ui.log('시리얼: ' + n), writeValue: (k, v) => self.ui.log(`시리얼: ${k}=${v}`),
      setBaudRate: () => {}, redirect: () => {}, redirectToUSB: () => {}, setRxBufferSize: () => {},
      onDataReceived: () => self.warnOnce('serialrx', 'USB 시리얼 받기는 시뮬레이터에서 동작하지 않아요(라디오 패널을 쓰세요)'),
      readUntil: () => '', readString: () => '', readLine: () => '', delimiters: () => '\n',
    });
    const music = warnProxy('music', {});
    const musicWarn = new Proxy({}, { get(t, p) { if (typeof p === 'symbol') return undefined; return (...a) => { self.warnOnce('music', '⚠ 로보독 마이크로비트에서 \'음악\' 블록은 로봇 통신 핀(P0)과 겹칠 수 있어요. 소리는 로보독 효과음 블록을 쓰세요.'); return 0; }; } });

    // ---- 로보독 블록 (확장 kocoafab/robodog 2.0.1 동작을 따름) ----
    const robodog = warnProxy('robodog', makeRobodogApi(R, {
      warnOnce: (k, m) => self.warnOnce(k, m),
      sleep: (ms) => self.sleep(ms),
      soundOn: () => !!(self.ui.soundOn && self.ui.soundOn()),
      button: () => !!(self.robotBtnUntil && performance.now() < self.robotBtnUntil),
      battery: () => self.battery,
      tilt: (what) => (what === 0 ? self.tilt[0] : self.tilt[1]),
    }));

    const deflib = {
      Posture: { Ready: 0, SitDown: 1, Handstand: 2, Stretch: 3, SayHello: 4 },
      LegGroup: { AllLegs: 0, FrontLegs: 1, BackLegs: 2, LeftLegs: 3, RightLegs: 4 },
      LegSelection: { LeftFront: 0, LeftBack: 1, RightFront: 3, RightBack: 2, FrontLegs: 4, BackLegs: 5, LeftLegs: 6, RightLegs: 7, AllLegs: 8 },
      RotateDirection: { Clockwise: 0, Counterclockwise: 1 },
      MoveDirection: { Forward: 0, Backward: 1 },
      HeadLedSide: { Left: 0, Right: 1, Both: 2 },
      TiltAxis: { LeftRight: 0, ForwardBackward: 1 },
      LedExpression: { SparklingEyes: 0, ILoveYou: 1, EyesClosed: 2, Thanks: 3, ThankYou: 4, Sparrow: 5, RollingEyes: 6, SharpEyes: 7, BlinkingSharpEyes: 8, Insect: 9, Blink: 10, SnakeEyes: 11, Pinwheel: 12, BigEyes: 13 },
      SoundEffect: { Bark: 1, Growl: 2, Angry: 3, Whine: 4, HeavyBreath: 5, Hello: 11, Wait: 12, MoveAside: 13, Start: 14, Laser: 21, MotorRotation: 22, DingDing: 23, AlienSignal: 24, Motion: 25, Collision: 26, Do: 31, Re: 32, Mi: 33, Fa: 34, Sol: 35, La: 36, Si: 37, SharpDo: 38 },
      SoundVolume: { Loud: 3, Medium: 2, Quiet: 1 },
      AiPositionAxis: { X: 0, Y: 1 },
      AiMode: { Camera: 0, FaceDetect: 1, FaceTracking: 2, ColorDetect: 3, QrCode: 4 },
      AiClass: { Class1: 1, Class2: 2, Class3: 3, Class4: 4, Class5: 5 },
      constrain: clamp,
    };
    const images = warnProxy('images', { createImage: (s) => s });
    return {
      basic, input, radio, led, loops, control, serial, music: musicWarn, robodog, deflib, images,
      pins: warnProxy('pins', {}), game: warnProxy('game', {}),
      Button: { A: 'A', B: 'B', AB: 'AB' },
      IconNames: enumProxy('IconNames', Object.fromEntries(Object.keys(ICONS).map(k => [k, k]))),
      BaudRate: enumProxy('BaudRate'), Delimiters: enumProxy('Delimiters'), SerialPin: enumProxy('SerialPin'),
      ArrowNames: enumProxy('ArrowNames'), Gesture: enumProxy('Gesture'), Melodies: enumProxy('Melodies'),
      MelodyOptions: enumProxy('MelodyOptions'), BeatFraction: enumProxy('BeatFraction'), Note: enumProxy('Note'),
      randint: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
      __yield: () => self.yieldNow(),
      console: { log: (...a) => self.ui.log(a.join(' ')) },
    };
  }
}
