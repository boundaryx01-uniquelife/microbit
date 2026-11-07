// 자동 재생 3D 영상 "로보독의 모험" (story.html 용). 한 장면의 3D 무대에서 약 29초, 장면마다 3~4초 안팎.
// 로보독 모형·움직임은 시뮬레이터(sim/)와 같은 것을 씀. 스크롤이나 클릭 없이 열면 바로 재생되고, 끝나면 시작 버튼이 나옴.
import * as THREE from 'three';
import { View3D } from './sim/view3d.js';
import { Robot, World, makeRobodogApi } from './sim/runtime.js';

export const END = 29;
export const SCENES = [   // t: 장면 시작 시각(초). 자막 text
  { t: 0, text: '쉬는 시간 복도는 달리기 대회장!' },
  { t: 4.5, text: '로보독이 신호등이 되면 어떨까?' },
  { t: 8.5, text: '어라, 로보독이 카드를 못 알아봐요' },
  { t: 12, text: '사진을 더 모아 다시 가르쳐요' },
  { t: 15.2, text: '초록! 찾았다!' },
  { t: 19, text: '마이크로비트가 숫자 3을 보내요' },
  { t: 21.8, text: '로보독이 깨어나 걸어가요' },
  { t: 25.25, text: '빨간 카드를 보면 — 멈춤!' },
];
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ease = (x) => x * x * (3 - 2 * x);
const back = (x) => { const c = 1.9; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const fade = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createStory({ host, still = false, onScene = () => {}, onTick = () => {}, onEnd = () => {} }) {
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
  const cv = view.renderer.domElement;
  cv.style.touchAction = 'auto'; cv.style.pointerEvents = 'none';
  cv.setAttribute('aria-hidden', 'true');

  // ---------- 무대: 학교 복도 ----------
  const scene = view.scene;
  const bg = new THREE.Color(css('--stage') || '#e9eef7');
  const night = bg.clone().lerp(new THREE.Color(0x0b1020), 0.75);
  scene.background = bg.clone();
  scene.fog = new THREE.Fog(bg.clone(), 80, 200);
  const g = view.tableGroup;
  while (g.children.length) g.remove(g.children[0]);
  view.tableKey = world.useTable;
  const floorCol = new THREE.Color(css('--floor') || css('--table') || '#cdb88f');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: floorCol, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(60, 0, 40); floor.receiveShadow = true; g.add(floor);
  const grid = new THREE.GridHelper(260, 52, 0x6f7f99, 0x6f7f99);
  grid.position.set(60, 0.03, 40); grid.material.transparent = true; grid.material.opacity = 0.14; g.add(grid);
  // 뒤쪽 벽 + 창문
  const wallCol = new THREE.Color(css('--wall') || '#dfe7f5');
  const wall = new THREE.Mesh(new THREE.BoxGeometry(320, 26, 2), new THREE.MeshStandardMaterial({ color: wallCol, roughness: 1 }));
  wall.position.set(60, 13, 108); g.add(wall);
  const skyCol = new THREE.Color(css('--sky') || '#bfe3ff');
  [-30, 10, 50, 90, 130, 170].forEach((x) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), new THREE.MeshBasicMaterial({ color: skyCol, side: THREE.DoubleSide }));
    w.position.set(x, 14, 106.9); g.add(w);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 12), new THREE.MeshBasicMaterial({ color: wallCol, side: THREE.DoubleSide }));
    bar.position.set(x, 14, 106.8); g.add(bar);
  });
  const lights = scene.children.filter(o => o.isLight);
  const baseI = lights.map(l => l.intensity);
  const spot = new THREE.SpotLight(0xbfd4ff, 0, 70, 0.4, 0.6);
  spot.position.set(60, 44, 90); spot.target.position.set(60, 0, 72); scene.add(spot, spot.target);
  const accent = new THREE.Color(css('--accent') || '#2259d6');
  const YELLOW = new THREE.Color('#d99a00'), RED = new THREE.Color('#c62f2f'), GREENC = new THREE.Color('#157a46');

  // ---------- 말풍선 이름표(스프라이트) ----------
  function tagSprite(text, color, w = 11) {
    const tex = canvasTex(640, 112, (c) => {
      const F = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
      c.fillStyle = '#' + color.getHexString(); rr(c, 4, 4, 632, 104, 52); c.fill();
      c.fillStyle = '#ffffff'; c.font = `800 54px ${F}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 320, 58);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false }));
    s.userData.w = w; s.scale.set(0.01, 0.01, 1); scene.add(s); return s;
  }
  // 이름표: show 시각에 튀어나오고 hide 시각에 사라짐
  function tagAnim(s, t, show, hide = 1e9) {
    const k = Math.max(0.01, back(fade(t, show, show + 0.35)));
    s.material.opacity = Math.min(1, fade(t, show, show + 0.2)) * (1 - fade(t, hide, hide + 0.35));
    s.scale.set(s.userData.w * k, s.userData.w * 112 / 640 * k, 1);
  }

  // ---------- 카드(초록·빨강) ----------
  function makeCard(color, at) {
    const tex = canvasTex(256, 352, (c) => {
      c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 352, 28); c.fill();
      c.strokeStyle = '#dbe1ee'; c.lineWidth = 8; rr(c, 4, 4, 248, 344, 26); c.stroke();
      c.fillStyle = color; c.beginPath(); c.arc(128, 160, 82, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#dbe1ee'; rr(c, 64, 278, 128, 22, 11); c.fill();
    });
    const grp = new THREE.Group(); grp.position.set(at.x, 0, at.z); scene.add(grp);
    const pivot = new THREE.Group(); grp.add(pivot);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(8, 11), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
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
    pivot.scale.set(1, 0.001, 1);
    return { pivot, finder, fmat, scan, at };
  }
  const green = makeCard('#1fa463', { x: 40, z: 50 });
  const red = makeCard('#e5484d', { x: 60, z: 30 });
  function cardAnim(cd, t, t0, scanAt) {
    cd.pivot.scale.y = Math.max(0.001, back(fade(t, t0, t0 + 0.45)));
    const f = fade(t, t0 + 0.4, t0 + 1.0);
    cd.fmat.opacity = f; cd.finder.scale.setScalar(1.7 - 0.7 * ease(f));
    let sc = 0; for (const a of scanAt) { const s = fade(t, a, a + 0.9); if (s > 0 && s < 1) { sc = s; break; } }
    cd.scan.material.opacity = sc > 0 ? 0.9 : 0; cd.scan.position.set(0, 11.8 - 10.6 * sc, -0.35);
  }
  const tagY = (cd) => (s) => s.position.set(cd.at.x, 15.1, cd.at.z);
  const tGreenFail = tagSprite('음… 잘 모르겠어요', YELLOW, 12.5); tagY(green)(tGreenFail);
  const tGreenOk = tagSprite('초록! 찾았다', accent, 10); tagY(green)(tGreenOk);
  const tGreen3 = tagSprite('초록 → 3', accent, 9); tagY(green)(tGreen3);
  const tRed1 = tagSprite('빨강 → 1', RED, 9); tagY(red)(tRed1);
  const tIdea = tagSprite('💡 신호등이 되면?', YELLOW, 13); tIdea.position.set(48, 24, 46);
  const tSign = tagSprite('복도에서는 걸어요!', RED, 14); tSign.position.set(118, 24, 104);

  // ---------- 사진 모으기: 쌓이는 사진 더미 ----------
  const PHOTOS = 9, STACK = { x: 24, z: 46 };
  const photoTop = canvasTex(256, 320, (c) => {
    c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 320, 20); c.fill();
    c.fillStyle = '#1fa463'; c.beginPath(); c.arc(128, 140, 70, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#dbe1ee'; rr(c, 60, 250, 136, 20, 10); c.fill();
  });
  const photos = Array.from({ length: PHOTOS }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.28, 6.4), [0, 0, 1, 0, 0, 0].map((top) => top ? new THREE.MeshBasicMaterial({ map: photoTop, transparent: true, alphaTest: 0.5 }) : new THREE.MeshStandardMaterial({ color: 0xffffff })));
    m.rotation.y = Math.sin(i * 2.3) * 0.35; m.castShadow = true; m.visible = false; scene.add(m); return m;
  });
  const tPhotos = tagSprite('사진을 더 모아요', accent, 10.5); tPhotos.position.set(STACK.x, 12, STACK.z);

  // ---------- 신호등 ----------
  const TL = new THREE.Group(); TL.position.set(48, 0, 42); scene.add(TL);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 13, 12), new THREE.MeshStandardMaterial({ color: 0x59637a })); pole.position.y = 6.5; TL.add(pole);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 8.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x1d2330 })); housing.position.y = 14.4; TL.add(housing);
  const bulb = (col, y) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.05 }));
    m.position.set(0, y, -1.2); TL.add(m); return m;
  };
  const bRed = bulb(0xe5484d, 17.2), bYel = bulb(0xf2b300, 14.4), bGrn = bulb(0x1fa463, 11.6);
  const lit = (b, on) => { b.material.emissiveIntensity = on ? 2.4 : 0.05; };
  TL.scale.setScalar(0.001);

  // ---------- 복도를 뛰는 아이들 ----------
  const KID_COLORS = [0xe5484d, 0xf2b300, 0x2456e5, 0x8a4fe0];
  const kids = KID_COLORS.map((col, i) => {
    const k = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 2.6, 6, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })); body.position.y = 5.2; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf4c9a0, roughness: 0.8 })); head.position.y = 8.9; head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x20242c })); hair.position.y = 9.1;
    const legs = [-0.8, 0.8].map((dx) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x20242c })); l.position.set(dx, 2.0, 0); k.add(l); return l; });
    k.add(body, head, hair); k.userData = { legs, lane: 90 + (i % 2) * 6, speed: 40 + i * 5, off: i * 48 };
    k.rotation.y = Math.PI / 2; scene.add(k); return k;
  });

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
      c.shadowBlur = on ? 16 : 0; c.shadowColor = '#ff3b30'; c.fillStyle = on ? '#ff4b3e' : '#3a2020';
      c.beginPath(); c.arc(78 + x * 26, 53 + y * 26, on ? 8 : 6, 0, Math.PI * 2); c.fill();
    }
    c.shadowBlur = 0; mbTex.needsUpdate = true;
  };
  drawMb();
  const mbGrp = new THREE.Group(); mbGrp.position.copy(MB); scene.add(mbGrp);
  const mb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.35), [0, 0, 0, 0, 0, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: mbTex }) : new THREE.MeshStandardMaterial({ color: 0x1d2330 })));
  mb.castShadow = true; mbGrp.add(mb);
  const mbStand = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), new THREE.MeshStandardMaterial({ color: 0x8a96a8 }));
  mbStand.position.set(0, -3.7, 0.6); mbGrp.add(mbStand);
  mbGrp.scale.setScalar(0.001);
  const mkRings = (color) => [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.visible = false; scene.add(m); return m;
  });
  const rings = mkRings(accent), rings2 = mkRings(new THREE.Color('#e5484d'));
  const zzz = [0, 1, 2].map((i) => {
    const tex = canvasTex(104, 104, (c) => { c.fillStyle = '#6b7a95'; c.font = '900 84px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', 52, 56); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false })); s.scale.set(2.2 + i * 0.6, 2.2 + i * 0.6, 1); scene.add(s); return s;
  });

  // ---------- 로보독 시간표(로봇 상태가 바뀌는 것만) ----------
  const events = [
    [0.0, () => { api.legBend(0, 0); api.headLedExp(2); }],              // 웅크리고 눈 감음
    [8.6, () => api.headLedExp(6)],                                      // 눈을 떠 두리번(카드를 못 알아봄)
    [15.2, () => api.headLedExp(0)],                                     // 알아봤다! 초롱초롱
    [20.0, () => { mbDigit = 3; drawMb(); }],
    [21.8, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(40, 200, 120); }],   // 깨어남
    [22.4, () => api.move(0, 60)],
    [24.6, () => { mbDigit = 1; drawMb(); }],
    [25.25, () => { api.stop(); api.headLedExp(13); api.bodyLed(255, 40, 40); }],         // 멈춤!
    [26.6, () => { api.headLedExp(1); api.bodyLed(40, 110, 255); robot.bubble = '안녕!'; robot.bubbleT = 1e9; }],
    [26.75, () => api.legBend(1, 15)], [27.1, () => api.legBend(1, 70)],
    [27.4, () => api.legBend(1, 15)], [27.75, () => api.legBend(1, 70)],
  ].sort((a, b) => a[0] - b[0]);

  // ---------- 카메라 길 [시각, 위치, 바라보는 곳] ----------
  const keys = [
    [0.0, V(112, 34, 24), V(62, 6, 90)],       // 복도를 넓게
    [2.5, V(30, 13, 50), V(78, 6, 92)],        // 뛰어가는 아이들을 따라
    [4.6, V(100, 16, 36), V(57, 8, 58)],       // 구석의 로보독과 신호등
    [8.5, V(100, 16, 36), V(57, 8, 56)],
    [9.8, V(36, 10, 29), V(40, 6.5, 50)],      // 초록 카드
    [11.5, V(36, 13, 20), V(32, 5, 48)],       // 사진 더미
    [14.5, V(36, 13, 20), V(32, 5, 48)],
    [16.0, V(48, 12, 30), V(42, 6.5, 50)],
    [19.0, V(70, 13, 40), V(60, 6, 66)],       // 로보독 쪽으로
    [20.0, V(75, 9, 33), V(82, 4.5, 50)],      // 마이크로비트
    [21.0, V(77, 9, 35), V(82, 4.5, 50)],
    [21.9, V(88, 16, 56), V(64, 4, 68)],       // 전파를 따라 로보독으로
    [24.0, V(86, 12, 46), V(60, 5, 56)],       // 걷는 로보독 옆에서
    [25.4, V(86, 14, 22), V(58, 6, 38)],       // 빨간 카드 앞에서 멈춤
    [26.6, V(82, 16, 20), V(58, 9, 40)],
    [29.0, V(78, 16, 17), V(58, 10.5, 40)],
  ];
  const camAt = (t, pos, tgt) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, q0] = keys[i], [t1, p1, q1] = keys[i + 1];
    const x = ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    pos.lerpVectors(p0, p1, x); tgt.lerpVectors(q0, q1, x);
  };
  const dayAt = (t) => t < 8.5 ? 0.35 : t < 10 ? 0.35 + 0.3 * ease(fade(t, 8.5, 10)) : t < 19.2 ? 0.65 : 0.65 + 0.35 * ease(fade(t, 19.2, 20.8));

  // ---------- 시간 진행 ----------
  let playShift = 0.07, endShift = 0.2;     // 화면 아래 자막·끝 카드 자리만큼 장면을 위로 올림(세로 비율)
  let shX = 0, shY = 0, shTX = 0, shTY = playShift;
  let t = 0, ev = 0, sceneIdx = -1, ended = false, raf = 0, last = performance.now(), running = false, firstFrame = true;
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), pos = new THREE.Vector3(), tgt = new THREE.Vector3(), head = new THREE.Vector3();
  function reset() { robot.reset(); mbDigit = 0; drawMb(); ev = 0; t = 0; }
  function advance(dt) {
    t += dt;
    while (ev < events.length && t >= events[ev][0]) events[ev++][1]();
    robot.step(dt);
    let c = sceneIdx; while (c + 1 < SCENES.length && t >= SCENES[c + 1].t) c++;
    if (c !== sceneIdx) { sceneIdx = c; onScene(c, SCENES[c]); }
    if (!ended && t >= END - 1e-6) { ended = true; shTY = endShift; onEnd(); }
  }
  function finish() {   // 건너뛰기: 끝 장면까지 한 번에 진행
    while (t < END - 1e-6) advance(Math.min(1 / 30, END - t));
    render(0.016);
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
  function render(dt) {
    const day = dayAt(t);
    scene.background.copy(night).lerp(bg, day); scene.fog.color.copy(scene.background);
    const fz = Math.max(1, 1.6 / view.camera.aspect); scene.fog.near = 80 * fz; scene.fog.far = 200 * fz;   // 세로 화면은 카메라가 멀어지므로 안개를 넓힘
    lights.forEach((l, i) => { l.intensity = baseI[i] * (0.25 + 0.75 * day); });
    spot.intensity = 900 * (1 - day);
    // 아이들: 1화(0~8.5초) 동안 복도를 달림
    const kidOn = 1 - fade(t, 8.3, 8.8);
    kids.forEach((k, i) => {
      const u = k.userData, x = ((t * u.speed + u.off) % 200) - 30;
      const ph = t * 11 + i * 1.7;
      k.position.set(x, Math.abs(Math.sin(ph)) * 0.9, u.lane); k.visible = kidOn > 0.01; k.scale.setScalar(Math.max(0.01, kidOn));
      u.legs[0].rotation.x = Math.sin(ph) * 0.9; u.legs[1].rotation.x = -Math.sin(ph) * 0.9;
    });
    tagAnim(tSign, t, 0.4, 8.3);
    // 신호등: 5초에 등장, 초록/빨강 번갈아 켜지다가 → 3화에서 걷기(초록)·멈춤(빨강)을 알려 줌
    // 2화(카드·사진) 장면에서는 화면을 가리지 않게 접어 두고, 3화에서 다시 나옴
    TL.scale.setScalar(Math.max(0.001, t < 14 ? back(fade(t, 5.0, 5.7)) * (1 - fade(t, 8.3, 8.8)) : back(fade(t, 21.0, 21.7))));
    let tg = 0, tr = 0;
    if (t >= 5.7 && t < 8.5) { const ph = Math.floor((t - 5.7) / 0.7) % 2; tg = ph === 0 ? 1 : 0; tr = 1 - tg; }
    else if (t >= 21.8 && t < 25.25) tg = 1; else if (t >= 25.25) tr = 1;
    lit(bGrn, tg); lit(bRed, tr); lit(bYel, 0);
    tagAnim(tIdea, t, 5.4, 8.4);
    // 1화 → 2화: 초록 카드와 AI의 첫 시도
    cardAnim(green, t, 9.3, [10.0, 15.0]);
    tagAnim(tGreenFail, t, 10.6, 15.0); tagAnim(tGreenOk, t, 15.2, 19.9); tagAnim(tGreen3, t, 19.9, 26.6);
    photos.forEach((m, i) => {
      const s0 = 11.2 + i * 0.45, p = fade(t, s0, s0 + 0.4);
      m.visible = p > 0; m.position.set(STACK.x + Math.sin(i * 1.9) * 0.5, 0.15 + i * 0.3 + (1 - back(p)) * 8, STACK.z);
    });
    tagAnim(tPhotos, t, 11.0, 15.0);
    // 3화
    mbGrp.scale.setScalar(Math.max(0.001, back(fade(t, 19.6, 20.1))));
    ringAnim(rings, 20.15); ringAnim(rings2, 24.75);
    cardAnim(red, t, 24.0, [24.8]); tagAnim(tRed1, t, 25.6, 26.6);
    zzz.forEach((s, i) => {
      const p = ((t * 0.55 + i / 3) % 1), on = 1 - fade(t, 8.3, 8.8);
      s.position.set(robot.x + 3 + p * 4, 9 + p * 8, robot.y - 2); s.material.opacity = on * Math.sin(p * Math.PI) * 0.95;
    });
    // 카메라(장이 바뀔 때 부드럽게 따라감)
    camAt(t, pos, tgt);
    const asp = view.camera.aspect;
    if (asp < 1.6) pos.sub(tgt).multiplyScalar(Math.pow(1.6 / asp, 0.85)).add(tgt);
    pos.sub(tgt).multiplyScalar(1.3).add(tgt);   // 전체 화면 무대라 조금 더 물러나 봄
    const sway = still ? 0 : Math.sin(performance.now() / 2400);
    pos.x += sway * 0.8; pos.y += sway * 0.25;
    if (firstFrame || still) { camPos.copy(pos); camTgt.copy(tgt); firstFrame = false; }
    else { const a = 1 - Math.exp(-dt * 3.5); camPos.lerp(pos, a); camTgt.lerp(tgt, a); }
    const a2 = still ? 1 : 1 - Math.exp(-dt * 3);
    shX += (shTX - shX) * a2; shY += (shTY - shY) * a2;
    const W = host.clientWidth || 1, H = host.clientHeight || 1;
    if (Math.abs(shX) > 1e-3 || Math.abs(shY) > 1e-3) view.camera.setViewOffset(W, H, shX * W, shY * H, W, H); else view.camera.clearViewOffset();
    view.camera.position.copy(camPos); view.controls.target.copy(camTgt);
    view.draw(robot.headFrame());
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) {
      const nt = Math.min(t + dt, END);
      if (nt > t) advance(nt - t);
      render(dt); onTick(t);
    }
    if (running) raf = requestAnimationFrame(frame);
  }
  function play() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function pause() { running = false; cancelAnimationFrame(raf); }
  function replay() {
    reset(); sceneIdx = -1; ended = false; shTY = playShift; firstFrame = true; advance(0);
    if (still) { finish(); render(0.016); } else { render(0.016); play(); }
  }
  function setShift(p, e) { playShift = p; endShift = e; shTY = ended ? e : p; }
  new ResizeObserver(() => { if (still) render(0.016); }).observe(host);
  return { replay, finish, setShift, play, pause, view, robot, state: () => ({ t, scene: sceneIdx, ended, cam: camPos.toArray(), dog: [robot.x, robot.y] }) };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
