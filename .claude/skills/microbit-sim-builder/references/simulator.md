# ① 시뮬레이터 — 구조와 새 교구 이식

대상: `bridge/sim/` (정적 ES 모듈, 빌드 없음. 서버: `cd bridge && python3 -m http.server 8765` → `/sim/`)

## 1. 아키텍처 맵

### 파일별 책임
| 파일 | 책임 | 주요 심볼 |
|---|---|---|
| `bridge/sim/runtime.js` (682줄) | 상수·로봇 상태·세계·컴파일·실행기·블록 API 전부 | `EST`, `Robot`, `World`, `compile(src)`, `ensureBabel()`, `makeRobodogApi(R,h)`, `Runner`, `ASYNC_NS`, `EXPRESSIONS`, `ICONS`, `FONT`, `SOUNDS`, `playTones` |
| `bridge/sim/legs.js` (99줄) | 네발 다리 역·정기구학(공식 표본 보간). **바퀴 로봇엔 불필요** | `GEOM`, `HEAD`, `lengthToAngles(h,fb)`, `legFromAngles(sh,kn)` |
| `bridge/sim/view2d.js` | 위에서 본 평면(경로·장애물 클릭 배치) + 옆모습 + 눈 LED 캔버스 | `View2D(top,side,world,robot).draw()/scale()/onClick()`, `drawFace`, `drawEyes(canvas, frames)` |
| `bridge/sim/view3d.js` | three.js 3D (지연 import). 책상·장애물·로봇 메시·거리선·AI 카드·말풍선 | `View3D(container,world,robot).init()/draw(eyeFrames)/resize()`, `drawRobot`, `drawDevices`, `buildTable` |
| `bridge/sim/devices.js` (56줄) | 코드 정적 분석 → 필요한 장치·패널 | `DEVICE_INFO`, `detectDevices(code)`(정규식), `radioCard(n)`, `runHint(devs)` |
| `bridge/sim/index.html` (1012줄) | 모든 배선: 에디터(MakeCode iframe + JS textarea), 실행/정지, 2D/3D 탭, 패널, 라디오·AI 브리지, 공간 크기, 시연(DEMOS), 도우미 | 인라인 `<script type=module>`, `window.__sim` |
| `bridge/sim/assistant.js` | 말로 코드 만들기(규칙 기반 + 서버 AI). 시뮬레이터 코어와 독립 | `ruleAssistant`, `askAi` |
| `bridge/sim/examples.js` | **자동 생성** (`node tests/build-sim-examples.js`: `makecode/*.ts` → `EXAMPLES`,`GROUPS`). 직접 수정 금지 | `{id,group,order,title,level,sim[],real[],code}` |
| `bridge/sim/lib/` | `babel.min.js`(2.8MB, 지연 로드), `OrbitControls.js`; three는 importmap |

### 데이터 흐름
```
학생 코드(MakeCode 블록 iframe ─pxteditor postMessage→ #code textarea(JS)) 또는 예제/도우미가 #code 에 대입
  │  btnRun / (블록 수정 1.2s 뒤 mcAutoRun)
  ▼ runCode(code): robot.reset(); runner.stop(); applyDevices(code)  ← detectDevices → world.devices, 패널 강조, 장애물 자동 배치
  ▼ runner.start(src): ensureBabel → compile(src) → new Function(...envNames, code)(...envValues) → mainFactory
       compile = `async function __main(){src}` + Babel(typescript preset + 자체 플러그인)
         · 모든 FunctionDeclaration → async
         · ASYNC_NS 네임스페이스 API 콜백(function/arrow) → async
         · async 함수 안의 모든 CallExpression → `await call` (ASYNC_NS 여부 무관, 전부)
         · 모든 while/for/do/for-of/for-in 본문 맨앞에 `await __yield()` 삽입
  ▼ spawn(() => mainFactory())  (Promise.resolve().then → 별도 fiber 흉내)
  ▼ 스케줄링 = 협동형 async/await (시간분할 아님, 스레드 없음)
       - sleep(ms)=setTimeout Promise; running/gen 이 바뀌었으면 reject(StopSignal) → 모든 대기 즉시 중단
       - yieldNow(): check() 후 100번째마다 sleep(0) → `while(true){}` 도 화면 안 멈춤
       - basic.forever(fn): spawn(loop: check→await fn→sleep(20))   loops.everyInterval 동일
       - input.onButtonPressed/radio.onReceived*: handlers[...] 에 push; 외부 이벤트 시 runner.press/radioReceive → 핸들러마다 spawn
       - control.inBackground → spawn. 모든 spawn 은 gen 을 캡처, 에러는 onError 가 StopSignal/옛 gen 이면 무시
  ▼ API 호출(robodog.move 등) → Robot 필드만 바꿈(명령은 "목표 상태" 설정이지 즉시 이동 아님)
  ▼ requestAnimationFrame frame(now) (index.html ~l.553): dt=min(0.05,Δ) → robot.step(dt) (+ world.extra[].step)
       step: 회전(rotTarget 추종, EST.turnDegPerSecAt100) → 이동(EST.walkCmPerSecAt100) → world.collides? bumped : 이동 → trail → world.offTable? fallen=true
              → 관절은 서보 속도(EST.servoDegPerSec)로 목표를 따라감 → legs 갱신
       fallen 이면 frame 이 runner.stop() + 오류 로그
  ▼ view3d.draw(eyes)/view2d.draw() + drawEyes + drawLed(5x5) + 센서 패널(sTof,sHead,sMode,sVel) 텍스트 갱신
```
**시간 모델**: 코드 쪽은 벽시계(`setTimeout`, `performance.now`), 물리는 rAF dt(최대 50ms 클램프). 즉 코드의 `pause(1000)` 동안 물리가 1초 흐른다(탭 백그라운드면 dt 클램프로 느려짐 → 테스트는 headless 에서 rAF 가 돌아야 함).

**EST 상수** (`runtime.js` 11행, 모두 "추정치" 명시, 실물 측정 후 조정): `walkCmPerSecAt100`=15, `turnDegPerSecAt100`=120, `servoDegPerSec`=450, `bodyLen/Wid`, `upperLeg/lowerLeg`, `noseOffset`(몸 중심→센서), `tofMax`=255(0 이 아니라 255=없음), `radius`=7(충돌 반경). 파일 머리 주석과 docs 에 "추정" 고지 → 새 교구도 같은 원칙(실측 전까지 추정 표기) 유지.

**결정성/시험 훅**: `window.__sim = { runner, robot, world, showTab, showCodeTab, mcState(), playDemo(i), stopDemo, view3d(), aiMode() }` (index.html 마지막 줄). 시험은 이 객체로 상태(`robot.x/y/heading/vel/mode/posture/bodyLed/fallen/joint`)를 직접 읽고, `world.obstacles`를 직접 조작한다. URL 파라미터: `?demo=0|1`(자동 시연), `?tab=js`(MakeCode 대신 JS 탭), `?view=2d`. 난수는 `randint` 가 `Math.random` 그대로라 결정적이지 않음(시험은 허용 오차로 확인).

### 장치/패널
- `detectDevices`: 주석·문자열 제거(`strip`) 후 정규식 → `['tof','radio','button','mbBtn','battery','tilt','sound','mbLed','fixed','aicam']`. `applyDevices`가 world.devices 설정, "필요한 장치" 버튼 목록, 관련 패널(`#pMb,#pRadio,#pSensor,#pEnv`) `need-on/need-off`, 거리센서 코드면 `frontObstacle()` 자동 배치, 빠른 조작줄(`#quick`) 노출. 3D `drawDevices` 도 `world.devices` 를 보고 빔·카드·버튼 표시.
- 라디오: UI 숫자 버튼/반복 전송(setInterval 500ms) → `runner.radioReceive(n)`. **AI 브리지 연동**: `new BroadcastChannel('robodog-ai-bridge')` 의 `{n:number}` 메시지 → `runner.radioReceive(n)` (체크박스 `#bridgeLink`). ai.html 이 같은 채널에 송신(같은 컴퓨터·같은 브라우저 한정).
- 공간 크기: `#spaceSize` (120x80/200x140/300x200) → `applySpace` → `world.setSize(w,h)`(start 위치 재계산), 장애물 비움, `robot.reset()`, 카메라 이동; `localStorage['sim-space']` 기억. 책상/바닥 토글 = `world.useTable`(true: 가장자리 낙하 `fallen`, false: 벽 충돌).
- 2D/3D: `showTab(is3d)`; 3D 는 `import('./view3d.js')` 지연 + 실패 시 2D 폴백(WebGL 없는 환경).

## 2. 새 교구용 확장 지점

### 교체해야 하는 것 (파일 → 항목)
1. **블록 API 객체**: `runtime.js` `makeRobodogApi(R,h)` → `makeMaqueenApi(R,h)`. 그리고 `buildEnv()`의 `robodog = warnProxy('robodog', ...)`, `deflib`(enum: `Posture, LegGroup, ... SoundEffect`)를 새 확장의 네임스페이스·enum 이름으로. MakeCode 확장 블록의 실제 JS 이름(예 `maqueenPlusV2.controlMotor(...)`, `maqueenPlusV2.readUltrasonic(...)`)은 확장 `.ts`/`pxt.json` 에서 그대로 확인. 모르는 멤버는 `warnProxy` 가 "지원하지 않는 블록" 경고 후 0 반환 → 누락이 크래시가 아닌 경고가 됨(유지할 것).
2. **ASYNC_NS** (`runtime.js` 331행): 새 네임스페이스를 반드시 추가해야 콜백(`onReceived…`, 확장 이벤트 핸들러)이 async 로 변환됨. 새 확장 네임스페이스(예 `maqueenPlusV2`, `neopixel`, `sensors`)를 넣지 않으면 핸들러 안의 `pause`가 `await` 안 됨 → "await is only valid" 문법 오류. (CallExpression 의 await 삽입은 이름 무관이라 호출 자체는 문제없고, **콜백 함수의 async 승격**만 ASYNC_NS 로 판단.) 단 `strip` 한 변수 함수를 콜백으로 넘기는 경우는 FunctionDeclaration 규칙으로 처리.
3. **Robot 상태 필드** (`Robot.reset`): 4족 전용(`mode, walkH, legHF, motorA, posture, joint, legs, raised, headMode/headL/headR/expr`) 삭제 → 바퀴 상태(3절). 공용으로 유지: `x,y,heading,trail,fallen,bumped,bodyLed(→ RGB 배열),bubble/bubbleT`.
4. **운동학·모션**: `legs.js` 전체 제거, `Robot.targets/postureTarget/step/bodyPose` 교체.
5. **센서**: `Robot.tof()` → `ultrasonic()`, `lineSensors()`; `World.raycast` 재사용/수정.
6. **뷰**: `View2D.drawRobotTop/drawSide`, `View3D.makeDog/drawRobot/updateEyes/buildDevices/drawDevices` 를 차체·바퀴·센서 빔·LED 로. `drawFace/drawEyes`(8x8 눈)는 삭제 또는 RGB LED 표시로 대체.
7. **devices.js**: `DEVICE_INFO` 항목과 `detectDevices` 정규식을 새 API 이름으로(`/maqueen\w*\.(readUltrasonic|ultrasonic)\s*\(/ → 'sonar'`, `/readLineSensor|lineSensor/ → 'line'`, `/setIndexColor|setRGB|rgb/ → 'rgb'`). `DEVICE_INFO.panel`/`index.html` 의 패널 id 와 일치해야 함. `radioCard`(1빨강…) 는 AI 브리지 약속이 같으면 유지.
8. **index.html**: 패널 HTML(`pSensor`의 거리·방향·모드·속도 표시, 빠른 조작 `qBody`(본체 버튼), `MODES` 배열), 헤더 제목/문구, `loadExtension` 선택 로직(`robodog` vs `robodog-radio` 정규식, `pxt.json` 의존성 `github:kocoafab/...#sha`), `DEMOS`, `frame()` 의 `sTof/sMode/sVel` 갱신, `window.__sim`. 군무(`world.extra`, `danceCam`)는 4족 시연 전용 → 삭제 가능.
9. **eye/LED**: 8x8 눈(`EXPRESSIONS`, `E8`, `headFrame`) → Maqueen 은 RGB 2개(+전조등). `bodyLed=[r,g,b]` 패턴(clamp 0..255, 뷰가 `rgb()` 로 발광 색)을 그대로 재사용해 `ledL/ledR` 로 확장.
10. **examples/docs/tests**: `makecode/*.ts` 와 `tests/build-sim-examples.js` 의 `META`(그룹·따라 하기 문구) 새로, 재생성.

### 그대로 두는 것
`compile()`(Babel 플러그인), `Runner` 전체(sleep/spawn/forever/press/radioReceive/stop/start), `warnProxy/enumProxy`, `basic/input/radio/led/loops/control/serial` 의 micro:bit 공통 네임스페이스(5x5 LED 글꼴·`scroll`·`showIcon`), `World`(충돌·낙하·raycast·`setSize`·장애물), `View2D` 의 `scale/onClick/fit`(배치 로직), `View3D` 의 renderer/camera/controls/table/follow, `devices.js` 의 `strip`/구조, 환경 패널, BroadcastChannel 브리지, 도우미(assistant.js; 안전 규칙·API 목록은 새 교구용으로 갱신), 분할 막대, MakeCode controller 연동 코드.

### 4족 결합(바퀴 로봇에서 깨지는 지점)
- `Robot.reset/step/targets/bodyPose` 가 `legs.js` import 에 직접 의존(`lengthToAngles`, `legFromAngles`, `GEOM`, `HEAD`). `EST.bodyLen/upperLeg/noseOffset` 도 `GEOM/HEAD` 파생 → legs.js 삭제 시 import 오류로 **모듈 전체가 로드 실패**.
- `Robot.setMode(1..4)` 의 "모드 바뀌면 vel/rotTarget 초기화" 의미는 확장 `checkModeChange` 모방 — 바퀴는 모드 없음.
- `view2d.js`/`view3d.js` 가 `EST,GEOM,HEAD` 와 `R.legs, R.joint, R.raised, R.bodyPose()` 사용; `view3d.drawRobot` 는 `bodyPose().center/pitch` 로 높이·기울기.
- 회전은 `rotTarget/controlYaw`(각도 지정 회전) 모델이라 바퀴의 "속도 지정" 과 다름.
- `index.html` `frame()` 이 `robot.tof()`·`MODES[robot.mode]`·`robot.posture`를 직접 읽음, `reset`/군무/`Robot` 생성 `new Robot(world)`.
- `World.start`(중앙 약간 아래, heading 0), 좌표계: x 오른쪽, y 아래, heading 0=위(북) 시계방향 +, 단위 cm. 3D 는 (x,z=y) 로 매핑, `rotation.y=-heading`.
- 충돌은 **원(반경 `EST.radius`) vs 사각형 장애물**, 막히면 이동만 취소(`bumped`) — 미끄러짐 없음.

## 3. 차동구동(Maqueen Plus V2 류) 모션 모델 제안

### 상태 (Robot.reset 교체)
```js
this.x,this.y,this.heading            // cm, 도(0=북, 시계 +)  (기존 유지)
this.motorL = 0; this.motorR = 0      // 명령값 -255..255 (블록 입력 그대로)
this.wL = 0; this.wR = 0              // 실제 바퀴 속도 cm/s (가감속 반영)
this.rgbL=[0,0,0]; this.rgbR=[0,0,0]  // 전조등/RGB; 기존 bodyLed 대신
this.lineBits=[0,0,0,0,0]; this.sonar=0
this.odoL=0; this.odoR=0              // 엔코더(cm) — 읽기 블록용
this.fallen=false; this.bumped=false; this.trail=[...]
```
### 보정 상수 (EST 에 모음 — 한 곳)
```js
export const EST = {
  maxCmPerSec: 25,        // 명령 255 일 때 바퀴 선속도 (추정; 실측 시 교체)
  deadband: 20,           // 이 값 미만 명령은 모터가 안 돎(실물 특성, 추정)
  accel: 120,             // cm/s^2 가감속 (0 이면 즉시)
  trackWidth: 8.5,        // 바퀴 간격 cm (추정)
  bodyLen: 10, bodyWid: 9.5, radius: 6.5,
  sonarOffset: 5.5, sonarMin: 2, sonarMax: 400, sonarConeDeg: 15,
  lineY: 4, lineSpacing: 1.6, lineSampleR: 0.5,   // 라인센서 5개 위치(차체 앞 ±), 샘플 반경
  lineThreshold: 0.5,
};
```
### 블록 매핑
```js
// controlMotor(MotorsList.M1|M2|ALL, MyEnumDir.Forward|Backward, speed 0..255)   (블록 이름은 확장 소스로 확인)
controlMotor: (m, dir, speed) => {
  const s = clamp(Math.round(speed), 0, 255) * (dir === 0 ? 1 : -1);
  if (m === LEFT || m === ALL) R.motorL = s;
  if (m === RIGHT || m === ALL) R.motorR = s;
  // 속도 경고·한도는 넣지 않는다(정책은 교사 몫). 범위 밖 값만 확장과 같은 방식으로 자른다
},
motorStop: (m) => { /* 같은 방식으로 0 */ },
readUltrasonic: () => R.ultrasonic(),            // cm, 범위 밖이면 0 (실물 규약 확인)
readLineSensor: (i) => R.lineBits[i] , readLineSensors: () => bitmask
setIndexColor/setRGB: (...) => { R.rgbL = ...; }
```
`makeRobodogApi` 처럼 **R 과 h({warnOnce,sleep,...})만 받는 팩토리**로 만들면 여러 대 확장도 가능. 각도 회전 블록이 확장에 있으면(`rotate(deg)`) async 로 `while (...) await h.sleep(20)` 패턴(`rotationAbsolute` 참고)으로 구현, `Math.abs` 비교·3초 타임아웃 유지.

### 갱신 (Robot.step(dt) 교체)
```js
step(dt){
  if (this.fallen) return;
  const tgt = (c) => Math.abs(c) < EST.deadband ? 0 : c/255*EST.maxCmPerSec;
  const slew = (w, t) => w + clamp(t - w, -EST.accel*dt, EST.accel*dt);
  this.wL = slew(this.wL, tgt(this.motorL)); this.wR = slew(this.wR, tgt(this.motorR));
  const v = (this.wL + this.wR)/2, omega = (this.wR - this.wL)/EST.trackWidth;   // rad/s, 시계 +
  const dh = omega*dt*180/Math.PI;
  const mid = (this.heading + dh/2) * Math.PI/180;          // 중점 적분
  const nx = this.x + Math.sin(mid)*v*dt, ny = this.y - Math.cos(mid)*v*dt;
  this.heading += dh;
  this.bumped = this.world.collides(nx, ny, EST.radius);
  if (!this.bumped) { this.x = nx; this.y = ny; } else { this.wL = this.wR = 0; }   // 필요하면 축별 슬라이딩
  this.odoL += this.wL*dt; this.odoR += this.wR*dt;
  /* trail push (기존 코드 복사) */
  if (this.world.offTable(this.x,this.y)) { this.fallen = true; this.motorL=this.motorR=0; }
  this.lineBits = this.world.sampleLine(this);
}
```
- 서브스텝: dt ≤ 0.05 이므로 고속에서도 터널링 거의 없음(25cm/s×0.05=1.25cm < radius). 속도 상수를 키우면 `for` 로 n 등분.
- 회전 방향 규약: 오른쪽 바퀴가 더 빠르면 시계 방향(heading +). 좌우 부호는 반드시 시험으로 고정(아래 4절).
### 초음파
`ultrasonic(){ const d = world.raycast(x, y, heading, EST.sonarOffset, EST.sonarMax); return d >= EST.sonarMax ? 0 : Math.max(EST.sonarMin, d); }`
- 기존 `World.raycast` 는 0.5cm 스텝, 장애물(사각형)+바닥모드 벽 검사. 책상 모드의 "가장자리"는 안 맞음(허공) → 최대거리 반환. 선택적으로 콘(±sonarConeDeg 3개 광선 최소) 으로 확장. 규약 "0 = 범위 밖"은 **확장 소스 확인 후** 고정하고 `devices`/UI 는 `0` 을 "없음" 표시.
- 비용: 최대 400/0.5=800 스텝×장애물 수 — 매 프레임 UI 갱신(`robot.tof()` 가 frame 에서 2회 호출됨)까지 합쳐 부담. 캐시하거나 격자/해석적 ray-AABB 교차(slab method)로 바꿀 것.
### 라인 센서
`World.floor = { w,h, draw(ctx) 또는 segments:[{pts,width}] , bitmap:Uint8Array }` 를 추가. 가장 단순한 구현: 트랙을 해상도 1px=0.5cm 오프스크린 `<canvas>`(검정선 on 흰바닥)로 한 번 그려 `ImageData` 보관 → `sampleLine(R)` 이 센서 i 의 월드 좌표 `p = R.pos + rot(heading)·(lateral_i, +lineY)`(lateral = (i-2)*lineSpacing) 의 픽셀 밝기 < threshold → 1. 같은 canvas 를 View2D 바닥 텍스처·View3D `THREE.CanvasTexture` 로 재사용(트랙 선택 UI: 직선/원/8자/T자 프리셋 함수 `drawTrack(ctx,kind)`).
### Runner·뷰 연결
- Runner 는 무변경. `buildEnv` 만 `maqueenPlusV2 = warnProxy('maqueenPlusV2', makeMaqueenApi(R,{...}))`, ASYNC_NS 추가, `deflib` 에 enum(`MotorsList, MyEnumDir, ...`) 정의 — **MakeCode 가 실제 생성하는 enum 이름**과 맞출 것.
- `stop()` 은 `robot.vel=0; rotTarget=null` → `motorL=motorR=0` 로 바꿈(누락하면 정지 후에도 계속 주행).
- View2D: `drawRobotTop` 를 직사각 차체 + 바퀴 2개 + 앞 센서 두 눈 + 라인센서 5점(켜짐 색) + 소나 부채꼴; side 캔버스/눈 캔버스 삭제. View3D: `makeDog` → 박스 차체+실린더 바퀴(`wheel.rotation.x = odo/r`), `bodyPose` 불필요(`y` 고정 = 바퀴 반경), `beam` 은 `ultrasonic()` 길이로 재사용, 바닥 텍스처 추가.
- `frame()`: 센서 패널에 `초음파, 라인 5비트, 좌/우 속도, 방향` 표시. 초음파 값은 **패널 슬라이더로 수동 덮어쓰기** 옵션(`robot.sonarOverride`)을 두면 수업에서 유용.

## 4. 시험 전략 (Playwright, 헤드리스 크로미움)
공통: `tests/*.js` 는 CJS, `chromium.launch()`, 정적 서버 필요(`BASE` 인자, 기본 `http://127.0.0.1:8765/`), `/api/**` 는 `p.route` 로 가짜 응답(도우미 서버 없음), `pageerror` 중 MakeCode 내부 오류는 제외, `check(name, ok, detail)` → PASS/FAIL 출력·종료코드. 장애 로그는 `#log .error`/`.warn` 를 읽음.
- `tests/sim-e2e.js` (254줄, 핵심): ① 자동 시연 ② 예제별 실행 오류 0 ③ 상태 수치 검증(속도 30 1초 → 약 4.5cm, 시계 90° 회전, 사각형 4회 후 360°·제자리 복귀) ④ 라디오 버튼·상태기계(2초 끊김 정지 등) ⑤ 장애물 앞 정지(`tof<20`) ⑥ `spaceSize=120x80` + 전속 직진 → `fallen===true` ⑦ **`while(true){n+=1}` 에도 페이지 응답(Promise.race 2초)** ⑧ 미지원 블록·음악 경고 텍스트 ⑨ 문법 오류 메시지 "읽을 수 없어요" ⑩ 3D 렌더 여부 ⑪ AI 브리지 별도 페이지(ai.html) → BroadcastChannel → `robot.vel` ⑫ 공식 각도표 일치(`robot.joint`) ⑬ 군무 8대 ⑭ 실제 makecode.microbit.org iframe 삽입(인터넷 필요, 느림) ⑮ 390px 가로 스크롤 없음 ⑯ 페이지 오류 없음.
- `tests/sim-devices.js`: 브라우저 없이 `detectDevices`/`EXAMPLES` 를 ESM `import()` 로 단위 검증(주석 속 블록명 무시 포함) + 화면에서 3D 객체 상태(`view3d().beam.visible`, `card.key`, `tofTag.key`, `btnTag.key`) 확인 → **뷰 객체에 디버그 접근 필드를 노출**하는 패턴.
- `tests/sim-examples.js`: 예제 그룹/개수/첫 예제 id, "따라 하기" 문구 순서, 각 예제 동작(상태 변화).
- `tests/sim-layout.js`: 분할 막대 드래그·키보드·더블클릭·새로고침 유지·모바일 숨김.
- 보조: `sim-shots.js`, `sim-compare.js`, `sim-dance-shots.js` (스크린샷), `tests/build-sim-examples.js`.
### 새 교구용 동등 시험 작성
1. `window.__sim` 훅은 그대로 두고 필드만 `robot.motorL/R, x, y, heading, rgbL, lineBits` 로.
2. 순수 단위 시험(브라우저 없이 `import('bridge/sim/runtime.js')`는 `window`/`performance` 참조 때문에 직접은 어려움 → `Robot/World` 가 DOM 비의존이므로 Node 18+ 에서 `globalThis.window = {}` 스텁 후 `new World(); new Robot(w); r.step(0.016)` 를 루프로 돌려 결정적 검증 가능. 권장: `tests/sim-kinematics.mjs`).
3. e2e 체크 목록: (a) 직진 `controlMotor(ALL, fwd, 255)` 2초 → 이동거리 ≈ `maxCmPerSec*2`±오차, heading 불변 (b) 좌만 구동 → 오른쪽(시계) 회전, 부호 고정 (c) 좌우 반대 → 제자리 회전 각속도 ≈ `2*v/trackWidth` (d) deadband 미만 명령 → 정지 (e) 초음파: 장애물 거리 30cm 배치 후 값 ≈ 30-`sonarOffset`, 없을 땐 0, 코드 "20 미만이면 멈춤" 시 정지 (f) 라인: 트랙 위에 놓고 `lineBits` 기대 패턴, 라인 따라가기 예제가 N초 후 이탈 안 함 (g) 벽/책상 낙하/장애물 충돌 (h) `while(true)` 응답성 (i) 미지원 블록 경고 (j) `detectDevices` 단위 (k) 예제 전부 실행 오류 0 (l) 모바일 폭 (m) 페이지 오류 0, 스크린샷은 `tests/mc/` 로.
4. 대기 시간은 `waitForTimeout` 실시간이라 느림 → 필요하면 `__sim` 에 `fastForward(sec)`(robot.step 반복) 훅을 추가해 시간 의존 시험을 짧게(결정성 향상, 기존 코드엔 없음).

## 5. 주의할 점 (함정)
- **await 삽입 범위**: `CallExpression` 이 async 함수 안이면 *전부* `await` 로 감쌈(Math.round, 배열 메서드 포함) → 동기 콜백(`arr.forEach(x => ...)`, `.map`, `sort` 비교함수)의 안쪽에서 호출이 await 되면 비-async 함수 안이라 건너뛰고, 대신 forEach 콜백이 Promise 를 무시해 순서가 깨질 수 있음. 핸들러를 `ASYNC_NS` 에 없는 네임스페이스에 등록하면 async 승격이 안 되어 안쪽의 pause 가 문법 오류. 새 확장 이벤트 API(`onUltrasonic`, `onLineChanged`) 이름을 모두 점검.
- **무한 루프**: 루프 본문 앞 `__yield`, 100회마다 `sleep(0)`(setTimeout 4ms 클램프 가능). 루프 안에서 센서만 읽고 `pause` 없는 코드는 CPU 100%에 가깝고 `gen`/`running` 으로만 중단됨. `forever` 는 매 반복 20ms 휴식(실물보다 느릴 수 있음 → "쉬기 없는 forever 빠름" 차이 문서화).
- **중복 실행**: `runCode` 가 `runner.stop()`(gen++) 후 start; 이전 fiber 의 setTimeout 은 `gen` 불일치로 reject → StopSignal 무시. 새 상태 필드를 만들면 `reset` 과 `stop()` 양쪽에서 초기화.
- **이벤트 폭주**: 라디오 반복 전송 500ms 마다 핸들러 spawn — 핸들러가 길면 겹쳐 실행(실물 micro:bit 는 핸들러 직렬). 모터 명령이 겹쳐도 "마지막 값"이라 큰 문제는 없으나 `pause` 포함 핸들러는 상태기계 꼬임 가능(ex 03 의 잠금).
- **성능**: rAF 마다 `robot.tof()`(raycast 0.5cm 스텝 ×2), 3D 에서 `JSON.stringify(obstacles)` 로 변경 감지, trail 2000점 `setFromPoints` 재생성, `view2d.draw` 매 프레임 전체 재그리기. 큰 공간(300×200)+멀리 raycast 에서 느림. 라인 센서 샘플링은 5점이라 괜찮지만 트랙 비트맵 갱신은 한 번만.
- **dt 클램프 0.05**: 탭 비활성/느린 PC 에서 시뮬레이션 시간이 실시간보다 느려져 코드 `pause` 와 물리가 어긋남(코드 시간 vs 물리 시간). 정밀 시험은 headless 에서 일정 fps 확인.
- **경고 정책**: `warnOnce(key,msg)` 로 실행당 1회 로그, 미지원 블록은 무시(+0 반환), 실물과 다른 점(한글 눈 LED, AI 카메라 고정 "인식 없음", 음악 핀 충돌 `music.*`, 속도 권장치 `>30`)은 항상 사용자에게 고지. 새 교구도 핀 충돌(마이크로비트 P0/P1/P2 사용처)·배터리·서보/모터 한계를 경고로.
- **센서 규약 가정**: tofMax=255 "값 단위를 cm 로 가정", 모터 deadband, 초음파 0 의미 등 모두 확인 전 추정 → 코드 주석·docs·UI 에 "추정치" 표기(CLAUDE 철학과 docs/08 과 일치).
- **좌표/부호**: y 아래, heading 시계 +, 3D 는 `rotation.y = -heading`; 좌우 바퀴 부호 뒤집힘이 가장 흔한 버그 → 4절(b) 시험으로 고정.
- **외부 의존**: Babel 2.8MB(지연 로드, 실행 시 `ensureBabel` 대기), three(importmap/ lib), MakeCode iframe(`MC_ORIGIN`, 확장 `github:...#sha` 고정 — 새 확장은 **커밋 SHA 로 고정**하고 `pxt.json` 의존성 갱신), 오프라인이면 JS 탭 폴백(60초). `examples.js` 는 자동 생성물이므로 `makecode/` 원본과 `build-sim-examples.js` 만 수정.
- **자동 장애물/장면**: `applyDevices` 가 코드에 장치 쓰면 장면을 자동 구성(장애물 1개)하지만, 시연 중엔 `keepScene` — 새 교구에선 트랙/장애물 프리셋을 같은 지점에서.
- **정지 상태 UI**: 책상에서 `fallen` → frame 이 `runner.stop()` + 오류 로그; 바퀴 로봇은 "바닥(벽 있음)" 기본값이 더 자연스러울 수 있음(`world.useTable=false` 기본, 낙하 시험은 별도).

## 6. 구동 템플릿 고르기 (다리 / 차동 / 메카넘)

| 구동 | 예 | 상태 | 몸 움직임 계산 |
|---|---|---|---|
| 4족(다리) | 로보독 | 관절 각도, 자세, `vel`·`rotTarget` | `legs.js` 결합 그대로(기준 구현) |
| 차동 2바퀴 | 맥퀸 | `motorL/R` | 위 3절 |
| 메카넘 4바퀴 | 포니봇 | `wheel[FL,FR,RL,RR]` 명령값 | 아래 |

### 메카넘: 바퀴 배치는 블록 이름이 아니라 확장 소스에서
블록 이름("시계 방향", 화살표)과 주석은 틀릴 수 있다. 확장이 **방향별로 어느 모터를 어느 쪽으로 돌리는지**(PWM 핀 표)를 읽어 모터 번호 → 바퀴 위치를 푼다.
1. 대각선 이동(↖ ↗)에서 함께 도는 두 모터 = 대각선 쌍(↖는 FR+RL, ↗는 FL+RR).
2. 제자리 돌기에서 같은 방향으로 도는 두 모터 = 같은 쪽(왼쪽/오른쪽).
3. 두 정보를 겹치면 4개 위치가 정해진다. 결과는 "소스 기준, 실물 확인 필요"로 kit 설정에 적는다.

순기구학(롤러 45°, 시계 방향 = heading +, 앞 = +y가 아닌 화면 위):
```js
// w = 바퀴 선속도 cm/s (명령값/255 × EST.maxCmPerSec, 부호 = 방향)
const vx = ( w.FL - w.FR - w.RL + w.RR) / 4;       // 오른쪽(+) 옆 이동
const vy = ( w.FL + w.FR + w.RL + w.RR) / 4;       // 앞(+)
const om = ( w.FL - w.FR + w.RL - w.RR) / (4 * EST.k);   // k = (차폭+축간)/2, 라디안/초, 시계 +
// 몸 좌표 → 세계 좌표: heading으로 회전 후 적분(중점 적분), 충돌·추락은 World 그대로
```
- 시험으로 부호를 고정한다: 앞 1초 → y만 감소(화면 위), 오른쪽 옆 → x만 증가·heading 불변, 시계 방향 1초 → heading 증가·제자리.
- 대각선은 두 바퀴만 돌므로 속도가 앞의 절반(√2/2 방향 합성) — 공식이 그대로 재현한다.

### 값 범위·센서 규약은 그대로 재현(정책 아님)
- 확장이 하는 대로 자른다(예: `speed*16`을 4095에서 자름 → 0~255). 학생이 넣은 값이 범위 안이면 **그 값 그대로** 움직인다. 수업 한도는 시뮬레이터가 아니라 도우미 설정·교사 몫.
- 센서 '못 읽음' 값은 교구마다 다르다: 로보독 거리 0 = 못 읽음, 포니봇 `ping`은 반사 없음이면 **최대 거리(기본 500cm)**를 돌려준다. 확장 소스의 그 분기를 찾아 같게 만든다.
- 라인 센서 값 의미(검은 선 = 1인지 0인지)도 소스·실물로 확인 전까지 "확인 필요".
