// 로보독(코코아팹 · 4다리 걷는 로봇) 어댑터 — 통합 시뮬레이터(bridge/sim/index.html)의 기본 교구.
// 로보독 전용 화면 부분(자동 시연·군무·3D·AI 카메라·공간 크기)은 index.html 에 그대로 있고, 이 파일은 모델·실행기·그리기·장치·예제·도우미·MakeCode 설정을 모음.
import { Robot, World, Runner, EST } from '../runtime.js';
import { ruleAssistant, SAMPLE_REQUESTS, checkAi, askAi } from '../assistant.js';
import { View2D, drawEyes } from '../view2d.js';
import { EXAMPLES, GROUPS } from '../examples.js';
import { detectDevices, DEVICE_INFO, runHint, needsFromCode, usesAiCards } from '../devices.js';
import * as PROPS from '../props.js';

const $ = (id) => document.getElementById(id);
const MODES = { 1: '걷기', 2: '다리 설정', 3: '모터 각도', 4: '자세' };
const EXT_PIN = {   // 확인한 버전으로 고정
  robodog: 'github:kocoafab/robodog#331dd39f0ea616c66ad627f8fe0b58cee45061c8',
  'robodog-radio': 'github:kocoafab/robodog-radio#4a50d45d23f20776bb71f1d382fb13d6142ca3f0',
};

export default {
  id: 'robodog',
  name: '로보독',
  docTitle: '로보독 시뮬레이터 · 로보독 AI 교실',
  codeKey: 'robodog-sim-code',
  supports3d: true,
  radius: EST.radius,
  ui: {},          // id → innerHTML: 비워 두면 index.html 에 적힌 로보독 글 그대로
  groups: GROUPS,
  examples: EXAMPLES,
  examplePlaceholder: '예제 고르기 (본체 버튼 / 라디오 리모컨)…',
  defaultExampleId: '05_motion-tour',
  mapOpts: { tiles: false, mapLabel: (m) => `포니봇용(라인 센서) · ${m.title}` },
  detectDevices, DEVICE_INFO, runHint, needsFromCode, usesAiCards,
  assistant: { ai: true, sample: SAMPLE_REQUESTS, rule: ruleAssistant, checkAi, askAi },
  makecode: {
    projectName: '로보독 시뮬레이터', idPrefix: 'robodog-sim-',
    base: { core: '*', radio: '*', microphone: '*' },
    pins: EXT_PIN,
    // 코드에 맞는 로보독 확장 고르기(무선 AI 블록이 있으면 robodog-radio)
    blockPackage(code) {
      if (/robodog\.(rfBand|aiDetection|faceTracking|getCameraAlive|getFaceClass|getFaceTracking|getColorDetect|getQrCode|getAiPosition)\b/.test(code)) return 'robodog-radio=github:kocoafab/robodog-radio';
      if (/robodog\.|deflib\./.test(code)) return 'robodog=github:kocoafab/robodog';
      return undefined;
    },
  },
  demos: true,   // 자동 시연·군무는 index.html 에 있음

  createModel() { const world = new World(); return { world, robot: new Robot(world) }; },
  createRunner(robot, ui) { return new Runner(robot, ui); },
  makeView2D(top, side, world, robot) { return new View2D(top, side, world, robot); },
  editorOpts({ world }) {
    return { getSize: () => world.table, storageKey: () => 'robodog-sim.scene.v1', getMeta: () => ({ size: { ...world.table }, start: { ...world.start } }), applyMeta: () => {}, onMessage: () => {} };
  },
  // 코드가 읽는 센서(거리·색 인식·AI 신호 카드)에 맞춰 '없는 것만' 장면에 채움. 사용자가 놓거나 옮긴 것은 그대로 둠
  autoSetup(code, { world, robot, log }) {
    const needs = needsFromCode(code, world.aiClass);
    if (!needs.length) return [];
    const rr = { x: robot.x, y: robot.y, heading: robot.heading, radius: EST.radius }, ctx = { size: world.table }, o = { robotRadius: EST.radius, distanceSteps: [55, 70, 90, 40, 30] };   // 걷는 속도가 느려 거리센서 상자는 조금 멀리
    const cards = usesAiCards(code), notes = [];
    notes.push(...PROPS.ensureFor(needs.filter(n => !(cards && n === 'object:green')), world.props, rr, ctx, o));
    // AI 신호 카드: 초록은 오른쪽 옆(카메라 시야 밖)에 둬서, 빨강 → 끌어 옮기기 → 초록 으로 시험하게 함
    if (cards && needs.includes('object:green')) notes.push(...PROPS.ensureFor(['object:green'], world.props, { ...rr, heading: rr.heading + 40 }, ctx, o).map(n => n.replace('앞 ', '오른쪽 앞 ')));
    const out = notes.map(n => (cards ? n.replace('물체를', '카드를').replace('세웠어요', '놓았어요') : n));
    out.forEach(n => log(n));
    return out;
  },
  // 그림 한 장(3D 보기면 3D, 아니면 위에서 본 2D + 눈 LED)
  draw({ mode3d, view3d, view2d, robot }) {
    const eyes = robot.headFrame();
    if (mode3d && view3d) { view3d.draw(eyes); drawEyes($('eyes3'), eyes); }
    else { view2d.draw(); drawEyes($('eyes'), eyes); }
  },
  // 센서 칸(거리·방향·모드·속도·AI 카메라)
  updatePanels({ robot, world, devs, camEmuOn, camLast }) {
    $('sTof').textContent = robot.tof() + (robot.tof() >= 255 ? ' (없음)' : ' cm');
    let h = ((Math.round(robot.heading) % 360) + 360) % 360; if (h > 180) h -= 360;
    $('sHead').textContent = h;
    $('sMode').textContent = MODES[robot.mode] + (robot.mode === 4 ? ` (${['준비', '앉기', '물구나무', '기지개', '인사'][robot.posture]})` : '');
    $('sVel').textContent = robot.vel;
    // AI 카메라: 색 인식 모드면 보이는 색·클래스·위치, 아니면 모드
    world.camView = devs.includes('aicam') || camEmuOn;
    let aiTxt = '-';
    if (robot.aiMode === 3) { const v = robot.aiSees(); aiTxt = v ? `색 인식: ${PROPS.colorKo(v.color)} → 클래스 ${world.aiClass[v.color]} (위치 ${Math.round(v.bearing / EST.aiCam.halfFovDeg * EST.aiCam.posRange)})` : '색 인식: 안 보임 → 0'; }
    else if (devs.includes('aicam')) aiTxt = `모드 ${robot.aiMode}: 인식 없음(0)`;
    else if (camEmuOn) aiTxt = camLast.n ? `카메라 흉내: 라디오 ${camLast.n}` : '카메라 흉내 켜짐';
    if ($('sAi').textContent !== aiTxt) $('sAi').textContent = aiTxt;
  },
};
