// 3D 화면 (three.js). 단위: cm. 세계 좌표 (x, y평면) → three (x, z)
import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { EST } from './runtime.js';

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
    this.camera.position.set(W.start.x + 32, 30, W.start.y - 42);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(W.start.x, 6, W.start.y);
    this.controls.minDistance = 15; this.controls.maxDistance = 400;
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
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.6 });
    this.body = new THREE.Group(); dog.add(this.body);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(EST.bodyWid, 5, EST.bodyLen), bodyMat); torso.castShadow = true;
    this.body.add(torso);
    // 몸통 LED 띠
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(EST.bodyWid + 0.4, 1, EST.bodyLen * 0.8), this.ledMat);
    strip.position.y = 1.2; this.body.add(strip);
    // 마이크로비트 자리
    const mb = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 4), darkMat); mb.position.set(0, 2.7, 1); this.body.add(mb);
    // 머리 (앞 = -z)
    const head = new THREE.Group(); head.position.set(0, 3.5, -EST.bodyLen / 2 - 1); this.body.add(head);
    const hm = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 5), bodyMat); hm.castShadow = true; head.add(hm);
    this.eyeCanvas = document.createElement('canvas'); this.eyeCanvas.width = 160; this.eyeCanvas.height = 64;
    this.eyeTex = new THREE.CanvasTexture(this.eyeCanvas); this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    this.eyeTex.magFilter = THREE.NearestFilter;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.6), new THREE.MeshBasicMaterial({ map: this.eyeTex }));
    face.position.set(0, 0.6, -2.51); face.rotation.y = Math.PI; head.add(face);
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.4), darkMat); sensor.position.set(0, -1.8, -2.6); head.add(sensor);
    // 다리: 0 왼앞,1 왼뒤,2 오른뒤,3 오른앞. 왼쪽 = -x (앞이 -z일 때)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3b4a5c, roughness: 0.6 });
    const pos = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
    this.legs3 = pos.map(([lr, fb]) => {
      const hip = new THREE.Group(); hip.position.set(lr * (EST.bodyWid / 2 + 0.8), -1.5, fb * (EST.bodyLen / 2 - 2)); this.body.add(hip);
      const up = new THREE.Mesh(new THREE.BoxGeometry(1.4, EST.upperLeg, 1.4), legMat); up.position.y = -EST.upperLeg / 2; up.castShadow = true; hip.add(up);
      const knee = new THREE.Group(); knee.position.y = -EST.upperLeg; hip.add(knee);
      const low = new THREE.Mesh(new THREE.BoxGeometry(1.2, EST.lowerLeg, 1.2), legMat); low.position.y = -EST.lowerLeg / 2; low.castShadow = true; knee.add(low);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), darkMat); foot.position.y = -EST.lowerLeg; knee.add(foot);
      return { hip, knee };
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
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, c.width, c.height);
    const cell = 7, gap = 20, x0 = (c.width - (16 * cell + gap)) / 2, y0 = (c.height - 8 * cell) / 2;
    // 얼굴 평면은 뒤집혀 있으므로 [오른눈, 왼눈] 순서로 그리면 앞에서 볼 때 맞게 보임
    [frames[1], frames[0]].forEach((m, e) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        ctx.fillStyle = m[y][x] ? '#5fd3ff' : '#1d2730';
        ctx.fillRect(x0 + e * (8 * cell + gap) + x * cell + 1, y0 + y * cell + 1, cell - 2, cell - 2);
      }
    });
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
    let y = pose.height + 2.4;   // 엉덩이(몸통 중심 -1.5) + 발 반지름
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
