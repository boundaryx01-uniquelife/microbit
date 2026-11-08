// 3초 영상 시안 5개 (samples.html 용). 한 개의 3D 렌더러로 5개 영상을 번갈아 재생한다.
// 연출 부품: 블룸(UnrealBloom) + 색보정·비네팅·필름 입자·색수차·틸트시프트(직접 만든 후처리), 빛줄기·먼지 입자, 점 구름, 글자 판.
// 로보독 모형·움직임은 시뮬레이터(sim/)와 같은 것을 씀.
import * as THREE from 'three';
import { View3D } from './sim/view3d.js';
import { Robot, World, makeRobodogApi } from './sim/runtime.js';
import { EffectComposer } from './sim/lib/post/postprocessing/EffectComposer.js';
import { RenderPass } from './sim/lib/post/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './sim/lib/post/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './sim/lib/post/postprocessing/ShaderPass.js';
import { OutputPass } from './sim/lib/post/postprocessing/OutputPass.js';
import { BokehPass } from './sim/lib/post/postprocessing/BokehPass.js';

export const DUR = 3;
export const CLIPS = [
  { id: 'cinema', title: '시네마틱 단편', sub: '햇빛 · 먼지 · 블룸', tech: '빛줄기, 먼지 입자, LED 눈 블룸, 비네팅, 필름 입자, 카메라 줌' },
  { id: 'ai-eye', title: 'AI의 눈', sub: '데이터가 모여 인식되는 순간', tech: '점 구름 군집화, 인식 박스, 신호 펄스, 블룸' },
  { id: 'type', title: '키네틱 타이포', sub: '보고 · 전하고 · 움직인다', tech: '글자 판 모션(오버슈트), 셰이더 배경, 색수차 충격' },
  { id: 'diorama', title: '미니어처 마을', sub: '로보독이 일하는 마을', tech: '틸트시프트 흐림, 창문 점등, 천천히 도는 카메라' },
  { id: 'split', title: '코드 ↔ 동작', sub: '블록이 켜지면 로보독이 움직여요', tech: '블록 코드 순차 점등 + 시뮬레이터 실행기 동기화' },
];
// 이야기 샘플 3개(stories.html). len: 영상 길이(초). 장면 시각은 그 길이 그대로 씀
export const STORIES = [
  { id: 'walk', len: 7, title: '로보독의 첫 산책', sub: '실루엣 그림자극', tech: '달빛 역광, 안개로 겹친 언덕, 빛나는 것은 LED 눈과 카드뿐. 상자 속에서 깨어남 → 초록 카드로 산책 → 빨간 카드로 낭떠러지 앞 정지' },
  { id: 'explore', len: 7, title: '로보독 탐험대: 사라진 열쇠', sub: '로보독 눈높이 매크로', tech: '얕은 피사계 심도(초점 이동), 따뜻한 햇빛과 먼지, 책 더미 협곡과 소파 동굴. 두리번 → 탐험 → 열쇠 발견' },
  { id: 'seasons', len: 6, title: '할아버지와 로보독의 사계절', sub: '동화책 툰 · 종이 질감', tech: '셀 음영 + 외곽선, 파스텔 색, 종이 결. 봄 꽃잎 → 여름 → 가을 낙엽 → 겨울 눈, 로보독이 할아버지 곁에서' },
];
export const CODE_STEPS = [   // 5번 영상의 블록 코드(시작 시각)
  { t: 0.0, text: '시작할 때', cls: 'hat' },
  { t: 0.3, text: '로보독 준비 자세', cls: 'act' },
  { t: 0.9, text: '앞으로 걷기 (속도 25)', cls: 'act' },
  { t: 1.9, text: '멈추기', cls: 'act' },
  { t: 2.2, text: '표정 [ILOVEYOU] + 소리 [멍멍]', cls: 'act' },
];

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ease = (x) => x * x * (3 - 2 * x);
const back = (x) => { const c = 1.9; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const fade = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();   // 늘 같은 모양이 나오도록 고정 난수

const GRADE = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.5 }, grain: { value: 0.05 }, aberr: { value: 0.0015 }, tilt: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, res: { value: new THREE.Vector2(1280, 720) }, fade: { value: 1 }, paper: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain, aberr, tilt, fade, paper; uniform vec3 tint; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
    void main(){
      vec2 uv = vUv, d = uv - 0.5; float ab = aberr * length(d);
      vec3 col = vec3(texture2D(tDiffuse, uv + d * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ab).b);
      if (tilt > 0.0) {
        float k = smoothstep(0.06, 0.40, abs(uv.y - 0.52)) * tilt;
        float r = k * 0.0055; vec2 o = vec2(r * res.y / res.x, r); vec3 s = vec3(0.0);
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * o * 1.6).rgb;
        col = mix(col, s / 9.0, clamp(k * 1.4, 0.0, 1.0));
      }
      col *= tint;
      if (paper > 0.0) {   // 종이 결 + 살짝 단계진 색(동화책 느낌)
        vec2 q = uv * res / 3.0; float n = vnoise(q * 0.35) * 0.6 + vnoise(q * 1.9) * 0.4;
        col *= mix(1.0, 0.88 + 0.16 * n, paper); col = mix(col, floor(col * 7.0 + 0.5) / 7.0, paper * 0.3);
      }
      float g = fract(sin(dot(uv * res + time, vec2(12.9898, 78.233))) * 43758.5453); col += (g - 0.5) * grain;
      col *= 1.0 - vignette * smoothstep(0.3, 0.95, length(d) * 1.3);
      col *= fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const softDot = () => canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
const F = '"Pretendard Variable","Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';

// 옵션: sequence(재생 순서, 영상 id 배열), durations(영상별 길이 초 — 3초 영상을 그 길이로 천천히 늘려 재생), playShift/endShift(자막·끝 카드 자리만큼 장면을 위로 올림),
//       onEnd(영상 하나가 끝날 때), onSeqEnd(이어 보기가 모두 끝날 때)
export async function createSamples({ host, sequence = null, durations = {}, playShift = 0, endShift = 0, onClip = () => {}, onFrame = () => {}, onEnd = () => {}, onSeqEnd = () => {} }) {
  try { await Promise.race([document.fonts.load('900 120px "Pretendard Variable"', '보고전하움직인다약통'), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* 글꼴이 늦으면 기본 글꼴 */ }

  const world = new World(); world.useTable = false; world.start = { x: 60, y: 72, heading: 0 };
  const robot = new Robot(world);
  const api = makeRobodogApi(robot, { warnOnce() {}, sleep: () => Promise.resolve(), soundOn: () => false });
  const view = new View3D(host, world, robot); view.init();
  view.follow = false; view.trailLine.visible = false; view.controls.enabled = false;
  const renderer = view.renderer, scene = view.scene, camera = view.camera;
  renderer.domElement.style.pointerEvents = 'none'; renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.tableGroup.visible = false;

  // 후처리: 장면 → 블룸 → 출력 변환 → 색보정(마지막, 화면으로)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 40, aperture: 0.0006, maxblur: 0.01 }); bokeh.enabled = false; composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth || 1280, host.clientHeight || 720), 0.8, 0.6, 0.85); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE); composer.addPass(grade);
  const origRender = renderer.render.bind(renderer); let inside = false;
  renderer.render = (s, c) => { if (inside) return origRender(s, c); inside = true; try { composer.render(); } finally { inside = false; } };
  const fit = () => {
    const w = host.clientWidth || 1280, h = host.clientHeight || 720;
    composer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1)); composer.setSize(w, h); grade.uniforms.res.value.set(w, h);
  };
  new ResizeObserver(fit).observe(host); fit();

  const baseLights = scene.children.filter(o => o.isLight);   // 시뮬레이터가 넣어 둔 조명(0: 하늘빛, 1: 해)
  view.controls.maxPolarAngle = Math.PI; view.controls.minDistance = 0.1; view.controls.maxDistance = 2000;
  const look = (x, y, z) => { camera.lookAt(x, y, z); view.controls.target.set(x, y, z); };
  const clipGroup = new THREE.Group(); scene.add(clipGroup);
  let rig = null;   // 로보독을 담는 틀(위치·크기·방향을 바꾸려고). 로봇 좌표는 틀 안에서 그대로 움직임
  const ensureRig = () => {
    if (rig) return;
    view.draw(robot.headFrame());
    const P = view.parts.get(robot); rig = new THREE.Group(); scene.add(rig); rig.add(P.dog);
  };
  ensureRig();
  // 로보독 재질을 잠시 바꾸기(실루엣=검정, 툰=셀 음영). LED 눈(그림이 있는 재질)과 몸통 LED는 그대로 둠
  const P0 = view.parts.get(robot), swapped = [];
  const swapDog = (make) => {
    restoreDog(); const cache = new Map();
    rig.traverse(o => { if (!o.isMesh || !o.material || Array.isArray(o.material)) return; const m = o.material; if (m.map || m === P0.ledMat) return;
      if (!cache.has(m)) cache.set(m, make(m)); swapped.push([o, m]); o.material = cache.get(m); });
  };
  function restoreDog() { while (swapped.length) { const [o, m] = swapped.pop(); o.material = m; } }

  const clearClip = () => {
    clipGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    clipGroup.clear();
  };
  const addSun = (color, intensity, pos, target, size = 70) => {
    const s = new THREE.DirectionalLight(color, intensity); s.position.copy(pos); s.target.position.copy(target); s.castShadow = true;
    s.shadow.camera.left = -size; s.shadow.camera.right = size; s.shadow.camera.top = size; s.shadow.camera.bottom = -size; s.shadow.camera.far = 400; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0008;
    clipGroup.add(s, s.target); return s;
  };
  const floorMesh = (color, w = 600, d = 600, at = V(60, 0, 40), rough = 0.85) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: rough })); m.rotation.x = -Math.PI / 2; m.position.copy(at); m.receiveShadow = true; clipGroup.add(m); return m;
  };
  const tagSprite = (text, color, w = 10) => {
    const tex = canvasTex(640, 112, (c) => { c.fillStyle = color; rr(c, 4, 4, 632, 104, 52); c.fill(); let sz = 54; c.font = `800 ${sz}px ${F}`; while (c.measureText(text).width > 560 && sz > 26) { sz -= 2; c.font = `800 ${sz}px ${F}`; } c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 320, 58); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false })); s.userData.w = w; s.scale.set(0.01, 0.01, 1); clipGroup.add(s); return s;
  };
  const tagAnim = (s, t, show, hide = 1e9) => { const k = Math.max(0.01, back(fade(t, show, show + 0.3))); s.material.opacity = Math.min(1, fade(t, show, show + 0.15)) * (1 - fade(t, hide, hide + 0.3)); s.scale.set(s.userData.w * k, s.userData.w * 112 / 640 * k, 1); };

  // ---------- 로봇 시간표(상태가 바뀌는 것) ----------
  let events = [], ev = 0, simT = 0, pin = null;   // pin: 걷는 동안 제자리에 고정(러닝머신)
  const resetSim = () => { robot.reset(); ev = 0; simT = 0; };
  const simTo = (t) => {
    if (t < simT - 1e-6) resetSim();
    while (simT < t - 1e-6) {
      const dt = Math.min(1 / 30, t - simT); simT += dt;
      while (ev < events.length && simT >= events[ev][0]) events[ev++][1]();
      robot.step(dt); if (pin) { robot.x = pin.x; robot.y = pin.y; }
    }
  };

  // ---------- 영상 5개 ----------
  const clips = {};

  clips.cinema = {   // 햇빛 비치는 거실 구석에서 로보독이 눈을 뜬다
    setup() {
      scene.background = new THREE.Color(0x120c08); scene.fog = new THREE.Fog(0x120c08, 70, 190);
      baseLights[0].intensity = 0.28; baseLights[0].color.set(0x6a7fa8); baseLights[1].intensity = 0;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
      floorMesh(0x6b4a32, 400, 400, V(60, 0, 60), 0.55);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(260, 60, 2), new THREE.MeshStandardMaterial({ color: 0x3a2c24, roughness: 1 })); wall.position.set(60, 30, 108); wall.receiveShadow = true; clipGroup.add(wall);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(40, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 1.6) })); win.rotation.y = Math.PI; win.position.set(70, 24, 106.8); clipGroup.add(win);
      const barM = new THREE.MeshStandardMaterial({ color: 0x1a120d }); [[0, 0, 1.2, 28], [0, 0, 40, 1.2]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), barM); b.position.set(70 + x, 24 + y, 106.2); clipGroup.add(b); });
      addSun(0xffc890, 2.6, V(70, 50, 140), V(60, 0, 70), 60);
      // 빛줄기: 창에서 바닥으로 내려오는 반투명 판
      const beamTex = canvasTex(64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,214,150,.55)'); g.addColorStop(1, 'rgba(255,214,150,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
      this.beams = [0, 1, 2, 3].map(i => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 95), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(52 + i * 11, 30, 80 - i * 2); m.quaternion.setFromUnitVectors(V(0, 1, 0), V(0.05, -0.6, -0.8).normalize()); m.rotateY(0.0); clipGroup.add(m); return m;
      });
      // 먼지 입자
      const N = 260, pos = new Float32Array(N * 3); this.dust = { N, base: [] };
      for (let i = 0; i < N; i++) { const x = 30 + rnd() * 70, y = 2 + rnd() * 34, z = 50 + rnd() * 52; pos.set([x, y, z], i * 3); this.dust.base.push([x, y, z, rnd() * 6.28, 0.4 + rnd() * 0.8]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.dustPts = new THREE.Points(g, new THREE.PointsMaterial({ map: softDot(), color: 0xffe2b0, size: 1.6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); clipGroup.add(this.dustPts);
      rig.position.set(0, 0, 0); rig.scale.setScalar(1); rig.rotation.set(0, 0, 0); pin = null;
      events = [[0, () => { api.legBend(0, 0); api.headLedExp(2); }], [1.15, () => { api.headLedExp(0); api.legBend(0, 70); api.bodyLed(255, 190, 90); }]];
      bloom.radius = 0.7; bloom.threshold = 0.8;
      grade.uniforms.vignette.value = 0.62; grade.uniforms.grain.value = 0.07; grade.uniforms.aberr.value = 0.0018; grade.uniforms.tilt.value = 0; grade.uniforms.tint.value.set(1.06, 1.0, 0.9);
    },
    update(t) {
      const k = ease(t / DUR);
      camera.fov = lerp(52, 40, k); camera.updateProjectionMatrix();
      camera.position.set(lerp(88, 74, k), lerp(17, 10, k), lerp(34, 50, k)); look(lerp(58, 60, k), lerp(9, 8, k), 70);
      camera.position.x += Math.sin(t * 2.2) * 0.25; camera.position.y += Math.sin(t * 3.1) * 0.12;   // 손으로 든 듯한 흔들림
      bloom.strength = 0.45 + 0.9 * Math.sin(Math.PI * fade(t, 1.1, 1.9)) + 0.15 * fade(t, 1.2, 3);
      this.beams.forEach((m, i) => { m.material.opacity = 0.16 + 0.08 * Math.sin(t * 1.3 + i * 1.7); });
      const p = this.dustPts.geometry.attributes.position;
      this.dust.base.forEach(([x, y, z, ph, sp], i) => p.setXYZ(i, x + Math.sin(t * 0.6 * sp + ph) * 2.2, y + ((t * 0.9 * sp) % 6) - 3, z + Math.cos(t * 0.5 * sp + ph) * 1.6));
      p.needsUpdate = true;
    },
  };

  clips['ai-eye'] = {   // 사진 점들이 모여 군집이 되고, 약통이 인식되어 마이크로비트로 신호가 간다
    setup() {
      scene.background = new THREE.Color(0x04070f); scene.fog = new THREE.Fog(0x04070f, 90, 260);
      baseLights.forEach(l => { l.intensity = 0; });
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
      const grid = new THREE.GridHelper(220, 44, 0x1d6fa5, 0x0e3250); grid.position.set(62, 0, 62); clipGroup.add(grid);
      const C = [[V(46, 26, 62), 0xff9a3c], [V(82, 14, 44), 0x3ee08a], [V(62, 34, 86), 0x5aa9ff]];
      this.N = 150; const total = this.N * 3, pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
      this.from = []; this.to = [];
      C.forEach(([c, hex], ci) => { const cc = new THREE.Color(hex); for (let i = 0; i < this.N; i++) {
        const j = ci * this.N + i, a = rnd() * 6.28, b = Math.acos(2 * rnd() - 1), r = 45 * Math.cbrt(rnd());
        this.from.push(V(62 + r * Math.sin(b) * Math.cos(a), 24 + r * Math.cos(b), 62 + r * Math.sin(b) * Math.sin(a)));
        const q = 7 * Math.cbrt(rnd()), a2 = rnd() * 6.28, b2 = Math.acos(2 * rnd() - 1);
        this.to.push(V(c.x + q * Math.sin(b2) * Math.cos(a2), c.y + q * Math.cos(b2), c.z + q * Math.sin(b2) * Math.sin(a2)));
        col.set([cc.r, cc.g, cc.b], j * 3); pos.set([0, 0, 0], j * 3); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.pts = new THREE.Points(g, new THREE.PointsMaterial({ map: softDot(), size: 2.6, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); clipGroup.add(this.pts);
      this.center = C[0][0].clone();
      this.box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(22, 22, 22)), new THREE.LineBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0 })); this.box.position.copy(this.center); clipGroup.add(this.box);
      this.tag = tagSprite('약통', '#e8821e', 22); this.tag.position.set(this.center.x, this.center.y + 24, this.center.z);
      this.MB = V(84, 18, 70);
      const mbTex = canvasTex(260, 210, (c) => { c.fillStyle = '#1d2330'; rr(c, 0, 0, 260, 210, 26); c.fill(); const D = ['###..', '...#.', '..#..', '...#.', '###..']; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const on = D[y][x] === '#'; c.shadowBlur = on ? 18 : 0; c.shadowColor = '#ff3b30'; c.fillStyle = on ? '#ff5a4a' : '#3a2020'; c.beginPath(); c.arc(78 + x * 26, 53 + y * 26, on ? 8 : 6, 0, 6.3); c.fill(); } });
      this.mb = new THREE.Mesh(new THREE.BoxGeometry(11, 9, 0.8), [0, 0, 0, 0, 0, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: mbTex, color: new THREE.Color(2.2, 2.2, 2.2) }) : new THREE.MeshStandardMaterial({ color: 0x1d2330 }))); this.mb.position.copy(this.MB); this.mb.rotation.y = -0.5; this.mb.scale.setScalar(0.001); clipGroup.add(this.mb);
      this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, (_, i) => this.center.clone().lerp(this.MB, i / 39).add(V(0, Math.sin(i / 39 * Math.PI) * 10, 0)))), new THREE.LineBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.9 })); this.line.geometry.setDrawRange(0, 0); clipGroup.add(this.line);
      this.pulse = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 3.2, 4) })); this.pulse.visible = false; clipGroup.add(this.pulse);
      rig.visible = false; events = []; pin = null;
      bloom.radius = 0.55; bloom.threshold = 0.5; this.tag.material.color.setScalar(0.5);
      grade.uniforms.vignette.value = 0.55; grade.uniforms.grain.value = 0.04; grade.uniforms.aberr.value = 0.002; grade.uniforms.tilt.value = 0; grade.uniforms.tint.value.set(0.95, 1.0, 1.08);
    },
    update(t) {
      camera.fov = 52; camera.updateProjectionMatrix();
      const a = 0.75 + t * 0.3, R = lerp(104, 92, ease(t / DUR));
      camera.position.set(62 + Math.cos(a) * R, lerp(30, 24, t / DUR), 62 + Math.sin(a) * R); look(66, 21, 62);
      const k = ease(fade(t, 0.15, 1.5)), p = this.pts.geometry.attributes.position;
      for (let i = 0; i < this.from.length; i++) { const f = this.from[i], to = this.to[i], w = Math.sin(t * 3 + i) * (1 - k) * 1.2; p.setXYZ(i, lerp(f.x, to.x, k) + w, lerp(f.y, to.y, k) + w, lerp(f.z, to.z, k)); }
      p.needsUpdate = true; this.pts.material.size = lerp(2.0, 3.0, k);
      const bx = back(fade(t, 1.5, 1.9)); this.box.material.opacity = Math.min(1, fade(t, 1.5, 1.65)) * 0.95; this.box.scale.setScalar(Math.max(0.01, lerp(1.7, 1, bx)));
      tagAnim(this.tag, t, 1.85);
      const s = fade(t, 2.0, 2.65); this.line.geometry.setDrawRange(0, Math.floor(s * 40)); this.line.visible = s > 0;
      this.pulse.visible = s > 0 && s < 1; if (this.pulse.visible) { const pt = this.center.clone().lerp(this.MB, s); pt.y += Math.sin(s * Math.PI) * 10; this.pulse.position.copy(pt); }
      this.mb.scale.setScalar(Math.max(0.001, back(fade(t, 2.3, 2.7)))); this.mb.rotation.y = -0.5 + (a - 0.75) * 0.2;
      bloom.strength = 1.1 + 0.9 * Math.sin(Math.PI * fade(t, 2.6, 3));
    },
  };

  clips.type = {   // 글자가 튀어나오는 모션 그래픽, 마지막에 로보독이 걸어 들어옴
    setup() {
      scene.background = new THREE.Color(0x0b1030); scene.fog = null;
      baseLights[0].intensity = 1.0; baseLights[0].color.set(0xffffff); baseLights[1].intensity = 1.2;
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
      this.bg = new THREE.Mesh(new THREE.PlaneGeometry(220, 130), new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float time; varying vec2 vUv; void main(){
          vec2 p = vUv - 0.5; float r = length(p);
          vec3 a = vec3(0.004, 0.012, 0.16), b = vec3(0.17, 0.02, 0.36);
          float w = 0.5 + 0.5 * sin(p.x * 5.0 + time * 1.6 + sin(p.y * 4.0 + time));
          vec3 c = mix(a, b, smoothstep(0.1, 0.9, vUv.x * 0.7 + vUv.y * 0.3 + 0.18 * w));
          float ring = smoothstep(0.012, 0.0, abs(fract(r * 6.0 - time * 0.35) - 0.5) - 0.48); c += ring * vec3(0.05, 0.10, 0.30);
          gl_FragColor = vec4(c, 1.0); }` })); this.bg.position.set(0, 0, -30); clipGroup.add(this.bg);
      const words = [['AI가', '보고'], ['마이크로비트가', '전하고'], ['로보독이', '움직인다']];
      this.words = words.map(([sub, main], i) => {
        const tex = canvasTex(1024, 512, (c, w, h) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.78)'; c.font = `700 84px ${F}`; c.fillText(sub, w / 2, 86);
          let sz = 270; c.font = `900 ${sz}px ${F}`; while (c.measureText(main).width > 940 && sz > 120) { sz -= 10; c.font = `900 ${sz}px ${F}`; }
          c.shadowColor = '#5b8cff'; c.shadowBlur = 16; c.fillStyle = '#fff'; c.fillText(main, w / 2, 300); });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(38, 19), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); m.position.z = 0; clipGroup.add(m); return m; });
      rig.visible = true; rig.scale.setScalar(0.55); rig.rotation.set(0, -Math.PI / 2, 0); rig.position.set(-30, -17.5, 4);
      pin = { x: 60, y: 72 }; events = [[0, () => { api.legBend(0, 70); api.headLedExp(0); }], [1.9, () => api.move(0, 60)]];
      bloom.radius = 0.4; bloom.threshold = 0.92;
      grade.uniforms.vignette.value = 0.4; grade.uniforms.grain.value = 0.04; grade.uniforms.aberr.value = 0.001; grade.uniforms.tilt.value = 0; grade.uniforms.tint.value.set(1, 1, 1);
    },
    update(t) {
      camera.fov = 40; camera.updateProjectionMatrix(); camera.position.set(0, 0, 60); look(0, 0, 0);
      this.bg.material.uniforms.time.value = t;
      const T = [[0, 0.88], [1.0, 1.88], [2.0, 9]];
      let pulse = 0;
      this.words.forEach((m, i) => {
        const [a, b] = T[i], inn = fade(t, a, a + 0.28), out = fade(t, b, b + 0.14);
        const k = Math.max(0.01, back(inn)); m.material.opacity = Math.min(1, inn * 3) * (1 - out);
        m.scale.setScalar(k * (1 + out * 0.5)); m.rotation.z = lerp(-0.35, 0, ease(inn)) + out * 0.25; m.position.set(lerp(-26, 0, ease(inn)) - out * 40, 7 + Math.sin(t * 2 + i) * 0.4, 0);
        if (t >= a && t < a + 0.35) pulse = Math.max(pulse, 1 - (t - a) / 0.35);
      });
      grade.uniforms.aberr.value = 0.001 + 0.012 * pulse; bloom.strength = 0.25 + 0.45 * pulse;
      rig.position.set(lerp(-62, -8, ease(fade(t, 1.95, 3))) + 72 * 0.55, -7.5, -60 * 0.55);   // 글자 아래를 오른쪽으로 걸어 들어옴
    },
  };

  clips.diorama = {   // 장난감 같은 마을. 창문에 불이 켜지고 로보독이 길을 걷는다
    setup() {
      scene.background = new THREE.Color(0xcfe6f7); scene.fog = new THREE.Fog(0xcfe6f7, 260, 520);
      baseLights[0].intensity = 1.05; baseLights[0].color.set(0xffffff); baseLights[0].groundColor && baseLights[0].groundColor.set(0xaabbd0); baseLights[1].intensity = 0;
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
      addSun(0xfff1d6, 2.3, V(150, 170, 120), V(60, 0, 45), 110);
      const base = new THREE.Mesh(new THREE.BoxGeometry(150, 8, 100), new THREE.MeshStandardMaterial({ color: 0x8fcf7a, roughness: 0.9 })); base.position.set(60, -4.2, 45); base.receiveShadow = true; clipGroup.add(base);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(154, 4, 104), new THREE.MeshStandardMaterial({ color: 0x6b4f3a })); edge.position.set(60, -9, 45); clipGroup.add(edge);
      const road = new THREE.Mesh(new THREE.BoxGeometry(150, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0x555d69 })); road.position.set(60, 0.1, 50); road.receiveShadow = true; clipGroup.add(road);
      for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(6, 0.45, 1.2), new THREE.MeshStandardMaterial({ color: 0xf3f3f3 })); d.position.set(-6 + i * 17, 0.3, 50); clipGroup.add(d); }
      const H = [[22, 18, 0xe8856a, 0xffc78a], [62, 16, 0x6aa6e8, 0xffe08a], [102, 24, 0xf2c14e, 0xffd6a0]];
      this.win = []; this.props = [];
      H.forEach(([x, z, color, light], i) => {
        const g = new THREE.Group(); g.position.set(x, 0, z);
        const body = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 16), new THREE.MeshStandardMaterial({ color })); body.position.y = 7; body.castShadow = true; body.receiveShadow = true; g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(15.5, 9, 4), new THREE.MeshStandardMaterial({ color: 0x8a4b3a })); roof.position.y = 18.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
        const wm = new THREE.MeshStandardMaterial({ color: 0x2b3340, emissive: new THREE.Color(light), emissiveIntensity: 0 });
        [-5, 5].forEach(dx => { const w = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5), wm); w.position.set(dx, 8, 8.1); g.add(w); }); this.win.push(wm);
        const door = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a3b2a })); door.position.set(0, 3.5, 8.1); g.add(door);
        clipGroup.add(g);
      });
      const propMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: new THREE.Color(hex), emissiveIntensity: 0.9, roughness: 0.4 });
      const pill = new THREE.Group(); pill.add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4.4, 16), propMat(0xe8821e))); const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.2, 16), propMat(0xffffff)); cap.position.y = 2.8; pill.add(cap);
      const card = new THREE.Mesh(new THREE.BoxGeometry(5, 6.5, 0.6), propMat(0x2f6fe4));
      const tl = new THREE.Group(); tl.add(new THREE.Mesh(new THREE.BoxGeometry(3, 7, 2), new THREE.MeshStandardMaterial({ color: 0x1d2330 }))); [[2.2, 0xe5484d], [0, 0xf2b300], [-2.2, 0x1fa463]].forEach(([y, hex]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), propMat(hex)); b.position.set(0, y, 1.1); tl.add(b); });
      [pill, card, tl].forEach((p, i) => { p.position.set(H[i][0], 29, H[i][1]); p.scale.setScalar(0.001); clipGroup.add(p); this.props.push(p); });
      for (const [x, z] of [[8, 80], [40, 82], [76, 80], [112, 78], [10, 30], [118, 56]]) { const tr = new THREE.Group(); const k = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 5, 8), new THREE.MeshStandardMaterial({ color: 0x6b4f3a })); k.position.y = 2.5; const l = new THREE.Mesh(new THREE.ConeGeometry(5, 11, 10), new THREE.MeshStandardMaterial({ color: 0x3f9b4f })); l.position.y = 10; l.castShadow = true; tr.add(k, l); tr.position.set(x, 0, z); clipGroup.add(tr); }
      rig.visible = true; rig.scale.setScalar(0.6); pin = { x: 60, y: 72 }; events = [[0, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(40, 200, 120); }], [0.1, () => api.move(0, 60)]];
      bloom.radius = 0.5; bloom.threshold = 0.9;
      grade.uniforms.vignette.value = 0.3; grade.uniforms.grain.value = 0.025; grade.uniforms.aberr.value = 0.0008; grade.uniforms.tilt.value = 1.0; grade.uniforms.tint.value.set(1.03, 1.0, 0.97);
    },
    update(t) {
      camera.fov = 24; camera.updateProjectionMatrix();
      const a = lerp(-0.35, 0.05, ease(t / DUR)), R = 215;
      camera.position.set(60 + Math.sin(a) * R, 118, 45 + Math.cos(a) * R); look(60, 8, 45);
      [0.35, 1.05, 1.75].forEach((s, i) => { const k = fade(t, s, s + 0.2); this.win[i].emissiveIntensity = k * 2.2; const pk = Math.max(0.001, back(fade(t, s + 0.15, s + 0.55))); this.props[i].scale.setScalar(pk); this.props[i].position.y = 28 + Math.sin(t * 3 + i * 2) * 0.8; this.props[i].rotation.y = t * 1.5; });
      // 로봇은 제자리(pin)에서 걸음 동작만 하고, 틀(rig)이 길을 따라 오른쪽(+x)으로 이동. 틀을 -90° 돌리면 로봇 좌표 (60,72) → 세계 (-72,60)*크기
      const S = 0.6, px = lerp(10, 108, ease(fade(t, 0, DUR)));
      rig.rotation.y = -Math.PI / 2; rig.position.set(px + 72 * S, 0.2, 50 - 60 * S);
      bloom.strength = 0.35 + 0.25 * Math.sin(t * 2);
    },
  };

  clips.split = {   // 오른쪽: 3D 로보독 / 왼쪽: 블록 코드(화면 위 DOM)가 같은 순서로 켜진다
    setup() {
      scene.background = new THREE.Color(0x0e1522); scene.fog = new THREE.Fog(0x0e1522, 120, 300);
      baseLights[0].intensity = 0.7; baseLights[0].color.set(0xbfd0ff); baseLights[1].intensity = 0;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      floorMesh(0x1a2436, 500, 500, V(60, 0, 60), 0.6);
      const grid = new THREE.GridHelper(300, 60, 0x2f4a78, 0x1b2c4a); grid.position.set(60, 0.05, 60); clipGroup.add(grid);
      addSun(0xdfe8ff, 2.2, V(110, 90, 60), V(60, 0, 62), 70);
      rig.visible = true; rig.scale.setScalar(1); rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); pin = null;
      events = [[0, () => { api.gesture && api.gesture(0); api.legBend(0, 70); api.headLedExp(0); }], [0.9, () => api.move(0, 25)], [1.9, () => api.stop()], [2.2, () => { api.headLedExp(1); api.bodyLed(80, 140, 255); }]];
      bloom.radius = 0.5; bloom.threshold = 0.8;
      grade.uniforms.vignette.value = 0.45; grade.uniforms.grain.value = 0.04; grade.uniforms.aberr.value = 0.0012; grade.uniforms.tilt.value = 0; grade.uniforms.tint.value.set(1, 1.0, 1.04);
    },
    update(t) {
      camera.fov = 38; camera.updateProjectionMatrix();
      camera.position.set(lerp(98, 92, ease(t / DUR)), 14, 54); look(60, 7, lerp(66, 60, t / DUR));
      bloom.strength = 0.45 + 0.9 * fade(t, 2.2, 2.6);
    },
  };

  // ================= 이야기 샘플 3개 =================
  const black = () => new THREE.MeshBasicMaterial({ color: 0x020306, side: THREE.DoubleSide });
  const skyDome = (top, horizon, bottom = horizon) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, bot: { value: new THREE.Color(bottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, hor, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(min(1.0, h * 2.2), 0.8)) : mix(hor, bot, min(1.0, -h * 4.0)); gl_FragColor = vec4(c, 1.0); }' }));
    m.renderOrder = -1; clipGroup.add(m); return m;
  };
  const ridgeShape = (pts, z, mat) => {   // [x,y] 꼭짓점으로 만든 평면 실루엣(카메라 쪽을 봄)
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => sh.lineTo(x, y));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); m.position.z = z; return m;
  };
  const hills = (z, base, amp, seed, mat) => { const pts = [[-900, -400]]; for (let x = -900; x <= 1100; x += 40) pts.push([x, base + amp * (0.55 + 0.45 * Math.sin(x * 0.006 + seed) * Math.sin(x * 0.013 + seed * 2))]); pts.push([1100, -400]); return ridgeShape(pts, z, mat); };

  // 사람 실루엣(아이): 머리·몸·팔·다리. 팔 하나는 카드를 듦
  const makeKid = (mat) => {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.2, 20, 16), mat); head.position.y = 50; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(5.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat); hair.position.set(0.6, 51, 0); g.add(hair);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mat); tail.position.set(-5, 50.5, 0); g.add(tail);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 7.5, 20, 16), mat); body.position.y = 34; g.add(body);
    const legs = [-2.4, 2.4].map(dx => { const p = new THREE.Group(); p.position.set(dx, 24, 0); const l = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 17, 4, 8), mat); l.position.y = -10; p.add(l); g.add(p); return p; });
    const armB = new THREE.Group(); armB.position.set(-3.5, 41, 0); const ab = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 13, 4, 8), mat); ab.position.y = -7; armB.add(ab); armB.rotation.z = -0.25; g.add(armB);
    const arm = new THREE.Group(); arm.position.set(3.8, 41, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 13, 4, 8), mat); a.position.y = -7; arm.add(a); g.add(arm);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(7, 9.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 2.2, 0.7), side: THREE.DoubleSide, fog: false })); card.position.set(0, -15.5, -0.5); arm.add(card);
    return { g, legs, arm, armB, card };
  };

  clips.walk = {   // A. 로보독의 첫 산책 — 실루엣 그림자극
    len: 7,
    setup() {
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
      baseLights.forEach(l => { l.intensity = 0; });
      const HOR = '#6f8fb4';
      scene.background = new THREE.Color('#0b1430'); scene.fog = new THREE.Fog(new THREE.Color(HOR), 90, 760);
      skyDome('#08122b', HOR, '#2a3c5c');
      swapDog(() => black());
      const B = black();
      // 1) 방: 창 너머 달, 상자 속 로보독
      const room = this.room = new THREE.Group(); clipGroup.add(room);
      const wallPieces = [[60, 97, 260, 86], [60, -28, 260, 64], [-50, 29, 160, 50], [170, 29, 160, 50]];   // 창(30~90 × 4~54) 둘레
      wallPieces.forEach(([x, y, w, h]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), B); m.position.set(x, y, 120); m.rotation.y = Math.PI; room.add(m); });
      [[60, 29, 1.6, 50], [60, 29, 60, 1.6]].forEach(([x, y, w, h]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), B); m.position.set(x, y, 119.5); m.rotation.y = Math.PI; room.add(m); });
      const sill = new THREE.Mesh(new THREE.BoxGeometry(70, 2, 6), B); sill.position.set(60, 3.4, 117); room.add(sill);
      const moonR = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.3), fog: false })); moonR.position.set(82, 140, 900); moonR.rotation.y = Math.PI; room.add(moonR);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), B); fl.rotation.x = -Math.PI / 2; fl.position.set(60, 0, 60); room.add(fl);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshBasicMaterial({ map: softDot(), color: new THREE.Color(0.18, 0.26, 0.42), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(62, 0.1, 92); room.add(glow);   // 창으로 들어온 달빛이 바닥에
      const box = new THREE.Group(); box.position.set(60, 0, 74); room.add(box);
      [[0, 3, -15, 30, 6, 1], [0, 3, 15, 30, 6, 1], [-15, 3, 0, 1, 6, 30], [15, 3, 0, 1, 6, 30]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), B); m.position.set(x, y, z); box.add(m); });
      [[-1, 0.9], [1, -0.9]].forEach(([sx, rz]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 28), B); f.position.set(sx * 21, 7.5, 0); f.rotation.z = rz; box.add(f); });
      const fz = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 12), B); fz.position.set(0, 8.5, 20); fz.rotation.x = -0.8; box.add(fz);   // 뒤쪽 날개(앞을 가리지 않게)
      // 2) 밖: 달빛 언덕, 낭떠러지에서 끝나는 능선
      const out = this.out = new THREE.Group(); out.visible = false; clipGroup.add(out);
      const moon = new THREE.Mesh(new THREE.CircleGeometry(48, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.1), fog: false })); moon.position.set(150, 120, 800); out.add(moon);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(150, 64), new THREE.MeshBasicMaterial({ map: softDot(), color: new THREE.Color(0.35, 0.45, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.position.set(150, 120, 801); out.add(halo);
      out.add(hills(560, -10, 120, 1.0, B), hills(360, -30, 80, 2.3, B), hills(200, -40, 50, 3.7, B));
      const ridge = []; ridge.push([-600, -300]); for (let x = -600; x <= 96; x += 12) ridge.push([x, Math.sin(x * 0.05) * 0.6 - 0.2]); ridge.push([98, -2], [101, -9], [99, -16], [104, -30], [102, -300]);
      out.add(ridgeShape(ridge, 3, B));
      const md = (v, n) => ((v % n) + n) % n;   // 음수에도 0..n-1
      for (let x = -560; x < 92; x += 7 + md(x * 7919, 9)) { const gr = new THREE.Mesh(new THREE.ConeGeometry(0.5 + md(x * 31, 5) * 0.12, 2.5 + md(x * 17, 7) * 0.6, 3), B); gr.position.set(x, 1, 2.4 + (x % 3)); gr.rotation.z = Math.sin(x) * 0.3; out.add(gr); }
      const stars = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) stars.set([-700 + rnd() * 1600, 80 + rnd() * 500, 1000], i * 3);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
      out.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
      this.kid = makeKid(B); this.kid.g.scale.setScalar(0.9); out.add(this.kid.g);
      rig.visible = true; rig.scale.setScalar(1);
      pin = { x: 60, y: 72 };
      events = [[0, () => { api.legBend(0, 0); api.headLedClear(); }], [0.75, () => api.headLedExp(6)], [1.6, () => api.headLedExp(0)],
        [2.4, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(40, 220, 120); api.move(0, 60); }],
        [5.0, () => { api.stop(); api.headLedExp(13); api.bodyLed(255, 50, 50); }], [5.75, () => { api.headLedExp(1); api.bodyLed(255, 110, 170); }]];
      bloom.radius = 0.7; bloom.threshold = 0.55;
      grade.uniforms.vignette.value = 0.6; grade.uniforms.grain.value = 0.06; grade.uniforms.aberr.value = 0.0015; grade.uniforms.tint.value.set(0.92, 1.0, 1.1);
    },
    update(t) {
      const inRoom = t < 2.4; this.room.visible = inRoom; this.out.visible = !inRoom;
      grade.uniforms.fade.value = Math.min(1, Math.abs(t - 2.4) / 0.22);   // 장면 전환: 잠깐 어두워졌다 밝아짐
      if (inRoom) {
        rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0);
        const k = ease(t / 2.4); camera.fov = lerp(44, 34, k); camera.updateProjectionMatrix();
        camera.position.set(60 + Math.sin(t * 0.8) * 1.2, lerp(5, 5.5, k), lerp(22, 36, k)); look(60, lerp(20, 16, k), 120);
        bloom.radius = 0.3; bloom.threshold = 0.85; bloom.strength = 0.35 + 0.5 * fade(t, 0.75, 1.0) * (1 - 0.5 * fade(t, 1.0, 1.6));   // LED 점이 번지지 않게
      } else {
        const walk = ease(fade(t, 2.45, 5.0)), dogX = lerp(-20, 84, walk);
        rig.rotation.set(0, -Math.PI / 2, 0); rig.position.set(dogX + 72, 0, -60);
        const K = this.kid, kx = dogX - 34, moving = t < 5.0;
        K.g.position.set(kx, 0, 1); K.legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(t * 9 + i * Math.PI) * 0.5 : 0; });
        const raise = back(fade(t, 4.8, 5.1));
        K.arm.rotation.z = lerp(0.55 + (moving ? Math.sin(t * 9) * 0.08 : 0), 2.35, Math.min(1, raise));
        if (t >= 4.85) K.card.material.color.setRGB(2.4, 0.25, 0.25); else K.card.material.color.setRGB(0.25, 2.2, 0.7);
        K.card.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * fade(t, 4.85, 5.25)));
        const push = ease(fade(t, 5.0, 7.0)); camera.fov = lerp(38, 36, push); camera.updateProjectionMatrix();
        camera.position.set(dogX - 6, 9, lerp(-122, -104, push)); look(dogX - 6, lerp(19, 22, push), 0);
        bloom.radius = 0.7; bloom.threshold = 0.55; bloom.strength = 1.0 + 0.8 * Math.sin(Math.PI * fade(t, 4.9, 5.4)) + 0.4 * fade(t, 5.75, 6.2);
      }
    },
  };

  clips.explore = {   // B. 로보독 탐험대 — 로보독 눈높이 매크로, 얕은 심도
    len: 7,
    setup() {
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      baseLights[0].intensity = 0.55; baseLights[0].color.set(0xffe3c4); baseLights[1].intensity = 0;
      scene.background = new THREE.Color(0x2a1d14); scene.fog = new THREE.Fog(0x2a1d14, 90, 260);
      const plank = canvasTex(512, 512, (c) => { for (let i = 0; i < 8; i++) { const v = 150 + ((i * 37) % 30); c.fillStyle = `rgb(${v},${Math.round(v * 0.66)},${Math.round(v * 0.42)})`; c.fillRect(0, i * 64, 512, 64); c.fillStyle = 'rgba(40,20,8,.55)'; c.fillRect(0, i * 64, 512, 2); c.fillRect((i * 173) % 512, i * 64, 2, 64);
        for (let k = 0; k < 14; k++) { c.strokeStyle = 'rgba(80,45,20,.18)'; c.beginPath(); const y = i * 64 + 6 + k * 4; c.moveTo(0, y); c.bezierCurveTo(170, y + 3, 340, y - 3, 512, y + 1); c.stroke(); } } });
      plank.wrapS = plank.wrapT = THREE.RepeatWrapping; plank.repeat.set(6, 6);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: plank, roughness: 0.45, metalness: 0.0 })); fl.rotation.x = -Math.PI / 2; fl.position.set(60, 0, 60); fl.receiveShadow = true; clipGroup.add(fl);
      addSun(0xffd29a, 3.0, V(140, 70, 140), V(60, 0, 60), 90);
      const wallM = new THREE.MeshStandardMaterial({ color: 0xd9c3a2, roughness: 0.95 });
      [[60, 60, -8, 0], [60, 60, 210, Math.PI], [-30, 60, 100, Math.PI / 2], [150, 60, 100, -Math.PI / 2]].forEach(([x, y, z, ry]) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), wallM); w.position.set(x, y, z); w.rotation.y = ry; w.receiveShadow = true; clipGroup.add(w); });
      const board = new THREE.Mesh(new THREE.BoxGeometry(400, 5, 1), new THREE.MeshStandardMaterial({ color: 0x5a3b2a })); board.position.set(60, 2.5, 208); clipGroup.add(board);
      const winLight = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.6, 1.8) })); winLight.position.set(80, 45, 209); winLight.rotation.y = Math.PI; clipGroup.add(winLight);
      const pal = ['#8c2f39', '#2f5d8c', '#c99a3b', '#3d7a52', '#6b4c8a', '#d9d2c3', '#1f3b4d', '#b5562f'];
      const book = (x, y, z, w, h, d, i, rot) => {
        const col = pal[i % pal.length];
        const spine = canvasTex(128, 256, (c) => { c.fillStyle = col; c.fillRect(0, 0, 128, 256); c.fillStyle = 'rgba(255,215,140,.75)'; c.fillRect(0, 30, 128, 6); c.fillRect(0, 220, 128, 6); c.fillRect(30, 90, 68, 50); });
        const side = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }), pages = new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [pages, side, side, side, new THREE.MeshStandardMaterial({ map: spine, roughness: 0.6 }), side]);
        m.position.set(x, y + h / 2, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true; clipGroup.add(m); return h;
      };
      let n = 0;
      [[36, 66], [86, 60], [38, 46], [84, 42], [84, 90]].forEach(([x, z], si) => { let y = 0; const cnt = 3 + (si * 2) % 4; for (let i = 0; i < cnt; i++) { const w = 26 - (i % 3) * 2, h = 3.5 + (n % 3) * 1.4, d = 18 - (i % 2) * 2; y += book(x, y, z, w, h, d, n++, (i % 2 ? 0.12 : -0.08) + si * 0.3); } });
      // 소파: 낮은 동굴
      const sofaM = new THREE.MeshStandardMaterial({ color: 0x4a5a6e, roughness: 0.9 });
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(120, 26, 40), sofaM); sofa.position.set(60, 31, 14); sofa.castShadow = true; clipGroup.add(sofa);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(120, 4, 2), sofaM); skirt.position.set(60, 19, 34); clipGroup.add(skirt);
      [[4, 0], [116, 0], [4, 28], [116, 28]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 18, 10), new THREE.MeshStandardMaterial({ color: 0x3a2516 })); l.position.set(x, 9, z + 2); l.castShadow = true; clipGroup.add(l); });
      // 열쇠(금색) + 반짝임
      const gold = new THREE.MeshStandardMaterial({ color: 0xe6b84a, metalness: 1, roughness: 0.25, emissive: new THREE.Color(0x3a2a08) });
      const key = this.key = new THREE.Group(); key.position.set(58, 0.5, 30); key.rotation.set(-Math.PI / 2, 0, 0.6); clipGroup.add(key);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.45, 10, 24), gold); key.add(ring);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 0.5), gold); shaft.position.set(4.6, 0, 0); key.add(shaft);
      [5.5, 7].forEach(x => { const tth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.5), gold); tth.position.set(x, -0.9, 0); key.add(tth); });
      this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { c.translate(64, 64); for (let a = 0; a < 4; a++) { c.rotate(Math.PI / 4); const g = c.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,250,230,1)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(-60, a % 2 ? -1.5 : -3, 120, a % 2 ? 3 : 6); } }), color: new THREE.Color(3, 2.7, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.glint.position.set(61, 2, 30); clipGroup.add(this.glint);
      // 햇빛 속 먼지
      const N = 200, pos = new Float32Array(N * 3); this.dust = [];
      for (let i = 0; i < N; i++) { const p = [30 + rnd() * 70, 1 + rnd() * 30, 30 + rnd() * 70]; pos.set(p, i * 3); this.dust.push([...p, rnd() * 6.28]); }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.dustPts = new THREE.Points(dg, new THREE.PointsMaterial({ map: softDot(), color: 0xffe0b0, size: 0.9, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); clipGroup.add(this.dustPts);
      rig.visible = true; rig.scale.setScalar(1); rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); pin = null;
      events = [[0, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(255, 180, 90); }], [0.35, () => api.headLedExp(6)], [1.7, () => api.headLedExp(0)],
        [2.3, () => api.move(0, 60)], [5.0, () => { api.stop(); api.headLedExp(13); }], [5.85, () => { api.headLedExp(1); api.bodyLed(255, 120, 60); }]];
      bokeh.enabled = true; bokeh.uniforms.aperture.value = 0.0011; bokeh.uniforms.maxblur.value = 0.014;
      bloom.radius = 0.6; bloom.threshold = 0.85;
      grade.uniforms.vignette.value = 0.55; grade.uniforms.grain.value = 0.045; grade.uniforms.aberr.value = 0.0012; grade.uniforms.tint.value.set(1.05, 1.0, 0.92);
    },
    update(t) {
      const dog = V(robot.x, 8, robot.y);
      let focusPt = dog;
      if (t < 2.3) {   // 책 더미 너머로 두리번거리는 로보독
        const k = ease(t / 2.3); camera.fov = 38; camera.position.set(lerp(72, 68, k), lerp(6, 7, k), lerp(104, 98, k)); look(60, 9, 72);
      } else if (t < 5.0) {   // 낮게 뒤따라가며 책 협곡을 지나감
        camera.fov = 42; camera.position.set(robot.x + 4, 7.5, robot.y + 26); look(robot.x, 7, robot.y - 12);
      } else {   // 소파 아래: 앞쪽 열쇠에서 로보독으로 초점 이동
        camera.fov = 46; const k = ease(fade(t, 5.0, 7.0)); camera.position.set(lerp(64, 61, k), 3.4, lerp(10, 13, k)); look(lerp(59, 60, k), lerp(3, 7, k), lerp(30, 42, k));
        const rack = ease(fade(t, 5.5, 6.1)); focusPt = this.key.position.clone().lerp(dog, rack);
      }
      camera.updateProjectionMatrix();
      bokeh.uniforms.focus.value = camera.position.distanceTo(focusPt);
      this.glint.material.opacity = 0.25 + 0.75 * Math.max(0, Math.sin(t * 3.2)) * fade(t, 4.6, 5.0);
      this.glint.scale.setScalar(3 + 2 * Math.sin(t * 6)); this.glint.material.rotation = t * 0.8;
      const p = this.dustPts.geometry.attributes.position;
      this.dust.forEach(([x, y, z, ph], i) => p.setXYZ(i, x + Math.sin(t * 0.7 + ph) * 1.5, y + Math.sin(t * 0.4 + ph * 2) * 1.2, z + Math.cos(t * 0.5 + ph) * 1.5)); p.needsUpdate = true;
      bloom.strength = 0.5 + 0.6 * fade(t, 4.6, 5.2) + 0.3 * fade(t, 5.85, 6.3);
    },
  };

  const toonGrad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonGrad });
  const outlined = (mesh, w = 0.06) => {   // 뒷면을 키운 검은 껍데기 = 외곽선
    const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x2a2320, side: THREE.BackSide }));
    o.scale.setScalar(1 + w); mesh.add(o); return mesh;
  };
  const SEASON = [
    { sky: '#cfe8ff', ground: '#a9d98b', leaf: '#f6b3cf', fall: '#ffb7d5', name: '봄' },
    { sky: '#8fcdf7', ground: '#6cc06a', leaf: '#3f9b4f', fall: '#fff6c8', name: '여름' },
    { sky: '#f3cf9c', ground: '#c9a25a', leaf: '#e0743a', fall: '#f08a3c', name: '가을' },
    { sky: '#d6e2ee', ground: '#f4f7fb', leaf: '#e9eef5', fall: '#ffffff', name: '겨울' },
  ].map(s => ({ ...s, sky: new THREE.Color(s.sky), ground: new THREE.Color(s.ground), leaf: new THREE.Color(s.leaf), fall: new THREE.Color(s.fall) }));

  clips.seasons = {   // C. 할아버지와 로보독의 사계절 — 동화책 툰
    len: 6,
    setup() {
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
      baseLights[0].intensity = 0.9; baseLights[0].color.set(0xffffff); baseLights[1].intensity = 0;
      scene.background = SEASON[0].sky.clone(); scene.fog = null;
      addSun(0xfff4e0, 1.9, V(20, 120, -40), V(60, 0, 80), 90);
      swapDog((m) => toon(m.color ? m.color.clone() : new THREE.Color(0x2d353f)));
      this.groundM = toon(SEASON[0].ground.clone());
      const ground = outlined(new THREE.Mesh(new THREE.CylinderGeometry(78, 80, 6, 48), this.groundM), 0.01); ground.position.set(60, -3, 80); ground.receiveShadow = true; clipGroup.add(ground);
      // 집 앞(벽·문·지붕·계단)
      const wall = outlined(new THREE.Mesh(new THREE.BoxGeometry(70, 34, 6), toon(0xf3e3c3)), 0.015); wall.position.set(52, 17, 104); wall.castShadow = true; clipGroup.add(wall);
      const roof = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 46, 18, 4, 1), toon(0xc0584a)), 0.03); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.35); roof.position.set(52, 43, 104); clipGroup.add(roof);
      this.roofSnow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 47, 6, 4, 1), toon(0xffffff)); this.roofSnow.rotation.y = Math.PI / 4; this.roofSnow.scale.set(1, 1, 0.36); this.roofSnow.position.set(52, 49, 104); this.roofSnow.visible = false; clipGroup.add(this.roofSnow);
      const door = outlined(new THREE.Mesh(new THREE.BoxGeometry(13, 22, 1), toon(0x7a4e33)), 0.03); door.position.set(60, 11, 100.6); clipGroup.add(door);
      const win = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 1), new THREE.MeshBasicMaterial({ color: 0xffe6a8 })); win.position.set(34, 20, 100.6); clipGroup.add(outlined(win, 0.05));
      [[0, 2, 96, 36, 4, 10], [0, 5.5, 99, 36, 3, 6]].forEach(([dx, y, z, w, h, d]) => { const st = outlined(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(0xd8c9ad)), 0.02); st.position.set(52 + dx, y, z); st.castShadow = true; st.receiveShadow = true; clipGroup.add(st); });
      // 할아버지(계단에 앉음): 둥근 모양 + 외곽선
      const gp = this.gp = new THREE.Group(); gp.position.set(34, 4, 93); gp.scale.setScalar(0.82); clipGroup.add(gp);
      const torso = outlined(new THREE.Mesh(new THREE.SphereGeometry(7, 24, 18), toon(0x7d8fa8)), 0.05); torso.scale.set(1, 1.15, 0.85); torso.position.y = 10; gp.add(torso);
      const ghead = this.gHead = new THREE.Group(); ghead.position.y = 22; gp.add(ghead);
      ghead.add(outlined(new THREE.Mesh(new THREE.SphereGeometry(5, 24, 18), toon(0xf2c9a2)), 0.05));
      [-1, 1].forEach(sx => { const h = outlined(new THREE.Mesh(new THREE.SphereGeometry(2, 12, 10), toon(0xffffff)), 0.08); h.position.set(sx * 4.4, 0.6, 0.6); ghead.add(h);
        const gl = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.22, 8, 18), new THREE.MeshBasicMaterial({ color: 0x2a2320 })); gl.position.set(sx * 1.7, 0.5, -4.8); ghead.add(gl);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a2320 })); e.position.set(sx * 1.7, 0.5, -4.85); ghead.add(e); });
      const mus = outlined(new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), toon(0xffffff)), 0.08); mus.scale.set(1.3, 0.5, 0.6); mus.position.set(0, -1.6, -4.3); ghead.add(mus);
      const cap = outlined(new THREE.Mesh(new THREE.SphereGeometry(5.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(0x4f6b4a)), 0.04); cap.position.y = 0.6; ghead.add(cap);
      [-1, 1].forEach(sx => { const leg = outlined(new THREE.Mesh(new THREE.CapsuleGeometry(1.8, 7, 4, 10), toon(0x5b4a3a)), 0.06); leg.rotation.x = Math.PI / 2; leg.position.set(sx * 3, 3.5, -6); gp.add(leg);
        const arm = outlined(new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 6, 4, 10), toon(0x7d8fa8)), 0.06); arm.position.set(sx * 7, 11, -3); arm.rotation.set(0.8, 0, sx * 0.4); gp.add(arm); });
      this.scarf = outlined(new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.4, 10, 20), toon(0xd9534f)), 0.05); this.scarf.rotation.x = Math.PI / 2; this.scarf.position.y = 18; this.scarf.visible = false; gp.add(this.scarf);
      // 나무
      const tree = new THREE.Group(); tree.position.set(100, 0, 84); clipGroup.add(tree);
      tree.add(outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 26, 10), toon(0x7a5232)), 0.05)); tree.children[0].position.y = 13;
      this.leafM = toon(SEASON[0].leaf.clone());
      this.leaves = [[0, 34, 0, 13], [-9, 29, 2, 9], [9, 30, -2, 10], [2, 41, 3, 9]].map(([x, y, z, r]) => { const m = outlined(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), this.leafM), 0.04); m.position.set(x, y, z); tree.add(m); return m; });
      // 계절마다 내리는 것(꽃잎·햇살·낙엽·눈)
      const N = 260, pos = new Float32Array(N * 3); this.fall = [];
      for (let i = 0; i < N; i++) { const p = [10 + rnd() * 110, rnd() * 70, 50 + rnd() * 60]; pos.set(p, i * 3); this.fall.push([...p, rnd() * 6.28, 0.6 + rnd() * 0.8]); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.fallPts = new THREE.Points(fg, new THREE.PointsMaterial({ map: softDot(), color: SEASON[0].fall.clone(), size: 1.8, transparent: true, depthWrite: false })); clipGroup.add(this.fallPts);
      this.pill = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.6, 14), toon(0xe8821e)), 0.08); this.pill.position.set(48, 8, 89); this.pill.scale.setScalar(0.001); clipGroup.add(this.pill);
      rig.visible = true; rig.scale.setScalar(1); rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); pin = null;
      events = [[0, () => { api.legBend(0, 70); api.headLedExp(0); api.bodyLed(255, 150, 190); }], [0.35, () => api.legBend(1, 15)], [0.75, () => api.legBend(1, 70)], [1.0, () => api.legBend(1, 15)], [1.35, () => api.legBend(1, 70)],
        [1.5, () => { api.headLedExp(3); api.bodyLed(80, 200, 255); }], [3.0, () => { api.headLedExp(6); api.bodyLed(255, 140, 40); }], [3.6, () => api.headLedExp(0)],
        [4.5, () => { api.headLedExp(2); api.bodyLed(255, 170, 90); }], [5.2, () => { api.headLedExp(1); }]];
      bloom.radius = 0.4; bloom.threshold = 0.95;
      grade.uniforms.vignette.value = 0.28; grade.uniforms.grain.value = 0.02; grade.uniforms.aberr.value = 0; grade.uniforms.paper.value = 1; grade.uniforms.tint.value.set(1.03, 1.0, 0.95);
    },
    update(t) {
      const si = Math.min(3, Math.floor(t / 1.5)), mixK = ease(fade(t - si * 1.5, 0, 0.4)), a = SEASON[Math.max(0, si - 1)], b = SEASON[si];
      const m = si === 0 ? 1 : mixK;
      scene.background.copy(a.sky).lerp(b.sky, m); this.groundM.color.copy(a.ground).lerp(b.ground, m); this.leafM.color.copy(a.leaf).lerp(b.leaf, m); this.fallPts.material.color.copy(a.fall).lerp(b.fall, m);
      this.roofSnow.visible = t >= 4.5; this.roofSnow.scale.y = Math.max(0.01, ease(fade(t, 4.5, 5.0)));
      this.scarf.visible = t >= 4.5;
      this.leaves.forEach((l, i) => l.scale.setScalar(si === 2 ? 1 - 0.25 * fade(t, 3.6, 4.5) : si === 3 ? 0.8 : 1));
      const summer = si === 1, p = this.fallPts.geometry.attributes.position;
      this.fall.forEach(([x, y, z, ph, sp], i) => { const yy = summer ? y * 0.6 + 6 + Math.sin(t * 2 + ph) * 3 : ((y - t * 9 * sp) % 70 + 70) % 70; p.setXYZ(i, x + Math.sin(t * 1.3 * sp + ph) * 3, yy, z + Math.cos(t * sp + ph) * 2); });
      p.needsUpdate = true; this.fallPts.material.size = summer ? 1.1 : si === 3 ? 1.6 : 2.0; this.fallPts.material.opacity = summer ? 0.7 : 0.95;
      this.pill.scale.setScalar(Math.max(0.001, back(fade(t, 3.25, 3.6)) * (1 - fade(t, 4.4, 4.6)))); this.pill.rotation.y = t * 2;
      this.gHead.rotation.x = Math.sin(Math.max(0, t - 5.1) * 8) * 0.12 * fade(t, 5.1, 5.3); this.gHead.rotation.y = -0.35 + Math.sin(t * 0.9) * 0.08;   // 오른쪽(로보독 쪽)을 봄
      const k = ease(t / 6); camera.fov = lerp(32, 27, k); camera.updateProjectionMatrix();
      camera.position.set(lerp(70, 64, k), lerp(46, 38, k), lerp(-36, -22, k)); look(54, 16, 84);
      bloom.strength = 0.3;
    },
  };

  // ---------- 재생 ----------
  const ids = sequence || CLIPS.map(c => c.id), meta = ids.map(id => [...CLIPS, ...STORIES].find(c => c.id === id));
  let cur = -1, t = 0, playing = false, chain = false, ended = false, raf = 0, last = performance.now(), shTX = 0, shY = 0, shTY = playShift;
  const base = (i) => clips[ids[i]].len || DUR;   // 영상이 만들어진 길이
  const dur = (i) => durations[ids[i]] || base(i);
  const tau = () => t * base(cur) / dur(cur);   // 실제 시간 → 영상 안의 시간
  const start = (i) => {
    cur = i; t = 0; clearClip(); restoreDog(); rig.visible = true; resetSim(); pin = null; events = [];
    camera.fov = 45; bloom.strength = 0.8; bokeh.enabled = false; grade.uniforms.fade.value = 1; grade.uniforms.paper.value = 0; scene.fog = null;
    clips[ids[i]].setup(); shTX = ids[i] === 'split' ? -0.2 : 0;
    onClip(i, meta[i]);
  };
  const draw = (dt = 0.016) => {
    const c = clips[ids[cur]], tt = tau();
    simTo(tt); c.update(tt);
    grade.uniforms.time.value = (performance.now() % 1000) / 1000 + t;
    const W = host.clientWidth || 1, H = host.clientHeight || 1;
    shY += (shTY - shY) * (1 - Math.exp(-dt * 3));
    if (Math.abs(shTX) > 1e-3 || Math.abs(shY) > 1e-3) camera.setViewOffset(W, H, shTX * W, shY * H, W, H); else camera.clearViewOffset();
    view.draw(robot.headFrame());
    onFrame(cur, t, dur(cur));
  };
  const finishSeq = () => { if (ended) return; ended = true; chain = false; shTY = endShift; onSeqEnd(); };
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) {
      if (playing) {
        t += dt;
        if (t >= dur(cur)) { t = dur(cur); draw(dt); onEnd(cur); if (chain && cur < ids.length - 1) { start(cur + 1); } else { playing = false; if (chain) finishSeq(); } }
      }
      if (cur >= 0) draw(dt);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    play(i) { chain = false; ended = false; shTY = playShift; start(i); playing = true; },
    playAll() { chain = true; ended = false; shTY = playShift; start(0); playing = true; },
    finish() { chain = false; playing = false; start(ids.length - 1); t = dur(cur); shY = shTY = endShift; ended = true; draw(); onSeqEnd(); },   // 건너뛰기: 마지막 장면 + 끝
    seek(i, tt) { chain = false; playing = false; if (cur !== i) start(i); t = Math.min(dur(cur), Math.max(0, tt)); draw(); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    resume() { last = performance.now(); raf = requestAnimationFrame(frame); },
    state: () => ({ cur, t, playing, chain, ended, dur: dur(Math.max(0, cur)) }),
  };
}
