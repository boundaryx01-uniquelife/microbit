// 자동 재생 3D 영상 "로보독의 모험: 할아버지의 약" (index.html 용). 거실 한 무대에서 약 35초, 장면 8개.
// 로보독 모형·움직임은 시뮬레이터(sim/)와 같은 것을 씀. 열면 바로 재생되고, 끝나면 시작 카드가 나옴.
// 이야기: 약을 못 찾는 할아버지 → "약 가져다줘" → 로보독은 약통을 모름(갸웃) → 사진을 모아 AI에게 가르침 → AI가 약통을 알아봄
//        → 마이크로비트가 숫자를 전달 → 로보독이 걸어가 탁자 앞에 멈춰 "여기예요!" (실물 로보독은 물건을 집지 못하므로 '찾아서 알려 주기')
// 시험·캡처용 손잡이: engine.seek(초) 로 어느 시각이든 같은 장면을 만들 수 있음(시간 진행은 결정적).
import * as THREE from 'three';
import { RoomEnvironment } from './sim/lib/RoomEnvironment.js';
import { RoundedBoxGeometry } from './sim/lib/RoundedBoxGeometry.js';
import { View3D } from './sim/view3d.js';
import { Robot, World, makeRobodogApi, HEAD } from './sim/runtime.js';
import { createAudio } from './assets/intro/audio.js';

export const END = 35;
export const SCENES = [   // t: 장면 시작 시각(초), text: 자막(5~6학년 말투), rep: 정지 화면(움직임 줄이기)에서 보여 줄 시각
  { t: 0, text: '할아버지가 약을 찾지 못해요', rep: 2.6 },
  { t: 3.5, text: '"로보독, 약 좀 가져다줘!"', rep: 5.6 },
  { t: 7, text: '어? 로보독이 약통을 몰라요', rep: 10.2 },
  { t: 12, text: '약통 사진을 많이 모아서 AI에게 가르쳐요', rep: 17.2 },
  { t: 18.5, text: 'AI가 배웠어요! 이제 약통을 알아봐요', rep: 21.6 },
  { t: 24, text: '마이크로비트가 숫자 3을 전해요', rep: 26.2 },
  { t: 27.5, text: '로보독이 약통을 찾아 걸어가요', rep: 29.5 },
  { t: 31.5, text: '탁자 앞에서 멈춰 "여기예요!"', rep: 34.2 },
];
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ease = (x) => x * x * (3 - 2 * x);
const back = (x) => { const c = 1.9; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const fade = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, k) => a + (b - a) * k;
// 화면에 꼭 들어와야 하는 덩어리 [중심x,y,z, 반쪽 크기x,y,z] 들의 합 → 상자
const U = (...items) => {
  const mn = V(1e9, 1e9, 1e9), mx = V(-1e9, -1e9, -1e9);
  for (const [cx, cy, cz, hx, hy, hz] of items) { mn.min(V(cx - hx, cy - hy, cz - hz)); mx.max(V(cx + hx, cy + hy, cz + hz)); }
  return { mn, mx };
};
const mixBox = (a, b, k) => ({ mn: a.mn.clone().lerp(b.mn, k), mx: a.mx.clone().lerp(b.mx, k) });

// 무대 배치(cm). 화면 왼쪽이 +x (카메라가 -z 쪽에서 +z를 봄)
const SOFA = { x: 86, z: 92 }, DOG0 = { x: 66, y: 70, heading: 140 }, TABLE = { x: 130, z: 66 }, DOG1 = { x: 106, y: 66 };
const BIG = 2.2;   // 소파·할아버지는 장난감 로보독보다 훨씬 크게(사람 크기 느낌)
const GH = 46;      // 할아버지 머리 위 높이(말풍선 꼬리 끝)
const CARD = { x: 44, z: 56 }, STACK = { x: 28, z: 52 }, BRAIN = V(26, 17, 62), MB = V(96, 4.2, 52);

export function createStory({ host, still = false, onScene = () => {}, onTick = () => {}, onEnd = () => {}, onLeaveEnd = () => {}, adaptive = true }) {
  const world = new World();
  world.useTable = false; world.table = { w: 400, h: 400 };
  world.start = { x: DOG0.x, y: DOG0.y, heading: DOG0.heading };
  const robot = new Robot(world);
  const api = makeRobodogApi(robot, { warnOnce() {}, sleep: () => Promise.resolve(), soundOn: () => false });
  const audio = createAudio();

  const view = new View3D(host, world, robot);
  view.init();
  view.follow = false; view.trailLine.visible = false; view.controls.enabled = false;
  const renderer = view.renderer, cv = renderer.domElement, camera = view.camera, scene = view.scene;
  cv.style.touchAction = 'auto'; cv.style.pointerEvents = 'none'; cv.setAttribute('aria-hidden', 'true');
  camera.fov = 38; camera.near = 2; camera.far = 700;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const MOBILE = Math.min(screen.width, screen.height) < 700 || matchMedia('(pointer: coarse)').matches;
  const DPR = window.devicePixelRatio || 1;

  // ---------- 빛: 부드러운 방 조명(PMREM) + 따뜻한 창가 햇빛 ----------
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.fog = null;
  const hemi = scene.children.find(o => o.isHemisphereLight), sun = scene.children.find(o => o.isDirectionalLight);
  hemi.intensity = 0.95; hemi.color.set(0xfff4e0); hemi.groundColor.set(0xb08a64);
  sun.color.set(0xffe9c8); sun.position.set(118, 120, 8); sun.target.position.set(66, 0, 62); scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -78, right: 78, top: 78, bottom: -78, near: 20, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25;
  const lights = [hemi, sun], baseI = [hemi.intensity, 1.35]; sun.intensity = baseI[1];

  // ---------- 무대: 할아버지네 거실 ----------
  const bg = new THREE.Color(css('--stage') || '#e9eef7');
  const night = bg.clone().lerp(new THREE.Color(0x1a1522), 0.55);
  scene.background = bg.clone();
  const g = view.tableGroup;
  while (g.children.length) g.remove(g.children[0]);
  view.tableKey = world.useTable;
  const mat = (color, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const rbox = (w, h, d, r = 0.6, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const mk = (geo, m, parent, x = 0, y = 0, z = 0, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; };

  // 부드러운 바닥 그림자(접촉 그림자). 그림자 지도를 꺼도 남음
  const blobTex = canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(40,20,10,.55)'); gr.addColorStop(0.55, 'rgba(40,20,10,.22)'); gr.addColorStop(1, 'rgba(40,20,10,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }, false);
  const blob = (x, z, w, d, o = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z); m.renderOrder = 1; scene.add(m); return m; };

  const floorTex = canvasTex(512, 512, (c) => {
    const base = ['#c9965f', '#bd8a55', '#d0a06a', '#b98450', '#c4915c'];
    for (let i = 0; i < 8; i++) { c.fillStyle = base[(i * 3) % 5]; c.fillRect(0, i * 64, 512, 64);
      for (let k = 0; k < 2; k++) { const off = (i * 97 + k * 256) % 512; c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(off, i * 64, 2, 64); }
      c.fillStyle = 'rgba(90,50,20,.35)'; c.fillRect(0, i * 64, 512, 2);
      for (let k = 0; k < 14; k++) { c.fillStyle = `rgba(110,60,25,${0.04 + (k % 3) * 0.02})`; c.fillRect((k * 83 + i * 31) % 480, i * 64 + 8 + (k * 13) % 44, 40 + (k * 7) % 60, 2); } }
  }); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 7);
  const floor = mk(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72 }), g, 66, 0, 40, false);
  floor.rotation.x = -Math.PI / 2; floor.material.color.set(css('--floor') ? new THREE.Color(css('--floor')).lerp(new THREE.Color(0xffffff), 0.55) : 0xffffff);
  const rugTex = canvasTex(512, 332, (c) => {
    c.fillStyle = '#' + new THREE.Color(css('--rug') || '#4f8f93').getHexString(); rr(c, 0, 0, 512, 332, 26); c.fill();
    c.strokeStyle = '#f3e3c4'; c.lineWidth = 10; rr(c, 22, 22, 468, 288, 14); c.stroke();
    c.strokeStyle = 'rgba(243,227,196,.55)'; c.lineWidth = 4; rr(c, 40, 40, 432, 252, 8); c.stroke();
    c.fillStyle = 'rgba(243,227,196,.5)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(70 + i * 46, 166); c.lineTo(93 + i * 46, 140); c.lineTo(116 + i * 46, 166); c.lineTo(93 + i * 46, 192); c.closePath(); c.fill(); }
  });
  const rug = mk(new RoundedBoxGeometry(94, 0.5, 60, 2, 0.2), [0, 0, 1, 0, 0, 0].map((top) => top ? new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }) : mat(0x3f7378, 1)), g, 66, 0.25, 66, false);
  const wallCol = new THREE.Color(css('--wall') || '#f3e2c7');
  const wallM = mat(wallCol, 1); wallM.emissive = wallCol.clone().multiplyScalar(0.28);
  const wall = mk(new THREE.BoxGeometry(320, 70, 2), wallM, g, 60, 35, 109, false);
  mk(new THREE.BoxGeometry(320, 15, 0.6), mat(wallCol.clone().multiplyScalar(0.8), 0.9), g, 60, 7.5, 107.8, false);       // 허리 판자
  mk(new THREE.BoxGeometry(320, 1.4, 1.2), mat(0xfaf3e6, 0.6), g, 60, 15.4, 107.6, false);
  mk(new THREE.BoxGeometry(320, 2.4, 1.2), mat(0xfaf3e6, 0.6), g, 60, 1.2, 107.6, false);
  [-34, 166].forEach(x => mk(new THREE.BoxGeometry(2, 70, 240), wallM, g, x, 35, 0, false));
  const skyTex = canvasTex(64, 128, (c) => { const gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#9fd4ff'); gr.addColorStop(1, '#fff1cf'); c.fillStyle = gr; c.fillRect(0, 0, 64, 128); }, false);
  const WIN = { x: 88, y: 52 };
  mk(rbox(27, 20, 1.2, 0.5), mat(0xfaf6ee, 0.5), g, WIN.x, WIN.y, 107.4, false);
  const glass = mk(new THREE.PlaneGeometry(23.4, 16.4), new THREE.MeshBasicMaterial({ map: skyTex }), g, WIN.x, WIN.y, 106.7, false); glass.rotation.y = Math.PI;
  mk(new THREE.BoxGeometry(0.9, 16.4, 0.5), mat(0xfaf6ee, 0.5), g, WIN.x, WIN.y, 106.5, false);
  mk(new THREE.BoxGeometry(23.4, 0.9, 0.5), mat(0xfaf6ee, 0.5), g, WIN.x, WIN.y, 106.5, false);
  [-1, 1].forEach(s => { const cu = mk(rbox(5.5, 21, 1.6, 0.7), mat(0xd98d6f, 1), g, WIN.x + s * 15.2, WIN.y - 0.5, 106.2, false); cu.scale.x = 1; });
  mk(new THREE.CylinderGeometry(0.4, 0.4, 36, 8), mat(0x6b4a33, 0.4), g, WIN.x, WIN.y + 10.6, 105.8, false).rotation.z = Math.PI / 2;
  [[44, 50, 14, 10.5, 0xe9b44c], [20, 48, 10, 13, 0x78a9c9]].forEach(([x, y, w, h, c]) => {   // 액자
    mk(rbox(w + 1.6, h + 1.6, 0.9, 0.3), mat(0x6b4a33, 0.5), g, x, y, 107.2, false);
    const p = mk(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }), g, x, y, 106.7, false); p.rotation.y = Math.PI;
    const hill = mk(new THREE.CircleGeometry(w * 0.42, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.7) }), g, x, y - h * 0.5, 106.6, false); hill.rotation.y = Math.PI;
  });
  // 화분·스탠드(소품)
  const plant = new THREE.Group(); plant.position.set(168, 0, 100); plant.scale.setScalar(2.1); scene.add(plant);
  mk(new THREE.CylinderGeometry(3.2, 2.5, 5, 18), mat(0xc4673f, 0.7), plant, 0, 2.5, 0);
  for (let i = 0; i < 7; i++) { const l = mk(new THREE.SphereGeometry(1, 12, 10), mat(i % 2 ? 0x4f8c55 : 0x62a266, 0.7), plant, Math.cos(i * 0.9) * 1.6, 8 + (i % 3) * 2.4, Math.sin(i * 0.9) * 1.6); l.scale.set(1.5, 3.4, 0.6); l.rotation.set(Math.sin(i) * 0.4, i * 0.9, Math.cos(i * 1.7) * 0.5); }
  const lamp = new THREE.Group(); lamp.position.set(-6, 0, 100); lamp.scale.setScalar(2); scene.add(lamp);
  mk(new THREE.CylinderGeometry(3, 3.4, 0.8, 18), mat(0x4a3a2c, 0.5), lamp, 0, 0.4, 0);
  mk(new THREE.CylinderGeometry(0.35, 0.35, 22, 10), mat(0x4a3a2c, 0.5), lamp, 0, 11, 0);
  const shade = mk(new THREE.CylinderGeometry(3.2, 4.6, 5.4, 22, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc46b, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide }), lamp, 0, 23.5, 0, false);
  blob(plant.position.x, plant.position.z, 22, 18, 0.9); blob(-6, 100, 18, 18, 0.7);

  // 소파: 둥글게 깎은 모서리
  const sofa = new THREE.Group(); sofa.position.set(SOFA.x, 0, SOFA.z); sofa.scale.setScalar(BIG); scene.add(sofa);
  const cloth = new THREE.Color(0xb5594e), cloth2 = cloth.clone().lerp(new THREE.Color(0xffffff), 0.12);
  mk(rbox(26, 5.5, 11.5, 1.6), mat(cloth, 0.95), sofa, 0, 3.6, 0);
  mk(rbox(26, 11.5, 3.6, 1.7), mat(cloth, 0.95), sofa, 0, 9.4, 4.6);
  [-1, 1].forEach(s => mk(rbox(3.8, 8.8, 11.5, 1.6), mat(cloth, 0.95), sofa, s * 11.9, 5.2, 0));
  [-1, 1].forEach(s => mk(rbox(10.4, 2.6, 9, 1.1), mat(cloth2, 0.95), sofa, s * 5.4, 7.2, -0.4));
  [[-11, -4.5], [11, -4.5], [-11, 4.5], [11, 4.5]].forEach(([x, z]) => mk(new THREE.CylinderGeometry(0.7, 0.55, 1.4, 10), mat(0x5b402c, 0.5), sofa, x, 0.7, z));
  const pillow = mk(rbox(5.2, 5.2, 2.2, 1.0), mat(0xe9b44c, 0.9), sofa, 8.6, 11.2, 1.2); pillow.rotation.set(-0.15, 0.2, 0.3);
  blob(SOFA.x, SOFA.z - 1, 74, 46, 0.9);

  // 할아버지
  const grandpa = new THREE.Group(); grandpa.position.set(SOFA.x, 0, SOFA.z - 1); grandpa.scale.setScalar(BIG); scene.add(grandpa);
  const cardi = mat(0x6f8f72, 0.9), skinM = mat(0xf0c39a, 0.7);
  const body = mk(new THREE.CapsuleGeometry(2.7, 3.4, 8, 16), cardi, grandpa, 0, 10.8, 0.4);
  mk(rbox(5.4, 5.8, 0.4, 0.2), mat(0xf3ead8, 0.9), grandpa, 0, 11.2, -2.6, false);   // 안에 입은 셔츠
  [-1.2, 1.2].forEach(x => {   // 다리(앞으로 뻗음) + 실내화
    mk(new THREE.CapsuleGeometry(1.15, 4.4, 6, 12), mat(0x40485e, 0.9), grandpa, x * 1.35, 8.2, -4.6).rotation.x = Math.PI / 2;
    mk(rbox(2.4, 1.3, 3.2, 0.5), mat(0xb87a52, 0.8), grandpa, x * 1.35, 7.3, -8.6);
  });
  const armPivot = [-1, 1].map((sx) => {   // 팔: 어깨 축을 중심으로 돌림
    const p = new THREE.Group(); p.position.set(sx * 3.2, 12.6, 0.2); grandpa.add(p);
    const a = mk(new THREE.CapsuleGeometry(0.95, 3.4, 6, 12), cardi, p, 0, -2.4, 0);
    mk(new THREE.SphereGeometry(0.95, 12, 10), skinM, p, 0, -4.9, 0);
    p.rotation.x = 0.7; return p;
  });
  const head = new THREE.Group(); head.position.set(0, 16.8, 0.2); grandpa.add(head);
  mk(new THREE.SphereGeometry(2.25, 28, 22), skinM, head, 0, 0, 0);
  mk(new THREE.SphereGeometry(0.42, 12, 10), mat(0xe9b08a, 0.7), head, 0, -0.1, -2.2);   // 코
  const hairM = mat(0xf4f4f4, 0.95);
  [-1, 1].forEach((sx) => {
    mk(new THREE.SphereGeometry(0.95, 14, 10), hairM, head, sx * 2.0, 0.55, 0.25);
    mk(new THREE.TorusGeometry(0.78, 0.1, 8, 22), mat(0x2a2f3a, 0.4, 0.3), head, sx * 0.95, 0.35, -2.05, false);
    mk(rbox(1.3, 0.28, 0.3, 0.12), hairM, head, sx * 0.95, 1.35, -2.0, false);        // 눈썹
    mk(new THREE.SphereGeometry(0.17, 8, 8), mat(0x1a1a1a, 0.3), head, sx * 0.95, 0.35, -2.2, false);
    mk(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0xff9f9f, transparent: true, opacity: 0 }), head, sx * 1.55, -0.55, -2.0, false).rotation.y = Math.PI;
  });
  const cheeks = head.children.filter(o => o.geometry && o.geometry.type === 'CircleGeometry');
  const eyes = head.children.filter(o => o.geometry && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 0.17);
  mk(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), mat(0x2a2f3a), head, 0, 0.4, -2.1, false).rotation.z = Math.PI / 2;
  mk(new THREE.SphereGeometry(2.0, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), hairM, head, 0, 0.45, 0.35, false);   // 윗머리(얇게)
  const mouthFlat = mk(rbox(1.1, 0.22, 0.2, 0.08), mat(0x7a3d34, 0.5), head, 0, -1.15, -2.0, false);
  const mouthO = mk(new THREE.TorusGeometry(0.34, 0.12, 8, 14), mat(0x7a3d34, 0.5), head, 0, -1.25, -2.0, false);
  const mouthSmile = mk(new THREE.TorusGeometry(0.75, 0.12, 8, 18, Math.PI), mat(0x7a3d34, 0.5), head, 0, -0.95, -2.0, false); mouthSmile.rotation.z = Math.PI;
  blob(SOFA.x, SOFA.z - 14, 30, 22, 0.5);

  // 탁자 + 약통(목적지)
  const table = new THREE.Group(); table.position.set(TABLE.x, 0, TABLE.z); table.scale.setScalar(1.5); scene.add(table);
  mk(rbox(17, 1.4, 11, 0.6), mat(0xa87a4d, 0.6), table, 0, 7.3, 0);
  [[-7, -4], [7, -4], [-7, 4], [7, 4]].forEach(([x, z]) => mk(new THREE.CylinderGeometry(0.6, 0.45, 6.7, 10), mat(0x8a6038, 0.6), table, x, 3.35, z));
  const pill = new THREE.Group(); pill.position.set(0, 8.0, 0); table.add(pill);
  const labelTex = canvasTex(512, 256, (c) => {
    c.fillStyle = '#e8821e'; c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#ffffff'; rr(c, 156, 40, 200, 176, 16); c.fill();
    c.fillStyle = '#d63838'; c.fillRect(244, 66, 24, 124); c.fillRect(194, 116, 124, 24);
  });
  const pBody = mk(new THREE.CylinderGeometry(2.3, 2.3, 6, 32), [new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.4 }), mat(0xe8821e, 0.4), mat(0xe8821e, 0.4)], pill, 0, 3, 0);
  pBody.rotation.y = 0;
  mk(new THREE.CylinderGeometry(2.45, 2.45, 1.5, 32), mat(0xf6f3ec, 0.4), pill, 0, 6.6, 0);
  mk(new THREE.TorusGeometry(2.4, 0.12, 8, 32), mat(0xf6f3ec, 0.4), pill, 0, 5.9, 0).rotation.x = Math.PI / 2;
  const glowTex = canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,225,150,.95)'); gr.addColorStop(0.4, 'rgba(255,200,100,.4)'); gr.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }, false);
  const pillGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); pillGlow.scale.set(16, 16, 1); pillGlow.position.set(TABLE.x, 17, TABLE.z); scene.add(pillGlow);
  const arrow = new THREE.Group(); scene.add(arrow);   // 약통 위에서 통통 뛰는 화살표
  mk(new THREE.ConeGeometry(1.8, 3, 20), new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xffa400, emissiveIntensity: 0.5, roughness: 0.4 }), arrow, 0, 0, 0, false).rotation.x = Math.PI;
  mk(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 14), new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xffa400, emissiveIntensity: 0.5, roughness: 0.4 }), arrow, 0, 2.6, 0, false);
  arrow.visible = false;
  blob(TABLE.x, TABLE.z, 34, 26, 0.8);

  const accent = new THREE.Color(css('--accent') || '#2259d6');
  const YELLOW = new THREE.Color('#e0a000'), WHITE = new THREE.Color('#ffffff'), GREEN = new THREE.Color('#1f9d5a');

  // ---------- 말풍선·이름표(스프라이트): 크고 굵게 ----------
  const FONT = '"Pretendard Variable","Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  const TW = 800, TH = 232;   // TW: 글자 크기 기준 폭(월드 길이 w가 이 폭에 해당). 말풍선 폭은 글자 길이에 맞춰 늘어남
  const mctx = document.createElement('canvas').getContext('2d');
  function tagSprite(text, color, w = 14, { ink = '#ffffff', stroke = null, tail = false } = {}) {
    const cvs = document.createElement('canvas'); cvs.width = TW; cvs.height = TH;
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false }));
    const draw = (txt) => {
      mctx.font = `900 88px ${FONT}`; const cw = Math.min(1700, Math.max(300, Math.ceil(mctx.measureText(txt).width + 130)));
      cvs.width = cw; cvs.height = TH; tex.dispose();
      const c = cvs.getContext('2d'); c.clearRect(0, 0, cw, TH);
      const bh = tail ? 176 : 200, by = tail ? 6 : 16;
      c.shadowColor = 'rgba(30,20,10,.28)'; c.shadowBlur = 12; c.shadowOffsetY = 5;
      c.fillStyle = '#' + color.getHexString(); rr(c, 10, by, cw - 20, bh - 8, 62); c.fill();
      if (tail) { c.beginPath(); c.moveTo(cw / 2 - 34, by + bh - 12); c.lineTo(cw / 2, TH - 8); c.lineTo(cw / 2 + 34, by + bh - 12); c.closePath(); c.fill(); }
      c.shadowColor = 'transparent';
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 8; rr(c, 10, by, cw - 20, bh - 8, 62); c.stroke(); }
      c.font = `900 88px ${FONT}`; c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, cw / 2, by + (bh - 8) / 2 + 4);
      tex.needsUpdate = true; s.userData.cw = cw;
    };
    s.userData.w = w; s.userData.draw = draw; s.userData.txt = text; s.renderOrder = 10;
    draw(text);
    if (tail) s.center.set(0.5, 0.04);
    s.scale.set(0.01, 0.01, 1); scene.add(s); return s;
  }
  const retext = (s, txt) => { if (s.userData.txt !== txt) { s.userData.txt = txt; s.userData.draw(txt); } };
  let bk = 1.3, pw = 0;   // pw: 세로 화면 정도(0~1)
  const bkOf = (s) => Math.min(bk, 46 / s.userData.w);   // 긴 말풍선은 폭 46cm까지만 키움   // 말풍선 배율: 세로 화면일수록 크게
  function tagAnim(s, t, show, hide = 1e9) {   // show 시각에 튀어나오고 hide 시각에 사라짐
    const k = Math.max(0.01, back(fade(t, show, show + 0.4)));
    s.material.opacity = Math.min(1, fade(t, show, show + 0.2)) * (1 - fade(t, hide, hide + 0.35));
    const u = s.userData.w * bkOf(s) / TW; s.scale.set(u * s.userData.cw * k, u * TH * k, 1);
  }
  const speak = (text, w) => tagSprite(text, WHITE, w, { ink: '#1a2030', stroke: '#d6c9b3', tail: true });
  const bSearch = speak('약이 어디 있더라…', 34); bSearch.position.set(SOFA.x - 3, GH, SOFA.z - 4);
  const bAsk = speak('로보독, 약 좀 가져다줘!', 34); bAsk.position.set(SOFA.x - 6, GH, SOFA.z - 4);
  const bThanks = speak('고맙다, 로보독!', 34); bThanks.position.set(SOFA.x - 3, GH, SOFA.z - 4);
  const tFail = tagSprite('이게 뭐죠? 몰라요', new THREE.Color('#ffd54a'), 21, { tail: true, ink: '#3a2a00' }); tFail.position.set(DOG0.x, 17, DOG0.y);
  const tPhotos = tagSprite('약통 사진 모으기', accent, 20); tPhotos.position.set(CARD.x - 1, 26, CARD.z);
  const tCount = tagSprite('사진 0장', accent, 20); tCount.position.set(BRAIN.x, 29.5, BRAIN.z);
  const tOk = tagSprite('약통! 찾았다', GREEN, 21, { tail: true }); tOk.position.set(CARD.x, 20.5, CARD.z);
  const t3 = tagSprite('약통 = 3', accent, 21); t3.position.set(MB.x, 14.5, MB.z);
  const tArrive = tagSprite('여기예요!', GREEN, 24, { tail: true }); tArrive.position.set(DOG1.x, 19, DOG1.y);
  // 말풍선이 차지하는 자리(카메라 상자에 넣기 위함)
  const tagItem = (s) => { const u = s.userData.w * bkOf(s) / TW, w = u * s.userData.cw, h = u * TH; return [s.position.x, s.position.y + h * (0.5 - s.center.y), s.position.z, w / 2, h / 2, 1]; };

  // ---------- 약통 그림(카드·사진에 쓰는 아이콘) ----------
  const drawPill = (c, cx, cy, s) => {
    c.fillStyle = '#e8821e'; rr(c, cx - 38 * s, cy - 40 * s, 76 * s, 92 * s, 12 * s); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(cx - 38 * s, cy - 6 * s, 76 * s, 44 * s);
    c.fillStyle = '#f4f4f4'; rr(c, cx - 42 * s, cy - 62 * s, 84 * s, 26 * s, 8 * s); c.fill();
    c.fillStyle = '#d63838'; c.fillRect(cx - 4 * s, cy + 2 * s, 8 * s, 30 * s); c.fillRect(cx - 15 * s, cy + 13 * s, 30 * s, 8 * s);
  };
  // 약통 카드(AI에게 보여 주는 사진)
  const cardTex = canvasTex(256, 352, (c) => {
    c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 352, 28); c.fill();
    c.strokeStyle = '#dbe1ee'; c.lineWidth = 8; rr(c, 4, 4, 248, 344, 26); c.stroke();
    drawPill(c, 128, 160, 1.45); c.fillStyle = '#dbe1ee'; rr(c, 64, 290, 128, 22, 11); c.fill();
  });
  const cardGrp = new THREE.Group(); cardGrp.position.set(CARD.x, 0, CARD.z); scene.add(cardGrp);
  const cardPivot = new THREE.Group(); cardGrp.add(cardPivot);
  const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 12.4), new THREE.MeshBasicMaterial({ map: cardTex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
  cardMesh.position.y = 7.6; cardMesh.rotation.y = Math.PI; cardMesh.castShadow = true; cardPivot.add(cardMesh);
  mk(rbox(6, 1.2, 3.4, 0.5), mat(0x8a96a8, 0.5), cardPivot, 0, 0.6, 0.9);
  const finder = new THREE.Group(); finder.position.set(0, 7.6, -0.3); finder.rotation.y = Math.PI; cardPivot.add(finder);
  const fmat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 });
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), fmat); h.position.set(sx * 4.5, sy * 7.2, 0);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.6), fmat); v.position.set(sx * 5.8, sy * 5.9, 0); finder.add(h, v);
  });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 0.3), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 }));
  scan.rotation.y = Math.PI; cardPivot.add(scan);
  cardPivot.scale.set(1, 0.001, 1);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff })); flash.scale.set(14, 14, 1); flash.position.set(CARD.x, 8, CARD.z - 1); scene.add(flash);
  const tmpShadows = [blob(CARD.x, CARD.z + 1, 12, 8, 0.8)];

  // ---------- AI 뇌: 사진이 날아 들어가면 빛나며 배움 ----------
  const brain = new THREE.Group(); brain.position.copy(BRAIN); scene.add(brain);
  const bgeo = new THREE.SphereGeometry(4.4, 72, 54); {
    const p = bgeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      const bump = Math.sin(n.x * 7 + n.y * 3) * Math.sin(n.y * 6 + n.z * 4) * 0.28 + Math.sin(n.z * 9 - n.x * 5) * 0.12;
      const groove = Math.exp(-Math.pow(n.x * 5, 2)) * 0.35; v.copy(n).multiplyScalar(4.4 + bump - groove * (n.y > -0.3 ? 1 : 0.2)); v.x *= 1.18; v.z *= 0.92; p.setXYZ(i, v.x, v.y, v.z); }
    bgeo.computeVertexNormals();
  }
  const brainMat = new THREE.MeshStandardMaterial({ color: 0xf2a4bd, roughness: 0.45, emissive: 0xff5d93, emissiveIntensity: 0.12 });
  const brainMesh = mk(bgeo, brainMat, brain, 0, 0, 0); brainMesh.castShadow = true;
  const nodes = [0, 1, 2, 3, 4, 5].map((i) => mk(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0x9ec5ff }), brain, 0, 0, 0, false));
  const brainRing = mk(new THREE.TorusGeometry(7.4, 0.12, 8, 56), new THREE.MeshBasicMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.55 }), brain, 0, 0, 0, false); brainRing.rotation.x = Math.PI / 2.2;
  const bar = new THREE.Group(); bar.position.set(BRAIN.x, BRAIN.y - 8.2, BRAIN.z); scene.add(bar);
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthTest: false })); barBg.renderOrder = 8; bar.add(barBg);
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.0), new THREE.MeshBasicMaterial({ color: accent, transparent: true, depthTest: false })); barFill.renderOrder = 9; barFill.position.z = 0.01; bar.add(barFill);
  const brainSprite = [brain, bar]; brainSprite.forEach(o => { o.visible = false; });

  // ---------- 사진: 카드 → 사진 더미 → AI 뇌로 날아감 ----------
  const PHOTOS = 9;
  const photoTop = canvasTex(256, 320, (c) => {
    c.fillStyle = '#ffffff'; rr(c, 0, 0, 256, 320, 20); c.fill(); drawPill(c, 128, 142, 1.25); c.fillStyle = '#dbe1ee'; rr(c, 60, 262, 136, 20, 10); c.fill();
  });
  const photos = Array.from({ length: PHOTOS }, (_, i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(5.6, 0.34, 7.2, 2, 0.12), [0, 0, 1, 0, 0, 0].map((top) => top ? new THREE.MeshBasicMaterial({ map: photoTop, transparent: true, alphaTest: 0.5 }) : mat(0xffffff)));
    m.rotation.y = Math.sin(i * 2.3) * 0.35; m.castShadow = true; m.visible = false; scene.add(m); return m;
  });
  const photoA = (i) => 12.5 + i * 0.3, photoB = (i) => 15.3 + i * 0.28;   // 카드에서 나오는 때 / 뇌로 날아가는 때
  const stackPos = (i) => V(STACK.x + Math.sin(i * 1.9) * 0.5, 0.35 + i * 0.36, STACK.z);
  tmpShadows.push(blob(STACK.x, STACK.z, 10, 10, 0.8));

  // ---------- 마이크로비트 + 전파 ----------
  const DIGITS = { 3: ['###..', '...#.', '..#..', '...#.', '###..'], 0: ['.....', '.....', '.....', '.....', '.....'] };
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
  const mbBoard = mk(new RoundedBoxGeometry(6.6, 5.4, 0.5, 2, 0.35), [0, 0, 0, 0, 0, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: mbTex }) : mat(0x1d2330, 0.5)), mbGrp, 0, 0, 0);
  mbBoard.position.z = 0;
  mk(rbox(6.2, 1.1, 3.4, 0.4), mat(0x8a96a8, 0.5), mbGrp, 0, -3.3, 0.7);
  mbGrp.scale.setScalar(0.001);
  tmpShadows.push(blob(MB.x, MB.z + 0.5, 9, 6, 0.8));
  const ringMat = () => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  const rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), ringMat()); m.visible = false; m.renderOrder = 6; scene.add(m); return m; });
  const packet = tagSprite('3', accent, 13);
  const zzz = [0, 1, 2].map((i) => {
    const tex = canvasTex(104, 104, (c) => { c.fillStyle = '#7a86a3'; c.font = `900 84px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', 52, 56); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false })); s.scale.set(2.8 + i * 0.8, 2.8 + i * 0.8, 1); s.renderOrder = 10; scene.add(s); return s;
  });
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { c.fillStyle = '#ff5a7a'; c.font = '100px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♥', 64, 70); }), transparent: true, opacity: 0, depthTest: false })); heart.scale.set(3.4, 3.4, 1); heart.renderOrder = 10; scene.add(heart);
  const dogShadow = blob(DOG0.x, DOG0.y, 24, 18, 1);

  // 모든 표준 재질에 방 조명 반영(너무 번쩍이지 않게)
  const finishMats = () => scene.traverse((o) => { if (o.material) [].concat(o.material).forEach(m => { if (m.isMeshStandardMaterial) m.envMapIntensity = 0.5; else if ((m.isMeshBasicMaterial || m.isSpriteMaterial) && m.toneMapped) { m.toneMapped = false; m.needsUpdate = true; } }); });

  // ---------- 로보독 시간표(로봇 상태가 바뀌는 것만) ----------
  const events = [
    [0.0, () => { api.legBend(0, 0); api.headLedExp(2); api.bodyLed(0, 0, 0); }],              // 웅크리고 눈 감음
    [4.4, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(40, 220, 120); }],         // 부탁 소리에 눈을 뜸
    [7.2, () => api.rotation(1, 140, 100)],                                                    // 우리를 보고 돌아섬(정면)                                                    // 우리를 보고 돌아섬
    [8.7, () => api.headLedPrint(2, '?')],                                                     // ? 표정
    [12.2, () => api.headLedExp(6)],                                                           // 두리번(배우는 중)
    [18.9, () => api.headLedExp(0)],                                                           // 알아봤다! 초롱초롱
    [20.4, () => api.headLedExp(1)],                                                           // 하트 눈
    [24.0, () => api.headLedExp(0)],
    [26.9, () => api.rotation(0, 84, 100)],                                                    // 신호를 받고 탁자 쪽으로 돌아섬
    [27.9, () => api.move(0, 72)],
    [31.5, () => { api.stop(); api.rotation(1, 84, 100); api.headLedExp(13); api.bodyLed(255, 190, 60); }],   // 탁자 앞에서 멈추고 우리 쪽을 봄
    [32.5, () => { api.headLedExp(3); api.bodyLed(40, 220, 120); }],
    [32.7, () => api.legBend(1, 15)], [33.05, () => api.legBend(1, 70)],
    [33.4, () => api.legBend(1, 15)], [33.75, () => api.legBend(1, 70)],
  ].sort((a, b) => a[0] - b[0]);
  // 효과음 신호(소리를 켰을 때만 들림, 앞으로 재생될 때만)
  const cues = [[0.9, 'pop'], [3.9, 'pop'], [4.4, 'wake'], [8.7, 'question'], [12.4, 'shutter'], [15.3, 'whoosh'], [18.9, 'ding'], [24.6, 'radio'], [25.5, 'radio'], [27.0, 'wake'], [32.0, 'pop'], [32.4, 'tada'], [32.8, 'bark']];
  for (let i = 1; i < PHOTOS; i++) cues.push([photoA(i), 'shutter']);
  for (let i = 0; i < PHOTOS; i++) cues.push([photoB(i) + 0.7, 'tick']);
  cues.sort((a, b) => a[0] - b[0]);

  // ---------- 카메라: 장면마다 '꼭 보여야 할 덩어리'를 정하고, 화면 비율에 맞춰 거리를 계산 ----------
  const dogItem = (x, z) => [x, 6.5, z, 10, 7.5, 10];
  const grandItem = () => [SOFA.x, 22, SOFA.z - 1, lerp(24, 31.5, pw), 22, 14];
  const sofaB = (s) => tagItem(s);
  const cardItem = [CARD.x, 7.5, CARD.z, 6, 8, 3], stackItem = [STACK.x, 3, STACK.z, 5, 4, 5], brainItem = [BRAIN.x, 17, BRAIN.z, 7.6, 11, 7.6];
  const tableItem = [TABLE.x, 11, TABLE.z, 14, 12, 10];
  const gMid = () => [SOFA.x, 26, SOFA.z - 4, lerp(15, 6, pw), 20, 12];   // 세로 화면에서는 머리·어깨 폭만(소파 가장자리는 잘려도 됨)
  const gHead = [SOFA.x, 26, SOFA.z - 4, 6, 20, 12];   // 할아버지 머리~무릎(소파는 잘려도 됨, 할아버지는 통째로)
  const dogAt = () => [robot.x, 6.5, robot.y, 10, 7.5, 10];
  const walkBox = () => {   // 로보독을 따라가며, 거의 다 가면 탁자·약통이 통째로 들어옴
    const q = Math.min(1, Math.max(0, (robot.x - DOG0.x) / (DOG1.x - DOG0.x))), lo = robot.x - 11;
    const hi = lerp(robot.x + 24, TABLE.x + 15, ease(fade(q, 0.3, 0.85)));
    return U([(lo + hi) / 2, 9, lerp(robot.y, TABLE.z, 0.5), (hi - lo) / 2, 10, 14], gHead);
  };
  const finalA = () => U(dogItem(DOG1.x, DOG1.y), tableItem, [TABLE.x, 30, TABLE.z, 4, 5, 4], tagItem(tArrive));
  const finalB = () => U(dogItem(DOG1.x, DOG1.y), tableItem, [TABLE.x, 30, TABLE.z, 4, 5, 4], tagItem(tArrive), grandItem(), sofaB(bThanks));
  // box: p(0~1, 장면 안 진행도)를 받아 상자 / az: 방위각(°) [처음, 끝], azP: 세로 화면일 때 / el: 올려다보는 각 / dolly: 거리 배율 [처음, 끝]
  const CAM = [
    { box: () => U(grandItem(), sofaB(bSearch), dogItem(DOG0.x, DOG0.y)), az: [-30, -20], azP: [-26, -16], el: [10, 9], dolly: () => [lerp(0.97, 1.02, pw), lerp(0.95, 0.94, pw)] },
    { box: () => U(grandItem(), sofaB(bAsk), dogItem(DOG0.x, DOG0.y)), az: [-38, -30], azP: [-20, -14], el: [12, 11], dolly: () => [lerp(1.0, 1.05, pw), lerp(0.95, 0.95, pw)] },
    { box: () => U(dogItem(DOG0.x, DOG0.y), cardItem, tagItem(tFail), gMid()), az: [-22, -10], azP: [-10, 0], el: [11, 10], dolly: [1.12, 0.96] },
    { box: () => U(cardItem, stackItem, brainItem, tagItem(tCount), tagItem(tPhotos), gMid(), dogItem(DOG0.x, DOG0.y)), az: [14, 4], azP: [10, 4], el: [12, 11], dolly: [1.1, 0.96] },
    { box: () => U(cardItem, brainItem, dogItem(DOG0.x, DOG0.y), tagItem(tOk), tagItem(tCount), gMid()), az: [-6, -16], azP: [-2, -8], el: [14, 13], dolly: [1.1, 0.98] },
    { box: () => U([MB.x, 8, MB.z, 5, 7, 3], dogItem(DOG0.x, DOG0.y), tagItem(t3), gMid()), az: [-18, -26], azP: [-10, -16], el: [12, 11], dolly: [1.1, 0.97] },
    { box: () => walkBox(), az: [8, -10], azP: [4, -6], el: [13, 12], dolly: [1.06, 0.97] },
    { box: (p) => mixBox(finalA(), finalB(), ease(fade(p, 0.3, 0.8))), az: [-24, -14], azP: [-10, 0], el: [12, 14], dolly: [1.02, 1.0] },
  ];
  const sceneAt = (t) => { let c = 0; while (c + 1 < SCENES.length && t >= SCENES[c + 1].t) c++; return c; };
  const sceneEnd = (i) => (i + 1 < SCENES.length ? SCENES[i + 1].t : END);
  const dir = new THREE.Vector3(), rgt = new THREE.Vector3(), upv = new THREE.Vector3(), fwd = new THREE.Vector3(), cen = new THREE.Vector3(), o3 = new THREE.Vector3();
  let insets = { top: 0.1, bottom: 0.2 }, insTarget = { top: 0.1, bottom: 0.2 };
  function poseScene(i, p, asp, outPos, outTgt) {
    const d = CAM[i], w = Math.min(1, Math.max(0, (1.15 - asp) / 0.55));
    const k = ease(p), box = d.box(p);
    const az = lerp(lerp(d.az[0], d.az[1], k), lerp(d.azP[0], d.azP[1], k), w) * Math.PI / 180, el = lerp(d.el[0], d.el[1], k) * Math.PI / 180;
    cen.copy(box.mn).add(box.mx).multiplyScalar(0.5);
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    fwd.copy(dir).negate(); rgt.set(0, 1, 0).cross(dir).normalize(); upv.copy(dir).cross(rgt).normalize();   // 눈높이(수평선 기울지 않음)
    const tv = Math.tan(camera.fov * Math.PI / 360) * (1 - insets.top - insets.bottom) * 0.93, th = Math.tan(camera.fov * Math.PI / 360) * asp * lerp(0.93, 0.87, w);   // 세로 화면은 양옆 여백을 더 둠
    let need = 8;
    for (let c = 0; c < 8; c++) {
      o3.set(c & 1 ? box.mx.x : box.mn.x, c & 2 ? box.mx.y : box.mn.y, c & 4 ? box.mx.z : box.mn.z).sub(cen);
      const zc = o3.dot(dir); need = Math.max(need, zc + Math.abs(o3.dot(rgt)) / th, zc + Math.abs(o3.dot(upv)) / tv);
    }
    const dl = typeof d.dolly === 'function' ? d.dolly() : d.dolly, dist = need * lerp(dl[0], dl[1], k);
    outPos.copy(cen).addScaledVector(dir, dist); outTgt.copy(cen);
  }
  const pa = V(0, 0, 0), ta = V(0, 0, 0), pb = V(0, 0, 0), tb = V(0, 0, 0);
  function camAt(t, asp, pos, tgt) {
    const i = sceneAt(t), p = (t - SCENES[i].t) / (sceneEnd(i) - SCENES[i].t);
    poseScene(i, Math.min(1, Math.max(0, p)), asp, pos, tgt);
    if (i > 0) {   // 장면이 바뀔 때: 앞 장면의 마지막 구도에서 부드럽게 넘어옴
      const w = 1 - ease(fade(t - SCENES[i].t, 0, 1.0));
      if (w > 0) { poseScene(i - 1, 1, asp, pa, ta); pos.lerp(pa, w); tgt.lerp(ta, w); }
    }
  }
  const dayAt = (t) => t < 7 ? 0.55 : t < 9 ? 0.55 + 0.25 * ease(fade(t, 7, 9)) : t < 24 ? 0.8 : 0.8 + 0.2 * ease(fade(t, 24, 26));

  // ---------- 시간 진행(결정적) ----------
  let t = 0, ev = 0, cu = 0, sceneIdx = -1, ended = false, raf = 0, last = 0, running = false, playing = false, cuesOn = false;
  const camPos = V(0, 0, 0), camTgt = V(0, 0, 0), head3 = V(0, 0, 0), tmp = V(0, 0, 0), tmp2 = V(0, 0, 0);
  let dogHead = null;
  const findHead = () => { const P = view.parts.get(robot); if (P && !dogHead) dogHead = P.body.children.find(c => c.isGroup && Math.abs(c.position.y - HEAD.up) < 1e-6 && Math.abs(c.position.z + HEAD.fwd) < 1e-6) || null; return P; };
  function reset() { robot.reset(); mbDigit = 0; drawMb(); ev = 0; cu = 0; t = 0; sceneIdx = -1; }
  function step(dt) {
    t += dt;
    while (ev < events.length && t >= events[ev][0]) events[ev++][1]();
    while (cu < cues.length && t >= cues[cu][0]) { if (cuesOn) audio.sfx(cues[cu][1]); cu++; }
    robot.step(dt);
    if (t >= 24.5 && mbDigit !== 3) { mbDigit = 3; drawMb(); }
    const c = sceneAt(t);
    if (c !== sceneIdx) { sceneIdx = c; onScene(c, SCENES[c]); if (cuesOn) audio.speak(SCENES[c].text); }
    if (!ended && t >= END - 1e-6) { ended = true; onEnd(); }
  }
  function advance(dt) { let left = dt; while (left > 1e-6) { const s = Math.min(1 / 30, left); step(s); left -= s; } }
  function seek(x, { silent = true, snap = true } = {}) {
    x = Math.min(END, Math.max(0, x));
    const wasEnded = ended;
    if (x < t - 1e-6) { reset(); ended = false; }
    if (ended && x < END) ended = false;
    const prevCues = cuesOn; cuesOn = !silent && prevCues;
    advance(x - t); cuesOn = prevCues;
    if (wasEnded && !ended) onLeaveEnd();
    if (snap) { insets.top = insTarget.top; insets.bottom = insTarget.bottom; }
    render(0.016, true); onTick(t);
  }
  function goScene(i, opts = {}) {
    i = Math.min(SCENES.length - 1, Math.max(0, i));
    seek(opts.still ? SCENES[i].rep : SCENES[i].t + 0.001, { silent: false });
    cuesOn = true;
  }
  const curScene = () => Math.max(0, sceneIdx);
  const next = () => { if (curScene() >= SCENES.length - 1) { seek(END); return; } goScene(curScene() + 1, { still }); };
  const prev = () => goScene(Math.max(0, curScene() - 1), { still });

  function tilt(tt) { // 갸웃: 머리를 한쪽으로 기울였다 돌아옴
    const a = ease(fade(tt, 8.7, 9.2)) * (1 - ease(fade(tt, 11.0, 11.6)));
    const b = Math.sin(fade(tt, 8.7, 11.4) * Math.PI * 2) * 0.12;
    return a * 0.42 + b * a;
  }
  function render(dt, force = false) {
    const day = dayAt(t);
    { const a0 = (host.clientWidth || 1) / (host.clientHeight || 1); pw = Math.min(1, Math.max(0, (1.15 - a0) / 0.55)); bk = 1.25 + 0.6 * pw; }
    const gone = 1 - ease(fade(t, 24.1, 24.8)), goneOn = gone > 0.01;   // 마이크로비트 장면이 끝나면 카드·AI 뇌는 치움
    cardGrp.visible = goneOn; cardGrp.scale.setScalar(Math.max(0.001, gone)); tmpShadows.forEach(m => { m.visible = goneOn; });
    scene.background.copy(night).lerp(bg, day);
    lights.forEach((l, i) => { l.intensity = baseI[i] * (0.45 + 0.55 * day); });
    shade.material.emissiveIntensity = 1.3 - 0.6 * day;
    // 할아버지: 처음엔 두리번+주머니 뒤짐, 부탁할 때 손을 흔들고, 끝에 활짝 웃음
    const searching = t < 3.5, smiling = t > 31.8;
    head.rotation.y = searching ? Math.sin(t * 2.1) * 0.6 : lerp(0, 0.5, ease(fade(t, 3.5, 4.1))) + (smiling ? Math.sin((t - 31.8) * 6) * 0.04 : 0);
    head.rotation.x = smiling ? Math.sin((t - 32.2) * 7) * 0.1 * fade(t, 32.2, 32.5) * (1 - fade(t, 34, 34.6)) : (searching ? 0.05 : 0);
    body.scale.y = 1 + Math.sin(t * 2.0) * 0.012; body.rotation.z = searching ? Math.sin(t * 2.1 + 1) * 0.05 : 0;
    const wave = t > 4.1 && t < 7 ? ease(fade(t, 4.1, 4.6)) * (1 - ease(fade(t, 6.5, 7))) : (smiling ? ease(fade(t, 32, 32.6)) : 0);
    const pat = searching ? Math.sin(t * 6) * 0.25 : 0;
    armPivot[0].rotation.set(lerp(0.7 + pat, 2.5, wave), 0, wave * (0.3 + Math.sin(t * 9) * 0.35));
    armPivot[1].rotation.set(0.7 - pat, 0, 0);
    mouthFlat.visible = searching && Math.sin(t * 1.3) < 0.2; mouthO.visible = !mouthFlat.visible && !smiling && (searching || (t > 3.5 && t < 7)); mouthSmile.visible = !mouthFlat.visible && !mouthO.visible;
    if (t > 7 && !smiling) { mouthSmile.visible = true; mouthFlat.visible = false; mouthO.visible = false; }
    cheeks.forEach(c => { c.material.opacity = 0.7 * (smiling ? fade(t, 31.9, 32.5) : 0); });
    eyes.forEach(e => e.scale.y = smiling ? lerp(1, 0.25, fade(t, 31.9, 32.3)) : (Math.sin(t * 0.9) > 0.97 ? 0.2 : 1));
    tagAnim(bSearch, t, 0.8, 3.3); tagAnim(bAsk, t, 4.0, 7.0); tagAnim(bThanks, t, 32.9);
    // 약통: 도착하면 은은히 빛나고 화살표가 통통
    const arr = fade(t, 31.7, 32.3);
    pillGlow.material.opacity = 0.85 * arr * (0.8 + 0.2 * Math.sin(t * 5)); pillGlow.scale.setScalar(14 + Math.sin(t * 5) * 1.5);
    arrow.visible = arr > 0; arrow.position.set(TABLE.x, 21 + Math.abs(Math.sin(t * 5)) * 1.8, TABLE.z); arrow.scale.setScalar(Math.max(0.01, back(arr)));
    // 카드: 처음엔 낯선 사진, 가운데 스캔선
    const cp = fade(t, 8.2, 8.7); cardPivot.scale.y = t < 8.2 ? 0.001 : Math.max(0.001, back(cp));
    const ff = fade(t, 8.6, 9.6); fmat.opacity = ff * (t > 19 ? 0.4 : 1); finder.scale.setScalar(1.7 - 0.7 * ease(ff));
    let sc = 0; for (const a of [9.4, 13.2, 19.0]) { const s = fade(t, a, a + 1.0); if (s > 0 && s < 1) { sc = s; break; } }
    scan.material.opacity = sc > 0 ? 0.9 : 0; scan.position.set(0, 13.4 - 11.6 * sc, -0.35);
    tPhotos.position.y = 28 + 14 * pw;   // 세로 화면에서는 말풍선이 커져서 위로 올려 겹치지 않게
    tagAnim(tFail, t, 9.9, 12.0); tagAnim(tPhotos, t, 12.4, 18.4); tagAnim(tOk, t, 19.2, 24.0); tagAnim(t3, t, 24.9, 27.6);
    // 사진
    let fl = 0, arrived = 0;
    photos.forEach((m, i) => {
      const a = photoA(i), b = photoB(i), p1 = fade(t, a, a + 0.45), p2 = fade(t, b, b + 0.7);
      if (t >= b + 0.7) arrived++;
      if (t >= a) fl = Math.max(fl, Math.exp(-(t - a) * 9));
      m.visible = t >= a && t < b + 0.7; m.scale.setScalar(1);
      if (t < b) { const sp = stackPos(i); tmp.set(CARD.x, 12, CARD.z - 1).lerp(sp, ease(p1)); tmp.y += Math.sin(p1 * Math.PI) * 7; m.position.copy(tmp); m.rotation.x = (1 - p1) * 0.9; }
      else { const sp = stackPos(i), e = ease(p2); tmp.copy(sp).lerp(BRAIN, e); tmp.y += Math.sin(p2 * Math.PI) * 7; m.position.copy(tmp); m.rotation.x = e * 1.2; m.scale.setScalar(1 - 0.75 * e); }
    });
    flash.material.opacity = fl * 0.9 * (t < 18 ? 1 : 0);
    // AI 뇌
    const show = fade(t, 12.0, 12.6), learned = fade(t, 18.9, 19.5);
    brain.visible = bar.visible = show > 0 && goneOn; brain.scale.setScalar(Math.max(0.01, back(show)) * (1 + learned * 0.08) * gone);
    let pulse = 0; for (let i = 0; i < PHOTOS; i++) { const d = t - (photoB(i) + 0.7); if (d > 0) pulse = Math.max(pulse, Math.exp(-d * 7)); }
    brain.position.y = BRAIN.y + Math.sin(t * 2.2) * 0.35; brain.rotation.y = Math.sin(t * 0.7) * 0.25;
    brainMat.emissiveIntensity = 0.12 + pulse * 0.9 + learned * 0.5; brainMat.emissive.set(0xff5d93).lerp(new THREE.Color(0x35e07f), learned); brainMat.color.set(0xf2a4bd).lerp(new THREE.Color(0xa9f0c4), learned);
    brain.scale.multiplyScalar(1 + pulse * 0.07);
    nodes.forEach((n, i) => { const a = t * 1.3 + i * Math.PI / 3; n.position.set(Math.cos(a) * 7.4, Math.sin(a * 1.6 + i) * 3, Math.sin(a) * 7.4 * 0.45); n.material.color.set(0x9ec5ff).lerp(new THREE.Color(0x7dffb0), learned); });
    brainRing.material.color.set(0x9ec5ff).lerp(new THREE.Color(0x7dffb0), learned); brainRing.rotation.z = t * 0.6;
    bar.quaternion.copy(camera.quaternion); const fillK = Math.max(0.001, arrived / PHOTOS); barFill.scale.x = fillK; barFill.position.x = -5.2 * (1 - fillK);
    barFill.material.color.copy(accent).lerp(GREEN, learned);
    retext(tCount, t > 18.9 ? '배움 끝!' : `사진 ${Math.min(PHOTOS, Math.max(0, Math.floor((t - 12.5) / 0.3) + 1))}장`);
    tagAnim(tCount, t, 13.0, 24.0); tCount.position.set(BRAIN.x, BRAIN.y + 12.5, BRAIN.z);
    // 마이크로비트와 전파
    mbGrp.scale.setScalar(Math.max(0.001, back(fade(t, 24.2, 24.8)) * (1 - ease(fade(t, 27.4, 28.0)))));
    head3.set(robot.x, 8, robot.y);
    rings.forEach((m, i) => {
      const p = ((t - 24.9 - i * 0.28) / 1.3); m.visible = p > 0 && p < 1 && t < 27.6 && (t < 26.6);
      m.position.copy(MB); m.position.y += 1; m.scale.setScalar(2 + p * 9); m.material.opacity = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI) * 0.8; m.quaternion.copy(camera.quaternion);
    });
    const pk = fade(t, 25.4, 26.9);
    packet.visible = pk > 0 && pk < 1; tmp.copy(MB).lerp(head3, ease(pk)); tmp.y += 4 + Math.sin(pk * Math.PI) * 9; packet.position.copy(tmp);
    packet.material.opacity = Math.sin(Math.min(1, pk) * Math.PI) * 1.4; packet.scale.set(packet.userData.w / TW * packet.userData.cw, packet.userData.w / TW * TH, 1);
    // 로보독: 숨쉬기·갸웃·표정
    const P = findHead();
    if (P) {
      const walking = robot.isWalking();
      P.body.scale.y = 1 + (walking ? 0 : Math.sin(t * 2.3) * 0.016);
      if (dogHead) {
        dogHead.rotation.z = tilt(t);
        dogHead.rotation.y = t > 12.2 && t < 18.8 ? Math.sin((t - 12.2) * 2.2) * 0.45 : 0;
      }
    }
    dogShadow.position.set(robot.x, 0.12, robot.y); dogShadow.rotation.z = -robot.heading * Math.PI / 180;
    zzz.forEach((s, i) => { const p = ((t * 0.55 + i / 3) % 1), on = 1 - fade(t, 4.2, 4.8); s.position.set(robot.x + 3 + p * 4, 9 + p * 8, robot.y - 2); s.material.opacity = on * Math.sin(p * Math.PI) * 0.95; });
    const hp = Math.sin(fade(t, 20.4, 22.6) * Math.PI);
    heart.material.opacity = hp > 0 ? hp : 0; heart.position.set(robot.x, 16 + fade(t, 20.4, 22.6) * 3, robot.y - 1);
    tagAnim(tArrive, t, 31.9, 34.6);
    // 카메라
    const W = host.clientWidth || 1, H = host.clientHeight || 1, asp = W / H;
    if (Math.abs(camera.aspect - asp) > 1e-4) { camera.aspect = asp; }
    const ea = force ? 1 : 1 - Math.exp(-dt * 4);
    insets.top += (insTarget.top - insets.top) * ea; insets.bottom += (insTarget.bottom - insets.bottom) * ea;
    camAt(t, asp, camPos, camTgt);
    const shiftY = (insets.bottom - insets.top) / 2;
    if (Math.abs(shiftY) > 1e-3) camera.setViewOffset(W, H, 0, shiftY * H, W, H); else { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
    camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(camTgt);
    view.controls.target.copy(camTgt);
    view.draw(robot.headFrame());
  }

  // ---------- 화질 자동 조절: 프레임이 느리면 해상도와 그림자를 낮춤 ----------
  const LEVELS = [{ pr: Math.min(DPR, MOBILE ? 1.75 : 2), sh: true }, { pr: Math.min(DPR, 1.25), sh: true }, { pr: 1, sh: false }, { pr: 0.75, sh: false }];
  let lastEndDraw = 0, level = 0, locked = !adaptive, ftSum = 0, ftN = 0, warm = 0;
  function setQuality(l, lock = true) {
    level = Math.min(LEVELS.length - 1, Math.max(0, l)); if (lock) locked = true;
    const q = LEVELS[level]; renderer.setPixelRatio(q.pr); view.resize();
    sun.castShadow = q.sh; renderer.shadowMap.enabled = q.sh; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  setQuality(0, false);
  if (adaptive) {   // 소프트웨어 그래픽(SwiftShader·llvmpipe 등)이면 처음부터 낮은 화질로
    try { const gl = renderer.getContext(), ex = gl.getExtension('WEBGL_debug_renderer_info'), nm = String(ex ? gl.getParameter(ex.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(nm)) setQuality(2, false); } catch (e) {}
  }
  function sample(real) {
    if (locked || level >= LEVELS.length - 1) return;
    if (warm++ < 12) return;
    ftSum += real; ftN++;
    if (ftN >= 24) { const avg = ftSum / ftN; ftSum = 0; ftN = 0; if (avg > 0.036) { setQuality(level + 1, false); warm = 6; } }
  }
  function frame(now) {
    const real = Math.min(2.5, Math.max(0, (now - last) / 1000)); last = now;   // 실제 흐른 시간(느린 기기는 건너뛰어 따라잡음)
    if (ended && now - lastEndDraw < 90) { if (running) raf = requestAnimationFrame(frame); return; }   // 끝 화면은 가볍게(초당 약 11장)
    if (ended) lastEndDraw = now;
    if (!document.hidden) {
      if (playing && !ended) { advance(Math.min(real, END - t)); }
      render(Math.min(0.05, real)); onTick(t);
      if (playing && !ended) sample(real);
    }
    if (running) raf = requestAnimationFrame(frame);
  }
  function loop() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function play() { if (still) return; if (ended) { replay(); return; } playing = true; cuesOn = true; audio.resume(); loop(); }
  function pause() { playing = false; audio.pause(); audio.stopSpeak(); if (running) { running = false; cancelAnimationFrame(raf); render(0.016); } }
  function replay() { seek(0, { silent: true }); cuesOn = true; if (!still) { playing = true; audio.resume(); loop(); } }
  function finish() { seek(END); }
  function firstFrame() {   // 처음 화면을 실제로 그리고, 화면에 나온 뒤에 알려 줌(그 전에는 시간이 흐르지 않음)
    seek(still ? SCENES[0].rep : 0, { silent: true }); findHead(); finishMats();
    const t0 = performance.now(); render(0.016, true);
    if (adaptive && !locked && level < 2 && performance.now() - t0 > 250) setQuality(2, false);   // 첫 장면부터 너무 느리면 바로 낮춤
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  }
  function frameInfo() {   // 시험용: 지금 장면의 '꼭 보여야 할 상자' 모서리가 화면(자막·카드 자리 제외) 안에 얼마나 들어오는지(1이면 가장자리)
    const i = sceneAt(t), p = Math.min(1, Math.max(0, (t - SCENES[i].t) / (sceneEnd(i) - SCENES[i].t))), b = CAM[i].box(p);
    camera.updateMatrixWorld(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; const v = V(0, 0, 0);
    for (let c = 0; c < 8; c++) { v.set(c & 1 ? b.mx.x : b.mn.x, c & 2 ? b.mx.y : b.mn.y, c & 4 ? b.mx.z : b.mn.z).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return { x0, x1, y0, y1, top: insets.top, bottom: insets.bottom, scene: i };
  }
  function setInsets(top, bottom) { insTarget = { top: Math.max(0, Math.min(0.4, top)), bottom: Math.max(0, Math.min(0.6, bottom)) }; if (!running) { insets = { ...insTarget }; render(0.016, true); } }
  new ResizeObserver(() => { if (!running) render(0.016, true); }).observe(host);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  return {
    frameInfo, replay, finish, play, pause, seek, goScene, next, prev, firstFrame, setInsets, setQuality, audio, view, robot,
    get playing() { return playing; },
    setCues(on) { cuesOn = on; },
    state: () => ({ t, scene: sceneIdx, ended, playing, level, cam: camPos.toArray(), dog: [robot.x, robot.y] }),
  };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; else t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
