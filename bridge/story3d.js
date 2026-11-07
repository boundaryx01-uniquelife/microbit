// 자동 재생 3D 영상 "로보독의 모험: 할아버지의 약" (story.html 용). 한 장면의 3D 무대(거실)에서 약 29초, 장면마다 3~4초 안팎.
// 로보독 모형·움직임은 시뮬레이터(sim/)와 같은 것을 씀. 스크롤이나 클릭 없이 열면 바로 재생되고, 끝나면 시작 버튼이 나옴.
// 이야기: 약을 못 찾는 할아버지 → "약 가져다줘" → 로보독은 약통을 모름 → 사진을 모아 가르침 → AI가 약통을 알아봄
//        → 마이크로비트가 숫자 전달 → 로보독이 걸어가 약통 앞에 멈춰 "여기예요!" (실물 로보독은 물건을 집지 못하므로 '찾아서 알려 주기')
import * as THREE from 'three';
import { View3D } from './sim/view3d.js';
import { Robot, World, makeRobodogApi } from './sim/runtime.js';

export const END = 29;
export const SCENES = [   // t: 장면 시작 시각(초). 자막 text
  { t: 0, text: '할아버지가 약을 찾지 못해 한참을 헤매요' },
  { t: 4.5, text: '"로보독, 약 좀 가져다줘!"' },
  { t: 8.5, text: '어라, 로보독이 약통을 몰라요' },
  { t: 12, text: '약통 사진을 더 모아 다시 가르쳐요' },
  { t: 15.2, text: '약통! 찾았다!' },
  { t: 19, text: '마이크로비트가 숫자 3을 보내요' },
  { t: 21.8, text: '로보독이 깨어나 약통을 찾아가요' },
  { t: 25.25, text: '약통 앞에서 멈춰 "여기예요!"' },
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

  // ---------- 무대: 할아버지네 거실 ----------
  const scene = view.scene;
  const bg = new THREE.Color(css('--stage') || '#e9eef7');
  const night = bg.clone().lerp(new THREE.Color(0x0b1020), 0.75);
  scene.background = bg.clone();
  scene.fog = new THREE.Fog(bg.clone(), 80, 200);
  const g = view.tableGroup;
  while (g.children.length) g.remove(g.children[0]);
  view.tableKey = world.useTable;
  const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const floorCol = new THREE.Color(css('--floor') || css('--table') || '#cdb88f');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat(floorCol, 0.9));
  floor.rotation.x = -Math.PI / 2; floor.position.set(60, 0, 40); floor.receiveShadow = true; g.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(92, 78), mat(new THREE.Color(css('--rug') || '#6f9a9a'), 1));
  rug.rotation.x = -Math.PI / 2; rug.position.set(60, 0.05, 58); rug.receiveShadow = true; g.add(rug);
  const wallCol = new THREE.Color(css('--wall') || '#dfe7f5');
  const wall = new THREE.Mesh(new THREE.BoxGeometry(320, 30, 2), mat(wallCol, 1));
  wall.position.set(60, 15, 108); g.add(wall);
  const skyCol = new THREE.Color(css('--sky') || '#bfe3ff');
  [20, 100].forEach((x) => {   // 창문
    const frame = new THREE.Mesh(new THREE.BoxGeometry(26, 17, 0.6), mat(0xf2f2ee)); frame.position.set(x, 16, 106.8); g.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(23, 14), new THREE.MeshBasicMaterial({ color: skyCol })); glass.rotation.y = Math.PI; glass.position.set(x, 16, 106.4); g.add(glass);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 14), new THREE.MeshBasicMaterial({ color: 0xf2f2ee, side: THREE.DoubleSide })); bar.position.set(x, 16, 106.3); g.add(bar);
  });
  [[60, 18, 0xd9a441], [130, 14, 0x7aa6c9]].forEach(([x, y, c]) => {   // 액자
    const f = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 0.5), mat(0x5a4636)); f.position.set(x, y, 106.8); g.add(f);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: c })); p.rotation.y = Math.PI; p.position.set(x, y, 106.5); g.add(p);
  });
  // 소파 + 할아버지
  const sofa = new THREE.Group(); sofa.position.set(86, 0, 95); scene.add(sofa);
  const cloth = new THREE.Color('#8b4a4a');
  const sBase = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 11), mat(cloth)); sBase.position.y = 3; sBase.castShadow = true; sofa.add(sBase);
  const sBack = new THREE.Mesh(new THREE.BoxGeometry(26, 11, 3), mat(cloth)); sBack.position.set(0, 8.5, 4.5); sBack.castShadow = true; sofa.add(sBack);
  [-12, 12].forEach((x) => { const a = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 11), mat(cloth)); a.position.set(x, 4, 0); a.castShadow = true; sofa.add(a); });
  const grandpa = new THREE.Group(); grandpa.position.set(86, 0, 94); scene.add(grandpa);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.3, 3.2, 6, 14), mat(0x6b4f3a)); body.position.y = 10.4; body.castShadow = true; grandpa.add(body);
  [-1.1, 1.1].forEach((x) => {   // 다리(앞으로 뻗음) + 실내화
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 5, 10), mat(0x3a4256)); l.rotation.x = Math.PI / 2; l.position.set(x * 1.3, 7.2, -3.4); grandpa.add(l);
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 2.6), mat(0x9a6a4a)); s.position.set(x * 1.3, 6.4, -6.2); grandpa.add(s);
  });
  [-1, 1].forEach((sx) => {      // 팔
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3, 4, 10), mat(0x6b4f3a)); a.position.set(sx * 2.9, 10, -1.2); a.rotation.x = 0.7; grandpa.add(a);
  });
  const head = new THREE.Group(); head.position.y = 15.6; grandpa.add(head);
  const skin = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 16), mat(0xf0c39a, 0.8)); skin.castShadow = true; head.add(skin);
  [-1, 1].forEach((sx) => {      // 흰머리(옆머리), 안경, 눈썹
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), mat(0xf2f2f2)); h.position.set(sx * 1.75, 0.3, 0.15); head.add(h);
    const gl = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 18), mat(0x2a2f3a, 0.4)); gl.position.set(sx * 0.8, 0.25, -1.75); head.add(gl);
    const eb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.2), mat(0xe8e8e8)); eb.position.set(sx * 0.8, 1.0, -1.7); head.add(eb);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), mat(0x2a2f3a)); bridge.position.set(0, 0.28, -1.78); head.add(bridge);
  // 탁자 + 약통(목적지)
  const TABLE = { x: 60, z: 31 };
  const table = new THREE.Group(); table.position.set(TABLE.x, 0, TABLE.z); scene.add(table);
  const topM = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 10), mat(0x9a7a56)); topM.position.y = 7; topM.castShadow = true; topM.receiveShadow = true; table.add(topM);
  [[-6, -4], [6, -4], [-6, 4], [6, 4]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6.6, 8), mat(0x7a5c3c)); l.position.set(x, 3.3, z); table.add(l); });
  const pill = new THREE.Group(); pill.position.set(0, 7.5, 0); table.add(pill);
  const pBody = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 4.2, 20), mat(0xe8821e, 0.4)); pBody.position.y = 2.1; pBody.castShadow = true; pill.add(pBody);
  const pBand = new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.74, 2.2, 20), mat(0xffffff, 0.6)); pBand.position.y = 2.2; pill.add(pBand);
  const pCap = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.1, 20), mat(0xf4f4f4, 0.5)); pCap.position.y = 4.75; pill.add(pCap);
  const crossM = new THREE.MeshBasicMaterial({ color: 0xd63838 });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.1), crossM), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.1), crossM);
  c1.position.set(0, 2.2, -1.78); c2.position.copy(c1.position); pill.add(c1, c2);
  const pillGlow = new THREE.PointLight(0xffd28a, 0, 40); pillGlow.position.set(TABLE.x, 14, TABLE.z - 3); scene.add(pillGlow);

  const lights = scene.children.filter(o => o.isLight && o !== pillGlow);
  const baseI = lights.map(l => l.intensity);
  const spot = new THREE.SpotLight(0xbfd4ff, 0, 70, 0.4, 0.6);
  spot.position.set(60, 44, 90); spot.target.position.set(60, 0, 72); scene.add(spot, spot.target);
  const accent = new THREE.Color(css('--accent') || '#2259d6');
  const YELLOW = new THREE.Color('#d99a00'), WHITE = new THREE.Color('#ffffff'), RED = new THREE.Color('#c62f2f');

  // ---------- 말풍선·이름표(스프라이트) ----------
  function tagSprite(text, color, w = 11, { ink = '#ffffff', stroke = null } = {}) {
    const tex = canvasTex(640, 112, (c) => {
      const F = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
      c.fillStyle = '#' + color.getHexString(); rr(c, 4, 4, 632, 104, 52); c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 6; rr(c, 4, 4, 632, 104, 52); c.stroke(); }
      let size = 54; c.font = `800 ${size}px ${F}`;
      while (c.measureText(text).width > 560 && size > 26) { size -= 2; c.font = `800 ${size}px ${F}`; }
      c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 320, 58);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false }));
    s.userData.w = w; s.scale.set(0.01, 0.01, 1); scene.add(s); return s;
  }
  function tagAnim(s, t, show, hide = 1e9) {   // show 시각에 튀어나오고 hide 시각에 사라짐
    const k = Math.max(0.01, back(fade(t, show, show + 0.35)));
    s.material.opacity = Math.min(1, fade(t, show, show + 0.2)) * (1 - fade(t, hide, hide + 0.35));
    s.scale.set(s.userData.w * k, s.userData.w * 112 / 640 * k, 1);
  }
  const speak = (text, w) => tagSprite(text, WHITE, w, { ink: '#1a2030', stroke: '#c9d1df' });

  // ---------- 약통 그림(카드·사진에 쓰는 아이콘) ----------
  const drawPill = (c, cx, cy, s) => {
    c.fillStyle = '#e8821e'; rr(c, cx - 38 * s, cy - 40 * s, 76 * s, 92 * s, 12 * s); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(cx - 38 * s, cy - 6 * s, 76 * s, 44 * s);
    c.fillStyle = '#f4f4f4'; rr(c, cx - 42 * s, cy - 62 * s, 84 * s, 26 * s, 8 * s); c.fill();
    c.fillStyle = '#d63838'; c.fillRect(cx - 4 * s, cy + 2 * s, 8 * s, 30 * s); c.fillRect(cx - 15 * s, cy + 13 * s, 30 * s, 8 * s);
  };

  // ---------- 약통 카드 ----------
  function makeCard(at) {
    const tex = canvasTex(256, 352, (c) => {
      c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 352, 28); c.fill();
      c.strokeStyle = '#dbe1ee'; c.lineWidth = 8; rr(c, 4, 4, 248, 344, 26); c.stroke();
      drawPill(c, 128, 160, 1.45);
      c.fillStyle = '#dbe1ee'; rr(c, 64, 290, 128, 22, 11); c.fill();
    });
    const grp = new THREE.Group(); grp.position.set(at.x, 0, at.z); scene.add(grp);
    const pivot = new THREE.Group(); grp.add(pivot);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(8, 11), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
    card.position.y = 6.5; card.rotation.y = Math.PI; card.castShadow = true; pivot.add(card);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), mat(0x8a96a8)); stand.position.set(0, 0.5, 0.8); pivot.add(stand);
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
  const card = makeCard({ x: 40, z: 50 });
  function cardAnim(cd, t, t0, scanAt) {
    cd.pivot.scale.y = Math.max(0.001, back(fade(t, t0, t0 + 0.45)));
    const f = fade(t, t0 + 0.4, t0 + 1.0);
    cd.fmat.opacity = f; cd.finder.scale.setScalar(1.7 - 0.7 * ease(f));
    let sc = 0; for (const a of scanAt) { const s = fade(t, a, a + 0.9); if (s > 0 && s < 1) { sc = s; break; } }
    cd.scan.material.opacity = sc > 0 ? 0.9 : 0; cd.scan.position.set(0, 11.8 - 10.6 * sc, -0.35);
  }
  const above = (cd) => (s) => s.position.set(cd.at.x, 15.1, cd.at.z);
  const tFail = tagSprite('음… 약통이 뭐죠?', YELLOW, 11.5); above(card)(tFail);
  const tOk = tagSprite('약통! 찾았다', accent, 9.5); above(card)(tOk);
  const t3 = tagSprite('약통 → 3', accent, 8.5); above(card)(t3);
  const tArrive = tagSprite('도착! → 1', accent, 8.5); tArrive.position.set(TABLE.x, 20, TABLE.z);
  // 할아버지 말풍선
  const bSearch = speak('약이 어디 있더라…', 12.5); bSearch.position.set(84, 27, 92);
  const bAsk = speak('로보독, 약 좀 가져다줘!', 15); bAsk.position.set(80, 27, 92);
  const bThanks = speak('고맙다, 로보독!', 12); bThanks.position.set(84, 27, 92);

  // ---------- 사진 모으기: 쌓이는 약통 사진 더미 ----------
  const PHOTOS = 9, STACK = { x: 24, z: 46 };
  const photoTop = canvasTex(256, 320, (c) => {
    c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 320, 20); c.fill();
    drawPill(c, 128, 142, 1.25);
    c.fillStyle = '#dbe1ee'; rr(c, 60, 262, 136, 20, 10); c.fill();
  });
  const photos = Array.from({ length: PHOTOS }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.28, 6.4), [0, 0, 1, 0, 0, 0].map((top) => top ? new THREE.MeshBasicMaterial({ map: photoTop, transparent: true, alphaTest: 0.5 }) : mat(0xffffff)));
    m.rotation.y = Math.sin(i * 2.3) * 0.35; m.castShadow = true; m.visible = false; scene.add(m); return m;
  });
  const tPhotos = tagSprite('약통 사진을 더 모아요', accent, 11.5); tPhotos.position.set(STACK.x, 12, STACK.z);

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
  const mb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.35), [0, 0, 0, 0, 0, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: mbTex }) : mat(0x1d2330)));
  mb.castShadow = true; mbGrp.add(mb);
  const mbStand = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), mat(0x8a96a8)); mbStand.position.set(0, -3.7, 0.6); mbGrp.add(mbStand);
  mbGrp.scale.setScalar(0.001);
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.visible = false; scene.add(m); return m;
  });
  const zzz = [0, 1, 2].map((i) => {
    const tex = canvasTex(104, 104, (c) => { c.fillStyle = '#6b7a95'; c.font = '900 84px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', 52, 56); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false })); s.scale.set(2.2 + i * 0.6, 2.2 + i * 0.6, 1); scene.add(s); return s;
  });

  // ---------- 로보독 시간표(로봇 상태가 바뀌는 것만) ----------
  const events = [
    [0.0, () => { api.legBend(0, 0); api.headLedExp(2); }],              // 웅크리고 눈 감음
    [8.6, () => api.headLedExp(6)],                                      // 눈을 떠 두리번(약통을 모름)
    [15.2, () => api.headLedExp(0)],                                     // 알아봤다! 초롱초롱
    [20.0, () => { mbDigit = 3; drawMb(); }],
    [21.8, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(40, 200, 120); }],   // 깨어남
    [22.4, () => api.move(0, 60)],
    [24.6, () => { mbDigit = 1; drawMb(); }],
    [25.25, () => { api.stop(); api.headLedExp(13); api.bodyLed(255, 170, 40); }],         // 약통 앞에서 멈춤
    [26.6, () => { api.headLedExp(1); api.bodyLed(40, 110, 255); robot.bubble = '여기예요!'; robot.bubbleT = 1e9; }],
    [26.75, () => api.legBend(1, 15)], [27.1, () => api.legBend(1, 70)],
    [27.4, () => api.legBend(1, 15)], [27.75, () => api.legBend(1, 70)],
  ].sort((a, b) => a[0] - b[0]);

  // ---------- 카메라 길 [시각, 위치, 바라보는 곳] ----------
  const keys = [
    [0.0, V(112, 26, 30), V(72, 8, 88)],       // 거실을 넓게
    [2.5, V(104, 14, 52), V(80, 9, 92)],       // 소파의 할아버지
    [4.6, V(100, 13, 50), V(72, 11, 86)],       // 할아버지와 잠든 로보독(옆에서)
    [8.5, V(100, 13, 50), V(72, 11, 86)],
    [9.8, V(36, 10, 29), V(40, 6.5, 50)],      // 약통 카드
    [11.5, V(36, 13, 20), V(32, 5, 48)],       // 사진 더미
    [14.5, V(36, 13, 20), V(32, 5, 48)],
    [16.0, V(48, 12, 30), V(42, 6.5, 50)],
    [19.0, V(70, 13, 40), V(60, 6, 66)],       // 로보독 쪽으로
    [20.0, V(75, 9, 33), V(82, 4.5, 50)],      // 마이크로비트
    [21.0, V(77, 9, 35), V(82, 4.5, 50)],
    [21.9, V(88, 16, 56), V(64, 4, 68)],       // 전파를 따라 로보독으로
    [24.0, V(86, 12, 46), V(60, 5, 56)],       // 걷는 로보독 옆에서
    [25.4, V(86, 14, 22), V(58, 7, 38)],       // 약통 앞에서 멈춤
    [26.6, V(82, 16, 20), V(58, 9, 40)],
    [27.9, V(106, 24, 24), V(72, 9, 62)],      // 멀리서: 로보독과 할아버지가 함께
    [29.0, V(106, 24, 24), V(72, 9, 62)],
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
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), pos = new THREE.Vector3(), tgt = new THREE.Vector3(), head3 = new THREE.Vector3();
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
    head3.set(robot.x, 8, robot.y - 4);
    rs.forEach((m, i) => {
      const p = fade(t, t0 + i * 0.18, t0 + 0.8 + i * 0.18);
      m.visible = p > 0 && p < 1;
      m.position.lerpVectors(MB, to || head3, p); m.scale.setScalar(1 + p * 3.2);
      m.material.opacity = Math.sin(p * Math.PI) * 0.9; m.quaternion.copy(view.camera.quaternion);
    });
  }
  function render(dt) {
    const day = dayAt(t);
    scene.background.copy(night).lerp(bg, day); scene.fog.color.copy(scene.background);
    const fz = Math.max(1, 1.6 / view.camera.aspect); scene.fog.near = 80 * fz; scene.fog.far = 200 * fz;   // 세로 화면은 카메라가 멀어지므로 안개를 넓힘
    lights.forEach((l, i) => { l.intensity = baseI[i] * (0.25 + 0.75 * day); });
    spot.intensity = 900 * (1 - day);
    // 할아버지: 처음엔 두리번, 부탁한 뒤엔 로보독을 지켜봄, 끝에 고개를 끄덕임
    head.rotation.y = t < 4.5 ? Math.sin(t * 1.8) * 0.55 : 0.55 + (t > 27.4 ? 0 : 0);
    head.rotation.x = t > 27.4 ? Math.sin((t - 27.4) * 7) * 0.12 * (1 - fade(t, 28.6, 29)) : 0;
    body.rotation.z = t < 4.5 ? Math.sin(t * 1.8 + 1) * 0.05 : 0;
    tagAnim(bSearch, t, 0.9, 4.3); tagAnim(bAsk, t, 4.9, 8.4); tagAnim(bThanks, t, 27.4);
    // 약통이 놓인 탁자: 끝에서 약통이 은은히 빛남
    pillGlow.intensity = 400 * fade(t, 25.4, 26.4);
    cardAnim(card, t, 9.3, [10.0, 15.0]);
    tagAnim(tFail, t, 10.6, 15.0); tagAnim(tOk, t, 15.2, 19.9); tagAnim(t3, t, 19.9, 25.6);
    photos.forEach((m, i) => {
      const s0 = 12.0 - 0.8 + i * 0.4, p = fade(t, s0, s0 + 0.4);
      m.visible = p > 0; m.position.set(STACK.x + Math.sin(i * 1.9) * 0.5, 0.15 + i * 0.3 + (1 - back(p)) * 8, STACK.z);
    });
    tagAnim(tPhotos, t, 11.0, 15.0);
    mbGrp.scale.setScalar(Math.max(0.001, back(fade(t, 19.6, 20.1))));
    ringAnim(rings, 20.15);
    tagAnim(tArrive, t, 25.6, 26.6);
    zzz.forEach((s, i) => {
      const p = ((t * 0.55 + i / 3) % 1), on = 1 - fade(t, 8.3, 8.8);
      s.position.set(robot.x + 3 + p * 4, 9 + p * 8, robot.y - 2); s.material.opacity = on * Math.sin(p * Math.PI) * 0.95;
    });
    // 카메라(부드럽게 따라감)
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
