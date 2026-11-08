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

export const DUR = 3;
export const CLIPS = [
  { id: 'cinema', title: '시네마틱 단편', sub: '햇빛 · 먼지 · 블룸', tech: '빛줄기, 먼지 입자, LED 눈 블룸, 비네팅, 필름 입자, 카메라 줌' },
  { id: 'ai-eye', title: 'AI의 눈', sub: '데이터가 모여 인식되는 순간', tech: '점 구름 군집화, 인식 박스, 신호 펄스, 블룸' },
  { id: 'type', title: '키네틱 타이포', sub: '보고 · 전하고 · 움직인다', tech: '글자 판 모션(오버슈트), 셰이더 배경, 색수차 충격' },
  { id: 'diorama', title: '미니어처 마을', sub: '로보독이 일하는 마을', tech: '틸트시프트 흐림, 창문 점등, 천천히 도는 카메라' },
  { id: 'split', title: '코드 ↔ 동작', sub: '블록이 켜지면 로보독이 움직여요', tech: '블록 코드 순차 점등 + 시뮬레이터 실행기 동기화' },
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
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.5 }, grain: { value: 0.05 }, aberr: { value: 0.0015 }, tilt: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, res: { value: new THREE.Vector2(1280, 720) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain, aberr, tilt; uniform vec3 tint; uniform vec2 res; varying vec2 vUv;
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
      float g = fract(sin(dot(uv * res + time, vec2(12.9898, 78.233))) * 43758.5453); col += (g - 0.5) * grain;
      col *= 1.0 - vignette * smoothstep(0.3, 0.95, length(d) * 1.3);
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

export async function createSamples({ host, onClip = () => {}, onFrame = () => {}, onEnd = () => {} }) {
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
        m.scale.setScalar(k * (1 + out * 0.5)); m.rotation.z = lerp(-0.35, 0, ease(inn)) + out * 0.25; m.position.set(lerp(-26, 0, ease(inn)) - out * 40, 6 + Math.sin(t * 2 + i) * 0.4, 0);
        if (t >= a && t < a + 0.35) pulse = Math.max(pulse, 1 - (t - a) / 0.35);
      });
      grade.uniforms.aberr.value = 0.001 + 0.012 * pulse; bloom.strength = 0.25 + 0.45 * pulse;
      rig.position.set(lerp(-62, -8, ease(fade(t, 1.95, 3))) + 72 * 0.55, -13.5, -60 * 0.55);   // 글자 아래를 오른쪽으로 걸어 들어옴
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

  // ---------- 재생 ----------
  let cur = -1, t = 0, playing = false, chain = false, raf = 0, last = performance.now(), shTX = 0;
  const idOf = (i) => CLIPS[i].id;
  const start = (i) => {
    cur = i; t = 0; clearClip(); rig.visible = true; resetSim(); pin = null; events = [];
    camera.fov = 45; bloom.strength = 0.8;
    clips[idOf(i)].setup(); shTX = idOf(i) === 'split' ? -0.2 : 0;
    onClip(i, CLIPS[i]);
  };
  const draw = (dt = 0.016) => {
    const c = clips[idOf(cur)];
    simTo(t); c.update(t);
    grade.uniforms.time.value = (performance.now() % 1000) / 1000 + t;
    const W = host.clientWidth || 1, H = host.clientHeight || 1;
    if (shTX) camera.setViewOffset(W, H, shTX * W, 0, W, H); else camera.clearViewOffset();
    view.draw(robot.headFrame());
    onFrame(cur, t);
  };
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) {
      if (playing) { t += dt; if (t >= DUR) { t = DUR; playing = false; draw(dt); onEnd(cur); if (chain && cur < CLIPS.length - 1) { start(cur + 1); playing = true; } else chain = false; } }
      if (cur >= 0) draw(dt);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    play(i) { chain = false; start(i); playing = true; },
    playAll() { chain = true; start(0); playing = true; },
    seek(i, tt) { chain = false; playing = false; if (cur !== i) start(i); t = Math.min(DUR, Math.max(0, tt)); draw(); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    resume() { last = performance.now(); raf = requestAnimationFrame(frame); },
    state: () => ({ cur, t, playing, chain }),
  };
}
