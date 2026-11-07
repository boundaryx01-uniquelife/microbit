// 첫 화면 3D 인트로 (약 5초): 카메라가 카드 → 마이크로비트 → 로보독으로 날아가며 보여 준다.
// 로보독 모형·움직임은 시뮬레이터(sim/)의 것을 그대로 씀. WebGL이 없으면 기존 2D(SVG) 장면이 그대로 남음.
import * as THREE from 'three';
import { View3D } from './sim/view3d.js';
import { Robot, World, makeRobodogApi } from './sim/runtime.js';

const END = 5.0;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function startIntro3D({ host, instant = false, still = false }) {
  const world = new World();
  world.useTable = false;
  world.start = { x: 60, y: 55, heading: 0 };
  const robot = new Robot(world);
  robot.headMode = 0;
  const api = makeRobodogApi(robot, { warnOnce() {}, sleep: () => Promise.resolve(), soundOn: () => false });

  const view = new View3D(host, world, robot);
  view.init();
  view.follow = false;
  view.trailLine.visible = false;
  view.controls.enabled = false;
  view.controls.minDistance = 1;
  const cv = view.renderer.domElement;
  cv.style.touchAction = 'auto'; cv.style.pointerEvents = 'none';
  cv.setAttribute('aria-hidden', 'true');

  // 무대: 책상 대신 넓은 바닥 + 은은한 격자, 배경은 페이지 색
  const scene = view.scene;
  const bg = new THREE.Color(css('--stage') || '#e9eef7');
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 60, 160);
  const g = view.tableGroup;
  while (g.children.length) g.remove(g.children[0]);
  view.tableKey = world.useTable;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(css('--table') || '#d9c29b').lerp(bg, 0.35), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(60, 0, 40); floor.receiveShadow = true; g.add(floor);
  const grid = new THREE.GridHelper(200, 40, 0x6f7f99, 0x6f7f99);
  grid.position.set(60, 0.03, 40); grid.material.transparent = true; grid.material.opacity = 0.18; g.add(grid);

  const accent = new THREE.Color(css('--accent') || '#2259d6');

  // 1) 초록 카드 + AI 뷰파인더
  const CARD = new THREE.Vector3(40, 6.5, 30);
  const cardTex = canvasTex(256, 352, (c) => {
    c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 352, 28); c.fill();
    c.strokeStyle = '#dbe1ee'; c.lineWidth = 8; rr(c, 4, 4, 248, 344, 26); c.stroke();
    c.fillStyle = '#1fa463'; c.beginPath(); c.arc(128, 160, 82, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#dbe1ee'; rr(c, 64, 278, 128, 22, 11); c.fill();
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(8, 11), new THREE.MeshBasicMaterial({ map: cardTex, side: THREE.DoubleSide }));
  card.position.copy(CARD); card.rotation.y = Math.PI; card.castShadow = true; scene.add(card);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), new THREE.MeshStandardMaterial({ color: 0x8a96a8 }));
  stand.position.set(CARD.x, 0.5, CARD.z + 0.8); scene.add(stand);
  const finder = new THREE.Group(); finder.position.set(CARD.x, CARD.y, CARD.z - 0.3); scene.add(finder);
  const fmat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 });
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), fmat); h.position.set(sx * (5.2 - 1.2), sy * 6.6, 0);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.4), fmat); v.position.set(sx * 5.2, sy * (6.6 - 1.2), 0);
    finder.add(h, v);
  });
  finder.rotation.y = Math.PI;
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 0.25), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 }));
  scan.rotation.y = Math.PI; scene.add(scan);
  const tag = label('초록 → 3', accent); tag.position.set(CARD.x, CARD.y + 8.6, CARD.z); scene.add(tag);

  // 2) 마이크로비트 (LED에 숫자 3) + 전파
  const MB = new THREE.Vector3(80, 4.2, 30);
  let mbLit = false;
  const mbCanvas = document.createElement('canvas'); mbCanvas.width = 260; mbCanvas.height = 210;
  const mbTex = new THREE.CanvasTexture(mbCanvas); mbTex.colorSpace = THREE.SRGBColorSpace;
  const drawMb = () => {
    const c = mbCanvas.getContext('2d'), THREE_ = ['###..', '...#.', '..#..', '...#.', '###..'];
    c.fillStyle = '#1d2330'; rr(c, 0, 0, 260, 210, 26); c.fill();
    c.fillStyle = '#3a4252'; [[38, 105], [222, 105]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 17, 0, Math.PI * 2); c.fill(); });
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const on = mbLit && THREE_[y][x] === '#';
      c.shadowBlur = on ? 16 : 0; c.shadowColor = '#ff3b30';
      c.fillStyle = on ? '#ff4b3e' : '#3a2020';
      c.beginPath(); c.arc(78 + x * 26, 53 + y * 26, on ? 8 : 6, 0, Math.PI * 2); c.fill();
    }
    c.shadowBlur = 0; mbTex.needsUpdate = true;
  };
  drawMb();
  const mb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.35), [0, 0, 0, 0, 0, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: mbTex }) : new THREE.MeshStandardMaterial({ color: 0x1d2330 })));
  mb.position.copy(MB); mb.castShadow = true; scene.add(mb);
  const mbStand = stand.clone(); mbStand.position.set(MB.x, 0.5, MB.z + 0.6); scene.add(mbStand);
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(m); return m;
  });

  // 3) 시간표 (초) — 아래 글자 애니메이션(①0.2s ②1.5s ③2.6s, 제목 4.6s)과 맞춤
  const events = [
    [1.45, () => { mbLit = true; drawMb(); }],
    [2.45, () => { api.headLedExp(0); api.bodyLed(40, 110, 255); }],
    [2.7, () => api.move(0, 60)],
    [4.1, () => api.stop()],
    [4.2, () => api.headLedExp(1)],
    // 꾸벅 두 번(앞다리만 낮췄다 올리기) = 인사
    [4.25, () => api.legBend(1, 15)], [4.6, () => api.legBend(1, 70)],
    [4.9, () => api.legBend(1, 15)], [5.25, () => api.legBend(1, 70)],
    [4.35, () => { robot.bubble = '안녕!'; robot.bubbleT = 1e9; }],
  ].sort((a, b) => a[0] - b[0]);
  // 카메라 길: [시각, 위치, 바라보는 곳]
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = [
    [0.0, V(37, 8, 13), V(40, 6.5, 30)],
    [1.25, V(42, 8.5, 16), V(40, 6.5, 30)],
    [2.0, V(74, 8, 15), V(80, 4.5, 30)],
    [2.7, V(76, 19, 10), V(63, 4, 46)],
    [4.1, V(78, 17, 15), V(60, 8, 43)],
    [END, V(75, 13, 16), V(60, 9, 43)],
  ];
  const ease = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, x) => a + (b - a) * x;
  const fade = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const camAt = (t, pos, tgt) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, q0] = keys[i], [t1, p1, q1] = keys[i + 1];
    const x = ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    pos.lerpVectors(p0, p1, x); tgt.lerpVectors(q0, q1, x);
  };

  let t = 0, ev = 0, orbit = 0, last = performance.now(), raf = 0, idleUntil = END + 14;
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  const head = new THREE.Vector3();
  function advance(dt) {
    t += dt;
    while (ev < events.length && t >= events[ev][0]) events[ev++][1]();
    robot.step(dt);
  }
  function render() {
    // 뷰파인더·스캔·태그
    const f = fade(t, 0.2, 0.9);
    fmat.opacity = f; finder.scale.setScalar(lerp(1.7, 1, ease(f)));
    const s = fade(t, 0.45, 1.4);
    scan.material.opacity = s > 0 && s < 1 ? 0.9 : 0;
    scan.position.set(CARD.x, CARD.y + 5.3 - 10.6 * s, CARD.z - 0.35);
    const k = ease(fade(t, 1.15, 1.45)); tag.material.opacity = k; tag.scale.set(9 * (0.5 + 0.5 * k), 2.4 * (0.5 + 0.5 * k), 1);
    // 전파: 마이크로비트 → 로보독 머리
    head.set(robot.x, 8, robot.y - 4);
    rings.forEach((m, i) => {
      const p = fade(t, 1.75 + i * 0.18, 2.55 + i * 0.18);
      m.visible = p > 0 && p < 1;
      m.position.lerpVectors(MB, head, p); m.scale.setScalar(1 + p * 3.2);
      m.material.opacity = Math.sin(p * Math.PI) * 0.9; m.quaternion.copy(view.camera.quaternion);
    });
    // 카메라
    if (t <= END) camAt(t, pos, tgt);
    else {
      camAt(END, pos, tgt);
      const off = pos.clone().sub(tgt), a = Math.sin(orbit) * 0.3;   // 좌우로 살짝 흔들며 둘러보기
      pos.set(tgt.x + off.x * Math.cos(a) - off.z * Math.sin(a), pos.y, tgt.z + off.x * Math.sin(a) + off.z * Math.cos(a));
    }
    // 세로로 긴 화면(휴대폰)에서는 조금 뒤로 물러나 다 보이게
    const asp = view.camera.aspect;
    if (asp < 1.6) pos.sub(tgt).multiplyScalar(Math.pow(1.6 / asp, 0.85)).add(tgt);
    view.camera.position.copy(pos); view.controls.target.copy(tgt);
    view.draw(robot.headFrame());
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) {
      advance(dt);
      if (t > END && !still) orbit += dt * 0.35;
      render();
    }
    if (t < idleUntil) raf = requestAnimationFrame(frame);
  }
  function finish() {
    // 남은 시간을 한 번에 진행해 끝 장면으로
    cancelAnimationFrame(raf);
    while (t < END + 1.6) advance(1 / 60);
    render();
    if (!still) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  if (instant || still) finish(); else raf = requestAnimationFrame(frame);
  return { finish, view, robot, state: () => ({ t, cam: view.camera.position.toArray(), dog: [robot.x, robot.y, robot.heading, robot.mode, robot.posture] }) };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function label(text, color) {
  const tex = canvasTex(384, 104, (c) => {
    c.fillStyle = '#' + color.getHexString(); rr(c, 4, 4, 376, 96, 48); c.fill();
    c.fillStyle = '#ffffff'; c.font = '800 54px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 192, 56);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false }));
  s.scale.set(9, 2.4, 1); return s;
}
