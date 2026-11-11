// 포니봇 3D 모형 (three.js) — 사진(kits/ponybot/photos/)을 보고 만든 어림 모형. 단위 cm.
// 좌표: 몸 (u 오른쪽, v 앞) → three (x = u, z = -v). 앞(heading 0) = -z. 원점 = 바퀴 4개의 한가운데(바닥 y=0).
// 크기는 pony.js 의 EST (추정 — 실측하면 바꾸기). 장면·카메라·소품은 공용 view3d.js 를 그대로 씀.
import * as THREE from 'three';
import { View3D } from '../../view3d.js';
import { EST, WHEEL_XY, WHEELS } from './pony.js';
import { drawOled } from './view.js';

const T = THREE;
const std = (color, o = {}) => new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
const RAD = Math.PI / 180;
const WHEEL_R = EST.wheelLen / 2;

// 몸 위 부품 위치(사진 top.jpg 에서 어림). 바퀴 한가운데 기준 앞 +v, 오른쪽 +u
const BODY = {
  pcbY: 2.0, pcbT: 0.16,           // 기판 높이·두께
  coverY: EST.chassisH - 0.25,     // 검은 덮개 윗면 높이(= 차체 높이 ≈ 4)
};

function polyShape(pts) {   // [[u,v],...] → Shape (extrude 후 x 축 -90° 돌리면 (u, 높이, -v))
  const s = new T.Shape(); pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v))); s.closePath(); return s;
}
function mirrorPoly(right) {   // 오른쪽 절반(위→앞 순서) → 좌우 대칭 다각형
  return [...right, ...right.slice().reverse().map(([u, v]) => [-u, v])];
}
function roundRectShape(w, l, r) {
  const s = new T.Shape(), x = -w / 2, y = -l / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + l - r);
  s.quadraticCurveTo(x + w, y + l, x + w - r, y + l); s.lineTo(x + r, y + l); s.quadraticCurveTo(x, y + l, x, y + l - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
// (u,v) 평면 모양을 높이 h 로 세워 y0 에 놓음
function slab(shape, h, y0, material, bevel = 0) {
  const g = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  const m = new T.Mesh(g, material); m.position.y = y0; m.castShadow = true; m.receiveShadow = true; return m;
}
function box(w, h, d, material, x, y, z) {   // x=u, z=-v 로 바로 넣는 상자
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = true; return m;
}
function canvasTex(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// ---- 메카넘 바퀴 한 개 (축 = x, 바깥쪽 = out(±1)). s = 롤러 기울기 방향(사진: FL·RR 같은 방향, FR·RL 같은 방향) ----
function makeWheel(out, s, mats) {
  const g = new T.Group(), R = WHEEL_R, W = EST.wheelWid;
  const rim = new T.Mesh(new T.CylinderGeometry(R * 0.78, R * 0.78, W * 0.86, 9), mats.gun);   // 9각 톱니 같은 회색 테
  rim.rotation.z = Math.PI / 2; g.add(rim);
  const boss = new T.Mesh(new T.CylinderGeometry(R * 0.3, R * 0.3, W * 0.95, 14), mats.dark); boss.rotation.z = Math.PI / 2; g.add(boss);
  const cap = new T.Mesh(new T.CylinderGeometry(R * 0.66, R * 0.66, 0.1, 24), mats.cap);      // 투명 무늬 덮개
  cap.rotation.z = Math.PI / 2; cap.position.x = out * (W * 0.43 + 0.05); g.add(cap);
  const hub = new T.Mesh(new T.CylinderGeometry(R * 0.2, R * 0.2, 0.2, 10), mats.gun2); hub.rotation.z = Math.PI / 2; hub.position.x = out * (W * 0.43 + 0.12); g.add(hub);
  // 롤러 9개(검정 고무) + 흰 간격 링 — 인스턴스 한 덩어리
  const N = 9, rr = 0.74, rc = R - rr, len = 2.2;
  const rollers = new T.InstancedMesh(new T.CylinderGeometry(rr, rr * 0.9, len, 10), mats.rubber, N);
  const rings = new T.InstancedMesh(new T.CylinderGeometry(rr * 1.02, rr * 1.02, 0.14, 10), mats.white, N * 2);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), one = new T.Vector3(1, 1, 1), Y = new T.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const th = i / N * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
    p.set(0, rc * c, rc * sn);
    const A = new T.Vector3(-s * Math.SQRT1_2, Math.SQRT1_2 * sn, -Math.SQRT1_2 * c).normalize();   // 45° 롤러 축
    q.setFromUnitVectors(Y, A);
    m4.compose(p, q, one); rollers.setMatrixAt(i, m4);
    for (const k of [-1, 1]) { const pp = p.clone().addScaledVector(A, k * len * 0.5); m4.compose(pp, q, one); rings.setMatrixAt(i * 2 + (k > 0 ? 1 : 0), m4); }
  }
  rollers.castShadow = true; g.add(rollers); g.add(rings);
  return g;
}

export function buildPonyModel() {
  const P = { wheels: {}, leds: {} };
  const root = P.root = new T.Group();
  const mats = {
    black: std(0x16181b, { roughness: 0.55 }), dark: std(0x0d0e10, { roughness: 0.7 }), cover: std(0x1d2024, { roughness: 0.75 }),
    pcb: std(0x15181c, { roughness: 0.5, metalness: 0.15 }), gold: std(0xc9a64a, { metalness: 0.8, roughness: 0.35 }), silver: std(0xcfd5da, { metalness: 0.8, roughness: 0.3 }),
    gun: std(0x5b5a55, { metalness: 0.6, roughness: 0.4 }), gun2: std(0x3d3d3a, { metalness: 0.5, roughness: 0.5 }),
    rubber: std(0x1f2325, { roughness: 0.9 }), white: std(0xf2f2f2, { roughness: 0.5 }),
    cap: new T.MeshStandardMaterial({ color: 0x9fb8b4, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.7,
      map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c8dcd8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5d7570'; g.lineWidth = 2; for (let i = -h; i < w + h; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }) }),
    purple: std(0x8e86b4, { roughness: 0.3 }),
  };
  const Y0 = BODY.pcbY, YC = BODY.coverY;
  // 기판: 앞쪽이 넓고 구멍·귀퉁이 있는 검은 판
  const pcb = polyShape(mirrorPoly([[4.4, -8.5], [4.6, -4], [5.4, -2], [5.4, 8.4], [5.0, 8.9]]));
  [-1.0, -0.3, 0.4, 1.1].forEach(v => { const h = new T.Path(); h.absarc(-4.2, v, 0.3, 0, Math.PI * 2, true); pcb.holes.push(h); });   // 둥근 구멍 4개(몸 왼쪽)
  [[-4.7, 8.4], [4.7, 8.4], [-4.9, -2.4], [4.9, -2.4]].forEach(([u, v]) => { const h = new T.Path(); h.absarc(u, v, 0.22, 0, Math.PI * 2, true); pcb.holes.push(h); });   // 귀퉁이 나사 구멍
  root.add(slab(pcb, BODY.pcbT, Y0, mats.pcb));
  // 받침 기둥(덮개를 받침)
  [[-3.6, -7.3], [3.6, -7.3], [-4.3, 6.5], [4.3, 6.5], [0, -0.8]].forEach(([u, v]) => { const c = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, YC - Y0, 8), mats.silver); c.position.set(u, (YC + Y0) / 2, -v); root.add(c); });
  // 검은 덮개: 뒤가 넓고 가운데가 잘록한 X 모양 + X 능선
  const cover = slab(polyShape(mirrorPoly([[4.3, -8.5], [3.6, -6], [2.8, -4], [1.95, -2.5], [1.95, -0.8], [3.5, 2], [4.6, 4], [4.7, 8.8]])), 0.25, YC - 0.25, mats.cover, 0.03);
  root.add(cover);
  const rd = (u0, v0, u1, v1) => {   // 두 점을 잇는 가는 능선
    const len = Math.hypot(u1 - u0, v1 - v0), m = new T.Mesh(new T.BoxGeometry(0.3, 0.14, len), mats.black);
    m.position.set((u0 + u1) / 2, YC + 0.07, -(v0 + v1) / 2); m.rotation.y = Math.atan2(u1 - u0, -(v1 - v0)); root.add(m);
  };
  rd(-4.2, -8.3, 4.5, 8.4); rd(4.2, -8.3, -4.5, 8.4);   // X 능선
  // 새겨진 X 로고
  const logo = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), new T.MeshBasicMaterial({ transparent: true, depthWrite: false,
    map: canvasTex(128, 128, (g, w, h) => { g.strokeStyle = '#6d747d'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(26, 26); g.lineTo(102, 102); g.moveTo(102, 26); g.lineTo(26, 102); g.stroke(); g.strokeStyle = '#1d2024'; g.lineWidth = 3; g.beginPath(); g.moveTo(26, 26); g.lineTo(102, 102); g.moveTo(102, 26); g.lineTo(26, 102); g.stroke(); }) }));
  logo.rotation.x = -Math.PI / 2; logo.position.set(0, YC + 0.02, 4.3); root.add(logo);
  // 마이크로비트 슬롯(가로로 긴 틈) + 슬롯 테두리
  root.add(box(5.2, 0.3, 0.7, mats.dark, 0, YC + 0.1, 4.9));
  root.add(box(4.6, 0.12, 0.3, std(0x6b6b60, { metalness: 0.5 }), 0, YC + 0.27, 4.9));   // 금색 단자 느낌
  // OLED (보라빛 회색 작은 화면) — 캔버스 그림을 매 프레임 필요할 때만 갱신
  P.oledCanvas = document.createElement('canvas'); P.oledCanvas.width = 128; P.oledCanvas.height = 64;
  P.oledTex = new T.CanvasTexture(P.oledCanvas); P.oledTex.colorSpace = T.SRGBColorSpace; P.oledTex.magFilter = T.NearestFilter; P.oledTex.minFilter = T.LinearFilter;
  root.add(box(2.7, 0.18, 1.5, std(0x22252b), 0, YC + 0.1, 7.0));
  const scr = new T.Mesh(new T.PlaneGeometry(2.3, 1.15), new T.MeshBasicMaterial({ map: P.oledTex }));
  scr.rotation.x = -Math.PI / 2; scr.position.set(0, YC + 0.21, 7.0); root.add(scr); P.oledScreen = scr;
  // 배터리 상자(앞쪽 가운데, 둥근 검은 상자) + 뚜껑 줄
  const [bw, bl, bh] = EST.batteryBox;
  const bat = slab(roundRectShape(bw, bl, 0.9), bh - 0.4, YC - 0.5, mats.black, 0.2); bat.position.z = -(0.3 + bl / 2); root.add(bat);
  const seam = box(bw + 0.05, 0.08, 0.1, mats.dark, 0, YC + bh - 0.75, -(0.3 + bl * 0.62)); root.add(seam);
  root.add(box(bw * 0.55, 0.7, 0.5, mats.black, 0, YC + 0.1, -(0.3 + bl + 0.1)));   // 앞쪽 걸쇠
  // 둥근 거치대(3D 프린트 소켓): 네모 블록에 둥근 구멍 + 나사
  const hs = polyShape([[-1.35, -1.0], [1.35, -1.0], [1.35, 1.0], [-1.35, 1.0]]); const hh = new T.Path(); hh.absarc(0, 0, 0.8, 0, Math.PI * 2, true); hs.holes.push(hh);
  const holder = slab(hs, 2.3, YC, std(0x111214, { roughness: 0.9 })); holder.position.z = 0.9; root.add(holder);
  const screw = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.3, 8), mats.silver); screw.position.set(0, YC + 2.0, 1.95); screw.rotation.x = Math.PI / 2; root.add(screw);
  // 앞쪽 초음파 막대: 기판 앞 아래에 검은 막대 + 은색 테두리 둥근 눈 2개
  root.add(box(7.4, 1.7, 1.3, mats.black, 0, 1.2, -8.9));
  for (const u of [-1.75, 1.75]) {
    const tr = new T.Group(); tr.position.set(u, 1.2, -9.55);
    const body = new T.Mesh(new T.CylinderGeometry(0.82, 0.82, 0.5, 20), mats.dark); body.rotation.x = Math.PI / 2; tr.add(body);
    const rim = new T.Mesh(new T.TorusGeometry(0.8, 0.1, 8, 24), mats.silver); rim.position.z = -0.27; tr.add(rim);
    const mesh = new T.Mesh(new T.CircleGeometry(0.7, 20), std(0x24322f, { roughness: 0.4 })); mesh.rotation.y = Math.PI; mesh.position.z = -0.26; tr.add(mesh);
    root.add(tr);
  }
  // 앞 모서리 네오픽셀 L1(오른쪽 앞)·L4(왼쪽 앞) — 조명 확장 색은 아직 추적 안 해서 어두운 흰색
  P.ledMat = {};
  for (const [name, u] of [['L1', 3.4], ['L4', -3.4]]) {
    const m = new T.MeshStandardMaterial({ color: 0xcfcfcf, emissive: 0x444444, roughness: 0.5 }); P.ledMat[name] = m;
    root.add(box(0.5, 0.12, 0.5, m, u, Y0 + 0.14, -8.3));
  }
  // 핀 헤더(서보·IO·I2C): 검은 받침 + 금색 핀 줄
  const header = (u, v, cols, rows) => {
    const w = cols * 0.26 + 0.1, l = rows * 0.26 + 0.1;
    root.add(box(w, 0.25, l, mats.dark, u, Y0 + 0.28, -v));
    const pins = new T.InstancedMesh(new T.BoxGeometry(0.09, 0.55, 0.09), mats.gold, cols * rows), m4 = new T.Matrix4();
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { m4.makeTranslation(u + (i - (cols - 1) / 2) * 0.26, Y0 + 0.65, -(v + (j - (rows - 1) / 2) * 0.26)); pins.setMatrixAt(i * rows + j, m4); }
    root.add(pins);
  };
  header(-3.2, -0.4, 3, 8); header(-3.2, 2.2, 3, 7); header(3.55, 1.0, 4, 2); header(3.55, -1.1, 3, 4);
  // 바퀴 4개 + 모터 + 흰 축 + B/F 표시등
  const pos = WHEEL_XY(), spin = { FL: 1, RR: 1, FR: -1, RL: -1 };   // 사진: FL·RR 롤러 같은 방향, FR·RL 같은 방향
  for (const name of WHEELS) {
    const [wx, wy] = pos[name], out = Math.sign(wx);
    const grp = new T.Group(); grp.position.set(wx, WHEEL_R, -wy);
    const wheel = makeWheel(out, spin[name], mats); grp.add(wheel); root.add(grp);
    P.wheels[name] = { spin: wheel, angle: 0 };
    root.add(box(1.5, 2.0, 2.8, mats.dark, out * 4.7, 1.2, -wy));
    const ax = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 1.6, 8), mats.white); ax.rotation.z = Math.PI / 2; ax.position.set(out * (Math.abs(wx) - EST.wheelWid / 2 - 0.4), WHEEL_R, -wy); root.add(ax);
    const led = new T.MeshBasicMaterial({ color: 0x555555 }); P.leds[name] = led;
    const lm = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), led); lm.position.set(out * 5.2, Y0 + 0.4, -(wy + (wy > 0 ? -1.4 : 1.4))); root.add(lm);
  }
  // 센서 표시(2D와 같은 자리): 라인 센서 2개 + 컬러 센서 — 바닥 가까이 작은 점
  const dotGeo = new T.CylinderGeometry(0.9, 0.9, 0.12, 16);
  P.lineDots = [-1, 1].map(i => { const m = new T.Mesh(dotGeo, new T.MeshBasicMaterial({ color: 0x555555 })); m.position.set(i * EST.lineHalfGap, 0.25, -EST.lineForward); root.add(m); return m; });
  P.colorDot = new T.Mesh(dotGeo, new T.MeshBasicMaterial({ color: 0xffffff })); P.colorDot.scale.set(1.2, 1, 1.2); P.colorDot.position.set(0, 0.25, -EST.colorForward); root.add(P.colorDot);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return P;
}

// ---- 공용 3D 화면 위에 포니봇을 올리는 화면 ----
export class PonyView3D extends View3D {
  constructor(container, world, robot, oled) { super(container, world, robot); this.oled = oled; this.model = null; this.oledVer = -1; this.t0 = performance.now(); this.pinKey = ''; }
  init() {
    super.init();
    this.resetCam();
    this.controls.minDistance = 8; this.controls.maxDistance = 500;
    this.beam.material.color.set(0x2456e5); this.hitDot.material.color.set(0x2456e5);
    this.fan = new T.Mesh(new T.CircleGeometry(1, 20, Math.PI / 2 - 15 * RAD, 30 * RAD), new T.MeshBasicMaterial({ color: 0x2456e5, transparent: true, opacity: 0.14, side: T.DoubleSide, depthWrite: false }));
    this.fan.rotation.x = -Math.PI / 2; this.fan.position.y = 0.3; this.scene.add(this.fan);
    this.pinGroup = new T.Group(); this.scene.add(this.pinGroup);
    this.model = buildPonyModel(); this.scene.add(this.model.root);
  }
  resetCam() { const s = this.world.start; this.camera.position.set(s.x + 22, 15, s.y - 25); this.controls.target.set(s.x, 2.5, s.y); this.controls.update(); }
  // 바닥: 장면 크기·색·벽·구역·표시선 (책상·다리 없음)
  buildTable() {
    const W = this.world, g = this.tableGroup, w = W.size.w, h = W.size.h;
    const half = Math.max(w, h) * 0.75, sc = this.sun.shadow.camera;
    this.sun.target.position.set(w / 2, 0, h / 2); this.sun.position.set(w / 2 - 20, 120 + half * 0.3, h / 2 + 20);
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 400 + half; sc.updateProjectionMatrix();
    while (g.children.length) g.remove(g.children[0]);
    const [r, gg, b] = W.floor.bg;
    const top = new T.Mesh(new T.BoxGeometry(w, 3, h), new T.MeshStandardMaterial({ color: new T.Color().setRGB(r / 255, gg / 255, b / 255, T.SRGBColorSpace) }));
    top.position.set(w / 2, -1.5, h / 2); top.receiveShadow = true; g.add(top);
    const pts = [];
    for (let x = 0; x <= w; x += 10) pts.push(x, 0.02, 0, x, 0.02, h);
    for (let z = 0; z <= h; z += 10) pts.push(0, 0.02, z, w, 0.02, z);
    const gg2 = new T.BufferGeometry(); gg2.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    g.add(new T.LineSegments(gg2, new T.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })));
    for (const z of W.floor.zones) {   // 거리 구역
      const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(z.color), y1 = Math.min(z.y1, h);
      const p = new T.Mesh(new T.PlaneGeometry(w, y1 - z.y0), new T.MeshBasicMaterial({ color: m ? new T.Color(`rgb(${m[1]},${m[2]},${m[3]})`) : 0xff0000, transparent: true, opacity: Math.min(0.5, (m ? +m[4] : 0.2) * 1.6), depthWrite: false }));
      p.rotation.x = -Math.PI / 2; p.position.set(w / 2, 0.04, (z.y0 + y1) / 2); g.add(p);
    }
    for (const m of W.floor.marks) {   // 출발선
      const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0), p = new T.Mesh(new T.BoxGeometry(len, 0.05, 0.8), new T.MeshBasicMaterial({ color: 0x333333 }));
      p.position.set((m.x0 + m.x1) / 2, 0.06, (m.y0 + m.y1) / 2); p.rotation.y = -Math.atan2(m.y1 - m.y0, m.x1 - m.x0); g.add(p);
    }
    if (W.walls) {
      const wm = new T.MeshStandardMaterial({ color: 0x8892a0 });
      [[w / 2, -1, w + 4, 2], [w / 2, h + 1, w + 4, 2]].forEach(([x, z, ww, d]) => { const m = new T.Mesh(new T.BoxGeometry(ww, 8, d), wm); m.position.set(x, 4, z); g.add(m); });
      [[-1, h / 2], [w + 1, h / 2]].forEach(([x, z]) => { const m = new T.Mesh(new T.BoxGeometry(2, 8, h), wm); m.position.set(x, 4, z); g.add(m); });
    }
    this.tableKey = this.tableSig();
  }
  tableSig() { const W = this.world; return `${W.sceneId}|${W.size.w}x${W.size.h}|${W.floor.bg}|${W.walls}|${JSON.stringify(W.floor.zones)}|${W.floor.marks.length}`; }
  syncPins() {
    const pins = this.world.pins, key = pins.length + ':' + pins.map(p => p.r).join(',');
    if (key !== this.pinKey) {
      this.pinKey = key;
      while (this.pinGroup.children.length) { const c = this.pinGroup.children[0]; this.pinGroup.remove(c); c.geometry.dispose(); c.material.dispose(); }
      pins.forEach(p => { const m = new T.Mesh(new T.CylinderGeometry(p.r * 0.8, p.r, 12, 14), new T.MeshStandardMaterial({ color: 0xffffff })); m.castShadow = true; this.pinGroup.add(m); });
    }
    pins.forEach((p, i) => {
      const m = this.pinGroup.children[i]; if (!m) return;
      if (p.down) { m.rotation.set(0, 0, Math.PI / 2); m.position.set(p.x, p.r, p.y); m.material.color.set(0xaaaaaa); }
      else { m.rotation.set(0, 0, 0); m.position.set(p.x, 6, p.y); m.material.color.set(0xffffff); }
    });
  }
  draw() {
    if (!this.ready) return;
    const R = this.robot, W = this.world, P = this.model, now = performance.now(), dt = Math.min(0.1, (now - this.t0) / 1000); this.t0 = now;
    if (this.tableKey !== this.tableSig()) this.buildTable();
    const key = JSON.stringify(W.props);
    if (key !== this.obsKey) { this.obsKey = key; this.buildProps(); }
    this.syncPins();
    const pts = R.trail.map(([x, y]) => new T.Vector3(x, 0.2, y)); pts.push(new T.Vector3(R.x, 0.2, R.y));
    this.trailLine.geometry.setFromPoints(pts);
    // 몸 위치·방향
    P.root.position.set(R.x, 0, R.y); P.root.rotation.y = -R.heading * RAD;
    // 바퀴: 선속도(cm/s) → 각도. 앞으로(+) 가면 윗면이 앞(-z)으로 → x 축 회전각이 줄어듦
    for (const n of WHEELS) {
      const w = P.wheels[n]; w.angle -= R.w[n] / WHEEL_R * dt; w.spin.rotation.x = w.angle;
      const v = R.w[n], L = P.leds[n]; L.color.set(v > 0.05 ? 0x1fa463 : v < -0.05 ? 0xe5484d : 0x555555);
    }
    // OLED 그림(바뀔 때만)
    if (this.oled && this.oled.version !== this.oledVer) { this.oledVer = this.oled.version; drawOled(P.oledCanvas, this.oled); P.oledTex.needsUpdate = true; }
    // 센서 점
    P.lineDots.forEach((m, i) => m.material.color.set(R.lineRaw(i) ? 0xffd23f : 0x555555));
    const c = R.colorRGB(); P.colorDot.material.color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, T.SRGBColorSpace);
    // 초음파: 부채꼴 + 선 + 맞은 점
    const d = R.sonarTrue(), len = isFinite(d) ? d : 70, [ox, oy] = R.toWorld(0, EST.sonarOffset + 0.2), hr = R.heading * RAD, fx = Math.sin(hr), fz = -Math.cos(hr);
    this.fan.visible = this.beam.visible = true;
    this.fan.position.set(ox, 0.3, oy); this.fan.scale.set(len, len, 1); this.fan.rotation.order = 'YXZ'; this.fan.rotation.set(-Math.PI / 2, -hr, 0);
    const a = new T.Vector3(ox, 1.2, oy), b = new T.Vector3(ox + fx * len, 1.2, oy + fz * len);
    this.beam.geometry.setFromPoints([a, b]); this.beam.computeLineDistances();
    this.hitDot.visible = isFinite(d); this.hitDot.position.copy(b);
    this.tofTag.sp.visible = this.card.sp.visible = this.btnTag.sp.visible = this.bubble.visible = false; this.camFan.visible = false;
    if (this.follow) {
      const t = this.controls.target, dx = R.x - t.x, dz = R.y - t.z;
      t.x += dx * 0.08; t.z += dz * 0.08; this.camera.position.x += dx * 0.08; this.camera.position.z += dz * 0.08;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
