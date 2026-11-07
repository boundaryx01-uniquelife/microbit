// 3D 화면 (three.js). 단위: cm. 세계 좌표 (x, y평면) → three (x, z)
import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { EST, GEOM, HEAD } from './runtime.js';
import { drawFace } from './view2d.js';

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
    sun.shadow.camera.left = -100; sun.shadow.camera.right = 100; sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
    sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    // 책상
    this.tableGroup = new THREE.Group(); scene.add(this.tableGroup);
    this.buildTable();
    // 장애물
    this.obsGroup = new THREE.Group(); scene.add(this.obsGroup); this.obsKey = '';
    // 경로
    this.trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2f6fe4 }));
    scene.add(this.trailLine);
    this.buildDog();
    this.ready = true;
    new ResizeObserver(() => this.resize()).observe(this.container);
    this.resize();
  }
  buildTable() {
    const W = this.world, g = this.tableGroup;
    while (g.children.length) g.remove(g.children[0]);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W.table.w, 3, W.table.h),
      new THREE.MeshStandardMaterial({ color: W.useTable ? 0xc9a26b : 0xbfc7d2 }));
    top.position.set(W.table.w / 2, -1.5, W.table.h / 2); top.receiveShadow = true; g.add(top);
    const grid = new THREE.GridHelper(Math.max(W.table.w, W.table.h), Math.max(W.table.w, W.table.h) / 10, 0x8a6d45, 0x9e8257);
    grid.position.set(W.table.w / 2, 0.05, W.table.h / 2); grid.material.opacity = 0.35; grid.material.transparent = true; g.add(grid);
    if (W.useTable) {
      const legMat = new THREE.MeshStandardMaterial({ color: 0x7a5a35 });
      [[4, 4], [W.table.w - 4, 4], [4, W.table.h - 4], [W.table.w - 4, W.table.h - 4]].forEach(([x, z]) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(4, 70, 4), legMat); l.position.set(x, -38, z); g.add(l);
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0xaab4c0 }));
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
    this.tableKey = W.useTable;
  }
  buildDog() {
    const dog = this.dog = new THREE.Group();
    this.scene.add(dog);
    // 비율: 코코아팹 공식 다리 시뮬레이터, 모양·배치: 제품 사진 (검은 몸통, 넓은 머리에 8×8 LED 두 개)
    const G = GEOM;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2d353f, roughness: 0.55, metalness: 0.1 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1f252c, roughness: 0.5, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.7 });
    const servoMat = new THREE.MeshStandardMaterial({ color: 0x232a32, roughness: 0.6 });
    const upperMat = new THREE.MeshStandardMaterial({ color: 0x46505d, roughness: 0.6 });
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x3a434e, roughness: 0.6 });
    this.body = new THREE.Group(); dog.add(this.body);
    // 몸통: 영상 장면처럼 뒤쪽 2/3는 둥근 덮개(통풍구), 앞쪽은 회로판이 보이는 받침
    const shellLen = G.bodyLen * 0.68, shellZ = G.bodyLen / 2 - shellLen / 2;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid, G.bodyH, shellLen - G.bodyH), bodyMat); torso.position.z = shellZ; torso.castShadow = true; this.body.add(torso);
    [-1, 1].forEach(s => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(G.bodyH / 2, G.bodyH / 2, G.bodyWid, 20), bodyMat);
      cap.rotation.z = Math.PI / 2; cap.position.z = shellZ + s * (shellLen - G.bodyH) / 2; cap.castShadow = true; this.body.add(cap);
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid * 0.9, G.bodyH * 0.55, G.bodyLen - shellLen + 0.6), darkMat);
    chassis.position.set(0, -G.bodyH * 0.1, -G.bodyLen / 2 + (G.bodyLen - shellLen) / 2); chassis.castShadow = true; this.body.add(chassis);
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid * 0.95, 0.12, G.bodyLen - shellLen), new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.8 }));
    pcb.position.set(0, G.bodyH * 0.2, -G.bodyLen / 2 + (G.bodyLen - shellLen) / 2); this.body.add(pcb);
    // 등의 통풍구 무늬
    for (let k = 0; k < 7; k++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(G.bodyWid * 0.45, 0.05, 0.14), darkMat);
      v.position.set(0, G.bodyH / 2 + 0.02, shellZ - shellLen * 0.3 + k * 0.32); this.body.add(v);
    }
    // 마이크로비트(등 뒤쪽 슬롯)
    const mb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 3.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    mb.position.set(0, G.bodyH / 2 + 0.07, G.bodyLen * 0.3); this.body.add(mb);
    // 몸통 RGB LED (옆면 띠)
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
    [-1, 1].forEach(s => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, shellLen * 0.6), this.ledMat);
      strip.position.set(s * (G.bodyWid / 2 + 0.04), 0.3, shellZ); this.body.add(strip);
    });
    // 머리: 앞다리 바로 위 받침에 올린 알약형(양끝이 둥근) 머리 — 영상 장면 기준
    const head = new THREE.Group(); head.position.set(0, HEAD.up, -HEAD.fwd); this.body.add(head);
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
    this.eyeCanvas = document.createElement('canvas'); this.eyeCanvas.width = 512; this.eyeCanvas.height = 224;
    this.eyeTex = new THREE.CanvasTexture(this.eyeCanvas); this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(hw * 0.86, hh * 0.84), new THREE.MeshBasicMaterial({ map: this.eyeTex, transparent: true }));
    face.position.set(0, 0, -G.headDepth / 2 - 0.27); face.rotation.y = Math.PI; head.add(face);
    // 카메라 렌즈(살짝 튀어나옴)
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x050607, metalness: 0.7, roughness: 0.15 }));
    cam.rotation.x = Math.PI / 2; cam.position.set(0, hh * 0.18, -G.headDepth / 2 - 0.33); head.add(cam);
    // 다리: 0 왼앞,1 왼뒤,2 오른뒤,3 오른앞. 왼쪽 = -x (앞이 -z). 엉덩이: 몸 중심에서 앞뒤 ±4.6cm, 0.7cm 아래
    const pos = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
    this.legs3 = pos.map(([lr, fb]) => {
      const hip = new THREE.Group(); hip.position.set(lr * (G.bodyWid / 2 + 0.75), -(96 - 80.5) * 0.045, fb * G.hipGap / 2); this.body.add(hip);
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
    // 말풍선(스프라이트)
    this.bubbleCanvas = document.createElement('canvas'); this.bubbleCanvas.width = 256; this.bubbleCanvas.height = 64;
    this.bubbleTex = new THREE.CanvasTexture(this.bubbleCanvas);
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex, depthTest: false }));
    this.bubble.scale.set(16, 4, 1); this.bubble.visible = false; this.scene.add(this.bubble);
    this.lastBubble = null;
  }
  resize() {
    if (!this.ready) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  updateEyes(frames) {
    const c = this.eyeCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFace(ctx, c.width, c.height, frames);
    this.eyeTex.needsUpdate = true;
  }
  draw(eyeFrames) {
    if (!this.ready) return;
    const R = this.robot, W = this.world;
    if (this.tableKey !== W.useTable) this.buildTable();
    const key = JSON.stringify(W.obstacles);
    if (key !== this.obsKey) {
      this.obsKey = key;
      while (this.obsGroup.children.length) this.obsGroup.remove(this.obsGroup.children[0]);
      W.obstacles.forEach(o => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(o.w, 10, o.h), new THREE.MeshStandardMaterial({ color: 0xe5484d }));
        m.position.set(o.x + o.w / 2, 5, o.y + o.h / 2); m.castShadow = true; this.obsGroup.add(m);
      });
    }
    const pts = R.trail.map(p => new THREE.Vector3(p.x, 0.2, p.y)); pts.push(new THREE.Vector3(R.x, 0.2, R.y));
    this.trailLine.geometry.setFromPoints(pts);
    // 로봇 위치·방향·자세
    const pose = R.bodyPose();
    let y = pose.center;   // 몸 중심 높이(가장 낮은 점이 바닥에 닿도록 계산됨)
    if (R.fallen) y = -60;
    this.dog.position.set(R.x, y, R.y);
    this.dog.rotation.set(0, -R.heading * Math.PI / 180, R.fallen ? Math.PI / 2 : 0);
    this.body.rotation.x = pose.pitch;   // 앞(-z)이 높으면 +
    R.legs.forEach((lg, i) => {
      // 어깨각: 앞(+)으로 → 다리가 -z 쪽으로 기울도록
      this.legs3[i].hip.rotation.x = lg.sh;
      this.legs3[i].knee.rotation.x = lg.kn;
    });
    const [r, g, b] = R.bodyLed;
    this.ledMat.color.setRGB(r / 255 * 0.6 + 0.2, g / 255 * 0.6 + 0.2, b / 255 * 0.6 + 0.2);
    this.ledMat.emissive.setRGB(r / 255, g / 255, b / 255);
    this.updateEyes(eyeFrames);
    // 말풍선
    if (R.bubble) {
      if (this.lastBubble !== R.bubble) {
        const c = this.bubbleCanvas, ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(0, 0, c.width, c.height);
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
