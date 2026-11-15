// 포니봇 인트로 "AI 놀이터의 경기장" — 3D 포니봇(시뮬레이터와 같은 모형) + 모션 그래픽. 약 20초.
// 포니봇만의 특징 두 가지를 보여 준다: ① 메카넘 바퀴(옆으로 주차·대각선) ② 구불구불한 선 따라가기(라인 센서 2개)
// render(t)는 시간 t만으로 화면이 정해짐(상태를 쌓지 않음) → 같은 코드로 mp4를 굽는다(tools/render-ponybot-intro.js).
// 움직임·크기는 시뮬레이터 추정 모형 기준이며 실물과 다를 수 있다. 영상 생성 모델은 쓰지 않았다.
import * as T from 'three';
import { buildPonyModel } from '../../sim/kits/ponybot/model3d.js';
import { EST } from '../../sim/kits/ponybot/pony.js';

export const DUR = 20;
const RAD = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };            // 부드럽게 출발·도착
const seg = (t, a, b) => ease((t - a) / (b - a));                             // a~b 사이 0→1
const lerp = (a, b, k) => a + (b - a) * k;
const WHEEL_R = EST.wheelLen / 2;

// ---- 줄거리(초): 위치는 cm, x 오른쪽 · z 앞(-), 방향 0 = 앞(-z) ----
// 0~3 등장 / 3~6.2 ① 옆으로 주차(메카넘) / 6.4~8 대각선 이동 / 8.2~15.8 ② 구불구불한 선 따라가기 / 16~20 제목
const SLOT = { x: 26, z: -22 };                                   // 주차 칸 한가운데
const LINE_PTS = [[0, -44], [0, -64], [22, -80], [30, -102], [8, -118], [-22, -110], [-34, -132], [-16, -156], [16, -152], [28, -172], [8, -192], [0, -206]];
const LINE = new T.CatmullRomCurve3(LINE_PTS.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
const LINE_LEN = LINE.getLength();
const lineU = (t) => { const k = clamp((t - 8.2) / 7.4); return k < 0.08 ? k * k / 0.16 : k > 0.92 ? 1 - (1 - k) * (1 - k) / 0.16 : k - 0.04 + 0.04 * 0; };   // 살짝 가속·감속, 가운데는 일정한 빠르기
function pose(t) {                                                // 포니봇 위치·방향(도)·따라온 선 길이
  if (t < 8.2) {
    let x = 0, z = 0;
    z -= 22 * seg(t, 3.0, 4.1);                                   // 앞으로
    x += 26 * seg(t, 4.5, 6.0);                                   // 옆으로(몸 방향 그대로) → 주차 칸
    const k = seg(t, 6.5, 7.9); x -= 26 * k; z -= 22 * k;         // 대각선(↖)으로 선의 출발점까지
    return { x, z, h: 0, s: 0 };
  }
  const u = clamp(lineU(t)), pt = LINE.getPointAt(u), tg = LINE.getTangentAt(u);
  return { x: pt.x, z: pt.z, h: Math.atan2(tg.x, -tg.z) / RAD, s: u * LINE_LEN, turn: tg };
}
const CAPS = [   // [시작, 끝, 큰 글, 작은 글]
  [0.5, 2.8, 'AI 놀이터에 온 걸 환영해요', '포니봇과 함께 경기장을 통과해요'],
  [3.0, 6.3, '① 옆으로 주차!', '메카넘 바퀴 — 몸은 앞을 본 채로 옆으로 가요'],
  [6.4, 8.1, '대각선으로도 가요', '네 바퀴가 서로 다르게 돌아요'],
  [8.3, 15.9, '② 구불구불한 선도 따라가요', '라인 센서 2개로 검은 선을 읽어요'],
];

export function createIntro(host, opts = {}) {
  const W = opts.width || 1280, H = opts.height || 720;
  host.style.position = 'relative'; host.style.overflow = 'hidden'; host.style.background = '#bfe9ff';
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.shadowMap.enabled = true;
  const cv = renderer.domElement; cv.style.cssText = 'display:block;width:100%;height:100%'; host.appendChild(cv);
  const scene = new T.Scene(); scene.background = new T.Color(0xbfe9ff); scene.fog = new T.Fog(0xbfe9ff, 260, 520);
  const cam = new T.PerspectiveCamera(38, W / H, 1, 1500);
  scene.add(new T.HemisphereLight(0xffffff, 0x9bb7d6, 1.15));
  const sun = new T.DirectionalLight(0xffffff, 1.7); sun.position.set(60, 140, 80); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 400 }); scene.add(sun); scene.add(sun.target);

  // 바닥(경기장) + 격자 + 출발선
  const floor = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new T.GridHelper(1400, 140, 0x8fc4ea, 0xb9dcf3); grid.position.y = 0.05; scene.add(grid);
  const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const flat = (w, d, c, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: c })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z); scene.add(m); return m; };
  flat(90, 2.2, 0x2456e5, 0, 14);                                                     // 출발선
  // 고깔
  const cone = (x, z, c = 0x2f7bff) => { const g = new T.Group(); const b = new T.Mesh(new T.ConeGeometry(4.2, 11, 20), mat(c)); b.position.y = 5.5; b.castShadow = true;
    const band = new T.Mesh(new T.CylinderGeometry(2.6, 3.3, 2.2, 20), mat(0xffffff)); band.position.y = 5.2; const base = new T.Mesh(new T.CylinderGeometry(5.6, 5.6, 0.8, 20), mat(c)); base.position.y = 0.4;
    g.add(b, band, base); g.position.set(x, 0, z); scene.add(g); };
  // ① 주차 칸: 바닥 표시 + 앞뒤 고깔(앞뒤가 막혀 있어 옆으로만 들어갈 수 있음)
  const slot = new T.Group(); scene.add(slot);
  const edge = (w, d, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: 0xf2b300 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.13, z); slot.add(m); };
  edge(22, 1.4, SLOT.x, SLOT.z - 14); edge(22, 1.4, SLOT.x, SLOT.z + 14); edge(1.4, 29.4, SLOT.x + 11, SLOT.z);
  const pm = new T.Mesh(new T.PlaneGeometry(20.6, 26.6), new T.MeshBasicMaterial({ color: 0xfff3c4 })); pm.rotation.x = -Math.PI / 2; pm.position.set(SLOT.x + 0.3, 0.1, SLOT.z); slot.add(pm);
  cone(SLOT.x, SLOT.z - 24, 0xf08a24); cone(SLOT.x, SLOT.z + 24, 0xf08a24);
  cone(-70, -30); cone(74, -96); cone(-78, -150);
  // ② 검은 선(구불구불) — 바닥에 붙은 띠 + 도착 표시
  { const N = 260, W2 = 1.9, pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const u = i / N, pt = LINE.getPointAt(u), tg = LINE.getTangentAt(u), nx = -tg.z, nz = tg.x;
      pos.push(pt.x + nx * W2, 0.14, pt.z + nz * W2, pt.x - nx * W2, 0.14, pt.z - nz * W2); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    scene.add(new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x15181c, side: T.DoubleSide }))); }
  const end = LINE_PTS[LINE_PTS.length - 1];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) flat(4, 4, (i + j) % 2 ? 0x15181c : 0xffffff, end[0] - 14 + i * 4, end[1] - 12 - j * 4);   // 도착선(체크무늬)

  // 포니봇
  const P = buildPonyModel(); P.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(P.root);
  // 지나간 자리(①에서 몸 방향은 그대로인데 옆·대각선으로 간 것이 보이게)
  const trail = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0x2456e5 })); scene.add(trail);
  // 이동 방향 화살표(바닥)
  const arrow = new T.Mesh(new T.ShapeGeometry((() => { const sh = new T.Shape(); [[0, 9], [5, 3], [2, 3], [2, -6], [-2, -6], [-2, 3], [-5, 3]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); return sh; })()),
    new T.MeshBasicMaterial({ color: 0xf08a24, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
  arrow.rotation.x = -Math.PI / 2; scene.add(arrow);

  // ---- 글자(DOM): 자막·거리 숫자·제목 ----
  const ui = document.createElement('div'); ui.className = 'pin-ui'; ui.innerHTML =
    '<div class="pin-cap"><b></b><span></span></div>' +
    '<div class="pin-title"><p>AI 포니봇 교실</p><b>예상하고 · 실행하고 · 확인해요</b><span>바운더리엑스 AI 포니봇 × 마이크로비트</span></div>';
  host.appendChild(ui);
  const cap = ui.querySelector('.pin-cap'), title = ui.querySelector('.pin-title');
  const g2 = P.oledCanvas.getContext('2d');
  let oledKey = '';
  function oled(text) {   // 포니봇 OLED 글자(128×64)
    if (text === oledKey) return; oledKey = text;
    g2.fillStyle = '#05080e'; g2.fillRect(0, 0, 128, 64); g2.fillStyle = '#96d7ff'; g2.font = 'bold 26px monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(text, 64, 34); P.oledTex.needsUpdate = true;
  }

  function render(t) {
    t = clamp(t, 0, DUR);
    const p = pose(t), d = 1 / 60, q = pose(t - d), vx = (p.x - q.x) / d, vz = (p.z - q.z) / d;      // 속도(cm/s)
    const hr = p.h * RAD;
    P.root.position.set(p.x, 0, p.z); P.root.rotation.y = -hr;
    // 바퀴: 메카넘 — 앞뒤는 네 바퀴 같은 방향, 옆 이동은 대각선끼리 같은 방향. 각도 = 이동 거리 / 반지름(위치로 계산해 프레임 사이에 쌓지 않음)
    const fwd = t < 8.2 ? -p.z : 44 + p.s, side = t < 8.2 ? p.x : 0;
    const ang = { FL: fwd + side, FR: fwd - side, RL: fwd - side, RR: fwd + side };
    const vf = vx * Math.sin(hr) - vz * Math.cos(hr), vs = vx * Math.cos(hr) + vz * Math.sin(hr);   // 몸 기준 앞·옆 속도
    for (const n of Object.keys(P.wheels)) { P.wheels[n].spin.rotation.x = -ang[n] / WHEEL_R; const v = (n === 'FL' || n === 'RR') ? vf + vs : vf - vs; P.leds[n].color.set(v > 0.5 ? 0x1fa463 : v < -0.5 ? 0xe5484d : 0x555555); }
    // 라인 센서 점: 선 위에서는 노랑, 굽은 길에서는 안쪽 센서가 더 자주 켜짐
    const onLine = t >= 8.2 && t < 15.7, k0 = pose(t + 0.12), bend = onLine ? Math.sin((k0.h - p.h) * RAD) : 0;
    P.lineDots.forEach((m, i) => m.material.color.set(onLine && ((i === 0 ? bend < 0.02 : bend > -0.02)) ? 0xffd23f : 0x555555));
    // 지나간 자리(①·대각선): 출발 → 지금까지
    const pts = []; for (let tt = 3.0; tt <= Math.min(t, 8.2); tt += 0.05) { const a = pose(tt); pts.push(new T.Vector3(a.x, 0.2, a.z)); }
    trail.visible = pts.length > 1 && t < 9.2; if (pts.length > 1) trail.geometry.setFromPoints(pts);
    // 이동 방향 화살표: ① 옆으로 / 대각선 일 때 포니봇 옆 바닥에
    const sp = Math.hypot(vx, vz), showArrow = t > 4.4 && t < 8.0 && sp > 1.5;
    arrow.visible = showArrow; if (showArrow) { const a = Math.atan2(vx, -vz); arrow.position.set(p.x + Math.sin(a) * 17, 0.22, p.z - Math.cos(a) * 17); arrow.rotation.z = -a; arrow.material.opacity = clamp(sp / 8) * 0.9; }
    // 카메라
    const k1 = seg(t, 0, 2.8), k2 = seg(t, 2.8, 3.8), k3 = seg(t, 7.6, 9.0), k4 = seg(t, 15.9, 17.4);
    const orbit = lerp(-70, 28, k1) * RAD;
    let cx = Math.sin(orbit) * lerp(34, 46, k1), cy = lerp(12, 22, k1), cz = Math.cos(orbit) * lerp(34, 46, k1);     // 등장: 둘레를 돎
    let lx = p.x, ly = 4, lz = p.z;
    // ① 주차: 위에서 비스듬히 — 주차 칸과 지나간 자리가 한눈에(카메라는 포니봇을 따라가지 않고 칸 쪽에 고정)
    const ax = 13, az = -16;
    cx = lerp(cx, ax + 6 - p.x, k2); cy = lerp(cy, 58, k2); cz = lerp(cz, az + 54 - p.z, k2);
    lx = lerp(lx, ax, k2); lz = lerp(lz, az - 6, k2);
    // ② 선 따라가기: 뒤 위에서 따라가며 앞의 굽은 길이 보이게(방향은 조금 뒤 시각의 것을 써서 부드럽게)
    const hb = pose(Math.max(8.2, t - 0.5)).h * RAD, bx = -Math.sin(hb) * 40, bz = Math.cos(hb) * 40;
    cx = lerp(cx, bx, k3); cy = lerp(cy, 74, k3); cz = lerp(cz, bz, k3);
    lx = lerp(lx, p.x + Math.sin(hb) * 4, k3); lz = lerp(lz, p.z - Math.cos(hb) * 4, k3);     // 포니봇은 화면 가운데, 앞의 굽은 길은 위쪽에
    // 제목: 앞에서 가까이
    cx = lerp(cx, 26, k4); cy = lerp(cy, 17, k4); cz = lerp(cz, -44, k4); lx = lerp(lx, p.x, k4); lz = lerp(lz, p.z, k4); ly = 4 + 4 * k4;
    cam.position.set(p.x + cx, cy, p.z + cz); cam.lookAt(lx, ly, lz);
    sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + 60, 140, p.z + 80);
    // OLED
    oled(t < 3 ? 'HELLO' : t < 8.2 ? (sp > 0.5 ? (Math.abs(vs) > Math.abs(vf) * 1.5 ? 'SIDE' : Math.abs(vs) > 1 ? 'DIAG' : 'GO') : 'STOP') : t < 15.7 ? 'LINE' : ':)');
    // 자막
    let shown = false;
    for (const [a, b, big, small] of CAPS) {
      const o = seg(t, a, a + 0.45) * (1 - seg(t, b - 0.4, b));
      if (o > 0.001) { cap.style.opacity = o; cap.style.transform = `translate(-50%, ${lerp(14, 0, seg(t, a, a + 0.45))}px)`; cap.firstChild.textContent = big; cap.lastChild.textContent = small; shown = true; }
    }
    if (!shown) cap.style.opacity = 0;
    const tt = seg(t, 16.6, 17.6); title.style.opacity = tt; title.style.transform = `translate(-50%, ${lerp(20, 0, tt)}px)`;
    renderer.render(scene, cam);
  }
  let raf = 0, t0 = 0, time = 0, onEnd = null;
  const api = {
    get time() { return time; }, get running() { return !!raf; }, DUR,
    seek(t) { cancelAnimationFrame(raf); raf = 0; time = t; render(t); },
    play(done) { cancelAnimationFrame(raf); onEnd = done || null; t0 = performance.now() - time * 1000;
      const step = (now) => { time = (now - t0) / 1000; if (time >= DUR) { time = DUR; render(DUR); raf = 0; if (onEnd) onEnd(); return; } render(time); raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step); },
    restart(done) { time = 0; api.play(done); },
  };
  render(0);
  return api;
}
