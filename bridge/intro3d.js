// 첫 화면 3D 이야기 인트로 (약 14초, 6장면). 로보독 모형·움직임은 시뮬레이터(sim/)의 것을 그대로 씀.
// 1 잠든 로보독 → 2 AI가 초록 카드를 봄 → 3 마이크로비트가 3을 보냄 → 4 깨어나 걸음 → 5 빨간 카드에 멈춤 → 6 인사
// WebGL이 없으면 index.html의 2D(SVG) 장면이 그대로 남음.
import * as THREE from 'three';
import { View3D } from './sim/view3d.js';
import { Robot, World, makeRobodogApi } from './sim/runtime.js';

export const CHAPTERS = [
  { t: 0.0, beat: 0, text: '로보독은 아직 아무것도 몰라요', sub: '잠든 로봇' },
  { t: 2.4, beat: 1, text: 'AI에게 초록 카드를 보여 주면…', sub: '① AI가 본다' },
  { t: 5.0, beat: 2, text: '마이크로비트가 숫자 3을 보내요', sub: '② 마이크로비트가 전한다' },
  { t: 6.8, beat: 3, text: '로보독이 깨어나 걸어가요!', sub: '③ 로보독이 움직인다' },
  { t: 9.3, beat: 3, text: '빨간 카드를 보면 — 멈춤!', sub: '내가 정한 규칙대로' },
  { t: 11.6, beat: 3, text: '내가 가르친 AI로 로봇이 움직여요', sub: '이제 직접 해 볼까요?' },
];
const END = 14.0;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function startIntro3D({ host, instant = false, still = false, onChapter = () => {} }) {
  const world = new World();
  world.useTable = false;
  world.start = { x: 60, y: 72, heading: 0 };
  const robot = new Robot(world);
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

  // ---------- 무대 ----------
  const scene = view.scene;
  const bg = new THREE.Color(css('--stage') || '#e9eef7');
  const night = bg.clone().lerp(new THREE.Color(0x0b1020), 0.75);
  scene.background = bg.clone();
  scene.fog = new THREE.Fog(bg.clone(), 70, 170);
  const g = view.tableGroup;
  while (g.children.length) g.remove(g.children[0]);
  view.tableKey = world.useTable;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(css('--table') || '#d9c29b').lerp(bg, 0.35), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(60, 0, 40); floor.receiveShadow = true; g.add(floor);
  const grid = new THREE.GridHelper(200, 40, 0x6f7f99, 0x6f7f99);
  grid.position.set(60, 0.03, 40); grid.material.transparent = true; grid.material.opacity = 0.18; g.add(grid);
  const lights = scene.children.filter(o => o.isLight);
  const baseI = lights.map(l => l.intensity);
  // 로보독을 비추는 스포트라이트(잠든 장면)
  const spot = new THREE.SpotLight(0xbfd4ff, 0, 60, 0.35, 0.6);
  spot.position.set(60, 40, 72); spot.target.position.set(60, 0, 72); scene.add(spot, spot.target);

  const accent = new THREE.Color(css('--accent') || '#2259d6');

  // ---------- 카드(초록·빨강) ----------
  function makeCard(color, at, tagText, tagColor) {
    const tex = canvasTex(256, 352, (c) => {
      c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 352, 28); c.fill();
      c.strokeStyle = '#dbe1ee'; c.lineWidth = 8; rr(c, 4, 4, 248, 344, 26); c.stroke();
      c.fillStyle = color; c.beginPath(); c.arc(128, 160, 82, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#dbe1ee'; rr(c, 64, 278, 128, 22, 11); c.fill();
    });
    const grp = new THREE.Group(); grp.position.set(at.x, 0, at.z); scene.add(grp);
    const pivot = new THREE.Group(); grp.add(pivot);     // 바닥에서 솟아오르는 움직임(아래 끝 기준)
    const card = new THREE.Mesh(new THREE.PlaneGeometry(8, 11), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    card.position.y = 6.5; card.rotation.y = Math.PI; card.castShadow = true; pivot.add(card);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), new THREE.MeshStandardMaterial({ color: 0x8a96a8 }));
    stand.position.set(0, 0.5, 0.8); pivot.add(stand);
    const finder = new THREE.Group(); finder.position.set(0, 6.5, -0.3); finder.rotation.y = Math.PI; pivot.add(finder);
    const fmat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 });
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), fmat); h.position.set(sx * 4, sy * 6.6, 0);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.4), fmat); v.position.set(sx * 5.2, sy * 5.4, 0);
      finder.add(h, v);
    });
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 0.25), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 }));
    scan.rotation.y = Math.PI; pivot.add(scan);
    const tag = label(tagText, tagColor); tag.position.set(at.x, 15.1, at.z); scene.add(tag);
    pivot.scale.set(1, 0.001, 1);
    return { pivot, finder, fmat, scan, tag };
  }
  const green = makeCard('#1fa463', { x: 40, z: 50 }, '초록 → 3', accent);
  const red = makeCard('#e5484d', { x: 60, z: 30 }, '빨강 → 1', new THREE.Color('#c62f2f'));

  // ---------- 마이크로비트 ----------
  const MB = new THREE.Vector3(82, 4.2, 50);
  const DIGITS = { 3: ['###..', '...#.', '..#..', '...#.', '###..'], 1: ['..#..', '.##..', '..#..', '..#..', '.###.'], 0: ['.....', '.....', '.....', '.....', '.....'] };
  let mbDigit = 0;
  const mbCanvas = document.createElement('canvas'); mbCanvas.width = 260; mbCanvas.height = 210;
  const mbTex = new THREE.CanvasTexture(mbCanvas); mbTex.colorSpace = THREE.SRGBColorSpace;
  const drawMb = () => {
    const c = mbCanvas.getContext('2d'), D = DIGITS[mbDigit];
    c.fillStyle = '#1d2330'; rr(c, 0, 0, 260, 210, 26); c.fill();
    c.fillStyle = '#3a4252'; [[38, 105], [222, 105]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 17, 0, Math.PI * 2); c.fill(); });
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const on = D[y][x] === '#';
      c.shadowBlur = on ? 16 : 0; c.shadowColor = '#ff3b30';
      c.fillStyle = on ? '#ff4b3e' : '#3a2020';
      c.beginPath(); c.arc(78 + x * 26, 53 + y * 26, on ? 8 : 6, 0, Math.PI * 2); c.fill();
    }
    c.shadowBlur = 0; mbTex.needsUpdate = true;
  };
  drawMb();
  const mb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.35), [0, 0, 0, 0, 0, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: mbTex }) : new THREE.MeshStandardMaterial({ color: 0x1d2330 })));
  mb.position.copy(MB); mb.castShadow = true; scene.add(mb);
  const mbStand = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), new THREE.MeshStandardMaterial({ color: 0x8a96a8 }));
  mbStand.position.set(MB.x, 0.5, MB.z + 0.6); scene.add(mbStand);
  const mkRings = (color) => [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.visible = false; scene.add(m); return m;
  });
  const rings = mkRings(accent), rings2 = mkRings(new THREE.Color('#e5484d'));

  // 잠든 표시 Zzz
  const zzz = [0, 1, 2].map((i) => { const s = label('z', new THREE.Color('#6b7a95'), true); s.scale.set(2.2 + i * 0.6, 2.2 + i * 0.6, 1); scene.add(s); return s; });

  // ---------- 시간표 ----------
  const events = [
    [0.0, () => { api.legBend(0, 0); api.headLedExp(2); }],                 // 웅크리고 눈 감음
    [5.0, () => { mbDigit = 3; drawMb(); }],
    [6.8, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(40, 200, 120); }],   // 깨어남
    [7.4, () => api.move(0, 60)],
    [9.6, () => { mbDigit = 1; drawMb(); }],
    [10.25, () => { api.stop(); api.headLedExp(13); api.bodyLed(255, 40, 40); }],         // 멈춤!
    [11.6, () => { api.headLedExp(1); api.bodyLed(40, 110, 255); robot.bubble = '안녕!'; robot.bubbleT = 1e9; }],
    [11.75, () => api.legBend(1, 15)], [12.1, () => api.legBend(1, 70)],
    [12.4, () => api.legBend(1, 15)], [12.75, () => api.legBend(1, 70)],
  ].sort((a, b) => a[0] - b[0]);
  // 카메라 길: [시각, 위치, 바라보는 곳]
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = [
    [0.0, V(98, 46, 20), V(60, 2, 66)],      // 높은 곳에서 내려다보는 첫 장면
    [2.2, V(74, 14, 52), V(60, 3, 72)],      // 잠든 로보독에 다가감
    [3.0, V(34, 10, 29), V(40, 6.5, 50)],    // 초록 카드
    [4.6, V(37, 10, 31), V(40, 6.5, 50)],
    [5.3, V(75, 9, 33), V(82, 4.5, 50)],     // 마이크로비트
    [6.1, V(77, 9, 35), V(82, 4.5, 50)],
    [6.9, V(88, 16, 56), V(64, 4, 68)],      // 전파를 따라 로보독으로
    [9.0, V(86, 12, 46), V(60, 5, 56)],      // 걷는 로보독 옆에서 따라감
    [10.4, V(86, 14, 22), V(58, 6, 38)],     // 비스듬히 앞에서: 빨간 카드 앞에서 멈춤
    [11.6, V(82, 16, 20), V(58, 9, 40)],
    [END, V(78, 16, 17), V(58, 10.5, 40)],    // 마지막 장면
  ];
  const ease = (x) => x * x * (3 - 2 * x);
  const back = (x) => { const c = 1.9; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; };   // 살짝 튀어나왔다 자리 잡기
  const fade = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const camAt = (t, pos, tgt) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, q0] = keys[i], [t1, p1, q1] = keys[i + 1];
    const x = ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    pos.lerpVectors(p0, p1, x); tgt.lerpVectors(q0, q1, x);
  };

  let t = 0, ev = 0, ch = -1, orbit = 0, last = performance.now(), raf = 0;
  const idleUntil = END + 14;
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), head = new THREE.Vector3();
  function advance(dt) {
    t += dt;
    while (ev < events.length && t >= events[ev][0]) events[ev++][1]();
    let c = ch; while (c + 1 < CHAPTERS.length && t >= CHAPTERS[c + 1].t) c++;
    if (c !== ch) { ch = c; onChapter(c, CHAPTERS[c]); }
    robot.step(dt);
  }
  function cardAnim(cd, t0, hide = 1e9) {   // t0: 카드가 솟아오르는 시각, hide: 이름표 감추는 시각
    cd.pivot.scale.y = Math.max(0.001, back(fade(t, t0, t0 + 0.45)));
    const f = fade(t, t0 + 0.4, t0 + 1.0);
    cd.fmat.opacity = f; cd.finder.scale.setScalar(1.7 - 0.7 * ease(f));
    const s = fade(t, t0 + 0.7, t0 + 1.6);
    cd.scan.material.opacity = s > 0 && s < 1 ? 0.9 : 0;
    cd.scan.position.set(0, 11.8 - 10.6 * s, -0.35);
    const k = back(fade(t, t0 + 1.5, t0 + 1.85)); cd.tag.material.opacity = Math.min(1, fade(t, t0 + 1.5, t0 + 1.7)) * (1 - fade(t, hide, hide + 0.4));
    cd.tag.scale.set(9 * Math.max(0.01, k), 2.4 * Math.max(0.01, k), 1);
  }
  function ringAnim(rs, t0, to) {
    head.set(robot.x, 8, robot.y - 4);
    rs.forEach((m, i) => {
      const p = fade(t, t0 + i * 0.18, t0 + 0.8 + i * 0.18);
      m.visible = p > 0 && p < 1;
      m.position.lerpVectors(MB, to || head, p); m.scale.setScalar(1 + p * 3.2);
      m.material.opacity = Math.sin(p * Math.PI) * 0.9; m.quaternion.copy(view.camera.quaternion);
    });
  }
  function render() {
    // 밤 → 낮: 잠든 장면은 어둡고 스포트라이트, 깨어나며 밝아짐
    const day = ease(fade(t, 1.6, 3.0));
    scene.background.copy(night).lerp(bg, day); scene.fog.color.copy(scene.background);
    lights.forEach((l, i) => { l.intensity = baseI[i] * (0.25 + 0.75 * day); });
    spot.intensity = 900 * (1 - day);
    // Zzz: 잠든 동안 위로 떠오름
    zzz.forEach((s, i) => {
      const p = ((t * 0.55 + i / 3) % 1), on = t < 6.6 ? 1 - fade(t, 6.2, 6.6) : 0;
      s.position.set(robot.x + 3 + p * 4, 9 + p * 8, robot.y - 2);
      s.material.opacity = on * Math.sin(p * Math.PI) * 0.95;
    });
    cardAnim(green, 2.6, 11.6);
    ringAnim(rings, 5.15);
    cardAnim(red, 9.0, 11.6);
    ringAnim(rings2, 9.75);
    // 카메라
    if (t <= END) camAt(t, pos, tgt);
    else {
      camAt(END, pos, tgt);
      const off = pos.clone().sub(tgt), a = Math.sin(orbit) * 0.3;   // 끝난 뒤 좌우로 살짝 둘러보기
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
  function finish() {   // 남은 시간을 한 번에 진행해 끝 장면으로
    cancelAnimationFrame(raf);
    while (t < END + 1) advance(1 / 60);
    render();
    if (!still) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  if (instant || still) finish(); else raf = requestAnimationFrame(frame);
  const pause = () => cancelAnimationFrame(raf), resume = () => { last = performance.now(); raf = requestAnimationFrame(frame); };
  return { finish, pause, resume, view, robot, END, state: () => ({ t, ch, cam: view.camera.position.toArray(), dog: [robot.x, robot.y] }) };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function label(text, color, plain = false) {
  const tex = canvasTex(plain ? 104 : 384, 104, (c) => {
    const F = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
    if (plain) { c.fillStyle = '#' + color.getHexString(); c.font = `900 84px ${F}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 52, 56); return; }
    c.fillStyle = '#' + color.getHexString(); rr(c, 4, 4, 376, 96, 48); c.fill();
    c.fillStyle = '#ffffff'; c.font = `800 54px ${F}`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 192, 56);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false }));
  s.scale.set(9, 2.4, 1); return s;
}
