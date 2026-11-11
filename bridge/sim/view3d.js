// 3D 화면 (three.js). 단위: cm. 세계 좌표 (x, y평면) → three (x, z)
import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { EST, GEOM, HEAD } from './runtime.js';
import { drawFace } from './view2d.js';
import { radioCard } from './devices.js';
import { colorRGB } from './props.js';

export class View3D {
  constructor(container, world, robot) {
    this.container = container; this.world = world; this.robot = robot;
    this.follow = true; this.ready = false;
  }
  init() {
    if (this.ready) return;
    const W = this.world;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    this.container.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe6f0);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
    // 로보독 앞쪽(-z) 비스듬한 위에서 가깝게 보기
    this.camera.position.set(W.start.x + 20, 17, W.start.y - 26);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(W.start.x, 4, W.start.y);
    this.controls.minDistance = 10; this.controls.maxDistance = 400;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(40, 120, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); scene.add(sun); scene.add(sun.target); this.sun = sun;
    // 책상
    this.tableGroup = new THREE.Group(); scene.add(this.tableGroup);
    this.buildTable();
    // 장애물
    this.obsGroup = new THREE.Group(); scene.add(this.obsGroup); this.obsKey = '';
    // 경로
    this.trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2f6fe4 }));
    scene.add(this.trailLine);
    this.parts = new Map();   // 로봇 → 3D 모형
    this.buildBubble();
    this.buildDevices();
    this.ready = true;
    new ResizeObserver(() => this.resize()).observe(this.container);
    this.resize();
  }
  buildTable() {
    const W = this.world, g = this.tableGroup;
    // 그림자·조명을 공간 크기에 맞춤
    const half = Math.max(W.table.w, W.table.h) * 0.75, sc = this.sun.shadow.camera;
    this.sun.target.position.set(W.table.w / 2, 0, W.table.h / 2);
    this.sun.position.set(W.table.w / 2 - 20, 120 + half * 0.3, W.table.h / 2 + 20);
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 400 + half; sc.updateProjectionMatrix();
    while (g.children.length) g.remove(g.children[0]);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W.table.w, 3, W.table.h),
      new THREE.MeshStandardMaterial({ color: W.useTable ? 0xc9a26b : 0xbfc7d2 }));
    top.position.set(W.table.w / 2, -1.5, W.table.h / 2); top.receiveShadow = true; g.add(top);
    // 10cm 칸 격자(공간 크기에 딱 맞게)
    const pts = [];
    for (let x = 0; x <= W.table.w; x += 10) pts.push(x, 0, 0, x, 0, W.table.h);
    for (let z = 0; z <= W.table.h; z += 10) pts.push(0, 0, z, W.table.w, 0, z);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x8a6d45, transparent: true, opacity: 0.35 }));
    grid.position.y = 0.05; g.add(grid);
    if (W.useTable) {
      const legMat = new THREE.MeshStandardMaterial({ color: 0x7a5a35 });
      [[4, 4], [W.table.w - 4, 4], [4, W.table.h - 4], [W.table.w - 4, W.table.h - 4]].forEach(([x, z]) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(4, 70, 4), legMat); l.position.set(x, -38, z); g.add(l);
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W.table.w + 600, W.table.h + 600), new THREE.MeshStandardMaterial({ color: 0xaab4c0 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(W.table.w / 2, -73, W.table.h / 2); floor.receiveShadow = true; g.add(floor);
    } else {
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x8892a0 });
      [[W.table.w / 2, -1, W.table.w, 2], [W.table.w / 2, W.table.h + 1, W.table.w, 2]].forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), wallMat); m.position.set(x, 4, z); g.add(m);
      });
      [[-1, W.table.h / 2], [W.table.w + 1, W.table.h / 2]].forEach(([x, z]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2, 8, W.table.h + 4), wallMat); m.position.set(x, 4, z); g.add(m);
      });
    }
    this.tableKey = this.tableSig();
  }
  tableSig() { const W = this.world; return `${W.useTable}|${W.table.w}x${W.table.h}`; }
  // 소품: 2D와 같은 자리·크기. 상자 = 나무색 블록, 색 물체 = 색 원기둥(카드 모양 받침), 컬러칩 = 바닥에 납작하게, 검은 선 = 납작한 띠
  buildProps() {
    const g = this.obsGroup, P = this.world.props;
    while (g.children.length) { const c = g.children[0]; g.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    const col = (name) => new THREE.Color().setRGB(colorRGB(name)[0] / 255, colorRGB(name)[1] / 255, colorRGB(name)[2] / 255, THREE.SRGBColorSpace);
    for (const t of P.tracks) {
      const pts = t.closed ? t.pts.concat([t.pts[0]]) : t.pts;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 0.01) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(len + t.width * 0.3, 0.12, t.width), new THREE.MeshStandardMaterial({ color: 0x161616 }));
        m.position.set((x0 + x1) / 2, 0.08, (y0 + y1) / 2); m.rotation.y = -Math.atan2(y1 - y0, x1 - x0); m.receiveShadow = true; g.add(m);
      }
    }
    for (const c of P.chips) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.2, c.h), new THREE.MeshStandardMaterial({ color: col(c.color) }));
      m.position.set(c.x + c.w / 2, 0.12, c.y + c.h / 2); m.receiveShadow = true; g.add(m);
    }
    for (const b of P.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, 10, b.h), new THREE.MeshStandardMaterial({ color: b.label ? 0x6b4a2f : 0x9a7b55 }));
      m.position.set(b.x + b.w / 2, 5, b.y + b.h / 2); m.castShadow = true; g.add(m);
    }
    for (const o of P.objects) {
      const h = Math.max(8, o.r * 2.4);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, h, 28), new THREE.MeshStandardMaterial({ color: col(o.color), roughness: 0.5 }));
      m.position.set(o.x, h / 2, o.y); m.castShadow = true; g.add(m);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.55, o.r * 0.55, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      cap.position.set(o.x, h + 0.05, o.y); g.add(cap);
    }
  }
  makeDog() {
    const P = {};
    const dog = P.dog = new THREE.Group();
    this.scene.add(dog);
    // 비율: 코코아팹 공식 다리 시뮬레이터, 모양·배치: 제품 사진 (검은 몸통, 넓은 머리에 8×8 LED 두 개)
    const G = GEOM;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2d353f, roughness: 0.55, metalness: 0.1 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1f252c, roughness: 0.5, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.7 });
    const servoMat = new THREE.MeshStandardMaterial({ color: 0x232a32, roughness: 0.6 });
    const upperMat = new THREE.MeshStandardMaterial({ color: 0x46505d, roughness: 0.6 });
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x3a434e, roughness: 0.6 });
    P.body = new THREE.Group(); dog.add(P.body);
    // 몸통: 영상 장면처럼 뒤쪽 2/3는 둥근 덮개(통풍구), 앞쪽은 회로판이 보이는 받침
    const shellLen = G.bodyLen * 0.68, shellZ = G.bodyLen / 2 - shellLen / 2;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid, G.bodyH, shellLen - G.bodyH), bodyMat); torso.position.z = shellZ; torso.castShadow = true; P.body.add(torso);
    [-1, 1].forEach(s => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(G.bodyH / 2, G.bodyH / 2, G.bodyWid, 20), bodyMat);
      cap.rotation.z = Math.PI / 2; cap.position.z = shellZ + s * (shellLen - G.bodyH) / 2; cap.castShadow = true; P.body.add(cap);
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid * 0.9, G.bodyH * 0.55, G.bodyLen - shellLen + 0.6), darkMat);
    chassis.position.set(0, -G.bodyH * 0.1, -G.bodyLen / 2 + (G.bodyLen - shellLen) / 2); chassis.castShadow = true; P.body.add(chassis);
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid * 0.95, 0.12, G.bodyLen - shellLen), new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.8 }));
    pcb.position.set(0, G.bodyH * 0.2, -G.bodyLen / 2 + (G.bodyLen - shellLen) / 2); P.body.add(pcb);
    // 등의 통풍구 무늬
    for (let k = 0; k < 7; k++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid * 0.45, 0.05, 0.14), darkMat);
      v.position.set(0, G.bodyH / 2 + 0.02, shellZ - shellLen * 0.3 + k * 0.32); P.body.add(v);
    }
    // 마이크로비트(등 뒤쪽 슬롯)
    const mb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 3.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    mb.position.set(0, G.bodyH / 2 + 0.07, G.bodyLen * 0.3); P.body.add(mb);
    // 몸통 RGB LED (옆면 띠)
    P.ledMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
    [-1, 1].forEach(s => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, shellLen * 0.7), P.ledMat);
      strip.position.set(s * (G.bodyWid / 2 + 0.04), 0.3, shellZ); P.body.add(strip);
    });
    // 머리: 앞다리 바로 위 받침에 올린 알약형(양끝이 둥근) 머리 — 영상 장면 기준
    const head = new THREE.Group(); head.position.set(0, HEAD.up, -HEAD.fwd); P.body.add(head);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.0), darkMat); mount.position.y = -G.headH / 2 - 0.2; head.add(mount);
    const hw = G.headWid, hh = G.headH, rr = hh * 0.48;
    const shape = new THREE.Shape();
    shape.moveTo(-hw / 2 + rr, -hh / 2); shape.lineTo(hw / 2 - rr, -hh / 2);
    shape.quadraticCurveTo(hw / 2, -hh / 2, hw / 2, -hh / 2 + rr); shape.lineTo(hw / 2, hh / 2 - rr);
    shape.quadraticCurveTo(hw / 2, hh / 2, hw / 2 - rr, hh / 2); shape.lineTo(-hw / 2 + rr, hh / 2);
    shape.quadraticCurveTo(-hw / 2, hh / 2, -hw / 2, hh / 2 - rr); shape.lineTo(-hw / 2, -hh / 2 + rr);
    shape.quadraticCurveTo(-hw / 2, -hh / 2, -hw / 2 + rr, -hh / 2);
    const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: G.headDepth, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3 }), headMat);
    shell.position.z = -G.headDepth / 2; shell.castShadow = true; head.add(shell);
    // 앞면: 모서리가 둥근 LED 판 두 개 + 가운데 카메라·거리센서 (캔버스 그림)
    P.eyeCanvas = document.createElement('canvas'); P.eyeCanvas.width = 512; P.eyeCanvas.height = 224;
    P.eyeTex = new THREE.CanvasTexture(P.eyeCanvas); P.eyeTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(hw * 0.86, hh * 0.84), new THREE.MeshBasicMaterial({ map: P.eyeTex, transparent: true }));
    face.position.set(0, 0, -G.headDepth / 2 - 0.27); face.rotation.y = Math.PI; head.add(face);
    // 카메라 렌즈(살짝 튀어나옴)
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x050607, metalness: 0.7, roughness: 0.15 }));
    cam.rotation.x = Math.PI / 2; cam.position.set(0, hh * 0.18, -G.headDepth / 2 - 0.33); head.add(cam);
    // 다리: 0 왼앞,1 왼뒤,2 오른뒤,3 오른앞. 왼쪽 = -x (앞이 -z). 엉덩이: 몸 중심에서 앞뒤 ±4.6cm, 0.7cm 아래
    const pos = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
    P.legs3 = pos.map(([lr, fb]) => {
      const hip = new THREE.Group(); hip.position.set(lr * (G.bodyWid / 2 + 0.75), -(96 - 80.5) * 0.045, fb * G.hipGap / 2); P.body.add(hip);
      const servo = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 2.4), servoMat); servo.position.set(0, 0.4, 0); servo.castShadow = true; hip.add(servo);
      const legRoot = new THREE.Group(); legRoot.position.x = lr * 0.9; hip.add(legRoot);
      const thigh = new THREE.Group(); legRoot.add(thigh);
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.9, G.upper, 1.6), upperMat); up.position.y = -G.upper / 2; up.castShadow = true; thigh.add(up);
      const kneeServo = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 1.3), servoMat); kneeServo.position.y = -G.upper; thigh.add(kneeServo);
      const knee = new THREE.Group(); knee.position.y = -G.upper; thigh.add(knee);
      const low = new THREE.Mesh(new THREE.BoxGeometry(0.7, G.lower, 0.95), lowerMat); low.position.y = -G.lower / 2; low.castShadow = true; knee.add(low);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), darkMat); foot.position.y = -G.lower; foot.castShadow = true; knee.add(foot);
      return { hip: thigh, knee };
    });
    return P;
  }
  buildBubble() {
    // 말풍선(스프라이트)
    this.bubbleCanvas = document.createElement('canvas'); this.bubbleCanvas.width = 256; this.bubbleCanvas.height = 64;
    this.bubbleTex = new THREE.CanvasTexture(this.bubbleCanvas);
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex, depthTest: false }));
    this.bubble.scale.set(16, 4, 1); this.bubble.visible = false; this.scene.add(this.bubble);
    this.lastBubble = null;
  }
  // 코드에 필요한 장치를 장면에 함께 보여 줌: 거리센서 빔, AI 신호 카드, 본체 버튼 표시
  label(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.visible = false; sp.renderOrder = 5; this.scene.add(sp);
    return { c, tex, sp, key: '' };
  }
  buildDevices() {
    this.beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineDashedMaterial({ color: 0xe5484d, dashSize: 1.2, gapSize: 0.8, depthTest: false, transparent: true }));
    this.beam.visible = false; this.beam.renderOrder = 4; this.scene.add(this.beam);
    this.hitDot = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe5484d, depthTest: false }));
    this.hitDot.visible = false; this.hitDot.renderOrder = 4; this.scene.add(this.hitDot);
    this.tofTag = this.label(256, 96); this.tofTag.sp.scale.set(6, 2.25, 1);
    this.card = this.label(320, 260); this.card.sp.scale.set(8, 6.5, 1);
    this.btnTag = this.label(300, 90); this.btnTag.sp.scale.set(7, 2.1, 1);
    // AI 카메라 시야(추정 ±30°·100cm): 바닥에 깔리는 부채꼴
    const C = EST.aiCam, fan = new THREE.Mesh(new THREE.CircleGeometry(C.maxCm, 28, Math.PI / 2 - C.halfFovDeg * Math.PI / 180, 2 * C.halfFovDeg * Math.PI / 180),
      new THREE.MeshBasicMaterial({ color: 0x2456e5, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    fan.rotation.x = -Math.PI / 2; this.camFan = new THREE.Group(); this.camFan.add(fan); this.camFan.visible = false; this.camFan.position.y = 0.3; this.scene.add(this.camFan);
  }
  paint(L, key, fn) { if (L.key === key) return; L.key = key; const x = L.c.getContext('2d'); x.clearRect(0, 0, L.c.width, L.c.height); fn(x, L.c.width, L.c.height); L.tex.needsUpdate = true; }
  drawDevices(R, y) {
    const W = this.world, devs = W.devices || [], now = performance.now();
    const rad = R.heading * Math.PI / 180, fx = Math.sin(rad), fz = -Math.cos(rad), sx = Math.cos(rad), sz = Math.sin(rad);
    // 거리센서: 코에서 앞으로 재는 선과 값
    const tofOn = devs.includes('tof') && !R.fallen;
    this.beam.visible = this.hitDot.visible = this.tofTag.sp.visible = tofOn;
    if (tofOn) {
      const d = R.tof(), off = EST.noseOffset, hy = y + 1.5;
      const a = new THREE.Vector3(R.x + fx * off, hy, R.y + fz * off), b = new THREE.Vector3(R.x + fx * (off + Math.min(d, 120)), hy, R.y + fz * (off + Math.min(d, 120)));
      this.beam.geometry.setFromPoints([a, b]); this.beam.computeLineDistances();
      this.hitDot.position.copy(b); this.hitDot.visible = d < EST.tofMax;
      const tl = Math.min(d, 120) * 0.2; this.tofTag.sp.position.set(a.x + fx * tl, hy + 2.5, a.z + fz * tl);
      this.paint(this.tofTag, String(d), (x, w, h) => {
        x.fillStyle = 'rgba(229,72,77,.95)'; x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 30); x.fill();
        x.fillStyle = '#fff'; x.font = 'bold 50px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(d >= EST.tofMax ? '거리 없음' : '거리 ' + d, w / 2, h / 2 + 2);
      });
    }
    // AI 카메라 시야
    const camOn = !!(W.camView || R.aiMode === 3) && !R.fallen;
    this.camFan.visible = camOn;
    if (camOn) { this.camFan.position.set(R.x + fx * EST.noseOffset, 0.3, R.y + fz * EST.noseOffset); this.camFan.rotation.y = -rad; }
    // AI 신호 카드: 라디오로 받은 마지막 숫자를 카드 색으로
    const radioOn = devs.includes('radio');
    this.card.sp.visible = radioOn;
    if (radioOn) {
      const rl = W.radioLast, age = rl ? now - rl.t : 1e9, fresh = age < 600;
      this.card.sp.position.set(R.x - sx * 9 + fx * 12, y + 3, R.y - sz * 9 + fz * 12);
      this.paint(this.card, (rl ? rl.n : '-') + (fresh ? '!' : ''), (x, w, h) => {
        x.fillStyle = 'rgba(255,255,255,.96)'; x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 24); x.fill();
        x.strokeStyle = fresh ? '#2456e5' : '#c9d1dd'; x.lineWidth = fresh ? 10 : 4; x.stroke();
        x.fillStyle = '#4b5565'; x.font = 'bold 30px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('받은 숫자', w / 2, 36);
        if (rl) {
          const cd = radioCard(rl.n);
          x.fillStyle = cd.color; x.beginPath(); x.roundRect(40, 66, w - 80, 150, 18); x.fill();
          x.fillStyle = cd.ink; x.font = 'bold 74px system-ui'; x.fillText(String(rl.n), w / 2, 126);
          x.font = 'bold 34px system-ui'; x.fillText(cd.name, w / 2, 190);
        } else { x.fillStyle = '#7a8499'; x.font = 'bold 32px system-ui'; x.fillText('아직 없음', w / 2, 120); x.font = '24px system-ui'; x.fillText('라디오 숫자를 보내 보세요', w / 2, 170); }
      });
    }
    // 본체 버튼: 누르면 파랗게
    const btnOn = devs.includes('button');
    this.btnTag.sp.visible = btnOn;
    if (btnOn) {
      const pressed = (W.btnT || 0) > now - 400;
      this.btnTag.sp.position.set(R.x + sx * 11 - fx * 4, y - 1, R.y + sz * 11 - fz * 4);
      this.paint(this.btnTag, pressed ? 'on' : 'off', (x, w, h) => {
        x.fillStyle = pressed ? 'rgba(36,86,229,.97)' : 'rgba(255,255,255,.92)'; x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 40); x.fill();
        x.fillStyle = pressed ? '#fff' : '#1d2433'; x.font = 'bold 40px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(pressed ? '본체 버튼 눌림!' : '본체 버튼', w / 2, h / 2 + 2);
      });
    }
  }
  resize() {
    if (!this.ready) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  updateEyes(P, frames) {
    const key = JSON.stringify(frames) + getComputedStyle(document.documentElement).getPropertyValue('--eye-on');
    if (key === P.eyeKey) return;          // 바뀔 때만 다시 그림(여러 대일 때 부담 줄이기)
    P.eyeKey = key;
    const c = P.eyeCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFace(ctx, c.width, c.height, frames);
    P.eyeTex.needsUpdate = true;
  }
  drawRobot(R, frames) {
    let P = this.parts.get(R);
    if (!P) { P = this.makeDog(); this.parts.set(R, P); }
    const pose = R.bodyPose();
    const y = R.fallen ? -60 : pose.center;   // 몸 중심 높이(가장 낮은 점이 바닥에 닿도록 계산됨)
    P.dog.position.set(R.x, y, R.y);
    P.dog.rotation.set(0, -R.heading * Math.PI / 180, R.fallen ? Math.PI / 2 : 0);
    P.body.rotation.x = pose.pitch;   // 앞(-z)이 높으면 +
    R.legs.forEach((lg, i) => { P.legs3[i].hip.rotation.x = lg.sh; P.legs3[i].knee.rotation.x = lg.kn; });
    const [r, g, b] = R.bodyLed;
    P.ledMat.color.setRGB(r / 255 * 0.6 + 0.2, g / 255 * 0.6 + 0.2, b / 255 * 0.6 + 0.2);
    P.ledMat.emissive.setRGB(r / 255, g / 255, b / 255);
    this.updateEyes(P, frames);
    return y;
  }
  draw(eyeFrames) {
    if (!this.ready) return;
    const R = this.robot, W = this.world;
    if (this.tableKey !== this.tableSig()) this.buildTable();
    const key = JSON.stringify(W.props);
    if (key !== this.obsKey) { this.obsKey = key; this.buildProps(); }
    const pts = R.trail.map(p => new THREE.Vector3(p.x, 0.2, p.y)); pts.push(new THREE.Vector3(R.x, 0.2, R.y));
    this.trailLine.geometry.setFromPoints(pts);
    // 로봇들 위치·방향·자세 (군무 중이면 여러 대)
    const robots = [R, ...(W.extra || [])];
    for (const [k, P] of this.parts) if (!robots.includes(k)) { this.scene.remove(P.dog); this.parts.delete(k); }
    (W.extra || []).forEach(R2 => this.drawRobot(R2, R2.headFrame()));
    const y = this.drawRobot(R, eyeFrames);
    this.drawDevices(R, y);
    // 말풍선
    if (R.bubble) {
      if (this.lastBubble !== R.bubble) {
        const c = this.bubbleCanvas, ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(2, 2, c.width - 4, c.height - 4, 26); ctx.fill();
        ctx.fillStyle = '#1d2433'; ctx.font = 'bold 36px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(R.bubble, c.width / 2, c.height / 2);
        this.bubbleTex.needsUpdate = true; this.lastBubble = R.bubble;
      }
      this.bubble.visible = true; this.bubble.position.set(R.x, y + 12, R.y);
    } else { this.bubble.visible = false; this.lastBubble = null; }
    if (this.follow && !R.fallen) {
      const t = this.controls.target, dx = R.x - t.x, dz = R.y - t.z;
      t.x += dx * 0.08; t.z += dz * 0.08; this.camera.position.x += dx * 0.08; this.camera.position.z += dz * 0.08;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
